/**
 * Smart Scheduling — helpers puros.
 * Horario operativo y slots en hora local del navegador.
 * v2: soporta disponibilidad estructurada del walker (días + rango horario).
 */

export const MIN_BOOKING_LEAD_MINUTES = 60;
export const BUSINESS_OPEN_HOUR = 8;
export const BUSINESS_CLOSE_HOUR = 20;
export const MINUTES_PER_SLOT = 30;

/**
 * Nombres de días en español indexados por Date.getDay()
 * 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
 */
const _WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Slots HH:mm desde BUSINESS_OPEN_HOUR:00 hasta BUSINESS_CLOSE_HOUR:00, cada 30 min. */
export function getAllBusinessDaySlots() {
  const out = [];
  for (
    let m = BUSINESS_OPEN_HOUR * 60;
    m <= BUSINESS_CLOSE_HOUR * 60;
    m += MINUTES_PER_SLOT
  ) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
}

const _ALL_SLOTS = getAllBusinessDaySlots();

/** @param {Date} d @returns {string} YYYY-MM-DD en hora local */
export function formatYmdLocal(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** @returns {Date} instancia local */
export function combineDateAndTime(dateYmd, timeHHmm) {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const [hh, mm] = timeHHmm.split(':').map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

/**
 * Extrae el rango horario estructurado del walker.
 * @param {object|null} walker
 * @returns {{ startTime: string, endTime: string } | null}
 */
export function getWalkerTimeRange(walker) {
  if (!walker) return null;
  const start = walker.available_start_time;
  const end = walker.available_end_time;
  if (!start || !end) return null;
  return { startTime: start, endTime: end };
}

/**
 * Verifica si un Date está dentro de la disponibilidad configurada del walker
 * (día de la semana y rango horario). Retorna true si el walker no tiene configuración.
 * @param {Date} dt
 * @param {object|null} walker
 * @returns {boolean}
 */
export function isWithinWalkerAvailability(dt, walker) {
  if (!walker) return true;

  const days = walker.availability_days;
  if (days?.length) {
    if (!days.includes(_WEEKDAY_NAMES[dt.getDay()])) return false;
  }

  const range = getWalkerTimeRange(walker);
  if (range) {
    const hhmm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    if (hhmm < range.startTime || hhmm > range.endTime) return false;
  }

  return true;
}

/**
 * Slots disponibles para la fecha elegida.
 * Si se pasa `walkerRange`, los slots se limitan al rango del walker.
 * @param {string} dateYmd YYYY-MM-DD
 * @param {Date} [now]
 * @param {{ startTime: string, endTime: string } | null} [walkerRange]
 * @returns {string[]}
 */
export function getAvailableTimeSlots(dateYmd, now = new Date(), walkerRange = null) {
  if (!dateYmd) return [];
  const todayStr = formatYmdLocal(now);
  if (dateYmd < todayStr) return [];

  const startTime = walkerRange?.startTime ?? `${String(BUSINESS_OPEN_HOUR).padStart(2, '0')}:00`;
  const endTime = walkerRange?.endTime ?? `${String(BUSINESS_CLOSE_HOUR).padStart(2, '0')}:00`;
  const rangeSlots = _ALL_SLOTS.filter((t) => t >= startTime && t <= endTime);

  if (dateYmd > todayStr) return [...rangeSlots];

  // dateYmd === todayStr: aplicar lead time
  const minInstant = new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60 * 1000);
  return rangeSlots.filter((t) => combineDateAndTime(dateYmd, t) >= minInstant);
}

/**
 * Indica si una fecha tiene slots disponibles Y es un día hábil del walker.
 * @param {string} dateYmd YYYY-MM-DD
 * @param {Date} [now]
 * @param {object|null} [walker]
 * @returns {boolean}
 */
export function isDateSelectable(dateYmd, now = new Date(), walker = null) {
  const walkerRange = getWalkerTimeRange(walker);
  if (!getAvailableTimeSlots(dateYmd, now, walkerRange).length) return false;

  const days = walker?.availability_days;
  if (days?.length) {
    const dt = new Date(`${dateYmd}T12:00:00`);
    if (!days.includes(_WEEKDAY_NAMES[dt.getDay()])) return false;
  }

  return true;
}

/**
 * Primera fecha (desde hoy) que tenga al menos un slot respetando disponibilidad del walker.
 * Busca hasta 7 días hacia adelante; si no encuentra, retorna mañana como fallback.
 * @param {Date} [now]
 * @param {object|null} [walker]
 * @returns {string} YYYY-MM-DD
 */
export function getMinSelectableDateString(now = new Date(), walker = null) {
  const todayStr = formatYmdLocal(now);
  if (isDateSelectable(todayStr, now, walker)) return todayStr;

  const t = new Date(now);
  for (let i = 1; i <= 7; i++) {
    t.setDate(t.getDate() + 1);
    const str = formatYmdLocal(t);
    if (isDateSelectable(str, now, walker)) return str;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatYmdLocal(tomorrow);
}

export function getMaxSelectableDateString(now = new Date()) {
  const t = new Date(now);
  t.setDate(t.getDate() + 365);
  return formatYmdLocal(t);
}

/**
 * @param {string} dateYmd
 * @param {string} timeHHmm
 * @param {Date} [now]
 * @param {object|null} [walker]
 * @returns {boolean}
 */
export function isScheduledTimeValid(dateYmd, timeHHmm, now = new Date(), walker = null) {
  if (!dateYmd || !timeHHmm) return false;
  if (!isDateSelectable(dateYmd, now, walker)) return false;
  const walkerRange = getWalkerTimeRange(walker);
  return getAvailableTimeSlots(dateYmd, now, walkerRange).includes(timeHHmm);
}

import {
  getAvailableTimeSlots,
  getAllBusinessDaySlots,
  combineDateAndTime,
  isScheduledTimeValid,
  getMinSelectableDateString,
  formatYmdLocal,
  MIN_BOOKING_LEAD_MINUTES,
} from './walkScheduling';

describe('getAllBusinessDaySlots', () => {
  it('genera slots cada 30 min de 08:00 a 20:00 inclusive', () => {
    const slots = getAllBusinessDaySlots();
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('20:00');
    expect(slots.length).toBe(25);
  });
});

describe('getAvailableTimeSlots', () => {
  it('fecha futura: todos los slots operativos', () => {
    const now = new Date(2026, 2, 25, 10, 20, 0);
    const slots = getAvailableTimeSlots('2026-03-26', now);
    expect(slots[0]).toBe('08:00');
    expect(slots.includes('20:00')).toBe(true);
  });

  it('hoy: primer slot respeta lead time 60 min (ej. 10:20 → desde 11:30)', () => {
    const now = new Date(2026, 2, 25, 10, 20, 0);
    const slots = getAvailableTimeSlots('2026-03-25', now);
    const minAfter = new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60 * 1000);
    expect(slots[0]).toBe('11:30');
    expect(slots.includes('11:00')).toBe(false);
    expect(combineDateAndTime('2026-03-25', slots[0]) >= minAfter).toBe(true);
  });

  it('hoy: sin slots si lead time deja fuera del horario operativo', () => {
    const now = new Date(2026, 2, 25, 19, 10, 0);
    const slots = getAvailableTimeSlots('2026-03-25', now);
    expect(slots.length).toBe(0);
  });

  it('fecha pasada: sin slots', () => {
    const now = new Date(2026, 2, 25, 12, 0, 0);
    expect(getAvailableTimeSlots('2026-03-24', now).length).toBe(0);
  });
});

describe('isScheduledTimeValid', () => {
  it('rechaza hora que no está en la lista del día', () => {
    const now = new Date(2026, 2, 25, 10, 20, 0);
    expect(isScheduledTimeValid('2026-03-25', '11:00', now)).toBe(false);
    expect(isScheduledTimeValid('2026-03-25', '11:30', now)).toBe(true);
  });
});

describe('getMinSelectableDateString', () => {
  it('si hoy no tiene slots, min es mañana', () => {
    const now = new Date(2026, 2, 25, 19, 10, 0);
    const min = getMinSelectableDateString(now);
    expect(min).toBe('2026-03-26');
  });

  it('si hoy tiene slots, min es hoy', () => {
    const now = new Date(2026, 2, 25, 10, 20, 0);
    const min = getMinSelectableDateString(now);
    expect(min).toBe(formatYmdLocal(now));
  });
});

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, Clock, MapPin, Dog, AlertCircle, Plus, XCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAvailableTimeSlots,
  getMinSelectableDateString,
  getMaxSelectableDateString,
  getWalkerTimeRange,
  combineDateAndTime,
  isScheduledTimeValid,
  formatYmdLocal,
} from '../utils/walkScheduling';

const SIZE_LABELS = { S: 'Pequeño', M: 'Mediano', L: 'Grande' };

export default function CreateWalkRequest() {
  const [searchParams] = useSearchParams();
  const walkerId = searchParams.get('walkerId');
  const [walker, setWalker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pets, setPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(true);

  const [userProfile, setUserProfile] = useState(null);
  const [addressOption, setAddressOption] = useState('custom');

  const [scheduleTick, setScheduleTick] = useState(0);
  const [scheduleInitialized, setScheduleInitialized] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: '60',
    address: '',
    notes: '',
    petId: '',
  });

  useEffect(() => {
    const id = setInterval(() => setScheduleTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(), [scheduleTick]);

  const walkerRange = useMemo(() => getWalkerTimeRange(walker), [walker]);

  const availableSlots = useMemo(
    () => getAvailableTimeSlots(formData.date, now, walkerRange),
    [formData.date, scheduleTick, walkerRange],
  );

  // true si el día seleccionado está en los días disponibles del walker
  const isDayAvailable = useMemo(() => {
    if (!formData.date || !walker?.availability_days?.length) return true;
    const dt = new Date(`${formData.date}T12:00:00`);
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return walker.availability_days.includes(dayNames[dt.getDay()]);
  }, [formData.date, walker]);

  const todayYmd = formatYmdLocal(now);
  const minDateStr = useMemo(() => getMinSelectableDateString(now, walker), [now, walker]);
  const maxDateStr = useMemo(() => getMaxSelectableDateString(now), [now]);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      toast.error('Solo los dueños pueden solicitar paseos');
      navigate('/');
      return;
    }

    if (!walkerId) {
      toast.error('Debe seleccionar un paseador');
      navigate('/walkers');
      return;
    }

    const fetchData = async () => {
      try {
        const [walkerRes, petsRes, profileRes] = await Promise.all([
          api.get(`/walkers/${walkerId}`),
          api.get('/me/pets'),
          api.get('/me/profile'),
        ]);

        setWalker(walkerRes.data);
        setPets(petsRes.data);
        setUserProfile(profileRes.data);

        const defaultPet = petsRes.data.find((p) => p.is_default);
        setFormData((prev) => ({
          ...prev,
          petId: defaultPet
            ? defaultPet.pet_id
            : petsRes.data.length > 0
              ? petsRes.data[0].pet_id
              : '',
        }));

        if (profileRes.data.address_text) {
          setAddressOption('profile');
          setFormData((prev) => ({ ...prev, address: profileRes.data.address_text }));
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        toast.error('Error al cargar la información necesaria');
      } finally {
        setLoadingPets(false);
      }
    };

    fetchData();
  }, [walkerId, user, navigate]);

  useEffect(() => {
    if (loadingPets || !walker || scheduleInitialized) return;
    const n = new Date();
    const range = getWalkerTimeRange(walker);
    const minD = getMinSelectableDateString(n, walker);
    const slots = getAvailableTimeSlots(minD, n, range);
    if (slots.length) {
      setFormData((prev) => ({ ...prev, date: minD, time: slots[0] }));
    }
    setScheduleInitialized(true);
  }, [loadingPets, walker, scheduleInitialized]);

  /** Si es “hoy” y el minuto siguiente ya no deja slots, pasar a la próxima fecha válida. */
  useEffect(() => {
    if (!formData.date) return;
    const n = new Date();
    const range = getWalkerTimeRange(walker);
    const slots = getAvailableTimeSlots(formData.date, n, range);
    if (slots.length > 0) return;
    const todayStr = formatYmdLocal(n);
    if (formData.date !== todayStr) return;
    const nextMin = getMinSelectableDateString(n, walker);
    const nextSlots = getAvailableTimeSlots(nextMin, n, range);
    if (nextSlots.length) {
      setFormData((prev) => ({ ...prev, date: nextMin, time: nextSlots[0] }));
    }
  }, [scheduleTick, formData.date, walker]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = useCallback((e) => {
    const value = e.target.value;
    const n = new Date();
    const range = getWalkerTimeRange(walker);
    const slots = getAvailableTimeSlots(value, n, range);
    setFormData((prev) => {
      let nextTime = prev.time;
      if (!slots.length) {
        nextTime = '';
      } else if (!slots.includes(prev.time)) {
        nextTime = slots[0];
      }
      return { ...prev, date: value, time: nextTime };
    });
  }, [walker]);

  const handleAddressOptionChange = (option) => {
    setAddressOption(option);
    if (option === 'profile' && userProfile?.address_text) {
      setFormData((prev) => ({ ...prev, address: userProfile.address_text }));
    } else if (option === 'custom') {
      setFormData((prev) => ({ ...prev, address: '' }));
    }
  };

  const selectedPet = useMemo(
    () => pets.find((p) => p.pet_id === formData.petId),
    [pets, formData.petId],
  );

  const addressOk = formData.address.trim().length > 0;
  const scheduleOk =
    formData.date &&
    formData.time &&
    isScheduledTimeValid(formData.date, formData.time, now, walker);

  // Size compatibility check
  const sizeCompatible = useMemo(() => {
    if (!selectedPet || !walker) return true;
    const allowed = walker.allowed_sizes || [];
    if (allowed.length === 0) return true; // no restriction
    return allowed.includes(selectedPet.size);
  }, [selectedPet, walker]);

  const canSubmit =
    !loading &&
    pets.length > 0 &&
    formData.petId &&
    addressOk &&
    scheduleOk &&
    sizeCompatible;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canSubmit) {
      toast.error('Revisá fecha, hora, dirección y mascota antes de enviar.');
      return;
    }

    const dateTimeStart = combineDateAndTime(formData.date, formData.time);
    if (!isScheduledTimeValid(formData.date, formData.time, new Date())) {
      toast.error('El horario ya no es válido. Elegí otro.');
      return;
    }

    setLoading(true);
    try {
      const walkData = {
        walker_profile_id: walkerId,
        scheduled_start_at: dateTimeStart.toISOString(),
        estimated_duration_minutes: parseInt(formData.duration, 10),
        start_address_text: formData.address,
        notes: formData.notes || undefined,
        pet_id: formData.petId,
      };

      await api.post('/walks', walkData);
      toast.success('¡Solicitud de paseo enviada correctamente!');
      navigate('/me/walks');
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      let errorMessage = 'Error al crear la solicitud';

      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail
            .map((err) => `${err.loc[1]}: ${err.msg}`)
            .join(', ');
        } else if (typeof error.response.data.detail === 'object') {
          errorMessage = JSON.stringify(error.response.data.detail);
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!walker || loadingPets) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  const estimatedCost = (walker.price_per_hour * parseInt(formData.duration, 10)) / 60;

  const summaryDateLabel = formData.date
    ? new Date(formData.date + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const summaryAddressShort =
    formData.address.length > 48 ? `${formData.address.slice(0, 45)}…` : formData.address;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to={`/walkers/${walkerId}`}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors"
          data-testid="back-to-profile-link"
        >
          <ArrowLeft size={20} />
          <span>Volver al perfil</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h1
            className="text-3xl font-bold text-[#1F2937] mb-2"
            style={{ fontFamily: 'Outfit' }}
            data-testid="create-walk-title"
          >
            Solicitar Paseo
          </h1>
          <p className="text-gray-600 mb-2">
            con <span className="font-semibold">{walker.display_name}</span>
          </p>
          <p className="text-sm text-gray-500 mb-1">
            Los paseos deben solicitarse con al menos 1 hora de anticipación.
            Horario del paseador:{' '}
            {walker.available_start_time || '08:00'} a {walker.available_end_time || '20:00'}.
          </p>
          {walker.availability_days?.length > 0 && (
            <p className="text-sm text-gray-500 mb-8">
              Días disponibles: {walker.availability_days.join(', ')}.
            </p>
          )}

          {/* No-address warning */}
          {!userProfile?.latitude && !userProfile?.longitude && userProfile !== null && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <div>
                <p className="font-semibold">Tu dirección no está verificada en el mapa</p>
                <p className="mt-0.5">
                  El paseador no podrá ver tu ubicación exacta. Podés{' '}
                  <Link to="/app/account" className="underline font-semibold hover:text-amber-900">
                    completar tu perfil
                  </Link>{' '}
                  para mejorar la experiencia.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar size={16} className="inline mr-2" />
                  Fecha *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleDateChange}
                  min={minDateStr}
                  max={maxDateStr}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="walk-date-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock size={16} className="inline mr-2" />
                  Hora *
                </label>
                <select
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  disabled={!formData.date || availableSlots.length === 0}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required={availableSlots.length > 0}
                  data-testid="walk-time-select"
                >
                  {!formData.date ? (
                    <option value="">Seleccioná primero una fecha</option>
                  ) : availableSlots.length === 0 ? (
                    <option value="">Sin horarios disponibles</option>
                  ) : (
                    availableSlots.map((t) => (
                      <option key={t} value={t}>
                        {t} hs
                      </option>
                    ))
                  )}
                </select>
                {!formData.date && (
                  <p className="mt-2 text-sm text-gray-500">
                    Seleccioná una fecha para ver los horarios disponibles.
                  </p>
                )}
                {formData.date && availableSlots.length === 0 && !isDayAvailable && (
                  <p className="mt-2 text-sm text-amber-700">
                    El paseador no trabaja este día. Elegí una fecha disponible.
                  </p>
                )}
                {formData.date && availableSlots.length === 0 && isDayAvailable && (
                  <p className="mt-2 text-sm text-amber-700">
                    No hay horarios disponibles para este día. Probá con otra fecha.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Duración *
              </label>
              <select
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                required
                data-testid="walk-duration-select"
              >
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
                <option value="120">2 horas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-2" />
                Dirección de encuentro *
              </label>

              {userProfile?.address_text ? (
                <div className="space-y-3 mb-3">
                  <label className="flex items-center space-x-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="addressOption"
                      value="profile"
                      checked={addressOption === 'profile'}
                      onChange={() => handleAddressOptionChange('profile')}
                      className="text-[#88D8B0] focus:ring-[#88D8B0]"
                    />
                    <div>
                      <span className="font-semibold block text-gray-800">Usar mi dirección guardada</span>
                      <span className="text-gray-500 text-sm">{userProfile.address_text}</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="addressOption"
                      value="custom"
                      checked={addressOption === 'custom'}
                      onChange={() => handleAddressOptionChange('custom')}
                      className="text-[#88D8B0] focus:ring-[#88D8B0]"
                    />
                    <span className="font-semibold text-gray-800">Ingresar otra dirección</span>
                  </label>
                </div>
              ) : null}

              {(addressOption === 'custom' || !userProfile?.address_text) && (
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Ej: Av. Santa Fe 1234, Palermo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none animate-fadeIn"
                  required
                  autoFocus={addressOption === 'custom'}
                  data-testid="walk-address-input"
                />
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-[#1F2937] mb-4" style={{ fontFamily: 'Outfit' }}>
                <Dog size={20} className="inline mr-2" />
                Mascota
              </h3>

              {pets.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3">
                  <AlertCircle className="text-yellow-600 mt-1" size={20} />
                  <div>
                    <h4 className="font-semibold text-yellow-800">No tenés mascotas registradas</h4>
                    <p className="text-yellow-700 text-sm mb-3">
                      Necesitás agregar al menos una mascota para solicitar un paseo.
                    </p>
                    <Link
                      to="/app/pets/new"
                      className="inline-flex items-center space-x-2 text-[#88D8B0] font-semibold hover:underline"
                    >
                      <Plus size={16} />
                      <span>Agregar Mascota</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Seleccioná tu mascota *
                    </label>
                    <select
                      name="petId"
                      value={formData.petId}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                      required
                      data-testid="pet-select"
                    >
                      <option value="">Seleccionar mascota...</option>
                      {pets.map((pet) => (
                        <option key={pet.pet_id} value={pet.pet_id}>
                          {pet.name} ({pet.species === 'DOG' ? 'Perro' : 'Gato'} - {pet.size})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPet && (
                    <div className={`rounded-xl p-4 border ${
                      sizeCompatible
                        ? 'bg-gray-50 border-gray-100'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center space-x-4">
                        {selectedPet.photo_url ? (
                          <img
                            src={selectedPet.photo_url}
                            alt={selectedPet.name}
                            className="w-12 h-12 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center">
                            <Dog size={20} className="text-[#88D8B0]" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{selectedPet.name}</p>
                          <p className="text-sm text-gray-500">
                            {selectedPet.species === 'DOG' ? 'Perro' : 'Gato'} • {selectedPet.size && SIZE_LABELS[selectedPet.size] ? `${SIZE_LABELS[selectedPet.size]} (${selectedPet.size})` : selectedPet.size}
                          </p>
                          {selectedPet.notes && (
                            <p className="text-sm text-gray-500 italic mt-1">"{selectedPet.notes}"</p>
                          )}
                        </div>
                        {sizeCompatible ? (
                          <CheckCircle size={20} className="text-[#88D8B0] flex-shrink-0" />
                        ) : (
                          <XCircle size={20} className="text-red-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Size incompatibility warning */}
                      {!sizeCompatible && walker.allowed_sizes?.length > 0 && (
                        <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                          <p>
                            <span className="font-semibold">{selectedPet.name}</span> es de tamaño{' '}
                            <strong>{SIZE_LABELS[selectedPet.size] || selectedPet.size}</strong>, pero este paseador
                            solo acepta:{' '}
                            {walker.allowed_sizes.map((s) => SIZE_LABELS[s] || s).join(', ')}.
                            Elegí otra mascota o buscá un paseador diferente.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas adicionales para el paseador
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Ej: Llegar 5 minutos antes, tocar timbre..."
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none"
                data-testid="walk-notes-input"
              />
            </div>

            <div className="bg-[#F9FAFB] rounded-2xl p-6">
              <h3 className="text-lg font-bold text-[#1F2937] mb-4">Resumen</h3>
              <div className="space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Paseador:</span>
                  <span className="font-semibold text-right">{walker.display_name}</span>
                </div>
                {summaryDateLabel && formData.time && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Cuándo:</span>
                    <span className="font-semibold text-right capitalize">
                      {summaryDateLabel} · {formData.time} hs
                    </span>
                  </div>
                )}
                {addressOk && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Encuentro:</span>
                    <span className="font-semibold text-right text-sm max-w-[60%]">
                      {summaryAddressShort}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Duración:</span>
                  <span className="font-semibold">{formData.duration} minutos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio por hora:</span>
                  <span className="font-semibold">${walker.price_per_hour}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-800 font-bold">Costo estimado:</span>
                  <span className="text-[#88D8B0] font-bold text-xl">${estimatedCost.toFixed(0)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => navigate(`/walkers/${walkerId}`)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-100 transition-colors"
                data-testid="cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="submit-walk-request-button"
              >
                {loading ? 'Enviando...' : 'Solicitar paseo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { User, MapPin, DollarSign, Calendar, Clock, Briefcase, ExternalLink, Dog } from 'lucide-react';
import { toast } from 'sonner';

const SIZE_OPTIONS = [
  { value: 'S', label: 'Pequeño', desc: 'hasta 10 kg', emoji: '🐩' },
  { value: 'M', label: 'Mediano', desc: '10–25 kg',   emoji: '🐕' },
  { value: 'L', label: 'Grande',  desc: 'más de 25 kg', emoji: '🦮' },
];

export default function CreateWalkerProfile() {
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    experience_years: '1',
    service_area_text: '',
    price_per_hour: '',
    availability_days: [],
    available_start_time: '08:00',
    available_end_time: '18:00',
    max_dogs: 3,
    allowed_sizes: ['S', 'M', 'L'],
  });
  const [userProfile, setUserProfile] = useState(null);

  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const TIME_SLOTS = [];
  for (let h = 8; h <= 20; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }

  const parseLegacyHours = (str) => {
    if (!str) return null;
    const match = str.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const pad = (h, m) => `${String(parseInt(h)).padStart(2, '0')}:${m}`;
    return { start: pad(match[1], match[2]), end: pad(match[3], match[4]) };
  };

  useEffect(() => {
    if (!user || user.role !== 'WALKER') {
      toast.error('Solo los paseadores pueden crear perfil');
      navigate('/');
      return;
    }
    fetchUserProfile();
    if (window.location.pathname.includes('edit')) {
      setIsEdit(true);
      fetchProfile();
    } else {
      setFormData((prev) => ({ ...prev, display_name: user.name || '' }));
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/me/profile');
      setUserProfile(response.data);
    } catch (error) {
      console.error('Error al cargar perfil de usuario:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await api.get('/walkers/me/profile');
      const profile = response.data;
      const legacy = parseLegacyHours(profile.availability_hours);
      setFormData({
        display_name: profile.display_name,
        bio: profile.bio,
        experience_years: profile.experience_years.toString(),
        service_area_text: profile.service_area_text,
        price_per_hour: profile.price_per_hour.toString(),
        availability_days: profile.availability_days || [],
        available_start_time: profile.available_start_time || legacy?.start || '08:00',
        available_end_time: profile.available_end_time || legacy?.end || '18:00',
        max_dogs: profile.max_dogs ?? 3,
        allowed_sizes: profile.allowed_sizes?.length ? profile.allowed_sizes : ['S', 'M', 'L'],
      });
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Perfil no encontrado');
        navigate('/walker/profile/create');
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDayToggle = (day) => {
    setFormData((prev) => ({
      ...prev,
      availability_days: prev.availability_days.includes(day)
        ? prev.availability_days.filter((d) => d !== day)
        : [...prev.availability_days, day],
    }));
  };

  const handleSizeToggle = (size) => {
    setFormData((prev) => ({
      ...prev,
      allowed_sizes: prev.allowed_sizes.includes(size)
        ? prev.allowed_sizes.filter((s) => s !== size)
        : [...prev.allowed_sizes, size],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.display_name || !formData.bio || !formData.service_area_text || !formData.price_per_hour) {
      toast.error('Por favor completá todos los campos obligatorios');
      return;
    }
    if (parseFloat(formData.price_per_hour) <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }
    if (formData.available_start_time >= formData.available_end_time) {
      toast.error('La hora de inicio debe ser anterior a la hora de fin');
      return;
    }
    if (formData.allowed_sizes.length === 0) {
      toast.error('Seleccioná al menos un tamaño de perro que puedas pasear');
      return;
    }
    const maxDogs = parseInt(formData.max_dogs, 10);
    if (isNaN(maxDogs) || maxDogs < 1 || maxDogs > 20) {
      toast.error('La capacidad máxima debe estar entre 1 y 20 perros');
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        display_name: formData.display_name,
        bio: formData.bio,
        experience_years: parseInt(formData.experience_years),
        service_area_text: formData.service_area_text,
        price_per_hour: parseFloat(formData.price_per_hour),
        availability_days: formData.availability_days,
        available_start_time: formData.available_start_time,
        available_end_time: formData.available_end_time,
        max_dogs: maxDogs,
        allowed_sizes: formData.allowed_sizes,
      };

      if (isEdit) {
        await api.put('/walkers/me/profile', profileData);
        toast.success('¡Perfil actualizado correctamente!');
      } else {
        await api.post('/walkers/me/profile', profileData);
        toast.success('¡Perfil creado correctamente!');
      }
      navigate('/walker/requests');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h1
            className="text-3xl font-bold text-[#1F2937] mb-2"
            style={{ fontFamily: 'Outfit' }}
            data-testid="create-profile-title"
          >
            {isEdit ? 'Editar Perfil' : 'Crear Perfil de Paseador'}
          </h1>
          <p className="text-gray-600 mb-8">Completá tu información para empezar a recibir solicitudes</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User size={16} className="inline mr-2" />
                Nombre para mostrar *
              </label>
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                placeholder="Ej: María González"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                required
                data-testid="display-name-input"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Biografía *</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Contanos sobre tu experiencia con mascotas..."
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none"
                required
                data-testid="bio-input"
              />
            </div>

            {/* Experiencia + Precio */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Briefcase size={16} className="inline mr-2" />
                  Años de experiencia *
                </label>
                <select
                  name="experience_years"
                  value={formData.experience_years}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="experience-select"
                >
                  {[1,2,3,4,5,6,7,8,9,10].map((y) => (
                    <option key={y} value={y}>{y} {y === 1 ? 'año' : 'años'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign size={16} className="inline mr-2" />
                  Precio por hora *
                </label>
                <input
                  type="number"
                  name="price_per_hour"
                  value={formData.price_per_hour}
                  onChange={handleChange}
                  placeholder="Ej: 800"
                  min="0"
                  step="50"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="price-input"
                />
              </div>
            </div>

            {/* Capacidad de perros */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Dog size={16} className="inline mr-2" />
                Capacidad máxima de perros por paseo *
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  name="max_dogs"
                  min="1"
                  max="10"
                  value={formData.max_dogs}
                  onChange={handleChange}
                  className="flex-1 accent-[#88D8B0]"
                />
                <span className="w-16 text-center font-bold text-2xl text-[#88D8B0]">
                  {formData.max_dogs}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Cuántos perros podés pasear al mismo tiempo. El sistema bloqueará reservas cuando alcances este límite.
              </p>
            </div>

            {/* Tamaños aceptados */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Tamaños de perros que aceptás *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {SIZE_OPTIONS.map(({ value, label, desc, emoji }) => {
                  const active = formData.allowed_sizes.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSizeToggle(value)}
                      className={`flex flex-col items-center gap-1 px-3 py-4 rounded-2xl border-2 transition-all ${
                        active
                          ? 'border-[#88D8B0] bg-[#f0fdf6] text-[#2d7a55]'
                          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="font-semibold text-sm">{label}</span>
                      <span className="text-xs opacity-70">{desc}</span>
                    </button>
                  );
                })}
              </div>
              {formData.allowed_sizes.length === 0 && (
                <p className="text-xs text-red-500 mt-2">Seleccioná al menos un tamaño</p>
              )}
            </div>

            {/* Ubicación base */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-[#88D8B0]" />
                Ubicación base
              </p>
              {userProfile?.address_text || userProfile?.city ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-800 font-medium">
                      {[userProfile.address_text, userProfile.city].filter(Boolean).join(', ')}
                    </p>
                    {userProfile?.latitude != null ? (
                      <span className="inline-block mt-1 text-xs bg-[#88D8B0] bg-opacity-20 text-[#3aaa7a] px-2 py-0.5 rounded-full">
                        ✓ Ubicación en el mapa confirmada
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Sin coordenadas — verificá en Mi Cuenta
                      </span>
                    )}
                  </div>
                  <Link
                    to="/app/account"
                    className="flex items-center gap-1 text-sm text-[#3aaa7a] hover:underline whitespace-nowrap"
                  >
                    Editar <ExternalLink size={13} />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-amber-600">
                    Sin dirección — completá tu ubicación para aparecer en el mapa.
                  </p>
                  <Link
                    to="/app/account"
                    className="flex items-center gap-1 text-sm font-semibold text-[#3aaa7a] hover:underline whitespace-nowrap"
                  >
                    Ir a Mi Cuenta <ExternalLink size={13} />
                  </Link>
                </div>
              )}
            </div>

            {/* Zonas de servicio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Zonas de servicio *</label>
              <input
                type="text"
                name="service_area_text"
                value={formData.service_area_text}
                onChange={handleChange}
                placeholder="Ej: Palermo, Recoleta, Belgrano"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                required
                data-testid="service-area-input"
              />
              <p className="text-xs text-gray-500 mt-1">Separadas por comas</p>
            </div>

            {/* Días disponibles */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <Calendar size={16} className="inline mr-2" />
                Días disponibles
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-4 py-2 rounded-full font-medium transition-all text-sm ${
                      formData.availability_days.includes(day)
                        ? 'bg-[#88D8B0] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid={`day-${day}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Horarios */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <Clock size={16} className="inline mr-2" />
                Horario disponible
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Desde</p>
                  <select
                    value={formData.available_start_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, available_start_time: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                    data-testid="available-start-time-select"
                  >
                    {TIME_SLOTS.filter((t) => t < formData.available_end_time).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Hasta</p>
                  <select
                    value={formData.available_end_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, available_end_time: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                    data-testid="available-end-time-select"
                  >
                    {TIME_SLOTS.filter((t) => t > formData.available_start_time).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/walker/requests')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-100 transition-colors"
                data-testid="cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="submit-profile-button"
              >
                {loading ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

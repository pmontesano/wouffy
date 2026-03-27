import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { User, Phone, MapPin, Mail, Camera, Navigation, Search, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix íconos de Leaflet con webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente interno para reubicar el mapa cuando cambian las coordenadas
function MapFlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.2 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState(null); // 'found' | 'not_found' | null

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address_text: '',
    city: '',
    avatar_url: '',
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/me/profile');
      const d = response.data;
      setFormData({
        full_name: d.full_name || '',
        phone: d.phone || '',
        address_text: d.address_text || '',
        city: d.city || '',
        avatar_url: d.avatar_url || '',
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
      });
      if (d.latitude && d.longitude) setGeoStatus('found');
    } catch (error) {
      toast.error('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Si cambia la dirección, invalidar geocodificación actual
    if (name === 'address_text' || name === 'city') {
      setGeoStatus(null);
      setFormData(prev => ({ ...prev, [name]: value, latitude: null, longitude: null }));
    }
  };

  // Geocodifica usando el endpoint propio del backend (que llama a Nominatim)
  const handleGeocode = useCallback(async () => {
    const address = formData.address_text;
    const city = formData.city;

    if (!address && !city) {
      toast.error('Ingresá una dirección o ciudad primero');
      return;
    }

    setGeocoding(true);
    setGeoStatus(null);
    try {
      const params = new URLSearchParams();
      if (address) params.append('q', address);
      else params.append('q', city);
      if (city && address) params.append('city', city);

      const res = await api.get(`/geocode?${params.toString()}`);
      const data = res.data;

      if (data.found) {
        setFormData(prev => ({
          ...prev,
          latitude: data.latitude,
          longitude: data.longitude,
        }));
        setGeoStatus('found');
        toast.success('Dirección encontrada en el mapa');
      } else {
        setGeoStatus('not_found');
        toast.error('No se pudo encontrar la dirección. Probá con más detalles.');
      }
    } catch (err) {
      setGeoStatus('not_found');
      toast.error('Error al buscar la dirección');
    } finally {
      setGeocoding(false);
    }
  }, [formData.address_text, formData.city]);

  // Detectar ubicación actual por GPS del navegador
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = parseFloat(coords.latitude.toFixed(6));
        const lng = parseFloat(coords.longitude.toFixed(6));
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        setGeoStatus('found');
        toast.success('Ubicación GPS detectada correctamente');
        setGeoLoading(false);
      },
      () => {
        toast.error('No se pudo obtener tu ubicación');
        setGeoLoading(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put('/me/profile', formData);
      toast.success('¡Perfil actualizado correctamente!');
      fetchProfile();
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === 'string'
          ? detail
          : error.response?.status === 401
            ? 'Sesión expirada. Iniciá sesión de nuevo.'
            : 'Error al actualizar el perfil'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  const hasCoords = formData.latitude != null && formData.longitude != null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1
              className="text-4xl font-bold text-[#1F2937] mb-2"
              style={{ fontFamily: 'Outfit' }}
              data-testid="account-title"
            >
              Mi Cuenta
            </h1>
            <p className="text-gray-600">Administrá tu información personal</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
            {/* Avatar + info básica */}
            <div className="flex items-center space-x-6 mb-8 pb-8 border-b">
              <div className="relative">
                {formData.avatar_url || user?.picture ? (
                  <img
                    src={formData.avatar_url || user?.picture}
                    alt={user?.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#88D8B0]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#88D8B0] flex items-center justify-center text-white text-3xl font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <button className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg border-2 border-[#88D8B0] hover:bg-[#88D8B0] hover:text-white transition-colors">
                  <Camera size={16} />
                </button>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#1F2937]" style={{ fontFamily: 'Outfit' }}>
                  {user?.name}
                </h2>
                <p className="text-gray-600 flex items-center space-x-2 mt-1">
                  <Mail size={16} />
                  <span>{user?.email}</span>
                </p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                  user?.role === 'OWNER' ? 'bg-[#88D8B0] text-white' : 'bg-[#FFCC99] text-[#5A3A20]'
                }`}>
                  {user?.role === 'OWNER' ? 'Dueño' : 'Paseador'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <User size={16} className="inline mr-2" />
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Tu nombre completo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="full-name-input"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Phone size={16} className="inline mr-2" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 11 1234-5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="phone-input"
                />
              </div>

              {/* Dirección con geocodificación */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin size={16} className="inline mr-2" />
                  Dirección
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="address_text"
                    value={formData.address_text}
                    onChange={handleChange}
                    placeholder="Av. Santa Fe 1234"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                    data-testid="address-input"
                  />
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={geocoding || (!formData.address_text && !formData.city)}
                    className="flex items-center gap-2 px-4 py-3 bg-[#88D8B0] text-white rounded-xl hover:bg-[#6bc99a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-semibold"
                    title="Buscar dirección en el mapa"
                  >
                    <Search size={16} />
                    {geocoding ? 'Buscando...' : 'Verificar'}
                  </button>
                </div>

                {/* Estado de geocodificación */}
                {geoStatus === 'found' && hasCoords && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                    <CheckCircle size={15} />
                    <span>Ubicación confirmada · {formData.latitude?.toFixed(4)}, {formData.longitude?.toFixed(4)}</span>
                  </div>
                )}
                {geoStatus === 'not_found' && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
                    <XCircle size={15} />
                    <span>No se encontró la dirección. Probá agregar la ciudad o más detalles.</span>
                  </div>
                )}
                {geoStatus === null && !hasCoords && (formData.address_text || formData.city) && (
                  <p className="text-xs text-gray-400 mt-2">
                    Hacé clic en "Verificar" para ubicar tu dirección en el mapa, o usá el GPS.
                  </p>
                )}

                {/* Botones de acciones de ubicación */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={geoLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[#88D8B0] text-[#3aaa7a] rounded-full hover:bg-[#f0fdf6] transition-colors disabled:opacity-50"
                  >
                    <Navigation size={14} />
                    {geoLoading ? 'Detectando GPS...' : 'Usar mi GPS'}
                  </button>
                  {hasCoords && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
                        setGeoStatus(null);
                      }}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Limpiar ubicación
                    </button>
                  )}
                </div>
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ciudad
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Buenos Aires"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="city-input"
                />
              </div>

              {/* Mini-mapa de preview */}
              {hasCoords && (
                <div className="rounded-2xl overflow-hidden border border-gray-200" style={{ height: '220px' }}>
                  <MapContainer
                    center={[formData.latitude, formData.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <Marker position={[formData.latitude, formData.longitude]} />
                    <MapFlyTo lat={formData.latitude} lng={formData.longitude} />
                  </MapContainer>
                </div>
              )}

              {/* Aviso para walkers */}
              {user?.role === 'WALKER' && (
                <div className="rounded-2xl border border-[#88D8B0] border-opacity-50 bg-[#f0fdf6] p-4 text-sm text-[#2d7a55]">
                  <p className="font-semibold mb-1">Sos paseador</p>
                  <p>Tu dirección es tu <strong>ubicación base</strong> visible en el mapa de Wouffy. Verificá que el pin del mapa esté en el lugar correcto antes de guardar.</p>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="save-profile-button"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>

          {user?.role === 'OWNER' && (
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#1F2937] mb-1" style={{ fontFamily: 'Outfit' }}>
                    Mis Mascotas
                  </h3>
                  <p className="text-gray-600 text-sm">Administrá la información de tus mascotas</p>
                </div>
                <button
                  onClick={() => navigate('/app/pets')}
                  className="btn-secondary"
                  data-testid="manage-pets-button"
                >
                  Ver Mascotas
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

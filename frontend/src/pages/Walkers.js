import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Star, DollarSign, Search, Filter, Navigation, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícono especial para la ubicación del usuario
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Mueve el mapa al centro dado
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13, { duration: 1.0 });
    }
  }, [center, map]);
  return null;
}

const SIZE_LABELS = { S: 'Pequeño', M: 'Mediano', L: 'Grande' };

export default function Walkers() {
  const [walkers, setWalkers] = useState([]);
  const [filteredWalkers, setFilteredWalkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationSearch, setLocationSearch] = useState('');
  const [minRating, setMinRating] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [petSize, setPetSize] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]); // Buenos Aires default
  const [walkersWithCoords, setWalkersWithCoords] = useState(0);

  useEffect(() => {
    fetchWalkers();
  }, []);

  const fetchWalkers = async () => {
    try {
      const response = await api.get('/walkers');
      const data = response.data;
      setWalkers(data);
      setFilteredWalkers(data);
      // Contar walkers con coordenadas para mostrar indicador
      setWalkersWithCoords(data.filter(w => w.latitude && w.longitude).length);
      // Si hay walkers con coordenadas, centrar el mapa en el primero
      const firstWithCoords = data.find(w => w.latitude && w.longitude);
      if (firstWithCoords) {
        setMapCenter([firstWithCoords.latitude, firstWithCoords.longitude]);
      }
    } catch (error) {
      toast.error('Error al cargar paseadores');
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setMapCenter([latitude, longitude]);
        toast.success('Ubicación detectada correctamente');
      },
      () => toast.error('No se pudo obtener tu ubicación')
    );
  };

  const handleFilter = () => {
    let filtered = [...walkers];

    if (locationSearch) {
      const q = locationSearch.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          (w.service_area_text || '').toLowerCase().includes(q) ||
          (w.base_location_text || '').toLowerCase().includes(q)
      );
    }
    if (minRating) {
      filtered = filtered.filter((w) => w.rating_avg >= parseFloat(minRating));
    }
    if (maxPrice) {
      filtered = filtered.filter((w) => w.price_per_hour <= parseFloat(maxPrice));
    }
    if (petSize) {
      filtered = filtered.filter((w) => {
        const sizes = w.allowed_sizes || [];
        return sizes.length === 0 || sizes.includes(petSize);
      });
    }

    // Availability filter: check day of week + time range
    if (filterDate) {
      const dt = new Date(`${filterDate}T12:00:00`);
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayNames[dt.getDay()];
      filtered = filtered.filter((w) => {
        if (!w.availability_days?.length) return true; // no restriction
        return w.availability_days.includes(dayName);
      });
    }
    if (filterTime) {
      filtered = filtered.filter((w) => {
        const start = w.available_start_time || '08:00';
        const end   = w.available_end_time   || '20:00';
        return filterTime >= start && filterTime <= end;
      });
    }

    setFilteredWalkers(filtered);

    // Centrar mapa en el primer resultado con coordenadas
    const firstWithCoords = filtered.find(w => w.latitude && w.longitude);
    if (firstWithCoords) {
      setMapCenter([firstWithCoords.latitude, firstWithCoords.longitude]);
    }
  };

  const handleReset = () => {
    setLocationSearch('');
    setMinRating('');
    setMaxPrice('');
    setPetSize('');
    setFilterDate('');
    setFilterTime('');
    setFilteredWalkers(walkers);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  const visibleOnMap = filteredWalkers.filter(w => w.latitude && w.longitude).length;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1
            className="text-4xl font-bold text-[#1F2937] mb-2"
            style={{ fontFamily: 'Outfit' }}
            data-testid="walkers-page-title"
          >
            Paseadores Disponibles
          </h1>
          <p className="text-gray-600">Encontrá el paseador ideal para tu mascota</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Panel de búsqueda + mapa */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-lg">

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Búsqueda por ubicación */}
              <div className="relative sm:col-span-2 lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por zona..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                  className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none text-sm"
                  data-testid="location-search-input"
                />
              </div>

              {/* Calificación */}
              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] outline-none text-sm"
                data-testid="min-rating-filter"
              >
                <option value="">★ Todas</option>
                <option value="4.5">★ 4.5+</option>
                <option value="4.7">★ 4.7+</option>
                <option value="4.9">★ 4.9+</option>
              </select>

              {/* Precio */}
              <input
                type="number"
                placeholder="$ Máximo"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] outline-none text-sm"
                data-testid="max-price-filter"
              />

              {/* Tamaño de mascota */}
              <select
                value={petSize}
                onChange={(e) => setPetSize(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] outline-none text-sm"
              >
                <option value="">🐾 Cualquier tamaño</option>
                <option value="S">Pequeño (&lt;10kg)</option>
                <option value="M">Mediano (10-25kg)</option>
                <option value="L">Grande (&gt;25kg)</option>
              </select>

              {/* Fecha de disponibilidad */}
              <div className="relative">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] outline-none text-sm text-gray-600"
                  title="Filtrar por día disponible"
                  min={new Date().toISOString().split('T')[0]}
                />
                {!filterDate && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                    📅 Fecha
                  </span>
                )}
              </div>

              {/* Hora de disponibilidad */}
              <input
                type="time"
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] outline-none text-sm text-gray-600"
                title="Filtrar por horario disponible"
                placeholder="🕐 Hora"
              />

              {/* Botones filtrar / reset */}
              <button
                onClick={handleFilter}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#88D8B0] text-white rounded-xl hover:bg-[#6bc99a] transition-colors font-semibold text-sm"
                data-testid="apply-filters-button"
              >
                <Filter size={16} />
                Filtrar
              </button>

              <button
                onClick={handleReset}
                className="px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors text-sm text-gray-600"
                data-testid="reset-filters-button"
              >
                Limpiar
              </button>

              <button
                onClick={handleGetLocation}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-[#88D8B0] text-[#3aaa7a] rounded-xl hover:bg-[#f0fdf6] transition-colors text-sm"
                data-testid="get-location-button"
              >
                <Navigation size={16} />
                Mi ubicación
              </button>
            </div>

            {/* Aviso si hay walkers sin ubicación */}
            {walkersWithCoords < walkers.length && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <AlertCircle size={14} />
                <span>
                  {visibleOnMap} de {filteredWalkers.length} paseadores tienen ubicación en el mapa.
                  Los paseadores sin ubicación configurada no aparecen como marcadores.
                </span>
              </div>
            )}

            {/* Mapa */}
            <div className="h-72 rounded-2xl overflow-hidden mb-4 border border-gray-100">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapController center={mapCenter} />

                {filteredWalkers.map((walker) =>
                  walker.latitude && walker.longitude ? (
                    <Marker
                      key={walker.walker_id}
                      position={[walker.latitude, walker.longitude]}
                    >
                      <Popup>
                        <div className="text-center min-w-[140px]">
                          {walker.photo_url && (
                            <img
                              src={walker.photo_url}
                              alt={walker.display_name}
                              className="w-12 h-12 rounded-full object-cover mx-auto mb-2"
                            />
                          )}
                          <p className="font-bold text-sm">{walker.display_name}</p>
                          <p className="text-xs text-gray-500">{walker.service_area_text}</p>
                          <p className="text-sm font-semibold text-[#88D8B0] mt-1">
                            ${walker.price_per_hour}/hora
                          </p>
                          <Link
                            to={`/walkers/${walker.walker_id}`}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            Ver perfil →
                          </Link>
                        </div>
                      </Popup>
                    </Marker>
                  ) : null
                )}

                {userLocation && (
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                    <Popup>
                      <p className="font-semibold text-sm">📍 Tu ubicación</p>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            <div className="text-sm text-gray-500">
              {filteredWalkers.length === walkers.length
                ? `${walkers.length} paseadores disponibles`
                : `${filteredWalkers.length} de ${walkers.length} paseadores`
              }
              {visibleOnMap > 0 && ` · ${visibleOnMap} en el mapa`}
            </div>
          </div>

          {/* Panel lateral */}
          <div className="bg-white rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Outfit' }}>
              ¿Cómo elegir?
            </h3>
            <ul className="space-y-4 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="text-[#88D8B0] text-lg leading-none">📍</span>
                <span>Usá "Mi ubicación" para centrar el mapa en tu zona y ver los paseadores más cercanos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#88D8B0] text-lg leading-none">🐾</span>
                <span>Filtrá por tamaño de mascota para ver solo paseadores que acepten a tu perro</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#88D8B0] text-lg leading-none">⭐</span>
                <span>Revisá las calificaciones y reseñas de otros dueños</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#88D8B0] text-lg leading-none">🕐</span>
                <span>Verificá la disponibilidad horaria antes de solicitar</span>
              </li>
            </ul>

            {petSize && (
              <div className="mt-6 p-3 bg-[#f0fdf6] rounded-xl border border-[#88D8B0] border-opacity-50 text-sm text-[#2d7a55]">
                <p className="font-semibold">Filtrando por tamaño</p>
                <p>Mostrando paseadores que aceptan perros <strong>{SIZE_LABELS[petSize]?.toLowerCase()}</strong></p>
              </div>
            )}

            {(filterDate || filterTime) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200 text-sm text-blue-800">
                <p className="font-semibold">Filtrando por disponibilidad</p>
                {filterDate && (
                  <p>
                    Día:{' '}
                    <strong>
                      {new Date(`${filterDate}T12:00:00`).toLocaleDateString('es-AR', {
                        weekday: 'long', day: 'numeric', month: 'short',
                      })}
                    </strong>
                  </p>
                )}
                {filterTime && (
                  <p>Horario: <strong>{filterTime} hs</strong></p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cards de paseadores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWalkers.map((walker, index) => (
            <motion.div
              key={walker.walker_id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link to={`/walkers/${walker.walker_id}`} data-testid={`walker-card-${walker.walker_id}`}>
                <div className="bg-white rounded-3xl p-6 shadow-lg card-hover cursor-pointer h-full">
                  <div className="flex items-start space-x-4 mb-4">
                    <img
                      src={walker.photo_url || 'https://via.placeholder.com/80'}
                      alt={walker.display_name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#88D8B0] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-[#1F2937] mb-1 truncate" style={{ fontFamily: 'Outfit' }}>
                        {walker.display_name}
                      </h3>
                      <div className="flex items-center space-x-1 mb-1">
                        <Star size={15} className="text-[#FFCC99]" fill="#FFCC99" />
                        <span className="font-semibold text-sm">{walker.rating_avg?.toFixed(1)}</span>
                        <span className="text-xs text-gray-400">({walker.rating_count})</span>
                      </div>
                      {/* Tamaños aceptados */}
                      {walker.allowed_sizes?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {walker.allowed_sizes.map(size => (
                            <span
                              key={size}
                              className="text-xs px-2 py-0.5 bg-[#f0fdf6] text-[#2d7a55] rounded-full border border-[#88D8B0] border-opacity-50"
                            >
                              {SIZE_LABELS[size] || size}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{walker.bio}</p>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-[#88D8B0] flex-shrink-0" />
                      <span className="truncate">{walker.base_location_text || walker.service_area_text || 'Sin ubicación'}</span>
                      {walker.latitude && walker.longitude && (
                        <span className="text-[#88D8B0] text-xs flex-shrink-0">📍</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1 text-sm">
                        <DollarSign size={14} className="text-[#FFCC99]" />
                        <span className="font-semibold text-[#1F2937]">${walker.price_per_hour}/hora</span>
                      </div>
                      <span className="text-xs text-gray-400">{walker.experience_years} años exp.</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {filteredWalkers.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-2">No se encontraron paseadores con esos filtros</p>
            <p className="text-gray-400 text-sm mb-6">Probá ajustar la búsqueda o el tamaño de mascota</p>
            <button onClick={handleReset} className="btn-primary">
              Ver todos los paseadores
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

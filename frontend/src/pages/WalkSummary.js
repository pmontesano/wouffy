/**
 * WalkSummary — Resumen post-paseo
 * Muestra ruta completa, distancia total, duración real y estadísticas.
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { api } from '../utils/api';
import { ArrowLeft, MapPin, Clock, Activity, Star } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

// ── Leaflet icon fix ─────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ── Haversine ────────────────────────────────────────────────────────────────
function haversineTotal(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lng1] = points[i - 1];
    const [lat2, lng2] = points[i];
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

// ── Velocidad promedio en km/h ───────────────────────────────────────────────
function avgSpeed(distanceM, durationMin) {
  if (!durationMin || durationMin <= 0) return 0;
  return ((distanceM / 1000) / (durationMin / 60)).toFixed(1);
}

// ── Formatear duración (ISO string o Date) ───────────────────────────────────
function minutesBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const diff = new Date(endStr) - new Date(startStr);
  return Math.round(diff / 60000);
}

function formatDuration(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WalkSummary() {
  const { walkId } = useParams();
  const { user }   = useAuth();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/walks/${walkId}/route`);
        setRoute(res.data);
      } catch {
        toast.error('Error al cargar el resumen del paseo');
      } finally {
        setLoading(false);
      }
    })();
  }, [walkId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        No se encontraron datos del paseo.
      </div>
    );
  }

  const points    = route.points.map((p) => [p.latitude, p.longitude]);
  const distanceM = haversineTotal(points);
  const distanceKm = (distanceM / 1000).toFixed(2);
  const durationMin = minutesBetween(route.actual_start_at, route.actual_end_at);
  const speed       = avgSpeed(distanceM, durationMin);

  const mapCenter = points.length > 0
    ? points[Math.floor(points.length / 2)]
    : [-34.5813, -58.4314];

  const backTo = user?.role === 'WALKER' ? '/walker/requests' : '/me/walks';

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Volver
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="text-3xl font-bold text-[#1F2937] mb-1"
            style={{ fontFamily: 'Outfit' }}
          >
            🐾 Resumen del paseo
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Paseo completado · {points.length} puntos GPS registrados
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<MapPin size={22} className="text-[#88D8B0]" />}
              value={`${distanceKm} km`}
              label="Distancia"
            />
            <StatCard
              icon={<Clock size={22} className="text-[#FFCC99]" />}
              value={formatDuration(durationMin)}
              label="Duración"
            />
            <StatCard
              icon={<Activity size={22} className="text-[#88D8B0]" />}
              value={`${speed} km/h`}
              label="Vel. promedio"
            />
            <StatCard
              icon={<Star size={22} className="text-[#FFCC99]" />}
              value={points.length > 0 ? '✓' : '—'}
              label="Ruta registrada"
            />
          </div>

          {/* Map */}
          {points.length > 0 ? (
            <div className="rounded-3xl overflow-hidden shadow-lg mb-6" style={{ height: 380 }}>
              <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Polyline
                  positions={points}
                  color="#88D8B0"
                  weight={5}
                  opacity={0.9}
                />
                <Marker position={points[0]} icon={startIcon}>
                  <Popup>🟢 Inicio del paseo</Popup>
                </Marker>
                <Marker position={points[points.length - 1]} icon={endIcon}>
                  <Popup>🔴 Fin del paseo</Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center text-gray-400 shadow mb-6">
              <MapPin size={40} className="mx-auto mb-3 opacity-30" />
              <p>No se registraron puntos GPS en este paseo.</p>
              <p className="text-sm mt-1">El tracking de ubicación no estaba activo.</p>
            </div>
          )}

          {/* Detalles de tiempos */}
          {(route.actual_start_at || route.actual_end_at) && (
            <div className="bg-white rounded-2xl p-5 shadow text-sm text-gray-600 space-y-2">
              {route.actual_start_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Inicio</span>
                  <span className="font-semibold">
                    {new Date(route.actual_start_at).toLocaleString('es-AR', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {route.actual_end_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fin</span>
                  <span className="font-semibold">
                    {new Date(route.actual_end_at).toLocaleString('es-AR', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3 mt-6">
            <Link
              to={backTo}
              className="flex-1 text-center py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-colors"
            >
              Volver a mis paseos
            </Link>
            {user?.role === 'OWNER' && (
              <Link
                to="/walkers"
                className="flex-1 text-center py-3 btn-primary"
              >
                Reservar otro paseo
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Tarjeta de estadística ───────────────────────────────────────────────────
function StatCard({ icon, value, label }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xl font-bold text-[#1F2937]">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

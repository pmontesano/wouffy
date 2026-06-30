/**
 * WalkLiveMap — Mapa en tiempo real del paseo
 *
 * El GPS corre en WalkTrackingContext (nivel global), por eso persiste
 * aunque el walker navegue a otra pantalla y vuelva.
 *
 * Rol WALKER: inicia/detiene GPS o modo demo. Ve su ruta.
 * Rol OWNER:  recibe los puntos del servidor cada POLL_INTERVAL ms.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useWalkTracking, haversineTotal, DEMO_ROUTE } from '../context/WalkTrackingContext';
import { ArrowLeft, Navigation, Play, Square, Wifi, WifiOff, MapPin } from 'lucide-react';
import { toast } from 'sonner';

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const walkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const POLL_INTERVAL = 5_000;

// ── Sigue al walker en el mapa ────────────────────────────────────────────────
function MapFollow({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, map.getZoom(), { duration: 0.8 });
  }, [position, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WalkLiveMap() {
  const { walkId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  // Estado del GPS global (persiste entre navegaciones)
  const {
    walkId: trackingWalkId,
    points: ctxPoints,
    isTracking,
    isDemoRunning,
    elapsed,
    gpsOnline,
    isActive,
    startTracking,
    stopTracking,
    startDemo,
    stopDemo,
  } = useWalkTracking();

  // Para el owner, los puntos vienen del servidor (polling)
  const [serverPoints, setServerPoints] = useState([]);
  const [walkStatus, setWalkStatus]     = useState(null);
  const [loadingWalk, setLoadingWalk]   = useState(true);
  const pollRef = useRef(null);

  const isWalker = user?.role === 'WALKER';
  const isOwner  = user?.role === 'OWNER';
  const [completing, setCompleting] = useState(false);

  // ¿El tracking activo es para ESTE paseo? (puede haber otro walk_id en contexto)
  const isTrackingThisWalk = trackingWalkId === walkId;

  // Los puntos a mostrar en el mapa
  const points = isWalker ? (isTrackingThisWalk ? ctxPoints : []) : serverPoints;

  // ── Cargar estado del walk ────────────────────────────────────────────────
  const fetchRoute = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/walks/${walkId}/route`);
      setWalkStatus(res.data.status);
      if (isOwner) {
        setServerPoints(res.data.points.map((p) => [p.latitude, p.longitude]));
      }
    } catch {
      if (!silent) toast.error('Error al cargar la ruta');
    } finally {
      setLoadingWalk(false);
    }
  }, [walkId, isOwner]);

  useEffect(() => {
    fetchRoute();
    if (isOwner) {
      pollRef.current = setInterval(() => fetchRoute(true), POLL_INTERVAL);
    }
    return () => clearInterval(pollRef.current);
  }, [fetchRoute, isOwner]);

  // ── Handlers del walker ───────────────────────────────────────────────────
  const handleStartTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Tu dispositivo no soporta GPS');
      return;
    }
    const ok = startTracking(walkId);
    if (ok) toast.success('GPS activado — tu ruta se está registrando');
  };

  const handleStopTracking = () => {
    stopTracking();
    toast('GPS detenido');
  };

  const handleStartDemo = () => {
    startDemo(walkId);
    toast.success('Demo iniciado — ruta por Palermo 🐕');
  };

  const handleStopDemo = () => {
    stopDemo();
    toast('Demo detenido');
  };

  const handleComplete = async () => {
    if (!window.confirm('¿Finalizar el paseo?')) return;
    setCompleting(true);
    try {
      await api.patch(`/walks/${walkId}/complete`);
      toast.success('Paseo finalizado ✅');
      navigate(`/walks/${walkId}/summary`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'No se pudo finalizar el paseo');
      setCompleting(false);
    }
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const currentPos  = points.length > 0 ? points[points.length - 1] : null;
  const distanceM   = haversineTotal(points);
  const distanceKm  = (distanceM / 1000).toFixed(2);
  const elapsedMin  = Math.floor(elapsed / 60);
  const elapsedSec  = elapsed % 60;
  const mapCenter   = currentPos ?? DEMO_ROUTE[0];

  const isWalkActive = walkStatus
    ? ['WALKER_ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(walkStatus)
    : true;

  const isInProgress = walkStatus === 'IN_PROGRESS';

  if (loadingWalk) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to={isWalker ? '/walker/requests' : '/me/walks'}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-[#88D8B0] transition-colors"
          >
            <ArrowLeft size={20} />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            {isWalker && isActive && isTrackingThisWalk && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#88D8B0]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#88D8B0] animate-pulse" />
                {isDemoRunning ? 'Demo activo' : 'GPS activo'}
              </span>
            )}
            {isOwner && (
              <>
                {gpsOnline
                  ? <Wifi size={16} className="text-[#88D8B0]" />
                  : <WifiOff size={16} className="text-red-400" />}
                <span className={`text-xs font-medium ${gpsOnline ? 'text-[#88D8B0]' : 'text-red-400'}`}>
                  {gpsOnline ? 'En línea' : 'Sin conexión'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-[#1F2937] mb-1" style={{ fontFamily: 'Outfit' }}>
          {isWalker ? '🐕 Paseo en curso' : '📍 Seguimiento en vivo'}
        </h1>
        {walkStatus && (
          <p className="text-sm text-gray-500 mb-4">
            Estado:{' '}
            <span className="font-semibold">
              {walkStatus === 'IN_PROGRESS'      ? 'Paseo en progreso' :
               walkStatus === 'WALKER_ON_THE_WAY' ? 'Paseador en camino' :
               walkStatus === 'ARRIVED'           ? 'Paseador llegó' :
               walkStatus.replace(/_/g, ' ')}
            </span>
          </p>
        )}

        {/* CTA prominente para walker en IN_PROGRESS sin GPS activo */}
        {isWalker && isInProgress && !isActive && (
          <div className="mb-4 p-4 bg-[#f0fdf6] border-2 border-[#88D8B0] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[#1F2937]">¡El paseo está en progreso!</p>
              <p className="text-sm text-gray-600">Activá el GPS para registrar la ruta.</p>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button
                onClick={handleStartTracking}
                className="flex items-center gap-2 px-4 py-2 bg-[#88D8B0] text-white rounded-full font-semibold text-sm hover:bg-[#6FCF9F] transition-colors"
              >
                <Navigation size={16} /> Iniciar GPS
              </button>
              <button
                onClick={handleStartDemo}
                className="flex items-center gap-2 px-4 py-2 bg-[#FFCC99] text-[#8a6520] rounded-full font-semibold text-sm hover:bg-[#f5ba7a] transition-colors"
              >
                <Play size={16} /> Demo
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white rounded-full font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                ✅ Finalizar
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-2xl font-bold text-[#1F2937]">{distanceKm}</p>
            <p className="text-xs text-gray-500 mt-1">km recorridos</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-2xl font-bold text-[#1F2937]">
              {String(elapsedMin).padStart(2, '0')}:{String(elapsedSec).padStart(2, '0')}
            </p>
            <p className="text-xs text-gray-500 mt-1">tiempo activo</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-2xl font-bold text-[#1F2937]">{points.length}</p>
            <p className="text-xs text-gray-500 mt-1">puntos GPS</p>
          </div>
        </div>

        {/* Mapa */}
        <div className="rounded-3xl overflow-hidden shadow-lg mb-4" style={{ height: 380 }}>
          <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {currentPos && <MapFollow position={currentPos} />}

            {points.length > 1 && (
              <Polyline positions={points} color="#88D8B0" weight={4} opacity={0.9} />
            )}
            {points.length > 0 && (
              <Marker position={points[0]} icon={startIcon}>
                <Popup>📍 Inicio</Popup>
              </Marker>
            )}
            {currentPos && (
              <Marker position={currentPos} icon={walkerIcon}>
                <Popup>{isWalker ? '🐕 Tu posición' : '🐕 Paseador'}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Controles del walker */}
        {isWalker && (
          <div className="flex flex-wrap gap-3">
            {/* GPS real */}
            {!isActive && isWalkActive && (
              <button
                onClick={handleStartTracking}
                className="flex items-center gap-2 px-5 py-3 bg-[#88D8B0] text-white rounded-full font-semibold hover:bg-[#6FCF9F] transition-colors"
              >
                <Navigation size={18} /> Iniciar GPS
              </button>
            )}
            {isTracking && isTrackingThisWalk && (
              <button
                onClick={handleStopTracking}
                className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors"
              >
                <Square size={18} /> Detener GPS
              </button>
            )}

            {/* Demo */}
            {!isActive && (
              <button
                onClick={handleStartDemo}
                className="flex items-center gap-2 px-5 py-3 bg-[#FFCC99] text-[#8a6520] rounded-full font-semibold hover:bg-[#f5ba7a] transition-colors"
              >
                <Play size={18} /> Modo demo (Palermo)
              </button>
            )}
            {isDemoRunning && isTrackingThisWalk && (
              <button
                onClick={handleStopDemo}
                className="flex items-center gap-2 px-5 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition-colors"
              >
                <Square size={18} /> Detener demo
              </button>
            )}

            {/* Finalizar paseo desde el mapa */}
            {isInProgress && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-3 bg-[#1F2937] text-white rounded-full font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                {completing ? '…' : '✅ Finalizar paseo'}
              </button>
            )}

            {/* Ver resumen si ya completado */}
            {walkStatus === 'COMPLETED' && (
              <Link
                to={`/walks/${walkId}/summary`}
                className="flex items-center gap-2 px-5 py-3 bg-[#1F2937] text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
              >
                Ver resumen →
              </Link>
            )}
          </div>
        )}

        {/* Controles del owner */}
        {isOwner && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchRoute()}
              className="flex items-center gap-2 px-5 py-3 border border-[#88D8B0] text-[#2d7a55] rounded-full font-semibold hover:bg-[#f0fdf6] transition-colors"
            >
              <Navigation size={18} /> Actualizar
            </button>
            {walkStatus === 'COMPLETED' && (
              <Link
                to={`/walks/${walkId}/summary`}
                className="flex items-center gap-2 px-5 py-3 bg-[#1F2937] text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
              >
                Ver resumen →
              </Link>
            )}
          </div>
        )}

        {/* Hints */}
        {isOwner && points.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-6">
            El mapa se actualiza cada {POLL_INTERVAL / 1000}s automáticamente.<br />
            La ruta aparecerá cuando el paseador active su GPS.
          </p>
        )}
        {isWalker && !isActive && !isInProgress && isWalkActive && (
          <p className="text-center text-gray-400 text-sm mt-6">
            El GPS se registra principalmente durante el paseo activo.<br />
            Podés activarlo ahora para ir trazando el camino desde que salís.
          </p>
        )}
        {isWalker && isActive && isTrackingThisWalk && (
          <p className="text-center text-[#88D8B0] text-sm mt-6 font-medium">
            <MapPin size={14} className="inline mr-1" />
            Podés navegar a otras pantallas — el GPS seguirá activo.
          </p>
        )}
      </div>
    </div>
  );
}

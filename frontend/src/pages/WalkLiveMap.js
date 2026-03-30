/**
 * WalkLiveMap — Mapa en tiempo real del paseo
 *
 * Rol WALKER: envía su posición GPS cada SEND_INTERVAL ms y ve su ruta en el mapa.
 * Rol OWNER:  recibe los puntos cada POLL_INTERVAL ms y ve el avance del walker.
 * Modo DEMO:  reproduce automáticamente una ruta pregrabada en Palermo, BA.
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
import { ArrowLeft, Navigation, Play, Square, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

// ── Leaflet icon fix ─────────────────────────────────────────────────────────
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

// ── Ruta demo: Palermo, Buenos Aires (≈ 1.2 km) ─────────────────────────────
const DEMO_ROUTE = [
  [-34.5813, -58.4314], // Plaza Serrano
  [-34.5820, -58.4308],
  [-34.5828, -58.4302],
  [-34.5835, -58.4290],
  [-34.5841, -58.4278],
  [-34.5847, -58.4265],
  [-34.5853, -58.4252],
  [-34.5858, -58.4238],
  [-34.5862, -58.4224],
  [-34.5865, -58.4210],
  [-34.5868, -58.4196],
  [-34.5870, -58.4182],
  [-34.5871, -58.4168],
  [-34.5870, -58.4154],
  [-34.5868, -58.4140],
  [-34.5865, -58.4128],
  [-34.5861, -58.4116],
  [-34.5856, -58.4105],
  [-34.5850, -58.4095],
  [-34.5843, -58.4086],
  [-34.5836, -58.4078],
  [-34.5829, -58.4071],
  [-34.5821, -58.4065],
  [-34.5813, -58.4060], // Jardín Japonés
  [-34.5806, -58.4055],
  [-34.5799, -58.4051],
  [-34.5793, -58.4048],
  [-34.5788, -58.4046],
  [-34.5783, -58.4044],
  [-34.5779, -58.4043], // Lago de Palermo
];

const SEND_INTERVAL = 6_000;  // walker envía cada 6s
const POLL_INTERVAL = 5_000;  // owner recibe cada 5s
const DEMO_STEP_MS  = 1_200;  // demo avanza un punto cada 1.2s

// ── Componente que sigue al walker en el mapa ─────────────────────────────────
function MapFollow({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, map.getZoom(), { duration: 0.8 });
  }, [position, map]);
  return null;
}

// ── Haversine distance (metros) ───────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────────────
export default function WalkLiveMap() {
  const { walkId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [walk, setWalk]       = useState(null);
  const [points, setPoints]   = useState([]); // [lat, lng][]
  const [tracking, setTracking] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [online, setOnline]   = useState(true);
  const [elapsed, setElapsed] = useState(0);  // segundos desde que arrancó el tracking

  const geoWatchRef   = useRef(null);
  const sendIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const demoIndexRef  = useRef(0);
  const elapsedRef    = useRef(null);
  const latestPos     = useRef(null); // última posición GPS real

  const isWalker = user?.role === 'WALKER';
  const isOwner  = user?.role === 'OWNER';

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  const startElapsed = () => {
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stopTracking = useCallback(() => {
    setTracking(false);
    clearInterval(elapsedRef.current);
    if (geoWatchRef.current != null) navigator.geolocation.clearWatch(geoWatchRef.current);
    clearInterval(sendIntervalRef.current);
  }, []);

  const stopDemo = useCallback(() => {
    setDemoRunning(false);
    clearInterval(elapsedRef.current);
    clearInterval(demoIntervalRef.current);
  }, []);

  // ── Cargar walk + ruta al montar ──────────────────────────────────────────
  const fetchRoute = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/walks/${walkId}/route`);
      setWalk(res.data);
      const pts = res.data.points.map((p) => [p.latitude, p.longitude]);
      setPoints(pts);
      setOnline(true);
    } catch (err) {
      setOnline(false);
      if (!silent) toast.error('Error al cargar la ruta');
    }
  }, [walkId]);

  useEffect(() => {
    fetchRoute();
    // Owner: polling automático
    if (isOwner) {
      pollIntervalRef.current = setInterval(() => fetchRoute(true), POLL_INTERVAL);
    }
    return () => {
      clearInterval(pollIntervalRef.current);
      stopTracking();
      stopDemo();
    };
  }, [fetchRoute, isOwner, stopDemo, stopTracking]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Walker: enviar posición real ──────────────────────────────────────────
  const sendPosition = useCallback(async (lat, lng) => {
    try {
      await api.post(`/walks/${walkId}/location`, { latitude: lat, longitude: lng });
      setPoints((prev) => {
        // Evita duplicar el mismo punto exacto
        const last = prev[prev.length - 1];
        if (last && last[0] === lat && last[1] === lng) return prev;
        return [...prev, [lat, lng]];
      });
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [walkId]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Tu dispositivo no soporta GPS');
      return;
    }
    setTracking(true);
    startElapsed();

    // Vigilar posición continuamente
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => { latestPos.current = [pos.coords.latitude, pos.coords.longitude]; },
      () => setOnline(false),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // Enviar al servidor cada SEND_INTERVAL
    sendIntervalRef.current = setInterval(() => {
      if (latestPos.current) {
        sendPosition(latestPos.current[0], latestPos.current[1]);
      }
    }, SEND_INTERVAL);
  };

  // ── Demo mode ─────────────────────────────────────────────────────────────
  const startDemo = () => {
    demoIndexRef.current = 0;
    setPoints([]);
    setDemoRunning(true);
    setElapsed(0);
    startElapsed();

    demoIntervalRef.current = setInterval(async () => {
      const idx = demoIndexRef.current;
      if (idx >= DEMO_ROUTE.length) {
        stopDemo();
        toast.success('Demo finalizado');
        return;
      }
      const [lat, lng] = DEMO_ROUTE[idx];
      demoIndexRef.current = idx + 1;
      setPoints((prev) => [...prev, [lat, lng]]);

      // También envía al servidor si el walk es real
      try { await api.post(`/walks/${walkId}/location`, { latitude: lat, longitude: lng }); }
      catch { /* en demo no bloqueamos */ }
    }, DEMO_STEP_MS);
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const currentPos = points.length > 0 ? points[points.length - 1] : null;
  const distanceM  = haversineTotal(points);
  const distanceKm = (distanceM / 1000).toFixed(2);
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  const mapCenter = currentPos ?? DEMO_ROUTE[0];
  const isActive  = walk
    ? ['WALKER_ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(walk.status)
    : true;

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
            <span>Volver</span>
          </Link>
          <div className="flex items-center gap-2">
            {online
              ? <Wifi size={16} className="text-[#88D8B0]" />
              : <WifiOff size={16} className="text-red-400" />}
            <span className={`text-xs font-medium ${online ? 'text-[#88D8B0]' : 'text-red-400'}`}>
              {online ? 'En línea' : 'Sin conexión'}
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#1F2937] mb-1" style={{ fontFamily: 'Outfit' }}>
          {isWalker ? '🐕 Paseo en curso' : '📍 Seguimiento en vivo'}
        </h1>
        {walk?.status && (
          <p className="text-sm text-gray-500 mb-4">
            Estado: <span className="font-semibold capitalize">{walk.status.replace(/_/g, ' ')}</span>
          </p>
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

        {/* Map */}
        <div className="rounded-3xl overflow-hidden shadow-lg mb-4" style={{ height: 400 }}>
          <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {currentPos && <MapFollow position={currentPos} />}

            {/* Ruta trazada */}
            {points.length > 1 && (
              <Polyline
                positions={points}
                color="#88D8B0"
                weight={4}
                opacity={0.85}
              />
            )}

            {/* Marcador de inicio */}
            {points.length > 0 && (
              <Marker position={points[0]} icon={startIcon}>
                <Popup>Inicio del paseo</Popup>
              </Marker>
            )}

            {/* Marcador de posición actual (walker) */}
            {currentPos && (
              <Marker position={currentPos} icon={walkerIcon}>
                <Popup>
                  {isWalker ? '📍 Tu posición actual' : '🐕 Posición del paseador'}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap gap-3">
          {/* Walker: tracking real */}
          {isWalker && isActive && (
            <>
              {!tracking && !demoRunning && (
                <button
                  onClick={startTracking}
                  className="flex items-center gap-2 px-5 py-3 bg-[#88D8B0] text-white rounded-full font-semibold hover:bg-[#6FCF9F] transition-colors"
                >
                  <Navigation size={18} />
                  Iniciar GPS
                </button>
              )}
              {tracking && (
                <button
                  onClick={stopTracking}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors"
                >
                  <Square size={18} />
                  Detener GPS
                </button>
              )}
            </>
          )}

          {/* Demo: disponible siempre para el walker */}
          {isWalker && (
            <>
              {!demoRunning && !tracking && (
                <button
                  onClick={startDemo}
                  className="flex items-center gap-2 px-5 py-3 bg-[#FFCC99] text-[#8a6520] rounded-full font-semibold hover:bg-[#f5ba7a] transition-colors"
                >
                  <Play size={18} />
                  Modo demo (Palermo)
                </button>
              )}
              {demoRunning && (
                <button
                  onClick={stopDemo}
                  className="flex items-center gap-2 px-5 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition-colors"
                >
                  <Square size={18} />
                  Detener demo
                </button>
              )}
            </>
          )}

          {/* Owner: refrescar manualmente */}
          {isOwner && (
            <button
              onClick={() => fetchRoute()}
              className="flex items-center gap-2 px-5 py-3 border border-[#88D8B0] text-[#2d7a55] rounded-full font-semibold hover:bg-[#f0fdf6] transition-colors"
            >
              <Navigation size={18} />
              Actualizar
            </button>
          )}

          {/* Ver resumen si el walk está completado */}
          {walk?.status === 'COMPLETED' && (
            <Link
              to={`/walks/${walkId}/summary`}
              className="flex items-center gap-2 px-5 py-3 bg-[#1F2937] text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
            >
              Ver resumen completo →
            </Link>
          )}
        </div>

        {/* Hint */}
        {isOwner && points.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-6">
            El mapa se actualiza automáticamente cada {POLL_INTERVAL / 1000} segundos.<br />
            Aparecerá la ruta cuando el paseador comience a enviar su ubicación.
          </p>
        )}
        {isWalker && !tracking && !demoRunning && (
          <p className="text-center text-gray-400 text-sm mt-6">
            Presioná "Iniciar GPS" para enviar tu ubicación en tiempo real,<br />
            o "Modo demo" para simular una ruta por Palermo.
          </p>
        )}
      </div>
    </div>
  );
}

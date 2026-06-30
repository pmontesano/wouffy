/**
 * WalkTrackingContext
 *
 * Mantiene el estado del GPS a nivel global (fuera de cualquier página),
 * para que el tracking continúe aunque el walker navegue a otra pantalla.
 *
 * Qué hace:
 *  - Guarda los puntos GPS en memoria (array de [lat, lng])
 *  - Corre geolocation.watchPosition y el intervalo de envío al servidor
 *  - Expone startTracking / stopTracking / startDemo / stopDemo
 *  - Calcula distancia y cronómetro
 */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { api } from '../utils/api';

const WalkTrackingContext = createContext(null);

const SEND_INTERVAL = 6_000;   // envía al servidor cada 6s
const DEMO_STEP_MS  = 1_200;   // demo avanza un punto cada 1.2s

// Ruta demo: Palermo, Buenos Aires (~1.2 km)
export const DEMO_ROUTE = [
  [-34.5813, -58.4314],
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
  [-34.5813, -58.4060],
  [-34.5806, -58.4055],
  [-34.5799, -58.4051],
  [-34.5793, -58.4048],
  [-34.5788, -58.4046],
  [-34.5783, -58.4044],
  [-34.5779, -58.4043],
];

// ── Haversine ─────────────────────────────────────────────────────────────────
export function haversineTotal(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lng1] = points[i - 1];
    const [lat2, lng2] = points[i];
    const R = 6_371_000;
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

// ─────────────────────────────────────────────────────────────────────────────
export function WalkTrackingProvider({ children }) {
  const [walkId, setWalkId]           = useState(null);
  const [points, setPoints]           = useState([]);
  const [isTracking, setIsTracking]   = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [elapsed, setElapsed]         = useState(0);   // segundos
  const [gpsOnline, setGpsOnline]     = useState(true);

  // refs: no necesitan re-render
  const geoWatchRef     = useRef(null);
  const sendIntervalRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const elapsedRef      = useRef(null);
  const demoIndexRef    = useRef(0);
  const latestPosRef    = useRef(null); // última posición GPS real

  // ── Cronómetro ─────────────────────────────────────────────────────────────
  const startElapsed = useCallback(() => {
    clearInterval(elapsedRef.current);
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stopElapsed = useCallback(() => {
    clearInterval(elapsedRef.current);
  }, []);

  // ── Agregar punto (sin duplicar el mismo exacto) ───────────────────────────
  const addPoint = useCallback((lat, lng) => {
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && last[0] === lat && last[1] === lng) return prev;
      return [...prev, [lat, lng]];
    });
  }, []);

  // ── Enviar punto al servidor ───────────────────────────────────────────────
  const sendToServer = useCallback(async (wId, lat, lng) => {
    try {
      await api.post(`/walks/${wId}/location`, { latitude: lat, longitude: lng });
      setGpsOnline(true);
    } catch {
      setGpsOnline(false);
    }
  }, []);

  // ── Tracking real con GPS del dispositivo ─────────────────────────────────
  const startTracking = useCallback((wId) => {
    if (!navigator.geolocation) return false;

    setWalkId(wId);
    setIsTracking(true);
    setElapsed(0);
    startElapsed();

    // Observar posición continuamente
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPosRef.current = [pos.coords.latitude, pos.coords.longitude];
      },
      () => setGpsOnline(false),
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );

    // Enviar al servidor cada SEND_INTERVAL y agregar al array local
    sendIntervalRef.current = setInterval(() => {
      const pos = latestPosRef.current;
      if (pos) {
        addPoint(pos[0], pos[1]);
        sendToServer(wId, pos[0], pos[1]);
      }
    }, SEND_INTERVAL);

    return true;
  }, [startElapsed, addPoint, sendToServer]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    stopElapsed();
    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
    clearInterval(sendIntervalRef.current);
  }, [stopElapsed]);

  // ── Demo mode ─────────────────────────────────────────────────────────────
  const startDemo = useCallback((wId) => {
    setWalkId(wId);
    setPoints([]);
    setIsDemoRunning(true);
    setElapsed(0);
    demoIndexRef.current = 0;
    startElapsed();

    demoIntervalRef.current = setInterval(async () => {
      const idx = demoIndexRef.current;
      if (idx >= DEMO_ROUTE.length) {
        setIsDemoRunning(false);
        stopElapsed();
        clearInterval(demoIntervalRef.current);
        return;
      }
      const [lat, lng] = DEMO_ROUTE[idx];
      demoIndexRef.current = idx + 1;
      addPoint(lat, lng);
      // Intenta enviar al servidor; silencia errores en demo
      try { await api.post(`/walks/${wId}/location`, { latitude: lat, longitude: lng }); }
      catch { /* silencioso */ }
    }, DEMO_STEP_MS);
  }, [startElapsed, stopElapsed, addPoint]);

  const stopDemo = useCallback(() => {
    setIsDemoRunning(false);
    stopElapsed();
    clearInterval(demoIntervalRef.current);
  }, [stopElapsed]);

  // ── Limpiar al desmontar ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopTracking();
      stopDemo();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset completo (al terminar el paseo) ─────────────────────────────────
  const resetTracking = useCallback(() => {
    stopTracking();
    stopDemo();
    setWalkId(null);
    setPoints([]);
    setElapsed(0);
    latestPosRef.current = null;
  }, [stopTracking, stopDemo]);

  const value = {
    // estado
    walkId,
    points,
    isTracking,
    isDemoRunning,
    elapsed,
    gpsOnline,
    isActive: isTracking || isDemoRunning,
    // acciones
    startTracking,
    stopTracking,
    startDemo,
    stopDemo,
    resetTracking,
    // utilidades
    addPoint,
  };

  return (
    <WalkTrackingContext.Provider value={value}>
      {children}
    </WalkTrackingContext.Provider>
  );
}

export function useWalkTracking() {
  const ctx = useContext(WalkTrackingContext);
  if (!ctx) throw new Error('useWalkTracking debe usarse dentro de WalkTrackingProvider');
  return ctx;
}

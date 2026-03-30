import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  Edit,
  RefreshCw,
  Map,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  formatDateTime,
  getWalkStatusLabel,
  getWalkStatusClass,
} from "../utils/api";

// ─── Orden de prioridad de estados ──────────────────────────────────────────
// Los estados que requieren acción van primero; terminados van al fondo.
const STATUS_PRIORITY = {
  REQUESTED: 0,
  ACCEPTED: 1,
  WALKER_ON_THE_WAY: 2,
  ARRIVED: 3,
  IN_PROGRESS: 4,
  COMPLETED: 5,
  CANCELLED: 6,
  REJECTED: 7,
};

function sortWalks(list) {
  return [...list].sort((a, b) => {
    const wa = a.walk ?? a;
    const wb = b.walk ?? b;
    const pa = STATUS_PRIORITY[wa.status] ?? 99;
    const pb = STATUS_PRIORITY[wb.status] ?? 99;
    if (pa !== pb) return pa - pb;
    const dateA = new Date(wa.scheduled_start_at);
    const dateB = new Date(wb.scheduled_start_at);
    // Activos (0–4): el más próximo primero ↑  |  Historial (5+): el más reciente primero ↓
    return pa >= 5 ? dateB - dateA : dateA - dateB;
  });
}

const POLL_INTERVAL = 10_000; // 10 s

export default function WalkerRequests() {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const pollRef = useRef(null);

  // ── fetch silencioso (sin spinner de página completa) ────────────────────
  const fetchWalks = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await api.get("/walks/incoming");
      setWalks(sortWalks(response.data));
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      if (!silent) toast.error("Error al cargar solicitudes");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const checkProfile = useCallback(async () => {
    try {
      await api.get("/walkers/me/profile");
      setHasProfile(true);
      await fetchWalks();
    } catch (error) {
      if (error.response?.status === 404) {
        setHasProfile(false);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWalks]);

  // ── arranque + polling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== "WALKER") {
      toast.error("Solo los paseadores pueden ver solicitudes");
      navigate("/");
      return;
    }
    checkProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasProfile) return;
    pollRef.current = setInterval(() => fetchWalks(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [hasProfile, fetchWalks]);

  // ── acciones del walker ──────────────────────────────────────────────────
  const patchWalk = async (walkId, segment, okMessage) => {
    try {
      await api.patch(`/walks/${walkId}/${segment}`);
      toast.success(okMessage);
      // Actualiza inmediatamente sin esperar el próximo poll
      fetchWalks();
    } catch (error) {
      console.error(`Error ${segment}:`, error);
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : "No se pudo actualizar el paseo"
      );
    }
  };

  const handleAccept = (walkId) => patchWalk(walkId, "accept", "¡Solicitud aceptada!");
  const handleReject = async (walkId) => {
    if (!window.confirm("¿Estás seguro de rechazar esta solicitud?")) return;
    patchWalk(walkId, "reject", "Solicitud rechazada");
  };

  // ── loading inicial ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]" />
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-[#FFCC99] bg-opacity-30 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={40} className="text-[#FFCC99]" />
          </div>
          <h2
            className="text-2xl font-bold text-[#1F2937] mb-4"
            style={{ fontFamily: "Outfit" }}
          >
            Completá tu perfil
          </h2>
          <p className="text-gray-600 mb-6">
            Para empezar a recibir solicitudes, primero debés crear tu perfil de
            paseador.
          </p>
          <button
            onClick={() => navigate("/walker/profile/create")}
            className="btn-secondary"
            data-testid="create-profile-button"
          >
            Crear Perfil
          </button>
        </div>
      </div>
    );
  }

  // ── separa activas vs historial ──────────────────────────────────────────
  const activeStatuses = new Set(["REQUESTED", "ACCEPTED", "WALKER_ON_THE_WAY", "ARRIVED", "IN_PROGRESS"]);
  const activeWalks   = walks.filter((item) => activeStatuses.has((item.walk ?? item).status));
  const historyWalks  = walks.filter((item) => !activeStatuses.has((item.walk ?? item).status));

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-4xl font-bold text-[#1F2937] mb-2"
              style={{ fontFamily: "Outfit" }}
              data-testid="walker-requests-title"
            >
              Solicitudes Recibidas
            </h1>
            <p className="text-gray-600">Administrá las solicitudes de paseo</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchWalks()}
              disabled={refreshing}
              className="p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin text-[#88D8B0]" : "text-gray-500"} />
            </button>
            <Link
              to="/walker/profile/edit"
              className="btn-primary inline-flex items-center space-x-2"
              data-testid="edit-profile-link"
            >
              <Edit size={18} />
              <span>Editar Perfil</span>
            </Link>
          </div>
        </div>

        {walks.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <Calendar size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              No tenés solicitudes aún
            </h3>
            <p className="text-gray-600">
              Cuando los dueños soliciten paseos, aparecerán aquí
            </p>
          </div>
        ) : (
          <>
            {/* ── Activas ── */}
            {activeWalks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
                  En curso · pendientes
                </h2>
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {activeWalks.map((item, index) => (
                      <WalkCard
                        key={(item.walk ?? item).walk_id}
                        item={item}
                        index={index}
                        onPatch={patchWalk}
                        onAccept={handleAccept}
                        onReject={handleReject}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ── Historial ── */}
            {historyWalks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
                  Historial
                </h2>
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {historyWalks.map((item, index) => (
                      <WalkCard
                        key={(item.walk ?? item).walk_id}
                        item={item}
                        index={index}
                        onPatch={patchWalk}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        muted
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tarjeta de paseo ────────────────────────────────────────────────────────
function WalkCard({ item, index, onPatch, onAccept, onReject, muted = false }) {
  const walk    = item.walk ?? item;
  const pet     = item.pet;
  const petName = pet?.name ?? "Mascota";
  const duration = item.estimated_duration_minutes;
  const address  = item.start_address_text;

  return (
    <motion.div
      key={walk.walk_id}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={`bg-white rounded-3xl shadow-lg p-6 ${muted ? "opacity-70" : "card-hover"}`}
      data-testid={`walk-request-${walk.walk_id}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <span
              className={`status-badge ${getWalkStatusClass(walk.status, walk)}`}
              data-testid={`walk-status-${walk.walk_id}`}
            >
              {getWalkStatusLabel(walk.status, walk)}
            </span>
            <h3
              className="text-xl font-bold text-[#1F2937]"
              style={{ fontFamily: "Outfit" }}
            >
              Paseo para {petName}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Calendar size={15} className="text-[#88D8B0] flex-shrink-0" />
              <span>{formatDateTime(walk.scheduled_start_at)}</span>
            </div>
            {duration != null && (
              <div className="flex items-center space-x-2">
                <Clock size={15} className="text-[#FFCC99] flex-shrink-0" />
                <span>{duration} minutos</span>
              </div>
            )}
            {address && (
              <div className="flex items-center space-x-2 sm:col-span-2">
                <MapPin size={15} className="text-[#88D8B0] flex-shrink-0" />
                <span className="truncate">{address}</span>
              </div>
            )}
            {pet?.size && (
              <div className="flex items-center space-x-2">
                <User size={15} className="text-[#FFCC99] flex-shrink-0" />
                <span>Tamaño: {pet.size}</span>
              </div>
            )}
          </div>

          {walk.notes && (
            <div className="mt-3 text-sm text-gray-600 bg-[#F9FAFB] p-3 rounded-xl">
              <span className="font-semibold">Notas del dueño:</span>{" "}
              {walk.notes}
            </div>
          )}
          {pet?.notes && (
            <div className="mt-2 text-sm text-gray-600 bg-[#F9FAFB] p-3 rounded-xl">
              <span className="font-semibold">Sobre la mascota:</span>{" "}
              {pet.notes}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-row lg:flex-col gap-2 lg:min-w-[180px]">
          {walk.status === "REQUESTED" && (
            <>
              <button
                onClick={() => onAccept(walk.walk_id)}
                className="flex-1 lg:flex-none px-5 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
                data-testid={`accept-walk-${walk.walk_id}`}
              >
                <CheckCircle size={15} />
                Aceptar
              </button>
              <button
                onClick={() => onReject(walk.walk_id)}
                className="flex-1 lg:flex-none px-5 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-sm"
                data-testid={`reject-walk-${walk.walk_id}`}
              >
                <XCircle size={15} />
                Rechazar
              </button>
            </>
          )}
          {walk.status === "ACCEPTED" && (
            <button
              onClick={() => onPatch(walk.walk_id, "on-the-way", "Marcado: en camino")}
              className="flex-1 lg:flex-none px-5 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors font-semibold text-sm"
            >
              En camino 🚶
            </button>
          )}
          {walk.status === "WALKER_ON_THE_WAY" && (
            <button
              onClick={() => onPatch(walk.walk_id, "arrived", "Marcado: llegué")}
              className="flex-1 lg:flex-none px-5 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors font-semibold text-sm"
            >
              Llegué 📍
            </button>
          )}
          {walk.status === "ARRIVED" && (
            <button
              onClick={() => onPatch(walk.walk_id, "start", "Paseo iniciado")}
              className="flex-1 lg:flex-none px-5 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors font-semibold text-sm"
            >
              Iniciar paseo 🐕
            </button>
          )}
          {walk.status === "IN_PROGRESS" && (
            <button
              onClick={() => onPatch(walk.walk_id, "complete", "Paseo completado")}
              className="flex-1 lg:flex-none px-5 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors font-semibold text-sm"
            >
              Finalizar ✅
            </button>
          )}
          {/* Botón de mapa: en vivo durante el paseo, resumen al completar */}
          {["WALKER_ON_THE_WAY", "ARRIVED", "IN_PROGRESS"].includes(walk.status) && (
            <Link
              to={`/walks/${walk.walk_id}/live`}
              className="flex-1 lg:flex-none px-5 py-2 border border-[#88D8B0] text-[#2d7a55] rounded-full hover:bg-[#f0fdf6] transition-colors text-sm flex items-center justify-center gap-1"
            >
              <Map size={14} /> Mapa en vivo
            </Link>
          )}
          {walk.status === "COMPLETED" && (
            <Link
              to={`/walks/${walk.walk_id}/summary`}
              className="flex-1 lg:flex-none px-5 py-2 border border-gray-300 text-gray-600 rounded-full hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-1"
            >
              <Map size={14} /> Ver ruta
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

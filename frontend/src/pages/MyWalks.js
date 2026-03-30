import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Calendar, Clock, MapPin, User, XCircle, Star, RefreshCw, Map } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  formatDateTime,
  getWalkStatusLabel,
  getWalkStatusClass,
} from "../utils/api";

// ─── Prioridad de estados ────────────────────────────────────────────────────
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

// ─── Rating Modal ────────────────────────────────────────────────────────────
function RatingModal({ walkId, walkerName, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Seleccioná una puntuación antes de enviar");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/walks/${walkId}/rate`, {
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success("¡Gracias por tu calificación!");
      onSubmitted(walkId);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : "Error al enviar la calificación"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const starLabel = ["", "Muy malo", "Malo", "Regular", "Bueno", "¡Excelente!"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22 }}
        className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XCircle size={22} />
        </button>

        <h2
          className="text-2xl font-bold text-[#1F2937] mb-1"
          style={{ fontFamily: "Outfit" }}
        >
          Calificar paseo
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          ¿Cómo fue tu experiencia con{" "}
          <span className="font-semibold">{walkerName}</span>?
        </p>

        {/* Estrellas */}
        <div className="flex justify-center gap-3 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110 focus:outline-none"
              aria-label={`${star} estrellas`}
            >
              <Star
                size={40}
                className="transition-colors"
                fill={(hovered || rating) >= star ? "#FFCC99" : "none"}
                stroke={(hovered || rating) >= star ? "#FFCC99" : "#D1D5DB"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        <div className="text-center h-5 mb-6">
          {(hovered || rating) > 0 && (
            <span className="text-sm font-semibold text-[#FFCC99]">
              {starLabel[hovered || rating]}
            </span>
          )}
        </div>

        {/* Comentario */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Comentario (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Contanos cómo fue el paseo..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none text-sm"
          />
          <p className="text-xs text-gray-400 text-right mt-1">
            {comment.length}/500
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Enviando..." : "Enviar calificación"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── MyWalks ─────────────────────────────────────────────────────────────────
export default function MyWalks() {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingModal, setRatingModal] = useState(null);
  const [ratedWalks, setRatedWalks] = useState(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();
  const pollRef = useRef(null);

  const fetchWalks = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await api.get("/walks/me");
      setWalks(sortWalks(response.data));
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      if (!silent) toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "OWNER") {
      toast.error("Solo los dueños pueden ver sus solicitudes");
      navigate("/");
      return;
    }
    fetchWalks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling: refresca automáticamente para mostrar cambios del walker
  useEffect(() => {
    pollRef.current = setInterval(() => fetchWalks(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchWalks]);

  const handleCancel = async (walkId) => {
    if (!window.confirm("¿Estás seguro de cancelar esta solicitud?")) return;
    try {
      await api.patch(`/walks/${walkId}/cancel`);
      toast.success("Solicitud cancelada");
      fetchWalks();
    } catch (error) {
      console.error("Error al cancelar:", error);
      toast.error("Error al cancelar la solicitud");
    }
  };

  const handleRatingSubmitted = (walkId) => {
    setRatedWalks((prev) => new Set([...prev, walkId]));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]" />
      </div>
    );
  }

  const activeStatuses = new Set([
    "REQUESTED",
    "ACCEPTED",
    "WALKER_ON_THE_WAY",
    "ARRIVED",
    "IN_PROGRESS",
  ]);
  const activeWalks  = walks.filter((item) => activeStatuses.has((item.walk ?? item).status));
  const historyWalks = walks.filter((item) => !activeStatuses.has((item.walk ?? item).status));

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1
              className="text-4xl font-bold text-[#1F2937] mb-2"
              style={{ fontFamily: "Outfit" }}
              data-testid="my-walks-title"
            >
              Mis Solicitudes
            </h1>
            <p className="text-gray-600">Administrá tus solicitudes de paseo</p>
          </div>
          <button
            onClick={() => fetchWalks()}
            disabled={refreshing}
            className="self-start sm:self-center p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw
              size={18}
              className={refreshing ? "animate-spin text-[#88D8B0]" : "text-gray-500"}
            />
          </button>
        </div>

        {walks.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <Calendar size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              No tenés solicitudes aún
            </h3>
            <p className="text-gray-600 mb-6">
              Comenzá buscando paseadores y programá tu primer paseo
            </p>
            <button
              onClick={() => navigate("/walkers")}
              className="btn-primary"
              data-testid="search-walkers-button"
            >
              Buscar Paseadores
            </button>
          </div>
        ) : (
          <>
            {/* ── Activas / pendientes ── */}
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
                        ratedWalks={ratedWalks}
                        onCancel={handleCancel}
                        onRate={(walkId, walkerName) =>
                          setRatingModal({ walkId, walkerName })
                        }
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
                        ratedWalks={ratedWalks}
                        onCancel={handleCancel}
                        onRate={(walkId, walkerName) =>
                          setRatingModal({ walkId, walkerName })
                        }
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

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingModal && (
          <RatingModal
            walkId={ratingModal.walkId}
            walkerName={ratingModal.walkerName}
            onClose={() => setRatingModal(null)}
            onSubmitted={handleRatingSubmitted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tarjeta de paseo (owner) ────────────────────────────────────────────────
function WalkCard({ item, index, ratedWalks, onCancel, onRate, muted = false }) {
  const walk       = item.walk ?? item;
  const pet        = item.pet;
  const walkerName = item.walker_name ?? walk.walker_name ?? "el paseador";
  const petName    = pet?.name ?? "tu mascota";
  const duration   = item.estimated_duration_minutes;
  const address    = item.start_address_text;
  const isCompleted  = walk.status === "COMPLETED";
  const alreadyRated = ratedWalks.has(walk.walk_id) || walk.rated === true;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={`bg-white rounded-3xl shadow-lg p-6 ${muted ? "opacity-70" : "card-hover"}`}
      data-testid={`walk-card-${walk.walk_id}`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-semibold">Notas:</span> {walk.notes}
            </div>
          )}

          {/* Ya calificado */}
          {isCompleted && alreadyRated && (
            <div className="mt-3 flex items-center gap-1 text-sm text-[#FFCC99]">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={13} fill="#FFCC99" stroke="#FFCC99" />
              ))}
              <span className="text-gray-400 ml-2 text-xs">Calificación enviada</span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
          {(walk.status === "REQUESTED" || walk.status === "ACCEPTED") && (
            <button
              onClick={() => onCancel(walk.walk_id)}
              className="px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-sm"
              data-testid={`cancel-walk-${walk.walk_id}`}
            >
              <XCircle size={15} />
              Cancelar
            </button>
          )}

          {/* Mapa en vivo durante el paseo */}
          {["WALKER_ON_THE_WAY", "ARRIVED", "IN_PROGRESS"].includes(walk.status) && (
            <Link
              to={`/walks/${walk.walk_id}/live`}
              className="px-4 py-2 border border-[#88D8B0] text-[#2d7a55] rounded-full hover:bg-[#f0fdf6] transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <Map size={14} /> Ver en vivo
            </Link>
          )}

          {/* Ruta completa al finalizar */}
          {isCompleted && (
            <Link
              to={`/walks/${walk.walk_id}/summary`}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Map size={14} /> Ver ruta
            </Link>
          )}

          {isCompleted && !alreadyRated && (
            <button
              onClick={() => onRate(walk.walk_id, walkerName)}
              className="px-4 py-2 bg-[#FFCC99] bg-opacity-20 text-[#8a6520] border border-[#FFCC99] rounded-full hover:bg-opacity-40 transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
              data-testid={`rate-walk-${walk.walk_id}`}
            >
              <Star size={14} fill="#FFCC99" stroke="#d4943a" />
              Calificar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

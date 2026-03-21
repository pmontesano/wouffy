import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  formatDateTime,
  getWalkStatusLabel,
  getWalkStatusClass,
} from "../utils/api";

export default function WalkerRequests() {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "WALKER") {
      toast.error("Solo los paseadores pueden ver solicitudes");
      navigate("/");
      return;
    }
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      await api.get("/walkers/me/profile");
      setHasProfile(true);
      fetchWalks();
    } catch (error) {
      if (error.response?.status === 404) {
        setHasProfile(false);
        setLoading(false);
      }
    }
  };

  const fetchWalks = async () => {
    try {
      const response = await api.get("/walks/incoming");
      setWalks(response.data);
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (walkId) => {
    try {
      await api.patch(`/walks/${walkId}/accept`);
      toast.success("¡Solicitud aceptada!");
      fetchWalks();
    } catch (error) {
      console.error("Error al aceptar:", error);
      toast.error("Error al aceptar la solicitud");
    }
  };

  const handleReject = async (walkId) => {
    if (!window.confirm("¿Estás seguro de rechazar esta solicitud?")) {
      return;
    }

    try {
      await api.patch(`/walks/${walkId}/reject`);
      toast.success("Solicitud rechazada");
      fetchWalks();
    } catch (error) {
      console.error("Error al rechazar:", error);
      toast.error("Error al rechazar la solicitud");
    }
  };

  const patchWalk = async (walkId, segment, okMessage) => {
    try {
      await api.patch(`/walks/${walkId}/${segment}`);
      toast.success(okMessage);
      fetchWalks();
    } catch (error) {
      console.error(`Error ${segment}:`, error);
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : "No se pudo actualizar el paseo",
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
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

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
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
          <Link
            to="/walker/profile/edit"
            className="mt-4 sm:mt-0 btn-primary inline-flex items-center space-x-2"
            data-testid="edit-profile-link"
          >
            <Edit size={18} />
            <span>Editar Perfil</span>
          </Link>
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
          <div className="space-y-4">
            {walks.map((item, index) => {
              const walk = item.walk ?? item;
              const pet = item.pet;
              const petName = pet?.name ?? "Mascota";
              const duration = item.estimated_duration_minutes;
              const address = item.start_address_text;
              return (
                <motion.div
                  key={walk.walk_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-3xl shadow-lg p-6 card-hover mb-4"
                  data-testid={`walk-request-${walk.walk_id}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1 mb-4 lg:mb-0">
                      <div className="flex items-center space-x-3 mb-3">
                        <span
                          className={`status-badge ${getWalkStatusClass(walk.status)}`}
                          data-testid={`walk-status-${walk.walk_id}`}
                        >
                          {getWalkStatusLabel(walk.status)}
                        </span>
                        <h3
                          className="text-xl font-bold text-[#1F2937]"
                          style={{ fontFamily: "Outfit" }}
                        >
                          Paseo para {petName}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Calendar size={16} className="text-[#88D8B0]" />
                          <span>{formatDateTime(walk.scheduled_start_at)}</span>
                        </div>
                        {duration != null && (
                          <div className="flex items-center space-x-2">
                            <Clock size={16} className="text-[#FFCC99]" />
                            <span>{duration} minutos</span>
                          </div>
                        )}
                        {address && (
                          <div className="flex items-center space-x-2">
                            <MapPin size={16} className="text-[#88D8B0]" />
                            <span>{address}</span>
                          </div>
                        )}
                        {pet?.size && (
                          <div className="flex items-center space-x-2">
                            <User size={16} className="text-[#FFCC99]" />
                            <span>Tamaño: {pet.size}</span>
                          </div>
                        )}
                      </div>

                      {walk.notes && (
                        <div className="mt-3 text-sm text-gray-600 bg-[#F9FAFB] p-3 rounded-xl">
                          <span className="font-semibold">
                            Notas del dueño:
                          </span>{" "}
                          {walk.notes}
                        </div>
                      )}

                      {pet?.notes && (
                        <div className="mt-2 text-sm text-gray-600 bg-[#F9FAFB] p-3 rounded-xl">
                          <span className="font-semibold">
                            Sobre la mascota:
                          </span>{" "}
                          {pet.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 lg:ml-6 min-w-[200px]">
                      {walk.status === "REQUESTED" && (
                        <>
                          <button
                            onClick={() => handleAccept(walk.walk_id)}
                            className="px-6 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors flex items-center justify-center space-x-2"
                            data-testid={`accept-walk-${walk.walk_id}`}
                          >
                            <CheckCircle size={16} />
                            <span>Aceptar</span>
                          </button>
                          <button
                            onClick={() => handleReject(walk.walk_id)}
                            className="px-6 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center space-x-2"
                            data-testid={`reject-walk-${walk.walk_id}`}
                          >
                            <XCircle size={16} />
                            <span>Rechazar</span>
                          </button>
                        </>
                      )}
                      {walk.status === "ACCEPTED" && (
                        <button
                          onClick={() =>
                            patchWalk(
                              walk.walk_id,
                              "on-the-way",
                              "Marcado: en camino",
                            )
                          }
                          className="px-6 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors"
                        >
                          En camino
                        </button>
                      )}
                      {walk.status === "WALKER_ON_THE_WAY" && (
                        <button
                          onClick={() =>
                            patchWalk(
                              walk.walk_id,
                              "arrived",
                              "Marcado: llegué",
                            )
                          }
                          className="px-6 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors"
                        >
                          Llegué
                        </button>
                      )}
                      {walk.status === "ARRIVED" && (
                        <button
                          onClick={() =>
                            patchWalk(walk.walk_id, "start", "Paseo iniciado")
                          }
                          className="px-6 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors"
                        >
                          Iniciar paseo
                        </button>
                      )}
                      {walk.status === "IN_PROGRESS" && (
                        <button
                          onClick={() =>
                            patchWalk(
                              walk.walk_id,
                              "complete",
                              "Paseo completado",
                            )
                          }
                          className="px-6 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors"
                        >
                          Finalizar paseo
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

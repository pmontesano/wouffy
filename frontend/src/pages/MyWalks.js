import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, User, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  formatDateTime,
  getWalkStatusLabel,
  getWalkStatusClass,
} from "../utils/api";

export default function MyWalks() {
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "OWNER") {
      toast.error("Solo los dueños pueden ver sus solicitudes");
      navigate("/");
      return;
    }
    fetchWalks();
  }, []);

  const fetchWalks = async () => {
    try {
      const response = await api.get("/walks/me");
      setWalks(response.data);
    } catch (error) {
      console.error("Error al cargar solicitudes:", error);
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (walkId) => {
    if (!window.confirm("¿Estás seguro de cancelar esta solicitud?")) {
      return;
    }

    try {
      await api.patch(`/walks/${walkId}/cancel`);
      toast.success("Solicitud cancelada");
      fetchWalks();
    } catch (error) {
      console.error("Error al cancelar:", error);
      toast.error("Error al cancelar la solicitud");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1
            className="text-4xl font-bold text-[#1F2937] mb-2"
            style={{ fontFamily: "Outfit" }}
            data-testid="my-walks-title"
          >
            Mis Solicitudes
          </h1>
          <p className="text-gray-600">Administrá tus solicitudes de paseo</p>
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
          <div className="space-y-4">
            {walks.map((item, index) => {
              const walk = item.walk ?? item;
              const pet = item.pet;
              const petName = pet?.name ?? "tu mascota";
              const duration = item.estimated_duration_minutes;
              const address = item.start_address_text;
              return (
                <motion.div
                  key={walk.walk_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-3xl shadow-lg p-6 card-hover mb-4"
                  data-testid={`walk-card-${walk.walk_id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 mb-4 md:mb-0">
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
                        <div className="mt-3 text-sm text-gray-600">
                          <span className="font-semibold">Notas:</span>{" "}
                          {walk.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2">
                      {(walk.status === "REQUESTED" ||
                        walk.status === "ACCEPTED") && (
                        <button
                          onClick={() => handleCancel(walk.walk_id)}
                          className="px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center space-x-2"
                          data-testid={`cancel-walk-${walk.walk_id}`}
                        >
                          <XCircle size={16} />
                          <span>Cancelar</span>
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

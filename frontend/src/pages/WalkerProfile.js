import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { MapPin, Star, DollarSign, Calendar, Clock, Award, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

export default function WalkerProfile() {
  const { id } = useParams();
  const [walker, setWalker] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchWalker();
  }, [id]);

  const fetchWalker = async () => {
    try {
      const response = await api.get(`/walkers/${id}`);
      setWalker(response.data);
    } catch (error) {
      console.error('Error al cargar paseador:', error);
      toast.error('Error al cargar el perfil del paseador');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWalk = () => {
    if (!user) {
      toast.error('Debés iniciar sesión para solicitar un paseo');
      navigate('/login');
      return;
    }
    if (user.role !== 'OWNER') {
      toast.error('Solo los dueños pueden solicitar paseos');
      return;
    }
    navigate(`/walks/new?walkerId=${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  if (!walker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Paseador no encontrado</p>
          <Link to="/walkers" className="btn-primary">
            Volver a la búsqueda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/walkers"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors"
          data-testid="back-to-walkers-link"
        >
          <ArrowLeft size={20} />
          <span>Volver a paseadores</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
              <img
                src={walker.photo_url || 'https://via.placeholder.com/150'}
                alt={walker.display_name}
                className="w-32 h-32 rounded-full object-cover border-4 border-[#88D8B0]"
                data-testid="walker-profile-image"
              />
              <div className="flex-1">
                <h1
                  className="text-4xl font-bold text-[#1F2937] mb-3"
                  style={{ fontFamily: 'Outfit' }}
                  data-testid="walker-name"
                >
                  {walker.display_name}
                </h1>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-1">
                    <Star size={20} className="text-[#FFCC99]" fill="#FFCC99" />
                    <span className="font-bold text-lg">{walker.rating_avg}</span>
                    <span className="text-gray-500">({walker.rating_count} reseñas)</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[#88D8B0]">
                    <Award size={20} />
                    <span className="font-semibold">{walker.experience_years} años de experiencia</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-gray-600 mb-4">
                  <MapPin size={18} className="text-[#88D8B0]" />
                  <span>{walker.base_location_text}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign size={24} className="text-[#FFCC99]" />
                  <span className="text-2xl font-bold text-[#1F2937]">${walker.price_per_hour}</span>
                  <span className="text-gray-600">/hora</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-3xl shadow-lg p-8">
                <h2
                  className="text-2xl font-bold text-[#1F2937] mb-4"
                  style={{ fontFamily: 'Outfit' }}
                >
                  Acerca de mí
                </h2>
                <p className="text-gray-700 leading-relaxed" data-testid="walker-bio">
                  {walker.bio}
                </p>
              </div>

              <div className="bg-white rounded-3xl shadow-lg p-8">
                <h2
                  className="text-2xl font-bold text-[#1F2937] mb-4"
                  style={{ fontFamily: 'Outfit' }}
                >
                  Zonas de servicio
                </h2>
                <div className="flex items-start space-x-2">
                  <MapPin size={20} className="text-[#88D8B0] mt-1" />
                  <p className="text-gray-700">{walker.service_area_text}</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-lg p-8">
                <h2
                  className="text-2xl font-bold text-[#1F2937] mb-4"
                  style={{ fontFamily: 'Outfit' }}
                >
                  Disponibilidad
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-2">
                    <Calendar size={20} className="text-[#88D8B0] mt-1" />
                    <div>
                      <p className="font-semibold text-gray-700 mb-2">Días disponibles:</p>
                      <div className="flex flex-wrap gap-2">
                        {walker.availability_days.map((day) => (
                          <span
                            key={day}
                            className="px-3 py-1 bg-[#88D8B0] bg-opacity-20 text-[#88D8B0] rounded-full text-sm font-medium"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Clock size={20} className="text-[#FFCC99] mt-1" />
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Horarios:</p>
                      <p className="text-gray-700">{walker.availability_hours}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl shadow-lg p-8 sticky top-24">
                <h3 className="text-xl font-bold text-[#1F2937] mb-6" style={{ fontFamily: 'Outfit' }}>
                  Solicitar paseo
                </h3>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Precio por hora</span>
                    <span className="font-bold text-lg">${walker.price_per_hour}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Calificación</span>
                    <div className="flex items-center space-x-1">
                      <Star size={16} className="text-[#FFCC99]" fill="#FFCC99" />
                      <span className="font-bold">{walker.rating_avg}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Experiencia</span>
                    <span className="font-bold">{walker.experience_years} años</span>
                  </div>
                </div>
                <button
                  onClick={handleRequestWalk}
                  className="w-full btn-secondary"
                  data-testid="request-walk-button"
                >
                  Solicitar Paseo
                </button>
                <p className="text-xs text-gray-500 text-center mt-4">
                  Podés elegir fecha, hora y duración en el siguiente paso
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, Clock, MapPin, Dog } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateWalkRequest() {
  const [searchParams] = useSearchParams();
  const walkerId = searchParams.get('walkerId');
  const [walker, setWalker] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: '60',
    address: '',
    notes: '',
    petName: '',
    petSize: 'M',
    petNotes: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      toast.error('Solo los dueños pueden solicitar paseos');
      navigate('/');
      return;
    }

    if (!walkerId) {
      toast.error('Debe seleccionar un paseador');
      navigate('/walkers');
      return;
    }

    fetchWalker();
  }, [walkerId]);

  const fetchWalker = async () => {
    try {
      const response = await api.get(`/walkers/${walkerId}`);
      setWalker(response.data);
    } catch (error) {
      console.error('Error al cargar paseador:', error);
      toast.error('Error al cargar el paseador');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.time || !formData.address || !formData.petName) {
      toast.error('Por favor completá todos los campos obligatorios');
      return;
    }

    const dateTimeStart = new Date(`${formData.date}T${formData.time}`);
    if (dateTimeStart < new Date()) {
      toast.error('La fecha y hora deben ser futuras');
      return;
    }

    setLoading(true);
    try {
      const walkData = {
        walker_profile_id: walkerId,
        date_time_start: dateTimeStart.toISOString(),
        duration_minutes: parseInt(formData.duration),
        address_text: formData.address,
        notes: formData.notes,
        pet_name: formData.petName,
        pet_size: formData.petSize,
        pet_notes: formData.petNotes,
      };

      await api.post('/walks', walkData);
      toast.success('¡Solicitud de paseo enviada correctamente!');
      navigate('/me/walks');
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      toast.error(error.response?.data?.detail || 'Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (!walker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  const estimatedCost = (walker.price_per_hour * parseInt(formData.duration)) / 60;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to={`/walkers/${walkerId}`}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors"
          data-testid="back-to-profile-link"
        >
          <ArrowLeft size={20} />
          <span>Volver al perfil</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h1
            className="text-3xl font-bold text-[#1F2937] mb-2"
            style={{ fontFamily: 'Outfit' }}
            data-testid="create-walk-title"
          >
            Solicitar Paseo
          </h1>
          <p className="text-gray-600 mb-8">
            con <span className="font-semibold">{walker.display_name}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar size={16} className="inline mr-2" />
                  Fecha *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="walk-date-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock size={16} className="inline mr-2" />
                  Hora *
                </label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="walk-time-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Duración *
              </label>
              <select
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                required
                data-testid="walk-duration-select"
              >
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1.5 horas</option>
                <option value="120">2 horas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-2" />
                Dirección de encuentro *
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ej: Av. Santa Fe 1234, Palermo"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                required
                data-testid="walk-address-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas adicionales
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Ej: Mi perro tira mucho de la correa, por favor tené paciencia"
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none"
                data-testid="walk-notes-input"
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-[#1F2937] mb-4" style={{ fontFamily: 'Outfit' }}>
                <Dog size={20} className="inline mr-2" />
                Información de tu mascota
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="petName"
                    value={formData.petName}
                    onChange={handleChange}
                    placeholder="Nombre de tu mascota"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                    required
                    data-testid="pet-name-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tamaño *
                  </label>
                  <select
                    name="petSize"
                    value={formData.petSize}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                    required
                    data-testid="pet-size-select"
                  >
                    <option value="S">Pequeño (hasta 10kg)</option>
                    <option value="M">Mediano (10-25kg)</option>
                    <option value="L">Grande (más de 25kg)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    name="petNotes"
                    value={formData.petNotes}
                    onChange={handleChange}
                    placeholder="Ej: Es muy sociable con otros perros, le encanta jugar"
                    rows="2"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none"
                    data-testid="pet-notes-input"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#F9FAFB] rounded-2xl p-6">
              <h3 className="text-lg font-bold text-[#1F2937] mb-4">Resumen</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Paseador:</span>
                  <span className="font-semibold">{walker.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duración:</span>
                  <span className="font-semibold">{formData.duration} minutos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Precio por hora:</span>
                  <span className="font-semibold">${walker.price_per_hour}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-800 font-bold">Costo estimado:</span>
                  <span className="text-[#88D8B0] font-bold text-xl">
                    ${estimatedCost.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => navigate(`/walkers/${walkerId}`)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-100 transition-colors"
                data-testid="cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="submit-walk-request-button"
              >
                {loading ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

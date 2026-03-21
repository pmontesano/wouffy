import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, Clock, MapPin, Dog, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateWalkRequest() {
  const [searchParams] = useSearchParams();
  const walkerId = searchParams.get('walkerId');
  const [walker, setWalker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pets, setPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(true);
  
  // New state for address selection
  const [userProfile, setUserProfile] = useState(null);
  const [addressOption, setAddressOption] = useState('custom'); // 'profile' or 'custom'

  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    date: '',
    time: '09:00',
    duration: '60',
    address: '',
    notes: '',
    petId: ''
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

    const fetchData = async () => {
      try {
        const [walkerRes, petsRes, profileRes] = await Promise.all([
          api.get(`/walkers/${walkerId}`),
          api.get('/me/pets'),
          api.get('/me/profile')
        ]);

        setWalker(walkerRes.data);
        setPets(petsRes.data);
        setUserProfile(profileRes.data);

        // Auto-select default pet
        const defaultPet = petsRes.data.find(p => p.is_default);
        if (defaultPet) {
          setFormData(prev => ({ ...prev, petId: defaultPet.pet_id }));
        } else if (petsRes.data.length > 0) {
          setFormData(prev => ({ ...prev, petId: petsRes.data[0].pet_id }));
        }

        // Auto-select profile address if available
        if (profileRes.data.address_text) {
          setAddressOption('profile');
          setFormData(prev => ({ ...prev, address: profileRes.data.address_text }));
        }

      } catch (error) {
        console.error('Error al cargar datos:', error);
        toast.error('Error al cargar la información necesaria');
      } finally {
        setLoadingPets(false);
      }
    };

    fetchData();
  }, [walkerId, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressOptionChange = (option) => {
    setAddressOption(option);
    if (option === 'profile' && userProfile?.address_text) {
      setFormData(prev => ({ ...prev, address: userProfile.address_text }));
    } else if (option === 'custom') {
      setFormData(prev => ({ ...prev, address: '' }));
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let i = 7; i <= 21; i++) { // 7 AM to 9 PM
      for (let j = 0; j < 60; j += 15) {
        const hour = i.toString().padStart(2, '0');
        const minute = j.toString().padStart(2, '0');
        slots.push(`${hour}:${minute}`);
      }
    }
    return slots;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.time || !formData.address || !formData.petId) {
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
        scheduled_start_at: dateTimeStart.toISOString(),
        estimated_duration_minutes: parseInt(formData.duration, 10),
        start_address_text: formData.address,
        notes: formData.notes || undefined,
        pet_id: formData.petId,
      };

      await api.post('/walks', walkData);
      toast.success('¡Solicitud de paseo enviada correctamente!');
      navigate('/me/walks');
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      let errorMessage = 'Error al crear la solicitud';
      
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // Handle Pydantic validation errors (array of objects)
          errorMessage = error.response.data.detail
            .map(err => `${err.loc[1]}: ${err.msg}`)
            .join(', ');
        } else if (typeof error.response.data.detail === 'object') {
           errorMessage = JSON.stringify(error.response.data.detail);
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!walker || loadingPets) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  const estimatedCost = (walker.price_per_hour * parseInt(formData.duration)) / 60;
  const selectedPet = pets.find(p => p.pet_id === formData.petId);

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
                <select
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="walk-time-select"
                >
                  {generateTimeSlots().map(time => (
                    <option key={time} value={time}>
                      {time} hs
                    </option>
                  ))}
                </select>
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
              
              {userProfile?.address_text ? (
                <div className="space-y-3 mb-3">
                  <label className="flex items-center space-x-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="addressOption"
                      value="profile"
                      checked={addressOption === 'profile'}
                      onChange={() => handleAddressOptionChange('profile')}
                      className="text-[#88D8B0] focus:ring-[#88D8B0]"
                    />
                    <div>
                      <span className="font-semibold block text-gray-800">Usar mi dirección guardada</span>
                      <span className="text-gray-500 text-sm">{userProfile.address_text}</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="addressOption"
                      value="custom"
                      checked={addressOption === 'custom'}
                      onChange={() => handleAddressOptionChange('custom')}
                      className="text-[#88D8B0] focus:ring-[#88D8B0]"
                    />
                    <span className="font-semibold text-gray-800">Ingresar otra dirección</span>
                  </label>
                </div>
              ) : null}

              {(addressOption === 'custom' || !userProfile?.address_text) && (
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Ej: Av. Santa Fe 1234, Palermo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none animate-fadeIn"
                  required
                  autoFocus={addressOption === 'custom'}
                  data-testid="walk-address-input"
                />
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-[#1F2937] mb-4" style={{ fontFamily: 'Outfit' }}>
                <Dog size={20} className="inline mr-2" />
                Mascota
              </h3>

              {pets.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3">
                  <AlertCircle className="text-yellow-600 mt-1" size={20} />
                  <div>
                    <h4 className="font-semibold text-yellow-800">No tenés mascotas registradas</h4>
                    <p className="text-yellow-700 text-sm mb-3">
                      Necesitás agregar al menos una mascota para solicitar un paseo.
                    </p>
                    <Link
                      to="/app/pets/new"
                      className="inline-flex items-center space-x-2 text-[#88D8B0] font-semibold hover:underline"
                    >
                      <Plus size={16} />
                      <span>Agregar Mascota</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Seleccioná tu mascota *
                    </label>
                    <select
                      name="petId"
                      value={formData.petId}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                      required
                      data-testid="pet-select"
                    >
                      <option value="">Seleccionar mascota...</option>
                      {pets.map(pet => (
                        <option key={pet.pet_id} value={pet.pet_id}>
                          {pet.name} ({pet.species === 'DOG' ? 'Perro' : 'Gato'} - {pet.size})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedPet && (
                     <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center space-x-4">
                          {selectedPet.photo_url ? (
                             <img src={selectedPet.photo_url} alt={selectedPet.name} className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                          ) : (
                             <div className="w-12 h-12 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center">
                                <Dog size={20} className="text-[#88D8B0]" />
                             </div>
                          )}
                          <div>
                             <p className="font-semibold text-gray-800">{selectedPet.name}</p>
                             <p className="text-sm text-gray-500">
                               {selectedPet.species === 'DOG' ? 'Perro' : 'Gato'} • {selectedPet.size}
                             </p>
                             {selectedPet.notes && (
                               <p className="text-sm text-gray-500 italic mt-1">"{selectedPet.notes}"</p>
                             )}
                          </div>
                        </div>
                     </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas adicionales para el paseador
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Ej: Llegar 5 minutos antes, tocar timbre..."
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none"
                data-testid="walk-notes-input"
              />
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
                disabled={loading || pets.length === 0}
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
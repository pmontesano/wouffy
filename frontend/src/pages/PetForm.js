import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, getBackendPublicOrigin } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Dog, ArrowLeft, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

export default function PetForm() {
  const { petId } = useParams();
  const isEdit = !!petId;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    species: 'DOG',
    size: 'M',
    date_of_birth: '',
    notes: '',
    photo_url: ''
  });

  useEffect(() => {
    if (user?.role !== 'OWNER') {
      toast.error('Solo los dueños pueden gestionar mascotas');
      navigate('/');
      return;
    }

    if (isEdit) {
      fetchPet();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  const fetchPet = async () => {
    try {
      const response = await api.get(`/me/pets/${petId}`);
      setFormData({
        name: response.data.name,
        species: response.data.species,
        size: response.data.size,
        date_of_birth: response.data.date_of_birth || '',
        notes: response.data.notes || '',
        photo_url: response.data.photo_url || ''
      });
      if (response.data.photo_url) {
        setImagePreview(response.data.photo_url);
      }
    } catch (error) {
      console.error('Error al cargar mascota:', error);
      toast.error('Error al cargar la mascota');
      navigate('/app/pets');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }

    // Mostrar preview LOCAL inmediatamente
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Subir al servidor
    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await api.post('/upload/pet-photo', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const photoUrl = `${getBackendPublicOrigin()}${response.data.photo_url}`;
      setFormData(prev => ({ ...prev, photo_url: photoUrl }));
      toast.success('¡Foto subida correctamente!');
    } catch (error) {
      console.error('Error al subir foto:', error);
      toast.error(error.response?.data?.detail || 'Error al subir la foto');
      // Limpiar preview si falla
      setImagePreview(null);
      setFormData(prev => ({ ...prev, photo_url: '' }));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, photo_url: '' }));
    setImagePreview(null);
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0) {
      return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    } else if (months === 0) {
      return `${years} ${years === 1 ? 'año' : 'años'}`;
    } else {
      return `${years} ${years === 1 ? 'año' : 'años'} y ${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (formData.species === 'DOG' && !formData.size) {
      toast.error('El tamaño es requerido para perros');
      return;
    }

    setSaving(true);

    try {
      const petData = {
        ...formData,
        date_of_birth: formData.date_of_birth || null
      };

      if (isEdit) {
        await api.put(`/me/pets/${petId}`, petData);
        toast.success('¡Mascota actualizada correctamente!');
      } else {
        await api.post('/me/pets', petData);
        toast.success('¡Mascota creada correctamente!');
      }

      navigate('/app/pets');
    } catch (error) {
      console.error('Error al guardar mascota:', error);
      const errorMsg = error.response?.data?.detail || 'Error al guardar la mascota';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]"></div>
      </div>
    );
  }

  const currentAge = calculateAge(formData.date_of_birth);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/app/pets"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors"
          data-testid="back-to-pets-link"
        >
          <ArrowLeft size={20} />
          <span>Volver a Mis Mascotas</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-16 h-16 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center">
              <Dog size={32} className="text-[#88D8B0]" />
            </div>
            <div>
              <h1
                className="text-3xl font-bold text-[#1F2937]"
                style={{ fontFamily: 'Outfit' }}
                data-testid="pet-form-title"
              >
                {isEdit ? 'Editar Mascota' : 'Nueva Mascota'}
              </h1>
              <p className="text-gray-600">
                {isEdit ? 'Actualizá la información de tu mascota' : 'Agregá la información de tu mascota'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Foto de la mascota
              </label>
              <div className="flex items-center space-x-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-32 h-32 rounded-xl object-cover border-2 border-[#88D8B0]"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-[#88D8B0] to-[#6FCF9F] flex items-center justify-center">
                    <Dog size={48} className="text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <label
                    htmlFor="photo-upload"
                    className={`inline-flex items-center space-x-2 px-4 py-2 border-2 border-[#88D8B0] text-[#88D8B0] rounded-full hover:bg-[#88D8B0] hover:text-white transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload size={18} />
                    <span>{uploading ? 'Subiendo...' : 'Subir Foto'}</span>
                  </label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                    data-testid="photo-upload-input"
                  />
                  <p className="text-xs text-gray-500 mt-2">JPG, PNG o WEBP. Máximo 5MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej: Rocky"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                required
                data-testid="pet-name-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Especie *
                </label>
                <select
                  name="species"
                  value={formData.species}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required
                  data-testid="pet-species-select"
                >
                  <option value="DOG">Perro</option>
                  <option value="CAT">Gato</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tamaño {formData.species === 'DOG' && '*'}
                </label>
                <select
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  required={formData.species === 'DOG'}
                  data-testid="pet-size-select"
                >
                  <option value="S">Pequeño (hasta 10kg)</option>
                  <option value="M">Mediano (10-25kg)</option>
                  <option value="L">Grande (más de 25kg)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                data-testid="pet-birth-date-input"
              />
              {currentAge && (
                <p className="text-sm text-[#88D8B0] mt-2 font-semibold">
                  Edad: {currentAge}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas / Observaciones
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Ej: Es muy sociable, le encanta jugar con otros perros"
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none"
                data-testid="pet-notes-input"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/app/pets')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-100 transition-colors"
                data-testid="cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="submit-pet-button"
              >
                {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Mascota'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Dog, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function PetForm() {
  const { petId } = useParams();
  const isEdit = !!petId;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    species: 'DOG',
    size: 'M',
    age_years: '',
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
  }, [petId]);

  const fetchPet = async () => {
    try {
      const response = await api.get(`/me/pets/${petId}`);
      setFormData({
        name: response.data.name,
        species: response.data.species,
        size: response.data.size,
        age_years: response.data.age_years || '',
        notes: response.data.notes || '',
        photo_url: response.data.photo_url || ''
      });
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
        age_years: formData.age_years ? parseInt(formData.age_years) : null
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
      <div className=\"min-h-screen flex items-center justify-center\">
        <div className=\"animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0]\"></div>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-[#F9FAFB]\">
      <div className=\"max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8\">
        <Link
          to=\"/app/pets\"
          className=\"inline-flex items-center space-x-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors\"
          data-testid=\"back-to-pets-link\"
        >
          <ArrowLeft size={20} />
          <span>Volver a Mis Mascotas</span>
        </Link>

        <div className=\"bg-white rounded-3xl shadow-xl p-8\">
          <div className=\"flex items-center space-x-4 mb-8\">
            <div className=\"w-16 h-16 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center\">
              <Dog size={32} className=\"text-[#88D8B0]\" />
            </div>
            <div>
              <h1
                className=\"text-3xl font-bold text-[#1F2937]\"
                style={{ fontFamily: 'Outfit' }}
                data-testid=\"pet-form-title\"
              >
                {isEdit ? 'Editar Mascota' : 'Nueva Mascota'}
              </h1>
              <p className=\"text-gray-600\">
                {isEdit ? 'Actualizá la información de tu mascota' : 'Agregá la información de tu mascota'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className=\"space-y-6\">
            <div>
              <label className=\"block text-sm font-semibold text-gray-700 mb-2\">
                Nombre *
              </label>
              <input
                type=\"text\"
                name=\"name\"
                value={formData.name}
                onChange={handleChange}
                placeholder=\"Ej: Rocky\"
                className=\"w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none\"
                required
                data-testid=\"pet-name-input\"
              />
            </div>

            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
              <div>
                <label className=\"block text-sm font-semibold text-gray-700 mb-2\">
                  Especie *
                </label>
                <select
                  name=\"species\"
                  value={formData.species}
                  onChange={handleChange}
                  className=\"w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none\"
                  required
                  data-testid=\"pet-species-select\"
                >
                  <option value=\"DOG\">Perro</option>
                  <option value=\"CAT\">Gato</option>
                  <option value=\"OTHER\">Otro</option>
                </select>
              </div>

              <div>
                <label className=\"block text-sm font-semibold text-gray-700 mb-2\">
                  Tamaño {formData.species === 'DOG' && '*'}
                </label>
                <select
                  name=\"size\"
                  value={formData.size}
                  onChange={handleChange}
                  className=\"w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none\"
                  required={formData.species === 'DOG'}
                  data-testid=\"pet-size-select\"
                >
                  <option value=\"S\">Pequeño (hasta 10kg)</option>
                  <option value=\"M\">Mediano (10-25kg)</option>
                  <option value=\"L\">Grande (más de 25kg)</option>
                </select>
              </div>
            </div>

            <div>
              <label className=\"block text-sm font-semibold text-gray-700 mb-2\">
                Edad (años)
              </label>
              <input
                type=\"number\"
                name=\"age_years\"
                value={formData.age_years}
                onChange={handleChange}
                placeholder=\"Ej: 3\"
                min=\"0\"
                max=\"30\"
                className=\"w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none\"
                data-testid=\"pet-age-input\"
              />
            </div>

            <div>
              <label className=\"block text-sm font-semibold text-gray-700 mb-2\">
                Notas / Observaciones
              </label>
              <textarea
                name=\"notes\"
                value={formData.notes}
                onChange={handleChange}
                placeholder=\"Ej: Es muy sociable, le encanta jugar con otros perros\"
                rows=\"4\"
                className=\"w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none resize-none\"
                data-testid=\"pet-notes-input\"
              />
            </div>

            <div>
              <label className=\"block text-sm font-semibold text-gray-700 mb-2\">
                URL de foto (opcional)
              </label>
              <input
                type=\"url\"
                name=\"photo_url\"
                value={formData.photo_url}
                onChange={handleChange}
                placeholder=\"https://ejemplo.com/foto.jpg\"
                className=\"w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none\"
                data-testid=\"pet-photo-input\"
              />
              {formData.photo_url && (
                <div className=\"mt-3\">
                  <img
                    src={formData.photo_url}
                    alt=\"Preview\"
                    className=\"w-32 h-32 rounded-xl object-cover\"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>

            <div className=\"flex flex-col sm:flex-row gap-4 pt-4\">
              <button
                type=\"button\"
                onClick={() => navigate('/app/pets')}
                className=\"flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-100 transition-colors\"
                data-testid=\"cancel-button\"
              >
                Cancelar
              </button>
              <button
                type=\"submit\"
                disabled={saving}
                className=\"flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed\"
                data-testid=\"submit-pet-button\"
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

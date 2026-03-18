import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, Star, Dog, Cat, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function MyPets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'OWNER') {
      toast.error('Solo los dueños pueden gestionar mascotas');
      navigate('/');
      return;
    }
    fetchPets();
  }, []);

  const fetchPets = async () => {
    try {
      const response = await api.get('/me/pets');
      setPets(response.data);
    } catch (error) {
      console.error('Error al cargar mascotas:', error);
      toast.error('Error al cargar las mascotas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (petId, petName) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${petName}?`)) {
      return;
    }

    try {
      await api.delete(`/me/pets/${petId}`);
      toast.success('Mascota eliminada correctamente');
      fetchPets();
    } catch (error) {
      console.error('Error al eliminar mascota:', error);
      toast.error('Error al eliminar la mascota');
    }
  };

  const handleSetDefault = async (petId) => {
    try {
      await api.patch(`/me/pets/${petId}/default`);
      toast.success('Mascota predeterminada actualizada');
      fetchPets();
    } catch (error) {
      console.error('Error al actualizar:', error);
      toast.error('Error al actualizar mascota predeterminada');
    }
  };

  const getSpeciesIcon = (species) => {
    switch(species) {
      case 'DOG': return <Dog size={24} className="text-[#88D8B0]" />;
      case 'CAT': return <Cat size={24} className="text-[#FFCC99]" />;
      default: return <Dog size={24} className="text-gray-400" />;
    }
  };

  const getSpeciesLabel = (species) => {
    switch(species) {
      case 'DOG': return 'Perro';
      case 'CAT': return 'Gato';
      case 'OTHER': return 'Otro';
      default: return species;
    }
  };

  const getSizeLabel = (size) => {
    switch(size) {
      case 'S': return 'Pequeño';
      case 'M': return 'Mediano';
      case 'L': return 'Grande';
      default: return size;
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
        <Link
          to="/app/account"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-[#88D8B0] mb-6 transition-colors"
          data-testid="back-to-account-link"
        >
          <ArrowLeft size={20} />
          <span>Volver a Mi Cuenta</span>
        </Link>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-4xl font-bold text-[#1F2937] mb-2"
              style={{ fontFamily: 'Outfit' }}
              data-testid="my-pets-title"
            >
              Mis Mascotas
            </h1>
            <p className="text-gray-600">Administrá la información de tus mascotas</p>
          </div>
          <Link
            to="/app/pets/new"
            className="mt-4 sm:mt-0 btn-primary inline-flex items-center space-x-2"
            data-testid="add-pet-button"
          >
            <Plus size={20} />
            <span>Agregar Mascota</span>
          </Link>
        </div>

        {pets.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <Dog size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">No tenés mascotas registradas</h3>
            <p className="text-gray-600 mb-6">
              Agregá la información de tus mascotas para solicitar paseos
            </p>
            <Link
              to="/app/pets/new"
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Agregar Mi Primera Mascota</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet, index) => (
              <motion.div
                key={pet.pet_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-white rounded-3xl shadow-lg card-hover overflow-hidden"
                data-testid={`pet-card-${pet.pet_id}`}
              >
                <div className="relative h-48 bg-gradient-to-br from-[#88D8B0] to-[#6FCF9F] flex items-center justify-center">
                  {pet.photo_url ? (
                    <img
                      src={pet.photo_url}
                      alt={pet.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-white">
                      {getSpeciesIcon(pet.species)}
                    </div>
                  )}
                  {pet.is_default && (
                    <div className="absolute top-4 right-4 bg-[#FFCC99] text-white px-3 py-1 rounded-full flex items-center space-x-1 text-sm font-semibold">
                      <Star size={14} fill="white" />
                      <span>Predeterminada</span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-2xl font-bold text-[#1F2937] mb-3" style={{ fontFamily: 'Outfit' }}>
                    {pet.name}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Especie:</span>
                      <span className="font-semibold">{getSpeciesLabel(pet.species)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Tamaño:</span>
                      <span className="font-semibold">{getSizeLabel(pet.size)}</span>
                    </div>
                    {pet.age_years && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Edad:</span>
                        <span className="font-semibold">{pet.age_years} {pet.age_years === 1 ? 'año' : 'años'}</span>
                      </div>
                    )}
                  </div>

                  {pet.notes && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pet.notes}</p>
                  )}

                  <div className="flex space-x-2">
                    <Link
                      to={`/app/pets/${pet.pet_id}/edit`}
                      className="flex-1 px-4 py-2 bg-[#88D8B0] text-white rounded-full hover:bg-[#6FCF9F] transition-colors flex items-center justify-center space-x-2"
                      data-testid={`edit-pet-${pet.pet_id}`}
                    >
                      <Edit size={16} />
                      <span>Editar</span>
                    </Link>
                    <button
                      onClick={() => handleDelete(pet.pet_id, pet.name)}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                      data-testid={`delete-pet-${pet.pet_id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {!pet.is_default && (
                    <button
                      onClick={() => handleSetDefault(pet.pet_id)}
                      className="w-full mt-2 px-4 py-2 border-2 border-[#FFCC99] text-[#FFCC99] rounded-full hover:bg-[#FFCC99] hover:text-white transition-colors text-sm font-semibold"
                      data-testid={`set-default-${pet.pet_id}`}
                    >
                      Marcar como predeterminada
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

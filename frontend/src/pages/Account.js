import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { User, Phone, MapPin, Mail, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address_text: '',
    city: '',
    avatar_url: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/me/profile');
      setProfile(response.data);
      setFormData({
        full_name: response.data.full_name || '',
        phone: response.data.phone || '',
        address_text: response.data.address_text || '',
        city: response.data.city || '',
        avatar_url: response.data.avatar_url || ''
      });
    } catch (error) {
      console.error('Error al cargar perfil:', error);
      toast.error('Error al cargar el perfil');
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
    setSaving(true);

    try {
      await api.put('/me/profile', formData);
      toast.success('¡Perfil actualizado correctamente!');
      fetchProfile();
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      toast.error('Error al actualizar el perfil');
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

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1
              className="text-4xl font-bold text-[#1F2937] mb-2"
              style={{ fontFamily: 'Outfit' }}
              data-testid="account-title"
            >
              Mi Cuenta
            </h1>
            <p className="text-gray-600">Administrá tu información personal</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
            <div className="flex items-center space-x-6 mb-8 pb-8 border-b">
              <div className="relative">
                {formData.avatar_url || user?.picture ? (
                  <img
                    src={formData.avatar_url || user?.picture}
                    alt={user?.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#88D8B0]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#88D8B0] flex items-center justify-center text-white text-3xl font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <button className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg border-2 border-[#88D8B0] hover:bg-[#88D8B0] hover:text-white transition-colors">
                  <Camera size={16} />
                </button>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#1F2937]" style={{ fontFamily: 'Outfit' }}>
                  {user?.name}
                </h2>
                <p className="text-gray-600 flex items-center space-x-2 mt-1">
                  <Mail size={16} />
                  <span>{user?.email}</span>
                </p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                  user?.role === 'OWNER' ? 'bg-[#88D8B0] text-white' : 'bg-[#FFCC99] text-[#5A3A20]'
                }`}>
                  {user?.role === 'OWNER' ? 'Dueño' : 'Paseador'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <User size={16} className="inline mr-2" />
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Tu nombre completo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="full-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Phone size={16} className="inline mr-2" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 11 1234-5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="phone-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <MapPin size={16} className="inline mr-2" />
                  Dirección
                </label>
                <input
                  type="text"
                  name="address_text"
                  value={formData.address_text}
                  onChange={handleChange}
                  placeholder="Av. Santa Fe 1234"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="address-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ciudad
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Buenos Aires"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#88D8B0] focus:border-[#88D8B0] outline-none"
                  data-testid="city-input"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="save-profile-button"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>

          {user?.role === 'OWNER' && (
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#1F2937] mb-1" style={{ fontFamily: 'Outfit' }}>
                    Mis Mascotas
                  </h3>
                  <p className="text-gray-600 text-sm">Administrá la información de tus mascotas</p>
                </div>
                <button
                  onClick={() => navigate('/app/pets')}
                  className="btn-secondary"
                  data-testid="manage-pets-button"
                >
                  Ver Mascotas
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

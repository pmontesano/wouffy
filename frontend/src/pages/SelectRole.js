import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { User, Briefcase, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SelectRole() {
  /** 'OWNER' | 'WALKER' | null — qué tarjeta está enviando */
  const [submitting, setSubmitting] = useState(null);
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const handleChooseRole = async (role) => {
    if (submitting) return;

    setSubmitting(role);
    try {
      const response = await api.patch('/auth/role', { role });
      updateUser(response.data);
      toast.success('¡Rol seleccionado correctamente!');

      if (role === 'WALKER') {
        navigate('/walker/profile/create', { replace: true });
      } else {
        navigate('/walkers', { replace: true });
      }
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === 'string' ? detail : 'Error al seleccionar rol. Intentá nuevamente.'
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0FDF4] to-white px-4 py-12">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1
            className="text-4xl font-bold text-[#1F2937] mb-4"
            style={{ fontFamily: 'Outfit' }}
            data-testid="select-role-title"
          >
            ¿Cómo querés usar Wouffy?
          </h1>
          <p className="text-lg text-gray-600">
            Tocá una opción para continuar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => handleChooseRole('OWNER')}
            disabled={!!submitting}
            className={`text-left bg-white rounded-3xl p-8 shadow-lg transition-all disabled:opacity-60 ${
              submitting === 'OWNER'
                ? 'ring-4 ring-[#88D8B0] scale-[1.02]'
                : 'hover:shadow-xl hover:scale-[1.02] ring-2 ring-transparent'
            }`}
            data-testid="role-owner-button"
          >
            <div className="w-20 h-20 bg-[#88D8B0] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <User size={40} className="text-[#88D8B0]" />
            </div>
            <h2
              className="text-2xl font-bold text-[#1F2937] mb-3 text-center"
              style={{ fontFamily: 'Outfit' }}
            >
              Soy Dueño
            </h2>
            <p className="text-gray-600 mb-4">
              Buscá paseadores profesionales para tu mascota y programa paseos cuando lo necesites.
            </p>
            <ul className="text-left text-gray-600 space-y-2">
              <li className="flex items-center space-x-2">
                <span className="text-[#88D8B0]">✓</span>
                <span>Buscar paseadores cercanos</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-[#88D8B0]">✓</span>
                <span>Solicitar paseos</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-[#88D8B0]">✓</span>
                <span>Ver historial de paseos</span>
              </li>
            </ul>
            {submitting === 'OWNER' && (
              <p className="mt-6 flex items-center justify-center gap-2 text-[#88D8B0] font-medium">
                <Loader2 className="animate-spin" size={20} />
                Guardando…
              </p>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleChooseRole('WALKER')}
            disabled={!!submitting}
            className={`text-left bg-white rounded-3xl p-8 shadow-lg transition-all disabled:opacity-60 ${
              submitting === 'WALKER'
                ? 'ring-4 ring-[#FFCC99] scale-[1.02]'
                : 'hover:shadow-xl hover:scale-[1.02] ring-2 ring-transparent'
            }`}
            data-testid="role-walker-button"
          >
            <div className="w-20 h-20 bg-[#FFCC99] bg-opacity-30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase size={40} className="text-[#FFCC99]" />
            </div>
            <h2
              className="text-2xl font-bold text-[#1F2937] mb-3 text-center"
              style={{ fontFamily: 'Outfit' }}
            >
              Soy Paseador
            </h2>
            <p className="text-gray-600 mb-4">
              Ofrecé tus servicios de paseo, gestioná solicitudes y generá ingresos haciendo lo que amás.
            </p>
            <ul className="text-left text-gray-600 space-y-2">
              <li className="flex items-center space-x-2">
                <span className="text-[#FFCC99]">✓</span>
                <span>Crear perfil profesional</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-[#FFCC99]">✓</span>
                <span>Recibir solicitudes</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-[#FFCC99]">✓</span>
                <span>Gestionar tu agenda</span>
              </li>
            </ul>
            {submitting === 'WALKER' && (
              <p className="mt-6 flex items-center justify-center gap-2 text-[#FFCC99] font-medium">
                <Loader2 className="animate-spin" size={20} />
                Guardando…
              </p>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

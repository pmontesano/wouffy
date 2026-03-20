import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { api, persistSessionToken } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getSessionIdFromUrl } from '../utils/authRedirect';

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        const sessionId = getSessionIdFromUrl(location);
        if (!sessionId) {
          navigate('/');
          return;
        }

        const response = await api.post('/auth/session', null, {
          headers: {
            'X-Session-ID': sessionId,
          },
        });

        const { session_token: sessionToken, ...userData } = response.data;

        // En HTTP entre :3000 y :8000 la cookie Secure no aplica; usamos Bearer + sessionStorage.
        if (sessionToken) {
          persistSessionToken(sessionToken);
        }

        login(userData);

        if (!userData.role) {
          navigate('/select-role', { state: { user: userData } });
        } else if (userData.role === 'WALKER') {
          navigate('/walker/requests', { state: { user: userData } });
        } else {
          navigate('/app/account', { state: { user: userData } });
        }
      } catch (error) {
        console.error('Error procesando autenticación:', error);
        const detail = error.response?.data?.detail;
        toast.error(
          typeof detail === 'string' ? detail : 'No se pudo iniciar sesión. Probá de nuevo.'
        );
        navigate('/');
      }
    };

    processSession();
  }, [location, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#88D8B0] mx-auto mb-4"></div>
        <p className="text-gray-600">Iniciando sesión...</p>
      </div>
    </div>
  );
}
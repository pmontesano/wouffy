import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, persistSessionToken, setAuthToken, SESSION_TOKEN_STORAGE_KEY } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // Si al arrancar no había token guardado, un 401 es “no hay sesión aún” (p. ej. OAuth en curso).
    // No limpiar sessionStorage ni user en ese caso: el callback puede haber guardado el token
    // y hecho login() mientras este GET estaba en vuelo — si limpiamos, rompemos PATCH /auth/role.
    const hadStoredToken = !!sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);

    try {
      const stored = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      if (stored) {
        setAuthToken(stored);
      }
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      const status = error.response?.status;
      if (hadStoredToken) {
        setUser(null);
        persistSessionToken(null);
      } else if (status !== 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
    persistSessionToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
import axios from "axios";

const isDev = process.env.NODE_ENV === "development";
const envUrl = (process.env.REACT_APP_BACKEND_URL || "").trim();

/**
 * En desarrollo las peticiones van al mismo origen (localhost:3000) y CRA las proxifica
 * a FastAPI (package.json "proxy") → no hay CORS ni cookies cross-origin.
 * En producción usá REACT_APP_BACKEND_URL con la URL pública del API.
 */
export const API = isDev
  ? "/api"
  : envUrl
    ? `${envUrl.replace(/\/$/, "")}/api`
    : "/api";

/** Origen público del backend (solo producción / URLs absolutas a imágenes). */
export const getBackendPublicOrigin = () =>
  isDev ? "" : envUrl.replace(/\/$/, "");

/** Clave en sessionStorage para desarrollo local (origen distinto o sin cookie Secure en HTTP). */
export const SESSION_TOKEN_STORAGE_KEY = "wouffy_session_token";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Siempre leer el token desde sessionStorage en cada request (evita carreras con checkAuth / defaults vacíos).
api.interceptors.request.use((config) => {
  try {
    const t = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (t) {
      if (!config.headers) config.headers = {};
      config.headers["Authorization"] = `Bearer ${t}`;
    }
  } catch {
    /* ignore */
  }
  return config;
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export const persistSessionToken = (token) => {
  if (token) {
    sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    setAuthToken(token);
  } else {
    sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    setAuthToken(null);
  }
};

// Interceptor para manejar 401 (sesión expirada)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Ignorar 401 de /auth/me para evitar loop de redirección en carga inicial
      if (error.config.url?.includes("/auth/me")) {
        return Promise.reject(error);
      }

      // Limpiar cookie y token en memoria (desarrollo local)
      document.cookie = "session_token=; path=/; max-age=0";
      try {
        sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setAuthToken(null);

      const path = window.location.pathname;
      // En rutas de la app, no forzar recarga a /login: el componente muestra toast (401 en PATCH/PUT).
      const stayOnPage =
        path === "/select-role" ||
        path.startsWith("/app") ||
        path.startsWith("/walker") ||
        path.startsWith("/walkers") ||
        path.startsWith("/me/");
      if (!stayOnPage && !path.includes("/login") && !path.includes("/auth")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/**
 * @param {string} status
 * @param {object} [walk] - objeto walk del API (usa finalization_source)
 */
export const getWalkStatusLabel = (status, walk = null) => {
  if (status === "COMPLETED" && walk?.finalization_source === "SYSTEM") {
    return "Paseo finalizado";
  }
  const labels = {
    REQUESTED: "Solicitado",
    ACCEPTED: "Aceptado",
    WALKER_ON_THE_WAY: "El paseador ya está en camino",
    ARRIVED: "El paseador ya llegó a tu casa",
    IN_PROGRESS: "Paseo en curso",
    REJECTED: "Solicitud rechazada",
    CANCELLED: "Solicitud cancelada",
    COMPLETED: "Paseo completado",
  };
  return labels[status] || status;
};

export const getWalkStatusClass = (status, walk = null) => {
  if (status === "COMPLETED" && walk?.finalization_source === "SYSTEM") {
    return "status-finalized";
  }
  const classes = {
    REQUESTED: "status-requested",
    ACCEPTED: "status-accepted",
    WALKER_ON_THE_WAY: "status-accepted",
    ARRIVED: "status-accepted",
    IN_PROGRESS: "status-accepted",
    REJECTED: "status-rejected",
    CANCELLED: "status-cancelled",
    COMPLETED: "status-completed",
  };
  return classes[status] || "";
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTime = (dateString) => {
  return `${formatDate(dateString)} a las ${formatTime(dateString)}`;
};

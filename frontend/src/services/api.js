export const API_BASE = (function() {
  // Obtener la ruta base donde está montada la app para que funcione en subcarpetas (ej: /octupassmail/)
  const path = window.location.pathname;
  const baseDir = path.substring(0, path.lastIndexOf('/') + 1);
  return baseDir.replace(/\/public\/$/, '/') + 'backend/api';
})();

export async function apiRequest(endpoint, options = {}) {
  const defaultHeaders = {};
  
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    },
    credentials: 'include'
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Error en la solicitud (${response.status})`);
  }

  return data;
}

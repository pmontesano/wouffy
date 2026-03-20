/**
 * OAuth vuelve con session_id en el hash (#session_id=...) o en query (?session_id=...).
 */
export function getSessionIdFromUrl(location) {
  const hash = location.hash || '';
  if (hash.includes('session_id=')) {
    const raw = hash.split('session_id=')[1].split('&')[0];
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const params = new URLSearchParams(location.search);
  const q = params.get('session_id');
  if (!q) return null;
  try {
    return decodeURIComponent(q);
  } catch {
    return q;
  }
}

export function isOAuthReturnUrl(location) {
  if (location.pathname === '/auth/callback' || location.pathname === '/auth') {
    return true;
  }
  return !!getSessionIdFromUrl(location);
}

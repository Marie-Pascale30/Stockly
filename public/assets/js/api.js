// Client API + session persistée.

const KEY = 'stockly.session';

export const session = {
  data: load(),
  get token() { return this.data?.token ?? null; },
  get user() { return this.data?.user ?? null; },
  get settings() { return this.data?.settings ?? { theme: 'system', items_per_page: 10, notifications: true, display_charts: true }; },
  get isAdmin() { return this.user?.role === 'admin'; },
  set(data) { this.data = data; save(data); },
  patch(part) { this.data = { ...this.data, ...part }; save(this.data); },
  clear() { this.data = null; try { localStorage.removeItem(KEY); } catch {} },
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export class ApiError extends Error {
  constructor(status, body) {
    const err = body?.error ?? {};
    super(err.message || 'Une erreur inattendue est survenue.');
    this.status = status;
    this.code = err.code || 'error';
    this.details = err.details || {};
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(path, { method = 'GET', body, query, raw = false } = {}) {
  const url = new URL(window.STOCKLY.api + path, location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { error: { message: 'Impossible de joindre le serveur. Vérifiez votre connexion.' } });
  }

  if (raw && res.ok) return res;
  if (res.status === 204) return { data: null };

  let json = null;
  try { json = await res.json(); } catch {}

  if (!res.ok) {
    const error = new ApiError(res.status, json);
    if (res.status === 401 && session.token && !path.startsWith('/auth/login')) onUnauthorized(error);
    throw error;
  }
  return json ?? { data: null };
}

export const get = (path, query) => api(path, { query });
export const post = (path, body) => api(path, { method: 'POST', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });

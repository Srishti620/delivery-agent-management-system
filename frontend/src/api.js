const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

/** Error carrying the HTTP status and the API's per-field `details` (used to show form errors). */
export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, payload?.error?.message || `Request failed (${res.status})`, payload?.error?.details || []);
  }
  return payload;
}

const enc = encodeURIComponent;

/** Resolves to { data: Agent[], meta: { page, limit, total, totalPages } } */
export function listAgents(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  return request(`/agents?${query}`);
}

export const getAgent = (id) => request(`/agents/${enc(id)}`).then((r) => r.data);
export const createAgent = (body) => request('/agents', { method: 'POST', body }).then((r) => r.data);
export const updateAgent = (id, body) => request(`/agents/${enc(id)}`, { method: 'PUT', body }).then((r) => r.data);
export const patchAgent = (id, body) => request(`/agents/${enc(id)}`, { method: 'PATCH', body }).then((r) => r.data);
export const deleteAgent = (id) => request(`/agents/${enc(id)}`, { method: 'DELETE' });

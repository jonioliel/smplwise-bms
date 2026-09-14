/**
 * Minimal API client. All URLs are relative to the page (`api/v1/...`) so the same build works under
 * the HA Ingress prefix and on the dev server. Errors follow the server's error model.
 */
export interface ApiErrorBody {
  code: string;
  user_message: string;
  retryable: boolean;
  correlation_id: string;
  details: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.user_message || body.code);
  }
  get code() {
    return this.body.code;
  }
}

/** Base for API calls: `<page dir>/api/v1/`. Under Ingress the page dir is `/api/hassio_ingress/<token>/`. */
export function apiBase(): URL {
  return new URL('api/v1/', document.baseURI);
}

export function apiUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), apiBase()).toString();
}

/** Turn a server-relative resource path (e.g. `api/v1/plan-versions/x/image.png`) into an absolute URL. */
export function resourceUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), document.baseURI).toString();
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(apiUrl(path), { ...init, headers, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = (data as ApiErrorBody | null) ?? { code: `http_${res.status}`, user_message: res.statusText, retryable: false, correlation_id: '', details: {} };
    throw new ApiError(res.status, body);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => api<void>(path, { method: 'DELETE' });
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: 'POST', body: form });

export function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.body.user_message || err.body.code;
  if (err instanceof TypeError) return 'אין חיבור לשרת.';
  return err instanceof Error ? err.message : String(err);
}

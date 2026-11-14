import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';

// Single HTTP client for the whole app. Every request goes through here so auth,
// timeouts, error shapes and session expiry are handled in one place.

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    const errors = (body as { errors?: unknown } | undefined)?.errors;
    this.fieldErrors =
      errors && typeof errors === 'object' && !Array.isArray(errors)
        ? (errors as Record<string, string>)
        : {};
  }
}

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
const NETWORK_MESSAGE = 'Cannot reach the server. Check your connection.';

/** Turns anything thrown into a message you can show to the user. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';

// ─── Auth hooks (wired up by the auth store) ─────────────────────────────────
let currentToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  currentToken = token;
};
export const getAuthToken = () => currentToken;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

// ─── Request ──────────────────────────────────────────────────────────────────
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  /** JSON body (objects) or multipart form. */
  body?: unknown;
  /** Attach the bearer token (default true). Public endpoints pass false. */
  auth?: boolean;
  /** Query parameters; null/undefined values are sent as the literal "null" the backend expects. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Response handling: json (default), text, or none. */
  responseType?: 'json' | 'text' | 'none';
  signal?: AbortSignal;
  timeoutMs?: number;
}

const buildUrl = (path: string, query?: RequestOptions['query']) => {
  if (!query) return API_BASE_URL + path;
  const qs = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v == null ? 'null' : String(v))}`)
    .join('&');
  return `${API_BASE_URL}${path}${path.includes('?') ? '&' : '?'}${qs}`;
};

const pickMessage = (body: unknown, status: number): string => {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = b.detail || b.message || b.error || b.title;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (typeof body === 'string' && body.trim() && body.length < 200) return body;
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return 'Not found.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return `Request failed (${status})`;
};

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, responseType = 'json', timeoutMs } = opts;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth && currentToken) headers.Authorization = `Bearer ${currentToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort());

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiError(0, opts.signal?.aborted ? 'Request cancelled.' : NETWORK_MESSAGE, e);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text().catch(() => '');
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth && currentToken) {
      onUnauthorized?.();
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE, parsed);
    }
    if (res.status === 413) {
      throw new ApiError(413, 'File is too large. Please choose a smaller image.', parsed);
    }
    throw new ApiError(res.status, pickMessage(parsed, res.status), parsed);
  }

  if (responseType === 'none') return undefined as T;
  if (responseType === 'text') return text as T;
  return (text ? parsed : null) as T;
}

/** Most legacy endpoints wrap lists as { data: [...], count }. */
export interface Wrapped<T> {
  data?: T[];
  count?: number;
  content?: T[];
  [key: string]: unknown;
}

export const unwrapList = <T>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const r = res as Wrapped<T> | null;
  if (Array.isArray(r?.data)) return r!.data!;
  if (Array.isArray(r?.content)) return r!.content!;
  return [];
};

export const unwrapFirst = <T>(res: unknown): T => {
  const r = res as Wrapped<T> | null;
  return (r?.data?.[0] ?? res) as T;
};

/** Builds the React Native multipart file part from a picked file. */
export const filePart = (file: { uri: string; name: string; type: string }) =>
  ({ uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api';

export type Role = 'district' | 'local' | 'admin';
export type Status = 'draft' | 'submitted' | 'returned' | 'approved';

export interface ChairSession {
  role: 'district' | 'local';
  token: string;
  name: string;
}
export interface AdminSession {
  token: string;
  name: string;
  email: string;
}

const CHAIR_KEY = 'gnat.chair';
const ADMIN_KEY = 'gnat.admin';

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: session lives only in memory */
  }
}

let chairMem: ChairSession | null = read(CHAIR_KEY);
let adminMem: AdminSession | null = read(ADMIN_KEY);

export const session = {
  chair: () => chairMem,
  setChair(s: ChairSession | null) {
    chairMem = s;
    write(CHAIR_KEY, s);
  },
  admin: () => adminMem,
  setAdmin(s: AdminSession | null) {
    adminMem = s;
    write(ADMIN_KEY, s);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Who = 'chair' | 'admin' | 'none';

async function request<T>(method: string, path: string, body: unknown, who: Who): Promise<T> {
  const token = who === 'chair' ? chairMem?.token : who === 'admin' ? adminMem?.token : undefined;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'No internet connection. Your work is kept on this phone. Try again when you are back online.');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    if (res.status === 401 && who !== 'none') {
      if (who === 'chair') session.setChair(null);
      else session.setAdmin(null);
      window.dispatchEvent(new CustomEvent('gnat:signed-out', { detail: who }));
    }
    throw new ApiError(res.status, (data as any).error ?? `Request failed (${res.status})`, (data as any).details);
  }
  return data as T;
}

export const api = {
  pub: {
    get: <T>(p: string) => request<T>('GET', p, undefined, 'none'),
    post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}, 'none'),
  },
  chair: {
    get: <T>(p: string) => request<T>('GET', p, undefined, 'chair'),
    post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}, 'chair'),
    put: <T>(p: string, b: unknown) => request<T>('PUT', p, b, 'chair'),
    patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b, 'chair'),
    del: <T>(p: string) => request<T>('DELETE', p, undefined, 'chair'),
  },
  admin: {
    get: <T>(p: string) => request<T>('GET', p, undefined, 'admin'),
    post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}, 'admin'),
    put: <T>(p: string, b: unknown) => request<T>('PUT', p, b, 'admin'),
    patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b, 'admin'),
    del: <T>(p: string) => request<T>('DELETE', p, undefined, 'admin'),
  },
};

/** Downloads an authenticated admin file (xlsx/csv/pdf). */
export async function adminDownload(path: string, fallbackName: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${adminMem?.token ?? ''}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as any).error ?? 'Download failed');
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

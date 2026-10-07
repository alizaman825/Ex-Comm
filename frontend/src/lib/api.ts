// Thin fetch wrapper for the Ex-Comm API. Requests go to /api/* on this origin (proxied to the
// Express backend by next.config.mjs), so the httpOnly session cookie is sent automatically.

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** Message for a specific form field, if the server reported one. */
  fieldError(field: string): string | undefined {
    return this.details?.find((d) => d.field === field)?.message;
  }
}

type Params = Record<string, string | number | boolean | string[] | undefined | null>;

export function buildUrl(path: string, params?: Params): string {
  const url = new URL(`/api${path}`, "http://local");
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return `${url.pathname}${url.search}`;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Params;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, { method = "GET", body, params, signal }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; details?: { field: string; message: string }[] } } | null)?.error;
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

/** SWR fetcher: key is [path, params]. */
export const fetcher = <T>([path, params]: [string, Params?]) => api<T>(path, { params });

/** Human-friendly message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.name !== "AbortError") return err.message || fallback;
  return fallback;
}

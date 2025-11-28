const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://192.168.150.230:8000";

function buildQuery(params?: Record<string, any>) {
  if (!params) return "";
  const esc = encodeURIComponent;
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${esc(k)}=${esc(v)}`)
    .join("&");
  return query ? `?${query}` : "";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, any>
): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(params)}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get:   <T>(path: string, params?: Record<string, any>) => 
            request<T>(path, { method: "GET" }, params),

  post:  <T>(path: string, body?: unknown, params?: Record<string, any>) =>
            request<T>(path,
              {
                method: "POST",
                body: body ? JSON.stringify(body) : undefined,
              },
              params
            ),

  put:   <T>(path: string, body?: unknown, params?: Record<string, any>) =>
            request<T>(path,
              {
                method: "PUT",
                body: body ? JSON.stringify(body) : undefined,
              },
              params
            ),

  del:   <T>(path: string, params?: Record<string, any>) =>
            request<T>(path, { method: "DELETE" }, params),
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") ?? "";
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  login:       (u: string, p: string) =>
    apiFetch<{access_token: string}>("/auth/login", {method:"POST", body: JSON.stringify({username:u,password:p})}),
  account:     () => apiFetch<any>("/account"),
  positions:   () => apiFetch<any[]>("/positions"),
  trades:      (params?: string) => apiFetch<any[]>(`/trades${params ?? ""}`),
  signals:     () => apiFetch<any[]>("/signals"),
  performance: () => apiFetch<any>("/performance"),
  snapshots:   (hours=24) => apiFetch<any[]>(`/snapshots?hours=${hours}`),
  botState:    () => apiFetch<any>("/bot"),
  updateBot:   (data: any) => apiFetch<any>("/bot", {method:"POST", body:JSON.stringify(data)}),
  killSwitch:  () => apiFetch<any>("/bot/kill", {method:"POST"}),
  mlMetrics:   () => apiFetch<any[]>("/ml/metrics"),
};

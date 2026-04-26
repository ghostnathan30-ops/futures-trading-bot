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
  if (res.status === 401 || res.status === 403) {
    if (window.location.pathname !== "/login") {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return new Promise(() => {}); // halt — redirect is in flight
    }
    throw new Error(`API error ${res.status}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? body?.message ?? "";
    throw new Error(`API error ${res.status}${detail ? ": " + detail : ""}`);
  }
  return res.json();
}

export interface BacktestRun {
  run_id: string;
  instrument: string;
  start_date: string;
  end_date: string;
  initial_equity: number;
  final_equity: number | null;
  total_return: number | null;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown: number | null;
  calmar: number | null;
  profit_factor: number | null;
  total_trades: number | null;
  wins: number | null;
  losses: number | null;
  win_rate: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  expectancy: number | null;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  equity_curve?: { ts: string; equity: number }[];
}

export interface BacktestRunRequest {
  instrument: string;
  start_date: string;
  end_date: string;
  initial_equity: number;
  timeframe?: "1h" | "1d";
}

export const api = {
  health:      () => apiFetch<{status: string}>("/health"),
  login:       (u: string, p: string) =>
    apiFetch<{access_token: string}>("/auth/login", {method:"POST", body: JSON.stringify({username:u,password:p})}),
  account:     () => apiFetch<any>("/account"),
  positions:   () => apiFetch<any[]>("/positions"),
  trades:      (params?: string) => apiFetch<any[]>(`/trades${params ?? ""}`),
  signals:     () => apiFetch<any[]>("/signals"),
  performance: () => apiFetch<any>("/performance"),
  snapshots:   (hours=24) => apiFetch<any[]>(`/snapshots?hours=${hours}`),
  chartBars: (instrument: string, timeframe: string, limit = 200) =>
    apiFetch<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]>(
      `/charts/bars?instrument=${instrument}&timeframe=${timeframe}&limit=${limit}`
    ),
  botState:    () => apiFetch<any>("/bot"),
  updateBot:   (data: any) => apiFetch<any>("/bot", {method:"POST", body:JSON.stringify(data)}),
  killSwitch:  () => apiFetch<any>("/bot/kill", {method:"POST"}),
  mlMetrics:   () => apiFetch<any[]>("/ml/metrics"),
  backtest: {
    run:    (req: BacktestRunRequest) =>
      apiFetch<{run_id: string; status: string}>("/backtest/run", {method: "POST", body: JSON.stringify(req)}),
    runs:   (instrument?: string) =>
      apiFetch<BacktestRun[]>(`/backtest/runs${instrument ? `?instrument=${instrument}` : ""}`),
    get:    (runId: string) =>
      apiFetch<BacktestRun>(`/backtest/runs/${runId}`),
    trades: (runId: string) =>
      apiFetch<any[]>(`/backtest/runs/${runId}/trades`),
  },
};

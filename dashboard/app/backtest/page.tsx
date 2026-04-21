"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { api, BacktestRun } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C", blue: "#4488FF",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", borderMid: "#232B42",
  text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

// ─── Shared primitives ───────────────────────────────────────────────────────

function QCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", ...style }}>{children}</div>;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: "11px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 2, height: 12, background: C.gold, borderRadius: 1 }} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{title}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: C.green, running: C.gold, pending: C.muted, failed: C.red,
  };
  const c = colors[status] ?? C.muted;
  return (
    <span style={{
      fontFamily: "JetBrains Mono", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 3,
      textTransform: "uppercase",
      background: `${c}18`, border: `1px solid ${c}40`, color: c,
    }}>
      {status}
    </span>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, color, i }: { label: string; value: string; color: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: "1px solid rgba(201,168,76,0.25)",
        borderRadius: 8,
        padding: "16px 18px",
        boxShadow: "inset 0 1px 0 rgba(201,168,76,0.04)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </motion.div>
  );
}

// ─── Equity curve ─────────────────────────────────────────────────────────────

function EquityCurve({ data, baseline }: { data: { ts: string; equity: number }[]; baseline: number }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 12, letterSpacing: "0.05em" }}>
        No equity curve data
      </div>
    );
  }

  const formatted = data.map(d => ({
    t:     new Date(d.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: Number(d.equity),
  }));
  const values  = formatted.map(d => d.value);
  const min     = Math.min(...values);
  const max     = Math.max(...values);
  const pad     = (max - min) * 0.08 || 1000;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 10, right: 16, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="btGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.gold} stopOpacity={0.22} />
            <stop offset="60%"  stopColor={C.gold} stopOpacity={0.05} />
            <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t"
          tick={{ fill: C.dim, fontSize: 10, fontFamily: "JetBrains Mono" }}
          tickLine={false} axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tick={{ fill: C.dim, fontSize: 10, fontFamily: "JetBrains Mono" }}
          tickLine={false} axisLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          width={52}
        />
        <ReferenceLine y={baseline} stroke={C.borderMid} strokeDasharray="3 3" strokeWidth={1} />
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const v = Number(payload[0]?.value ?? 0);
            const diff = v - baseline;
            return (
              <div style={{ background: "#0D1018", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{payload[0]?.payload?.t}</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 700, color: C.gold }}>
                  ${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: diff >= 0 ? C.green : C.red, marginTop: 3 }}>
                  {diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
              </div>
            );
          }}
        />
        <Area
          type="monotone" dataKey="value"
          stroke={C.gold} strokeWidth={2}
          fill="url(#btGold)" dot={false}
          activeDot={{ r: 4, fill: C.gold, stroke: C.surface, strokeWidth: 2 }}
          isAnimationActive animationDuration={1200} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Trade table ──────────────────────────────────────────────────────────────

const TRADE_COLS = ["Entry", "Exit", "Side", "Entry Px", "Exit Px", "P&L", "Score", "Regime", "Exit Reason"];

function TradeTable({ trades }: { trades: any[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {TRADE_COLS.map(h => (
              <th key={h} style={{
                padding: "9px 14px", textAlign: "left", fontSize: 9,
                fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                color: C.dim, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 ? (
            <tr>
              <td colSpan={TRADE_COLS.length} style={{ textAlign: "center", padding: "40px", color: C.dim, fontSize: 12 }}>
                No trades generated for this period
              </td>
            </tr>
          ) : trades.map((t, i) => {
            const pnl = Number(t.pnl ?? 0);
            return (
              <tr key={t.id ?? i}
                style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.raised)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "8px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>
                  {new Date(t.entry_ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                </td>
                <td style={{ padding: "8px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>
                  {t.exit_ts ? new Date(t.exit_ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  <span style={{
                    fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 3,
                    background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.25)", color: C.green,
                  }}>
                    {t.side ?? "LONG"}
                  </span>
                </td>
                <td style={{ padding: "8px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.text }}>
                  {Number(t.entry_price).toFixed(2)}
                </td>
                <td style={{ padding: "8px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.text }}>
                  {Number(t.exit_price).toFixed(2)}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700, color: pnl >= 0 ? C.green : C.red }}>
                    {pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toFixed(0)}
                  </span>
                </td>
                <td style={{ padding: "8px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>
                  {t.confluence_score ?? "—"}/6
                </td>
                <td style={{ padding: "8px 14px" }}>
                  {t.regime_state ? (
                    <span style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", padding: "2px 7px",
                      borderRadius: 3, textTransform: "uppercase", background: C.raised,
                      border: `1px solid ${C.borderMid}`, color: C.muted,
                    }}>
                      {t.regime_state}
                    </span>
                  ) : <span style={{ color: C.dim, fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: "8px 14px", fontSize: 11, color: C.dim }}>{t.exit_reason ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const fmt    = (v: number | null, sfx = "", dec = 2) => v == null ? "—" : `${v.toFixed(dec)}${sfx}`;
const fmtPct = (v: number | null) => v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
const fmtUSD = (v: number | null) => v == null ? "—" : `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const TIMEFRAME_DEFAULTS: Record<string, { start: string; end: string; label: string; hint: string }> = {
  "1h": { start: "2024-06-01", end: "2026-04-01", label: "1H · 2yr",  hint: "~11,000 hourly bars · Apr 2024 → now" },
  "1d": { start: "2015-01-01", end: "2026-04-01", label: "1D · 25yr", hint: "~6,400 daily bars · Sep 2000 → now · multiple full cycles" },
};

export default function BacktestPage() {
  const [instrument,    setInstrument]    = useState("ES");
  const [timeframe,     setTimeframe]     = useState<"1h" | "1d">("1h");
  const [startDate,     setStartDate]     = useState(TIMEFRAME_DEFAULTS["1h"].start);
  const [endDate,       setEndDate]       = useState(TIMEFRAME_DEFAULTS["1h"].end);
  const [initialEquity, setInitialEquity] = useState(100000);
  const [submitting,    setSubmitting]    = useState(false);
  const [runError,      setRunError]      = useState<string | null>(null);
  const [tradeError,    setTradeError]    = useState<string | null>(null);
  const [runListError,  setRunListError]  = useState<string | null>(null);

  const [runList,  setRunList]  = useState<BacktestRun[]>([]);
  const [selected, setSelected] = useState<BacktestRun | null>(null);
  const [trades,   setTrades]   = useState<any[]>([]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load run history on mount
  useEffect(() => {
    api.backtest.runs()
      .then(setRunList)
      .catch((e: any) => setRunListError(e?.message ?? "Failed to load run history"));
  }, []);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const run = await api.backtest.get(runId);
        setSelected(run);
        setRunList(prev => prev.map(r => r.run_id === runId ? { ...r, ...run } : r));
        if (run.status === "completed" || run.status === "failed") {
          stopPolling();
          setSubmitting(false);
          if (run.status === "completed") {
            api.backtest.trades(runId)
              .then(t => { setTrades(t); setTradeError(null); })
              .catch((e: any) => setTradeError(e?.message ?? "Failed to load trade list"));
          }
        }
      } catch (e: any) {
        stopPolling();
        setSubmitting(false);
        setRunError("Lost connection while polling — " + (e?.message ?? "check that the API is running"));
      }
    }, 3000);
  }, []);

  function handleTimeframeChange(tf: "1h" | "1d") {
    setTimeframe(tf);
    setStartDate(TIMEFRAME_DEFAULTS[tf].start);
    setEndDate(TIMEFRAME_DEFAULTS[tf].end);
  }

  async function handleRun() {
    setSubmitting(true);
    setRunError(null);
    setSelected(null);
    setTrades([]);
    try {
      const { run_id } = await api.backtest.run({ instrument, start_date: startDate, end_date: endDate, initial_equity: initialEquity, timeframe });
      const pending: BacktestRun = {
        run_id, instrument, start_date: startDate, end_date: endDate,
        initial_equity: initialEquity, final_equity: null, total_return: null,
        sharpe: null, sortino: null, max_drawdown: null, calmar: null,
        profit_factor: null, total_trades: null, wins: null, losses: null,
        win_rate: null, avg_win: null, avg_loss: null, expectancy: null,
        status: "pending", created_at: new Date().toISOString(),
      };
      setRunList(prev => [pending, ...prev]);
      setSelected(pending);
      startPolling(run_id);
    } catch (err: any) {
      setSubmitting(false);
      setRunError(err?.message ?? "Failed to start backtest — check that the API and database are running.");
    }
  }

  async function selectRun(run: BacktestRun) {
    stopPolling();
    setTrades([]);
    setTradeError(null);
    if (run.status === "completed") {
      try {
        const [full, trds] = await Promise.all([
          api.backtest.get(run.run_id),
          api.backtest.trades(run.run_id),
        ]);
        setSelected(full);
        setTrades(trds);
      } catch (e: any) {
        setSelected(run);
        setTradeError(e?.message ?? "Failed to load run details");
      }
    } else if (run.status === "running" || run.status === "pending") {
      setSelected(run);
      setSubmitting(true);
      startPolling(run.run_id);
    } else {
      setSelected(run);
    }
  }

  const s = selected;
  const metrics = s?.status === "completed" ? [
    { label: "Total Return",   value: fmtPct(s.total_return),                           color: (s.total_return ?? 0) >= 0 ? C.green : C.red },
    { label: "Sharpe Ratio",   value: fmt(s.sharpe),                                    color: (s.sharpe ?? 0) >= 1 ? C.green : C.muted },
    { label: "Sortino Ratio",  value: fmt(s.sortino),                                   color: (s.sortino ?? 0) >= 1 ? C.green : C.muted },
    { label: "Max Drawdown",   value: s.max_drawdown != null ? `-${(s.max_drawdown * 100).toFixed(2)}%` : "—", color: C.red },
    { label: "Win Rate",       value: fmtPct(s.win_rate),                               color: (s.win_rate ?? 0) >= 0.5 ? C.green : C.muted },
    { label: "Profit Factor",  value: fmt(s.profit_factor),                             color: (s.profit_factor ?? 0) >= 1.5 ? C.green : C.muted },
    { label: "Total Trades",   value: s.total_trades != null ? String(s.total_trades) : "—", color: C.text },
    { label: "Expectancy",     value: s.expectancy != null ? fmtUSD(s.expectancy) + "/trade" : "—", color: (s.expectancy ?? 0) >= 0 ? C.green : C.red },
  ] : [];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 5,
    background: C.raised, border: `1px solid ${C.border}`,
    color: C.text, fontSize: 12, fontFamily: "JetBrains Mono",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 3, height: 20, background: C.gold, borderRadius: 2 }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Backtesting</span>
        <span style={{ fontSize: 11, color: C.dim }}>Walk-forward historical simulation · real yfinance data · {TIMEFRAME_DEFAULTS[timeframe].hint}</span>
      </div>

      {/* Top row: controls + history */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Controls card */}
        <QCard style={{ flex: "0 0 320px" }}>
          <SectionHeader title="Run Configuration" />
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, marginBottom: 7 }}>INSTRUMENT</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["ES", "NQ", "GC"].map(ins => (
                  <button key={ins} onClick={() => setInstrument(ins)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 5, cursor: "pointer",
                    fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700,
                    transition: "all 0.12s",
                    background: instrument === ins ? "rgba(201,168,76,0.12)" : C.raised,
                    border: `1px solid ${instrument === ins ? "rgba(201,168,76,0.4)" : C.border}`,
                    color: instrument === ins ? C.gold : C.muted,
                  }}>{ins}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, marginBottom: 7 }}>TIMEFRAME / DATA DEPTH</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["1h", "1d"] as const).map(tf => (
                  <button key={tf} onClick={() => handleTimeframeChange(tf)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 5, cursor: "pointer",
                    fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700,
                    transition: "all 0.12s",
                    background: timeframe === tf ? "rgba(68,136,255,0.12)" : C.raised,
                    border: `1px solid ${timeframe === tf ? "rgba(68,136,255,0.4)" : C.border}`,
                    color: timeframe === tf ? C.blue : C.muted,
                  }}>{TIMEFRAME_DEFAULTS[tf].label}</button>
                ))}
              </div>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>
                {TIMEFRAME_DEFAULTS[timeframe].hint}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, marginBottom: 7 }}>START DATE</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, marginBottom: 7 }}>END DATE</div>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, marginBottom: 7 }}>INITIAL EQUITY ($)</div>
              <input type="number" value={initialEquity} onChange={e => setInitialEquity(Number(e.target.value))} style={inputStyle} />
            </div>

            <button onClick={handleRun} disabled={submitting} style={{
              width: "100%", padding: "11px 0", borderRadius: 6,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.12em", transition: "all 0.15s",
              background: submitting ? "rgba(201,168,76,0.05)" : "rgba(201,168,76,0.12)",
              border: `1px solid ${submitting ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.4)"}`,
              color: submitting ? C.muted : C.gold,
            }}>
              {submitting ? "RUNNING..." : "RUN BACKTEST"}
            </button>

            {submitting && (
              <div style={{ fontSize: 10, color: C.dim, textAlign: "center", letterSpacing: "0.04em", lineHeight: 1.6 }}>
                Downloading data + simulating...<br />
                <span style={{ color: C.dim }}>~2–3 min · auto-refreshes every 3s</span>
              </div>
            )}
            {runError && (
              <div style={{
                padding: "8px 12px", borderRadius: 5,
                background: "rgba(255,58,92,0.07)",
                border: "1px solid rgba(255,58,92,0.25)",
                fontSize: 11, color: C.red, lineHeight: 1.5,
              }}>
                {runError}
              </div>
            )}
          </div>
        </QCard>

        {/* Run history */}
        <QCard style={{ flex: 1 }}>
          <SectionHeader title="Run History" />
          <div style={{ overflowY: "auto", maxHeight: 400 }}>
            {runListError ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: C.red, fontSize: 11 }}>
                {runListError}
              </div>
            ) : runList.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", color: C.dim, fontSize: 12 }}>
                No backtest runs yet — configure and run above
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Instrument", "Period", "Return", "Sharpe", "Win Rate", "Trades", "Status"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runList.map(run => (
                    <tr key={run.run_id}
                      onClick={() => selectRun(run)}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        cursor: "pointer",
                        background: selected?.run_id === run.run_id ? "rgba(201,168,76,0.04)" : "transparent",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={e => { if (selected?.run_id !== run.run_id) (e.currentTarget as HTMLElement).style.background = C.raised; }}
                      onMouseLeave={e => { if (selected?.run_id !== run.run_id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 12, color: C.gold }}>{run.instrument}</td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: C.muted }}>{run.start_date} → {run.end_date}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, color: run.total_return != null ? (run.total_return >= 0 ? C.green : C.red) : C.dim }}>
                        {run.total_return != null ? `${run.total_return >= 0 ? "+" : ""}${(run.total_return * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>{run.sharpe?.toFixed(2) ?? "—"}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>
                        {run.win_rate != null ? `${(run.win_rate * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>{run.total_trades ?? "—"}</td>
                      <td style={{ padding: "9px 14px" }}><StatusBadge status={run.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </QCard>
      </div>

      {/* Results section */}
      <AnimatePresence mode="wait">
        {s?.status === "completed" && (
          <motion.div key={s.run_id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Result label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: C.gold }}>{s.instrument}</span>
              <span style={{
                fontFamily: "JetBrains Mono", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                padding: "2px 7px", borderRadius: 3, textTransform: "uppercase",
                background: "rgba(68,136,255,0.1)", border: "1px solid rgba(68,136,255,0.3)", color: C.blue,
              }}>{timeframe}</span>
              <span style={{ fontSize: 11, color: C.dim }}>{s.start_date} → {s.end_date}</span>
              <span style={{ fontSize: 11, color: C.dim }}>·</span>
              <span style={{ fontSize: 11, color: C.dim }}>{fmtUSD(s.initial_equity)} initial equity</span>
              <span style={{ fontSize: 11, color: C.dim }}>→</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: (s.total_return ?? 0) >= 0 ? C.green : C.red }}>
                {fmtUSD(s.final_equity)}
              </span>
            </div>

            {/* Metric grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {metrics.map((m, i) => <MetricCard key={m.label} {...m} i={i} />)}
            </div>

            {/* Equity curve */}
            <QCard>
              <SectionHeader title={`Equity Curve — ${s.instrument} · ${s.start_date} → ${s.end_date}`} />
              <div style={{ padding: "16px 8px 8px" }}>
                <EquityCurve data={s.equity_curve ?? []} baseline={s.initial_equity} />
              </div>
            </QCard>

            {/* Trade list */}
            <QCard>
              <SectionHeader title={`Trade List — ${trades.length} trades · ${s.wins ?? 0}W / ${s.losses ?? 0}L`} />
              {tradeError ? (
                <div style={{ padding: "16px", color: C.red, fontSize: 11, textAlign: "center" }}>
                  {tradeError}
                </div>
              ) : <TradeTable trades={trades} />}
            </QCard>
          </motion.div>
        )}

        {(s?.status === "running" || s?.status === "pending") && (
          <motion.div key="in-progress"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background: C.surface, border: `1px solid rgba(201,168,76,0.15)`,
              borderRadius: 8, padding: "36px 24px", textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.gold, letterSpacing: "0.08em", marginBottom: 8 }}>
              BACKTEST IN PROGRESS
            </div>
            <div style={{ fontSize: 11, color: C.dim }}>
              {s.instrument} · {s.start_date} → {s.end_date} · polling every 3s
            </div>
          </motion.div>
        )}

        {s?.status === "failed" && (
          <motion.div key="failed"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background: C.surface, border: `1px solid rgba(255,58,92,0.3)`,
              borderRadius: 8, padding: "36px 24px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: C.red, letterSpacing: "0.05em" }}>
              Backtest failed — check the bot logs for details
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

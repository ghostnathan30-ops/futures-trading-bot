"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

function QCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 2, height: 12, background: C.gold, borderRadius: 1 }} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{title}</span>
    </div>
  );
}

function StatCard({ label, value, color, i }: { label: string; value: string; color: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `1px solid rgba(201,168,76,0.25)`,
        borderRadius: 8,
        padding: "16px 18px",
        boxShadow: "inset 0 1px 0 rgba(201,168,76,0.04)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{value}</div>
    </motion.div>
  );
}

export default function PerformancePage() {
  const [perf, setPerf]     = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.performance().catch(() => null), api.trades("?limit=500").catch(() => [])])
      .then(([p, t]) => { setPerf(p); setTrades(t ?? []); setLoading(false); });
  }, []);

  const byInstrument = ["ES", "NQ", "GC"].map(ins => {
    const t = trades.filter(x => x.instrument === ins);
    const wins = t.filter(x => x.pnl > 0).length;
    const pnl  = t.reduce((s, x) => s + Number(x.pnl), 0);
    return { ins, count: t.length, wins, pnl };
  });
  const maxAbs = Math.max(...byInstrument.map(b => Math.abs(b.pnl)), 1);

  const monthlyMap: Record<string, number> = {};
  trades.forEach(t => {
    if (!t.exit_ts) return;
    const k = new Date(t.exit_ts).toLocaleString("default", { month: "short", year: "2-digit" });
    monthlyMap[k] = (monthlyMap[k] ?? 0) + Number(t.pnl);
  });
  const months = Object.entries(monthlyMap).slice(-12);
  const maxMonthAbs = Math.max(...months.map(([, v]) => Math.abs(v)), 1);

  const statCards = perf ? [
    { label: "Total P&L",     value: `$${Number(perf.total_pnl).toLocaleString()}`,  color: perf.total_pnl >= 0 ? C.green : C.red },
    { label: "Win Rate",      value: `${(perf.win_rate * 100).toFixed(1)}%`,          color: perf.win_rate >= 0.5 ? C.green : C.red },
    { label: "Sharpe Ratio",  value: perf.sharpe?.toFixed(2) ?? "—",                  color: (perf.sharpe ?? 0) >= 1 ? C.green : C.muted },
    { label: "Profit Factor", value: perf.profit_factor?.toFixed(2) ?? "—",           color: (perf.profit_factor ?? 0) >= 1.5 ? C.green : C.muted },
    { label: "Total Trades",  value: String(perf.total_trades ?? 0),                  color: C.text },
    { label: "Winners",       value: String(perf.wins ?? 0),                          color: C.green },
    { label: "Avg Win",       value: `$${Number(perf.avg_win ?? 0).toFixed(0)}`,      color: C.green },
    { label: "Avg Loss",      value: `-$${Number(perf.avg_loss ?? 0).toFixed(0)}`,    color: C.red },
  ] : [];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: C.dim, fontSize: 12, letterSpacing: "0.05em" }}>
        Loading performance data…
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {statCards.length > 0
          ? statCards.map((s, i) => <StatCard key={s.label} {...s} i={i} />)
          : Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer-bg" style={{ height: 80, borderRadius: 8 }} />
            ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Monthly P&L */}
        <QCard>
          <SectionHeader title="Monthly P&L" />
          <div style={{ padding: "16px" }}>
            {months.length > 0 ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
                {months.map(([month, pnl]) => {
                  const h = Math.max((Math.abs(pnl) / maxMonthAbs) * 100, 4);
                  return (
                    <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: pnl >= 0 ? C.green : C.red }}>
                        {pnl >= 0 ? "+" : ""}{(pnl / 1000).toFixed(1)}k
                      </div>
                      <div style={{
                        width: "100%", height: `${h}%`, borderRadius: "3px 3px 0 0",
                        background: pnl >= 0 ? "rgba(0,229,160,0.2)" : "rgba(255,58,92,0.2)",
                        borderTop: `2px solid ${pnl >= 0 ? C.green : C.red}`,
                      }} />
                      <div style={{ fontSize: 9, color: C.dim }}>{month}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 12 }}>
                No monthly data yet
              </div>
            )}
          </div>
        </QCard>

        {/* Instrument breakdown */}
        <QCard>
          <SectionHeader title="Instrument Breakdown" />
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
            {byInstrument.map(({ ins, count, wins, pnl }) => (
              <div key={ins}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: C.text }}>{ins}</span>
                    <span style={{ fontSize: 10, color: C.dim }}>
                      {count} trades{count > 0 ? ` · ${(wins / count * 100).toFixed(0)}% win` : ""}
                    </span>
                  </div>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: pnl >= 0 ? C.green : count === 0 ? C.dim : C.red }}>
                    {count === 0 ? "—" : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(0)}`}
                  </span>
                </div>
                <div style={{ height: 4, background: C.raised, borderRadius: 2, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.abs(pnl) / maxAbs) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    style={{ height: "100%", borderRadius: 2, background: pnl >= 0 ? C.green : C.red }}
                  />
                </div>
              </div>
            ))}
          </div>
        </QCard>
      </div>
    </motion.div>
  );
}

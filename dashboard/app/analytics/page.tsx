"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from "recharts";
import { api } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C", blue: "#4488FF",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

function QCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, ...style }}>{children}</div>;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 2, height: 12, background: C.gold, borderRadius: 1 }} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{title}</span>
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0D1018", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px" }}>
      {payload.map((p: any) => (
        <div key={p.name} style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.gold }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => { api.trades("?limit=500").then(setTrades).catch(() => {}); }, []);

  // P&L distribution
  const pnlBins = Array.from({ length: 20 }, (_, i) => ({ bin: i, count: 0, label: "" }));
  if (trades.length) {
    const pnls = trades.map(t => Number(t.pnl));
    const min = Math.min(...pnls), max = Math.max(...pnls);
    const step = (max - min) / 20 || 1;
    pnls.forEach(p => {
      const i = Math.min(19, Math.floor((p - min) / step));
      pnlBins[i].count++;
      pnlBins[i].label = `${(min + i * step).toFixed(0)}`;
    });
  }

  // Win rate by instrument
  const byInstrument = ["ES", "NQ", "GC"].map(ins => {
    const t = trades.filter(x => x.instrument === ins);
    const wins = t.filter(x => x.pnl > 0).length;
    return { ins, winRate: t.length ? wins / t.length * 100 : 0, count: t.length };
  });

  // Scatter: ML confidence vs P&L
  const scatter = trades.slice(0, 200).map(t => ({
    confidence: Number(t.ml_confidence ?? 0) * 100,
    pnl: Number(t.pnl),
  }));

  // Regime stats
  const regimeStats = ["trending", "ranging", "volatile"].map(regime => {
    const rt = trades.filter(t => t.regime_state === regime);
    const wins = rt.filter(t => t.pnl > 0).length;
    const pnl  = rt.reduce((s, t) => s + Number(t.pnl), 0);
    return { regime, count: rt.length, wins, pnl };
  });

  const hasData = trades.length > 0;
  const EmptyState = ({ h = 180 }: { h?: number }) => (
    <div style={{ height: h, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 12, letterSpacing: "0.05em" }}>
      No trade data yet — run the bot to populate analytics
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* P&L Distribution */}
        <QCard>
          <SectionHeader title="P&L Distribution" />
          <div style={{ padding: "16px 8px 8px" }}>
            {hasData ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pnlBins} barSize={10}>
                  <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: C.dim, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {pnlBins.map((entry, i) => (
                      <Cell key={i} fill={Number(entry.label) >= 0 ? "rgba(0,229,160,0.5)" : "rgba(255,58,92,0.5)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </div>
        </QCard>

        {/* Win Rate by Instrument */}
        <QCard>
          <SectionHeader title="Win Rate by Instrument" />
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
            {byInstrument.map(({ ins, winRate, count }) => (
              <div key={ins}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, color: C.text }}>{ins}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>
                    {winRate.toFixed(1)}% ({count} trades)
                  </span>
                </div>
                <div style={{ height: 6, background: C.raised, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                  {/* 50% marker */}
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.dim }} />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${winRate}%` }}
                    transition={{ duration: 0.9, delay: 0.2 }}
                    style={{ height: "100%", borderRadius: 3, background: winRate >= 50 ? C.green : C.red }}
                  />
                </div>
              </div>
            ))}
          </div>
        </QCard>
      </div>

      {/* ML Confidence vs Outcome */}
      <QCard>
        <SectionHeader title="ML Confidence vs Trade Outcome" />
        <div style={{ padding: "8px" }}>
          {scatter.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <XAxis dataKey="confidence" name="ML Conf %" type="number" domain={[0, 100]}
                  tick={{ fill: C.dim, fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false}
                  label={{ value: "ML Confidence %", position: "insideBottom", offset: -2, fill: C.dim, fontSize: 10 }} />
                <YAxis dataKey="pnl" name="P&L $"
                  tick={{ fill: C.dim, fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6 }}
                  labelStyle={{ color: C.dim }} itemStyle={{ color: C.gold, fontFamily: "JetBrains Mono" }} />
                <Scatter data={scatter} fill={C.blue} opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </QCard>

      {/* Performance by Regime */}
      <QCard>
        <SectionHeader title="Performance by Market Regime" />
        <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {regimeStats.map(({ regime, count, wins, pnl }) => (
            <motion.div
              key={regime}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                background: C.raised,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
                {regime}
              </div>
              <div style={{
                fontFamily: "JetBrains Mono", fontSize: 24, fontWeight: 700, color: pnl >= 0 ? C.green : count === 0 ? C.dim : C.red,
                marginBottom: 8,
              }}>
                {count === 0 ? "—" : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(0)}`}
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>
                {count} trades · {count ? `${(wins / count * 100).toFixed(0)}% win` : "no data"}
              </div>
            </motion.div>
          ))}
        </div>
      </QCard>
    </motion.div>
  );
}

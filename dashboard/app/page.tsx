"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import EquityCurve from "@/components/charts/EquityCurve";
import PositionsTable from "@/components/panels/PositionsTable";
import { api } from "@/lib/api";
import { wsClient } from "@/lib/websocket";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", borderMid: "#232B42",
  text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

function QCard({ children, gold, style }: { children: React.ReactNode; gold?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${gold ? "rgba(201,168,76,0.3)" : C.border}`,
      borderTop: gold ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
      borderRadius: 8,
      boxShadow: gold ? "0 0 20px rgba(201,168,76,0.06), inset 0 1px 0 rgba(201,168,76,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.02)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 16px",
      borderBottom: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      <div style={{ width: 2, height: 12, background: C.gold, borderRadius: 1, flexShrink: 0 }} />
      <span className="label" style={{ color: C.muted }}>{title}</span>
    </div>
  );
}

function StatCard({ label, value, sub, i }: { label: string; value: string; sub?: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06, duration: 0.4 }}
    >
      <QCard gold style={{ padding: "16px 18px" }}>
        <div className="label" style={{ marginBottom: 8 }}>{label}</div>
        <div style={{
          fontFamily: "JetBrains Mono",
          fontSize: 22,
          fontWeight: 700,
          color: C.gold,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 6, letterSpacing: "0.05em" }}>{sub}</div>}
      </QCard>
    </motion.div>
  );
}

function SignalRow({ s, i }: { s: any; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.03 }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        borderBottom: `1px solid ${C.border}`,
        gap: 10,
        fontSize: 11,
      }}
    >
      <span style={{ fontFamily: "JetBrains Mono", color: C.dim, width: 40, flexShrink: 0, fontSize: 10 }}>
        {new Date(s.ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
      </span>
      <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, color: C.text, width: 28, flexShrink: 0 }}>{s.instrument}</span>
      <span style={{ fontWeight: 600, color: s.direction === "long" ? C.green : C.red, width: 36, flexShrink: 0, fontSize: 10, letterSpacing: "0.06em" }}>
        {s.direction?.toUpperCase()}
      </span>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        padding: "2px 7px", borderRadius: 3,
        background: s.fired ? "rgba(0,229,160,0.1)" : C.raised,
        color: s.fired ? C.green : C.dim,
        border: `1px solid ${s.fired ? "rgba(0,229,160,0.2)" : C.border}`,
        flexShrink: 0,
      }}>
        {s.fired ? "FIRED" : "SKIP"}
      </span>
      {!s.fired && <span style={{ color: C.dim, fontSize: 10, flex: 1, truncate: "true" }}>{s.skip_reason}</span>}
      <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", color: C.dim, fontSize: 10, flexShrink: 0 }}>
        {s.confluence_score}/6
      </span>
      {s.ml_confidence != null && (
        <span style={{ fontFamily: "JetBrains Mono", color: "#4488FF", fontSize: 10, flexShrink: 0 }}>
          {(s.ml_confidence * 100).toFixed(0)}%
        </span>
      )}
    </motion.div>
  );
}

export default function OverviewPage() {
  const [perf, setPerf]           = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [signals, setSignals]     = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const load = () => {
      api.performance().then(setPerf).catch(() => {});
      api.positions().then(setPositions).catch(() => {});
      api.snapshots(24).then(setSnapshots).catch(() => {});
      api.signals().then(setSignals).catch(() => {});
      api.health().then(() => setConnected(true)).catch(() => setConnected(false));
    };
    load();

    // REST fallback poll — suppressed when WS is live
    const t = setInterval(() => { if (!wsClient.connected) load(); }, 10_000);

    // WS live event handlers
    const onPosition = (data: any) => setPositions(data);
    const onAccount  = (data: any) => setPerf((prev: any) => ({ ...prev, ...data }));
    const onSignal   = (data: any) => setSignals((prev: any) => [data, ...prev].slice(0, 50));

    wsClient.on("position_update", onPosition);
    wsClient.on("account_update",  onAccount);
    wsClient.on("signal_fired",    onSignal);

    const unsubStatus = wsClient.onStatusChange((c) => {
      setConnected(c);
      if (c) load(); // refresh immediately when WS reconnects
    });

    wsClient.connect();

    return () => {
      clearInterval(t);
      wsClient.off("position_update", onPosition);
      wsClient.off("account_update",  onAccount);
      wsClient.off("signal_fired",    onSignal);
      unsubStatus();
    };
  }, []);

  const stats = [
    { label: "Win Rate",      value: perf ? `${(perf.win_rate * 100).toFixed(1)}%` : "—" },
    { label: "Sharpe Ratio",  value: perf?.sharpe?.toFixed(2) ?? "—" },
    { label: "Profit Factor", value: perf?.profit_factor?.toFixed(2) ?? "—" },
    { label: "Total Trades",  value: perf ? String(perf.total_trades ?? 0) : "—" },
    { label: "Total P&L",     value: perf ? `$${Number(perf.total_pnl).toLocaleString()}` : "—" },
    { label: "ML Confidence", value: perf ? `${((perf.avg_ml_confidence ?? 0) * 100).toFixed(1)}%` : "—", sub: "avg at entry" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Offline banner */}
      {!connected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{
            background: "rgba(255,58,92,0.06)",
            border: "1px solid rgba(255,58,92,0.2)",
            borderRadius: 6,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span className="pulse-dot red-dot" />
          <span style={{ color: "#FF3A5C", fontSize: 12, fontWeight: 500 }}>API server offline</span>
          <span style={{ color: C.muted, fontSize: 11 }}>—</span>
          <span style={{ color: C.muted, fontSize: 11 }}>
            Run: <code style={{ fontFamily: "JetBrains Mono", background: C.raised, padding: "1px 6px", borderRadius: 3, color: C.gold }}>uvicorn main:app --port 8000</code>
          </span>
        </motion.div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        {stats.map((s, i) => <StatCard key={s.label} {...s} i={i} />)}
      </div>

      {/* Equity curve */}
      <QCard>
        <SectionHeader title="Equity Curve — 24h" />
        <div style={{ padding: "12px 4px 0" }}>
          <EquityCurve data={snapshots} />
        </div>
      </QCard>

      {/* Positions + Signal feed */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <QCard>
          <SectionHeader title={<>Open Positions <span style={{ color: C.dim, fontWeight: 400, marginLeft: 6 }}>({positions.length})</span></>} />
          <div style={{ padding: 4 }}>
            <PositionsTable positions={positions} />
          </div>
        </QCard>

        <QCard>
          <SectionHeader title="Live Signal Feed" />
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {signals.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: C.dim, fontSize: 12, letterSpacing: "0.05em" }}>
                Strategy evaluates every 60s — signals appear here in real time
              </div>
            ) : signals.slice(0, 20).map((s, i) => <SignalRow key={i} s={s} i={i} />)}
          </div>
        </QCard>
      </div>
    </motion.div>
  );
}

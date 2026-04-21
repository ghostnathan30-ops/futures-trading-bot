"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", blue: "#4488FF",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

function CircleProgress({ value, size = 72 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.raised} strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={C.gold} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );
}

const STEPS = [
  { n: 1, text: "Historical bars downloaded from IBKR + yfinance (up to 5 years of 15m data)" },
  { n: 2, text: "Feature engineering: 11 features — EMA crosses, VWAP distance, RSI, MACD, ATR ratio, z-score, order flow delta" },
  { n: 3, text: "Walk-forward cross-validation (5 folds, time-series split — zero lookahead bias)" },
  { n: 4, text: "LightGBM trained to predict: will this signal produce >0.5 ATR profit in next 3 bars?" },
  { n: 5, text: "Live inference: each signal scored 0–1. Only signals above threshold (default 65%) execute" },
  { n: 6, text: "Model retrained every Sunday night automatically with latest market data" },
];

export default function MLPage() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.mlMetrics().then(m => { setMetrics(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Model cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shimmer-bg" style={{ height: 220, borderRadius: 8 }} />
            ))
          : metrics.length === 0
          ? (
            <div style={{
              gridColumn: "1 / -1",
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "40px 24px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>⬡</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>No models trained yet</div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
                Run the bot with <code style={{ fontFamily: "JetBrains Mono", color: C.gold, background: C.raised, padding: "1px 6px", borderRadius: 3 }}>ml_enabled=true</code> to trigger initial training
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>Training takes ~5–10 minutes per instrument on first run</div>
            </div>
          )
          : metrics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                background: C.surface,
                border: `1px solid rgba(201,168,76,0.2)`,
                borderTop: `1px solid ${C.gold}`,
                borderRadius: 8,
                padding: "20px",
                boxShadow: "0 0 20px rgba(201,168,76,0.04), inset 0 1px 0 rgba(201,168,76,0.06)",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color: C.gold }}>{m.instrument}</div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                    Trained {new Date(m.trained_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <CircleProgress value={m.accuracy ?? 0} size={64} />
                  <div style={{ fontSize: 9, color: C.dim, marginTop: 4, letterSpacing: "0.08em" }}>ACCURACY</div>
                </div>
              </div>

              {/* Metrics */}
              <div>
                <MetricRow label="Precision" value={m.precision_score ? `${(m.precision_score * 100).toFixed(1)}%` : "—"} />
                <MetricRow label="Recall"    value={m.recall_score    ? `${(m.recall_score    * 100).toFixed(1)}%` : "—"} />
                <MetricRow label="F1 Score"  value={m.f1_score?.toFixed(3) ?? "—"} />
                <MetricRow label="Samples"   value={m.n_samples?.toLocaleString() ?? "—"} />
                <MetricRow label="Features"  value={String(m.n_features ?? 11)} />
              </div>
            </motion.div>
          ))
        }
      </div>

      {/* How it works */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 2, height: 12, background: C.gold, borderRadius: 1 }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
            How the ML Filter Works
          </span>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {STEPS.map(({ n, text }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
            >
              <div style={{
                width: 24, height: 24,
                borderRadius: "50%",
                background: "rgba(201,168,76,0.1)",
                border: "1px solid rgba(201,168,76,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                fontFamily: "JetBrains Mono",
                fontSize: 10,
                fontWeight: 700,
                color: C.gold,
              }}>
                {n}
              </div>
              <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, paddingTop: 3 }}>{text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C", blue: "#4488FF",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", borderMid: "#232B42",
  text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

const HEADERS = ["Date", "Instrument", "Side", "Qty", "Entry", "Exit", "P&L", "ML Conf", "Regime", "Exit Reason"];

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 14px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        fontFamily: "JetBrains Mono",
        cursor: "pointer",
        transition: "all 0.15s",
        background: active ? "rgba(201,168,76,0.12)" : C.raised,
        border: `1px solid ${active ? "rgba(201,168,76,0.4)" : C.border}`,
        color: active ? C.gold : C.muted,
      }}
    >
      {label}
    </button>
  );
}

export default function JournalPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.trades(filter ? `?instrument=${filter}` : "?limit=200")
      .then(t => { setTrades(t ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Summary pills */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            padding: "5px 14px",
            background: C.raised,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>TRADES</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.text }}>{trades.length}</span>
          </div>
          <div style={{
            padding: "5px 14px",
            background: C.raised,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>WIN RATE</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: winRate >= 50 ? C.green : C.muted }}>
              {winRate.toFixed(1)}%
            </span>
          </div>
          <div style={{
            padding: "5px 14px",
            background: C.raised,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>NET P&L</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: totalPnl >= 0 ? C.green : C.red }}>
              {totalPnl >= 0 ? "+" : "−"}${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["", "ES", "NQ", "GC"].map(f => (
            <FilterPill key={f} label={f || "ALL"} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}>
        <table className="q-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              {HEADERS.map(h => (
                <th key={h} style={{
                  padding: "9px 14px",
                  textAlign: "left",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: C.dim,
                  borderBottom: `1px solid ${C.border}`,
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {HEADERS.map(h => (
                    <td key={h} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                      <div className="shimmer-bg" style={{ height: 12, borderRadius: 2, width: "60%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} style={{
                  textAlign: "center",
                  padding: "48px 16px",
                  color: C.dim,
                  fontSize: 12,
                  letterSpacing: "0.05em",
                }}>
                  No trades recorded — run the bot to populate the journal
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {trades.map((t, i) => {
                  const pnl = Number(t.pnl ?? 0);
                  const mlConf = t.ml_confidence ? (t.ml_confidence * 100).toFixed(0) + "%" : "—";
                  return (
                    <motion.tr
                      key={t.id ?? i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#0D1018")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>
                        {new Date(t.entry_ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 12, color: C.gold }}>
                        {t.instrument}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{
                          fontFamily: "JetBrains Mono",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 8px",
                          borderRadius: 3,
                          background: t.side === "LONG" ? "rgba(0,229,160,0.1)" : "rgba(255,58,92,0.1)",
                          border: `1px solid ${t.side === "LONG" ? "rgba(0,229,160,0.25)" : "rgba(255,58,92,0.25)"}`,
                          color: t.side === "LONG" ? C.green : C.red,
                        }}>
                          {t.side}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>
                        {t.quantity}
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.text }}>
                        {Number(t.entry_price).toFixed(2)}
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.text }}>
                        {Number(t.exit_price).toFixed(2)}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{
                          fontFamily: "JetBrains Mono",
                          fontSize: 12,
                          fontWeight: 700,
                          color: pnl >= 0 ? C.green : C.red,
                        }}>
                          {pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "JetBrains Mono", fontSize: 11, color: C.blue }}>
                        {mlConf}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        {t.regime_state ? (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: "0.1em",
                            padding: "2px 7px",
                            borderRadius: 3,
                            textTransform: "uppercase",
                            background: C.raised,
                            border: `1px solid ${C.borderMid}`,
                            color: C.muted,
                          }}>
                            {t.regime_state}
                          </span>
                        ) : (
                          <span style={{ color: C.dim, fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: C.dim }}>
                        {t.exit_reason ?? "—"}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

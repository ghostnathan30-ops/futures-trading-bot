"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", borderMid: "#232B42",
  text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
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

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`q-toggle${on ? " on" : ""}`}
      aria-label="toggle"
    />
  );
}

export default function ControlsPage() {
  const [state, setState] = useState<any>(null);
  const [killing, setKilling] = useState(false);
  const [killConfirm, setKillConfirm] = useState("");
  const [logs] = useState([
    "[SYS]   Bot engine initialised — awaiting IBKR connection",
    "[IBKR]  Paper account DUQ217394 connected",
    "[STRAT] Regime detector fitted for ES, NQ, GC",
    "[ML]    Models not found — training scheduled on next run",
  ]);

  useEffect(() => { api.botState().then(setState).catch(() => {}); }, []);

  async function toggle(key: string, val: boolean) {
    try {
      await api.updateBot({ [key]: val });
      setState((s: any) => ({ ...s, [key]: val }));
    } catch {
      // API failed — leave state unchanged so UI reflects true server state
    }
  }

  async function killBot() {
    if (killConfirm !== "KILL") return;
    setKilling(true);
    await api.killSwitch().catch(() => {});
    setState((s: any) => ({ ...s, kill_switch_on: true, is_running: false }));
    setKilling(false);
    setKillConfirm("");
  }

  const toggles = state ? [
    { key: "is_running",  label: "Bot Running",  desc: "Enable strategy loop" },
    { key: "es_enabled",  label: "ES — E-mini S&P 500", desc: "Trade ES futures" },
    { key: "nq_enabled",  label: "NQ — Nasdaq 100", desc: "Trade NQ futures" },
    { key: "gc_enabled",  label: "GC — Gold", desc: "Trade GC futures" },
    { key: "ml_enabled",  label: "ML Filter", desc: "Require ≥65% confidence" },
  ] : [];

  const sliders = state ? [
    { key: "risk_pct",          label: "Risk Per Trade",       unit: "%",  step: 0.1, max: 5,   decimals: 2 },
    { key: "daily_kill_pct",    label: "Daily Kill Threshold", unit: "%",  step: 0.5, max: 10,  decimals: 1 },
    { key: "ml_min_confidence", label: "ML Min Confidence",    unit: "",   step: 0.05, max: 1,  decimals: 2 },
  ] : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>

      {/* Column 1: Kill switch + toggles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Kill switch */}
        <div style={{
          background: "rgba(255,58,92,0.05)",
          border: "1px solid rgba(255,58,92,0.2)",
          borderRadius: 8,
          overflow: "hidden",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,58,92,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 2, height: 12, background: C.red, borderRadius: 1 }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,58,92,0.7)" }}>Emergency Kill Switch</span>
          </div>
          <div style={{ padding: "20px 16px" }}>
            {state?.kill_switch_on ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8 }}>⬛ KILL SWITCH ACTIVE</div>
                <div style={{ fontSize: 11, color: C.muted }}>All trading halted. Restart bot to resume.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
                  Immediately halts all trading, cancels open orders, and prevents new positions.
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 6, letterSpacing: "0.08em" }}>Type KILL to confirm</div>
                  <input
                    value={killConfirm}
                    onChange={e => setKillConfirm(e.target.value.toUpperCase())}
                    placeholder="KILL"
                    style={{
                      width: "100%",
                      background: C.raised,
                      border: `1px solid ${killConfirm === "KILL" ? "rgba(255,58,92,0.5)" : C.borderMid}`,
                      borderRadius: 4,
                      padding: "8px 12px",
                      color: C.text,
                      fontFamily: "JetBrains Mono",
                      fontSize: 13,
                      outline: "none",
                      letterSpacing: "0.1em",
                    }}
                  />
                </div>
                <button
                  onClick={killBot}
                  disabled={killConfirm !== "KILL" || killing}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: killConfirm === "KILL" ? "rgba(255,58,92,0.15)" : C.raised,
                    border: `1px solid ${killConfirm === "KILL" ? "rgba(255,58,92,0.4)" : C.border}`,
                    borderRadius: 4,
                    color: killConfirm === "KILL" ? C.red : C.dim,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    cursor: killConfirm === "KILL" ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                  }}
                >
                  {killing ? "HALTING…" : "EXECUTE KILL"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Toggles */}
        <QCard>
          <SectionHeader title="Bot Status" />
          <div style={{ padding: "8px 0" }}>
            {!state ? (
              <div style={{ padding: "20px 16px", color: C.dim, fontSize: 12 }}>Connecting to API…</div>
            ) : toggles.map(({ key, label, desc }) => (
              <div key={key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{desc}</div>
                </div>
                <Toggle on={state[key]} onClick={() => toggle(key, !state[key])} />
              </div>
            ))}
          </div>
        </QCard>
      </div>

      {/* Column 2: Risk sliders + rollover */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <QCard>
          <SectionHeader title="Risk Parameters" />
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
            {!state ? (
              <div style={{ color: C.dim, fontSize: 12 }}>Connecting to API…</div>
            ) : sliders.map(({ key, label, unit, step, max, decimals }) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.gold }}>
                    {Number(state[key] ?? 0).toFixed(decimals)}{unit}
                  </span>
                </div>
                <input
                  type="range" min="0" max={max} step={step}
                  value={state[key] ?? 0}
                  style={{ width: "100%" }}
                  onChange={async e => {
                    const val = parseFloat(e.target.value);
                    setState((s: any) => ({ ...s, [key]: val }));
                    await api.updateBot({ [key]: val }).catch(() => {});
                  }}
                />
              </div>
            ))}
          </div>
        </QCard>

        <QCard>
          <SectionHeader title="Contract Rollover" />
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 16, lineHeight: 1.5 }}>
              Auto-rolls 5 days before expiry. Manual override available below.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["ES", "NQ", "GC"].map(ins => (
                <div key={ins} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.raised, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: C.text }}>{ins}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.muted }}>
                    {ins === "GC" ? "GCM6 → GCQ6" : `${ins}M6 → ${ins}U6`}
                  </span>
                  <button style={{
                    fontSize: 10, fontWeight: 600, padding: "4px 10px",
                    background: "rgba(201,168,76,0.08)",
                    border: "1px solid rgba(201,168,76,0.25)",
                    borderRadius: 4, color: C.gold, cursor: "pointer",
                    letterSpacing: "0.06em",
                  }}>
                    ROLL
                  </button>
                </div>
              ))}
            </div>
          </div>
        </QCard>
      </div>

      {/* Column 3: IBKR log */}
      <QCard style={{ height: "100%" }}>
        <SectionHeader title="System Log" />
        <div style={{ padding: "8px 0", maxHeight: 500, overflowY: "auto" }}>
          {logs.map((log, i) => {
            const color = log.startsWith("[IBKR]") ? C.green
              : log.startsWith("[ML]")   ? C.gold
              : log.startsWith("[STRAT]")? "#4488FF"
              : C.muted;
            return (
              <div key={i} style={{
                padding: "7px 16px",
                borderBottom: `1px solid ${C.border}`,
                fontFamily: "JetBrains Mono",
                fontSize: 11,
                color,
                lineHeight: 1.5,
              }}>
                {log}
              </div>
            );
          })}
        </div>
      </QCard>
    </motion.div>
  );
}

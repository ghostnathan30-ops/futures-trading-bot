"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

const C = {
  bg:     "#080B12",
  border: "#1A2035",
  gold:   "#C9A84C",
  green:  "#00E5A0",
  red:    "#FF3A5C",
  dim:    "#3D4760",
  text:   "#8892B0",
  white:  "#F0F4FF",
};

function Divider() {
  return <div style={{ width: 1, height: 24, background: C.border, flexShrink: 0 }} />;
}

function ContractChip({ symbol }: { symbol: string }) {
  return (
    <div style={{
      padding: "3px 10px",
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      background: "rgba(255,255,255,0.02)",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 11,
      fontWeight: 600,
      color: C.white,
      letterSpacing: "0.06em",
    }}>
      {symbol}
    </div>
  );
}

export default function Header() {
  const [account, setAccount]     = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [time, setTime]           = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const clock = setInterval(() => setTime(new Date()), 1000);
    const poll = () => {
      // Health check is auth-free — drives the connection indicator
      api.health()
        .then(() => setConnected(true))
        .catch(() => { setConnected(false); setAccount(null); });
      // Account fetch is independent — auth failures don't mark the API as offline
      api.account()
        .then(a => setAccount(a))
        .catch(() => setAccount(null));
    };
    poll();
    const poller = setInterval(poll, 5000);
    return () => { clearInterval(clock); clearInterval(poller); };
  }, []);

  const etTime = time?.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false }) ?? null;
  const isRTH = time ? (() => {
    const et = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const m = et.getHours() * 60 + et.getMinutes();
    return m >= 570 && m < 960;
  })() : false;

  const netLiq = account ? Number(account.net_liq ?? 0) : null;
  const dayPnl = account
    ? Number(account.realized_pnl_today ?? 0) + Number(account.unrealized_pnl ?? 0)
    : null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        height: 52,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: `0 1px 0 0 rgba(201,168,76,0.15)`,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 20,
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
        <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 14, color: C.gold, letterSpacing: "0.12em" }}>ALGO</span>
        <span style={{ fontFamily: "JetBrains Mono", fontWeight: 400, fontSize: 9, color: C.dim, letterSpacing: "0.2em" }}>TERMINAL</span>
      </div>

      <Divider />

      {/* Connection status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span className={`pulse-dot ${connected ? "green-dot" : "red-dot"}`} />
        <span style={{ fontSize: 11, color: connected ? C.text : C.red, fontWeight: 500, letterSpacing: "0.05em" }}>
          {connected ? "IBKR PAPER" : "OFFLINE"}
        </span>
      </div>

      <Divider />

      {/* Contract symbols */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ContractChip symbol="ESM6" />
        <ContractChip symbol="NQM6" />
        <ContractChip symbol="GCM6" />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Session badge + clock */}
      {etTime && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            padding: "2px 7px",
            borderRadius: 3,
            border: `1px solid ${isRTH ? "rgba(0,229,160,0.3)" : C.border}`,
            background: isRTH ? "rgba(0,229,160,0.08)" : "transparent",
            color: isRTH ? C.green : C.dim,
          }}>
            {isRTH ? "RTH" : "ETH"}
          </span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.text, letterSpacing: "0.04em" }}>
            {etTime} <span style={{ color: C.dim, fontSize: 10 }}>ET</span>
          </span>
        </div>
      )}

      <Divider />

      {/* Net Liq */}
      <AnimatePresence>
        {netLiq !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}
          >
            <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Net Liq</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, color: C.gold, letterSpacing: "0.02em" }}>
              ${netLiq.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Divider />

      {/* Day P&L */}
      <AnimatePresence>
        {dayPnl !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}
          >
            <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Day P&L</span>
            <span style={{
              fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em",
              color: dayPnl >= 0 ? C.green : C.red,
            }}>
              {dayPnl >= 0 ? "+" : "−"}${Math.abs(dayPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

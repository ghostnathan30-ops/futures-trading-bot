"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import InstrumentChart from "@/components/charts/InstrumentChart";
import TimeSales from "@/components/panels/TimeSales";
import { wsClient } from "@/lib/websocket";

const C = {
  gold: "#C9A84C",
  surface: "#080B12",
  border: "#1A2035",
  muted: "#8892B0",
};

const INSTRUMENTS = [
  { id: "ES", contract: "ESM6" },
  { id: "NQ", contract: "NQM6" },
  { id: "GC", contract: "GCM6" },
];

export default function TradingPage() {
  const [lastFills, setLastFills] = useState<Record<string, any>>({});

  useEffect(() => {
    const onFill = (fill: any) =>
      setLastFills((prev) => ({ ...prev, [fill.instrument]: fill }));
    wsClient.on("trade_fill", onFill);
    wsClient.connect();
    return () => { wsClient.off("trade_fill", onFill); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}
    >
      {/* Chart row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, flex: "0 0 55%" }}>
        {INSTRUMENTS.map(({ id, contract }, idx) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <InstrumentChart
              instrument={id}
              contract={contract}
              fill={lastFills[id] ?? null}
            />
          </motion.div>
        ))}
      </div>

      {/* Time & Sales row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        {INSTRUMENTS.map(({ id }, idx) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.06 }}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <div style={{ width: 2, height: 12, background: C.gold, borderRadius: 1 }} />
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                textTransform: "uppercase", color: C.muted,
              }}>
                {id} — Time & Sales
              </span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <TimeSales instrument={id} />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

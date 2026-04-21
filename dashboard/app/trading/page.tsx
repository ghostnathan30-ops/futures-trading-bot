"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import InstrumentChart from "@/components/charts/InstrumentChart";
import TimeSales from "@/components/panels/TimeSales";
import { wsClient } from "@/lib/websocket";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C",
  surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", borderMid: "#232B42",
  text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

const INSTRUMENTS = [
  { id: "ES", contract: "ESM6", base: 5600 },
  { id: "NQ", contract: "NQM6", base: 19800 },
  { id: "GC", contract: "GCM6", base: 3200 },
];

function mockBars(base: number, n = 200) {
  const bars: any[] = [];
  let price = base;
  const now = Math.floor(Date.now() / 1000);
  for (let i = n; i >= 0; i--) {
    price += (Math.random() - 0.5) * base * 0.002;
    const open = price;
    const close = price + (Math.random() - 0.5) * base * 0.001;
    bars.push({
      time: now - i * 900,
      open: +open.toFixed(2),
      high: +Math.max(open, close, price + Math.random() * base * 0.001).toFixed(2),
      low: +Math.min(open, close, price - Math.random() * base * 0.001).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(Math.random() * 3000) + 500,
    });
    price = close;
  }
  return bars;
}

function InstrumentHeader({
  id, contract, bars, fill,
}: { id: string; contract: string; bars: any[]; fill?: any }) {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = prev ? (change / prev.close) * 100 : 0;
  const up = change >= 0;

  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <div>
        <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: C.gold }}>{id}</span>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.dim, marginLeft: 6 }}>{contract}</span>
      </div>
      {fill && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "2px 7px",
          borderRadius: 3, background: fill.side === "BUY" ? "rgba(0,229,160,0.12)" : "rgba(255,58,92,0.12)",
          color: fill.side === "BUY" ? C.green : C.red,
          border: `1px solid ${fill.side === "BUY" ? "rgba(0,229,160,0.25)" : "rgba(255,58,92,0.25)"}`,
        }}>
          {fill.side} {fill.quantity} @ {fill.fill_price?.toFixed(2)}
        </span>
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 14, color: C.text }}>
          {last?.close.toFixed(2)}
        </span>
        <span style={{
          fontFamily: "JetBrains Mono",
          fontSize: 11,
          fontWeight: 600,
          color: up ? C.green : C.red,
        }}>
          {up ? "+" : ""}{change.toFixed(2)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

export default function TradingPage() {
  const [data] = useState(() => ({
    ES: mockBars(5600),
    NQ: mockBars(19800),
    GC: mockBars(3200),
  }));

  // Live fill notifications from WebSocket
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
        {INSTRUMENTS.map(({ id, contract, base }, idx) => {
          const bars = data[id as keyof typeof data];
          return (
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
              <InstrumentHeader id={id} contract={contract} bars={bars} fill={lastFills[id]} />
              <div style={{ flex: 1, minHeight: 0 }}>
                <InstrumentChart
                  instrument={id}
                  contract={contract}
                  bars={bars}
                  vwap={bars.map((b, i) => ({ time: b.time, value: b.close * (1 + (i - 100) * 0.0001) }))}
                  vwapUpper1={bars.map((b, i) => ({ time: b.time, value: b.close * (1 + (i - 100) * 0.0001 + 0.003) }))}
                  vwapLower1={bars.map((b, i) => ({ time: b.time, value: b.close * (1 + (i - 100) * 0.0001 - 0.003) }))}
                  ema20={bars.slice(20).map((b, i, arr) => ({
                    time: b.time,
                    value: arr.slice(Math.max(0, i - 20), i + 1).reduce((s, x) => s + x.close, 0) / Math.min(i + 1, 20),
                  }))}
                  ema50={bars.slice(50).map((b, i, arr) => ({
                    time: b.time,
                    value: arr.slice(Math.max(0, i - 50), i + 1).reduce((s, x) => s + x.close, 0) / Math.min(i + 1, 50),
                  }))}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Time & Sales row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        {INSTRUMENTS.map(({ id, base }, idx) => (
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
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
                {id} — Time & Sales
              </span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <TimeSales instrument={id} basePrice={base} />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

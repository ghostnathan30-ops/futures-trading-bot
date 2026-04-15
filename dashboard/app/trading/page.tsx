"use client";
import { useState } from "react";
import InstrumentChart from "@/components/charts/InstrumentChart";
import TimeSales from "@/components/panels/TimeSales";

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

export default function TradingPage() {
  const [data] = useState(() => ({
    ES: mockBars(5600),
    NQ: mockBars(19800),
    GC: mockBars(3200),
  }));

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3" style={{ height: "55%" }}>
        {INSTRUMENTS.map(({ id, contract, base }) => {
          const bars = data[id as keyof typeof data];
          return (
            <InstrumentChart
              key={id}
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
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
        <TimeSales instrument="ES" basePrice={5600} />
        <TimeSales instrument="NQ" basePrice={19800} />
        <TimeSales instrument="GC" basePrice={3200} />
      </div>
    </div>
  );
}

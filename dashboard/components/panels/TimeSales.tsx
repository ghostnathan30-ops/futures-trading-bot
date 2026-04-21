"use client";
import { useEffect, useState } from "react";

interface Tick { time: string; price: number; size: number; direction: "up" | "down"; exchange: string; }

function mockTick(base: number): Tick {
  const delta = (Math.random() - 0.49) * base * 0.0005;
  return {
    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    price: +(base + delta).toFixed(2),
    size: Math.floor(Math.random() * 20) + 1,
    direction: delta >= 0 ? "up" : "down",
    exchange: "GLOBEX",
  };
}

export default function TimeSales({ instrument, basePrice }: { instrument: string; basePrice: number }) {
  const [ticks, setTicks] = useState<Tick[]>([]);

  useEffect(() => {
    const t = setInterval(() => {
      setTicks(prev => [mockTick(basePrice), ...prev].slice(0, 100));
    }, 400);
    return () => clearInterval(t);
  }, [basePrice]);

  return (
    <div style={{ flex: 1, overflowY: "auto", height: "100%" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead style={{ position: "sticky", top: 0, background: "var(--bg-surface, #080B12)" }}>
          <tr>
            <th style={{ textAlign: "left",  padding: "4px 8px", color: "var(--text-dim, #3D4760)", fontWeight: 500 }}>Time</th>
            <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-dim, #3D4760)", fontWeight: 500 }}>Price</th>
            <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-dim, #3D4760)", fontWeight: 500 }}>Size</th>
            <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--text-dim, #3D4760)", fontWeight: 500 }}>Exch</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((tick, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-dim, #1A2035)" }}>
              <td style={{ padding: "2px 8px", fontFamily: "JetBrains Mono", color: "var(--text-secondary, #8892B0)" }}>
                {tick.time}
              </td>
              <td style={{
                padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right", fontWeight: 500,
                color: tick.direction === "up" ? "var(--green, #00E5A0)" : "var(--red, #FF3A5C)",
              }}>
                {tick.price.toFixed(2)}
              </td>
              <td style={{
                padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right",
                color: tick.direction === "up" ? "var(--green, #00E5A0)" : "var(--red, #FF3A5C)",
              }}>
                {tick.size}
              </td>
              <td style={{ padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right", color: "var(--text-dim, #3D4760)" }}>
                {tick.exchange}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

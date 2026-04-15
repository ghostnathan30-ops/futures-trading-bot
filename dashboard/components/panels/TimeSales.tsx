"use client";
import { useEffect, useRef, useState } from "react";

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
    <div className="bg-[#1A1D24] border border-[#30363D] rounded flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#30363D]">
        <span className="text-[#8B949E] text-xs uppercase tracking-wider">Time & Sales — {instrument}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1A1D24]">
            <tr className="text-[#484F58]">
              <th className="text-left py-1 px-2">Time</th>
              <th className="text-right py-1 px-2">Price</th>
              <th className="text-right py-1 px-2">Size</th>
              <th className="text-right py-1 px-2">Exch</th>
            </tr>
          </thead>
          <tbody>
            {ticks.map((tick, i) => (
              <tr key={i} className={`border-b border-[#30363D] ${tick.direction === "up" ? "text-[#00FF88]" : "text-[#FF4444]"}`}>
                <td className="py-0.5 px-2 font-mono text-[#8B949E]">{tick.time}</td>
                <td className="py-0.5 px-2 font-mono text-right font-medium">{tick.price.toFixed(2)}</td>
                <td className="py-0.5 px-2 font-mono text-right">{tick.size}</td>
                <td className="py-0.5 px-2 font-mono text-right text-[#484F58]">{tick.exchange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

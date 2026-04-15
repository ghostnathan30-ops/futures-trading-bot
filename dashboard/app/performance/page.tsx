"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PerformancePage() {
  const [perf, setPerf] = useState<any>(null);

  useEffect(() => { api.performance().then(setPerf).catch(() => {}); }, []);

  const stats = perf ? [
    { label: "Total P&L",     value: `$${Number(perf.total_pnl).toLocaleString()}`,   pos: perf.total_pnl >= 0 },
    { label: "Win Rate",      value: `${(perf.win_rate*100).toFixed(1)}%`,             pos: perf.win_rate >= 0.5 },
    { label: "Sharpe Ratio",  value: perf.sharpe?.toFixed(2) ?? "--",                  pos: perf.sharpe >= 1 },
    { label: "Profit Factor", value: perf.profit_factor?.toFixed(2) ?? "--",           pos: perf.profit_factor >= 1.5 },
    { label: "Avg Win",       value: `$${Number(perf.avg_win).toFixed(0)}`,            pos: true },
    { label: "Avg Loss",      value: `-$${Number(perf.avg_loss).toFixed(0)}`,          pos: false },
    { label: "Total Trades",  value: String(perf.total_trades ?? "0"),                 pos: true },
    { label: "Winners",       value: String(perf.wins ?? "0"),                         pos: true },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ label, value, pos }) => (
          <div key={label} className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
            <div className="text-[#8B949E] text-xs uppercase tracking-wider mb-1">{label}</div>
            <div className={`font-mono font-semibold text-xl ${pos ? "text-[#00FF88]" : "text-[#FF4444]"}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Monthly P&L</h3>
          <div className="grid grid-cols-6 gap-1">
            {Array.from({length:12},(_,i)=>i).map(m => {
              const pnl = (Math.random()-0.45)*5000;
              return (
                <div key={m} className="text-center">
                  <div className="text-[#484F58] text-xs mb-1">
                    {new Date(2026,m).toLocaleString("default",{month:"short"})}
                  </div>
                  <div className={`h-12 rounded flex items-end justify-center pb-1 text-xs font-mono font-medium
                    ${pnl>=0?"bg-[#00FF88]/20 text-[#00FF88]":"bg-[#FF4444]/20 text-[#FF4444]"}`}
                    style={{opacity: 0.4 + Math.abs(pnl)/10000}}>
                    {pnl>=0?"+":""}{(pnl/1000).toFixed(1)}k
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Instrument Breakdown</h3>
          <div className="space-y-3">
            {["ES","NQ","GC"].map(ins => {
              const pnl = (Math.random()-0.3)*3000;
              const pct = Math.random();
              return (
                <div key={ins}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#E6EDF3] font-medium">{ins}</span>
                    <span className={`font-mono ${pnl>=0?"text-[#00FF88]":"text-[#FF4444]"}`}>
                      {pnl>=0?"+":""}{pnl.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#21262D] rounded overflow-hidden">
                    <div className={`h-full rounded ${pnl>=0?"bg-[#00FF88]":"bg-[#FF4444]"}`} style={{width:`${pct*100}%`}} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function JournalPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.trades(filter ? `?instrument=${filter}` : "").then(setTrades).catch(() => {});
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[#E6EDF3] font-semibold">Trade Journal</h2>
        <div className="flex gap-2 ml-auto">
          {["", "ES","NQ","GC"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded transition-colors
                ${filter===f ? "bg-[#2E7D9E] text-white" : "bg-[#21262D] text-[#8B949E] hover:text-[#E6EDF3]"}`}>
              {f || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#30363D] text-[#8B949E] uppercase tracking-wider">
              {["Date","Instrument","Side","Qty","Entry","Exit","P&L","ML Conf","Regime","Exit Reason"].map(h => (
                <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr><td colSpan={10} className="text-center text-[#484F58] py-8">No trades yet</td></tr>
            )}
            {trades.map((t, i) => (
              <tr key={i} className="border-b border-[#30363D] hover:bg-[#21262D] transition-colors">
                <td className="py-2 px-3 font-mono text-[#8B949E]">{new Date(t.entry_ts).toLocaleDateString()}</td>
                <td className="py-2 px-3 font-medium text-[#E6EDF3]">{t.instrument}</td>
                <td className={`py-2 px-3 font-mono font-medium ${t.side==="LONG"?"text-[#00FF88]":"text-[#FF4444]"}`}>{t.side}</td>
                <td className="py-2 px-3 font-mono">{t.quantity}</td>
                <td className="py-2 px-3 font-mono">{Number(t.entry_price).toFixed(2)}</td>
                <td className="py-2 px-3 font-mono">{Number(t.exit_price).toFixed(2)}</td>
                <td className={`py-2 px-3 font-mono font-semibold ${t.pnl>=0?"text-[#00FF88]":"text-[#FF4444]"}`}>
                  {t.pnl>=0?"+":""}{Number(t.pnl).toFixed(2)}
                </td>
                <td className="py-2 px-3 font-mono text-[#2E7D9E]">
                  {t.ml_confidence ? `${(t.ml_confidence*100).toFixed(0)}%` : "--"}
                </td>
                <td className="py-2 px-3 text-[#8B949E]">{t.regime_state ?? "--"}</td>
                <td className="py-2 px-3 text-[#484F58]">{t.exit_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

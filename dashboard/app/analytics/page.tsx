"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { api } from "@/lib/api";

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    api.trades("?limit=500").then(setTrades).catch(() => {});
  }, []);

  const bins = Array.from({ length: 20 }, (_, i) => ({ bin: i, count: 0, label: "" }));
  if (trades.length) {
    const pnls = trades.map(t => Number(t.pnl));
    const min = Math.min(...pnls), max = Math.max(...pnls);
    const step = (max - min) / 20 || 1;
    pnls.forEach(p => {
      const i = Math.min(19, Math.floor((p - min) / step));
      bins[i].count++;
      bins[i].label = `${(min + i * step).toFixed(0)}`;
    });
  }

  const byInstrument = ["ES","NQ","GC"].map(ins => {
    const insTrades = trades.filter(t => t.instrument === ins);
    const wins = insTrades.filter(t => t.pnl > 0).length;
    return { instrument: ins, winRate: insTrades.length ? wins/insTrades.length*100 : 0, trades: insTrades.length };
  });

  const scatter = trades.slice(0, 100).map(t => ({
    confidence: Number(t.ml_confidence ?? 0) * 100,
    pnl: Number(t.pnl),
  }));

  const regimeStats = ["trending","ranging","volatile"].map(regime => {
    const rt = trades.filter(t => t.regime_state === regime);
    const wins = rt.filter(t => t.pnl > 0).length;
    const pnl = rt.reduce((s, t) => s + Number(t.pnl), 0);
    return { regime, trades: rt.length, wins, pnl };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">P&L Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={bins}>
              <XAxis dataKey="label" tick={{ fill: "#8B949E", fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: "#8B949E", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#21262D", border: "1px solid #30363D", borderRadius: 4 }}
                       labelStyle={{ color: "#8B949E" }} itemStyle={{ color: "#E6EDF3" }} />
              <Bar dataKey="count" fill="#2E7D9E" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Win Rate by Instrument</h3>
          <div className="space-y-4 mt-4">
            {byInstrument.map(({ instrument, winRate, trades: n }) => (
              <div key={instrument}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#E6EDF3] font-medium">{instrument}</span>
                  <span className="font-mono text-[#8B949E]">{winRate.toFixed(1)}% ({n} trades)</span>
                </div>
                <div className="h-2 bg-[#21262D] rounded overflow-hidden">
                  <div className={`h-full rounded ${winRate>=50?"bg-[#00FF88]":"bg-[#FF4444]"}`} style={{width:`${winRate}%`}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
        <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">ML Confidence vs Trade Outcome</h3>
        {scatter.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart>
              <XAxis dataKey="confidence" name="ML Confidence %" type="number"
                     tick={{ fill: "#8B949E", fontSize: 10 }} domain={[0,100]} />
              <YAxis dataKey="pnl" name="P&L $" tick={{ fill: "#8B949E", fontSize: 10 }}
                     tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: "#21262D", border: "1px solid #30363D", borderRadius: 4 }} />
              <Scatter data={scatter} fill="#2E7D9E" opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-[#484F58] text-sm">
            No trade data yet — run the bot to populate analytics
          </div>
        )}
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
        <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Performance by Regime</h3>
        <div className="grid grid-cols-3 gap-3">
          {regimeStats.map(({ regime, trades: n, wins, pnl }) => (
            <div key={regime} className="bg-[#21262D] rounded p-3 text-center">
              <div className="text-[#8B949E] text-xs uppercase tracking-wider mb-2">{regime}</div>
              <div className={`font-mono font-semibold text-lg ${pnl>=0?"text-[#00FF88]":"text-[#FF4444]"}`}>
                {pnl>=0?"+":""}{pnl.toFixed(0)}
              </div>
              <div className="text-[#484F58] text-xs mt-1">
                {n} trades · {n ? (wins/n*100).toFixed(0) : 0}% win
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

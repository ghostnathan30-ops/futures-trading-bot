"use client";
import { useEffect, useState } from "react";
import EquityCurve from "@/components/charts/EquityCurve";
import PositionsTable from "@/components/panels/PositionsTable";
import { api } from "@/lib/api";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#1A1D24] border border-[#30363D] rounded p-3">
      <div className="text-[#8B949E] text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono font-semibold text-[#E6EDF3] text-lg">{value}</div>
      {sub && <div className="text-[#484F58] text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function OverviewPage() {
  const [perf, setPerf] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      api.performance().then(setPerf).catch(() => {});
      api.positions().then(setPositions).catch(() => {});
      api.snapshots(24).then(setSnapshots).catch(() => {});
      api.signals().then(setSignals).catch(() => {});
    };
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-3">
        <StatCard label="Win Rate" value={perf ? `${(perf.win_rate*100).toFixed(1)}%` : "--"} />
        <StatCard label="Sharpe" value={perf ? perf.sharpe?.toFixed(2) ?? "--" : "--"} />
        <StatCard label="Profit Factor" value={perf ? perf.profit_factor?.toFixed(2) ?? "--" : "--"} />
        <StatCard label="Total Trades" value={perf ? String(perf.total_trades ?? "0") : "--"} />
        <StatCard label="Total P&L" value={perf ? `$${Number(perf.total_pnl).toLocaleString()}` : "--"} />
        <StatCard label="ML Confidence" value={perf ? `${((perf.avg_ml_confidence ?? 0)*100).toFixed(1)}%` : "--"} sub="avg at entry" />
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
        <h2 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Equity Curve</h2>
        {snapshots.length > 0
          ? <EquityCurve data={snapshots} />
          : <div className="h-48 flex items-center justify-center text-[#484F58] text-sm">No data yet</div>}
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
        <h2 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">
          Open Positions <span className="text-[#484F58] ml-1">({positions.length})</span>
        </h2>
        <PositionsTable positions={positions} />
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
        <h2 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Signal Feed</h2>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {signals.length === 0 && <div className="text-[#484F58] text-sm">No signals yet</div>}
          {signals.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-[#30363D]">
              <span className="font-mono text-[#484F58]">{new Date(s.ts).toLocaleTimeString()}</span>
              <span className="font-medium text-[#E6EDF3]">{s.instrument}</span>
              <span className={s.direction==="long"?"text-[#00FF88]":"text-[#FF4444]"}>{s.direction?.toUpperCase()}</span>
              <span className={`px-1.5 py-0.5 rounded ${s.fired?"bg-[#00FF88]/20 text-[#00FF88]":"bg-[#21262D] text-[#8B949E]"}`}>
                {s.fired ? "FIRED" : "SKIPPED"}
              </span>
              {!s.fired && <span className="text-[#484F58]">{s.skip_reason}</span>}
              <span className="ml-auto font-mono text-[#8B949E]">Score: {s.confluence_score}/6</span>
              {s.ml_confidence && (
                <span className="font-mono text-[#2E7D9E]">ML: {(s.ml_confidence*100).toFixed(0)}%</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

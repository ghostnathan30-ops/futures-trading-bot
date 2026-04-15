"use client";
import { useEffect, useState } from "react";
import KillSwitch from "@/components/controls/KillSwitch";
import { api } from "@/lib/api";

export default function ControlsPage() {
  const [state, setState] = useState<any>(null);
  const [logs] = useState<string[]>([
    "[SYS] Bot engine started",
    "[ORDER] ES BUY 1 contract @ 5612.25 submitted",
    "[FILL] ES orderId=42 filled @ 5612.50 commission=$2.05",
    "[RISK] Daily drawdown check: 0.8% / 3.0%",
  ]);

  useEffect(() => {
    api.botState().then(setState).catch(() => {});
  }, []);

  async function toggle(key: string, val: boolean) {
    await api.updateBot({ [key]: val });
    setState((s: any) => ({ ...s, [key]: val }));
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-4">
        <KillSwitch />
        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Bot Status</h3>
          {state && (
            <div className="space-y-3">
              {[
                { key: "is_running", label: "Bot Running" },
                { key: "es_enabled", label: "ES Enabled" },
                { key: "nq_enabled", label: "NQ Enabled" },
                { key: "gc_enabled", label: "GC Enabled" },
                { key: "ml_enabled", label: "ML Filter" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[#8B949E] text-sm">{label}</span>
                  <button
                    onClick={() => toggle(key, !state[key])}
                    className={`w-10 h-5 rounded-full transition-colors relative ${state[key] ? "bg-[#00FF88]" : "bg-[#21262D] border border-[#30363D]"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${state[key] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!state && <div className="text-[#484F58] text-sm">Loading...</div>}
        </div>
      </div>

      <div className="col-span-1 space-y-4">
        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Risk Settings</h3>
          {state && (
            <div className="space-y-4">
              {[
                { key: "risk_pct", label: "Risk per Trade (%)", step: 0.1, max: "5" },
                { key: "daily_kill_pct", label: "Daily Kill Threshold (%)", step: 0.5, max: "10" },
                { key: "ml_min_confidence", label: "ML Min Confidence", step: 0.05, max: "1" },
              ].map(({ key, label, step, max }) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#8B949E] text-xs">{label}</span>
                    <span className="font-mono text-[#E6EDF3] text-xs">{Number(state[key] ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0" max={max} step={step}
                    value={state[key] ?? 0}
                    onChange={async e => {
                      const val = parseFloat(e.target.value);
                      setState((s: any) => ({ ...s, [key]: val }));
                      await api.updateBot({ [key]: val });
                    }}
                    className="w-full accent-[#2E7D9E]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Contract Rollover</h3>
          <div className="space-y-2 text-sm">
            {["ES", "NQ", "GC"].map(ins => (
              <div key={ins} className="flex justify-between items-center">
                <span className="text-[#8B949E]">{ins}</span>
                <span className="font-mono text-[#E6EDF3]">{ins === "GC" ? "GCM6 → GCQ6" : `${ins}M6 → ${ins}U6`}</span>
                <button className="text-[#2E7D9E] text-xs hover:underline">Roll Now</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-1">
        <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4 h-full">
          <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">IBKR Log</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className={`py-0.5 ${
                log.startsWith("[ORDER]") ? "text-[#2E7D9E]" :
                log.startsWith("[FILL]")  ? "text-[#00FF88]" :
                log.startsWith("[RISK]")  ? "text-[#F0A500]" :
                "text-[#8B949E]"}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

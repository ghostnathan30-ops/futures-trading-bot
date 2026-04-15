"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function RiskRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#30363D] last:border-0">
      <span className="text-[#8B949E] text-xs">{label}</span>
      <span className={`font-mono text-xs font-medium ${warn ? "text-[#F0A500]" : "text-[#E6EDF3]"}`}>
        {value}
      </span>
    </div>
  );
}

export default function RiskPanel() {
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    const load = () => api.account().then(setAccount).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const netLiq    = Number(account?.net_liq ?? 0);
  const initMarg  = Number(account?.init_margin ?? 0);
  const maintMarg = Number(account?.maint_margin ?? 0);
  const buyPow    = Number(account?.buying_power ?? 0);
  const exLiq     = Number(account?.excess_liq ?? 0);
  const exposure  = netLiq > 0 ? (initMarg / netLiq * 100) : 0;
  const maintPct  = netLiq > 0 ? (maintMarg / netLiq * 100) : 0;

  return (
    <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4 w-72 shrink-0">
      <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Risk Metrics</h3>
      <div>
        <RiskRow label="Buying Power"      value={`$${buyPow.toLocaleString("en-US",{maximumFractionDigits:0})}`} />
        <RiskRow label="Excess Liquidity"  value={`$${exLiq.toLocaleString("en-US",{maximumFractionDigits:0})}`} />
        <RiskRow label="Exposure"          value={`${exposure.toFixed(1)}%`} warn={exposure > 50} />
        <RiskRow label="Maint. Margin"     value={`${maintPct.toFixed(1)}%`} warn={maintPct > 80} />
        <RiskRow label="Init. Margin Used" value={`$${initMarg.toLocaleString("en-US",{maximumFractionDigits:0})}`} />
        <RiskRow label="Risk/Trade"        value="1.00%" />
        <RiskRow label="Daily Kill at"     value="3.00%" />
      </div>
      <div className="mt-4">
        <div className="text-[#8B949E] text-xs uppercase tracking-wider mb-2">Correlations</div>
        <div className="grid grid-cols-3 gap-1 text-xs text-center">
          {[["ES","NQ","0.94"],["ES","GC","-0.12"],["NQ","GC","-0.08"]].map(([a,b,val]) => (
            <div key={`${a}${b}`} className="bg-[#21262D] rounded p-1.5">
              <div className="text-[#484F58]">{a}/{b}</div>
              <div className={`font-mono font-medium ${Number(val)>0.5?"text-[#00FF88]":Number(val)<-0.3?"text-[#FF4444]":"text-[#8B949E]"}`}>
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

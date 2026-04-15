"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function PnlValue({ value }: { value: number }) {
  const cls = value >= 0 ? "text-[#00FF88]" : "text-[#FF4444]";
  return (
    <span className={`font-mono font-medium ${cls}`}>
      {value >= 0 ? "+" : ""}${value.toLocaleString("en-US", {minimumFractionDigits: 2})}
    </span>
  );
}

export default function Header() {
  const [account, setAccount] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const load = () => {
      api.account().then(a => { setAccount(a); setConnected(true); }).catch(() => setConnected(false));
      setTime(new Date());
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const etTime = time.toLocaleTimeString("en-US", {timeZone:"America/New_York", hour12:false});
  const isRTH = (() => {
    const et = new Date(time.toLocaleString("en-US", {timeZone:"America/New_York"}));
    const h = et.getHours(), m = et.getMinutes();
    const mins = h * 60 + m;
    return mins >= 570 && mins < 960;
  })();

  return (
    <header className="h-12 bg-[#1A1D24] border-b border-[#30363D] flex items-center px-4 gap-6 shrink-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-[#00FF88]" : "bg-[#FF4444]"}`} />
        <span className="text-[#8B949E] text-xs">
          {connected ? "IBKR Connected" : "Disconnected"}
        </span>
      </div>

      <div className="flex gap-3 text-xs font-mono text-[#8B949E]">
        <span className="text-[#E6EDF3]">ESM6</span>
        <span>|</span>
        <span className="text-[#E6EDF3]">NQM6</span>
        <span>|</span>
        <span className="text-[#E6EDF3]">GCM6</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${isRTH ? "bg-[#00FF88]/20 text-[#00FF88]" : "bg-[#21262D] text-[#8B949E]"}`}>
          {isRTH ? "RTH" : "ETH"}
        </span>
        <span className="font-mono text-xs text-[#8B949E]">{etTime} ET</span>
      </div>

      <div className="flex-1" />

      {account && (
        <div className="flex items-center gap-2">
          <span className="text-[#8B949E] text-xs">Net Liq</span>
          <span className="font-mono font-semibold text-[#E6EDF3] text-sm">
            ${Number(account.net_liq ?? 0).toLocaleString("en-US", {minimumFractionDigits: 2})}
          </span>
        </div>
      )}

      {account && (
        <div className="flex items-center gap-2">
          <span className="text-[#8B949E] text-xs">Day P&L</span>
          <PnlValue value={Number(account.realized_pnl_today ?? 0) + Number(account.unrealized_pnl ?? 0)} />
        </div>
      )}
    </header>
  );
}

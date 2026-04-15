"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AccountSummary() {
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    const load = () => api.account().then(setAccount).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const rows = account ? [
    { label: "Net Liquidation",    value: `$${Number(account.net_liq).toLocaleString()}`,            pos: true },
    { label: "Cash Balance",       value: `$${Number(account.cash_balance).toLocaleString()}`,        pos: true },
    { label: "Unrealized P&L",     value: `$${Number(account.unrealized_pnl).toFixed(2)}`,           pos: account.unrealized_pnl >= 0 },
    { label: "Realized P&L Today", value: `$${Number(account.realized_pnl_today).toFixed(2)}`,       pos: account.realized_pnl_today >= 0 },
    { label: "Init. Margin Req.",  value: `$${Number(account.init_margin).toLocaleString()}`,         pos: true },
    { label: "Maint. Margin Req.", value: `$${Number(account.maint_margin).toLocaleString()}`,        pos: true },
  ] : [];

  return (
    <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
      <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">Account Summary</h3>
      <div>
        {rows.map(({ label, value, pos }) => (
          <div key={label} className="flex justify-between py-1.5 border-b border-[#30363D] last:border-0">
            <span className="text-[#8B949E] text-xs">{label}</span>
            <span className={`font-mono text-xs font-medium ${pos ? "text-[#E6EDF3]" : "text-[#FF4444]"}`}>
              {value}
            </span>
          </div>
        ))}
        {!account && <div className="text-[#484F58] text-sm text-center py-4">No account data</div>}
      </div>
    </div>
  );
}

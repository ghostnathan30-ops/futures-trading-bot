"use client";

interface Position {
  instrument: string; contract: string; side: string;
  quantity: number; entry_price: number; mark_price: number;
  unrealized_pnl: number; init_margin: number;
  is_overnight: boolean; stop_loss: number; take_profit: number;
}

export default function PositionsTable({ positions }: { positions: Position[] }) {
  if (!positions.length) return (
    <div className="text-[#8B949E] text-sm text-center py-8">No open positions</div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[#8B949E] uppercase tracking-wider border-b border-[#30363D]">
            {["Instrument","Side","Qty","Entry","Mark","Unr. P&L","Margin","Overnight","Stop","Target",""].map(h => (
              <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => (
            <tr key={i} className="border-b border-[#30363D] hover:bg-[#21262D] transition-colors">
              <td className="py-2 px-2 font-medium text-[#E6EDF3]">{p.instrument}</td>
              <td className={`py-2 px-2 font-mono font-medium ${p.side==="LONG"?"text-[#00FF88]":"text-[#FF4444]"}`}>{p.side}</td>
              <td className="py-2 px-2 font-mono">{p.quantity}</td>
              <td className="py-2 px-2 font-mono">{Number(p.entry_price).toFixed(2)}</td>
              <td className="py-2 px-2 font-mono">{Number(p.mark_price).toFixed(2)}</td>
              <td className={`py-2 px-2 font-mono font-medium ${p.unrealized_pnl>=0?"text-[#00FF88]":"text-[#FF4444]"}`}>
                {p.unrealized_pnl>=0?"+":""}{Number(p.unrealized_pnl).toFixed(2)}
              </td>
              <td className="py-2 px-2 font-mono text-[#8B949E]">${Number(p.init_margin).toLocaleString()}</td>
              <td className="py-2 px-2">
                <span className={`px-1.5 py-0.5 rounded text-xs ${p.is_overnight?"bg-[#F0A500]/20 text-[#F0A500]":"text-[#484F58]"}`}>
                  {p.is_overnight ? "OVERNIGHT" : "INTRADAY"}
                </span>
              </td>
              <td className="py-2 px-2 font-mono text-[#FF4444]">{Number(p.stop_loss).toFixed(2)}</td>
              <td className="py-2 px-2 font-mono text-[#00FF88]">{Number(p.take_profit).toFixed(2)}</td>
              <td className="py-2 px-2">
                <button className="text-[#8B949E] hover:text-[#FF4444] text-xs transition-colors">Close</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

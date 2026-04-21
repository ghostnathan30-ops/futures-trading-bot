"use client";

interface Position {
  instrument: string; contract: string; side: string;
  quantity: number; entry_price: number; mark_price: number;
  unrealized_pnl: number; init_margin: number;
  is_overnight: boolean; stop_loss: number; take_profit: number;
}

export default function PositionsTable({ positions }: { positions: Position[] }) {
  if (!positions.length) {
    return (
      <div style={{
        padding: "32px 0",
        textAlign: "center",
        color: "#3D4760",
        fontSize: 12,
        letterSpacing: "0.05em",
      }}>
        No open positions — strategy loop evaluates every 60s
      </div>
    );
  }

  const headers = ["Instrument", "Side", "Qty", "Entry", "Mark", "Unr. P&L", "Margin", "Session", "Stop", "Target"];

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="q-table">
        <thead>
          <tr>
            {headers.map(h => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => {
            const pnlPos = p.unrealized_pnl >= 0;
            return (
              <tr key={i}>
                <td>
                  <span style={{ fontWeight: 600, color: "#F0F4FF", fontFamily: "JetBrains Mono", fontSize: 13 }}>{p.instrument}</span>
                  <span style={{ color: "#3D4760", fontSize: 10, marginLeft: 6 }}>{p.contract}</span>
                </td>
                <td>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    background: p.side === "LONG" ? "rgba(0,229,160,0.1)" : "rgba(255,58,92,0.1)",
                    color: p.side === "LONG" ? "#00E5A0" : "#FF3A5C",
                    border: `1px solid ${p.side === "LONG" ? "rgba(0,229,160,0.2)" : "rgba(255,58,92,0.2)"}`,
                  }}>
                    {p.side}
                  </span>
                </td>
                <td style={{ fontFamily: "JetBrains Mono", color: "#8892B0" }}>{p.quantity}</td>
                <td style={{ fontFamily: "JetBrains Mono", color: "#8892B0" }}>{Number(p.entry_price).toFixed(2)}</td>
                <td style={{ fontFamily: "JetBrains Mono", color: "#F0F4FF" }}>{Number(p.mark_price).toFixed(2)}</td>
                <td style={{ fontFamily: "JetBrains Mono", fontWeight: 600, color: pnlPos ? "#00E5A0" : "#FF3A5C" }}>
                  {pnlPos ? "+" : "−"}${Math.abs(p.unrealized_pnl).toFixed(2)}
                </td>
                <td style={{ fontFamily: "JetBrains Mono", color: "#3D4760" }}>${Number(p.init_margin).toLocaleString()}</td>
                <td>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: p.is_overnight ? "rgba(201,168,76,0.1)" : "transparent",
                    color: p.is_overnight ? "#C9A84C" : "#3D4760",
                    border: p.is_overnight ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
                  }}>
                    {p.is_overnight ? "OVERNIGHT" : "INTRADAY"}
                  </span>
                </td>
                <td style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#FF3A5C" }}>{Number(p.stop_loss).toFixed(2)}</td>
                <td style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#00E5A0" }}>{Number(p.take_profit).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

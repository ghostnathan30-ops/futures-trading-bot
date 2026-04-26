"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { wsClient } from "@/lib/websocket";

interface TradeRow {
  id: string;
  time: string;
  price: number;
  size: number;
  side: "BUY" | "SELL";
  type: "entry" | "exit";
  pnl: number | null;
}

function tradeToRow(trade: any, kind: "entry" | "exit"): TradeRow {
  const ts = kind === "entry" ? trade.entry_ts : trade.exit_ts;
  const price = kind === "entry" ? trade.entry_price : trade.exit_price;
  return {
    id: `${trade.id}-${kind}`,
    time: ts
      ? new Date(ts).toLocaleTimeString("en-US", { hour12: false })
      : "—",
    price: price ? +parseFloat(price).toFixed(2) : 0,
    size: trade.quantity ?? 0,
    side: trade.side === "BUY" ? "BUY" : "SELL",
    type: kind,
    pnl: kind === "exit" && trade.pnl != null ? +parseFloat(trade.pnl).toFixed(2) : null,
  };
}

export default function TimeSales({ instrument }: { instrument: string }) {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const nextIdRef = useRef(0);

  // ── Initial load: last 50 completed trades for this instrument ────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const trades = await api.trades(`?instrument=${instrument}&limit=50`);
        if (!alive) return;

        const parsed: TradeRow[] = [];
        for (const t of trades) {
          parsed.push(tradeToRow(t, "entry"));
          if (t.exit_ts) parsed.push(tradeToRow(t, "exit"));
        }
        // Sort newest first
        parsed.sort((a, b) => b.time.localeCompare(a.time));
        setRows(parsed.slice(0, 100));
      } catch {
        // Silently degrade — live updates still work
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [instrument]);

  // ── Live: trade_fill WebSocket events ─────────────────────────────────────
  useEffect(() => {
    const onFill = (fill: any) => {
      if (fill.instrument !== instrument) return;
      const row: TradeRow = {
        id: `ws-${nextIdRef.current++}`,
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        price: fill.fill_price ? +parseFloat(fill.fill_price).toFixed(2) : 0,
        size: fill.quantity ?? 0,
        side: fill.side === "BUY" ? "BUY" : "SELL",
        type: "exit",
        pnl: fill.pnl != null ? +parseFloat(fill.pnl).toFixed(2) : null,
      };
      setRows((prev) => [row, ...prev].slice(0, 100));
    };
    wsClient.on("trade_fill", onFill);
    return () => wsClient.off("trade_fill", onFill);
  }, [instrument]);

  const GREEN = "var(--green, #00E5A0)";
  const RED   = "var(--red, #FF3A5C)";
  const DIM   = "var(--text-dim, #3D4760)";
  const MUTED = "var(--text-secondary, #8892B0)";
  const BORDER = "var(--border-dim, #1A2035)";

  return (
    <div style={{ flex: 1, overflowY: "auto", height: "100%" }}>
      {loading ? (
        <div style={{ padding: "16px 8px", textAlign: "center", fontFamily: "JetBrains Mono", fontSize: 11, color: DIM }}>
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "16px 8px", textAlign: "center", fontFamily: "JetBrains Mono", fontSize: 11, color: DIM }}>
          No trades yet
        </div>
      ) : (
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--bg-surface, #080B12)" }}>
            <tr>
              <th style={{ textAlign: "left",  padding: "4px 8px", color: DIM, fontWeight: 500 }}>Time</th>
              <th style={{ textAlign: "right", padding: "4px 8px", color: DIM, fontWeight: 500 }}>Price</th>
              <th style={{ textAlign: "right", padding: "4px 8px", color: DIM, fontWeight: 500 }}>Qty</th>
              <th style={{ textAlign: "right", padding: "4px 8px", color: DIM, fontWeight: 500 }}>Side</th>
              <th style={{ textAlign: "right", padding: "4px 8px", color: DIM, fontWeight: 500 }}>PnL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isBuy = row.side === "BUY";
              const priceColor = isBuy ? GREEN : RED;
              return (
                <tr key={row.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "2px 8px", fontFamily: "JetBrains Mono", color: MUTED }}>
                    {row.time}
                  </td>
                  <td style={{ padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right", fontWeight: 500, color: priceColor }}>
                    {row.price.toFixed(2)}
                  </td>
                  <td style={{ padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right", color: priceColor }}>
                    {row.size}
                  </td>
                  <td style={{ padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right", fontSize: 10, color: priceColor }}>
                    {row.side}
                  </td>
                  <td style={{
                    padding: "2px 8px", fontFamily: "JetBrains Mono", textAlign: "right",
                    color: row.pnl == null ? DIM : row.pnl >= 0 ? GREEN : RED,
                  }}>
                    {row.pnl == null ? "—" : `${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

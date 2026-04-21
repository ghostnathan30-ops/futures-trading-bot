"""Background task that polls the database and broadcasts live state to WS clients."""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

import asyncpg

from websocket.manager import broadcast

log = logging.getLogger(__name__)

_last_signal_id = 0  # track last broadcast signal to avoid replays


async def _get_pool():
    return await asyncpg.create_pool(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        database=os.getenv("POSTGRES_DB", "tradingbot"),
        user=os.getenv("POSTGRES_USER", "tradingbot"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
        min_size=1,
        max_size=3,
    )


async def run_broadcaster():
    """Polls DB every 3 seconds and broadcasts live state to all WS clients."""
    global _last_signal_id

    pool = None
    while pool is None:
        try:
            pool = await _get_pool()
        except Exception as e:
            log.warning(f"Broadcaster waiting for DB: {e}")
            await asyncio.sleep(5)

    log.info("WebSocket broadcaster started")

    while True:
        try:
            async with pool.acquire() as conn:
                # 1. Latest account snapshot → account_update
                snap = await conn.fetchrow(
                    "SELECT net_liq, cash_balance, buying_power, unrealized_pnl, "
                    "realized_pnl_today FROM account_snapshots ORDER BY ts DESC LIMIT 1"
                )
                if snap:
                    await broadcast("account_update", {
                        "net_liq":        float(snap["net_liq"] or 0),
                        "cash_balance":   float(snap["cash_balance"] or 0),
                        "buying_power":   float(snap["buying_power"] or 0),
                        "unrealized_pnl": float(snap["unrealized_pnl"] or 0),
                        "daily_pnl":      float(snap["realized_pnl_today"] or 0),
                    })

                # 2. Open positions → position_update
                # Inferred from trades that have no exit recorded yet
                positions = await conn.fetch(
                    """
                    SELECT instrument, side, quantity, entry_price,
                           ml_confidence, regime_state
                    FROM trades
                    WHERE exit_ts IS NULL
                    ORDER BY entry_ts DESC
                    """
                )
                await broadcast("position_update", [
                    {
                        "instrument":    r["instrument"],
                        "side":          r["side"],
                        "quantity":      r["quantity"],
                        "entry_price":   float(r["entry_price"] or 0),
                        "ml_confidence": float(r["ml_confidence"] or 0),
                        "regime_state":  r["regime_state"],
                    }
                    for r in positions
                ])

                # 3. New signals since last broadcast → signal_fired (incremental by id)
                new_signals = await conn.fetch(
                    "SELECT id, instrument, direction, confluence_score, "
                    "ml_confidence, fired, skip_reason, regime_state, ts "
                    "FROM signals WHERE id > $1 ORDER BY id ASC LIMIT 20",
                    _last_signal_id,
                )
                for sig in new_signals:
                    await broadcast("signal_fired", {
                        "instrument":    sig["instrument"],
                        "direction":     sig["direction"],
                        "score":         sig["confluence_score"],
                        "ml_confidence": float(sig["ml_confidence"] or 0),
                        "fired":         sig["fired"],
                        "skip_reason":   sig["skip_reason"],
                        "regime":        sig["regime_state"],
                        "ts":            sig["ts"].isoformat(),
                    })
                    _last_signal_id = sig["id"]

                # 4. Recent trade fills → trade_fill (exits in last 10 seconds)
                recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=10)
                fills = await conn.fetch(
                    "SELECT instrument, side, quantity, exit_price, pnl "
                    "FROM trades WHERE exit_ts > $1 ORDER BY exit_ts DESC",
                    recent_cutoff,
                )
                for fill in fills:
                    await broadcast("trade_fill", {
                        "instrument": fill["instrument"],
                        "side":       fill["side"],
                        "quantity":   fill["quantity"],
                        "fill_price": float(fill["exit_price"] or 0),
                        "pnl":        float(fill["pnl"] or 0),
                    })

        except Exception as e:
            log.error(f"Broadcaster error: {e}", exc_info=True)

        await asyncio.sleep(3)

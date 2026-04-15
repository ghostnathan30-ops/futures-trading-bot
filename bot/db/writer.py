import logging
from datetime import datetime, timezone
import asyncpg
import os
from typing import Optional

log = logging.getLogger(__name__)

_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=os.getenv("POSTGRES_HOST"),
            port=int(os.getenv("POSTGRES_PORT", 5432)),
            database=os.getenv("POSTGRES_DB"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            min_size=2, max_size=10,
        )
    return _pool


async def write_account_snapshot(data: dict):
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO account_snapshots
                  (net_liq, cash_balance, buying_power, excess_liq,
                   init_margin, maint_margin, unrealized_pnl, realized_pnl_today)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """, data["net_liq"], data["cash_balance"], data["buying_power"],
                 data["excess_liq"], data["init_margin"], data["maint_margin"],
                 data["unrealized_pnl"], data["realized_pnl_today"])
    except Exception as e:
        log.error(f"write_account_snapshot failed: {e}")


async def write_signal(instrument: str, result: dict, fired: bool, skip_reason: Optional[str]):
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO signals
                  (instrument, direction, ema_signal, macd_signal, rsi_signal,
                   vwap_signal, delta_signal, regime_state, confluence_score,
                   ml_confidence, fired, skip_reason)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            """,
            instrument, result.get("direction", "long"),
            result.get("ema_signal"), result.get("macd_signal"), result.get("rsi_signal"),
            result.get("vwap_signal"), result.get("delta_signal"),
            result.get("regime", "unknown"), result.get("score", 0),
            result.get("ml_confidence"), fired, skip_reason)
    except Exception as e:
        log.error(f"write_signal failed: {e}")


async def write_trade(trade: dict):
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO trades
                  (instrument, contract, side, quantity, entry_price, exit_price,
                   entry_ts, exit_ts, pnl, commission, exit_reason,
                   ml_confidence, regime_state, delta_at_entry, vwap_at_entry,
                   atr_at_entry, kelly_fraction)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            """,
            trade["instrument"], trade["contract"], trade["side"], trade["quantity"],
            trade["entry_price"], trade["exit_price"], trade["entry_ts"], trade["exit_ts"],
            trade["pnl"], trade.get("commission", 0), trade["exit_reason"],
            trade.get("ml_confidence"), trade.get("regime_state"),
            trade.get("delta_at_entry"), trade.get("vwap_at_entry"),
            trade.get("atr_at_entry"), trade.get("kelly_fraction"))
    except Exception as e:
        log.error(f"write_trade failed: {e}")

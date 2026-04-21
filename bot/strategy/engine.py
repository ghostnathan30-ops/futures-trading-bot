import asyncio
import logging
import os
import pandas as pd
from datetime import datetime, timezone, timedelta
from ib_insync import IB
from ibkr.connection import ensure_connected
from ibkr.market_data import get_bars
from ibkr.account_monitor import get_account_values
from ibkr.order_manager import place_bracket_order
from strategy.confluence import score_confluence
from strategy.risk_manager import RiskManager
from strategy.regime_hmm import RegimeDetector
from strategy.ml_filter import ml_approved
from strategy.pairs_monitor import PairsMonitor
from db.writer import write_signal, write_account_snapshot
from config import (
    INSTRUMENTS, CONFLUENCE_THRESHOLD,
    MODEL_DIR, MAX_CONTRACTS,
)

log = logging.getLogger(__name__)

risk   = RiskManager()
pairs  = PairsMonitor()
regimes = {instr: RegimeDetector() for instr in INSTRUMENTS}

# Track when each instrument's regime detector was last re-fitted
_last_regime_fit: dict[str, datetime] = {}
_REGIME_REFIT_INTERVAL = timedelta(hours=4)


async def run_strategy_loop(ib: IB):
    log.info("Strategy engine started")

    # Initial regime fit — non-fatal; bot trades without regime filtering
    # if IBKR data is unavailable at startup (e.g. outside market hours)
    for instr in INSTRUMENTS:
        try:
            df = await get_bars(ib, instr, "1 hour", "90 D")
            if not df.empty:
                regimes[instr].fit(df)
                _last_regime_fit[instr] = datetime.now(timezone.utc)
                log.info(f"Regime detector fitted for {instr}")
            else:
                log.warning(f"No 1h bars for {instr} — regime detector using default state")
        except Exception as e:
            log.warning(f"Regime fit failed for {instr} (non-fatal): {e}")

    while True:
        ib = await ensure_connected(ib)
        try:
            account = await get_account_values(ib)
            equity  = account["net_liq"]
            await write_account_snapshot(account)

            if risk.daily_kill_triggered(equity):
                log.warning("Daily kill switch triggered — halting trading")
                await asyncio.sleep(3600)
                continue

            # Periodic regime re-fitting every 4 hours
            now = datetime.now(timezone.utc)
            for instr in INSTRUMENTS:
                last = _last_regime_fit.get(instr)
                if last is None or (now - last) >= _REGIME_REFIT_INTERVAL:
                    try:
                        df_regime = await get_bars(ib, instr, "1 hour", "90 D")
                        if not df_regime.empty:
                            regimes[instr].fit(df_regime)
                            _last_regime_fit[instr] = now
                            log.info(f"Regime re-fitted for {instr}")
                    except Exception as e:
                        log.warning(f"Regime refit failed for {instr} (non-fatal): {e}")

            for instr in INSTRUMENTS:
                await _evaluate_instrument(ib, instr, equity)

        except Exception as e:
            log.error(f"Strategy loop error: {e}", exc_info=True)

        await asyncio.sleep(60)


async def _evaluate_instrument(ib: IB, instrument: str, equity: float):
    df_15m = await get_bars(ib, instrument, "15 mins", "5 D")
    df_1h  = await get_bars(ib, instrument, "1 hour",  "30 D")
    df_4h  = await get_bars(ib, instrument, "4 hours", "90 D")

    if df_15m.empty or df_1h.empty or df_4h.empty:
        return

    result = score_confluence(df_15m, df_1h, df_4h, instrument, regimes[instrument])

    # Only trade trending regime (applies to both long and short)
    if result["regime"] != "trending":
        await write_signal(instrument, result, fired=False,
                           skip_reason=f"regime={result['regime']}")
        return

    # Use score for the favoured direction
    direction = result["direction"]   # "long" or "short"
    score = result["score"] if direction == "long" else result["short_score"]

    if score < CONFLUENCE_THRESHOLD:
        await write_signal(instrument, result, fired=False,
                           skip_reason=f"confluence={score}<{CONFLUENCE_THRESHOLD}")
        return

    # Pairs spread filter (long bias only — short ES/NQ handled by score direction)
    if direction == "long" and instrument in ("ES", "NQ"):
        df_es = await get_bars(ib, "ES", "15 mins", "5 D")
        df_nq = await get_bars(ib, "NQ", "15 mins", "5 D")
        if not df_es.empty and not df_nq.empty:
            spread_signal = pairs.evaluate(df_es["close"], df_nq["close"])
            if instrument == "ES" and spread_signal == "long_nq_short_es":
                await write_signal(instrument, result, fired=False,
                                   skip_reason="pairs:favor_nq")
                return
            if instrument == "NQ" and spread_signal == "long_es_short_nq":
                await write_signal(instrument, result, fired=False,
                                   skip_reason="pairs:favor_es")
                return

    # Load daily bars for ML feature context (fast local read; written by scheduler)
    daily_path = os.path.join(MODEL_DIR, f"{instrument}_daily.parquet")
    df_daily: pd.DataFrame | None = None
    if os.path.exists(daily_path):
        try:
            df_daily = pd.read_parquet(daily_path)
        except Exception:
            pass

    regime = result["regime"]
    if not ml_approved(instrument, df_15m, df_daily=df_daily, regime=regime):
        await write_signal(instrument, result, fired=False, skip_reason="ml_filter")
        return

    order = risk.compute_order(
        instrument, result["close"], result["atr"], equity,
        direction=direction,
    )
    contracts = min(order["contracts"], MAX_CONTRACTS)
    action    = "BUY" if direction == "long" else "SELL"

    await place_bracket_order(
        ib, instrument,
        quantity=contracts,
        action=action,
        entry_price=result["close"],
        stop_loss=order["stop_loss"],
        take_profit=order["take_profit"],
        trade_meta={
            "ml_confidence":  result.get("ml_confidence"),
            "regime_state":   result.get("regime"),
            "delta_at_entry": result.get("delta"),
            "vwap_at_entry":  result.get("vwap"),
            "atr_at_entry":   result.get("atr"),
            "kelly_fraction": order.get("kelly_fraction"),
        },
        risk_callback=lambda won, pnl: risk.record_trade(won=won, pnl=pnl),
    )
    await write_signal(instrument, result, fired=True, skip_reason=None)
    log.info(
        f"Trade placed: {action} {instrument} {contracts} contracts "
        f"@ {result['close']}  stop={order['stop_loss']}  tp={order['take_profit']}"
    )

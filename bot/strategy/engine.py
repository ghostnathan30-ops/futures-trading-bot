import asyncio
import logging
from datetime import datetime, timezone
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
from config import INSTRUMENTS, ML_MIN_CONFIDENCE, CONFLUENCE_THRESHOLD

log = logging.getLogger(__name__)

risk = RiskManager()
pairs = PairsMonitor()
regimes = {instr: RegimeDetector() for instr in INSTRUMENTS}


async def run_strategy_loop(ib: IB):
    log.info("Strategy engine started")

    # Initial regime fit
    for instr in INSTRUMENTS:
        df = await get_bars(ib, instr, "1 hour", "365 D")
        if not df.empty:
            regimes[instr].fit(df)
            log.info(f"Regime detector fitted for {instr}")

    while True:
        ib = await ensure_connected(ib)
        try:
            account = await get_account_values(ib)
            equity = account["net_liq"]
            await write_account_snapshot(account)

            if risk.daily_kill_triggered(equity):
                log.warning("Daily kill switch triggered — halting trading")
                await asyncio.sleep(3600)
                continue

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

    if result["regime"] != "trending":
        await write_signal(instrument, result, fired=False,
                           skip_reason=f"regime={result['regime']}")
        return

    if result["score"] < CONFLUENCE_THRESHOLD:
        await write_signal(instrument, result, fired=False,
                           skip_reason=f"confluence={result['score']}<{CONFLUENCE_THRESHOLD}")
        return

    if instrument in ("ES", "NQ"):
        df_es = await get_bars(ib, "ES", "15 mins", "5 D")
        df_nq = await get_bars(ib, "NQ", "15 mins", "5 D")
        if not df_es.empty and not df_nq.empty:
            spread_signal = pairs.evaluate(df_es["close"], df_nq["close"])
            if instrument == "ES" and spread_signal == "long_nq_short_es":
                await write_signal(instrument, result, fired=False, skip_reason="pairs:favor_nq")
                return
            if instrument == "NQ" and spread_signal == "long_es_short_nq":
                await write_signal(instrument, result, fired=False, skip_reason="pairs:favor_es")
                return

    if not ml_approved(instrument, df_15m):
        await write_signal(instrument, result, fired=False, skip_reason="ml_filter")
        return

    order = risk.compute_order(instrument, result["close"], result["atr"], equity)
    await place_bracket_order(
        ib, instrument,
        quantity=order["contracts"],
        action="BUY",
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
    )
    await write_signal(instrument, result, fired=True, skip_reason=None)
    log.info(f"Trade placed: {instrument} {order['contracts']} contracts @ {result['close']}")

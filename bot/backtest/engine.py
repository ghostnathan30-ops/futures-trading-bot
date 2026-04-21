"""
Backtest engine — invoked as a subprocess by the FastAPI route.

Usage:
    python -m backtest.engine \\
        --run_id   <uuid>      \\
        --instrument ES        \\
        --start_date 2024-01-01 \\
        --end_date   2025-01-01 \\
        --initial_equity 100000

Architecture:
  1. Download 2yr of 1h bars via yfinance (no IBKR connection needed)
  2. Resample to 4h
  3. Fit RegimeDetector on 200-bar warmup window
  4. Walk forward bar-by-bar:
       - Check open trade for SL/TP exit
       - Score confluence using existing strategy code
       - Enter long when regime=trending AND score >= threshold
  5. Write results + equity curve + trades to PostgreSQL

Note on 15m proxy:
    yfinance provides max ~730 days at 1h resolution.
    To maximise history, 1h bars are passed as BOTH the df_15m and df_1h
    argument to score_confluence(). Signal 3 (15m MACD crossover) therefore
    fires on 1h crossovers — a deliberate tradeoff for 2x the data.

Note on ML filter:
    Skipped in backtest to avoid lookahead bias (models would need to be
    trained only on pre-backtest data). ml_confidence stored as NULL.
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime

import asyncpg
import pandas as pd

# Make sure bot/ root is on the path so strategy.* imports resolve
_BOT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BOT_ROOT not in sys.path:
    sys.path.insert(0, _BOT_ROOT)

from backtest.data_loader import (
    fetch_1h_bars, fetch_1d_bars,
    resample_to_4h, resample_to_weekly,
    slice_window, POINT_VALUES,
)
from backtest.metrics import compute_metrics
from strategy.confluence import score_confluence
from strategy.regime_hmm import RegimeDetector
from config import (
    ATR_STOP_MULT, ATR_TP_MULT,
    BACKTEST_CONFLUENCE_THRESHOLD, BACKTEST_REGIME_THRESHOLDS,
    BACKTEST_ATR_STOP_MULT, BACKTEST_ATR_TP_MULT,
    BACKTEST_MAX_HOLD_BARS, BACKTEST_MAX_HOLD_BARS_1D,
    BACKTEST_WARMUP_BARS, ATR_TRAIL_TRIGGER_MULT, ATR_TRAIL_DIST_MULT,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

WARMUP_BARS = 200   # minimum bars before first signal is evaluated
MAX_EQUITY_CURVE_POINTS = 2000  # downsample before DB insert


# ─── DB helpers ──────────────────────────────────────────────────────────────

async def _get_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", 5432)),
        database=os.environ.get("POSTGRES_DB", "tradingbot"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        min_size=1,
        max_size=3,
    )


# ─── Main backtest coroutine ──────────────────────────────────────────────────

async def run_backtest(
    run_id: str,
    instrument: str,
    start_date: str,
    end_date: str,
    initial_equity: float,
    timeframe: str = "1h",
) -> None:

    pool: asyncpg.Pool | None = None
    db_run_id: int | None = None

    try:
        pool = await _get_pool()
        # ── 1. Upsert run record ────────────────────────────────────────────
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM backtest_runs WHERE run_id = $1", run_id
            )
            if row:
                db_run_id = row["id"]
                await conn.execute(
                    "UPDATE backtest_runs SET status='running' WHERE id=$1", db_run_id
                )
            else:
                db_run_id = await conn.fetchval("""
                    INSERT INTO backtest_runs
                      (run_id, instrument, start_date, end_date, initial_equity, status)
                    VALUES ($1,$2,$3,$4,$5,'running')
                    RETURNING id
                """,
                    run_id,
                    instrument,
                    datetime.strptime(start_date, "%Y-%m-%d").date(),
                    datetime.strptime(end_date,   "%Y-%m-%d").date(),
                    initial_equity,
                )

        # ── 2. Download data ────────────────────────────────────────────────
        log.info(f"[{run_id[:8]}] Downloading {timeframe} bars for {instrument}")
        if timeframe == "1d":
            df_1h_full = fetch_1d_bars(instrument)      # daily bars as base
            df_4h_full = resample_to_weekly(df_1h_full) # weekly bars as trend context
        else:
            df_1h_full = fetch_1h_bars(instrument)
            df_4h_full = resample_to_4h(df_1h_full)

        # Convert user date strings to UTC timestamps
        start_ts = pd.Timestamp(start_date, tz="UTC")
        end_ts   = pd.Timestamp(end_date,   tz="UTC")

        idx = df_1h_full.index
        start_pos = idx.searchsorted(start_ts, side="left")
        end_pos   = idx.searchsorted(end_ts,   side="right") - 1

        if start_pos < WARMUP_BARS:
            log.warning(
                f"Only {start_pos} bars before start_date; "
                f"adjusting start to bar {WARMUP_BARS} "
                f"({idx[WARMUP_BARS].date() if WARMUP_BARS < len(idx) else 'end of data'})"
            )
            start_pos = WARMUP_BARS

        if end_pos <= start_pos:
            raise ValueError(
                f"Insufficient data: start_pos={start_pos}, end_pos={end_pos}. "
                f"Try a later start_date or ensure yfinance data covers the range."
            )

        # ── 3. Fit regime detector on warmup ────────────────────────────────
        log.info(f"[{run_id[:8]}] Fitting regime detector on {start_pos} warmup bars")
        regime_detector = RegimeDetector()
        warmup_df = df_1h_full.iloc[:start_pos].copy()
        regime_detector.fit(warmup_df)

        # ── 4. Walk-forward loop ─────────────────────────────────────────────
        n_bars = end_pos - start_pos + 1
        log.info(f"[{run_id[:8]}] Walking {n_bars} bars "
                 f"({idx[start_pos].date()} → {idx[end_pos].date()})")

        equity        = initial_equity
        equity_curve:  list[tuple] = []  # (timestamp, equity)
        pnl_list:      list[float] = []
        trade_rows:    list[dict]  = []
        open_trade:    dict | None = None
        point_value   = POINT_VALUES.get(instrument, 50)
        errors_logged = 0

        # Timeframe-specific parameters
        max_hold_bars = BACKTEST_MAX_HOLD_BARS_1D if timeframe == "1d" else BACKTEST_MAX_HOLD_BARS
        warmup_window = BACKTEST_WARMUP_BARS
        warmup_4h     = max(10, warmup_window // (5 if timeframe == "1d" else 4))

        # Per-instrument ATR multipliers
        stop_mult = BACKTEST_ATR_STOP_MULT.get(instrument, ATR_STOP_MULT)
        tp_mult   = BACKTEST_ATR_TP_MULT.get(instrument, ATR_TP_MULT)

        for i in range(start_pos, end_pos + 1):
            bar_ts        = idx[i]
            current_close = float(df_1h_full["close"].iat[i])

            # ── Check open trade exit ────────────────────────────────────────
            if open_trade:
                side = open_trade["side"]
                atr_at_entry = open_trade["atr"]

                if side == "LONG":
                    # Update best price and trailing stop
                    open_trade["best_price"] = max(open_trade["best_price"], current_close)
                    if (open_trade["best_price"] - open_trade["entry_price"]) >= ATR_TRAIL_TRIGGER_MULT * atr_at_entry:
                        new_trail = open_trade["best_price"] - ATR_TRAIL_DIST_MULT * atr_at_entry
                        if open_trade["trail_stop"] is None or new_trail > open_trade["trail_stop"]:
                            open_trade["trail_stop"] = new_trail

                    effective_stop = open_trade["stop"]
                    if open_trade["trail_stop"] is not None:
                        effective_stop = max(effective_stop, open_trade["trail_stop"])

                    hit_stop = current_close <= effective_stop
                    hit_tp   = current_close >= open_trade["tp"]
                    exit_price = effective_stop if hit_stop else open_trade["tp"]

                else:  # SHORT
                    # Update best price (lowest seen) and trailing stop
                    open_trade["best_price"] = min(open_trade["best_price"], current_close)
                    if (open_trade["entry_price"] - open_trade["best_price"]) >= ATR_TRAIL_TRIGGER_MULT * atr_at_entry:
                        new_trail = open_trade["best_price"] + ATR_TRAIL_DIST_MULT * atr_at_entry
                        if open_trade["trail_stop"] is None or new_trail < open_trade["trail_stop"]:
                            open_trade["trail_stop"] = new_trail

                    effective_stop = open_trade["stop"]
                    if open_trade["trail_stop"] is not None:
                        effective_stop = min(effective_stop, open_trade["trail_stop"])

                    hit_stop = current_close >= effective_stop
                    hit_tp   = current_close <= open_trade["tp"]
                    exit_price = effective_stop if hit_stop else open_trade["tp"]

                # Max hold period exit
                bars_held    = i - open_trade["entry_bar"]
                hit_max_hold = bars_held >= max_hold_bars

                if hit_stop or hit_tp or hit_max_hold:
                    exit_reason = "stop_loss" if hit_stop else ("take_profit" if hit_tp else "max_hold")
                    if hit_max_hold and not hit_stop and not hit_tp:
                        exit_price = current_close   # close at market on max-hold

                    if side == "LONG":
                        raw_pnl = (exit_price - open_trade["entry_price"]) * point_value
                    else:
                        raw_pnl = (open_trade["entry_price"] - exit_price) * point_value

                    equity += raw_pnl
                    pnl_list.append(raw_pnl)
                    trade_rows.append({
                        "instrument":       instrument,
                        "side":             side,
                        "quantity":         1,
                        "entry_ts":         open_trade["entry_ts"],
                        "exit_ts":          bar_ts,
                        "entry_price":      open_trade["entry_price"],
                        "exit_price":       exit_price,
                        "pnl":              raw_pnl,
                        "pnl_pct":          raw_pnl / (open_trade["entry_price"] * point_value)
                                            if open_trade["entry_price"] else 0.0,
                        "confluence_score": open_trade["score"],
                        "ml_confidence":    None,
                        "regime_state":     open_trade["regime"],
                        "exit_reason":      exit_reason,
                    })
                    open_trade = None

            # Record equity this bar
            equity_curve.append((bar_ts, equity))

            # ── Look for new entry (only when flat) ──────────────────────────
            if open_trade is not None:
                continue

            # Slice rolling windows
            w_1h = slice_window(df_1h_full, i, warmup_window)

            # Map base bar index to trend-context (4h/weekly) bar index
            idx_4h = df_4h_full.index
            pos_4h = max(0, idx_4h.searchsorted(bar_ts, side="right") - 1)
            w_4h   = slice_window(df_4h_full, pos_4h, warmup_4h)

            if len(w_1h) < 50 or len(w_4h) < 10:
                continue

            try:
                result = score_confluence(
                    w_1h,            # df_15m proxy (1h bars — accepted tradeoff)
                    w_1h,            # df_1h
                    w_4h,            # df_4h
                    instrument,
                    regime_detector,
                )
            except Exception as exc:
                errors_logged += 1
                if errors_logged <= 5:
                    log.debug(f"score_confluence error at bar {i} ({bar_ts}): {exc}")
                continue

            regime      = result.get("regime", "ranging")
            score       = result.get("score", 0)
            short_score = result.get("short_score", 0)
            atr         = result.get("atr")

            if not atr or atr != atr:   # None or NaN guard
                continue

            # Regime-aware threshold (not a hard gate — volatile markets require higher score)
            threshold = BACKTEST_REGIME_THRESHOLDS.get(regime, BACKTEST_CONFLUENCE_THRESHOLD)

            entry_price = current_close

            if score >= threshold:
                # LONG entry
                open_trade = {
                    "side":        "LONG",
                    "entry_price": entry_price,
                    "stop":        entry_price - stop_mult * atr,
                    "tp":          entry_price + tp_mult   * atr,
                    "trail_stop":  None,
                    "best_price":  entry_price,
                    "entry_ts":    bar_ts,
                    "entry_bar":   i,
                    "score":       score,
                    "regime":      regime,
                    "atr":         atr,
                }
            elif short_score >= threshold:
                # SHORT entry (only if long is not triggered)
                open_trade = {
                    "side":        "SHORT",
                    "entry_price": entry_price,
                    "stop":        entry_price + stop_mult * atr,
                    "tp":          entry_price - tp_mult   * atr,
                    "trail_stop":  None,
                    "best_price":  entry_price,
                    "entry_ts":    bar_ts,
                    "entry_bar":   i,
                    "score":       short_score,
                    "regime":      regime,
                    "atr":         atr,
                }

        # ── Force-close any open trade at end of data ────────────────────────
        if open_trade:
            last_close = float(df_1h_full["close"].iat[end_pos])
            side = open_trade["side"]
            if side == "LONG":
                raw_pnl = (last_close - open_trade["entry_price"]) * point_value
            else:
                raw_pnl = (open_trade["entry_price"] - last_close) * point_value
            equity    += raw_pnl
            pnl_list.append(raw_pnl)
            trade_rows.append({
                "instrument":       instrument,
                "side":             side,
                "quantity":         1,
                "entry_ts":         open_trade["entry_ts"],
                "exit_ts":          idx[end_pos],
                "entry_price":      open_trade["entry_price"],
                "exit_price":       last_close,
                "pnl":              raw_pnl,
                "pnl_pct":          raw_pnl / (open_trade["entry_price"] * point_value)
                                    if open_trade["entry_price"] else 0.0,
                "confluence_score": open_trade["score"],
                "ml_confidence":    None,
                "regime_state":     open_trade["regime"],
                "exit_reason":      "end_of_data",
            })
            # Update final equity curve point with the closed equity
            if equity_curve:
                equity_curve[-1] = (equity_curve[-1][0], equity)

        # ── 5. Compute metrics ───────────────────────────────────────────────
        eq_values = [e for _, e in equity_curve]
        metrics   = compute_metrics(pnl_list, eq_values, initial_equity)

        log.info(
            f"[{run_id[:8]}] Completed: {metrics['total_trades']} trades | "
            f"return={metrics['total_return']:.2%} | "
            f"sharpe={metrics['sharpe']:.2f} | "
            f"win_rate={metrics['win_rate']:.1%} | "
            f"max_dd={metrics['max_drawdown']:.2%}"
        )

        # ── 6. Write to DB ───────────────────────────────────────────────────
        async with pool.acquire() as conn:
            # Update run summary
            await conn.execute("""
                UPDATE backtest_runs SET
                  final_equity=$1,  total_return=$2,  sharpe=$3,
                  sortino=$4,        max_drawdown=$5,  calmar=$6,
                  profit_factor=$7,  total_trades=$8,  wins=$9,
                  losses=$10,        win_rate=$11,     avg_win=$12,
                  avg_loss=$13,      expectancy=$14,   status='completed'
                WHERE id=$15
            """,
                metrics["final_equity"],  metrics["total_return"], metrics["sharpe"],
                metrics["sortino"],       metrics["max_drawdown"], metrics["calmar"],
                metrics["profit_factor"], metrics["total_trades"], metrics["wins"],
                metrics["losses"],        metrics["win_rate"],     metrics["avg_win"],
                metrics["avg_loss"],      metrics["expectancy"],   db_run_id,
            )

            # Insert trades (batch)
            if trade_rows:
                await conn.executemany("""
                    INSERT INTO backtest_trades
                      (backtest_run_id, instrument, side, quantity,
                       entry_ts, exit_ts, entry_price, exit_price,
                       pnl, pnl_pct, confluence_score, ml_confidence,
                       regime_state, exit_reason)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                """, [
                    (
                        db_run_id,       t["instrument"],  t["side"],       t["quantity"],
                        t["entry_ts"],   t["exit_ts"],     t["entry_price"], t["exit_price"],
                        t["pnl"],        t["pnl_pct"],     t["confluence_score"],
                        t["ml_confidence"], t["regime_state"], t["exit_reason"],
                    )
                    for t in trade_rows
                ])

            # Insert equity curve (downsampled)
            if equity_curve:
                step    = max(1, len(equity_curve) // MAX_EQUITY_CURVE_POINTS)
                sampled = equity_curve[::step]
                # Always include the last point
                if sampled[-1] != equity_curve[-1]:
                    sampled.append(equity_curve[-1])

                await conn.executemany("""
                    INSERT INTO backtest_equity_curve (backtest_run_id, ts, equity)
                    VALUES ($1,$2,$3)
                """, [(db_run_id, ts, eq) for ts, eq in sampled])

    except Exception as exc:
        log.error(f"[{run_id[:8]}] Backtest FAILED: {exc}", exc_info=True)
        if pool is not None and db_run_id is not None:
            try:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE backtest_runs SET status='failed' WHERE id=$1", db_run_id
                    )
            except Exception:
                pass
        raise
    finally:
        if pool is not None:
            await pool.close()


# ─── CLI entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backtest engine")
    parser.add_argument("--run_id",         required=True,  help="UUID for this run")
    parser.add_argument("--instrument",     required=True,  help="ES | NQ | GC")
    parser.add_argument("--start_date",     required=True,  help="YYYY-MM-DD")
    parser.add_argument("--end_date",       required=True,  help="YYYY-MM-DD")
    parser.add_argument("--initial_equity", required=True,  type=float, help="Starting capital")
    parser.add_argument("--timeframe",      default="1h",   help="1h (2yr) | 1d (25yr)")
    args = parser.parse_args()

    asyncio.run(run_backtest(
        args.run_id,
        args.instrument,
        args.start_date,
        args.end_date,
        args.initial_equity,
        args.timeframe,
    ))

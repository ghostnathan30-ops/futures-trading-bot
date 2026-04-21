"""
Performance metrics for backtest results.

Pure Python — no external dependencies beyond the standard library.
All metrics computed from a list of trade P&Ls and an equity curve.
"""
import math
from typing import List


def compute_metrics(
    pnl_list: List[float],
    equity_curve: List[float],
    initial_equity: float,
) -> dict:
    """
    Compute aggregate performance statistics.

    Args:
        pnl_list:      Per-trade dollar P&L values.
        equity_curve:  Account equity sampled at each bar (including flat periods).
        initial_equity: Starting capital.

    Returns:
        dict with keys: final_equity, total_return, sharpe, sortino, max_drawdown,
        calmar, profit_factor, total_trades, wins, losses, win_rate,
        avg_win, avg_loss, expectancy.
    """
    n = len(pnl_list)
    if n == 0 or len(equity_curve) < 2:
        return _zero_metrics(initial_equity)

    wins   = [p for p in pnl_list if p > 0]
    losses = [p for p in pnl_list if p <= 0]

    win_rate      = len(wins) / n
    avg_win       = sum(wins) / len(wins)   if wins   else 0.0
    avg_loss      = abs(sum(losses) / len(losses)) if losses else 0.0
    expectancy    = (win_rate * avg_win) - ((1.0 - win_rate) * avg_loss)
    loss_sum      = abs(sum(losses)) if losses else 0.0
    profit_factor = (sum(wins) / loss_sum) if loss_sum > 0 else float("inf")

    # Bar-level returns for risk-adjusted metrics
    bar_returns: List[float] = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1]
        if prev and prev != 0:
            bar_returns.append((equity_curve[i] - prev) / prev)

    sharpe      = _sharpe(bar_returns)
    sortino     = _sortino(bar_returns)
    max_dd      = _max_drawdown(equity_curve)
    total_ret   = (equity_curve[-1] - initial_equity) / initial_equity if initial_equity else 0.0
    calmar      = total_ret / max_dd if max_dd > 0 else 0.0

    return {
        "final_equity":  round(equity_curve[-1], 2),
        "total_return":  round(total_ret, 6),
        "sharpe":        round(sharpe, 4),
        "sortino":       round(sortino, 4),
        "max_drawdown":  round(max_dd, 6),
        "calmar":        round(calmar, 4),
        "profit_factor": round(min(profit_factor, 999.0), 4),
        "total_trades":  n,
        "wins":          len(wins),
        "losses":        len(losses),
        "win_rate":      round(win_rate, 4),
        "avg_win":       round(avg_win, 2),
        "avg_loss":      round(avg_loss, 2),
        "expectancy":    round(expectancy, 2),
    }


# ─── Internal helpers ────────────────────────────────────────────────────────

# Annualisation factor: 1h bars, ~6.5 trading hours/day, 252 trading days/yr
_ANNUAL = math.sqrt(252 * 6.5)


def _sharpe(returns: List[float]) -> float:
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    var  = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    std  = math.sqrt(var)
    return (mean / std) * _ANNUAL if std > 0 else 0.0


def _sortino(returns: List[float]) -> float:
    if len(returns) < 2:
        return 0.0
    mean = sum(returns) / len(returns)
    neg  = [r for r in returns if r < 0]
    if not neg:
        return 99.0  # no downside volatility — cap to avoid NUMERIC overflow in DB
    downside_var = sum(r ** 2 for r in neg) / len(returns)
    downside_std = math.sqrt(downside_var)
    return (mean / downside_std) * _ANNUAL if downside_std > 0 else 0.0


def _max_drawdown(equity_curve: List[float]) -> float:
    peak   = equity_curve[0]
    max_dd = 0.0
    for eq in equity_curve:
        if eq > peak:
            peak = eq
        dd = (peak - eq) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return max_dd


def _zero_metrics(initial_equity: float) -> dict:
    return {
        "final_equity": initial_equity, "total_return": 0.0,
        "sharpe": 0.0, "sortino": 0.0, "max_drawdown": 0.0, "calmar": 0.0,
        "profit_factor": 0.0, "total_trades": 0, "wins": 0, "losses": 0,
        "win_rate": 0.0, "avg_win": 0.0, "avg_loss": 0.0, "expectancy": 0.0,
    }

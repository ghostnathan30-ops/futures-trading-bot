import logging
from datetime import date as _date
from strategy.kelly import kelly_fraction, position_size_contracts, POINT_VALUES
from config import RISK_PCT, ATR_STOP_MULT, ATR_TP_MULT, DAILY_KILL_PCT

log = logging.getLogger(__name__)


class RiskManager:
    def __init__(self):
        self._daily_pnl = 0.0
        self._last_reset_date = _date.today()
        self._peak_equity = None
        # Seed with neutral stats; updated by record_trade() after each fill
        self._win_rate = 0.55
        self._avg_win  = 300.0
        self._avg_loss = 150.0

    def record_trade(self, won: bool, pnl: float):
        """Update Kelly stats from a single trade outcome using EMA smoothing."""
        alpha = 0.1  # smoothing factor — higher = faster adaptation
        self._win_rate = self._win_rate * (1 - alpha) + (1.0 if won else 0.0) * alpha
        if won:
            self._avg_win = self._avg_win * (1 - alpha) + pnl * alpha
        else:
            self._avg_loss = self._avg_loss * (1 - alpha) + pnl * alpha
        signed_pnl = pnl if won else -pnl
        self._daily_pnl += signed_pnl
        log.info(
            f"Trade recorded: {'WIN' if won else 'LOSS'} P&L={signed_pnl:.0f} | "
            f"win_rate={self._win_rate:.2f} avg_win={self._avg_win:.0f} "
            f"avg_loss={self._avg_loss:.0f}"
        )

    def update_stats(self, win_rate: float, avg_win: float, avg_loss: float):
        """Bulk update (e.g. from backtester or manual calibration)."""
        self._win_rate = win_rate
        self._avg_win  = avg_win
        self._avg_loss = avg_loss

    def update_daily_pnl(self, pnl: float):
        self._daily_pnl += pnl

    def reset_daily(self):
        self._daily_pnl = 0.0

    def daily_kill_triggered(self, equity: float) -> bool:
        # Auto-reset P&L counter at start of each trading day
        today = _date.today()
        if today != self._last_reset_date:
            self._daily_pnl = 0.0
            self._last_reset_date = today
            log.info("Daily P&L counter reset for new trading day")

        if self._peak_equity is None:
            self._peak_equity = equity
        self._peak_equity = max(self._peak_equity, equity)
        drawdown = (self._peak_equity - equity) / self._peak_equity
        if drawdown >= DAILY_KILL_PCT:
            log.warning(f"Daily kill triggered: drawdown={drawdown:.2%}")
            return True
        return False

    def compute_order(
        self,
        instrument: str,
        entry: float,
        atr: float,
        equity: float,
        direction: str = "long",
    ) -> dict:
        """Compute bracket order parameters with Kelly position sizing.

        Args:
            direction: "long" or "short" — flips stop/target placement.
        """
        kf = kelly_fraction(self._win_rate, self._avg_win, self._avg_loss)
        contracts = position_size_contracts(
            equity=equity,
            kelly_f=max(kf, RISK_PCT),
            atr=atr,
            atr_stop_mult=ATR_STOP_MULT,
            point_value=POINT_VALUES[instrument],
        )

        if direction == "long":
            stop_loss   = round(entry - ATR_STOP_MULT * atr, 2)
            take_profit = round(entry + ATR_TP_MULT   * atr, 2)
        else:  # short
            stop_loss   = round(entry + ATR_STOP_MULT * atr, 2)
            take_profit = round(entry - ATR_TP_MULT   * atr, 2)

        return {
            "contracts":    contracts,
            "stop_loss":    stop_loss,
            "take_profit":  take_profit,
            "kelly_fraction": kf,
        }

import logging
from strategy.kelly import kelly_fraction, position_size_contracts, POINT_VALUES
from config import RISK_PCT, ATR_STOP_MULT, ATR_TP_MULT, DAILY_KILL_PCT

log = logging.getLogger(__name__)


class RiskManager:
    def __init__(self):
        self._daily_pnl = 0.0
        self._peak_equity = None
        self._win_rate = 0.55
        self._avg_win = 300.0
        self._avg_loss = 150.0

    def update_stats(self, win_rate: float, avg_win: float, avg_loss: float):
        self._win_rate = win_rate
        self._avg_win = avg_win
        self._avg_loss = avg_loss

    def update_daily_pnl(self, pnl: float):
        self._daily_pnl += pnl

    def reset_daily(self):
        self._daily_pnl = 0.0

    def daily_kill_triggered(self, equity: float) -> bool:
        if self._peak_equity is None:
            self._peak_equity = equity
        self._peak_equity = max(self._peak_equity, equity)
        drawdown = (self._peak_equity - equity) / self._peak_equity
        if drawdown >= DAILY_KILL_PCT:
            log.warning(f"Daily kill triggered: drawdown={drawdown:.2%}")
            return True
        return False

    def compute_order(self, instrument: str, entry: float, atr: float, equity: float) -> dict:
        kf = kelly_fraction(self._win_rate, self._avg_win, self._avg_loss)
        contracts = position_size_contracts(
            equity=equity,
            kelly_f=max(kf, RISK_PCT),
            atr=atr,
            atr_stop_mult=ATR_STOP_MULT,
            point_value=POINT_VALUES[instrument],
        )
        stop_loss = round(entry - ATR_STOP_MULT * atr, 2)
        take_profit = round(entry + ATR_TP_MULT * atr, 2)
        return {
            "contracts": contracts,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "kelly_fraction": kf,
        }

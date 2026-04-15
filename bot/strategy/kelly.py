def kelly_fraction(win_rate: float, avg_win: float, avg_loss: float) -> float:
    if avg_loss == 0 or avg_win == 0:
        return 0.0
    b = avg_win / avg_loss
    q = 1 - win_rate
    f = (win_rate * b - q) / b
    f = max(0.0, f)
    return min(f, 0.25)

def position_size_contracts(equity: float, kelly_f: float, atr: float, atr_stop_mult: float, point_value: float) -> int:
    if atr == 0 or kelly_f == 0:
        return 0
    risk_dollars = equity * kelly_f
    stop_dollars = atr * atr_stop_mult * point_value
    contracts = int(risk_dollars / stop_dollars)
    return max(1, contracts)

POINT_VALUES = {"ES": 50.0, "NQ": 20.0, "GC": 100.0}

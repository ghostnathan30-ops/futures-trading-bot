import asyncio
import logging
from datetime import datetime, timezone
import pandas as pd
from ib_insync import IB, Future
from config import INSTRUMENTS, INSTRUMENT_EXCHANGE, INSTRUMENT_CURRENCY

log = logging.getLogger(__name__)

# Rollover: number of days before expiry to switch to next contract
ROLLOVER_DAYS_AHEAD = 5

# Quarterly cycle: Mar/Jun/Sep/Dec for ES & NQ; Feb/Apr/Jun/Aug/Oct/Dec for GC
_QUARTERLY = [3, 6, 9, 12]
_GC_MONTHS  = [2, 4, 6, 8, 10, 12]


def _bootstrap_front_month(instrument: str) -> str:
    """
    Calculate the correct active contract month from today's date.
    Does not rely on any previously stored value — safe to call at module load time.
    """
    now = datetime.now(timezone.utc)
    cycle = _GC_MONTHS if instrument == "GC" else _QUARTERLY
    candidates = [(y, m) for y in [now.year - 1, now.year, now.year + 1] for m in cycle]
    for (y, m) in candidates:
        first = datetime(y, m, 1, tzinfo=timezone.utc)
        days_to_friday = (4 - first.weekday()) % 7  # 4 = Friday
        third_friday = first.replace(day=1 + days_to_friday + 14)
        if (third_friday - now).days > ROLLOVER_DAYS_AHEAD:
            return f"{y}{m:02d}"
    y, m = candidates[-1]
    return f"{y}{m:02d}"


# Active contract months — bootstrapped from today's date, updated by _resolve_front_month()
CONTRACT_MONTHS = {i: _bootstrap_front_month(i) for i in ["ES", "NQ", "GC"]}
log.info(f"Contract months bootstrapped: {CONTRACT_MONTHS}")


def _next_contract_month(instrument: str, current_ym: str) -> str:
    """Return the next contract month string (YYYYMM) after current_ym."""
    year  = int(current_ym[:4])
    month = int(current_ym[4:])
    cycle = _GC_MONTHS if instrument == "GC" else _QUARTERLY
    future_months = [(year, m) for m in cycle if m > month] + \
                    [(year + 1, m) for m in cycle]
    y, m = future_months[0]
    return f"{y}{m:02d}"


def _resolve_front_month(instrument: str) -> str:
    """
    Return the active contract month, rolling over ROLLOVER_DAYS_AHEAD days
    before the last trading day (approximated as the 3rd Friday of expiry month).
    """
    now = datetime.now(timezone.utc)
    current = CONTRACT_MONTHS[instrument]
    exp_year  = int(current[:4])
    exp_month = int(current[4:])

    # Approximate last trading day: 3rd Friday of expiry month
    # Find first day of month, then first Friday, then +14 days
    first = datetime(exp_year, exp_month, 1, tzinfo=timezone.utc)
    days_to_friday = (4 - first.weekday()) % 7  # 4 = Friday
    third_friday   = first.replace(day=1 + days_to_friday + 14)

    days_left = (third_friday - now).days
    if days_left <= ROLLOVER_DAYS_AHEAD:
        new_month = _next_contract_month(instrument, current)
        if new_month != current:
            log.warning(f"Rolling {instrument} from {current} → {new_month} "
                        f"({days_left} days to expiry)")
            CONTRACT_MONTHS[instrument] = new_month
        return new_month
    return current


def get_contract(instrument: str) -> Future:
    ym = _resolve_front_month(instrument)
    return Future(
        symbol=instrument,
        lastTradeDateOrContractMonth=ym,
        exchange=INSTRUMENT_EXCHANGE[instrument],
        currency=INSTRUMENT_CURRENCY[instrument],
    )


async def get_bars(ib: IB, instrument: str, bar_size: str, lookback: str) -> pd.DataFrame:
    """Fetch historical bars from IBKR."""
    contract = get_contract(instrument)
    await ib.qualifyContractsAsync(contract)

    bars = await ib.reqHistoricalDataAsync(
        contract,
        endDateTime="",
        durationStr=lookback,
        barSizeSetting=bar_size,
        whatToShow="TRADES",
        useRTH=False,
        formatDate=1,
    )
    if not bars:
        log.warning(f"No bars returned for {instrument} {bar_size}")
        return pd.DataFrame()

    df = pd.DataFrame([{
        "ts": b.date,
        "open": b.open,
        "high": b.high,
        "low": b.low,
        "close": b.close,
        "volume": b.volume,
    } for b in bars])
    df["ts"] = pd.to_datetime(df["ts"])
    df.set_index("ts", inplace=True)
    return df


async def get_tick_data(ib: IB, instrument: str) -> dict:
    """Get current bid/ask/last for delta calculation."""
    contract = get_contract(instrument)
    await ib.qualifyContractsAsync(contract)
    ticker = ib.reqMktData(contract, "", False, False)
    await asyncio.sleep(1)
    return {
        "bid": ticker.bid,
        "ask": ticker.ask,
        "last": ticker.last,
        "bid_size": ticker.bidSize,
        "ask_size": ticker.askSize,
        "volume": ticker.volume,
    }

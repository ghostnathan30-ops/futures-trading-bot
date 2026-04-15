import asyncio
import logging
import pandas as pd
from ib_insync import IB, Future
from config import INSTRUMENTS, INSTRUMENT_EXCHANGE, INSTRUMENT_CURRENCY

log = logging.getLogger(__name__)

# Active contract months (update on rollover)
CONTRACT_MONTHS = {"ES": "202506", "NQ": "202506", "GC": "202506"}


def get_contract(instrument: str) -> Future:
    ym = CONTRACT_MONTHS[instrument]
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

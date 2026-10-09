"""BigTrader weight strategy template based on the supplied V2 API snapshot."""

import pandas as pd
from bigquant import bigtrader, dai

START_DATE = "2024-01-01"
END_DATE = "2025-03-07"
HOLD_COUNT = 10
REBALANCE_DAYS = 5
CAPITAL = 1000000


def initialize(context: bigtrader.IContext):
    context.set_commission(bigtrader.PerOrder(buy_cost=0.0003, sell_cost=0.0013, min_cost=5))
    if HOLD_COUNT < 1 or REBALANCE_DAYS < 1:
        raise ValueError("HOLD_COUNT and REBALANCE_DAYS must be positive")
    sql = """
    SELECT
        date,
        instrument,
        close / m_lag(close, 5) - 1 AS factor
    FROM cn_stock_prefactors
    WHERE st_status = 0 AND suspended = 0
    QUALIFY factor IS NOT NULL
    ORDER BY date, factor DESC, instrument
    """
    df = dai.query(
        sql,
        filters={"date": [context.add_trading_days(context.start_date, -10), context.end_date]},
    ).df()
    # Warm-up rows are used for factors only, not for actual allocation.
    df = df.loc[pd.to_datetime(df["date"]) >= pd.Timestamp(context.start_date)].copy()
    df = df.groupby("date", sort=False).head(HOLD_COUNT).copy()
    # Normalize against the actual number selected, including days with fewer candidates.
    df["weight"] = 1.0 / df.groupby("date")["instrument"].transform("count")
    context.data = bigtrader.TradingDaysRebalance(REBALANCE_DAYS, context=context).select_rebalance_data(df)


def main():
    performance = bigtrader.run(
        market=bigtrader.Market.CN_STOCK,
        frequency=bigtrader.Frequency.DAILY,
        start_date=START_DATE,
        end_date=END_DATE,
        capital_base=CAPITAL,
        initialize=initialize,
        handle_data=bigtrader.HandleDataLib.handle_data_weight_based,
        benchmark="000300.SH",
    )
    performance.render()


if __name__ == "__main__":
    main()

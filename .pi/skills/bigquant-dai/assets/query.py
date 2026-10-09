"""DAI query template. Generate/copy it for AIStudio; do not execute locally."""

import dai

START_DATE = "2024-01-01"
END_DATE = "2025-03-07"
INSTRUMENT = "000001.SZ"


def query_data():
    sql = """
    SELECT
        date,
        instrument,
        open,
        close,
        close / m_lag(close, 1) - 1 AS daily_return,
        m_avg(close, 5) AS ma_5
    FROM cn_stock_bar1d
    ORDER BY date, instrument
    """
    # Read a warm-up interval before the requested result range.
    df = dai.query(
        sql,
        filters={"date": ["2023-12-01", END_DATE], "instrument": [INSTRUMENT]},
    ).df()
    dates = df["date"].astype(str).str[:10]
    return df.loc[(dates >= START_DATE) & (dates <= END_DATE)].copy()


if __name__ == "__main__":
    result = query_data()
    print(result)

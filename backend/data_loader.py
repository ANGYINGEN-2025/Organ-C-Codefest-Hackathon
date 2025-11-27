import pandas as pd
from pathlib import Path
from functools import lru_cache
import logging
from typing import Final, List, Dict, Any

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "Walmart_Sales.csv"

# Only load the columns actually used by the API to cut memory in half
USE_COLUMNS: Final[List[str]] = [
    "Store",
    "Dept",
    "Date",
    "Weekly_Sales",
    "IsHoliday",
    "Temperature",
    "Fuel_Price",
    "CPI",
    "Unemployment",
]

# Downcast numeric columns to reduce memory footprint
DTYPE_MAP: Final[Dict[str, Any]] = {
    "Store": "int16",
    "Dept": "int16",
    "Weekly_Sales": "float32",
    "Temperature": "float32",
    "Fuel_Price": "float32",
    "CPI": "float32",
    "Unemployment": "float32",
}

TRUE_VALUES = {"true", "1", "yes", "t"}


def _parse_is_holiday(value: Any) -> int:
    if isinstance(value, (int, bool)):
        return 1 if value else 0
    return 1 if str(value).strip().lower() in TRUE_VALUES else 0


@lru_cache(maxsize=1)
def load_raw_data_cached() -> pd.DataFrame:
    logger.info(f"Loading CSV from: {DATA_PATH}")
    df = pd.read_csv(
        DATA_PATH,
        usecols=USE_COLUMNS,
        dtype=DTYPE_MAP,
        parse_dates=["Date"],
        converters={"IsHoliday": _parse_is_holiday},
        memory_map=True,
    )

    # Ensure IsHoliday is an int8 (saves memory vs bool/object)
    df["IsHoliday"] = df["IsHoliday"].astype("int8")

    # FIX: Correct datetime parsing (parse_dates already handles mixed formats,
    # but keep explicit conversion for safety)
    df["Date"] = pd.to_datetime(df["Date"], format="mixed")

    mem_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)
    logger.info(f"Loaded sales dataset into memory ({mem_mb:.2f} MB)")

    return df

def load_raw_data(copy: bool = False) -> pd.DataFrame:
    """
    Load raw data from CSV.
    
    Args:
        copy: If True, return a copy. If False, return a view (default).
              Only use copy=True when you need to modify the DataFrame.
    
    Returns:
        DataFrame with the raw data
    """
    if copy:
        return load_raw_data_cached().copy()
    return load_raw_data_cached()

def get_time_series(store_id: int | None = None) -> pd.DataFrame:
    # Need copy since we're modifying (renaming, sorting)
    df = load_raw_data(copy=True)

    if store_id is not None:
        df = df[df["Store"] == store_id]
    else:
        df = df.groupby("Date", as_index=False)["Weekly_Sales"].sum()

    df = df.rename(columns={"Date": "timestamp", "Weekly_Sales": "value"})
    df = df.sort_values("timestamp")

    return df[["timestamp", "value"]]

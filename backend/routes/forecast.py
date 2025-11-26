from fastapi import APIRouter, Query, HTTPException
from typing import List
from data_loader import get_time_series
from ml.model import get_model
from routes.schemas import ForecastItem

router = APIRouter()

@router.get("/", response_model=List[ForecastItem])
def get_forecast(
    store_id: int | None = Query(default=None),
    periods: int = Query(default=6, ge=1, le=26)
):
    # Load real time-series data from CSV
    ts_df = get_time_series(store_id)
    
    if ts_df.empty:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found")

    # Call your trained forecast model (singleton instance)
    model = get_model()
    forecast_df = model.forecast(ts_df, periods=periods)

    # Format output
    forecast_df["timestamp"] = forecast_df["timestamp"].dt.strftime("%Y-%m-%d")

    return forecast_df.to_dict(orient="records")

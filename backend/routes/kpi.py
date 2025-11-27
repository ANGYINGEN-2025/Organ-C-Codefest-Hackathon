from fastapi import APIRouter, Query, HTTPException
from data_loader import load_raw_data
from routes.schemas import KPIResponse

router = APIRouter()

@router.get("/", response_model=KPIResponse)
def kpi_overview(
    store_id: int | None = Query(default=None, description="Filter by store ID"),
    dept: int | None = Query(default=None, description="Filter by department ID")
):
    """Get KPI metrics for sales data, optionally filtered by store and department."""
    # Use view (no copy) since we're only filtering/reading
    df = load_raw_data(copy=False)

    if store_id is not None:
        df = df[df["Store"] == store_id]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Store {store_id} not found")
    
    if dept is not None:
        df = df[df["Dept"] == dept]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Department {dept} not found")

    # Handle edge case where no holiday data exists
    holiday_df = df[df["IsHoliday"] == 1]
    holiday_avg = float(holiday_df["Weekly_Sales"].mean()) if not holiday_df.empty else 0.0

    return {
        "avg_weekly_sales": float(df["Weekly_Sales"].mean()),
        "max_sales": float(df["Weekly_Sales"].max()),
        "min_sales": float(df["Weekly_Sales"].min()),
        "volatility": float(df["Weekly_Sales"].std()),
        "holiday_sales_avg": holiday_avg
    }

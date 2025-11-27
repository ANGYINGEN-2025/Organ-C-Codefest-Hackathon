from fastapi import APIRouter
from data_loader import load_raw_data
from routes.schemas import StoresListResponse, StoreInfo

router = APIRouter()


@router.get("/", response_model=StoresListResponse)
def list_stores():
    """
    Get a list of all available stores with summary statistics.
    
    Returns store IDs, total sales, average weekly sales, and department count.
    """
    # Use view (no copy) since we're only aggregating/reading
    df = load_raw_data(copy=False)
    
    # Aggregate store data
    store_stats = df.groupby("Store").agg({
        "Weekly_Sales": ["sum", "mean"],
        "Dept": "nunique"
    }).reset_index()
    
    # Flatten column names
    store_stats.columns = ["store_id", "total_sales", "avg_weekly_sales", "num_departments"]
    
    stores = [
        StoreInfo(
            store_id=int(row["store_id"]),
            total_sales=float(row["total_sales"]),
            avg_weekly_sales=float(row["avg_weekly_sales"]),
            num_departments=int(row["num_departments"])
        )
        for _, row in store_stats.iterrows()
    ]
    
    return {
        "total_stores": len(stores),
        "stores": stores
    }


@router.get("/top")
def get_top_stores(limit: int = 10):
    """
    Get top performing stores by total sales.
    """
    # Use view (no copy) since we're only aggregating/reading
    df = load_raw_data(copy=False)
    
    top_stores = df.groupby("Store")["Weekly_Sales"].sum() \
        .sort_values(ascending=False) \
        .head(limit) \
        .reset_index()
    
    top_stores.columns = ["store_id", "total_sales"]
    
    return top_stores.to_dict(orient="records")



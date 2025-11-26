from fastapi import APIRouter
import pandas as pd
from ml.model import get_model
from routes.schemas import SalesDataInput, AnomalyResponse

router = APIRouter()

@router.post("/", response_model=AnomalyResponse)
def detect_anomaly(data: SalesDataInput):
    df = pd.DataFrame([data.dict()])
    model = get_model()  # Get singleton instance
    out = model.detect_anomalies(df).iloc[0]

    return {
        "anomaly": int(out["anomaly"]),
        "anomaly_score": float(out["anomaly_score"])
    }

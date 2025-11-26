from fastapi import APIRouter
import pandas as pd
from ml.model import get_model
from routes.schemas import SalesDataInput, RiskResponse
from services.risk_service import calculate_risk_from_analysis

router = APIRouter()


@router.post("/", response_model=RiskResponse)
def risk(data: SalesDataInput):
    """
    Calculate risk score based on anomaly detection and cluster analysis.
    
    Risk factors:
    - Anomaly detection: +40 points if anomaly detected
    - Extreme anomaly: +10 points if score exceeds threshold
    - High-risk cluster: +20 points if in clusters 6 or 7
    """
    model = get_model()
    df = pd.DataFrame([data.dict()])

    # Detect anomalies
    anomaly_out = model.detect_anomalies(df).iloc[0]
    anomaly_flag = int(anomaly_out["anomaly"])
    anomaly_score = float(anomaly_out["anomaly_score"])

    # Get cluster assignment
    cluster_id = model.cluster(df)

    # Calculate risk score using shared service
    risk_result = calculate_risk_from_analysis(
        anomaly_flag=anomaly_flag,
        anomaly_score=anomaly_score,
        cluster_id=cluster_id
    )

    return risk_result

from fastapi import APIRouter
import pandas as pd
from ml.model import get_model
from routes.schemas import SalesDataInput, RiskResponse

router = APIRouter()

# ============================================
# RISK SCORING CONFIGURATION
# ============================================
# These weights determine how different factors contribute to risk score

# Anomaly detection weights
ANOMALY_DETECTED_WEIGHT = 40        # Points added when anomaly is detected (-1)
EXTREME_ANOMALY_THRESHOLD = 0.15    # Anomaly score threshold for "extreme"
EXTREME_ANOMALY_WEIGHT = 10         # Additional points for extreme anomaly scores

# Cluster-based risk (clusters 6,7 historically show poor performance)
HIGH_RISK_CLUSTERS = [6, 7]         # Cluster IDs associated with high risk
CLUSTER_RISK_WEIGHT = 20            # Points added for high-risk cluster membership

# Risk level thresholds
HIGH_RISK_THRESHOLD = 60            # Score >= 60 = HIGH risk
MEDIUM_RISK_THRESHOLD = 30          # Score >= 30 = MEDIUM risk (else LOW)


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

    # Calculate risk score
    score = 0
    
    if anomaly_flag == -1:  # -1 indicates anomaly detected
        score += ANOMALY_DETECTED_WEIGHT
    
    if abs(anomaly_score) > EXTREME_ANOMALY_THRESHOLD:
        score += EXTREME_ANOMALY_WEIGHT
    
    if cluster_id in HIGH_RISK_CLUSTERS:
        score += CLUSTER_RISK_WEIGHT

    # Determine risk level
    if score >= HIGH_RISK_THRESHOLD:
        level = "HIGH"
    elif score >= MEDIUM_RISK_THRESHOLD:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "risk_score": score,
        "risk_level": level,
        "cluster": cluster_id,
        "anomaly": anomaly_flag,
        "anomaly_score": anomaly_score
    }

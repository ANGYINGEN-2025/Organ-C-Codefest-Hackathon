from fastapi import APIRouter
from routes.risk import risk
from routes.schemas import SalesDataInput, AlertsResponse

# Constants for anomaly detection
ANOMALY_DETECTED = -1  # Isolation Forest returns -1 for anomalies
HIGH_RISK_CLUSTERS = [6, 7]  # High-risk cluster IDs

router = APIRouter()

@router.post("/", response_model=AlertsResponse)
def alerts(data: SalesDataInput):
    r = risk(data)

    warnings = []

    if r["risk_level"] == "HIGH":
        warnings.append("⚠ High operational risk detected")

    if r["anomaly"] == ANOMALY_DETECTED:
        warnings.append("⚠ Anomaly detected in sales behavior")

    if r["cluster"] in HIGH_RISK_CLUSTERS:
        warnings.append("⚠ Store belongs to high-risk behavior group")

    if not warnings:
        warnings.append("No alerts. Situation normal.")

    return {
        "alerts": warnings,
        "details": r
    }

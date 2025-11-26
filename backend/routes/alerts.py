from fastapi import APIRouter
from routes.risk import risk
from routes.schemas import SalesDataInput, AlertsResponse

router = APIRouter()

@router.post("/", response_model=AlertsResponse)
def alerts(data: SalesDataInput):
    r = risk(data)

    warnings = []

    if r["risk_level"] == "HIGH":
        warnings.append("⚠ High operational risk detected")

    if r["anomaly"] == -1:
        warnings.append("⚠ Anomaly detected in sales behavior")

    if r["cluster"] in [6, 7]:
        warnings.append("⚠ Store belongs to high-risk behavior group")

    if not warnings:
        warnings.append("No alerts. Situation normal.")

    return {
        "alerts": warnings,
        "details": r
    }

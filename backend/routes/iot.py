from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal
from models import Alert, AnomalyLog, ClusterLog, RiskLog
from ml.model import get_model  # Use singleton!
from websocket_manager import manager  # WebSocket broadcasting
from services.risk_service import calculate_risk_score  # Shared risk calculation
from limiter_config import limiter  # Rate limiting
from auth import verify_api_key  # API key authentication
import pandas as pd
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================
# CONSTANTS - Anomaly Detection Values
# ============================================
# Isolation Forest model returns:
ANOMALY_DETECTED = -1  # Model returns -1 when anomaly is detected
NORMAL = 1             # Model returns 1 when data is normal

# Database values for is_anomaly field:
IS_ANOMALY_TRUE = 1    # Database: 1 = anomaly detected
IS_ANOMALY_FALSE = 0   # Database: 0 = normal (no anomaly)

# Rate limiting constant
RATE_LIMIT_PER_MINUTE = "100/minute"  # Rate limit: 100 requests per minute per IP

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class IoTInput(BaseModel):
    timestamp: str
    store: int
    dept: int
    Weekly_Sales: float
    Temperature: float
    Fuel_Price: float
    CPI: float
    Unemployment: float
    IsHoliday: int


@router.post("/")
@limiter.limit(RATE_LIMIT_PER_MINUTE)  # Rate limit: 100 requests per minute per IP
async def iot_ingest(
    request: Request,
    data: IoTInput,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key)  # API key authentication
):
    """
    IoT data ingestion endpoint with rate limiting and authentication.
    
    Security:
    - Rate limit: 100 requests per minute per IP address (configurable via RATE_LIMIT_PER_MINUTE)
    - Authentication: API key required (X-API-Key header) if enabled
    
    Returns:
    - 401 Unauthorized: If API key is missing/invalid (when auth enabled)
    - 429 Too Many Requests: If rate limit exceeded
    - 200 OK: If request is valid
    """

    # Convert IoT input to dataframe
    df = pd.DataFrame([data.dict()])

    # 🔥 CRITICAL FIX — rename to match model training columns
    df = df.rename(columns={
        "store": "Store",
        "dept": "Dept",
        "IsHoliday": "IsHoliday",
        "Weekly_Sales": "Weekly_Sales",
        "Temperature": "Temperature",
        "Fuel_Price": "Fuel_Price",
        "CPI": "CPI",
        "Unemployment": "Unemployment"
    })

    # Make sure types match training schema
    df["Store"] = df["Store"].astype(int)
    df["Dept"] = df["Dept"].astype(int)
    df["IsHoliday"] = df["IsHoliday"].astype(int)

    # Get singleton model instance (loaded once, reused)
    model = get_model()

    # 1) anomaly detection
    anomaly = model.detect_anomalies(df).iloc[0]
    anomaly_flag = int(anomaly["anomaly"])
    anomaly_score = float(anomaly["anomaly_score"])

    db.add(AnomalyLog(
        timestamp=data.timestamp,
        value=data.Weekly_Sales,
        score=anomaly_score,
        is_anomaly=IS_ANOMALY_TRUE if anomaly_flag == ANOMALY_DETECTED else IS_ANOMALY_FALSE
    ))

    # 2) clustering
    cluster_id = model.cluster(df)

    db.add(ClusterLog(
        store=data.store,
        dept=data.dept,
        cluster=cluster_id,
        features=data.dict()
    ))

    # 3) risk score calculation (using shared service)
    score, level = calculate_risk_score(
        anomaly_flag=anomaly_flag,
        anomaly_score=anomaly_score,
        cluster_id=cluster_id
    )

    risk_row = RiskLog(
        store=data.store,
        dept=data.dept,
        risk_score=score,
        risk_level=level,
        anomaly=anomaly_flag,
        cluster=cluster_id
    )
    db.add(risk_row)

    # 4) auto alert
    if level == "HIGH":
        db.add(Alert(
            store=data.store,
            dept=data.dept,
            message="⚠ High risk detected from IoT update",
            risk_score=score
        ))

    db.commit()

    # 🔌 Broadcast to WebSocket clients (with error handling)
    try:
        await manager.broadcast_iot_update(
            data={
                "store": data.store,
                "dept": data.dept,
                "Weekly_Sales": data.Weekly_Sales,
                "Temperature": data.Temperature,
                "IsHoliday": data.IsHoliday
            },
            analysis_result={
                "anomaly": anomaly_flag,
                "anomaly_score": anomaly_score,
                "cluster": cluster_id,
                "risk_level": level,
                "risk_score": score
            }
        )
    except Exception as e:
        # Log error but don't fail the HTTP request
        # Data is already saved to DB, WebSocket is just for real-time updates
        logger.error(f"Failed to broadcast IoT update via WebSocket: {e}", exc_info=True)

    # 🚨 Broadcast alert if HIGH risk (with error handling)
    if level == "HIGH":
        try:
            await manager.broadcast_alert(
                store=data.store,
                dept=data.dept,
                message="⚠ High risk detected from IoT update",
                risk_score=score
            )
        except Exception as e:
            # Log error but don't fail the HTTP request
            logger.error(f"Failed to broadcast alert via WebSocket: {e}", exc_info=True)

    return {
        "status": "success",
        "anomaly": anomaly_flag,
        "anomaly_score": anomaly_score,
        "cluster": cluster_id,
        "risk_level": level,
        "risk_score": score
    }

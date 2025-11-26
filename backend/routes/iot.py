from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal
from models import Alert, AnomalyLog, ClusterLog, RiskLog
from ml.model import get_model
from websocket_manager import manager
import pandas as pd
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

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


async def broadcast_update(data: dict, result: dict):
    """Background task to broadcast IoT update via WebSocket"""
    try:
        await manager.broadcast_iot_update(data, result)
        
        # If high risk, also send alert
        if result.get("risk_level") == "HIGH":
            await manager.broadcast_alert(
                store=data.get("store"),
                dept=data.get("dept"),
                message="⚠ High risk detected from IoT update",
                risk_score=result.get("risk_score")
            )
    except Exception as e:
        logger.error(f"WebSocket broadcast failed: {e}")


@router.post("/")
async def iot_ingest(data: IoTInput, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    📡 IoT Data Ingestion Endpoint
    
    Receives IoT sensor data, analyzes it, and:
    1. Detects anomalies using Isolation Forest
    2. Assigns cluster using KMeans
    3. Calculates risk score
    4. Logs to database
    5. Broadcasts to WebSocket clients in real-time
    
    Real-time updates are sent to all connected WebSocket clients at /ws/alerts
    """
    model = get_model()
    
    # Create DataFrame with correct column names for ML model
    # Model expects 'Store' and 'Dept' (capitalized)
    df = pd.DataFrame([{
        "Weekly_Sales": data.Weekly_Sales,
        "Temperature": data.Temperature,
        "Fuel_Price": data.Fuel_Price,
        "CPI": data.CPI,
        "Unemployment": data.Unemployment,
        "Store": data.store,      # Capitalize for model
        "Dept": data.dept,        # Capitalize for model
        "IsHoliday": data.IsHoliday
    }])

    # 1) Anomaly detection
    anomaly = model.detect_anomalies(df).iloc[0]
    anomaly_flag = int(anomaly["anomaly"])
    anomaly_score = float(anomaly["anomaly_score"])

    db.add(AnomalyLog(
        timestamp=data.timestamp,
        value=data.Weekly_Sales,
        score=anomaly_score,
        is_anomaly=(anomaly_flag == -1)
    ))

    # 2) Cluster assignment
    cluster_id = model.cluster(df)
    db.add(ClusterLog(
        store=data.store,
        dept=data.dept,
        cluster=cluster_id,
        features=data.dict()
    ))

    # 3) Risk score calculation
    score = 0
    if anomaly_flag == -1: 
        score += 40
    if abs(anomaly_score) > 0.15: 
        score += 10
    if cluster_id in [6, 7]: 
        score += 20

    level = "HIGH" if score >= 60 else "MEDIUM" if score >= 30 else "LOW"

    risk_row = RiskLog(
        store=data.store,
        dept=data.dept,
        risk_score=score,
        risk_level=level,
        anomaly=anomaly_flag,
        cluster=cluster_id
    )
    db.add(risk_row)

    # 4) Auto-alert if high risk
    if level == "HIGH":
        db.add(Alert(
            store=data.store,
            dept=data.dept,
            message="⚠ High risk detected from IoT update",
            risk_score=score
        ))

    db.commit()

    # Build result
    result = {
        "status": "success",
        "anomaly": anomaly_flag,
        "anomaly_score": anomaly_score,
        "cluster": cluster_id,
        "risk_level": level,
        "risk_score": score
    }

    # 5) Broadcast to WebSocket clients (non-blocking)
    # Using asyncio to run in background without blocking response
    asyncio.create_task(broadcast_update(data.dict(), result))
    
    logger.info(f"📡 IoT data ingested: Store {data.store}, Dept {data.dept}, Risk: {level}")

    return result

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Import database and models for table creation
from database import engine, Base
from models import Alert, AnomalyLog, ClusterLog, RiskLog

from routes.iot import router as iot_router
from routes.forecast import router as forecast_router
from routes.anomaly import router as anomaly_router
from routes.kpi import router as kpi_router
from routes.risk import router as risk_router
from routes.alerts import router as alerts_router
from routes.cluster import router as cluster_router
from routes.stores import router as stores_router
from routes.recommendations import router as recommendations_router
from routes.websocket import router as websocket_router
from routes.schemas import HealthResponse

# API Version prefix
API_V1_PREFIX = "/api/v1"


# ============================================
# STARTUP/SHUTDOWN EVENTS
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup: Create database tables
    logging.info("🚀 Starting up...")
    Base.metadata.create_all(bind=engine)
    logging.info("✅ Database tables created/verified")
    
    yield  # App runs here
    
    # Shutdown
    logging.info("👋 Shutting down...")


app = FastAPI(
    lifespan=lifespan,
    title="Enterprise Predictive Analytics API",
    version="1.0.0",
    description="""
    ## Track 1: Intelligent Predictive Analytics for Enterprise Operations
    
    This API provides AI-powered analytics for retail operations including:
    
    * 📈 **Forecasting** - Predict future sales using Prophet
    * 🔍 **Anomaly Detection** - Identify unusual patterns with Isolation Forest
    * 📊 **KPI Dashboard** - Key performance metrics
    * ⚠️ **Risk Assessment** - Evaluate operational risks
    * 🚨 **Alerts** - Actionable warnings
    * 💡 **Recommendations** - AI-powered optimization suggestions
    * 🏪 **Store Analytics** - Store-level insights
    * 🔌 **WebSocket** - Real-time IoT data streaming
    
    ### WebSocket Endpoints
    - `ws://host/ws/alerts` - Real-time alerts and IoT updates
    - `ws://host/ws/dashboard` - Dashboard data stream
    """
)

# ============================================
# MIDDLEWARE (must be before routes!)
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# HEALTH CHECK (no version prefix)
# ============================================
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Check if the API is running"""
    return {"status": "ok"}

# ============================================
# WEBSOCKET ROUTES (no prefix - direct /ws/)
# ============================================
app.include_router(websocket_router, prefix="/ws", tags=["🔌 WebSocket"])

# ============================================
# API v1 ROUTES
# ============================================
app.include_router(iot_router, prefix=f"{API_V1_PREFIX}/iot", tags=["📡 IoT Ingestion"])
app.include_router(stores_router, prefix=f"{API_V1_PREFIX}/stores", tags=["Stores"])
app.include_router(recommendations_router, prefix=f"{API_V1_PREFIX}/recommendations", tags=["Recommendations"])
app.include_router(forecast_router, prefix=f"{API_V1_PREFIX}/forecast", tags=["Forecast"])
app.include_router(kpi_router, prefix=f"{API_V1_PREFIX}/kpi", tags=["KPI Overview"])
app.include_router(anomaly_router, prefix=f"{API_V1_PREFIX}/anomaly", tags=["Anomaly Detection"])
app.include_router(risk_router, prefix=f"{API_V1_PREFIX}/risk", tags=["Risk Assessment"])
app.include_router(alerts_router, prefix=f"{API_V1_PREFIX}/alerts", tags=["Alerts"])
app.include_router(cluster_router, prefix=f"{API_V1_PREFIX}/cluster", tags=["Clustering"])

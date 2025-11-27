from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from limiter_config import limiter  # Import rate limiter
from auth import AUTH_ENABLED, REQUIRED_API_KEY  # Import auth config
import logging

# ROUTES
from routes.iot import router as iot_router
from routes.forecast import router as forecast_router
from routes.anomaly import router as anomaly_router
from routes.kpi import router as kpi_router
from routes.risk import router as risk_router
from routes.alerts import router as alerts_router
from routes.cluster import router as cluster_router
from routes.stores import router as stores_router
from routes.recommendations import router as recommendations_router
from routes.websocket import router as websocket_router  # WebSocket routes
from routes.auth import router as auth_router  # Admin authentication routes
from routes.schemas import HealthResponse

# DATABASE
from database import Base, engine

# IMPORTANT: import models BEFORE create_all()
from models import Alert, AnomalyLog, ClusterLog, RiskLog

# Database cleanup utility
from db_cleanup import cleanup_old_logs, get_log_counts


API_V1_PREFIX = "/api/v1"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ============================================
# LIFESPAN (Startup/Shutdown)
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle application startup and shutdown events.
    Replaces deprecated @app.on_event("startup") pattern.
    """
    # Startup: Create database tables
    logger.info("🚀 Starting up...")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created/verified")
    
    # Log authentication status
    if AUTH_ENABLED:
        logger.info(f"🔐 API Key Authentication: ENABLED")
        logger.info(f"   Set API_KEY environment variable to require authentication")
    else:
        logger.info("🔓 API Key Authentication: DISABLED (development mode)")
        logger.info("   Set AUTH_ENABLED=true or API_KEY=<key> to enable")
    
    # Cleanup old logs on startup to prevent memory issues
    try:
        log_counts_before = get_log_counts()
        cleanup_stats = cleanup_old_logs()
        log_counts_after = get_log_counts()
        logger.info(f"📊 Database stats - Anomaly: {log_counts_after['anomaly_logs']}, "
                   f"Cluster: {log_counts_after['cluster_logs']}, "
                   f"Risk: {log_counts_after['risk_logs']}, "
                   f"Alerts: {log_counts_after['alerts']}")
    except Exception as e:
        logger.warning(f"⚠️  Database cleanup failed (non-critical): {e}")
    
    yield  # App runs here
    
    # Shutdown (optional cleanup)
    logger.info("👋 Shutting down...")


app = FastAPI(
    lifespan=lifespan,
    title="Enterprise Predictive Analytics API",
    version="1.0.0",
    description="""
    ## Track 1: Intelligent Predictive Analytics for Enterprise Operations
    
    This API provides AI-powered analytics for retail operations including:

    * 📈 Forecasting
    * 🔍 Anomaly Detection
    * 📊 KPI Dashboard
    * ⚠️ Risk Assessment
    * 🚨 Alerts
    * 💡 Recommendations
    * 🏪 Store Analytics
    """
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ============================================
# MIDDLEWARE (must be before routes)
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# HEALTH CHECK
# ============================================
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    return {"status": "ok"}


# ============================================
# DATABASE CLEANUP (Admin endpoint)
# ============================================
@app.post("/api/v1/admin/cleanup", tags=["Admin"])
def cleanup_database(retention_days: int = 7):
    """
    Manually trigger database cleanup to remove old logs.
    
    This helps prevent memory issues by removing old IoT logs.
    Default retention: 7 days
    """
    try:
        stats = cleanup_old_logs(retention_days=retention_days)
        current_counts = get_log_counts()
        return {
            "status": "success",
            "cleanup_stats": stats,
            "current_counts": current_counts
        }
    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# ============================================
# WEBSOCKET ROUTES (no version prefix)
# ============================================
app.include_router(websocket_router, prefix="/ws", tags=["🔌 WebSocket"])

# ============================================
# API v1 ROUTES
# ============================================
app.include_router(auth_router, prefix=f"{API_V1_PREFIX}/auth", tags=["🔐 Authentication"])
app.include_router(iot_router, prefix=f"{API_V1_PREFIX}/iot", tags=["IoT Ingestion"])
app.include_router(stores_router, prefix=f"{API_V1_PREFIX}/stores", tags=["Stores"])
app.include_router(recommendations_router, prefix=f"{API_V1_PREFIX}/recommendations", tags=["Recommendations"])
app.include_router(forecast_router, prefix=f"{API_V1_PREFIX}/forecast", tags=["Forecast"])
app.include_router(kpi_router, prefix=f"{API_V1_PREFIX}/kpi", tags=["KPI Overview"])
app.include_router(anomaly_router, prefix=f"{API_V1_PREFIX}/anomaly", tags=["Anomaly Detection"])
app.include_router(risk_router, prefix=f"{API_V1_PREFIX}/risk", tags=["Risk Assessment"])
app.include_router(alerts_router, prefix=f"{API_V1_PREFIX}/alerts", tags=["Alerts"])
app.include_router(cluster_router, prefix=f"{API_V1_PREFIX}/cluster", tags=["Clustering"])

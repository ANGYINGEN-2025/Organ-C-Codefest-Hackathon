"""
Database Cleanup Utility

Removes old log entries to prevent database growth and memory issues.
Can be called periodically or on startup.
"""

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Alert, AnomalyLog, ClusterLog, RiskLog
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Retention period: Keep logs for 7 days (adjust as needed)
RETENTION_DAYS = 7


def cleanup_old_logs(retention_days: int = RETENTION_DAYS) -> dict:
    """
    Remove log entries older than retention_days.
    
    Args:
        retention_days: Number of days to keep logs (default: 7)
    
    Returns:
        Dictionary with cleanup statistics
    """
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    db: Session = SessionLocal()
    
    stats = {
        "anomaly_logs_deleted": 0,
        "cluster_logs_deleted": 0,
        "risk_logs_deleted": 0,
        "alerts_deleted": 0,
        "cutoff_date": cutoff_date.isoformat()
    }
    
    try:
        # Delete old anomaly logs
        deleted_anomalies = db.query(AnomalyLog).filter(
            AnomalyLog.created_at < cutoff_date
        ).delete(synchronize_session=False)
        stats["anomaly_logs_deleted"] = deleted_anomalies
        
        # Delete old cluster logs
        deleted_clusters = db.query(ClusterLog).filter(
            ClusterLog.created_at < cutoff_date
        ).delete(synchronize_session=False)
        stats["cluster_logs_deleted"] = deleted_clusters
        
        # Delete old risk logs
        deleted_risks = db.query(RiskLog).filter(
            RiskLog.created_at < cutoff_date
        ).delete(synchronize_session=False)
        stats["risk_logs_deleted"] = deleted_risks
        
        # Delete old alerts (keep recent ones for dashboard)
        deleted_alerts = db.query(Alert).filter(
            Alert.created_at < cutoff_date
        ).delete(synchronize_session=False)
        stats["alerts_deleted"] = deleted_alerts
        
        db.commit()
        
        total_deleted = (
            stats["anomaly_logs_deleted"] +
            stats["cluster_logs_deleted"] +
            stats["risk_logs_deleted"] +
            stats["alerts_deleted"]
        )
        
        if total_deleted > 0:
            logger.info(f"🧹 Cleaned up {total_deleted} old log entries (older than {retention_days} days)")
        else:
            logger.debug(f"🧹 No old logs to clean (cutoff: {cutoff_date.isoformat()})")
            
    except Exception as e:
        logger.error(f"❌ Error during database cleanup: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()
    
    return stats


def get_log_counts() -> dict:
    """Get current counts of log entries in database."""
    db: Session = SessionLocal()
    
    try:
        counts = {
            "anomaly_logs": db.query(AnomalyLog).count(),
            "cluster_logs": db.query(ClusterLog).count(),
            "risk_logs": db.query(RiskLog).count(),
            "alerts": db.query(Alert).count()
        }
        return counts
    finally:
        db.close()


"""
Risk Calculation Service

Centralized risk scoring logic used across multiple endpoints.
This ensures consistency and eliminates code duplication.
"""

from typing import Dict, Tuple, Any

# ============================================
# RISK SCORING CONFIGURATION
# ============================================
# These weights determine how different factors contribute to risk score

# Anomaly detection constants
ANOMALY_DETECTED = -1               # Isolation Forest returns -1 for anomalies
NORMAL = 1                          # Isolation Forest returns 1 for normal

# Anomaly detection weights
ANOMALY_DETECTED_WEIGHT = 40        # Points added when anomaly is detected
EXTREME_ANOMALY_THRESHOLD = 0.15    # Anomaly score threshold for "extreme"
EXTREME_ANOMALY_WEIGHT = 10         # Additional points for extreme anomaly scores

# Cluster-based risk (clusters 6,7 historically show poor performance)
HIGH_RISK_CLUSTERS = [6, 7]         # Cluster IDs associated with high risk
CLUSTER_RISK_WEIGHT = 20            # Points added for high-risk cluster membership

# Risk level thresholds
HIGH_RISK_THRESHOLD = 60            # Score >= 60 = HIGH risk
MEDIUM_RISK_THRESHOLD = 30         # Score >= 30 = MEDIUM risk (else LOW)


def calculate_risk_score(
    anomaly_flag: int,
    anomaly_score: float,
    cluster_id: int
) -> Tuple[int, str]:
    """
    Calculate risk score and level based on anomaly detection and clustering.
    
    Args:
        anomaly_flag: -1 = anomaly detected, 1 = normal
        anomaly_score: Anomaly score from Isolation Forest (lower = more anomalous)
        cluster_id: Cluster assignment from KMeans
    
    Returns:
        Tuple of (risk_score: int, risk_level: str)
        risk_level is one of: "LOW", "MEDIUM", "HIGH"
    
    Risk factors:
    - Anomaly detection: +40 points if anomaly detected
    - Extreme anomaly: +10 points if score exceeds threshold
    - High-risk cluster: +20 points if in clusters 6 or 7
    """
    score = 0
    
    # Anomaly detection contribution
    if anomaly_flag == ANOMALY_DETECTED:
        score += ANOMALY_DETECTED_WEIGHT
    
    # Extreme anomaly contribution
    if abs(anomaly_score) > EXTREME_ANOMALY_THRESHOLD:
        score += EXTREME_ANOMALY_WEIGHT
    
    # Cluster-based risk contribution
    if cluster_id in HIGH_RISK_CLUSTERS:
        score += CLUSTER_RISK_WEIGHT
    
    # Determine risk level
    if score >= HIGH_RISK_THRESHOLD:
        level = "HIGH"
    elif score >= MEDIUM_RISK_THRESHOLD:
        level = "MEDIUM"
    else:
        level = "LOW"
    
    return score, level


def calculate_risk_from_analysis(
    anomaly_flag: int,
    anomaly_score: float,
    cluster_id: int
) -> Dict[str, Any]:
    """
    Calculate risk score and return full risk analysis dictionary.
    
    This is a convenience function that returns a dict matching RiskResponse schema.
    
    Args:
        anomaly_flag: -1 = anomaly detected, 1 = normal
        anomaly_score: Anomaly score from Isolation Forest
        cluster_id: Cluster assignment from KMeans
    
    Returns:
        Dictionary with keys: risk_score, risk_level, cluster, anomaly, anomaly_score
    """
    score, level = calculate_risk_score(anomaly_flag, anomaly_score, cluster_id)
    
    return {
        "risk_score": score,
        "risk_level": level,
        "cluster": cluster_id,
        "anomaly": anomaly_flag,
        "anomaly_score": anomaly_score
    }

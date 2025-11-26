from fastapi import APIRouter, HTTPException, Query
import pandas as pd
from data_loader import load_raw_data, get_time_series
from ml.model import get_model
from routes.schemas import (
    RecommendationsResponse, 
    Recommendation, 
    RecommendationType,
    RiskLevel
)

router = APIRouter()


def generate_recommendations(store_id: int, risk_level: str, cluster_id: int, 
                            anomaly_flag: int, forecast_trend: str) -> list:
    """
    Generate AI-powered recommendations based on store analysis.
    
    This simulates what an LLM or rule-based system would produce.
    """
    recommendations = []
    
    # HIGH RISK recommendations
    if risk_level == "HIGH":
        recommendations.append(Recommendation(
            type=RecommendationType.STAFFING,
            priority=RiskLevel.HIGH,
            message=f"Immediately review staffing levels at Store {store_id}. High risk detected.",
            expected_impact="Reduce operational risk by 30%"
        ))
        recommendations.append(Recommendation(
            type=RecommendationType.INVENTORY,
            priority=RiskLevel.HIGH,
            message="Conduct emergency inventory audit to identify discrepancies.",
            expected_impact="Prevent potential $50K+ in losses"
        ))
    
    # Anomaly-based recommendations
    if anomaly_flag == -1:
        recommendations.append(Recommendation(
            type=RecommendationType.PRICING,
            priority=RiskLevel.MEDIUM,
            message="Unusual sales pattern detected. Review pricing strategy and competitor activity.",
            expected_impact="Optimize revenue by identifying pricing opportunities"
        ))
    
    # Cluster-based recommendations
    if cluster_id in [6, 7]:
        recommendations.append(Recommendation(
            type=RecommendationType.MAINTENANCE,
            priority=RiskLevel.MEDIUM,
            message="Store belongs to underperforming cluster. Schedule facility assessment.",
            expected_impact="Improve store performance by addressing physical issues"
        ))
    
    # Forecast-based recommendations
    if forecast_trend == "increasing":
        recommendations.append(Recommendation(
            type=RecommendationType.INVENTORY,
            priority=RiskLevel.MEDIUM,
            message="Sales forecast shows upward trend. Increase inventory orders by 15-20%.",
            expected_impact="Prevent stockouts and capture increased demand"
        ))
        recommendations.append(Recommendation(
            type=RecommendationType.STAFFING,
            priority=RiskLevel.LOW,
            message="Consider adding temporary staff for upcoming high-demand period.",
            expected_impact="Improve customer service during peak times"
        ))
    elif forecast_trend == "decreasing":
        recommendations.append(Recommendation(
            type=RecommendationType.PROMOTION,
            priority=RiskLevel.MEDIUM,
            message="Sales forecast shows downward trend. Consider promotional campaigns.",
            expected_impact="Boost sales by 10-15% through targeted promotions"
        ))
        recommendations.append(Recommendation(
            type=RecommendationType.INVENTORY,
            priority=RiskLevel.LOW,
            message="Reduce inventory orders to prevent overstock during slower period.",
            expected_impact="Reduce carrying costs by $10K+"
        ))
    
    # Default recommendation if nothing else applies
    if not recommendations:
        recommendations.append(Recommendation(
            type=RecommendationType.MAINTENANCE,
            priority=RiskLevel.LOW,
            message="Store is performing normally. Continue regular operations.",
            expected_impact="Maintain current performance levels"
        ))
    
    return recommendations


@router.get("/", response_model=RecommendationsResponse)
def get_recommendations(
    store_id: int = Query(..., description="Store ID to analyze", ge=1)
):
    """
    Get AI-powered optimization recommendations for a specific store.
    
    Analyzes:
    - Risk level based on anomaly detection and clustering
    - Sales forecast trends
    - Historical performance patterns
    
    Returns actionable recommendations for staffing, inventory, pricing, etc.
    """
    df = load_raw_data()
    store_data = df[df["Store"] == store_id]
    
    if store_data.empty:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found")
    
    model = get_model()
    
    # Get latest data point for analysis
    latest = store_data.iloc[-1]
    analysis_df = pd.DataFrame([{
        "Weekly_Sales": float(latest["Weekly_Sales"]),
        "Temperature": float(latest["Temperature"]),
        "Fuel_Price": float(latest["Fuel_Price"]),
        "CPI": float(latest["CPI"]),
        "Unemployment": float(latest["Unemployment"]),
        "Store": int(store_id),
        "Dept": int(latest["Dept"]),
        "IsHoliday": int(latest["IsHoliday"])
    }])
    
    # Get anomaly detection results
    anomaly_result = model.detect_anomalies(analysis_df).iloc[0]
    anomaly_flag = int(anomaly_result["anomaly"])
    
    # Get cluster
    cluster_id = model.cluster(analysis_df)
    
    # Calculate risk level (same logic as risk.py)
    score = 0
    if anomaly_flag == -1:
        score += 40
    if cluster_id in [6, 7]:
        score += 20
    
    if score >= 60:
        risk_level = "HIGH"
    elif score >= 30:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"
    
    # Get forecast trend
    try:
        ts_df = get_time_series(store_id)
        forecast_df = model.forecast(ts_df, periods=4)
        
        # Determine trend from forecast
        if len(forecast_df) >= 2:
            first_forecast = forecast_df.iloc[0]["forecast"]
            last_forecast = forecast_df.iloc[-1]["forecast"]
            if last_forecast > first_forecast * 1.05:
                forecast_trend = "increasing"
            elif last_forecast < first_forecast * 0.95:
                forecast_trend = "decreasing"
            else:
                forecast_trend = "stable"
        else:
            forecast_trend = "stable"
    except Exception:
        forecast_trend = "stable"
    
    # Generate recommendations
    recommendations = generate_recommendations(
        store_id=store_id,
        risk_level=risk_level,
        cluster_id=cluster_id,
        anomaly_flag=anomaly_flag,
        forecast_trend=forecast_trend
    )
    
    return {
        "store_id": store_id,
        "risk_level": risk_level,
        "recommendations": recommendations
    }



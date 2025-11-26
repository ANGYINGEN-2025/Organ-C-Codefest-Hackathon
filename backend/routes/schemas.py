# schemas.py
from pydantic import BaseModel, Field
from typing import List
from enum import Enum


# ============================================
# INPUT SCHEMAS
# ============================================

class SalesDataInput(BaseModel):
    """Input schema for sales data with validation"""
    Weekly_Sales: float = Field(..., ge=0, description="Weekly sales amount in dollars")
    Temperature: float = Field(..., ge=-50, le=150, description="Temperature in Fahrenheit")
    Fuel_Price: float = Field(..., ge=0, description="Regional fuel price per gallon")
    CPI: float = Field(..., ge=0, description="Consumer Price Index")
    Unemployment: float = Field(..., ge=0, le=100, description="Unemployment rate percentage")
    Store: int = Field(..., ge=1, description="Store identifier")
    Dept: int = Field(..., ge=1, description="Department identifier")
    IsHoliday: int = Field(..., ge=0, le=1, description="Holiday flag (0=No, 1=Yes)")


# ============================================
# RESPONSE SCHEMAS
# ============================================

class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., example="ok")


class ForecastItem(BaseModel):
    """Single forecast data point"""
    timestamp: str = Field(..., description="Forecast date", example="2024-01-15")
    forecast: float = Field(..., description="Predicted sales value", example=1523456.78)


class KPIResponse(BaseModel):
    """KPI overview metrics"""
    avg_weekly_sales: float = Field(..., description="Average weekly sales")
    max_sales: float = Field(..., description="Maximum sales recorded")
    min_sales: float = Field(..., description="Minimum sales recorded")
    volatility: float = Field(..., description="Sales standard deviation")
    holiday_sales_avg: float = Field(..., description="Average sales during holidays")


class AnomalyResponse(BaseModel):
    """Anomaly detection result"""
    anomaly: int = Field(..., description="-1 = anomaly detected, 1 = normal")
    anomaly_score: float = Field(..., description="Anomaly score (lower = more anomalous)")


class RiskLevel(str, Enum):
    """Risk level categories"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskResponse(BaseModel):
    """Risk assessment result"""
    risk_score: int = Field(..., ge=0, description="Calculated risk score")
    risk_level: RiskLevel = Field(..., description="Risk category")
    cluster: int = Field(..., description="Cluster group ID")
    anomaly: int = Field(..., description="-1 = anomaly, 1 = normal")
    anomaly_score: float = Field(..., description="Anomaly confidence score")


class AlertsResponse(BaseModel):
    """Alerts with risk details"""
    alerts: List[str] = Field(..., description="List of warning messages")
    details: RiskResponse = Field(..., description="Underlying risk assessment")


class ClusterResponse(BaseModel):
    """Clustering result"""
    cluster: int = Field(..., description="Assigned cluster ID")


# ============================================
# STORE & RECOMMENDATIONS SCHEMAS
# ============================================

class StoreInfo(BaseModel):
    """Store information"""
    store_id: int = Field(..., description="Store identifier")
    total_sales: float = Field(..., description="Total historical sales")
    avg_weekly_sales: float = Field(..., description="Average weekly sales")
    num_departments: int = Field(..., description="Number of departments")


class StoresListResponse(BaseModel):
    """List of all stores"""
    total_stores: int = Field(..., description="Total number of stores")
    stores: List[StoreInfo] = Field(..., description="Store details")


class RecommendationType(str, Enum):
    """Types of recommendations"""
    STAFFING = "STAFFING"
    INVENTORY = "INVENTORY"
    PRICING = "PRICING"
    MAINTENANCE = "MAINTENANCE"
    PROMOTION = "PROMOTION"


class Recommendation(BaseModel):
    """Single recommendation"""
    type: RecommendationType = Field(..., description="Recommendation category")
    priority: RiskLevel = Field(..., description="Priority level")
    message: str = Field(..., description="Actionable recommendation")
    expected_impact: str = Field(..., description="Expected business impact")


class RecommendationsResponse(BaseModel):
    """AI-generated recommendations for a store"""
    store_id: int = Field(..., description="Store identifier")
    risk_level: RiskLevel = Field(..., description="Current risk level")
    recommendations: List[Recommendation] = Field(..., description="List of recommendations")
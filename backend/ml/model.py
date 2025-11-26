import joblib
import pandas as pd
import numpy as np
import logging
from pathlib import Path

# Setup logging
logger = logging.getLogger(__name__)

# Get the directory where this file is located
BASE_DIR = Path(__file__).resolve().parent


class SalesModel:
    def __init__(self):
        # Load models using absolute paths
        self.forecast_model = joblib.load(BASE_DIR / "forecast_model.pkl")
        self.preprocessor = joblib.load(BASE_DIR / "preprocessor.pkl")
        self.scaler_anomaly = joblib.load(BASE_DIR / "scaler_anomaly.pkl")
        self.anomaly_model = joblib.load(BASE_DIR / "iso_model.pkl")
        self.kmeans_model = joblib.load(BASE_DIR / "kmeans_model.pkl")

    # -----------------------------
    # 1) PROPHET FORECASTING
    # -----------------------------
    def forecast(self, ts_df: pd.DataFrame, periods: int = 6) -> pd.DataFrame:
        df = ts_df.copy()
        df = df.rename(columns={"timestamp": "ds", "value": "y"})

        last_date = df["ds"].max()
        future = pd.date_range(start=last_date, periods=periods + 1, freq="W")[1:]
        future_df = pd.DataFrame({"ds": future})

        forecast = self.forecast_model.predict(future_df)
        out = forecast[["ds", "yhat"]].rename(columns={"ds": "timestamp", "yhat": "forecast"})
        return out

    # -----------------------------
    # 2) ANOMALY DETECTION (IsolationForest)
    # -----------------------------
    def detect_anomalies(self, input_df: pd.DataFrame):
        df = input_df.copy()  # Work on copy to avoid side effects
        numeric_cols = ['Weekly_Sales', 'Temperature', 'Fuel_Price', 'CPI', 'Unemployment']

        # Scale numeric features
        X_scaled = self.scaler_anomaly.transform(df[numeric_cols])

        # Predict with IsoForest
        preds = self.anomaly_model.predict(X_scaled)      # -1 = anomaly, 1 = normal
        scores = self.anomaly_model.decision_function(X_scaled)

        # Add back into dataframe
        df["anomaly"] = preds
        df["anomaly_score"] = scores

        return df

    # -----------------------------
    # 3) KMEANS CLUSTERING
    # -----------------------------
    def cluster(self, input_df: pd.DataFrame):
        X = self.preprocessor.transform(input_df)
        cluster_id = int(self.kmeans_model.predict(X)[0])
        return cluster_id


# ============================================
# SINGLETON PATTERN - Load model only ONCE
# ============================================
_model_instance = None


def get_model() -> SalesModel:
    """Get the singleton SalesModel instance. Creates it on first call."""
    global _model_instance
    if _model_instance is None:
        logger.info("🔄 Loading ML models (one-time)...")
        _model_instance = SalesModel()
        logger.info("✅ Models loaded successfully!")
    return _model_instance

# # Member 5 - Prescriptive Intelligence & Dashboard (Full Actions + % Change)
# import pandas as pd
# import numpy as np
# import matplotlib.pyplot as plt
# import seaborn as sns
# from datetime import datetime
# import os

# sns.set_style("whitegrid")

# # ========================
# # 0. SETUP OUTPUT FOLDERS
# # ========================
# os.makedirs('outputs', exist_ok=True)
# os.makedirs('outputs/charts', exist_ok=True)

# # ========================
# # 1. LOAD FORECAST
# # ========================
# forecast_file = "csv/walmart_prophet_forecast.csv"
# predictions = pd.read_csv(forecast_file)

# # Convert date and keep only needed columns
# predictions['Date'] = pd.to_datetime(predictions['ds'])
# predictions = predictions[['Date', 'yhat']].rename(columns={'yhat': 'Predicted_Weekly_Sales'})

# # ========================
# # 2. CALCULATE WEEKLY % CHANGE
# # ========================
# predictions['Pct_Change'] = predictions['Predicted_Weekly_Sales'].pct_change() * 100
# predictions['Pct_Change'] = predictions['Pct_Change'].fillna(0)

# # ========================
# # 3. FORECAST VOLATILITY (Risk)
# # ========================
# predictions['Forecast_SD'] = predictions['Predicted_Weekly_Sales'].rolling(4, min_periods=1).std()
# vol_threshold = predictions['Forecast_SD'].mean() * 1.5
# predictions['Risk_Flag'] = np.where(predictions['Forecast_SD'] > vol_threshold, 'High Risk', 'Normal')

# # ========================
# # 4. ANOMALY DETECTION
# # ========================
# predictions['Rolling_Mean'] = predictions['Predicted_Weekly_Sales'].rolling(4, min_periods=1).mean()
# predictions['Rolling_SD'] = predictions['Predicted_Weekly_Sales'].rolling(4, min_periods=1).std()

# predictions['Anomaly'] = np.where(
#     predictions['Predicted_Weekly_Sales'] > predictions['Rolling_Mean'] + 2*predictions['Rolling_SD'], 'High Spike',
#     np.where(predictions['Predicted_Weekly_Sales'] < predictions['Rolling_Mean'] - 2*predictions['Rolling_SD'], 'Drop', 'Normal')
# )

# # ========================
# # 5. ACTIONABLE RECOMMENDATIONS
# # ========================
# def generate_action(row):
#     actions = []
#     reasons = []

#     # High forecast → add stock, prepare staff, promotions
#     if row['Pct_Change'] > 10:
#         actions.append("Increase Staff")
#         actions.append("Increase Stock")
#         actions.append("Promotions")
#         reasons.append("High forecasted sales")
#     # Low forecast → reduce reorder, staff, marketing
#     elif row['Pct_Change'] < -10:
#         actions.append("Reduce Stock")
#         actions.append("Reduce Staff")
#         actions.append("Marketing Adjustments")
#         reasons.append("Low forecasted sales")
#     # Anomaly adjustments
#     if row['Anomaly'] != "Normal":
#         actions.append("Investigate Anomaly")
#         reasons.append(f"Anomaly: {row['Anomaly']}")
#     # High risk
#     if row['Risk_Flag'] == "High Risk":
#         actions.append("Monitor Volatility")
#         reasons.append("High forecast volatility")

#     # If no action
#     if not actions:
#         actions.append("No immediate action")
#         reasons.append("Forecast stable")

#     return pd.Series({
#         'Action': ", ".join(actions),
#         'Reason': "; ".join(reasons)
#     })

# predictions[['Action','Reason']] = predictions.apply(generate_action, axis=1)

# # ========================
# # 6. EXPORT CSV
# # ========================
# output_cols = ['Date', 'Predicted_Weekly_Sales', 'Pct_Change', 'Forecast_SD', 'Anomaly', 'Risk_Flag', 'Action', 'Reason']
# predictions.to_csv('outputs/sales_recommendations_full.csv', index=False)
# print("✅ Actionable recommendations exported: outputs/sales_recommendations_full.csv")

# # ========================
# # 7. PLOTS
# # ========================
# # Forecast + % change + anomalies
# plt.figure(figsize=(12,6))
# plt.plot(predictions['Date'], predictions['Predicted_Weekly_Sales'], marker='o', label='Predicted Sales')
# plt.fill_between(predictions['Date'], 
# predictions['Rolling_Mean'] - 2*predictions['Rolling_SD'],
# predictions['Rolling_Mean'] + 2*predictions['Rolling_SD'], 
# color='orange', alpha=0.2, label='±2 SD')
# anomalies = predictions[predictions['Anomaly'] != 'Normal']
# plt.scatter(anomalies['Date'], anomalies['Predicted_Weekly_Sales'], color='red', label='Anomaly', zorder=5)
# plt.title("Forecasted Sales & Anomalies")
# plt.xlabel("Date")
# plt.ylabel("Units")
# plt.legend()
# plt.tight_layout()
# plt.savefig('outputs/charts/forecast_anomalies.png', dpi=300)
# plt.close()
# print("✅ Chart saved: outputs/charts/forecast_anomalies.png")

# # Risk distribution
# plt.figure(figsize=(8,5))
# sns.countplot(data=predictions, x='Risk_Flag', palette=['#F39C12','#2ECC71'])
# plt.title("Forecast Risk Distribution")
# plt.xlabel("Risk Level")
# plt.ylabel("Count")
# plt.tight_layout()
# plt.savefig('outputs/charts/risk_distribution.png', dpi=300)
# plt.close()
# print("✅ Chart saved: outputs/charts/risk_distribution.png")

# print("\n✅ Member 5 processing complete. CSV + Charts ready for web display.")




# import pandas as pd
# import numpy as np

# # Load historical and forecast data
# walmart = pd.read_csv("csv/Walmart_Sales.csv")
# predictions = pd.read_csv("csv/walmart_prophet_forecast.csv")

# # Ensure dates are datetime
# walmart['Date'] = pd.to_datetime(walmart['Date'], dayfirst=True)
# predictions['Date'] = pd.to_datetime(predictions['ds'])

# # Keep only necessary columns
# predictions = predictions[['Date','yhat']].rename(columns={'yhat':'Predicted_Weekly_Sales'})

# # If Store column exists in Walmart, keep it; otherwise assume single store
# if 'Store' not in walmart.columns:
#     walmart['Store'] = 1
#     predictions['Store'] = 1

# # Merge historical and forecast
# merged = pd.merge(
#     walmart,
#     predictions,
#     on=['Store','Date'],
#     how='inner'
# )

# # Compute error metrics
# merged['Absolute_Error'] = abs(merged['Weekly_Sales'] - merged['Predicted_Weekly_Sales'])
# merged['Percentage_Error'] = merged['Absolute_Error'] / merged['Weekly_Sales'] * 100

# rmse = np.sqrt(np.mean((merged['Weekly_Sales'] - merged['Predicted_Weekly_Sales'])**2))
# mape = np.mean(merged['Percentage_Error'])

# print(f"RMSE (units): {rmse:,.2f}")
# print(f"MAPE (%): {mape:.2f}%")




import pandas as pd

# -----------------------------
# 1️⃣ Load and preprocess data
# -----------------------------
df = pd.read_csv("csv/forecast_stores.csv")

# Ensure numeric yhat
df['yhat'] = df['yhat'].astype(float)

# Convert dates
df['ds'] = pd.to_datetime(df['ds'])

# Sort by store and date
df = df.sort_values(['Store', 'ds'])

# -----------------------------
# 2️⃣ Calculate metrics
# -----------------------------
# Percent change (week-to-week)
df['yhat_change_pct'] = df.groupby('Store')['yhat'].pct_change() * 100

# Rolling volatility (3-week window)
df['volatility'] = df.groupby('Store')['yhat'].rolling(3).std().reset_index(0, drop=True)

# -----------------------------
# 3️⃣ Anomaly detection
# -----------------------------
yhat_drop_threshold = -5
yhat_spike_threshold = 5
volatility_pct_threshold = 0.05  # 5% of yhat

df['anomaly'] = (
    (df['yhat_change_pct'].abs() > max(abs(yhat_drop_threshold), yhat_spike_threshold)) |
    (df.groupby('Store')['yhat_change_pct'].transform(lambda x: x.abs().quantile(0.95)) <= df['yhat_change_pct'].abs())
)

# -----------------------------
# 4️⃣ Risk score
# -----------------------------
df['risk_score'] = df['yhat_change_pct'].abs() + (df['volatility'] / df['yhat']) * 100

# Optional: classify risk level
def classify_risk(score):
    if score >= 60:
        return "HIGH"
    elif score >= 30:
        return "MEDIUM"
    else:
        return "LOW"

df['risk_level'] = df['risk_score'].apply(classify_risk)

# -----------------------------
# 5️⃣ Dynamic thresholds per store
# -----------------------------
# Calculate 10th and 90th percentiles per store
percentiles = df.groupby('Store')['yhat'].quantile([0.10, 0.90]).unstack()
percentiles.columns = ['low_sales_threshold', 'high_sales_threshold']

# Merge thresholds back to df
df = df.merge(percentiles, left_on='Store', right_index=True)

# -----------------------------
# 6️⃣ Final Action & Reason (with Normal Range in Millions)
# -----------------------------
def action_reason(row):
    if pd.isna(row['yhat_change_pct']):
        return pd.Series([
            'No Action',
            'First week or insufficient historical data to assess change.'
        ])
    
    # Large drop
    if row['yhat_change_pct'] < yhat_drop_threshold:
        return pd.Series([
            'Investigate / Promote',
            f'Sales predicted to drop by {abs(row["yhat_change_pct"]):.1f}% compared to last week. Consider marketing actions or promotions.'
        ])
    
    # Large spike
    elif row['yhat_change_pct'] > yhat_spike_threshold:
        return pd.Series([
            'Prepare Inventory',
            f'Sales predicted to increase by {row["yhat_change_pct"]:.1f}% compared to last week. Ensure sufficient stock.'
        ])
    
    # High volatility
    elif row['volatility'] > volatility_pct_threshold * row['yhat']:
        return pd.Series([
            'Monitor Closely',
            f'Sales forecast shows high week-to-week volatility. Watch inventory and marketing closely.'
        ])
    
    # Low forecasted sales
    elif row['yhat'] < row['low_sales_threshold']:
        return pd.Series([
            'Review Marketing',
            f'Forecasted weekly sales ({row["yhat"]/1_000_000:.2f}M) are below this store’s normal range '
            f'({row["low_sales_threshold"]/1_000_000:.2f}M–{row["high_sales_threshold"]/1_000_000:.2f}M). Consider promotions or cost management.'
        ])
    
    # High forecasted sales
    elif row['yhat'] > row['high_sales_threshold']:
        return pd.Series([
            'Prepare Inventory',
            f'Forecasted weekly sales ({row["yhat"]/1_000_000:.2f}M) exceed this store’s normal range '
            f'({row["low_sales_threshold"]/1_000_000:.2f}M–{row["high_sales_threshold"]/1_000_000:.2f}M). Ensure stock and logistics are ready.'
        ])
    
    # Anomaly detected
    elif row['anomaly']:
        return pd.Series([
            'Investigate Anomaly',
            'Week shows unusual sales change compared to historical patterns.'
        ])
    
    # Normal forecast
    else:
        return pd.Series([
            'No Action',
            f'Forecast is normal. Expected weekly sales are within the store’s normal range '
            f'({row["low_sales_threshold"]/1_000_000:.2f}M–{row["high_sales_threshold"]/1_000_000:.2f}M).'
        ])

# Apply the function
df[['action', 'reason']] = df.apply(action_reason, axis=1)

# -----------------------------
# 7️⃣ Save output
# -----------------------------
df.to_csv("outputs/forecast_analysis_weekly_dashboard.csv", index=False)
print("✅ CSV ready for dashboard: forecast_analysis_weekly_dashboard.csv")

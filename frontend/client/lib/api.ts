import type { BusinessMetrics, InventorySnapshot, ForecastDetail, KPIMetrics } from "@/lib/types";
import { demoMetrics, demoInventories, demoForecast, demoKPIMetrics } from "./demo-data";
import { demoRecommendations } from "./demo-data";

// ============================================
// API CONFIGURATION
// ============================================
// Check if we're in development (browser check)
const isDevelopment = typeof window !== "undefined" && 
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// Backend API base URL
// Development: http://localhost:8000 (backend running locally)
// Production: https://organ-c-codefest-hackathon.onrender.com
const API_BASE_URL = isDevelopment 
  ? "http://localhost:8000" 
  : "https://organ-c-codefest-hackathon.onrender.com";

// Use mock data (set to true to use demo data instead of real API)
const USE_MOCK = false;

// API version prefix
const API_V1 = `${API_BASE_URL}/api/v1`;

// WebSocket URL (derived from API base)
export const WS_BASE_URL = API_BASE_URL.replace("http", "ws").replace("https", "wss");
export const WS_ALERTS_URL = `${WS_BASE_URL}/ws/alerts`;

// ============================================
// KPI METRICS
// ============================================
export async function fetchKPIMetrics(storeId?: number, dept?: number): Promise<KPIMetrics> {
  if (USE_MOCK) return demoKPIMetrics();
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    if (dept) params.append('dept', dept.toString());
    
    const res = await fetch(`${API_V1}/kpi?${params.toString()}`);
    if (!res.ok) throw new Error("API error");
    const json = await res.json();
    
    // Map backend response to frontend format
    return {
      avgWeeklySales: json.avg_weekly_sales,
      maxSales: json.max_sales,
      minSales: json.min_sales,
      volatility: json.volatility,
      holidaySalesAvg: json.holiday_sales_avg
    };
  } catch (err) {
    console.warn("fetchKPIMetrics failed, falling back to demo data", err);
    return demoKPIMetrics();
  }
}

// ============================================
// BUSINESS METRICS (uses KPI endpoint)
// ============================================
export async function fetchMetrics(): Promise<BusinessMetrics> {
  if (USE_MOCK) return demoMetrics();
  try {
    const res = await fetch(`${API_V1}/kpi`);
    if (!res.ok) throw new Error("API error");
    const json = await res.json();
    return json as BusinessMetrics;
  } catch (err) {
    console.warn("fetchMetrics failed, falling back to demo data", err);
    return demoMetrics();
  }
}

// ============================================
// STORES
// ============================================
export async function fetchStores(): Promise<any> {
  try {
    const res = await fetch(`${API_V1}/stores`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchStores failed", err);
    return { total_stores: 0, stores: [] };
  }
}

export async function fetchTopStores(limit = 10): Promise<any[]> {
  try {
    const res = await fetch(`${API_V1}/stores/top?limit=${limit}`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchTopStores failed", err);
    return [];
  }
}

// ============================================
// INVENTORIES (demo only - no backend endpoint)
// ============================================
export async function fetchInventories(): Promise<InventorySnapshot[]> {
  // No backend endpoint for inventories yet
  return demoInventories();
}

// ============================================
// FORECAST
// ============================================
export async function fetchForecast(storeId?: number, periods = 6): Promise<any[]> {
  if (USE_MOCK) return demoForecast("demo", periods);
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    params.append('periods', periods.toString());
    
    const res = await fetch(`${API_V1}/forecast?${params.toString()}`);
    if (!res.ok) throw new Error("API error");
    const json = await res.json();
    
    // Map backend response to frontend format
    return json.map((item: any) => ({
      date: item.timestamp,
      forecast: item.forecast,
      lowerInterval: item.lower_bound,
      upperInterval: item.upper_bound,
      historicalSales: 0,
      anomalyFlag: false
    }));
  } catch (err) {
    console.warn("fetchForecast failed, falling back to demo data", err);
    return demoForecast("demo", periods);
  }
}

// ============================================
// RECOMMENDATIONS
// ============================================
export async function fetchRecommendations(storeId?: number): Promise<any> {
  if (USE_MOCK) return demoRecommendations();
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    
    const res = await fetch(`${API_V1}/recommendations?${params.toString()}`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchRecommendations failed, falling back to demo data", err);
    return demoRecommendations();
  }
}

// ============================================
// ANOMALY DETECTION
// ============================================
export async function fetchAnomalies(storeId?: number, dept?: number): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    if (dept) params.append('dept', dept.toString());
    
    const res = await fetch(`${API_V1}/anomaly?${params.toString()}`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchAnomalies failed", err);
    return [];
  }
}

export async function detectAnomaly(data: {
  Weekly_Sales: number;
  Temperature?: number;
  Fuel_Price?: number;
  CPI?: number;
  Unemployment?: number;
  Store?: number;
  Dept?: number;
  IsHoliday?: number;
}): Promise<{ anomaly: number; anomaly_score: number }> {
  try {
    const res = await fetch(`${API_V1}/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("detectAnomaly failed", err);
    return { anomaly: 0, anomaly_score: 0 };
  }
}

// ============================================
// RISK ANALYSIS
// ============================================
export async function fetchRiskAnalysis(data: {
  Weekly_Sales: number;
  Temperature: number;
  Fuel_Price: number;
  CPI: number;
  Unemployment: number;
  Store: number;
  Dept: number;
  IsHoliday: number;
}): Promise<any> {
  try {
    const res = await fetch(`${API_V1}/risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchRiskAnalysis failed", err);
    return { risk_score: 0, risk_level: "LOW", cluster: 0, anomaly: 1, anomaly_score: 0 };
  }
}

// ============================================
// ALERTS
// ============================================
export async function fetchAlerts(data: {
  Weekly_Sales: number;
  Temperature: number;
  Fuel_Price: number;
  CPI: number;
  Unemployment: number;
  Store: number;
  Dept: number;
  IsHoliday: number;
}): Promise<any> {
  try {
    const res = await fetch(`${API_V1}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchAlerts failed", err);
    return { alerts: [], details: null };
  }
}

// ============================================
// CLUSTERING
// ============================================
export async function fetchCluster(data: {
  Weekly_Sales: number;
  Temperature: number;
  Fuel_Price: number;
  CPI: number;
  Unemployment: number;
  Store: number;
  Dept: number;
  IsHoliday: number;
}): Promise<{ cluster: number }> {
  try {
    const res = await fetch(`${API_V1}/cluster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.warn("fetchCluster failed", err);
    return { cluster: 0 };
  }
}

// ============================================
// HEALTH CHECK
// ============================================
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

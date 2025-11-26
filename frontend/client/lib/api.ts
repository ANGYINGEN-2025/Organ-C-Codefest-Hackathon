import type { BusinessMetrics, InventorySnapshot, ForecastDetail, KPIMetrics } from "@/lib/types";
import { demoMetrics, demoInventories, demoForecast, demoKPIMetrics } from "./demo-data";
import { demoRecommendations } from "./demo-data";

// ============================================
// API CONFIGURATION
// ============================================
// Force production API or check if we're in development
// Set FORCE_PRODUCTION to true to always use Render backend
const FORCE_PRODUCTION = true;

const isDevelopment = !FORCE_PRODUCTION && typeof window !== "undefined" && 
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// Backend API base URL
// Development: http://localhost:8000 (backend running locally)
// Production: https://organ-c-codefest-hackathon.onrender.com
const API_BASE_URL = isDevelopment 
  ? "http://localhost:8000" 
  : "https://organ-c-codefest-hackathon.onrender.com";

console.log('🌐 API Configuration:', {
  isDevelopment,
  FORCE_PRODUCTION,
  API_BASE_URL,
  hostname: typeof window !== "undefined" ? window.location.hostname : "server"
});

// Use mock data (set to true to use demo data instead of real API)
const USE_MOCK = false;

// API version prefix
const API_V1 = `${API_BASE_URL}/api/v1`;

// WebSocket URL (derived from API base)
export const WS_BASE_URL = API_BASE_URL.replace("http", "ws").replace("https", "wss");
export const WS_ALERTS_URL = `${WS_BASE_URL}/ws/alerts`;

// ============================================
// AUTHENTICATION
// ============================================

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  username: string;
}

export interface UserResponse {
  username: string;
  is_admin: boolean;
}

/**
 * Get stored auth token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}

/**
 * Store auth token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

/**
 * Remove auth token from localStorage
 */
export function removeAuthToken(): void {
  localStorage.removeItem("auth_token");
}

/**
 * Login as admin
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_V1}/auth/login/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(error.detail || "Login failed");
  }

  const data: LoginResponse = await res.json();
  setAuthToken(data.access_token);
  return data;
}

/**
 * Logout (clear token)
 */
export async function logout(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    await fetch(`${API_V1}/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
  } catch (error) {
    // Ignore errors on logout
    console.error("Logout error:", error);
  } finally {
    removeAuthToken();
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<UserResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_V1}/auth/me`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      removeAuthToken();
      throw new Error("Session expired");
    }
    throw new Error("Failed to get user");
  }

  return res.json();
}

// ============================================
// KPI METRICS
// ============================================
export async function fetchKPIMetrics(storeId?: number, dept?: number): Promise<KPIMetrics> {
  if (USE_MOCK) return demoKPIMetrics();
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    if (dept) params.append('dept', dept.toString());
    
    const url = `${API_V1}/kpi?${params.toString()}`;
    console.log('🔍 Fetching KPI from:', url);
    
    const res = await fetch(url);
    console.log('📡 KPI Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ KPI Error response:', errorText);
      throw new Error(`API error: ${res.status}`);
    }
    const json = await res.json();
    console.log('✅ KPI Data received:', json);
    
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
// INVENTORIES (generated from stores data)
// ============================================
export async function fetchInventories(): Promise<InventorySnapshot[]> {
  try {
    const storesData = await fetchStores();
    const stores = storesData.stores || [];
    
    if (stores.length === 0) {
      console.warn("No stores data available, using demo data");
      return demoInventories();
    }
    
    // Convert each store into an inventory snapshot
    return stores.map((store: any) => {
      const avgDailySales = store.avg_weekly_sales / 7;
      const currentStock = Math.round(avgDailySales * 30); // 30 days worth of stock
      const avgDailyDemand = Math.max(1, Math.round(avgDailySales / 100)); // Rough unit estimate
      
      return {
        productId: `prod-store-${store.store_id}`,
        productName: `Store ${store.store_id} Products`,
        storeId: `store-${store.store_id}`,
        category: "General Merchandise",
        currentStock: currentStock,
        reorderPoint: Math.round(avgDailyDemand * 7),
        safetyStock: Math.round(avgDailyDemand * 3),
        economicOrderQuantity: Math.round(avgDailyDemand * 14),
        daysUntilStockout: currentStock > 0 && avgDailyDemand > 0 
          ? Math.round(currentStock / avgDailyDemand) 
          : 0,
        riskLevel: (store.avg_weekly_sales > 25000 ? "high" : 
                    store.avg_weekly_sales > 15000 ? "medium" : "low") as "low" | "medium" | "high" | "critical",
        recommendedOrderQty: Math.round(avgDailyDemand * 14),
        lastOrder: new Date().toISOString().split("T")[0],
        avgDailyDemand: avgDailyDemand,
      } as InventorySnapshot;
    });
  } catch (err) {
    console.warn("fetchInventories failed, using demo data", err);
    return demoInventories();
  }
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
      lowerInterval: item.lower_bound || item.forecast * 0.9,
      upperInterval: item.upper_bound || item.forecast * 1.1,
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
    const json = await res.json();
    
    // Backend returns: { store_id, risk_level, recommendations: [{type, priority, message, expected_impact}] }
    // Map to frontend format
    const recommendations = json.recommendations || [];
    const storeIdStr = json.store_id ? `store-${json.store_id}` : "";
    
    return recommendations.map((item: any, index: number) => ({
      // Remove id field since backend doesn't provide it
      title: `${item.type}: ${item.message.split('.')[0]}`,
      details: `${item.message} ${item.expected_impact || ''}`,
      storeId: storeIdStr,
      date: new Date().toISOString().split('T')[0],
      action: item.type ? item.type.toLowerCase() : "review",
      severity: item.priority ? item.priority.toLowerCase() : "medium"
    }));
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

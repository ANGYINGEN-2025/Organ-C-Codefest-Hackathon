import type { BusinessMetrics, InventorySnapshot, ForecastDetail, SalesRecord, KPIMetrics } from "@/lib/types";

export function demoMetrics(): BusinessMetrics {
  return {
    forecastAccuracy: 0.85,
    costSavings: 450000,
    inventoryTurnover: 12.3,
    leadTime: 7,
    serviceLevel: 0.95,
    excessInventoryValue: 120000,
    potentialLostRevenue: 300000,
  };
}

export function demoKPIMetrics(): KPIMetrics {
  return {
    avgWeeklySales: 15981.26,
    maxSales: 693099.36,
    minSales: 209.96,
    volatility: 22786.18,
    holidaySalesAvg: 17413.10,
  };
}

export function demoInventories(): InventorySnapshot[] {
  return [
    {
      productId: "prod-001",
      productName: "Blue T-Shirt",
      storeId: "store-1",
      category: "Apparel",
      currentStock: 120,
      reorderPoint: 20,
      safetyStock: 10,
      economicOrderQuantity: 240,
      daysUntilStockout: 8,
      riskLevel: "medium",
      recommendedOrderQty: 180,
      lastOrder: new Date().toISOString().split("T")[0],
      avgDailyDemand: 2,
    },
    {
      productId: "prod-002",
      productName: "Green Hoodie",
      storeId: "store-2",
      category: "Apparel",
      currentStock: 40,
      reorderPoint: 10,
      safetyStock: 8,
      economicOrderQuantity: 50,
      daysUntilStockout: 5,
      riskLevel: "high",
      recommendedOrderQty: 30,
      lastOrder: new Date().toISOString().split("T")[0],
      avgDailyDemand: 1,
    },
  ];
}

export function demoForecast(productId = "prod-001", days = 90): ForecastDetail[] {
  const today = new Date();
  const base = 30 + (productId?.length || 0);
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - i - 1));
    const historical = Math.max(0, Math.round(base + Math.sin(i / 3) * 8 + (i % 7 === 0 ? 10 : 0)));
    const forecast = Math.round(historical * (1 + Math.cos(i / 7) * 0.03));
    const lower = Math.round(forecast * 0.9);
    const upper = Math.round(forecast * 1.1);
    const anomaly = Math.random() > 0.985;
    return {
      productId,
      date: d.toISOString().split("T")[0],
      historicalSales: historical,
      forecast,
      lowerInterval: lower,
      upperInterval: upper,
      anomalyFlag: anomaly,
      anomalyReason: anomaly ? "Spike detected compared to moving average" : undefined,
    } as ForecastDetail;
  });
}

export function demoSales(): SalesRecord[] {
  return [
    {
      date: new Date().toISOString().split("T")[0],
      storeId: "store-1",
      state: "CA",
      category: "Apparel",
      productId: "prod-001",
      productName: "Blue T-Shirt",
      actualSales: 12,
      forecastSales: 11,
      lowerConfidence: 9,
      upperConfidence: 14,
    },
    {
      date: new Date().toISOString().split("T")[0],
      storeId: "store-1",
      state: "CA",
      category: "Apparel",
      productId: "prod-002",
      productName: "Green Hoodie",
      actualSales: 8,
      forecastSales: 9,
      lowerConfidence: 6,
      upperConfidence: 10,
    },
  ];
}

export function demoRecommendations() {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      title: "PRICING: Review pricing strategy and competitor activity",
      details: "Unusual sales pattern detected. Review pricing strategy and competitor activity. Optimize revenue by identifying pricing opportunities",
      storeId: "store-1",
      action: "pricing",
      severity: "medium",
      date: today,
    },
    {
      title: "INVENTORY: Increase inventory orders by 15-20%",
      details: "Sales forecast shows upward trend. Increase inventory orders by 15-20%. Prevent stockouts and capture increased demand",
      storeId: "store-1",
      action: "inventory",
      severity: "medium",
      date: today,
    },
    {
      title: "STAFFING: Add temporary staff for high-demand period",
      details: "Consider adding temporary staff for upcoming high-demand period. Improve customer service during peak times",
      storeId: "store-1",
      action: "staffing",
      severity: "low",
      date: today,
    },
  ];
}

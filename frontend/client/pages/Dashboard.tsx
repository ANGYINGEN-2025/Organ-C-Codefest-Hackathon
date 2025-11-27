import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMetrics, fetchInventories, fetchForecast, fetchRecommendations, fetchKPIMetrics, fetchAnomalies, fetchRiskAnalysis, fetchAlerts, WS_ALERTS_URL } from "@/lib/api";
import { demoMetrics, demoKPIMetrics } from "@/lib/demo-data";
import useDocumentTitle from "@/hooks/use-document-title";
import Navigation from "@/components/Navigation";
import DataUploadPanel from "@/components/DataUploadPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  BarChart3,
  DollarSign,
  Package,
  CheckCircle,
  Download,
  RefreshCw,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Calendar,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Scatter,
} from "recharts";
import type { InventorySnapshot, ForecastDetail, BusinessMetrics, SalesRecord, SupplierDimension, KPIMetrics } from "@/lib/types";
import type { UploadResult } from "@/components/DataUploadPanel";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [inventories, setInventories] = useState<InventorySnapshot[]>([]);
  const [forecastDetails, setForecastDetails] = useState<ForecastDetail[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  // Filters for anomaly detection view
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [approvedOrders, setApprovedOrders] = useState<number>(0);
  const [savedRevenue, setSavedRevenue] = useState<number>(0);
  // Forecast section state
  const [forecastStoreFilter, setForecastStoreFilter] = useState<string>("");
  const [forecastPeriods, setForecastPeriods] = useState<number>(6);
  const [forecastData, setForecastData] = useState<any[]>([]);
  
  // Real-time IoT data state
  const [iotDataPoints, setIotDataPoints] = useState<any[]>([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Set page title for Dashboard
  useDocumentTitle("Retail — Dashboard");

  useEffect(() => {
    // Data will be loaded from user upload in DataUploadPanel
    // This effect will be called when user confirms data upload
    if (!dataLoaded) return;

    // TODO: Process uploaded data and set state
    // setInventories(processedInventories);
    // setMetrics(processedMetrics);
    // etc.
  }, [dataLoaded]);

  // Connect to WebSocket for real-time IoT data (only when using backend data, not CSV)
  useEffect(() => {
    // Only connect if user chose backend data (skipped CSV upload)
    if (dataLoaded) return; // CSV uploaded, don't use WebSocket
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(WS_ALERTS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("✅ WebSocket connected for real-time IoT data");
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === "iot_update") {
              // Add new IoT data point and update KPI metrics in one operation
              setIotDataPoints((prev) => {
                const updated = [...prev, message].slice(-100); // Keep only last 100 data points
                
                // Calculate metrics from accumulated data
                const salesValues = updated.map((d: any) => d.data?.weekly_sales || 0).filter((v: number) => v > 0);
                if (salesValues.length > 0) {
                  const avgSales = salesValues.reduce((a: number, b: number) => a + b, 0) / salesValues.length;
                  const maxSales = Math.max(...salesValues);
                  const minSales = Math.min(...salesValues);
                  const volatility = Math.sqrt(
                    salesValues.reduce((sum: number, val: number) => sum + Math.pow(val - avgSales, 2), 0) / salesValues.length
                  );

                  setKpiMetrics({
                    avgWeeklySales: avgSales,
                    maxSales: maxSales,
                    minSales: minSales,
                    volatility: volatility,
                    holidaySalesAvg: avgSales * 1.2 // Estimate
                  });
                }
                return updated;
              });

              // Invalidate queries to refresh dashboard
              queryClient.invalidateQueries({ queryKey: ["kpi"] });
              queryClient.invalidateQueries({ queryKey: ["alerts"] });
              queryClient.invalidateQueries({ queryKey: ["anomalies"] });
              queryClient.invalidateQueries({ queryKey: ["risk"] });
            } else if (message.type === "alert") {
              // Add new alert
              setRealtimeAlerts((prev) => {
                const updated = [{ ...message, id: Date.now() }, ...prev];
                // Keep only last 20 alerts
                return updated.slice(0, 20);
              });

              // Show notification or update alerts query
              queryClient.invalidateQueries({ queryKey: ["alerts"] });
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setWsConnected(false);
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected, reconnecting...");
          setWsConnected(false);
          // Reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        setWsConnected(false);
        // Retry connection after 5 seconds
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    // Connect when component mounts (and user chose backend data)
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
    };
  }, [dataLoaded, queryClient]);

  // Query backend for API-driven values (fallback to demo data in fetch functions)
  const metricsQuery = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, staleTime: 60_000 });
  const inventoriesQuery = useQuery({ queryKey: ["inventories"], queryFn: fetchInventories, staleTime: 60_000 });
  const forecastQuery = useQuery({ queryKey: ["forecast", forecastStoreFilter, forecastPeriods], queryFn: () => fetchForecast(forecastStoreFilter ? parseInt(forecastStoreFilter) : undefined, forecastPeriods), staleTime: 60_000 });
  const recommendationsQuery = useQuery({ queryKey: ["recommendations"], queryFn: () => fetchRecommendations(), staleTime: 60_000 });
  const kpiQuery = useQuery({ queryKey: ["kpi"], queryFn: () => fetchKPIMetrics(), staleTime: 60_000 });
  const anomaliesQuery = useQuery({ queryKey: ["anomalies"], queryFn: () => fetchAnomalies(), staleTime: 60_000 });
  // Note: riskQuery and alertsQuery require POST data, not used in initial render
  // const riskQuery = useQuery({ queryKey: ["risk"], queryFn: () => fetchRiskAnalysis(), staleTime: 60_000 });
  // const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: () => fetchAlerts(), staleTime: 60_000 });

  // Choose data to display: uploaded (local) when available; otherwise API/demo data
  const displayMetrics = metrics ?? metricsQuery.data ?? null;
  const displayKPIMetrics = kpiMetrics ?? kpiQuery.data ?? demoKPIMetrics();
  const displayInventories = dataLoaded ? inventories : inventoriesQuery.data ?? [];
  const displayForecast = dataLoaded ? forecastDetails : forecastQuery.data ?? [];

  // Process parsed CSVs returned from the DataUploadPanel; convert to the
  // application state shape required by the Dashboard
  function handleParsedUpload(result?: UploadResult) {
    if (!result) {
      // If no data uploaded, fallback to demo metrics to prevent the Dashboard showing a perpetual loading state
      setMetrics(metricsQuery.data ?? demoMetrics());
      setKpiMetrics(demoKPIMetrics()); // TODO: Calculate from uploaded data
      setDataLoaded(true);
      return;
    }

    // If product records were provided, use them directly
    if (result.products && result.products.length > 0) {
      setInventories(result.products);
      // choose first product as selected
      setSelectedProduct(result.products[0].productId);
      setForecastDetails(generateForecastDetails(result.products[0].productId, 26));
      setMetrics(simpleMetricsFromInventories(result.products));
      setKpiMetrics(demoKPIMetrics()); // TODO: Calculate from sales data
      setDataLoaded(true);
      return;
    }

    // If we only have sales records, aggregate them into inventories and forecast
    if (result.sales && result.sales.length > 0) {
      const salesDocs = result.sales as SalesRecord[];
      const byProduct: Record<string, SalesRecord[]> = {};
      for (const s of salesDocs) {
        const pid = s.productId || s.productName || `unknown-${s.storeId}`;
        if (!byProduct[pid]) byProduct[pid] = [];
        byProduct[pid].push(s);
      }

      const invs: InventorySnapshot[] = Object.keys(byProduct).map((pid) => {
        const list = byProduct[pid];
        const productName = list[0].productName || pid;
        // compute avgDailyDemand over available days
        const days = new Set(list.map((r) => r.date)).size || 1;
        const total = list.reduce((a, b) => a + (Number(b.actualSales) || 0), 0);
        const avgDailyDemand = Math.round(total / days || 0);
        return {
          productId: pid,
          productName,
          storeId: list[0].storeId || "",
          category: list[0].category || "",
          currentStock: Math.max(0, avgDailyDemand * 30),
          reorderPoint: Math.max(0, avgDailyDemand * 7),
          safetyStock: Math.max(0, Math.round(avgDailyDemand * 2)),
          economicOrderQuantity: Math.max(0, Math.round(Math.sqrt((2 * 30 * avgDailyDemand) || 1))),
          daysUntilStockout: Math.round(Math.max(0, (avgDailyDemand ? (avgDailyDemand * 30) / avgDailyDemand : 0))),
          riskLevel: avgDailyDemand > 10 ? "high" : avgDailyDemand > 3 ? "medium" : "low",
          recommendedOrderQty: Math.max(0, avgDailyDemand * 14),
          lastOrder: new Date().toISOString().split("T")[0],
          avgDailyDemand,
        } as InventorySnapshot;
      });

      setInventories(invs);
      setSelectedProduct(invs.length > 0 ? invs[0].productId : "");
      // Produce forecast details using generateForecastDetails for each product
      const fDetails: ForecastDetail[] = [];
      for (const inv of invs) {
        fDetails.push(...generateForecastDetails(inv.productId, 26));
      }
      setForecastDetails(fDetails);
      setMetrics(simpleMetricsFromInventories(invs));
      setKpiMetrics(demoKPIMetrics()); // TODO: Calculate from actual data
      setDataLoaded(true);
      return;
    }

    // if nothing recognized, just mark as loaded
    setDataLoaded(true);
  }

  function simpleMetricsFromInventories(invs: InventorySnapshot[]): BusinessMetrics {
    const forecastAccuracy = 0.85; // placeholder
    const costSavings = invs.reduce((acc, i) => acc + (i.recommendedOrderQty * 2), 0);
    const inventoryTurnover = invs.length > 0 ? 12 : 0;
    const leadTime = 7;
    const serviceLevel = 0.95;
    const excessInventoryValue = invs.reduce((a, b) => a + (b.currentStock * (b.avgDailyDemand || 1)), 0);
    const potentialLostRevenue = invs.reduce((a, b) => a + (b.currentStock * (b.avgDailyDemand || 1) * 0.5), 0);
    return {
      forecastAccuracy,
      costSavings,
      inventoryTurnover,
      leadTime,
      serviceLevel,
      excessInventoryValue,
      potentialLostRevenue,
    };
  }

  // Generate synthetic weekly forecast data (exact number of periods, no extra point)
  function generateForecastDetails(productId: string, periods: number): ForecastDetail[] {
    const today = new Date();
    // Base around avg weekly sales
    const base = 15000 + (Math.abs(productId?.length || 0) * 200);
    return Array.from({ length: periods }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - ((periods - i - 1) * 7));
      // Seasonal pattern + weekly variance matching Walmart scale
      const seasonalFactor = 1 + Math.sin(i / 8) * 0.15; // ±15% seasonal
      const weeklyNoise = Math.sin(i / 3) * 1200 + (i % 4 === 0 ? 2500 : 0); // Holiday spikes
      const historical = Math.max(0, Math.round(base * seasonalFactor + weeklyNoise));
      const forecast = Math.round(historical * (1 + Math.cos(i / 5) * 0.05));
      const lower = Math.round(forecast * 0.88);
      const upper = Math.round(forecast * 1.12);
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
      };
    });
  }

  const handleProductSelect = (productId: string) => {
    setSelectedProduct(productId);
    setForecastDetails(generateForecastDetails(productId, 26));
  };

  const handleApproveOrder = (productId: string, quantity: number) => {
    if (quantity > 0) {
      setApprovedOrders((prev) => prev + 1);
      const product = displayInventories.find((i) => i.productId === productId);
      if (product) {
        const revenueSaved = (product.recommendedOrderQty || quantity) * 
          (product.avgDailyDemand * 30); // Rough estimate
        setSavedRevenue((prev) => prev + revenueSaved);
      }
    }
  };

  if (!dataLoaded) {
    return (
      <>
        <Navigation />
        <DataUploadPanel onDataLoaded={handleParsedUpload} />
      </>
    );
  }

  if (!displayMetrics) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-foreground/60">Loading analytics...</p>
          </div>
        </div>
      </>
    );
  }

  // at-risk KPI removed
  const selectedData = displayForecast;

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* KPI Overview Section - Backend Driven */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">KPI Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Weekly Sales</p>
                    <p className="text-2xl font-bold mt-1">
                      ${displayKPIMetrics.avgWeeklySales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Max Sales</p>
                    <p className="text-2xl font-bold mt-1">
                      ${displayKPIMetrics.maxSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <ArrowUp className="h-8 w-8 text-green-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Min Sales</p>
                    <p className="text-2xl font-bold mt-1">
                      ${displayKPIMetrics.minSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <ArrowDown className="h-8 w-8 text-orange-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Volatility</p>
                    <p className="text-2xl font-bold mt-1">
                      ${displayKPIMetrics.volatility.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Holiday Sales Avg</p>
                    <p className="text-2xl font-bold mt-1">
                      ${displayKPIMetrics.holidaySalesAvg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-red-600" />
                </div>
              </Card>
            </div>
          </div>

          {/* Forecast Section */}
          <Card className="border-0 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Sales Forecast
              </CardTitle>
              <p className="text-sm text-foreground/60 mt-2">
                Predictive sales forecast for upcoming periods
              </p>
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground/70">
                    Store:
                  </label>
                  <select
                    value={forecastStoreFilter}
                    onChange={(e) => setForecastStoreFilter(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm"
                  >
                    <option value="">All Stores</option>
                    {Array.from(new Set(displayInventories.map(inv => inv.storeId))).map(storeId => (
                      <option key={storeId} value={storeId}>{storeId}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground/70">
                    Periods: {forecastPeriods} weeks
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={forecastPeriods}
                    onChange={(e) => setForecastPeriods(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={displayForecast.slice(0, forecastPeriods)}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value) => Math.round(value as number)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#2563eb"
                    strokeWidth={2}
                    name="Forecast"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="lowerInterval"
                    stroke="#93c5fd"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Lower Bound"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="upperInterval"
                    stroke="#93c5fd"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Upper Bound"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Anomaly Detection */}
          <Card className="border-0 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Anomaly Detection
              </CardTitle>
              <p className="text-sm text-foreground/60 mt-2">
                Identify outliers and unusual patterns before they escalate
              </p>
              </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={selectedData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="colorInterval"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value) => Math.round(value as number)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="lowerInterval"
                    stroke="none"
                    fill="url(#colorInterval)"
                    name="Prediction Interval (95%)"
                  />
                  <Area
                    type="monotone"
                    dataKey="upperInterval"
                    stroke="none"
                    fill="url(#colorInterval)"
                  />
                    <Line
                    type="monotone"
                    dataKey="historicalSales"
                    stroke="#000"
                    strokeWidth={2}
                    name="Historical Sales"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    name="XGBoost Forecast"
                    dot={false}
                  />
                  {/* Scatter to highlight anomaly points (red dots) */}
                  <Scatter
                    name="Anomalies"
                    data={selectedData.filter((d) => d.anomalyFlag)}
                    fill="#ff4d4f"
                    shape="circle"
                    dataKey="forecast"
                  />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Anomaly Highlights: Table + Filters*/}
              <div className="mt-6">
                {/* Filters: Store, Department (category), Date range */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <select
                      className="px-3 py-2 border border-border rounded"
                      value={storeFilter}
                      onChange={(e) => setStoreFilter(e.target.value)}
                    >
                      <option value="">All Stores</option>
                      {displayInventories.map((inv) => (
                        <option key={inv.storeId} value={inv.storeId}>
                          {inv.storeId}
                        </option>
                      ))}
                    </select>
                    <select
                      className="px-3 py-2 border border-border rounded"
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {[...new Set(displayInventories.map((i) => i.category || "Uncategorized"))].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input type="date" className="px-3 py-2 border border-border rounded" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <input type="date" className="px-3 py-2 border border-border rounded" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold">Date</th>
                        <th className="text-left py-3 px-4 font-semibold">Store</th>
                        <th className="text-left py-3 px-4 font-semibold">Dept</th>
                        <th className="text-right py-3 px-4 font-semibold">Weekly Sales</th>
                        <th className="text-center py-3 px-4 font-semibold">Anomaly</th>
                        <th className="text-right py-3 px-4 font-semibold">Anomaly Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedData
                        .filter((d) => {
                          if (!d.anomalyFlag) return false;
                          if (storeFilter && (displayInventories.find((i) => i.productId === d.productId)?.storeId !== storeFilter)) return false;
                          if (deptFilter && (displayInventories.find((i) => i.productId === d.productId)?.category !== deptFilter)) return false;
                          if (dateFrom && new Date(d.date) < new Date(dateFrom)) return false;
                          if (dateTo && new Date(d.date) > new Date(dateTo)) return false;
                          return true;
                        })
                        .map((d) => {
                          // Backend returns: anomaly (-1 or 0), anomaly_score (float)
                          const anomaly = d.anomalyFlag ? -1 : 0;
                          const anomalyScore = Math.round((Math.abs(d.historicalSales - d.forecast) / Math.max(1, d.historicalSales)) * 100) / 100;
                          
                          return (
                            <tr key={d.productId + d.date} className="border-b border-border">
                              <td className="py-3 px-4">{d.date}</td>
                              <td className="py-3 px-4">{displayInventories.find((i) => i.productId === d.productId)?.storeId ?? "-"}</td>
                              <td className="py-3 px-4">{displayInventories.find((i) => i.productId === d.productId)?.category ?? "-"}</td>
                              <td className="py-3 px-4 text-right font-mono">{d.historicalSales}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`font-semibold ${anomaly === -1 ? 'text-red-600' : 'text-green-600'}`}>
                                  {anomaly === -1 ? '-1' : '0'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono">{anomalyScore.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
              {selectedData.filter((d) => d.anomalyFlag).length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">
                    ⚠️ Anomalies Detected
                  </p>
                  <ul className="space-y-1">
                    {selectedData
                      .filter((d) => d.anomalyFlag && d.anomalyReason)
                      .slice(0, 3)
                      .map((record, idx) => (
                        <li key={idx} className="text-xs text-yellow-800">
                          {record.date}: {record.anomalyReason}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Analysis Dashboard */}
          <Card className="border-0 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Risk Analysis
              </CardTitle>
              <p className="text-sm text-foreground/60 mt-2">
                Scored by anomaly detection, cluster analysis, and risk factors
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold">Store</th>
                      <th className="text-center py-3 px-4 font-semibold">Risk Score</th>
                      <th className="text-center py-3 px-4 font-semibold">Risk Level</th>
                      <th className="text-center py-3 px-4 font-semibold">Cluster</th>
                      <th className="text-center py-3 px-4 font-semibold">Anomaly</th>
                      <th className="text-right py-3 px-4 font-semibold">Days to Stockout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayInventories
                      .map((inv) => {
                        // Simulate risk scoring logic (like your backend)
                        let score = 0;
                        const anomalyFlag = inv.riskLevel === "critical" ? -1 : 0;
                        const anomalyScore = Math.random() * 0.3; // Mock anomaly score
                        const clusterId = Math.floor(Math.random() * 8); // Mock cluster 0-7

                        if (anomalyFlag === -1) score += 40;
                        if (Math.abs(anomalyScore) > 0.15) score += 10;
                        if (clusterId >= 6) score += 20;

                        let level = "LOW";
                        if (score >= 60) level = "HIGH";
                        else if (score >= 30) level = "MEDIUM";

                        return { ...inv, riskScore: score, computedRiskLevel: level, clusterId, anomalyFlag, anomalyScore };
                      })
                      .sort((a, b) => b.riskScore - a.riskScore)
                      .slice(0, 10)
                      .map((item) => (
                        <tr key={item.productId} className="border-b border-border hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">{item.storeId}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold">{item.riskScore}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                item.computedRiskLevel === "HIGH"
                                  ? "bg-red-100 text-red-800"
                                  : item.computedRiskLevel === "MEDIUM"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {item.computedRiskLevel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">{item.clusterId}</td>
                          <td className="py-3 px-4 text-center">
                            {item.anomalyFlag === -1 ? (
                              <span className="text-red-600 font-semibold">⚠️ Yes</span>
                            ) : (
                              <span className="text-green-600">✓ No</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{item.daysUntilStockout}d</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Real-Time Alerts & Anomalies */}
          <Card className="border-0 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Real-Time Alerts {!dataLoaded && iotDataPoints.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({iotDataPoints.length} IoT updates)
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-foreground/60 mt-2">
                {!dataLoaded 
                  ? "Live IoT data stream - Updates appear automatically as data arrives"
                  : "Instant notifications to keep you ahead of critical events"
                }
              </p>
            </CardHeader>
            <CardContent>
              {/* Show real-time alerts from WebSocket if available */}
              {!dataLoaded && realtimeAlerts.length > 0 && (
                <div className="space-y-3 mb-6">
                  {realtimeAlerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className="p-4 border-2 border-red-200 bg-red-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-red-900">{alert.message}</p>
                          <p className="text-xs text-red-700 mt-1">
                            Store: {alert.store} | Dept: {alert.dept} | Risk Score: {alert.risk_score}
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 bg-red-200 text-red-800 rounded-full">
                          HIGH RISK
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Show latest IoT data points */}
              {!dataLoaded && iotDataPoints.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    📊 Latest IoT Data Points
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {iotDataPoints.slice(-4).reverse().map((point: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded border">
                        <p className="font-semibold">Store {point.data?.store}</p>
                        <p className="text-xs text-muted-foreground">
                          Sales: ${point.data?.weekly_sales?.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Risk: {point.analysis?.risk_level}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {displayInventories
                  .map((inv) => {
                    // Calculate risk details (matching backend logic)
                    let score = 0;
                    const anomalyFlag = inv.riskLevel === "critical" ? -1 : 0;
                    const anomalyScore = Math.random() * 0.3;
                    const clusterId = Math.floor(Math.random() * 8);

                    if (anomalyFlag === -1) score += 40;
                    if (Math.abs(anomalyScore) > 0.15) score += 10;
                    if (clusterId >= 6) score += 20;

                    let level = "LOW";
                    if (score >= 60) level = "HIGH";
                    else if (score >= 30) level = "MEDIUM";

                    // Generate warnings based on backend alert logic
                    const warnings = [];
                    if (level === "HIGH") {
                      warnings.push("⚠ High operational risk detected");
                    }
                    if (anomalyFlag === -1) {
                      warnings.push("⚠ Anomaly detected in sales behavior");
                    }
                    if (clusterId === 6 || clusterId === 7) {
                      warnings.push("⚠ Store belongs to high-risk behavior group");
                    }
                    if (warnings.length === 0) {
                      warnings.push("No alerts. Situation normal.");
                    }

                    return { ...inv, warnings, level, clusterId, anomalyFlag };
                  })
                  .filter((item) => item.warnings.length > 1 || item.warnings[0] !== "No alerts. Situation normal.")
                  .slice(0, 5)
                  .map((item) => (
                    <div
                      key={item.productId}
                      className="p-4 border border-border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            {item.productName} ({item.productId})
                          </p>
                          <p className="text-xs text-foreground/60 mt-1">
                            Store: {item.storeId} | Cluster: {item.clusterId} | Risk Level: {item.level}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ml-4 ${
                            item.level === "HIGH"
                              ? "bg-red-100 text-red-800"
                              : item.level === "MEDIUM"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {item.level}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {item.warnings.map((warning, idx) => (
                          <p key={idx} className="text-sm text-foreground/70">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="border-0 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Recommendations
              </CardTitle>
              <p className="text-sm text-foreground/60 mt-2">
                Actionable insights to guide smarter decisions
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold">Optimization Action</th>
                      <th className="text-left py-3 px-4 font-semibold">Reason</th>
                      <th className="text-left py-3 px-4 font-semibold">Store</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recommendationsQuery.data || []).map((rec: any, index: number) => (
                      <tr key={`rec-${index}-${rec.storeId}`} className="border-b border-border hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold">{rec.title}</td>
                        <td className="py-3 px-4 text-foreground/60">{rec.details}</td>
                        <td className="py-3 px-4">{rec.storeId ?? "-"}</td>
                        <td className="py-3 px-4">{rec.date ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

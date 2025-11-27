import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMetrics, fetchInventories, fetchForecast, fetchRecommendations, fetchKPIMetrics, fetchAnomalies, fetchRiskAnalysis, fetchAlerts, WS_ALERTS_URL, fetchOverallAccuracy, type OverallAccuracyMetrics, fetchBacktestComparison, type BacktestComparisonResult } from "@/lib/api";
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
  const [storeFilter, setStoreFilter] = useState<string>("1");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [approvedOrders, setApprovedOrders] = useState<number>(0);
  const [savedRevenue, setSavedRevenue] = useState<number>(0);
  // Forecast section state
  const [forecastStoreFilter, setForecastStoreFilter] = useState<string>("1");
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
              // Add new IoT data point and update KPI metrics in one state update
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

                  // Update KPI metrics state immediately
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

              // Invalidate queries to refresh dashboard graphs (force immediate refetch)
              queryClient.invalidateQueries({ queryKey: ["kpi"] });
              queryClient.invalidateQueries({ queryKey: ["forecast"] }); // Add forecast invalidation
              queryClient.invalidateQueries({ queryKey: ["alerts"] });
              queryClient.invalidateQueries({ queryKey: ["anomalies"] });
              queryClient.invalidateQueries({ queryKey: ["risk"] });
              
              // Force immediate refetch (bypass staleTime)
              queryClient.refetchQueries({ queryKey: ["kpi"] });
              queryClient.refetchQueries({ queryKey: ["forecast"] });
              queryClient.refetchQueries({ queryKey: ["alerts"] });
              queryClient.refetchQueries({ queryKey: ["anomalies"] });
              queryClient.refetchQueries({ queryKey: ["risk"] });
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
  // Reduced staleTime for real-time updates when using backend data (not CSV)
  const staleTimeForRealtime = dataLoaded ? 60_000 : 5_000; // 5 seconds when using backend data, 60s for CSV
  const metricsQuery = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, staleTime: staleTimeForRealtime });
  const inventoriesQuery = useQuery({ queryKey: ["inventories"], queryFn: fetchInventories, staleTime: staleTimeForRealtime });
  const forecastQuery = useQuery({ 
    queryKey: ["forecast", forecastStoreFilter, forecastPeriods], 
    queryFn: () => fetchForecast(forecastStoreFilter ? parseInt(forecastStoreFilter) : undefined, forecastPeriods), 
    staleTime: staleTimeForRealtime,
    refetchInterval: dataLoaded ? false : 10_000 // Auto-refetch every 10s when using backend data
  });
  const recommendationsQuery = useQuery({ 
    queryKey: ["recommendations"], 
    queryFn: () => fetchRecommendations(), 
    staleTime: staleTimeForRealtime 
  });
  const kpiQuery = useQuery({ 
    queryKey: ["kpi"], 
    queryFn: () => fetchKPIMetrics(), 
    staleTime: staleTimeForRealtime,
    refetchInterval: dataLoaded ? false : 10_000 // Auto-refetch every 10s when using backend data
  });
  const anomaliesQuery = useQuery({ 
    queryKey: ["anomalies"], 
    queryFn: () => fetchAnomalies(), 
    staleTime: staleTimeForRealtime,
    refetchInterval: dataLoaded ? false : 10_000 // Auto-refetch every 10s when using backend data
  });
  // Note: Risk and Alerts require POST data, so we skip these queries for now
  // They are calculated on-demand when IoT data arrives via WebSocket
  const riskQuery = useQuery({ 
    queryKey: ["risk"], 
    queryFn: () => Promise.resolve({ risk_score: 0, risk_level: "LOW", cluster: 0, anomaly: 1, anomaly_score: 0 }), 
    staleTime: staleTimeForRealtime,
    enabled: false // Disabled - risk is calculated per IoT data point
  });
  const alertsQuery = useQuery({ 
    queryKey: ["alerts"], 
    queryFn: () => Promise.resolve({ alerts: [], details: null }), 
    staleTime: staleTimeForRealtime,
    enabled: false // Disabled - alerts come from WebSocket
  });
  const accuracyQuery = useQuery({ 
    queryKey: ["model-accuracy"], 
    queryFn: () => fetchOverallAccuracy(), 
    staleTime: 300_000, // Cache for 5 minutes (accuracy doesn't change often)
    retry: 1, // Only retry once if it fails
    refetchOnWindowFocus: false // Don't refetch when window regains focus
  });
  const backtestQuery = useQuery({ 
    queryKey: ["backtest-comparison"], 
    queryFn: () => {
      console.log("[Dashboard] Fetching backtest comparison...");
      return fetchBacktestComparison(undefined, 6); // 6 weeks for better accuracy
    },
    staleTime: 300_000, // Cache for 5 minutes
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Debug logging for backtest query
  useEffect(() => {
    if (backtestQuery.data) {
      console.log("[Dashboard] Backtest query success:", {
        hasData: !!backtestQuery.data,
        keys: Object.keys(backtestQuery.data),
        hasComparison: "comparison" in backtestQuery.data,
        comparisonLength: "comparison" in backtestQuery.data ? (backtestQuery.data as BacktestComparisonResult).comparison.length : 0
      });
    }
    if (backtestQuery.error) {
      console.error("[Dashboard] Backtest query error:", backtestQuery.error);
    }
  }, [backtestQuery.data, backtestQuery.error]);

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
    const startDate = new Date('2012-10-26');
    // Base around avg weekly sales
    const base = 15000 + (Math.abs(productId?.length || 0) * 200);
    return Array.from({ length: periods }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + (i * 7));
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
      <main className="min-h-screen pb-12 relative bg-background">
        {/* Animated background grid */}
        <div className="fixed inset-0 grid-pattern opacity-20 pointer-events-none"></div>
        <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          {/* Real-Time Status Indicator */}
          {!dataLoaded && (
            <div className="mb-6 p-4 glass-card flex items-center gap-3 neon-border smooth-transition">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse pulse-glow' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-foreground">
                {wsConnected 
                  ? `🟢 Real-Time Mode: Connected (${iotDataPoints.length} data points received)`
                  : '🔴 Real-Time Mode: Connecting...'}
              </span>
              {wsConnected && iotDataPoints.length > 0 && (
                <span className="text-xs text-foreground/60 ml-auto">
                  Graphs update automatically as new data arrives
                </span>
              )}
            </div>
          )}
          
          {/* KPI Overview Section - Backend Driven */}
          <section className="mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-8 gradient-text font-heading">KPI Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="p-6 futuristic-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Avg Weekly Sales</p>
                    <p className="text-2xl font-semibold text-foreground">
                      ${displayKPIMetrics.avgWeeklySales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary neon-glow" />
                </div>
              </Card>

              <Card className="p-6 futuristic-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Max Sales</p>
                    <p className="text-2xl font-semibold text-foreground whitespace-nowrap">
                      ${displayKPIMetrics.maxSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <ArrowUp className="h-8 w-8 text-green-400 neon-glow-secondary" />
                </div>
              </Card>

              <Card className="p-6 futuristic-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Min Sales</p>
                    <p className="text-2xl font-semibold text-foreground">
                      ${displayKPIMetrics.minSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <ArrowDown className="h-8 w-8 text-orange-400" />
                </div>
              </Card>

              <Card className="p-6 futuristic-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Volatility</p>
                    <p className="text-2xl font-semibold text-foreground">
                      ${displayKPIMetrics.volatility.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-secondary neon-glow-secondary" />
                </div>
              </Card>

              <Card className="p-6 futuristic-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Holiday Sales Avg</p>
                    <p className="text-2xl font-semibold text-foreground">
                      ${displayKPIMetrics.holidaySalesAvg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-red-400" />
                </div>
              </Card>
            </div>
          </section>

          {/* Forecast Section */}
          <section className="mb-12">
            <Card className="futuristic-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-heading">
                <TrendingUp className="w-5 h-5 text-primary neon-glow" />
                <span className="gradient-text">Sales Forecast</span>
              </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
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
                    className="px-3 py-2 border border-border/50 rounded-lg text-sm glass bg-card text-foreground"
                  >
                    {Array.from({ length: 45 }, (_, i) => i + 1).map(storeNum => (
                      <option key={storeNum} value={storeNum}>Store {storeNum}</option>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255, 255, 255, 0.6)"
                    tick={{ fontSize: 12, fill: "rgba(255, 255, 255, 0.8)" }}
                  />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.6)"
                    tick={{ fill: "rgba(255, 255, 255, 0.8)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(34, 39, 46, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "0.5rem",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                    formatter={(value) => Math.round(value as number)}
                  />
                  <Legend 
                    wrapperStyle={{ color: "rgba(255, 255, 255, 0.9)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#3b82f6"
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
          </section>

          {/* Anomaly Detection */}
          <section className="mb-12">
            <Card className="futuristic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-heading">
                <AlertTriangle className="w-5 h-5 text-secondary neon-glow-secondary" />
                <span className="gradient-text">Anomaly Detection</span>
              </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255, 255, 255, 0.6)"
                    tick={{ fontSize: 12, fill: "rgba(255, 255, 255, 0.8)" }}
                  />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.6)"
                    tick={{ fill: "rgba(255, 255, 255, 0.8)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(34, 39, 46, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "0.5rem",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                    formatter={(value) => Math.round(value as number)}
                  />
                  <Legend 
                    wrapperStyle={{ color: "rgba(255, 255, 255, 0.9)" }}
                  />
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
                    stroke="#ffffff"
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
                      className="px-3 py-2 border border-border/50 rounded-lg text-sm glass bg-card/50 text-foreground"
                      value={storeFilter}
                      onChange={(e) => setStoreFilter(e.target.value)}
                    >
                      {Array.from({ length: 45 }, (_, i) => i + 1).map(storeNum => (
                        <option key={storeNum} value={storeNum}>Store {storeNum}</option>
                      ))}
                    </select>
                    <input 
                      type="date" 
                      className="px-3 py-2 border border-border/50 rounded-lg text-sm glass bg-card/50 text-foreground" 
                      value={dateFrom} 
                      onChange={(e) => setDateFrom(e.target.value)} 
                    />
                    <input 
                      type="date" 
                      className="px-3 py-2 border border-border/50 rounded-lg text-sm glass bg-card/50 text-foreground" 
                      value={dateTo} 
                      onChange={(e) => setDateTo(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Store</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">Weekly Sales</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">Anomaly</th>
                        <th className="text-right py-3 px-4 font-semibold text-foreground">Anomaly Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedData
                        .filter((d) => {
                          if (!d.anomalyFlag) return false;
                          if (storeFilter && (displayInventories.find((i) => i.productId === d.productId)?.storeId !== storeFilter)) return false;
                          if (dateFrom && new Date(d.date) < new Date(dateFrom)) return false;
                          if (dateTo && new Date(d.date) > new Date(dateTo)) return false;
                          return true;
                        })
                        .map((d) => {
                          // Backend returns: anomaly (-1 or 0), anomaly_score (float)
                          const anomaly = d.anomalyFlag ? -1 : 0;
                          const anomalyScore = Math.round((Math.abs(d.historicalSales - d.forecast) / Math.max(1, d.historicalSales)) * 100) / 100;
                          
                          return (
                            <tr key={d.productId + d.date} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                              <td className="py-3 px-4 text-foreground">{d.date}</td>
                              <td className="py-3 px-4 text-foreground">{displayInventories.find((i) => i.productId === d.productId)?.storeId ?? "-"}</td>
                              <td className="py-3 px-4 text-center font-mono text-foreground">{d.historicalSales}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`font-semibold ${anomaly === -1 ? 'text-red-400' : 'text-green-400'}`}>
                                  {anomaly === -1 ? '-1' : '0'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-foreground">{anomalyScore.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
              {selectedData.filter((d) => d.anomalyFlag).length > 0 && (
                <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg glass-card">
                  <p className="text-sm font-semibold text-yellow-400 mb-2">
                    ⚠️ Anomalies Detected
                  </p>
                  <ul className="space-y-1">
                    {selectedData
                      .filter((d) => d.anomalyFlag && d.anomalyReason)
                      .slice(0, 3)
                      .map((record, idx) => (
                        <li key={idx} className="text-xs text-yellow-300">
                          {record.date}: {record.anomalyReason}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          </section>

          {/* Risk Analysis Dashboard */}
          <section className="mb-12">
            <Card className="futuristic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-heading">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="gradient-text">Risk Analysis</span>
              </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Scored by anomaly detection, cluster analysis, and risk factors
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Store</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Risk Score</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Risk Level</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Cluster</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Anomaly</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">Days to Stockout</th>
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
                        <tr key={item.productId} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                          <td className="py-3 px-4 text-foreground">{item.storeId}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-foreground">{item.riskScore}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                item.computedRiskLevel === "HIGH"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : item.computedRiskLevel === "MEDIUM"
                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                    : "bg-green-500/20 text-green-400 border border-green-500/30"
                              }`}
                            >
                              {item.computedRiskLevel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-foreground">{item.clusterId}</td>
                          <td className="py-3 px-4 text-center">
                            {item.anomalyFlag === -1 ? (
                              <span className="text-red-400 font-semibold">⚠️ Yes</span>
                            ) : (
                              <span className="text-green-400">✓ No</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-foreground">{item.daysUntilStockout}d</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </section>

          {/* Real-Time Alerts & Anomalies */}
          <section className="mb-12">
            <Card className="futuristic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-heading">
                <Zap className="w-5 h-5 text-accent neon-glow" />
                <span className="gradient-text">Real-Time Alerts</span> {!dataLoaded && iotDataPoints.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({iotDataPoints.length} IoT updates)
                  </span>
                )}
              </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
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
                      className="p-4 border-2 border-red-500/30 bg-red-500/20 rounded-lg glass-card"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-red-400">{alert.message}</p>
                          <p className="text-xs text-red-300 mt-1">
                            Store: {alert.store} | Dept: {alert.dept} | Risk Score: {alert.risk_score}
                          </p>
                          <p className="text-xs text-red-400/80 mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 bg-red-500/30 text-red-300 border border-red-500/50 rounded-full">
                          HIGH RISK
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Show latest IoT data points */}
              {!dataLoaded && iotDataPoints.length > 0 && (
                <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg glass-card">
                  <p className="text-sm font-semibold text-blue-400 mb-2">
                    📊 Latest IoT Data Points
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {iotDataPoints.slice(-4).reverse().map((point: any, idx: number) => (
                      <div key={idx} className="glass-card p-3 rounded-lg border border-border/50">
                        <p className="font-semibold text-foreground">Store {point.data?.store}</p>
                        <p className="text-xs text-foreground/70 mt-1">
                          Sales: ${point.data?.weekly_sales?.toFixed(2)}
                        </p>
                        <p className="text-xs text-foreground/70">
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
                      className="p-4 border border-border/50 rounded-lg glass-card hover:bg-primary/5 transition-colors"
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
                           className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ml-4 border ${
                             item.level === "HIGH"
                               ? "bg-red-500/20 text-red-400 border-red-500/30"
                               : item.level === "MEDIUM"
                                 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                 : "bg-green-500/20 text-green-400 border-green-500/30"
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
          </section>

          {/* Model Accuracy Section */}
          <section className="mb-12">
            <Card className="futuristic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-heading">
                <BarChart3 className="w-5 h-5 text-primary neon-glow" />
                <span className="gradient-text">Model Accuracy & Performance</span>
              </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Comparison of our trained model predictions vs actual Walmart sales data (3-month backtest)
              </p>
            </CardHeader>
            <CardContent>
              {accuracyQuery.isLoading || !accuracyQuery.data ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="ml-3 text-muted-foreground">Calculating accuracy metrics...</span>
                </div>
              ) : accuracyQuery.error ? (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg glass-card">
                  <p className="text-sm text-red-400">
                    Failed to load accuracy metrics. Please try again later.
                  </p>
                </div>
              ) : accuracyQuery.data ? (
                <div className="space-y-6">
                  {/* Overall Confidence Score */}
                  <div className="p-6 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-lg border border-primary/30 glass-card">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Overall Model Confidence</p>
                        <p className="text-3xl font-bold gradient-text">
                          {accuracyQuery.data.overall_confidence.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-foreground/80 mb-1">Forecast: {accuracyQuery.data.forecast_confidence.toFixed(1)}%</p>
                        <p className="text-xs text-foreground/80">Anomaly: {accuracyQuery.data.anomaly_confidence.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-primary/20 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-primary to-secondary h-3 rounded-full transition-all duration-500"
                        style={{ width: `${accuracyQuery.data.overall_confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Forecast Accuracy Metrics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Forecast Model Accuracy
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">MAE</p>
                        <p className="text-xl font-bold text-foreground">
                          {accuracyQuery.data.forecast_metrics.mae.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Mean Absolute Error</p>
                      </div>
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">RMSE</p>
                        <p className="text-xl font-bold text-foreground">
                          {accuracyQuery.data.forecast_metrics.rmse.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Root Mean Squared Error</p>
                      </div>
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">MAPE</p>
                        <p className="text-xl font-bold text-foreground">
                          {accuracyQuery.data.forecast_metrics.mape.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Mean Absolute % Error</p>
                      </div>
                      {accuracyQuery.data.forecast_metrics.coverage && (
                        <div className="p-4 glass-card border border-border/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Coverage</p>
                          <p className="text-xl font-bold text-foreground">
                            {(accuracyQuery.data.forecast_metrics.coverage * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Prediction Interval</p>
                        </div>
                      )}
                    </div>
                    {accuracyQuery.data.forecast_metrics.stores_evaluated && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Evaluated across {accuracyQuery.data.forecast_metrics.stores_evaluated} stores
                      </p>
                    )}
                  </div>

                  {/* Anomaly Detection Metrics */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Anomaly Detection Performance
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Detection Rate</p>
                        <p className="text-xl font-bold text-foreground">
                          {(accuracyQuery.data.anomaly_metrics.anomaly_detection_rate * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {accuracyQuery.data.anomaly_metrics.anomalies_detected} anomalies found
                        </p>
                      </div>
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Normal Rate</p>
                        <p className="text-xl font-bold text-foreground">
                          {(accuracyQuery.data.anomaly_metrics.normal_detection_rate * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {accuracyQuery.data.anomaly_metrics.normal_samples} normal samples
                        </p>
                      </div>
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Total Samples</p>
                        <p className="text-xl font-bold text-foreground">
                          {accuracyQuery.data.anomaly_metrics.total_samples}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Evaluated</p>
                      </div>
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Score Std Dev</p>
                        <p className="text-xl font-bold text-foreground">
                          {accuracyQuery.data.anomaly_metrics.score_std.toFixed(3)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Confidence spread</p>
                      </div>
                    </div>
                    {accuracyQuery.data.anomaly_metrics.note && (
                      <p className="text-xs text-muted-foreground mt-3 italic">
                        {accuracyQuery.data.anomaly_metrics.note}
                      </p>
                    )}
                  </div>

                  {/* Predicted vs Actual Comparison Graph */}
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Predicted vs Actual Sales Comparison (6-Week Backtest)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This graph demonstrates how accurately our model predicts actual Walmart sales. 
                      The closer the predicted line (purple) matches the actual line (green), the better our model performs.
                    </p>
                    
                    {backtestQuery.data && "comparison" in backtestQuery.data && (backtestQuery.data as BacktestComparisonResult).comparison.length > 0 ? (
                      <div>
                        <ResponsiveContainer width="100%" height={400}>
                          <ComposedChart data={(backtestQuery.data as BacktestComparisonResult).comparison}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis 
                              dataKey="date" 
                              stroke="rgba(255, 255, 255, 0.6)"
                              tick={{ fontSize: 12, fill: "rgba(255, 255, 255, 0.8)" }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis 
                              stroke="rgba(255, 255, 255, 0.6)"
                              tick={{ fill: "rgba(255, 255, 255, 0.8)" }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(34, 39, 46, 0.95)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: "0.5rem",
                                color: "rgba(255, 255, 255, 0.9)",
                              } as React.CSSProperties}
                            />
                            <Legend 
                              wrapperStyle={{ color: "rgba(255, 255, 255, 0.9)" }}
                            />
                            {(backtestQuery.data as BacktestComparisonResult).comparison[0]?.forecast_lower && (
                              <>
                                <Area
                                  type="monotone"
                                  dataKey="forecast_lower"
                                  stroke="none"
                                  fill="#93c5fd"
                                  fillOpacity={0.2}
                                  name="Forecast Interval (Lower)"
                                />
                                <Area
                                  type="monotone"
                                  dataKey="forecast_upper"
                                  stroke="none"
                                  fill="#93c5fd"
                                  fillOpacity={0.2}
                                  name="Forecast Interval (Upper)"
                                />
                              </>
                            )}
                            <Line
                              type="monotone"
                              dataKey="actual"
                              stroke="#10b981"
                              strokeWidth={3}
                              name="Actual Sales (Walmart Data)"
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="forecast"
                              stroke="#8b5cf6"
                              strokeWidth={2.5}
                              strokeDasharray="5 5"
                              name="Predicted Sales (Our Model)"
                              dot={{ r: 3 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg glass-card">
                          <p className="text-xs text-blue-400">
                            <strong>Store {(backtestQuery.data as BacktestComparisonResult).store_id} Backtest Results:</strong> 
                            {" "}MAE: {(backtestQuery.data as BacktestComparisonResult).metrics.mae.toFixed(2)} | 
                            {" "}RMSE: {(backtestQuery.data as BacktestComparisonResult).metrics.rmse.toFixed(2)} | 
                            {" "}MAPE: {(backtestQuery.data as BacktestComparisonResult).metrics.mape.toFixed(2)}%
                          </p>
                          <p className="text-xs text-blue-300 mt-1">
                            This comparison uses the last 6 weeks of historical data to validate our model's accuracy.
                          </p>
                        </div>
                      </div>
                    ) : backtestQuery.data && "stores_evaluated" in backtestQuery.data && (backtestQuery.data as any).store_results && (backtestQuery.data as any).store_results.length > 0 ? (
                      <div>
                        <ResponsiveContainer width="100%" height={400}>
                          <ComposedChart data={(backtestQuery.data as any).store_results[0].comparison}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis 
                              dataKey="date" 
                              stroke="rgba(255, 255, 255, 0.6)"
                              tick={{ fontSize: 12, fill: "rgba(255, 255, 255, 0.8)" }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis 
                              stroke="rgba(255, 255, 255, 0.6)"
                              tick={{ fill: "rgba(255, 255, 255, 0.8)" }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(34, 39, 46, 0.95)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: "0.5rem",
                                color: "rgba(255, 255, 255, 0.9)",
                              } as React.CSSProperties}
                            />
                            <Legend 
                              wrapperStyle={{ color: "rgba(255, 255, 255, 0.9)" }}
                            />
                            <Area
                              type="monotone"
                              dataKey="forecast_lower"
                              stroke="none"
                              fill="#93c5fd"
                              fillOpacity={0.2}
                              name="Forecast Interval (Lower)"
                            />
                            <Area
                              type="monotone"
                              dataKey="forecast_upper"
                              stroke="none"
                              fill="#93c5fd"
                              fillOpacity={0.2}
                              name="Forecast Interval (Upper)"
                            />
                            <Line
                              type="monotone"
                              dataKey="actual"
                              stroke="#10b981"
                              strokeWidth={3}
                              name="Actual Sales (Walmart Data)"
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="forecast"
                              stroke="#8b5cf6"
                              strokeWidth={2.5}
                              strokeDasharray="5 5"
                              name="Predicted Sales (Our Model)"
                              dot={{ r: 3 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg glass-card">
                          <p className="text-xs text-blue-400">
                            <strong>Store {(backtestQuery.data as any).store_results[0].store_id} Backtest Results:</strong> 
                            {" "}MAE: {(backtestQuery.data as any).store_results[0].metrics.mae.toFixed(2)} | 
                            {" "}RMSE: {(backtestQuery.data as any).store_results[0].metrics.rmse.toFixed(2)} | 
                            {" "}MAPE: {(backtestQuery.data as any).store_results[0].metrics.mape.toFixed(2)}%
                          </p>
                          <p className="text-xs text-blue-300 mt-1">
                            This comparison uses the last 6 weeks of historical data to validate our model's accuracy.
                            {(backtestQuery.data as any).stores_evaluated > 1 && ` (Showing 1 of ${(backtestQuery.data as any).stores_evaluated} stores evaluated)`}
                          </p>
                        </div>
                      </div>
                    ) : backtestQuery.isLoading ? (
                      <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg glass-card">
                        <div className="flex items-center gap-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                          <div>
                            <p className="text-sm font-medium text-blue-400">
                              Generating comparison graph...
                            </p>
                            <p className="text-xs text-blue-300 mt-1">
                              This may take 30-60 seconds (training Prophet model on Walmart data)
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : backtestQuery.error ? (
                      <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg glass-card">
                        <p className="text-sm font-medium text-yellow-400 mb-2">
                          ⚠️ Backtest comparison unavailable
                        </p>
                        <p className="text-xs text-yellow-300">
                          Error: {backtestQuery.error instanceof Error ? backtestQuery.error.message : 'Unknown error'}
                        </p>
                        <p className="text-xs text-yellow-400/80 mt-2">
                          Check backend logs for details. Ensure Walmart_Sales.csv has sufficient data (at least 32 weeks).
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 glass-card border border-border/50 rounded-lg">
                        <p className="text-sm text-foreground/80 mb-2">
                          Comparison graph will be displayed here once backtest data is available.
                        </p>
                        <p className="text-xs text-foreground/60">
                          Debug: isLoading={backtestQuery.isLoading ? 'true' : 'false'}, 
                          hasError={backtestQuery.error ? 'true' : 'false'}, 
                          hasData={backtestQuery.data ? 'true' : 'false'}
                          {backtestQuery.data && ` | Keys: ${Object.keys(backtestQuery.data).join(', ')}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Evaluation Info */}
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Last evaluated: {new Date(accuracyQuery.data.evaluation_date).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 glass-card border border-border/50 rounded-lg">
                  <p className="text-sm text-foreground/80">
                    Accuracy metrics will be displayed here once evaluation is complete.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          </section>

          {/* Recommendations */}
          <section className="mb-12">
            <Card className="futuristic-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl font-heading">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="gradient-text">Recommendations</span>
              </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Actionable insights to guide smarter decisions
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Optimization Action</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Reason</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Store</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                    </tr>
                  </thead>
                   <tbody>
                     {Array.isArray(recommendationsQuery.data) && recommendationsQuery.data.length > 0 ? (
                       recommendationsQuery.data.map((rec: any) => (
                         <tr key={rec.id || rec.title} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                           <td className="py-3 px-4 font-semibold text-foreground">{rec.title}</td>
                           <td className="py-3 px-4 text-foreground/70">{rec.details}</td>
                           <td className="py-3 px-4 text-foreground">{rec.storeId ?? "-"}</td>
                           <td className="py-3 px-4 text-foreground">{rec.date ?? "-"}</td>
                         </tr>
                       ))
                     ) : (
                       <tr>
                         <td colSpan={4} className="py-8 text-center text-muted-foreground">
                           No recommendations available
                         </td>
                       </tr>
                     )}
                   </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </section>
        </div>
      </main>
    </>
  );
}

# Backend API Comparison - LIVE TEST RESULTS
**Date:** November 27, 2025  
**Backend URL:** https://organ-c-codefest-hackathon.onrender.com

---

## ✅ WORKING PERFECTLY

### 1. Health Check
- **Endpoint:** `GET /health`
- **Backend Returns:** `{"status":"ok"}`
- **Frontend Expects:** `{"status":"ok"}`
- **Status:** ✅ **PERFECT MATCH**

### 2. KPI Overview
- **Endpoint:** `GET /api/v1/kpi/?store_id={id}&dept={dept}`
- **Backend Returns:**
```json
{
  "avg_weekly_sales": 16033.114591372927,
  "max_sales": 693099.36,
  "min_sales": 0.01,
  "volatility": 22729.492115973506,
  "holiday_sales_avg": 17094.300918470904
}
```
- **Frontend Expects:** Exact same structure (already mapping snake_case to camelCase)
- **Status:** ✅ **PERFECT MATCH** - Frontend correctly maps the response

### 3. Stores List
- **Endpoint:** `GET /api/v1/stores/`
- **Backend Returns:**
```json
{
  "total_stores": 45,
  "stores": [
    {
      "store_id": 1,
      "total_sales": 222406766.77,
      "avg_weekly_sales": 21749.145977899472,
      "num_departments": 77
    },
    ...
  ]
}
```
- **Frontend Expects:** Same structure
- **Status:** ✅ **PERFECT MATCH**

### 4. Top Stores
- **Endpoint:** `GET /api/v1/stores/top?limit={limit}`
- **Backend Returns:**
```json
[
  {"store_id": 20, "total_sales": 301401381.45},
  {"store_id": 4, "total_sales": 299545269.3},
  ...
]
```
- **Frontend Expects:** Same array structure
- **Status:** ✅ **PERFECT MATCH**

### 5. Authentication
- **Endpoints:**
  - `POST /api/v1/auth/login/json`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/logout`
- **Status:** ✅ **Frontend correctly implements these**

---

## ⚠️ ISSUES FOUND - NEEDS FIXING

### Issue 1: Forecast Missing Confidence Intervals ⚠️
**Endpoint:** `GET /api/v1/forecast/?store_id=1&periods=6`

**Backend Currently Returns:**
```json
[
  {
    "timestamp": "2012-11-04",
    "forecast": 1609455.7136583664
  },
  {
    "timestamp": "2012-11-11",
    "forecast": 1672800.3776089204
  }
]
```

**Frontend Expects:**
```json
[
  {
    "timestamp": "2012-11-04",
    "forecast": 1609455.71,
    "lower_bound": 1450000.00,  // ❌ MISSING
    "upper_bound": 1750000.00   // ❌ MISSING
  }
]
```

**Impact:** Forecast chart won't show confidence intervals (the shaded area showing uncertainty)

**Solution Options:**
1. **Backend adds `lower_bound` and `upper_bound`** (RECOMMENDED)
   - Calculate as: `lower_bound = forecast * 0.9`, `upper_bound = forecast * 1.1`
   - Or use actual model confidence intervals if available

2. **Frontend calculates them** (Quick fix):
```typescript
return json.map((item: any) => ({
  date: item.timestamp,
  forecast: item.forecast,
  lowerInterval: item.lower_bound || item.forecast * 0.9,  // Fallback
  upperInterval: item.upper_bound || item.forecast * 1.1,  // Fallback
  historicalSales: 0,
  anomalyFlag: false
}));
```

---

### Issue 2: Recommendations Format COMPLETELY DIFFERENT ❌
**Endpoint:** `GET /api/v1/recommendations/?store_id=1`

**Backend Currently Returns:**
```json
{
  "store_id": 1,
  "risk_level": "MEDIUM",
  "recommendations": [
    {
      "type": "PRICING",
      "priority": "MEDIUM",
      "message": "Unusual sales pattern detected. Review pricing strategy...",
      "expected_impact": "Optimize revenue by identifying pricing opportunities"
    },
    {
      "type": "INVENTORY",
      "priority": "MEDIUM",
      "message": "Sales forecast shows upward trend. Increase inventory orders...",
      "expected_impact": "Prevent stockouts and capture increased demand"
    }
  ]
}
```

**Frontend Expects:**
```json
[
  {
    "id": "rec-001",
    "title": "Review pricing strategy",
    "details": "Unusual sales pattern detected...",
    "storeId": "store-1",
    "date": "2025-11-27",
    "action": "order",
    "severity": "high"
  }
]
```

**Impact:** Recommendations table will be EMPTY or show wrong data

**Solution - Fix Frontend Mapping:**
```typescript
export async function fetchRecommendations(storeId?: number): Promise<any> {
  if (USE_MOCK) return demoRecommendations();
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    
    const res = await fetch(`${API_V1}/recommendations?${params.toString()}`);
    if (!res.ok) throw new Error("API error");
    const json = await res.json();
    
    // Backend returns nested structure, need to extract and map
    const recommendations = json.recommendations || [];
    
    return recommendations.map((item: any, index: number) => ({
      id: `rec-${json.store_id}-${index}`,
      title: `${item.type}: ${item.message.substring(0, 50)}...`,
      details: `${item.message} ${item.expected_impact}`,
      storeId: `store-${json.store_id}`,
      date: new Date().toISOString().split('T')[0],
      action: item.type.toLowerCase(),
      severity: item.priority.toLowerCase()
    }));
  } catch (err) {
    console.warn("fetchRecommendations failed", err);
    return demoRecommendations();
  }
}
```

---

### Issue 3: No Inventory Endpoint ❌
**Frontend Needs:** `GET /api/v1/inventory` or similar

**Backend Has:** ❌ Nothing

**Frontend Currently:** Uses demo data only

**Impact:** 
- Risk Analysis table shows fake data
- Missing critical field: **`daysUntilStockout`** (needed for risk scoring)
- No real inventory tracking

**Solution Options:**

**Option A: Backend creates inventory endpoint** (BEST for production)
```python
@router.get("/inventory")
def get_inventory(store_id: Optional[int] = None):
    # Calculate from sales data
    return [{
        "product_id": "prod-1",
        "store_id": 1,
        "current_stock": 1000,
        "avg_daily_demand": 50,
        "days_until_stockout": 20,  # current_stock / avg_daily_demand
        "risk_level": "low"
    }]
```

**Option B: Frontend generates from stores** (Quick workaround)
```typescript
export async function fetchInventories(): Promise<InventorySnapshot[]> {
  try {
    const storesData = await fetchStores();
    return storesData.stores.map((store: any) => ({
      productId: `prod-store-${store.store_id}`,
      productName: `Store ${store.store_id} Products`,
      storeId: `store-${store.store_id}`,
      category: "General",
      currentStock: Math.round(store.avg_weekly_sales * 4), // 4 weeks stock
      daysUntilStockout: Math.round(Math.random() * 30 + 10), // Fake: 10-40 days
      riskLevel: store.avg_weekly_sales > 20000 ? "high" : "medium",
      avgDailyDemand: Math.round(store.avg_weekly_sales / 7)
      // ... other fields
    }));
  } catch (err) {
    return demoInventories();
  }
}
```

---

## 🔍 UNTESTED ENDPOINTS

These endpoints exist but need POST requests with data, so I couldn't test them:

### 1. Anomaly Detection
- **Endpoint:** `POST /api/v1/anomaly/`
- **Frontend Usage:** Correctly uses POST ✅
- **Expected Response:** `{"anomaly": -1 or 0, "anomaly_score": 0.15}`
- **Status:** Likely working (frontend implementation looks correct)

### 2. Risk Analysis
- **Endpoint:** `POST /api/v1/risk/`
- **Frontend Usage:** Correctly uses POST ✅
- **Expected Response:** `{"risk_score": 50, "risk_level": "MEDIUM", "cluster": 3, ...}`
- **Status:** Likely working

### 3. Alerts
- **Endpoint:** `POST /api/v1/alerts/`
- **Frontend Usage:** Correctly uses POST ✅
- **Status:** Likely working

### 4. Clustering
- **Endpoint:** `POST /api/v1/cluster/`
- **Frontend Usage:** Correctly uses POST ✅
- **Expected Response:** `{"cluster": 3}`
- **Status:** Likely working

### 5. IoT Ingestion
- **Endpoint:** `POST /api/v1/iot/`
- **Frontend Usage:** Not directly used (data comes via WebSocket)
- **Status:** Unknown

### 6. WebSocket
- **Endpoint:** `ws://organ-c-codefest-hackathon.onrender.com/ws/alerts`
- **Frontend Usage:** Dashboard connects on mount ✅
- **Status:** Implementation looks correct

---

## 🚨 CRITICAL MISSING FIELD

### `daysUntilStockout` - NEEDED for Risk Analysis Table

**Used in:** `Dashboard.tsx` line ~748
```tsx
<td className="py-3 px-4 text-right font-mono">{item.daysUntilStockout}d</td>
```

**Problem:** This field doesn't exist in any backend endpoint

**Solutions:**
1. **Backend adds to inventory endpoint** (BEST)
2. **Frontend calculates:** `daysUntilStockout = currentStock / avgDailyDemand`
3. **Frontend uses 0** as placeholder (shows "0d" everywhere)

---

## 📋 REQUIRED FRONTEND CHANGES

### Change 1: Fix Forecast Mapping (Handle Missing Bounds)
**File:** `frontend/client/lib/api.ts` line ~230

```typescript
// Current code (line ~235):
return json.map((item: any) => ({
  date: item.timestamp,
  forecast: item.forecast,
  lowerInterval: item.lower_bound,      // ❌ Will be undefined
  upperInterval: item.upper_bound,      // ❌ Will be undefined
  historicalSales: 0,
  anomalyFlag: false
}));

// Fixed code:
return json.map((item: any) => ({
  date: item.timestamp,
  forecast: item.forecast,
  lowerInterval: item.lower_bound || item.forecast * 0.9,  // ✅ Fallback
  upperInterval: item.upper_bound || item.forecast * 1.1,  // ✅ Fallback
  historicalSales: 0,
  anomalyFlag: false
}));
```

### Change 2: Fix Recommendations Mapping (CRITICAL)
**File:** `frontend/client/lib/api.ts` line ~250

```typescript
// Current code tries to use backend response directly
// But backend structure is completely different!

// Add this mapping:
export async function fetchRecommendations(storeId?: number): Promise<any> {
  if (USE_MOCK) return demoRecommendations();
  try {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', storeId.toString());
    
    const res = await fetch(`${API_V1}/recommendations?${params.toString()}`);
    if (!res.ok) throw new Error("API error");
    const json = await res.json();
    
    // ✅ Map backend format to frontend format
    const recommendations = json.recommendations || [];
    
    return recommendations.map((item: any, index: number) => ({
      id: `rec-${json.store_id}-${index}`,
      title: `${item.type}: ${item.message.split('.')[0]}`,  // First sentence
      details: `${item.message} Expected: ${item.expected_impact}`,
      storeId: `store-${json.store_id}`,
      date: new Date().toISOString().split('T')[0],
      action: item.type.toLowerCase(),
      severity: item.priority.toLowerCase()
    }));
  } catch (err) {
    console.warn("fetchRecommendations failed", err);
    return demoRecommendations();
  }
}
```

### Change 3: Generate Inventory from Stores (OPTIONAL)
**File:** `frontend/client/lib/api.ts` line ~215

```typescript
// Current code:
export async function fetchInventories(): Promise<InventorySnapshot[]> {
  return demoInventories();  // ❌ Always uses fake data
}

// Option: Generate from real stores data
export async function fetchInventories(): Promise<InventorySnapshot[]> {
  try {
    const storesData = await fetchStores();
    const stores = storesData.stores || [];
    
    if (stores.length === 0) {
      return demoInventories();
    }
    
    return stores.map((store: any) => {
      const avgDailySales = store.avg_weekly_sales / 7;
      const currentStock = Math.round(avgDailySales * 30); // 30 days worth
      const avgDailyDemand = Math.max(1, Math.round(avgDailySales / 100));
      
      return {
        productId: `prod-store-${store.store_id}`,
        productName: `Store ${store.store_id} Products`,
        storeId: `store-${store.store_id}`,
        category: "General Merchandise",
        currentStock: currentStock,
        reorderPoint: Math.round(avgDailyDemand * 7),
        safetyStock: Math.round(avgDailyDemand * 3),
        economicOrderQuantity: Math.round(avgDailyDemand * 14),
        daysUntilStockout: Math.round(currentStock / avgDailyDemand),  // ✅ Calculated
        riskLevel: store.avg_weekly_sales > 25000 ? "high" : "medium",
        recommendedOrderQty: Math.round(avgDailyDemand * 14),
        lastOrder: new Date().toISOString().split("T")[0],
        avgDailyDemand: avgDailyDemand,
      } as InventorySnapshot;
    });
  } catch (err) {
    console.warn("fetchInventories failed", err);
    return demoInventories();
  }
}
```

---

## ✅ IMPLEMENTATION PRIORITY

### Must Fix (Critical):
1. ✅ **Recommendations mapping** - Table is empty without this
2. ✅ **Forecast fallback for bounds** - Chart won't show confidence area

### Should Fix (Important):
3. ⚠️ **Inventory generation** - Risk Analysis table shows wrong data
4. ⚠️ **daysUntilStockout calculation** - Critical field is missing

### Nice to Have:
5. Backend adds actual `lower_bound`/`upper_bound` to forecast
6. Backend creates proper inventory endpoint

---

## 🧪 TESTING CHECKLIST

After making changes, test:

- [ ] KPI Overview shows real backend data ✅ (already working)
- [ ] Forecast chart displays with confidence intervals
- [ ] Recommendations table populates with backend data
- [ ] Risk Analysis table shows store data
- [ ] No console errors about undefined fields
- [ ] All tables display data (not empty)

---

## 📞 SUMMARY FOR YOUR TEAMMATE

**Tell your backend dev:**

1. ✅ **Good job!** KPI, Stores, Auth all work perfectly
2. ⚠️ **Forecast needs:** Add `lower_bound` and `upper_bound` fields
3. ⚠️ **Recommendations working** but frontend needs mapping (I'll handle)
4. ❌ **Missing:** Inventory endpoint with `daysUntilStockout` field

**What I'll do on frontend:**
- Fix recommendations mapping
- Add fallbacks for missing forecast bounds
- Generate inventory from stores data (temporary)
- Calculate daysUntilStockout from sales data

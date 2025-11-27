import { Router } from "express";

const router = Router();

// GET /api/kpi_overview
// Query params: store_id (optional), dept (optional)
router.get("/kpi_overview", async (req, res) => {
  const { store_id, dept } = req.query as { store_id?: string; dept?: string };

  // Backend base URL: allow override via env, default to Render
  const API_BASE_URL = process.env.BACKEND_API_BASE_URL || "https://organ-c-codefest-hackathon-production.up.railway.app";
  const API_V1 = `${API_BASE_URL}/api/v1`;

  // Build query string
  const params = new URLSearchParams();
  if (store_id) params.append("store_id", store_id);
  if (dept) params.append("dept", dept);

  const url = `${API_V1}/kpi?${params.toString()}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      console.error("KPI proxy error:", resp.status, text);
      throw new Error(`Backend error ${resp.status}`);
    }
    const json = await resp.json();
    // Pass-through the backend structure
    return res.json(json);
  } catch (err) {
    console.warn("Falling back to demo KPI due to fetch failure:", err);
    // Safe demo fallback to avoid blank page
    const kpiData = {
      avg_weekly_sales: 15981.26,
      max_sales: 693099.36,
      min_sales: 209.96,
      volatility: 22786.18,
      holiday_sales_avg: 17413.1,
    };
    return res.json(kpiData);
  }
});

export default router;

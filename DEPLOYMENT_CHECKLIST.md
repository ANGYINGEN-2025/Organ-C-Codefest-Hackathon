# 🚀 Deployment Checklist

## ✅ Pre-Deployment Verification

### Backend (FastAPI)

#### ✅ Code Quality
- [x] No linter errors
- [x] All imports resolved
- [x] No unused imports
- [x] All routes registered
- [x] Error handling in place

#### ✅ Dependencies
- [x] `requirements.txt` complete
- [x] All packages listed:
  - fastapi
  - uvicorn[standard]
  - pandas, numpy
  - scikit-learn==1.6.1
  - prophet
  - joblib
  - sqlalchemy
  - psycopg2-binary
  - websockets
  - slowapi (rate limiting)

#### ✅ Required Files
- [x] `main.py` - FastAPI app
- [x] `database.py` - Database config
- [x] `models.py` - SQLAlchemy models
- [x] `auth.py` - Authentication
- [x] `limiter_config.py` - Rate limiting
- [x] `websocket_manager.py` - WebSocket handling
- [x] All route files in `routes/`
- [x] ML models in `ml/`:
  - forecast_model.pkl
  - iso_model.pkl
  - kmeans_model.pkl
  - preprocessor.pkl
  - scaler_anomaly.pkl
- [x] Data file: `data/Walmart_Sales.csv`

#### ✅ Environment Variables (Render)
```
DATABASE_URL          # Auto-set by Render (PostgreSQL)
API_KEY              # Optional: For API authentication
AUTH_ENABLED         # Optional: Set to "true" to enable auth
```

#### ⚠️ Security Notes
- CORS allows all origins (`allow_origins=["*"]`) - **Consider restricting in production**
- Authentication is **disabled by default** - Set `API_KEY` to enable
- Rate limiting: 100 requests/minute per IP

---

### Frontend (React + Vite)

#### ✅ Code Quality
- [x] TypeScript configured
- [x] API endpoints use correct URLs
- [x] Environment detection works

#### ✅ Dependencies
- [x] `package.json` complete
- [x] All React dependencies
- [x] Build scripts configured

#### ✅ Configuration
- [x] API base URL: Auto-detects localhost vs production
- [x] WebSocket URL: Auto-converts http/https to ws/wss
- [x] Mock data: Disabled (`USE_MOCK = false`)

#### ⚠️ Production URLs
Frontend automatically uses:
- **Development**: `http://localhost:8000`
- **Production**: `https://organ-c-codefest-hackathon.onrender.com`

---

## 📋 Deployment Steps

### Backend (Render)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Render Setup**
   - Connect GitHub repo
   - Auto-detects FastAPI
   - Set build command: `pip install -r requirements.txt`
   - Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Environment Variables** (in Render dashboard)
   ```
   DATABASE_URL      # Auto-provided by Render
   API_KEY          # Optional: Your secret key
   AUTH_ENABLED     # Optional: "true" to enable auth
   ```

4. **Verify Deployment**
   - Check health: `https://your-app.onrender.com/health`
   - Check docs: `https://your-app.onrender.com/docs`

---

### Frontend (Netlify/Vercel)

1. **Build Frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Deploy**
   - Connect GitHub repo
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist/spa`

3. **Environment Variables** (if needed)
   ```
   VITE_API_BASE_URL=https://organ-c-codefest-hackathon.onrender.com
   ```

4. **Verify**
   - Frontend should connect to backend automatically
   - Check browser console for API calls

---

## 🔍 Post-Deployment Testing

### Backend Tests
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `GET /docs` shows Swagger UI
- [ ] `GET /api/v1/stores` returns store list
- [ ] `POST /api/v1/iot/` accepts data (if auth disabled)
- [ ] WebSocket: `ws://your-app.onrender.com/ws/alerts` connects

### Frontend Tests
- [ ] Page loads without errors
- [ ] API calls succeed (check Network tab)
- [ ] WebSocket connects (if implemented)
- [ ] No CORS errors in console

---

## ⚠️ Known Issues / Warnings

1. **CORS**: Currently allows all origins (`*`)
   - **Fix**: Restrict to your frontend domain in production
   - Example: `allow_origins=["https://your-frontend.netlify.app"]`

2. **Authentication**: Disabled by default
   - **Fix**: Set `API_KEY` environment variable in Render
   - Then update IoT simulator to include header

3. **Rate Limiting**: 100 requests/minute
   - IoT simulator with `--interval 3` = 20/min (safe)
   - Burst mode might hit limit

4. **Database**: SQLite locally, PostgreSQL on Render
   - Auto-switches based on `DATABASE_URL`
   - Tables auto-created on startup

---

## 🐛 Troubleshooting

### Backend won't start
- Check `requirements.txt` is complete
- Verify ML model files exist
- Check Render logs for errors

### Frontend can't connect
- Verify backend URL in `api.ts`
- Check CORS settings
- Verify backend is running

### WebSocket not working
- Check WebSocket URL (ws:// vs wss://)
- Verify WebSocket endpoint is registered
- Check browser console for connection errors

---

## ✅ Ready to Deploy!

All critical checks passed. Your application is ready for deployment! 🎉


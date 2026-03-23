# INTENTO — AI Agent Platform

## Project Structure
```
INTENTO/
├── backend/     ← FastAPI Python backend
└── frontend/    ← Next.js React frontend
```

---

## 🚀 Deploy Backend → Render.com (Free)

1. Push this repo to GitHub
2. Go to https://render.com → New Web Service
3. Connect your GitHub repo
4. Set **Root Directory** = `backend`
5. **Build Command**: `pip install -r requirements.txt`
6. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Add Environment Variables in Render dashboard:
   - `MONGODB_URI` = your MongoDB Atlas URI
   - `JWT_SECRET` = any strong random string
   - `GROQ_API_KEY` = your Groq key
   - `TAVILY_API_KEY` = your Tavily key
   - `GEMINI_API_KEY` = your Gemini key (if used)
8. Click Deploy

---

## 🚀 Deploy Frontend → Vercel (Free)

1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Set **Root Directory** = `frontend`
4. Add Environment Variables in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` = `https://your-render-backend-url.onrender.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://your-render-backend-url.onrender.com`
5. Click Deploy

---

## 🛠 Run Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
# Copy .env.example to .env and fill in your keys
cp .env.example .env
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
# Copy .env.local.example to .env.local and fill in your URLs
cp .env.local.example .env.local
npm run dev
```

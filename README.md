# ⚡ INTENTO — Autonomous AI Agent Platform

> **Solasta Hackathon 2026 — PS1: AI Agents | GDG on Campus IIITDM Kurnool**

INTENTO is a full-stack AI Agent platform where you type a natural language goal and the system **thinks → plans → executes → verifies → delivers** real outcomes — not just suggestions.

---

## 🚀 What it Does

1. **Interpret** — AI understands your goal, detects ambiguity, estimates complexity
2. **Plan** — Generates a dependency-aware step graph with parallel execution layers
3. **Execute** — Runs steps in parallel layers using 5 specialized AI agents
4. **Verify** — Confidence-scored verification with automatic replan on failure
5. **Deliver** — Structured results with AI self-evaluation and export (JSON/Markdown)

---

## 🏗️ Architecture

```
Frontend (Next.js 14)          Backend (FastAPI + Python)
─────────────────────          ──────────────────────────────
Login / Register          →    JWT Auth (bcrypt + HS256)
Goal Input                →    Interpreter Agent
Plan Preview              →    Planner Agent (Kahn's Topo Sort)
Live Execution (WebSocket)→    Execution Engine → [Executor | Verifier | Critic | Memory]
Daily Check-In            →    Emotion Engine + Burnout Detection
Analytics                 →    MongoDB Aggregation
```

## 🤖 Agent Roles (Role-Isolated Prompt Contexts)

| Agent       | Job                                                                |
| ----------- | ------------------------------------------------------------------ |
| 🧠 Planner  | Decomposes goals into dependency-aware steps                       |
| ⚡ Executor | Executes each step (Gemini + Tavily web search)                    |
| ✅ Verifier | Scores result confidence → PROCEED / REPLAN / ESCALATE / HARD_STOP |
| 🔍 Critic   | Post-execution evaluation with efficiency + confidence scores      |
| 💾 Memory   | Extracts key facts across goals for context recall                 |

---

## 🛠️ Tech Stack

| Layer    | Tech                                                                |
| -------- | ------------------------------------------------------------------- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Axios, WebSocket |
| Backend  | Python FastAPI, Uvicorn, asyncio                                    |
| AI       | Gemini 1.5 Flash (google-generativeai), Tavily Search               |
| Database | MongoDB Atlas (PyMongo)                                             |
| Auth     | JWT (python-jose), bcrypt (passlib)                                 |
| Deploy   | Frontend → Vercel, Backend → Render, DB → MongoDB Atlas             |

---

## 📦 Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```
GEMINI_API_KEY=your_gemini_key
TAVILY_API_KEY=your_tavily_key
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=intento_jwt_secret_2026_gdg_iiitdm
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Edit `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

```bash
npm run dev     # http://localhost:3000
```

---

## 🔑 Key Features

- ⚡ **Parallel execution** — Steps with no dependencies run simultaneously per Kahn's algorithm
- 🔄 **Auto-replan** — Failed steps trigger AI replanning, up to 10x with safety cap
- 📉 **Confidence decay** — 10% penalty per retry; auto-escalates or aborts
- 🧠 **Memory agents** — Key facts persist across goals for contextual planning
- ⚠️ **Burnout detection** — Emotion engine detects stress; auto-adjusts schedule after 1hr grace
- 📡 **WebSocket + polling** — Real-time updates with automatic polling fallback if WS drops
- 🔒 **User isolation** — All DB queries enforce `user_id` scoping

---

## 📁 Project Structure

```
INTENTO/
├── backend/
│   ├── main.py              ← FastAPI entry point
│   ├── database.py          ← MongoDB
│   ├── requirements.txt
│   ├── auth/               ← JWT + routes
│   ├── agent/              ← roles, gemini, interpreter, planner, executor, verifier, critic, memory, limits, engine
│   ├── routes/             ← execution, progress, goals
│   └── utils/              ← websocket, errors, rate_limit
└── frontend/
    ├── app/                ← Next.js App Router pages
    ├── components/         ← layout & UI components
    ├── hooks/              ← useAuth, useToast
    ├── lib/                ← api, websocket, errorHandler
    └── types/              ← TypeScript types
```

---

_Built for Solasta 2026 — GDG on Campus IIITDM Kurnool 🚀_

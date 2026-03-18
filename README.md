# Squash ELO Tracker

A full-stack squash match tracker with ELO ratings — FastAPI backend, React frontend, SQLite database, deployable to Railway.

---

## Project structure

```
squash-app/
├── backend/
│   ├── main.py           # FastAPI app + ELO engine + serves frontend
│   └── requirements.txt
├── frontend/
│   ├── src/App.jsx       # React frontend
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example      # Environment variable docs
├── Dockerfile            # Multi-stage build (Node + Python)
├── railway.toml
└── README.md
```

---

## Deploy to Railway (single deployment)

The app uses a **multi-stage Docker build** — Node.js builds the React frontend, then Python/FastAPI serves both the API and the frontend from one container. No separate frontend hosting needed.

### 1. Create a GitHub repo

1. Go to https://github.com/new
2. Name it `squash-elo` (or anything you like)
3. Upload all files from this folder keeping the same structure

### 2. Deploy on Railway

1. Go to https://railway.app and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `squash-elo` repo
4. Railway detects the Dockerfile automatically — click **Deploy**
5. Wait for the build (~2-3 minutes, it builds both frontend and backend)
6. Go to **Settings → Networking → Generate Domain**
7. Visit your URL — the app is ready to use!

### 3. Add a persistent volume (important!)

Without this, your database resets every time Railway redeploys.

1. In Railway, open your service → **Volumes** tab
2. Click **Add Volume**, set mount path to `/data`, click **Add**
3. Railway redeploys automatically — your SQLite file now survives redeploys

---

## Alternative: Separate frontend deployment

If you prefer to host the frontend on Netlify separately:

1. Set the `VITE_API_URL` environment variable in Netlify to your Railway backend URL (e.g. `https://squash-elo-production.up.railway.app`)
2. This must be set **before building** — Vite compiles it into the bundle at build time
3. See `frontend/.env.example` for details

---

## API reference

All API endpoints are under the `/api` prefix.

| Method   | Path                  | Description                              |
|----------|-----------------------|------------------------------------------|
| GET      | `/api`                | Health check                             |
| GET      | `/api/stats`          | All players + matches with computed ELO  |
| GET      | `/api/players`        | Player list sorted by ELO                |
| POST     | `/api/players`        | Add player: `{"name": "Alice"}`          |
| GET      | `/api/matches`        | All matches with ELO values              |
| POST     | `/api/matches`        | Log match: `{"p1":"Alice","p2":"Bob","s1":11,"s2":7}` |
| DELETE   | `/api/matches/{id}`   | Delete a match (full ELO recompute)      |
| GET      | `/api/export`         | Download fresh .xlsx file                |

---

## Run locally

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# API at http://localhost:8000/api
# Docs at http://localhost:8000/docs
```

To run the frontend separately for development:

```bash
cd frontend
npm install
npm run dev
# Frontend at http://localhost:5173
# Set VITE_API_URL=http://localhost:8000 in a .env file
```

---

## ELO rules

All players start at **1000**. K-factor: 40 (< 30 matches), 20 (≥ 30), 10 (ELO ≥ 2000).

Valid score: winner ≥ 11 pts, win by ≥ 2 (e.g. 11–7 ✓, 11–10 ✗).

# Squash ELO Tracker

A full-stack squash match tracker with ELO ratings — FastAPI backend, React frontend, SQLite database, deployable to Railway.

---

## Project structure

```
squash-app/
├── backend/
│   ├── main.py           # FastAPI app + ELO engine
│   └── requirements.txt
├── frontend/
│   └── App.jsx           # React frontend (paste into claude.ai artifact)
├── Dockerfile
├── railway.toml
└── README.md
```

---

## Deploy to Railway (step by step)

### 1. Create a GitHub repo

1. Go to https://github.com/new
2. Name it `squash-elo` (or anything you like)
3. Upload all files from this folder keeping the same structure

### 2. Deploy the backend on Railway

1. Go to https://railway.app and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `squash-elo` repo
4. Railway detects the Dockerfile automatically — click **Deploy**
5. Wait ~2 minutes for the build
6. Go to **Settings → Networking → Generate Domain**
7. Copy your URL — e.g. `https://squash-elo-production.up.railway.app`

### 3. Add a persistent volume

1. In Railway, open your service → **Volumes** tab
2. Click **Add Volume**, set mount path to `/data`, click **Add**
3. Railway redeploys automatically — your SQLite file now survives redeploys

### 4. Point the frontend at your API

Open `frontend/App.jsx` and update line 6:

```js
// Before:
const API = import.meta?.env?.VITE_API_URL || "";

// After:
const API = "https://your-actual-url.up.railway.app";
```

### 5. Host the frontend

**Easiest:** Go to https://app.netlify.com/drop, drag in your built frontend folder.

**Or serve from Railway** by adding to `backend/main.py`:
```python
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```
Then put your built React app in `backend/static/`.

---

## API reference

| Method   | Path              | Description                              |
|----------|-------------------|------------------------------------------|
| GET      | `/stats`          | All players + matches with computed ELO  |
| GET      | `/players`        | Player list sorted by ELO                |
| POST     | `/players`        | Add player: `{"name": "Alice"}`          |
| GET      | `/matches`        | All matches with ELO values              |
| POST     | `/matches`        | Log match: `{"p1":"Alice","p2":"Bob","s1":11,"s2":7}` |
| DELETE   | `/matches/{id}`   | Delete a match (full ELO recompute)      |
| GET      | `/export`         | Download fresh .xlsx file                |

---

## Run locally

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# API at http://localhost:8000
# Docs at http://localhost:8000/docs
```

---

## ELO rules

All players start at **1000**. K-factor: 40 (< 30 matches), 20 (≥ 30), 10 (ELO ≥ 2000).

Valid score: winner ≥ 11 pts, win by ≥ 2 (e.g. 11–7 ✓, 11–10 ✗).

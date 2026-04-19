# Squash ELO

A full-stack web app for tracking competitive squash rankings using a dynamic ELO rating system.

## Overview

Squash ELO lets a group of players log match results and automatically computes updated ratings after every game. It goes beyond a simple leaderboard: you get head-to-head records, psychological performance profiles, seasonal leagues with awards, and a live ELO impact preview before you even submit a match. Built for club or office squash communities that want real rankings — no spreadsheet upkeep required.

**Live app:** https://squash-app-production.up.railway.app

## Features

- **Match Logging** – enter scores and see the projected ELO swing before submitting
- **Dynamic ELO System** – K-factor scales with experience (40 for new players, 20 after 30 matches, 10 at 2000+ ELO); win margin multiplier means close games yield smaller swings
- **Player Leaderboard** – ranked by current ELO with full profiles
- **Match History** – all logged matches with pre/post ELO deltas; admins can delete entries
- **Player Statistics** – peak and low ELO, win rate, ELO history chart
- **Head-to-Head Analytics** – win/loss records, streak tracking, recent form between any two players
- **Mental Edge** – psychological performance insights: pressure win rate, bounce-back rate, and behavior classification (Clutch Player, Underdog Specialist, Bouncer, Streaky, Consistent)
- **Seasonal Leagues** – quarterly seasons (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) with soft ELO resets (30% regression to 1200), seasonal standings, Hall of Fame, and end-of-season awards (Champion, Most Improved, Most Active, Giant Killer)
- **Match Preview** – win probability, ELO at risk, head-to-head history, recent form, and underdog status before a match
- **Data Export** – download the full leaderboard and match log as an Excel (.xlsx) file
- **Admin Controls** – Bearer token authentication for match deletion

## Requirements

- **Backend:** Python 3.11+, pip
- **Frontend:** Node.js 20+, npm
- **Database:** SQLite (included with Python — no separate install needed)

## Installation

1. Clone the repository.

```bash
git clone https://github.com/henrik-dotcom/Squash-app.git
cd Squash-app
```

2. Install backend dependencies.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # recommended
pip install -r requirements.txt
```

3. Install frontend dependencies.

```bash
cd ../frontend
npm install
```

## Usage

Run the backend and frontend in separate terminals during local development.

**Terminal 1 — backend:**

```bash
cd backend
uvicorn main:app --reload
```

The API is available at http://localhost:8000.

**Terminal 2 — frontend:**

```bash
cd frontend
npm run dev
```

The app is available at http://localhost:5173. The frontend reads `VITE_API_URL` to locate the backend — set it in `frontend/.env` (see Configuration below).

## Configuration

| Variable        | Default            | Description                                                                 |
|-----------------|--------------------|-----------------------------------------------------------------------------|
| `ADMIN_PASSWORD` | *(none)*          | Enables admin match deletion. Set to any secret string.                     |
| `DB_PATH`        | `squash.db`       | Path to the SQLite database file. Railway uses `/data/squash.db`.           |
| `PORT`           | `8000`            | HTTP port the backend listens on.                                           |
| `VITE_API_URL`   | *(empty)*         | API base URL for the frontend. Leave empty when both are served together (Railway). Set to `http://localhost:8000` for local development. |

Minimum `frontend/.env` for local development:

```bash
VITE_API_URL=http://localhost:8000
```

## API Reference

| Method   | Endpoint                    | Description                          |
|----------|-----------------------------|--------------------------------------|
| `GET`    | `/api`                      | Health check                         |
| `GET`    | `/api/players`              | Get leaderboard                      |
| `POST`   | `/api/players`              | Add a player                         |
| `GET`    | `/api/matches`              | Get all matches                      |
| `POST`   | `/api/matches`              | Log a match                          |
| `DELETE` | `/api/matches/{match_id}`   | Delete a match (admin only)          |
| `GET`    | `/api/stats`                | Combined stats payload for the UI    |
| `GET`    | `/api/seasons`              | Season list with champions           |
| `GET`    | `/api/seasons/{season_id}`  | Season standings and awards          |
| `GET`    | `/api/export`               | Download leaderboard + matches as Excel |
| `POST`   | `/api/admin/login`          | Obtain an admin Bearer token         |
| `POST`   | `/api/reset`                | Wipe all data (development only)     |

**Match validation:** scores must follow squash rules — win by at least 2 points, with a minimum of 11 points for the winner.

## Deployment

The app deploys to Railway automatically when commits are pushed to the `main` branch. The multi-stage Dockerfile handles everything:

1. **Stage 1 (Node 20):** builds the React frontend with `npm run build`.
2. **Stage 2 (Python 3.11):** installs backend dependencies and copies the built frontend into `/app/static` so FastAPI serves it as static files.

Railway mounts a persistent volume at `/data` to keep the SQLite database across deploys. No other infrastructure is required.

## Development

To contribute, branch off `main` and open a pull request. Merging to `main` triggers an automatic Railway deploy.

```bash
git checkout main
git pull
git checkout -b feature/your-feature
# make changes
git push origin feature/your-feature
```

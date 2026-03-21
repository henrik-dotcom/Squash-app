import sqlite3
import os
import pathlib
import secrets
from datetime import date, datetime, timedelta
from contextlib import contextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ─── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="Squash ELO API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("DB_PATH", "squash.db")

# ─── Admin auth ───────────────────────────────────────────────────────────────
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
_admin_tokens: set[str] = set()

class AdminLogin(BaseModel):
    password: str

def require_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Admin required")
    if authorization[7:] not in _admin_tokens:
        raise HTTPException(401, "Invalid or expired token")

# ─── Database ─────────────────────────────────────────────────────────────────
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    # Use a plain connection for init so executescript doesn't fight the context manager
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS players (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                name    TEXT UNIQUE NOT NULL,
                created TEXT DEFAULT (date('now'))
            );

            CREATE TABLE IF NOT EXISTS matches (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                date    TEXT NOT NULL,
                p1      TEXT NOT NULL,
                p2      TEXT NOT NULL,
                s1      INTEGER NOT NULL,
                s2      INTEGER NOT NULL,
                created TEXT DEFAULT (datetime('now'))
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique
                ON matches(date, p1, p2, s1, s2, created);
        """)

        conn.commit()
    finally:
        conn.close()


init_db()

# ─── ELO Engine ───────────────────────────────────────────────────────────────
def validate_score(s1: int, s2: int) -> bool:
    return max(s1, s2) >= 11 and abs(s1 - s2) >= 2

def get_k(elo: float, match_count: int) -> int:
    if elo >= 2000: return 10
    if match_count >= 30: return 20
    return 40

def calc_elo(r_a: float, r_b: float, won: bool, mc: int, s_a: int, s_b: int) -> float:
    expected = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    k = get_k(r_a, mc)
    margin = abs(s_a - s_b)
    multiplier = 1 + margin / max(s_a, s_b)
    return round(r_a + k * multiplier * ((1 if won else 0) - expected), 1)

def compute_state(matches_rows, player_names):
    ratings = {n: 1000.0 for n in player_names}
    counts  = {n: 0      for n in player_names}
    stats   = {
        n: {"name": n, "elo": 1000.0, "matches": 0, "wins": 0,
            "losses": 0, "peak": 1000.0, "low": 1000.0, "history": [1000.0]}
        for n in player_names
    }
    out = []

    for m in matches_rows:
        mid, dt = m["id"], m["date"]
        p1, p2, s1, s2 = m["p1"], m["p2"], m["s1"], m["s2"]
        is_valid = (p1 != p2 and p1 in ratings and p2 in ratings
                    and validate_score(s1, s2))

        p1pre = ratings.get(p1, 1000.0)
        p2pre = ratings.get(p2, 1000.0)

        if not is_valid:
            out.append({"id": mid, "date": dt, "p1": p1, "p2": p2,
                        "s1": s1, "s2": s2, "valid": False,
                        "winner": None, "p1pre": p1pre, "p2pre": p2pre,
                        "p1post": None, "p2post": None})
            continue

        p1wins = s1 > s2
        p1post = calc_elo(p1pre, p2pre, p1wins, counts[p1], s1, s2)
        p2post = calc_elo(p2pre, p1pre, not p1wins, counts[p2], s2, s1)

        ratings[p1] = p1post
        ratings[p2] = p2post
        counts[p1] += 1
        counts[p2] += 1

        winner = p1 if p1wins else p2
        out.append({"id": mid, "date": dt, "p1": p1, "p2": p2,
                    "s1": s1, "s2": s2, "valid": True,
                    "winner": winner, "p1pre": p1pre, "p2pre": p2pre,
                    "p1post": p1post, "p2post": p2post})

        for pname, post in [(p1, p1post), (p2, p2post)]:
            s = stats[pname]
            s["matches"] += 1
            if winner == pname: s["wins"] += 1
            else:               s["losses"] += 1
            s["peak"] = max(s["peak"], post)
            s["low"]  = min(s["low"],  post)
            s["history"].append(post)
            s["elo"] = post

    return out, stats


# ─── Season helpers ───────────────────────────────────────────────────────────
_SEASON_NAMES = {"Q1": "Winter", "Q2": "Spring", "Q3": "Summer", "Q4": "Autumn"}
_SEASON_STARTS = {"Q1": (1, 1), "Q2": (4, 1), "Q3": (7, 1), "Q4": (10, 1)}
_SEASON_ENDS   = {"Q1": (3, 31), "Q2": (6, 30), "Q3": (9, 30), "Q4": (12, 31)}

def get_season_id(date_str: str) -> str:
    d = datetime.strptime(date_str, "%Y-%m-%d")
    q = (d.month - 1) // 3 + 1
    return f"{d.year}-Q{q}"

def get_season_name(sid: str) -> str:
    year, q = sid.split("-")
    return f"{_SEASON_NAMES[q]} {year}"

def get_season_dates(sid: str) -> tuple:
    year, q = sid.split("-")
    yr = int(year)
    s = _SEASON_STARTS[q]; e = _SEASON_ENDS[q]
    return f"{yr}-{s[0]:02d}-{s[1]:02d}", f"{yr}-{e[0]:02d}-{e[1]:02d}"

def current_season_id() -> str:
    return get_season_id(str(date.today()))


def compute_seasons(match_rows, player_names: list) -> dict:
    """Return per-season ELO standings with soft resets between seasons."""
    # Group matches by season
    seasons_matches: dict = {}
    for m in match_rows:
        sid = get_season_id(m["date"])
        seasons_matches.setdefault(sid, []).append(m)

    # Ensure current season is always present
    cur_sid = current_season_id()
    seasons_matches.setdefault(cur_sid, [])

    # Sort seasons chronologically
    sorted_sids = sorted(seasons_matches.keys())

    # Carry-over ELOs between seasons (starts at 1000 for new players)
    carry: dict = {}  # name → elo at end of previous season

    seasons_out = {}
    for sid in sorted_sids:
        s_matches = seasons_matches[sid]

        # Compute season-start ELOs (after soft reset)
        season_start: dict = {}
        for name in player_names:
            prev = carry.get(name)
            if prev is None:
                season_start[name] = 1000.0
            else:
                season_start[name] = round(prev + (1200 - prev) * 0.3, 1)

        # Run ELO compute with season-start values
        # We need to seed ratings with season_start ELOs; reuse compute_state logic inline
        ratings = dict(season_start)
        counts  = {n: 0 for n in player_names}
        player_stats = {
            n: {"name": n, "elo": season_start[n], "season_start_elo": season_start[n],
                "wins": 0, "losses": 0, "matches": 0, "peak": season_start[n]}
            for n in player_names
        }

        # Track streak per player (list of W/L for this season)
        streak_seq: dict = {n: [] for n in player_names}
        # Track giant killer (wins vs higher pre-match ELO)
        giant_kills: dict = {n: 0 for n in player_names}
        # Track peak elo within season
        computed_season_matches = []

        for m in s_matches:
            p1, p2, s1, s2 = m["p1"], m["p2"], m["s1"], m["s2"]
            is_valid = (p1 != p2 and p1 in ratings and p2 in ratings
                        and validate_score(s1, s2))
            if not is_valid:
                computed_season_matches.append({"id": m["id"], "valid": False,
                    "p1": p1, "p2": p2, "s1": s1, "s2": s2,
                    "p1pre": ratings.get(p1, 1000.0), "p2pre": ratings.get(p2, 1000.0),
                    "winner": None})
                continue

            p1pre = ratings[p1]; p2pre = ratings[p2]
            p1wins = s1 > s2
            p1post = calc_elo(p1pre, p2pre, p1wins,  counts[p1], s1, s2)
            p2post = calc_elo(p2pre, p1pre, not p1wins, counts[p2], s2, s1)

            winner = p1 if p1wins else p2
            loser  = p2 if p1wins else p1

            computed_season_matches.append({"id": m["id"], "valid": True,
                "p1": p1, "p2": p2, "s1": s1, "s2": s2,
                "p1pre": p1pre, "p2pre": p2pre, "winner": winner})

            # Giant killer: winner beat someone with higher pre-match ELO
            winner_pre = p1pre if p1wins else p2pre
            loser_pre  = p2pre if p1wins else p1pre
            if loser_pre > winner_pre:
                giant_kills[winner] += 1

            for pname, post, won in [(p1, p1post, p1wins), (p2, p2post, not p1wins)]:
                ratings[pname] = post
                counts[pname] += 1
                st = player_stats[pname]
                st["matches"] += 1
                st["elo"] = post
                st["peak"] = max(st["peak"], post)
                if won: st["wins"] += 1
                else:   st["losses"] += 1
                streak_seq[pname].append("W" if won else "L")

        # Compute streak for each player (current run at end of season)
        for name, seq in streak_seq.items():
            s = 0
            if seq:
                last = seq[-1]
                for r in reversed(seq):
                    if r == last: s += 1
                    else: break
                player_stats[name]["streak"] = s if last == "W" else -s
            else:
                player_stats[name]["streak"] = 0
            player_stats[name]["giant_kills"] = giant_kills[name]
            player_stats[name]["delta"] = round(
                player_stats[name]["elo"] - player_stats[name]["season_start_elo"], 1)

        # Carry ELOs forward
        for name in player_names:
            carry[name] = player_stats[name]["elo"]

        start_date, end_date = get_season_dates(sid)
        is_current = (sid == cur_sid)
        today = date.today()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        days_remaining = max(0, (end_dt - today).days) if is_current else 0

        seasons_out[sid] = {
            "season_id": sid,
            "name": get_season_name(sid),
            "start": start_date,
            "end": end_date,
            "is_current": is_current,
            "match_count": sum(1 for m in computed_season_matches if m["valid"]),
            "days_remaining": days_remaining,
            "players": player_stats,
            "matches": computed_season_matches,
        }

    return seasons_out


def compute_awards(season: dict, min_matches: int = 3) -> dict:
    players = season["players"]
    qualified = [p for p in players.values() if p["matches"] >= min_matches]

    champion = max(players.values(), key=lambda p: p["elo"]) if players else None
    most_improved = max(qualified, key=lambda p: p["delta"]) if qualified else None
    most_active   = max(players.values(), key=lambda p: p["matches"]) if players else None
    most_active   = most_active if most_active and most_active["matches"] >= 1 else None
    giant_killer_candidates = [p for p in qualified if p["giant_kills"] > 0]
    giant_killer  = max(giant_killer_candidates, key=lambda p: p["giant_kills"]) if giant_killer_candidates else None

    def fmt(p, key):
        if p is None: return None
        if key == "champion":
            return {"name": p["name"], "detail": f"{p['elo']:.0f} ELO"}
        if key == "most_improved":
            d = p["delta"]; sign = "+" if d >= 0 else ""
            return {"name": p["name"], "detail": f"{sign}{d:.0f} ELO from season start"}
        if key == "most_active":
            return {"name": p["name"], "detail": f"{p['matches']} matches played"}
        if key == "giant_killer":
            return {"name": p["name"], "detail": f"{p['giant_kills']} wins vs. higher-ranked"}

    return {
        "champion":      fmt(champion, "champion"),
        "most_improved": fmt(most_improved, "most_improved"),
        "most_active":   fmt(most_active, "most_active"),
        "giant_killer":  fmt(giant_killer, "giant_killer"),
    }


# ─── Models ───────────────────────────────────────────────────────────────────
class NewMatch(BaseModel):
    date: Optional[str] = None
    p1: str
    p2: str
    s1: int
    s2: int

class NewPlayer(BaseModel):
    name: str

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/api")
def root():
    return {"status": "ok", "service": "Squash ELO API"}


@app.get("/api/players")
def get_players():
    with get_db() as db:
        rows       = db.execute("SELECT name FROM players ORDER BY name").fetchall()
        match_rows = db.execute("SELECT id,date,p1,p2,s1,s2 FROM matches ORDER BY id").fetchall()
    names = [r["name"] for r in rows]
    _, stats = compute_state(match_rows, names)
    return sorted(stats.values(), key=lambda x: -x["elo"])


@app.post("/api/players", status_code=201)
def add_player(body: NewPlayer):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name cannot be empty")
    with get_db() as db:
        if db.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone():
            raise HTTPException(409, f"Player '{name}' already exists")
        db.execute("INSERT INTO players (name) VALUES (?)", (name,))
    return {"name": name}


@app.get("/api/matches")
def get_matches():
    with get_db() as db:
        rows  = db.execute("SELECT id,date,p1,p2,s1,s2 FROM matches ORDER BY id").fetchall()
        names = [r["name"] for r in db.execute("SELECT name FROM players").fetchall()]
    computed, _ = compute_state(rows, names)
    return computed


@app.post("/api/matches", status_code=201)
def log_match(body: NewMatch):
    if body.p1 == body.p2:
        raise HTTPException(400, "Players must be different")
    if not validate_score(body.s1, body.s2):
        raise HTTPException(400, "Invalid score — win by 2 with ≥11 pts (e.g. 11-7, 12-10, 15-13)")

    match_date = body.date or str(date.today())

    with get_db() as db:
        for pname in [body.p1, body.p2]:
            if not db.execute("SELECT id FROM players WHERE name=?", (pname,)).fetchone():
                raise HTTPException(404, f"Player '{pname}' not found")

        cur = db.execute(
            "INSERT INTO matches (date,p1,p2,s1,s2) VALUES (?,?,?,?,?)",
            (match_date, body.p1, body.p2, body.s1, body.s2)
        )
        new_id = cur.lastrowid
        rows  = db.execute("SELECT id,date,p1,p2,s1,s2 FROM matches ORDER BY id").fetchall()
        names = [r["name"] for r in db.execute("SELECT name FROM players").fetchall()]

    computed, _ = compute_state(rows, names)
    new_match = next((m for m in computed if m["id"] == new_id), None)
    return new_match


@app.post("/api/admin/login")
def admin_login(body: AdminLogin):
    if not ADMIN_PASSWORD or body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid password")
    token = secrets.token_hex(32)
    _admin_tokens.add(token)
    return {"token": token}


@app.post("/api/reset", status_code=200)
def reset_db():
    with get_db() as db:
        db.execute("DELETE FROM matches")
        db.execute("DELETE FROM players")
        db.execute("DELETE FROM sqlite_sequence WHERE name IN ('matches','players')")
    return {"status": "reset"}


@app.delete("/api/matches/{match_id}", status_code=200)
def delete_match(match_id: int, authorization: Optional[str] = Header(None)):
    require_admin(authorization)
    with get_db() as db:
        if not db.execute("SELECT id FROM matches WHERE id=?", (match_id,)).fetchone():
            raise HTTPException(404, "Match not found")
        db.execute("DELETE FROM matches WHERE id=?", (match_id,))
    return {"deleted": match_id}


@app.get("/api/stats")
def get_stats():
    with get_db() as db:
        match_rows = db.execute("SELECT id,date,p1,p2,s1,s2 FROM matches ORDER BY id").fetchall()
        names      = [r["name"] for r in db.execute("SELECT name FROM players ORDER BY name").fetchall()]
    computed, stats = compute_state(match_rows, names)
    return {
        "players": sorted(stats.values(), key=lambda x: -x["elo"]),
        "matches": computed,
    }



@app.get("/api/seasons")
def get_seasons():
    with get_db() as db:
        match_rows = db.execute("SELECT id,date,p1,p2,s1,s2 FROM matches ORDER BY id").fetchall()
        names      = [r["name"] for r in db.execute("SELECT name FROM players ORDER BY name").fetchall()]

    if not names:
        return []

    seasons = compute_seasons(match_rows, names)

    result = []
    for sid in sorted(seasons.keys(), reverse=True):
        s = seasons[sid]
        players_sorted = sorted(s["players"].values(), key=lambda p: -p["elo"])
        champion = players_sorted[0]["name"] if players_sorted and not s["is_current"] else None
        result.append({
            "season_id":    sid,
            "name":         s["name"],
            "start":        s["start"],
            "end":          s["end"],
            "is_current":   s["is_current"],
            "match_count":  s["match_count"],
            "champion":     champion,
        })

    return result


@app.get("/api/seasons/{season_id}")
def get_season(season_id: str):
    with get_db() as db:
        match_rows = db.execute("SELECT id,date,p1,p2,s1,s2 FROM matches ORDER BY id").fetchall()
        names      = [r["name"] for r in db.execute("SELECT name FROM players ORDER BY name").fetchall()]

    if not names:
        raise HTTPException(404, "No players found")

    seasons = compute_seasons(match_rows, names)
    if season_id not in seasons:
        raise HTTPException(404, f"Season '{season_id}' not found")

    s = seasons[season_id]
    standings = sorted(s["players"].values(), key=lambda p: -p["elo"])
    for i, p in enumerate(standings):
        p["rank"] = i + 1

    return {
        "season_id":     s["season_id"],
        "name":          s["name"],
        "start":         s["start"],
        "end":           s["end"],
        "is_current":    s["is_current"],
        "days_remaining": s["days_remaining"],
        "match_count":   s["match_count"],
        "standings":     standings,
        "awards":        compute_awards(s),
    }


# ─── Serve frontend static files (must come after all API routes) ────────────
STATIC_DIR = pathlib.Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

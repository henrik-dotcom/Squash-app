"""
Standalone migration script: squash.db legacy schema → new schema.

Usage:
    cd backend
    python migrate.py [--db /path/to/squash.db]
"""

import sqlite3
import shutil
import uuid
import os
import sys
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configurable DB path (override with --db flag or DB_PATH env var)
# ---------------------------------------------------------------------------
def _resolve_db_path():
    args = sys.argv[1:]
    if "--db" in args:
        return args[args.index("--db") + 1]
    return os.environ.get("DB_PATH", "squash.db")

DB_PATH = _resolve_db_path()


def new_uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# ELO functions — verbatim copies from main.py (no import to avoid FastAPI startup)
# ---------------------------------------------------------------------------
def validate_score(s1: int, s2: int) -> bool:
    return max(s1, s2) >= 11 and abs(s1 - s2) >= 2


def get_k(elo: float, match_count: int) -> int:
    if elo >= 2000:
        return 10
    if match_count >= 30:
        return 20
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
            if winner == pname:
                s["wins"] += 1
            else:
                s["losses"] += 1
            s["peak"] = max(s["peak"], post)
            s["low"]  = min(s["low"],  post)
            s["history"].append(post)
            s["elo"] = post

    return out, stats


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _pad_datetime(date_str):
    """Turn 'YYYY-MM-DD' into 'YYYY-MM-DDT00:00:00'; pass through if already has time."""
    if date_str and "T" not in date_str and len(date_str) == 10:
        return date_str + "T00:00:00"
    return date_str


def _date_part(dt_str):
    """Extract 'YYYY-MM-DD' from an ISO datetime or date string."""
    if not dt_str:
        return None
    return dt_str[:10]


# ---------------------------------------------------------------------------
# Main migration
# ---------------------------------------------------------------------------
def run():
    # 1. Backup
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bak = f"{DB_PATH}.bak.{ts}"
    shutil.copy2(DB_PATH, bak)
    print(f"Backup written to: {bak}")

    # 2. Connect
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=OFF")

    # 3. Create new tables (import here so models.py is found relative to this script)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from models import create_tables
    create_tables(conn)
    print("New tables created (or already exist).")

    # 4. Idempotency check
    player_count = conn.execute("SELECT COUNT(*) FROM player WHERE display_name != 'System'").fetchone()[0]
    old_matches_count = conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
    match_count = conn.execute("SELECT COUNT(*) FROM match").fetchone()[0]

    if player_count > 0 and (old_matches_count == 0 or match_count > 0):
        print("Migration already applied. Skipping.")
        conn.close()
        sys.exit(0)
    elif player_count > 0:
        print("WARNING: Previous migration was incomplete. Clearing partial data and retrying...")
        conn.executescript("""
            DELETE FROM rating_snapshot;
            DELETE FROM match_set;
            DELETE FROM challenge;
            DELETE FROM match;
            DELETE FROM league_membership;
            DELETE FROM league;
            DELETE FROM player;
        """)
        conn.commit()

    # 5. Read all legacy data
    old_players    = conn.execute("SELECT * FROM players ORDER BY id").fetchall()
    old_matches    = conn.execute("SELECT * FROM matches ORDER BY id").fetchall()
    old_challenges = conn.execute("SELECT * FROM challenges ORDER BY id").fetchall()

    print(f"Legacy: {len(old_players)} players, {len(old_matches)} matches, {len(old_challenges)} challenges")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

    # 6. Create System player + Main League
    system_player_id = new_uuid()
    conn.execute(
        "INSERT INTO player (id, display_name, avatar_url, email, created_at, last_active_at) VALUES (?,?,?,?,?,?)",
        (system_player_id, "System", None, "system@placeholder.local", now_iso, now_iso)
    )

    main_league_id = new_uuid()
    invite_code = uuid.uuid4().hex[:8].upper()
    conn.execute(
        """INSERT INTO league
           (id, name, created_by, league_type, scoring_format, points_to_win,
            is_active, season_start, season_end, invite_code, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (main_league_id, "Main League", system_player_id, "ladder", "single_game",
         11, 1, None, None, invite_code, now_iso)
    )
    print(f"System player id: {system_player_id}")
    print(f"Main League id:   {main_league_id}")

    # 7. Migrate players → player + league_membership
    name_to_uuid = {}
    lm_ids = {}

    for op in old_players:
        name      = op["name"]
        created   = _pad_datetime(op["created"]) if op["created"] else now_iso
        pid       = new_uuid()
        email     = name.lower().replace(" ", ".") + "@placeholder.local"

        conn.execute(
            "INSERT INTO player (id, display_name, avatar_url, email, created_at, last_active_at) VALUES (?,?,?,?,?,?)",
            (pid, name, None, email, created, created)
        )

        lm_id = new_uuid()
        conn.execute(
            """INSERT INTO league_membership
               (id, player_id, league_id, role, joined_at, is_active,
                rating, rating_deviation, volatility, rating_updated_at,
                career_high, career_high_at, current_streak, longest_win_streak,
                matches_played, matches_won)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (lm_id, pid, main_league_id, "member", created, 1,
             1000.0, 350.0, 0.06, None,
             1000.0, None, 0, 0, 0, 0)
        )

        name_to_uuid[name] = pid
        lm_ids[name] = lm_id

    print(f"Migrated {len(old_players)} players.")

    # 8. Replay ELO via compute_state
    player_names = list(name_to_uuid.keys())

    # Build match rows in the shape compute_state expects
    legacy_match_rows = [
        {"id": m["id"], "date": m["date"], "p1": m["p1"],
         "p2": m["p2"], "s1": m["s1"], "s2": m["s2"]}
        for m in old_matches
    ]

    computed_matches, final_stats = compute_state(legacy_match_rows, player_names)

    # 9. Insert match, match_set, rating_snapshot rows
    # Track career_high per player to detect is_career_high per snapshot
    career_high_tracker = {name: 1000.0 for name in player_names}

    # Map legacy match id → new UUID (for challenge resolution lookup)
    legacy_match_id_to_uuid = {}

    for cm in computed_matches:
        legacy_id = cm["id"]
        old_m     = next(m for m in old_matches if m["id"] == legacy_id)

        played_at  = old_m["date"]           # YYYY-MM-DD, no time
        created_at = old_m["created"] or now_iso

        p1_name = cm["p1"]
        p2_name = cm["p2"]

        # Only insert a match row for players we migrated
        p1_in_map = p1_name in name_to_uuid
        p2_in_map = p2_name in name_to_uuid

        match_status = "confirmed" if (cm["valid"] and p1_in_map and p2_in_map) else "disputed"

        # Determine winner_id — required NOT NULL in schema.
        # For invalid/disputed matches we still need a placeholder: use player_a.
        if cm["valid"] and cm["winner"] and cm["winner"] in name_to_uuid:
            winner_id = name_to_uuid[cm["winner"]]
        elif p1_in_map:
            winner_id = name_to_uuid[p1_name]
        elif p2_in_map:
            winner_id = name_to_uuid[p2_name]
        else:
            winner_id = system_player_id

        player_a_id = name_to_uuid.get(p1_name, system_player_id)
        player_b_id = name_to_uuid.get(p2_name, system_player_id)

        match_uuid = new_uuid()
        conn.execute(
            """INSERT INTO match
               (id, league_id, player_a_id, player_b_id, winner_id,
                match_type, status, logged_by, confirmed_by, confirmed_at,
                venue, notes, played_at, created_at, legacy_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (match_uuid, main_league_id, player_a_id, player_b_id, winner_id,
             "league", match_status, system_player_id, None, None,
             None, None, played_at, created_at, legacy_id)
        )

        legacy_match_id_to_uuid[legacy_id] = match_uuid

        # match_set (always one set per legacy match)
        set_uuid = new_uuid()
        conn.execute(
            """INSERT INTO match_set
               (id, match_id, set_number, player_a_score, player_b_score, winner_id)
               VALUES (?,?,?,?,?,?)""",
            (set_uuid, match_uuid, 1, cm["s1"], cm["s2"], winner_id)
        )

        # rating_snapshot — only for valid matches with both players known
        if cm["valid"] and p1_in_map and p2_in_map:
            p1pre  = cm["p1pre"]
            p2pre  = cm["p2pre"]
            p1post = cm["p1post"]
            p2post = cm["p2post"]

            for pname, pre, post, opponent_pre, won in [
                (p1_name, p1pre, p1post, p2pre, cm["winner"] == p1_name),
                (p2_name, p2pre, p2post, p1pre, cm["winner"] == p2_name),
            ]:
                pid    = name_to_uuid[pname]
                delta  = round(post - pre, 1)
                expected = 1 / (1 + 10 ** ((opponent_pre - pre) / 400))
                actual   = 1.0 if won else 0.0
                is_upset = 1 if (won and pre < opponent_pre) else 0

                old_career_high = career_high_tracker[pname]
                is_career_high  = 1 if post > old_career_high else 0
                if post > old_career_high:
                    career_high_tracker[pname] = post

                snap_uuid = new_uuid()
                conn.execute(
                    """INSERT INTO rating_snapshot
                       (id, match_id, player_id, league_id,
                        rating_before, rating_after,
                        rd_before, rd_after,
                        volatility_before, volatility_after,
                        rating_delta, expected_outcome, actual_outcome,
                        is_upset, is_career_high, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (snap_uuid, match_uuid, pid, main_league_id,
                     pre, post,
                     350.0, 350.0,
                     0.06, 0.06,
                     delta, expected, actual,
                     is_upset, is_career_high, created_at)
                )

    print(f"Migrated {len(computed_matches)} matches.")

    # 10. Update league_membership with final stats
    # Re-derive per-player stats from compute_state output (streaks etc.)
    player_final_stats = {name: {
        "rating": 1000.0,
        "career_high": 1000.0,
        "career_high_at": None,
        "current_streak": 0,
        "longest_win_streak": 0,
        "matches_played": 0,
        "matches_won": 0,
    } for name in player_names}

    # Replay chronologically to compute streaks and career high dates
    streak_seq     = {name: [] for name in player_names}
    ch_tracker     = {name: 1000.0 for name in player_names}
    ch_at_tracker  = {name: None for name in player_names}

    for cm in computed_matches:
        if not cm["valid"]:
            continue
        p1_name = cm["p1"]
        p2_name = cm["p2"]
        if p1_name not in player_final_stats or p2_name not in player_final_stats:
            continue

        winner = cm["winner"]

        for pname, post in [(p1_name, cm["p1post"]), (p2_name, cm["p2post"])]:
            won = (winner == pname)
            fs  = player_final_stats[pname]
            fs["matches_played"] += 1
            if won:
                fs["matches_won"] += 1
            fs["rating"] = post

            # career high
            if post > ch_tracker[pname]:
                ch_tracker[pname]    = post
                ch_at_tracker[pname] = cm["date"]

            streak_seq[pname].append("W" if won else "L")

    for name in player_names:
        fs = player_final_stats[name]
        fs["career_high"]    = ch_tracker[name]
        fs["career_high_at"] = _pad_datetime(ch_at_tracker[name]) if ch_at_tracker[name] else None

        seq = streak_seq[name]
        # current streak
        if seq:
            last = seq[-1]
            cur = 0
            for r in reversed(seq):
                if r == last:
                    cur += 1
                else:
                    break
            fs["current_streak"] = cur if last == "W" else -cur
        else:
            fs["current_streak"] = 0

        # longest win streak
        longest = 0
        run = 0
        for r in seq:
            if r == "W":
                run += 1
                longest = max(longest, run)
            else:
                run = 0
        fs["longest_win_streak"] = longest

        # rating_updated_at — date of last valid match
        rating_updated_at = None
        for cm in reversed(computed_matches):
            if cm["valid"] and (cm["p1"] == name or cm["p2"] == name):
                rating_updated_at = _pad_datetime(cm["date"])
                break
        fs["rating_updated_at"] = rating_updated_at

        lm_id = lm_ids[name]
        conn.execute(
            """UPDATE league_membership SET
               rating=?, career_high=?, career_high_at=?,
               current_streak=?, longest_win_streak=?,
               matches_played=?, matches_won=?,
               rating_updated_at=?
               WHERE id=?""",
            (fs["rating"], fs["career_high"], fs["career_high_at"],
             fs["current_streak"], fs["longest_win_streak"],
             fs["matches_played"], fs["matches_won"],
             fs["rating_updated_at"],
             lm_id)
        )

    print("league_membership stats updated.")

    # 11. Migrate challenges → challenge
    status_map = {
        "open":      "pending",
        "resolved":  "accepted",
        "expired":   "expired",
        "cancelled": "declined",
    }

    migrated_challenges = 0
    for oc in old_challenges:
        challenger_name = oc["challenger"]
        challenged_name = oc["challenged"]

        # Only migrate if both players are known
        if challenger_name not in name_to_uuid or challenged_name not in name_to_uuid:
            print(f"  Skipping challenge {oc['id']}: unknown player(s)")
            continue

        challenger_uuid = name_to_uuid[challenger_name]
        challenged_uuid = name_to_uuid[challenged_name]

        old_status   = oc["status"] or "open"
        new_status   = status_map.get(old_status, "pending")
        old_deadline = oc["deadline_date"]
        expires_at   = (old_deadline + "T23:59:59") if old_deadline else None

        old_resolved = oc["resolved_date"]
        responded_at = (old_resolved + "T00:00:00") if old_resolved else None

        # For accepted challenges, find the last match on resolved_date between the pair
        match_uuid_for_challenge = None
        if new_status == "accepted" and old_resolved:
            # Walk computed matches to find the last valid one on resolved_date between these two
            candidate = next(
                (
                    cm for cm in reversed(computed_matches)
                    if cm["valid"]
                    and cm["date"] == old_resolved
                    and {cm["p1"], cm["p2"]} == {challenger_name, challenged_name}
                ),
                None
            )
            if candidate:
                match_uuid_for_challenge = legacy_match_id_to_uuid.get(candidate["id"])

        ch_uuid = new_uuid()
        # legacy_id for sequential continuity
        legacy_ch_id = conn.execute("SELECT COALESCE(MAX(legacy_id),0)+1 FROM challenge").fetchone()[0]

        conn.execute(
            """INSERT INTO challenge
               (id, league_id, challenger_id, challenged_id,
                status, match_id, message, expires_at,
                created_at, responded_at,
                legacy_id, legacy_required_wins, legacy_winner, legacy_resolved_date)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (ch_uuid, main_league_id, challenger_uuid, challenged_uuid,
             new_status, match_uuid_for_challenge, None, expires_at,
             oc["created"] or now_iso, responded_at,
             oc["id"], oc["required_wins"], oc["winner"], oc["resolved_date"])
        )
        migrated_challenges += 1

    print(f"Migrated {migrated_challenges} challenges.")

    # 12. Verify row counts
    new_player_count = conn.execute("SELECT COUNT(*) FROM player").fetchone()[0]
    new_match_count  = conn.execute("SELECT COUNT(*) FROM match").fetchone()[0]
    new_set_count    = conn.execute("SELECT COUNT(*) FROM match_set").fetchone()[0]
    new_ch_count     = conn.execute("SELECT COUNT(*) FROM challenge").fetchone()[0]
    new_lm_count     = conn.execute("SELECT COUNT(*) FROM league_membership").fetchone()[0]

    # Expected: player table = old players + System
    expected_players = len(old_players) + 1
    # Challenges: only those whose both players were in name_to_uuid
    known_names = set(name_to_uuid.keys())
    eligible_challenges = sum(
        1 for oc in old_challenges
        if oc["challenger"] in known_names and oc["challenged"] in known_names
    )

    errors = []
    if new_player_count != expected_players:
        errors.append(f"player count mismatch: got {new_player_count}, expected {expected_players}")
    if new_match_count != len(old_matches):
        errors.append(f"match count mismatch: got {new_match_count}, expected {len(old_matches)}")
    if new_set_count != len(old_matches):
        errors.append(f"match_set count mismatch: got {new_set_count}, expected {len(old_matches)}")
    if new_ch_count < eligible_challenges:
        errors.append(f"challenge count too low: got {new_ch_count}, expected >= {eligible_challenges}")
    if new_lm_count != len(old_players):
        errors.append(f"league_membership count mismatch: got {new_lm_count}, expected {len(old_players)}")

    print("\n--- Migration Summary ---")
    print(f"  player:           {new_player_count}  (expected {expected_players})")
    print(f"  match:            {new_match_count}  (expected {len(old_matches)})")
    print(f"  match_set:        {new_set_count}  (expected {len(old_matches)})")
    print(f"  challenge:        {new_ch_count}  (expected >= {eligible_challenges})")
    print(f"  league_membership:{new_lm_count}  (expected {len(old_players)})")

    if errors:
        conn.rollback()
        conn.close()
        raise RuntimeError("Migration verification failed:\n  " + "\n  ".join(errors))

    # 13. Single commit
    conn.commit()
    conn.close()
    print("\nMigration complete. DB committed.")


if __name__ == "__main__":
    run()

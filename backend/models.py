import sqlite3

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS player (
    id          TEXT PRIMARY KEY,
    display_name TEXT UNIQUE NOT NULL,
    avatar_url  TEXT,
    email       TEXT UNIQUE NOT NULL,
    created_at  TEXT NOT NULL,
    last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS league (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    created_by      TEXT NOT NULL REFERENCES player(id),
    league_type     TEXT NOT NULL DEFAULT 'ladder',
    scoring_format  TEXT NOT NULL DEFAULT 'single_game',
    points_to_win   INTEGER NOT NULL DEFAULT 11,
    is_active       INTEGER NOT NULL DEFAULT 1,
    season_start    TEXT,
    season_end      TEXT,
    invite_code     TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS league_membership (
    id                  TEXT PRIMARY KEY,
    player_id           TEXT NOT NULL REFERENCES player(id),
    league_id           TEXT NOT NULL REFERENCES league(id),
    role                TEXT NOT NULL DEFAULT 'member',
    joined_at           TEXT NOT NULL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    rating              REAL NOT NULL DEFAULT 1500.0,
    rating_deviation    REAL NOT NULL DEFAULT 350.0,
    volatility          REAL NOT NULL DEFAULT 0.06,
    rating_updated_at   TEXT,
    career_high         REAL NOT NULL DEFAULT 1500.0,
    career_high_at      TEXT,
    current_streak      INTEGER NOT NULL DEFAULT 0,
    longest_win_streak  INTEGER NOT NULL DEFAULT 0,
    matches_played      INTEGER NOT NULL DEFAULT 0,
    matches_won         INTEGER NOT NULL DEFAULT 0,
    UNIQUE(player_id, league_id)
);

CREATE TABLE IF NOT EXISTS match (
    id              TEXT PRIMARY KEY,
    league_id       TEXT NOT NULL REFERENCES league(id),
    player_a_id     TEXT NOT NULL REFERENCES player(id),
    player_b_id     TEXT NOT NULL REFERENCES player(id),
    winner_id       TEXT NOT NULL REFERENCES player(id),
    match_type      TEXT NOT NULL DEFAULT 'league',
    status          TEXT NOT NULL DEFAULT 'confirmed',
    logged_by       TEXT NOT NULL REFERENCES player(id),
    confirmed_by    TEXT REFERENCES player(id),
    confirmed_at    TEXT,
    venue           TEXT,
    notes           TEXT,
    played_at       TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    legacy_id       INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_legacy_id ON match(legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS match_set (
    id              TEXT PRIMARY KEY,
    match_id        TEXT NOT NULL REFERENCES match(id),
    set_number      INTEGER NOT NULL DEFAULT 1,
    player_a_score  INTEGER NOT NULL,
    player_b_score  INTEGER NOT NULL,
    winner_id       TEXT NOT NULL REFERENCES player(id)
);

CREATE TABLE IF NOT EXISTS rating_snapshot (
    id                  TEXT PRIMARY KEY,
    match_id            TEXT NOT NULL REFERENCES match(id),
    player_id           TEXT NOT NULL REFERENCES player(id),
    league_id           TEXT NOT NULL REFERENCES league(id),
    rating_before       REAL NOT NULL,
    rating_after        REAL NOT NULL,
    rd_before           REAL NOT NULL,
    rd_after            REAL NOT NULL,
    volatility_before   REAL NOT NULL,
    volatility_after    REAL NOT NULL,
    rating_delta        REAL NOT NULL,
    expected_outcome    REAL NOT NULL,
    actual_outcome      REAL NOT NULL,
    is_upset            INTEGER NOT NULL DEFAULT 0,
    is_career_high      INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge (
    id              TEXT PRIMARY KEY,
    league_id       TEXT NOT NULL REFERENCES league(id),
    challenger_id   TEXT NOT NULL REFERENCES player(id),
    challenged_id   TEXT NOT NULL REFERENCES player(id),
    status          TEXT NOT NULL DEFAULT 'pending',
    match_id        TEXT REFERENCES match(id),
    message         TEXT,
    expires_at      TEXT,
    created_at      TEXT NOT NULL,
    responded_at    TEXT,
    legacy_id       INTEGER,
    legacy_required_wins INTEGER,
    legacy_winner   TEXT,
    legacy_resolved_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_rating_snapshot_player_league ON rating_snapshot(player_id, league_id, created_at);
CREATE INDEX IF NOT EXISTS idx_match_league_played ON match(league_id, played_at);
CREATE INDEX IF NOT EXISTS idx_match_players ON match(player_a_id, player_b_id);
CREATE INDEX IF NOT EXISTS idx_lm_league_rating ON league_membership(league_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_match_set_match ON match_set(match_id, set_number);
"""


def create_tables(conn):
    conn.executescript(SCHEMA_SQL)
    conn.commit()

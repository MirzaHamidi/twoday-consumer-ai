-- Twoday Studio Analytics - D1 Schema
-- Run this ONCE after creating the database:
--   wrangler d1 execute tds-analytics-db --file=schema.sql

CREATE TABLE IF NOT EXISTS visitors (
  vid        TEXT PRIMARY KEY,
  ip_hash    TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plays (
  vid        TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (vid, game_id)
);

-- Index for fast per-game counts
CREATE INDEX IF NOT EXISTS idx_plays_game ON plays(game_id);

CREATE TABLE IF NOT EXISTS sessions (
  vid TEXT NOT NULL,
  game_id TEXT NOT NULL,
  duration INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS streaks (
  vid TEXT NOT NULL,
  game_id TEXT NOT NULL,
  last_play_date TEXT NOT NULL,
  current_streak INTEGER DEFAULT 1,
  PRIMARY KEY (vid, game_id)
);

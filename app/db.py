"""SQLite storage. One file, no server: plenty for a 10-15 person group."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get("AD_DB_PATH", str(Path(__file__).resolve().parent.parent / "auf_deutsch.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'A2',
  goal_date TEXT,
  goal_text TEXT NOT NULL DEFAULT '',
  minutes_per_day INTEGER NOT NULL DEFAULT 30,
  about TEXT NOT NULL DEFAULT '',
  topics TEXT NOT NULL DEFAULT '[]',
  correction_style TEXT NOT NULL DEFAULT 'every_turn',
  onboarded INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  de TEXT NOT NULL,
  article TEXT NOT NULL DEFAULT '',
  plural TEXT NOT NULL DEFAULT '',
  en TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  example_en TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'seed',
  rank INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  introduced_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, de, article)
);
CREATE INDEX IF NOT EXISTS cards_due ON cards(user_id, status, due_date);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL DEFAULT 'free',
  title TEXT NOT NULL DEFAULT '',
  target_words TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  speaking_seconds INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  cefr TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  text_en TEXT NOT NULL DEFAULT '',
  feedback TEXT,
  spoken INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  wrong TEXT NOT NULL,
  right_text TEXT NOT NULL,
  why TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  speaking_seconds INTEGER NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  new_words INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def tx():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with tx() as c:
        c.executescript(SCHEMA)


def row(r):
    return dict(r) if r is not None else None


def rows(rs):
    return [dict(r) for r in rs]


def bump_activity(c, user_id: int, day: str, **inc) -> None:
    c.execute("INSERT OR IGNORE INTO activity(user_id, day) VALUES (?, ?)", (user_id, day))
    for k, v in inc.items():
        c.execute(f"UPDATE activity SET {k} = {k} + ? WHERE user_id = ? AND day = ?", (int(v), user_id, day))


def loads(s, default):
    try:
        return json.loads(s) if s else default
    except (TypeError, ValueError):
        return default

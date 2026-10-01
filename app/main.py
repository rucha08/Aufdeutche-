"""Auf Deutsch: a speaking-first German practice app for a small group of friends."""
import json
import os
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import auth, db, learning
from .llm import prompts, schemas
from .llm.providers import LLMError, get_provider

ROOT = Path(__file__).resolve().parent
SEED = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
SCENARIOS = {s["id"]: s for s in SEED["scenarios"]}
DAILY_AI_LIMIT = int(os.environ.get("AD_DAILY_AI_LIMIT", "200"))
SECURE_COOKIES = os.environ.get("AD_SECURE_COOKIES", "0") == "1"

@asynccontextmanager
async def lifespan(_app):
    db.init()
    yield


app = FastAPI(title="Auf Deutsch", lifespan=lifespan)


def today() -> str:
    return learning.today().isoformat()


# ---------------------------------------------------------------- auth

class RegisterIn(BaseModel):
    username: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    display_name: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=8, max_length=200)
    invite_code: str = ""


class LoginIn(BaseModel):
    username: str
    password: str


def _set_cookie(resp: Response, token: str):
    resp.set_cookie(auth.COOKIE, token, httponly=True, samesite="lax", secure=SECURE_COOKIES, max_age=60 * 60 * 24 * 120)


@app.post("/api/register")
def register(body: RegisterIn, resp: Response):
    if not auth.invite_ok(body.invite_code):
        raise HTTPException(403, "That invite code is not valid. Ask the person who shared the app with you.")
    with db.tx() as c:
        if c.execute("SELECT 1 FROM users WHERE username = ?", (body.username,)).fetchone():
            raise HTTPException(409, "That username is taken.")
        first = c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        cur = c.execute("INSERT INTO users(username, display_name, pw_hash, is_admin) VALUES (?, ?, ?, ?)",
                        (body.username, body.display_name.strip(), auth.hash_password(body.password), int(first)))
        uid = cur.lastrowid
        c.execute("INSERT INTO profiles(user_id) VALUES (?)", (uid,))
        _set_cookie(resp, auth.new_session(c, uid))
    return {"ok": True}


@app.post("/api/login")
def login(body: LoginIn, resp: Response):
    with db.tx() as c:
        u = c.execute("SELECT id, pw_hash FROM users WHERE username = ?", (body.username,)).fetchone()
        if not u or not auth.verify_password(body.password, u["pw_hash"]):
            raise HTTPException(401, "Wrong username or password.")
        _set_cookie(resp, auth.new_session(c, u["id"]))
    return {"ok": True}


@app.post("/api/logout")
def logout(resp: Response, user=Depends(auth.current_user)):
    with db.tx() as c:
        c.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    resp.delete_cookie(auth.COOKIE)
    return {"ok": True}


def _profile(c, uid: int) -> dict:
    p = db.row(c.execute("SELECT * FROM profiles WHERE user_id = ?", (uid,)).fetchone())
    p["topics"] = db.loads(p["topics"], [])
    return p


@app.get("/api/me")
def me(user=Depends(auth.current_user)):
    with db.tx() as c:
        p = _profile(c, user["id"])
    return {"user": user, "profile": p, "llm": get_provider().name}


@app.delete("/api/me")
def delete_me(resp: Response, user=Depends(auth.current_user)):
    with db.tx() as c:
        c.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    resp.delete_cookie(auth.COOKIE)
    return {"ok": True}


# ---------------------------------------------------------------- profile / onboarding

class ProfileIn(BaseModel):
    level: str = Field(pattern=r"^(A1|A2|B1|B2|C1)$")
    goal_date: str | None = None
    goal_text: str = Field(default="", max_length=300)
    minutes_per_day: int = Field(ge=5, le=180)
    about: str = Field(default="", max_length=800)
    topics: list[str] = Field(default_factory=list, max_length=20)
    correction_style: str = Field(default="every_turn", pattern=r"^(every_turn|light)$")


def seed_rank(word_level: str, user_level: str, priority: int, no: int) -> int:
    """Words at the learner's level first, then one below, then one above, then the rest."""
    d = learning.level_index(word_level) - learning.level_index(user_level)
    bucket = {0: 0, -1: 1, 1: 2}.get(d, 3 + abs(d))
    return bucket * 100000 + int(priority) * 1000 + int(no)


@app.put("/api/profile")
def save_profile(body: ProfileIn, user=Depends(auth.current_user)):
    if body.goal_date:
        try:
            date.fromisoformat(body.goal_date)
        except ValueError:
            raise HTTPException(422, "Goal date must be YYYY-MM-DD.")
    with db.tx() as c:
        c.execute("""UPDATE profiles SET level=?, goal_date=?, goal_text=?, minutes_per_day=?, about=?, topics=?,
                     correction_style=?, onboarded=1 WHERE user_id=?""",
                  (body.level, body.goal_date, body.goal_text.strip(), body.minutes_per_day, body.about.strip(),
                   json.dumps(body.topics), body.correction_style, user["id"]))
        # (Re)rank the starter deck for the chosen level. Cards already in progress keep their schedule.
        for w in SEED["words"]:
            rank = seed_rank(w["level"], body.level, w["priority"], w["no"])
            c.execute("""INSERT INTO cards(user_id, de, article, plural, en, example, example_en, note, level, category, source, rank)
                         VALUES (?,?,?,?,?,?,?,?,?,?,'seed',?)
                         ON CONFLICT(user_id, de, article) DO UPDATE SET rank = excluded.rank""",
                      (user["id"], w["de"], w["article"], w["plural"], w["en"], w["example"], w["example_en"],
                       w["note"], w["level"], w["category"], rank))
        p = _profile(c, user["id"])
    return {"profile": p}


# ---------------------------------------------------------------- today / progress

def _focus(c, uid: int, days: int = 21, n: int = 3) -> list[dict]:
    since = (learning.today() - timedelta(days=days)).isoformat()
    rs = c.execute("""SELECT category, COUNT(*) AS n FROM mistakes WHERE user_id = ? AND date(created_at) >= ?
                      GROUP BY category ORDER BY n DESC LIMIT ?""", (uid, since, n)).fetchall()
    out = []
    for r in rs:
        ex = c.execute("SELECT wrong, right_text, why FROM mistakes WHERE user_id = ? AND category = ? ORDER BY id DESC LIMIT 1",
                       (uid, r["category"])).fetchone()
        out.append({"category": r["category"], "label": learning.MISTAKE_CATEGORIES.get(r["category"], r["category"]),
                    "count": r["n"], "example": db.row(ex)})
    return out


def _new_today(c, uid: int) -> int:
    return c.execute("SELECT COUNT(*) FROM cards WHERE user_id = ? AND introduced_on = ?", (uid, today())).fetchone()[0]


@app.get("/api/today")
def today_view(user=Depends(auth.current_user)):
    uid = user["id"]
    with db.tx() as c:
        p = _profile(c, uid)
        pl = learning.plan(p)
        due = c.execute("SELECT COUNT(*) FROM cards WHERE user_id = ? AND status IN ('learning','review') AND due_date <= ?",
                        (uid, today())).fetchone()[0]
        new_left = max(0, pl["new_words_per_day"] - _new_today(c, uid))
        new_avail = c.execute("SELECT COUNT(*) FROM cards WHERE user_id = ? AND status = 'new'", (uid,)).fetchone()[0]
        act = db.row(c.execute("SELECT * FROM activity WHERE user_id = ? AND day = ?", (uid, today())).fetchone()) or {}
        days = {r[0] for r in c.execute("SELECT day FROM activity WHERE user_id = ? AND (turns > 0 OR reviews > 0)", (uid,))}
        last = db.row(c.execute("SELECT scenario_id, cefr FROM conversations WHERE user_id = ? AND cefr IS NOT NULL ORDER BY id DESC LIMIT 1",
                                (uid,)).fetchone())
        done_sc = {r[0] for r in c.execute("SELECT DISTINCT scenario_id FROM conversations WHERE user_id = ?", (uid,))}
        focus = _focus(c, uid)
    nxt = next((s for s in SEED["scenarios"] if s["id"] not in done_sc), None)
    day_idx = learning.today().toordinal() % len(SEED["daily"])
    return {
        "plan": pl,
        "due": due,
        "new_left": min(new_left, new_avail),
        "speaking_seconds_today": act.get("speaking_seconds", 0),
        "turns_today": act.get("turns", 0),
        "reviews_today": act.get("reviews", 0),
        "streak": learning.streak(days),
        "focus": focus,
        "last_cefr": last["cefr"] if last else None,
        "suggested_scenario": nxt or SEED["scenarios"][day_idx % len(SEED["scenarios"])],
        "daily_question": SEED["daily"][day_idx],
        "ai_calls_left": max(0, DAILY_AI_LIMIT - act.get("ai_calls", 0)),
    }


@app.get("/api/progress")
def progress(user=Depends(auth.current_user)):
    uid = user["id"]
    since = (learning.today() - timedelta(days=29)).isoformat()
    with db.tx() as c:
        acts = db.rows(c.execute("SELECT day, speaking_seconds, turns, reviews, new_words FROM activity WHERE user_id = ? AND day >= ? ORDER BY day",
                                 (uid, since)))
        status = {r["status"]: r["n"] for r in c.execute("SELECT status, COUNT(*) AS n FROM cards WHERE user_id = ? GROUP BY status", (uid,))}
        mistakes = db.rows(c.execute("SELECT category, COUNT(*) AS n FROM mistakes WHERE user_id = ? GROUP BY category ORDER BY n DESC", (uid,)))
        convs = db.rows(c.execute("""SELECT id, scenario_id, title, started_at, ended_at, cefr, speaking_seconds,
                                     (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conversations.id AND m.role = 'user') AS turns
                                     FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT 30""", (uid,)))
        totals = db.row(c.execute("SELECT COALESCE(SUM(speaking_seconds),0) AS s, COALESCE(SUM(turns),0) AS t FROM activity WHERE user_id = ?",
                                  (uid,)).fetchone())
    for m in mistakes:
        m["label"] = learning.MISTAKE_CATEGORIES.get(m["category"], m["category"])
    return {"activity": acts, "cards": status, "mistakes": mistakes, "conversations": convs,
            "total_speaking_seconds": totals["s"], "total_turns": totals["t"]}


# ---------------------------------------------------------------- vocabulary

CARD_COLS = "id, de, article, plural, en, example, example_en, note, level, category, source, status, due_date, reps, lapses, interval_days"


@app.get("/api/cards")
def list_cards(filter: str = "all", q: str = "", user=Depends(auth.current_user)):
    sql = f"SELECT {CARD_COLS} FROM cards WHERE user_id = ?"
    args: list = [user["id"]]
    if filter in ("new", "learning", "review", "suspended"):
        sql += " AND status = ?"
        args.append(filter)
    elif filter == "due":
        sql += " AND status IN ('learning','review') AND due_date <= ?"
        args.append(today())
    elif filter == "weak":
        sql += " AND lapses >= 2"
    elif filter == "mine":
        sql += " AND source != 'seed'"
    elif filter in learning.LEVELS:
        sql += " AND level = ?"
        args.append(filter)
    if q.strip():
        sql += " AND (de LIKE ? OR en LIKE ?)"
        args += [f"%{q.strip()}%"] * 2
    sql += " ORDER BY CASE status WHEN 'new' THEN 1 ELSE 0 END, rank, id LIMIT 500"
    with db.tx() as c:
        return {"cards": db.rows(c.execute(sql, args))}


@app.get("/api/review")
def review_queue(user=Depends(auth.current_user)):
    uid = user["id"]
    with db.tx() as c:
        p = _profile(c, uid)
        due = db.rows(c.execute(f"""SELECT {CARD_COLS} FROM cards WHERE user_id = ? AND status IN ('learning','review')
                                    AND due_date <= ? ORDER BY due_date, id LIMIT 60""", (uid, today())))
        n_new = max(0, learning.new_words_per_day(p["minutes_per_day"]) - _new_today(c, uid))
        new = db.rows(c.execute(f"SELECT {CARD_COLS} FROM cards WHERE user_id = ? AND status = 'new' ORDER BY rank, id LIMIT ?",
                                (uid, n_new)))
    return {"due": due, "new": new}


class GradeIn(BaseModel):
    grade: str = Field(pattern=r"^(again|hard|good|easy|known)$")


@app.post("/api/cards/{card_id}/grade")
def grade_card(card_id: int, body: GradeIn, user=Depends(auth.current_user)):
    uid = user["id"]
    with db.tx() as c:
        card = db.row(c.execute("SELECT * FROM cards WHERE id = ? AND user_id = ?", (card_id, uid)).fetchone())
        if not card:
            raise HTTPException(404, "Card not found")
        first_time = card["status"] == "new"
        if body.grade == "known":
            # "I already know this": push it far out without counting it as today's new word.
            upd = {"ease": 2.7, "interval_days": 30, "reps": 3, "lapses": card["lapses"],
                   "due_date": (learning.today() + timedelta(days=30)).isoformat(), "status": "review"}
        else:
            upd = learning.schedule(card, body.grade)
        c.execute("""UPDATE cards SET ease=?, interval_days=?, reps=?, lapses=?, due_date=?, status=?,
                     introduced_on = COALESCE(introduced_on, ?) WHERE id = ?""",
                  (upd["ease"], upd["interval_days"], upd["reps"], upd["lapses"], upd["due_date"], upd["status"],
                   today() if first_time and body.grade != "known" else None, card_id))
        db.bump_activity(c, uid, today(), reviews=1, new_words=int(first_time and body.grade != "known"))
    return {"card_id": card_id, **upd}


class CardIn(BaseModel):
    de: str = Field(min_length=1, max_length=120)
    article: str = Field(default="", pattern=r"^(der|die|das|)$")
    plural: str = Field(default="", max_length=60)
    en: str = Field(default="", max_length=200)
    example: str = Field(default="", max_length=300)
    example_en: str = Field(default="", max_length=300)
    level: str = Field(default="", pattern=r"^(A1|A2|B1|B2|C1|)$")
    source: str = Field(default="custom", pattern=r"^(custom|pack|conversation)$")


def _insert_card(c, uid: int, w: dict, source: str) -> bool:
    cur = c.execute("""INSERT OR IGNORE INTO cards(user_id, de, article, plural, en, example, example_en, level, source, rank)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (uid, w["de"].strip(), w.get("article", ""), w.get("plural", ""), w.get("en", ""), w.get("example", ""),
                     w.get("example_en", ""), w.get("level", ""), source, -1))  # rank -1: your own words come first
    return cur.rowcount > 0


@app.post("/api/cards")
def add_cards(body: list[CardIn], user=Depends(auth.current_user)):
    added = 0
    with db.tx() as c:
        for w in body[:50]:
            added += _insert_card(c, user["id"], w.model_dump(), w.source)
    return {"added": added}


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: int, user=Depends(auth.current_user)):
    with db.tx() as c:
        c.execute("DELETE FROM cards WHERE id = ? AND user_id = ?", (card_id, user["id"]))
    return {"ok": True}


def _spend_ai(c, uid: int):
    used = c.execute("SELECT ai_calls FROM activity WHERE user_id = ? AND day = ?", (uid, today())).fetchone()
    if used and used[0] >= DAILY_AI_LIMIT:
        raise HTTPException(429, f"You've reached today's limit of {DAILY_AI_LIMIT} tutor replies. It resets tomorrow.")
    db.bump_activity(c, uid, today(), ai_calls=1)


def _llm(system: str, messages: list[dict], schema, max_tokens=4000):
    try:
        return get_provider().generate(system, messages, schema, max_tokens=max_tokens)
    except LLMError as e:
        raise HTTPException(503, str(e))


class PackIn(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    count: int = Field(default=12, ge=3, le=25)


@app.post("/api/wordpack")
def word_pack(body: PackIn, user=Depends(auth.current_user)):
    uid = user["id"]
    with db.tx() as c:
        p = _profile(c, uid)
        known = [r[0] for r in c.execute("SELECT de FROM cards WHERE user_id = ?", (uid,))]
        _spend_ai(c, uid)
    pack = _llm(prompts.PACK_SYSTEM, [{"role": "user", "content": prompts.pack_prompt(p, body.topic, body.count, known)}],
                schemas.WordPack)
    known_l = {k.lower() for k in known}
    return {"words": [w.model_dump() for w in pack.words if w.de.lower() not in known_l]}


# ---------------------------------------------------------------- speaking

@app.get("/api/scenarios")
def scenarios(user=Depends(auth.current_user)):
    return {"scenarios": [{"id": "free", "title": "Free conversation", "goal": "Talk about your life, plans and opinions.",
                           "phrases": [], "turns": []}] + SEED["scenarios"]}


def _target_words(c, uid: int, n: int = 5) -> list[str]:
    rs = c.execute("""SELECT de, article FROM cards WHERE user_id = ? AND status IN ('learning','review')
                      ORDER BY due_date, lapses DESC LIMIT ?""", (uid, n)).fetchall()
    words = [f"{r['article']} {r['de']}".strip() for r in rs]
    if len(words) < n:
        rs = c.execute("SELECT de, article FROM cards WHERE user_id = ? AND status = 'new' ORDER BY rank, id LIMIT ?",
                       (uid, n - len(words))).fetchall()
        words += [f"{r['article']} {r['de']}".strip() for r in rs]
    return words


class ConvIn(BaseModel):
    scenario_id: str = "free"


@app.post("/api/conversations")
def start_conversation(body: ConvIn, user=Depends(auth.current_user)):
    uid = user["id"]
    sc = SCENARIOS.get(body.scenario_id)
    if body.scenario_id != "free" and not sc:
        raise HTTPException(404, "Unknown scenario")
    # The opening line is scripted (no model call): the scene's first line, or today's question.
    if sc:
        opener, opener_en = sc["turns"][0][0], ""
        title = sc["title"]
    else:
        q = SEED["daily"][learning.today().toordinal() % len(SEED["daily"])]
        opener, opener_en = f"Hallo! Lass uns ein bisschen plaudern. {q[0]}", f"Hi! Let's chat a little. {q[1]}"
        title = "Free conversation"
    with db.tx() as c:
        targets = _target_words(c, uid)
        cur = c.execute("INSERT INTO conversations(user_id, scenario_id, title, target_words) VALUES (?,?,?,?)",
                        (uid, body.scenario_id, title, json.dumps(targets, ensure_ascii=False)))
        cid = cur.lastrowid
        c.execute("INSERT INTO messages(conversation_id, role, text, text_en) VALUES (?, 'assistant', ?, ?)", (cid, opener, opener_en))
    return get_conversation(cid, user)


@app.get("/api/conversations/{cid}")
def get_conversation(cid: int, user=Depends(auth.current_user)):
    with db.tx() as c:
        conv = db.row(c.execute("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (cid, user["id"])).fetchone())
        if not conv:
            raise HTTPException(404, "Conversation not found")
        msgs = db.rows(c.execute("SELECT id, role, text, text_en, feedback, spoken FROM messages WHERE conversation_id = ? ORDER BY id", (cid,)))
    for m in msgs:
        m["feedback"] = db.loads(m["feedback"], None)
    conv["target_words"] = db.loads(conv["target_words"], [])
    conv["summary"] = db.loads(conv["summary"], None)
    conv["scenario"] = SCENARIOS.get(conv["scenario_id"])
    return {"conversation": conv, "messages": msgs}


class TurnIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    spoken: bool = False
    confidence: float | None = Field(default=None, ge=0, le=1)
    seconds: int = Field(default=0, ge=0, le=600)


def _history(msgs: list[dict]) -> list[dict]:
    """Model messages: a fixed opening request, then alternating learner/partner lines. Append-only, so it caches well."""
    out = [{"role": "user", "content": prompts.OPENING_PROMPT}]
    for m in msgs:
        if m["role"] == "assistant":
            out.append({"role": "assistant", "content": m["text"]})
        else:
            out.append({"role": "user", "content": prompts.turn_prompt(m["text"], None, bool(m["spoken"]))})
    return out


@app.post("/api/conversations/{cid}/turn")
def conversation_turn(cid: int, body: TurnIn, user=Depends(auth.current_user)):
    uid = user["id"]
    with db.tx() as c:
        conv = db.row(c.execute("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (cid, uid)).fetchone())
        if not conv:
            raise HTTPException(404, "Conversation not found")
        if conv["ended_at"]:
            raise HTTPException(409, "This conversation has ended. Start a new one.")
        p = _profile(c, uid)
        msgs = db.rows(c.execute("SELECT role, text, spoken FROM messages WHERE conversation_id = ? ORDER BY id", (cid,)))
        focus = [f"{f['label']}" + (f" (e.g. '{f['example']['wrong']}' → '{f['example']['right_text']}')" if f["example"] else "")
                 for f in _focus(c, uid)]
        _spend_ai(c, uid)

    system = prompts.TUTOR_SYSTEM + (prompts.TUTOR_SYSTEM_RECAST if p["correction_style"] == "light" else "")
    system += "\n\n" + prompts.learner_context(p, SCENARIOS.get(conv["scenario_id"]), db.loads(conv["target_words"], []), focus)
    recent = msgs[-24:]  # long chats keep the last dozen exchanges
    if recent and recent[0]["role"] == "user":
        recent = recent[1:]
    history = _history(recent)
    history.append({"role": "user", "content": prompts.turn_prompt(body.text, body.confidence, body.spoken)})
    turn: schemas.TutorTurn = _llm(system, history, schemas.TutorTurn)

    fb = turn.feedback.model_dump()
    with db.tx() as c:
        c.execute("INSERT INTO messages(conversation_id, role, text, feedback, spoken) VALUES (?, 'user', ?, ?, ?)",
                  (cid, body.text.strip(), json.dumps(fb, ensure_ascii=False), int(body.spoken)))
        c.execute("INSERT INTO messages(conversation_id, role, text, text_en) VALUES (?, 'assistant', ?, ?)",
                  (cid, turn.reply, turn.reply_en))
        for m in turn.feedback.mistakes:
            c.execute("INSERT INTO mistakes(user_id, conversation_id, category, wrong, right_text, why) VALUES (?,?,?,?,?,?)",
                      (uid, cid, m.category, m.wrong, m.right, m.why))
        c.execute("UPDATE conversations SET speaking_seconds = speaking_seconds + ? WHERE id = ?", (body.seconds, cid))
        db.bump_activity(c, uid, today(), turns=1, speaking_seconds=body.seconds)
    return {"reply": turn.reply, "reply_en": turn.reply_en, "feedback": fb,
            "new_words": [w.model_dump() for w in turn.new_words]}


@app.post("/api/conversations/{cid}/end")
def end_conversation(cid: int, user=Depends(auth.current_user)):
    uid = user["id"]
    with db.tx() as c:
        conv = db.row(c.execute("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (cid, uid)).fetchone())
        if not conv:
            raise HTTPException(404, "Conversation not found")
        if conv["summary"]:
            return {"summary": db.loads(conv["summary"], None)}
        msgs = db.rows(c.execute("SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY id", (cid,)))
        if sum(1 for m in msgs if m["role"] == "user") == 0:
            c.execute("DELETE FROM conversations WHERE id = ?", (cid,))
            return {"summary": None}
        mistakes = db.rows(c.execute("SELECT category, wrong, right_text AS right, why FROM mistakes WHERE conversation_id = ?", (cid,)))
        p = _profile(c, uid)
        _spend_ai(c, uid)
    review: schemas.SessionReview = _llm(prompts.REVIEW_SYSTEM,
                                         [{"role": "user", "content": prompts.review_prompt(p, msgs, mistakes)}],
                                         schemas.SessionReview)
    summary = review.model_dump()
    with db.tx() as c:
        added = sum(_insert_card(c, uid, w, "conversation") for w in summary["words_to_learn"])
        summary["words_added"] = added
        c.execute("UPDATE conversations SET ended_at = datetime('now'), summary = ?, cefr = ? WHERE id = ?",
                  (json.dumps(summary, ensure_ascii=False), review.cefr_estimate, cid))
    return {"summary": summary}


# ---------------------------------------------------------------- admin

@app.get("/api/admin/users")
def admin_users(user=Depends(auth.admin_user)):
    with db.tx() as c:
        us = db.rows(c.execute("""SELECT u.id, u.username, u.display_name, u.created_at, p.level, p.goal_date,
                                  (SELECT MAX(day) FROM activity a WHERE a.user_id = u.id) AS last_active,
                                  (SELECT COALESCE(SUM(turns),0) FROM activity a WHERE a.user_id = u.id) AS turns,
                                  (SELECT COALESCE(SUM(ai_calls),0) FROM activity a WHERE a.user_id = u.id AND a.day = ?) AS ai_today
                                  FROM users u JOIN profiles p ON p.user_id = u.id ORDER BY u.id""", (today(),)))
    return {"users": us, "daily_ai_limit": DAILY_AI_LIMIT, "invite_code_set": bool(os.environ.get("AD_INVITE_CODE"))}


# ---------------------------------------------------------------- static frontend

STATIC = ROOT.parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")

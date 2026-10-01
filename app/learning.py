"""The adaptive engine that does NOT need an LLM: spaced repetition, daily plan, weak-spot tracking.

Deterministic logic is cheaper, faster and more predictable than a model for these jobs.
The LLM only gets the open-ended work (conversation, corrections, word packs, session review).
"""
from datetime import date, timedelta

LEVELS = ["A1", "A2", "B1", "B2", "C1"]

MISTAKE_CATEGORIES = {
    "word_order": "Word order (verb position, weil/dass clauses)",
    "verb_form": "Verb conjugation and forms",
    "case": "Cases (Akkusativ / Dativ / Genitiv endings)",
    "gender": "Noun gender (der / die / das)",
    "preposition": "Prepositions",
    "tense": "Tenses (Perfekt, Präteritum, Futur)",
    "separable_verb": "Separable verbs",
    "vocabulary": "Word choice",
    "register": "Formal vs informal (Sie / du)",
    "spelling": "Spelling and capitalisation",
    "other": "Other",
}

# Grades from the flashcard buttons.
GRADES = {"again": 0, "hard": 1, "good": 2, "easy": 3}


def today() -> date:
    return date.today()


def schedule(card: dict, grade: str, on: date | None = None) -> dict:
    """SM-2 style update. Returns the fields to write back."""
    on = on or today()
    g = GRADES[grade]
    ease = float(card.get("ease") or 2.5)
    interval = float(card.get("interval_days") or 0)
    reps = int(card.get("reps") or 0)
    lapses = int(card.get("lapses") or 0)

    if g == 0:
        lapses += 1
        reps = 0
        interval = 0  # see it again today
        ease = max(1.3, ease - 0.2)
    else:
        reps += 1
        if reps == 1:
            interval = 1 if g < 3 else 3
        elif reps == 2:
            interval = 3 if g == 1 else 6
        else:
            mult = {1: 1.2, 2: ease, 3: ease * 1.3}[g]
            interval = max(interval + 1, round(interval * mult))
        ease = max(1.3, ease + {1: -0.15, 2: 0.0, 3: 0.15}[g])

    due = on + timedelta(days=int(interval))
    status = "learning" if interval < 7 else "review"
    return {"ease": round(ease, 2), "interval_days": interval, "reps": reps, "lapses": lapses,
            "due_date": due.isoformat(), "status": status}


def level_index(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else 1


def new_words_per_day(minutes_per_day: int) -> int:
    """Roughly 40% of the daily time goes to vocabulary, 60% to speaking.
    A new word with examples costs about a minute the first time, plus its later reviews."""
    vocab_minutes = minutes_per_day * 0.4
    return max(3, min(25, round(vocab_minutes * 0.8)))


def speaking_minutes(minutes_per_day: int) -> int:
    return max(5, round(minutes_per_day * 0.6))


def plan(profile: dict, on: date | None = None) -> dict:
    on = on or today()
    minutes = int(profile.get("minutes_per_day") or 30)
    goal = profile.get("goal_date")
    days_left = None
    if goal:
        try:
            days_left = (date.fromisoformat(goal) - on).days
        except ValueError:
            days_left = None
    per_day = new_words_per_day(minutes)
    return {
        "minutes_per_day": minutes,
        "speaking_minutes": speaking_minutes(minutes),
        "new_words_per_day": per_day,
        "days_left": days_left,
        "projected_new_words": per_day * days_left if days_left and days_left > 0 else None,
    }


def streak(active_days: set[str], on: date | None = None) -> int:
    on = on or today()
    d = on if on.isoformat() in active_days else on - timedelta(days=1)
    n = 0
    while d.isoformat() in active_days:
        n += 1
        d -= timedelta(days=1)
    return n

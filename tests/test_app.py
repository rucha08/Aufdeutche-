import os

import pytest

os.environ["AD_LLM_PROVIDER"] = "mock"
os.environ["AD_INVITE_CODE"] = "freunde"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("app.db.DB_PATH", str(tmp_path / "test.db"))
    from fastapi.testclient import TestClient

    from app.llm import providers
    from app.main import app

    providers.reset_provider()
    with TestClient(app) as c:
        yield c


def register(c, name="rucha", code="freunde"):
    return c.post("/api/register", json={"username": name, "display_name": name.title(), "password": "geheim123", "invite_code": code})


def onboard(c, level="A2", minutes=30):
    r = c.put("/api/profile", json={"level": level, "goal_date": "2026-12-15", "goal_text": "Speak at work",
                                    "minutes_per_day": minutes, "about": "I live in Aachen.", "topics": []})
    assert r.status_code == 200, r.text
    return r.json()


def test_first_user_is_admin_and_invite_required(client):
    assert register(client).status_code == 200
    assert client.get("/api/me").json()["user"]["is_admin"] == 1
    other = client.__class__(client.app)
    assert register(other, "max", code="wrong").status_code == 403
    r = register(other, "max")
    assert r.status_code == 200
    assert other.get("/api/me").json()["user"]["is_admin"] == 0
    assert other.get("/api/admin/users").status_code == 403
    assert len(client.get("/api/admin/users").json()["users"]) == 2


def test_login_logout(client):
    register(client)
    client.post("/api/logout")
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/login", json={"username": "rucha", "password": "nope"}).status_code == 401
    assert client.post("/api/login", json={"username": "RUCHA", "password": "geheim123"}).status_code == 200
    assert client.get("/api/me").status_code == 200


def test_onboarding_seeds_deck_ranked_by_level(client):
    register(client)
    onboard(client, level="B1")
    q = client.get("/api/review").json()
    assert q["due"] == []
    # 30 min/day -> 10 new words, and B1 words come first
    assert len(q["new"]) == 10
    assert all(c["level"] == "B1" for c in q["new"])


def test_review_flow_and_daily_new_limit(client):
    register(client)
    onboard(client, minutes=10)  # -> 3 new words a day
    new = client.get("/api/review").json()["new"]
    assert len(new) == 3
    r = client.post(f"/api/cards/{new[0]['id']}/grade", json={"grade": "good"})
    assert r.json()["status"] == "learning"
    client.post(f"/api/cards/{new[1]['id']}/grade", json={"grade": "known"})  # known words don't use up the quota
    assert len(client.get("/api/review").json()["new"]) == 2
    t = client.get("/api/today").json()
    assert t["reviews_today"] == 2 and t["streak"] == 1


def test_custom_words_come_first(client):
    register(client)
    onboard(client)
    r = client.post("/api/cards", json=[{"de": "Klausur", "article": "die", "en": "exam"}])
    assert r.json()["added"] == 1
    assert client.post("/api/cards", json=[{"de": "Klausur", "article": "die", "en": "exam"}]).json()["added"] == 0
    assert client.get("/api/review").json()["new"][0]["de"] == "Klausur"
    assert client.get("/api/cards?filter=mine").json()["cards"][0]["de"] == "Klausur"


def test_conversation_turn_logs_mistakes_and_feeds_focus(client):
    register(client)
    onboard(client)
    conv = client.post("/api/conversations", json={"scenario_id": "markt"}).json()
    cid = conv["conversation"]["id"]
    assert conv["messages"][0]["role"] == "assistant"
    assert len(conv["conversation"]["target_words"]) == 5
    r = client.post(f"/api/conversations/{cid}/turn", json={"text": "gestern ich habe gegangen zum Markt", "spoken": True,
                                                           "confidence": 0.8, "seconds": 7})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["feedback"]["mistakes"][0]["category"] == "tense"
    assert d["reply"]
    t = client.get("/api/today").json()
    assert t["focus"][0]["category"] == "tense"
    assert t["speaking_seconds_today"] == 7
    full = client.get(f"/api/conversations/{cid}").json()
    assert [m["role"] for m in full["messages"]] == ["assistant", "user", "assistant"]
    s = client.post(f"/api/conversations/{cid}/end").json()["summary"]
    assert s["cefr_estimate"] == "A2"
    assert client.post(f"/api/conversations/{cid}/turn", json={"text": "hallo"}).status_code == 409
    assert client.get("/api/progress").json()["conversations"][0]["cefr"] == "A2"


def test_conversations_are_private(client):
    register(client)
    onboard(client)
    cid = client.post("/api/conversations", json={"scenario_id": "free"}).json()["conversation"]["id"]
    other = client.__class__(client.app)
    register(other, "max")
    assert other.get(f"/api/conversations/{cid}").status_code == 404
    assert other.post(f"/api/conversations/{cid}/turn", json={"text": "hallo"}).status_code == 404


def test_ai_daily_limit(client, monkeypatch):
    monkeypatch.setattr("app.main.DAILY_AI_LIMIT", 1)
    register(client)
    onboard(client)
    cid = client.post("/api/conversations", json={"scenario_id": "free"}).json()["conversation"]["id"]
    assert client.post(f"/api/conversations/{cid}/turn", json={"text": "Mir geht es gut."}).status_code == 200
    assert client.post(f"/api/conversations/{cid}/turn", json={"text": "Und dir?"}).status_code == 429


def test_word_pack_skips_known(client):
    register(client)
    onboard(client)
    words = client.post("/api/wordpack", json={"topic": "my job"}).json()["words"]
    assert {w["de"] for w in words} == {"Beispiel", "üben"}
    client.post("/api/cards", json=[dict(w, source="pack") for w in words])
    assert client.post("/api/wordpack", json={"topic": "my job"}).json()["words"] == []


def test_delete_account(client):
    register(client)
    onboard(client)
    assert client.delete("/api/me").status_code == 200
    assert client.post("/api/login", json={"username": "rucha", "password": "geheim123"}).status_code == 401


def test_schedule_intervals():
    from datetime import date

    from app.learning import schedule, streak
    d = date(2026, 10, 1)
    c = {"ease": 2.5, "interval_days": 0, "reps": 0, "lapses": 0}
    c.update(schedule(c, "good", d))
    assert c["interval_days"] == 1
    c.update(schedule(c, "good", d))
    assert c["interval_days"] == 6
    c.update(schedule(c, "good", d))
    assert c["interval_days"] == 15 and c["status"] == "review"
    c.update(schedule(c, "again", d))
    assert c["interval_days"] == 0 and c["lapses"] == 1 and c["due_date"] == "2026-10-01"
    assert streak({"2026-09-29", "2026-09-30"}, d) == 2
    assert streak({"2026-09-29"}, d) == 0

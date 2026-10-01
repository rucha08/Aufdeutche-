# Auf Deutsch

A speaking-first German practice app for a small group of friends (10–15 people). Each person gets their own plan, word deck and AI conversation partner that corrects them on every turn and remembers what they keep getting wrong.

- **Speak:** role-plays (Bürgeramt, landlord, doctor, job interview…) or free chat. Talk with the mic or type. The partner answers in German, reads it aloud, and shows your sentence corrected, a more natural version and a short reason for each mistake.
- **Words:** spaced repetition where you *say* the German. Starter list ranked for your level, plus your own words, AI word packs for any topic, and words you were missing in conversations.
- **Adapts:** mistakes are categorised (case, word order, gender…) and the top ones are fed back into the next conversation; the words you're learning get woven into the partner's lines; each session ends with a level estimate.
- **Group:** invite code, private accounts, an admin view of who's active, a daily cap on AI use.

Why it's built this way, and what I pushed back on: [docs/PRODUCT.md](docs/PRODUCT.md).
Whether to run your own ("in-house") model: [docs/LLM_OPTIONS.md](docs/LLM_OPTIONS.md).

## Run it locally

```bash
cd Aufdeutche-
pip install -r requirements-dev.txt
cp .env.example .env            # then edit it
export $(grep -v '^#' .env | xargs)
AD_DB_PATH=./auf_deutsch.db AD_SECURE_COOKIES=0 uvicorn app.main:app --reload
```

Open http://localhost:8000, create the first account (it becomes the admin), and share the invite code with friends.

Without an `ANTHROPIC_API_KEY` the app starts in **demo mode** (`AD_LLM_PROVIDER=mock`): everything works, but the "tutor" gives canned replies.

Tests: `python -m pytest -q`

## Settings

| Variable | Default | What it does |
|---|---|---|
| `AD_LLM_PROVIDER` | `anthropic` if a key is set, else `mock` | `anthropic`, `ollama` (self-hosted) or `mock` |
| `ANTHROPIC_API_KEY` | – | Your Anthropic API key (server only, never in the browser) |
| `AD_CLAUDE_MODEL` | `claude-opus-5-5` | Model for the tutor. See cost table in docs/LLM_OPTIONS.md |
| `AD_CLAUDE_EFFORT` | `low` | Thinking effort per turn. Higher = slower, sometimes sharper corrections |
| `AD_CLAUDE_FALLBACKS` | `1` | Server-side refusal fallback on the Claude API. `0` turns it off |
| `AD_OLLAMA_URL`, `AD_OLLAMA_MODEL` | `http://localhost:11434`, `qwen3:14b` | For `AD_LLM_PROVIDER=ollama` |
| `AD_INVITE_CODE` | – | Code friends need to sign up. Without it, only the first (admin) account can register |
| `AD_DAILY_AI_LIMIT` | `200` | Tutor replies per person per day |
| `AD_SECURE_COOKIES` | `0` | Set to `1` behind HTTPS |
| `AD_DB_PATH` | `./auf_deutsch.db` | SQLite file. Put it on a persistent disk and back it up |

## Deploy

It needs an always-on server with **HTTPS** (browsers only allow the microphone on HTTPS). GitHub Pages won't work, because the app has a backend that holds the API key and stores progress.

Any of these is fine for 15 people:

- **Render / Railway / Fly.io:** deploy this repo with the Dockerfile, attach a small persistent volume at `/data`, set the variables above. They give you HTTPS.
- **A small VPS** (e.g. Hetzner CX22, ~€4/month): `docker build -t auf-deutsch . && docker run -d -p 8000:8000 -v ad-data:/data --env-file .env auf-deutsch`, with [Caddy](https://caddyserver.com) in front for automatic HTTPS.

Back up the SQLite file (`/data/auf_deutsch.db`) regularly; it holds everyone's progress.

## Browser support for speaking

- **Chrome / Edge** (desktop and Android): mic + best German voices ("Google Deutsch"). Recommended.
- **Safari** (Mac, iPhone): mic works; add a German voice under Settings → Accessibility → Spoken Content for better audio.
- **Firefox:** no speech recognition. Type, or use the keyboard's dictation (Windows: Win+H, Mac: Fn twice, phone: keyboard mic).

Chrome's recogniser sends audio to Google to transcribe it. Pronunciation feedback is based on whether the recogniser understood each word: a good guide to being understood, not a phonetic analysis.

## Code map

```
app/main.py            API: accounts, onboarding, plan, cards, conversations, progress, admin
app/learning.py        Spaced repetition, daily plan, streaks, mistake categories (no AI)
app/llm/prompts.py     Tutor, session-review and word-pack prompts
app/llm/schemas.py     Structured outputs every model must return
app/llm/providers.py   Claude (default), Ollama (self-hosted) and mock providers
app/data/seed.json     150 starter words, 10 role-play scenarios, 30 daily questions
static/                The web app (no build step): app.js, speech.js, app.css
tests/                 API tests (run against the mock provider)
```

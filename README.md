# Auf Deutsch

**Speak · Understand · Every day.** A simple website for learning German at your own level, from complete beginner (A1) to advanced (C1). The focus is on speaking and understanding, with new words every day and progress you can see.

- **Start in seconds:** type your name, pick your level (or take a quick 3-minute check), and go. Everything you see matches your level; higher levels stay locked until you pass a short level-up test.
- **Today's new words:** a handful of new words every day (how many depends on your daily minutes), each with an example and audio, ticked off as you learn them. Older words come back for review at the right time.
- **🎤 Sprechen (Speaking):** introduce yourself, plan together, present and discuss, everyday role-plays, pronunciation drills, and a **job interview trainer** (from A2) with model answers for A2, B1 and B2–C1.
- **🎧 Hören (Listening)** and **📄 Lesen (Reading):** phone messages, conversations, emails, notices and articles about everyday life and work, with questions and transcripts.
- **✍️ Schreiben (Writing):** messages, emails and short texts with a word counter, a checklist, useful phrases and a model answer.
- **Fortschritt (Progress):** streak, words learned, new words per day, speaking minutes, and exercises done per skill and level. Backup and restore included.
- **Copy for Claude:** after writing or speaking, copy your answer into a Claude chat for full corrections.

Each person's progress is saved in their own browser, so friends can share one link and still have separate progress.

## Put it online (GitHub Pages, free)

1. On GitHub, open this repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute or two the site is live at `https://rucha08.github.io/Aufdeutche-/`. Share that link.

Every push to `main` updates the site.

## Run it on your computer

Open `index.html` by double-clicking it to look around. For the microphone, serve it locally instead:

```
python -m http.server 8000
```

then open http://localhost:8000 in Chrome.

## Speaking works best in

- **Chrome / Edge:** microphone and the "Google Deutsch" voice. Recommended.
- **Safari (Mac, iPhone):** microphone works; add a German voice in Settings → Accessibility → Spoken Content.
- **Firefox:** no speech recognition. Type your answers or use the keyboard's dictation.

Scores show whether the browser *understood* each word (green, amber or red). That's a good guide to being understood, but it isn't a phonetic analysis, and an answer that differs from the model answer can still be correct.

## Files

```
index.html   page
style.css    look (German-flag colours)
app.js       the app
speech.js    German voice, microphone, pronunciation scoring
data.js      starter words, role-plays, daily questions
words_pro.js work, interview, office and bureaucracy vocabulary
exercises.js Hören, Lesen, Schreiben, Sprechen and interview material (add more here)
placement.js level test questions
```

The earlier version with accounts and an AI conversation partner (it needs a server) is kept on the `server-version` branch.

# Auf Deutsch

A simple website for learning German in the four skills of the Goethe-Zertifikat, from **A1 to C1**, with a strong focus on **work, job interviews and official matters**. No accounts and no server: it's plain HTML, CSS and JavaScript, so GitHub Pages can host it for free.

- **Level test first:** new users take a short test (6 questions per level, from very easy upwards; it stops when a level gets too hard). Everything in the app then matches their level. **Higher levels stay locked** until they pass a short level-up test (4 of 6 correct), so beginners never land on B2 texts.
- **🎧 Hören (Listening):** phone messages, announcements, meetings, an interview invitation, a radio report, a discussion. Played by your browser's German voice (different voices or pitches per speaker), then questions.
- **📄 Lesen (Reading):** notices, job ads, emails from the boss, a letter from the immigration office, an employment contract, articles and commentaries, then questions.
- **✍️ Schreiben (Writing):** forms, short messages, formal and informal emails, forum posts and a cover letter. Word counter, points checklist, useful phrases, autosaved drafts, a form check, a model answer, and **Copy for Claude** for a full correction.
- **🎤 Sprechen (Speaking):** Goethe-style parts per level (introduce yourself, ask and answer, plan together, presentation, discussion) plus a **job interview trainer** (from A2) with 14 common questions and model answers written for A2, B1 and B2–C1. Also everyday role-plays and pronunciation drills.
- **Wörter (Words):** about 470 words, shown only up to your level (A1 learners see simple A1 words with very short example sentences), about 200 of them for job search and interviews, the office, authorities and documents, and emails and phone calls. Filter by topic and level. Spaced repetition where you *say* the German.
- **Fortschritt (Progress):** exercises done and scores per skill and level, speaking minutes, backup and restore.

Each person's progress is saved in their own browser, so friends can share one link and still have separate progress.

The practice material is written for this app and modelled on the Goethe exam task types; it is not official Goethe-Institut material. For the official format and sample papers see [goethe.de](https://www.goethe.de/en/spr/prf.html).

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

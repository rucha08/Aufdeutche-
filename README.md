# Auf Deutsch

A simple website for speaking German every day. No accounts and no server: it's plain HTML, CSS and JavaScript, so GitHub Pages can host it for free.

- **Today:** your streak, speaking minutes, words due, the role-play of the day and a question to answer out loud.
- **Speak:** 10 role-plays (Bürgeramt, landlord, doctor, job interview…). The other person speaks, you answer with the microphone, and the site compares your answer with a model answer word by word. There are also phrase drills and a "talk freely" question. A **Copy for Claude** button turns what you said into a message you can paste into Claude for full corrections.
- **Words:** 150 starter words ranked for your level, plus your own words. Spaced repetition: you see new words in full, then later you have to *say* the German.
- **Progress:** streak, words known, speaking minutes, role-play scores, and backup/restore.

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
data.js      starter words, role-plays, daily questions (edit to add more)
```

The earlier version with accounts and an AI conversation partner (it needs a server) is kept on the `server-version` branch.

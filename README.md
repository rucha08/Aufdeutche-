# Auf Deutsch

**100 words a day · Hear it · Say it · Keep it.** A fast, speaking-first way to learn German, starting from A1 basics and getting harder day by day.

## The daily 100

Every day has a theme, a short grammar lesson and **100 words in 5 sets of 20** (about 20 minutes per set, spread across the day). For every word:

1. **Hear** the word and a sentence that uses it (normal or slow).
2. **Read** a one-line grammar tip for that sentence.
3. **Say** the sentence out loud: the microphone checks it word by word (green / amber / red).
4. Next word. Already know it? **Kenne ich** skips it.

After each set, a **quick check** (English → you say the German). Words you miss come back in **Wiederholen** with spaced repetition. **Hands-free mode** plays the word and sentence, opens the mic and moves on when you said it well. Keyboard: Enter = next, Space = hear the sentence, M = microphone.

You can set your daily goal to 20, 40, 60 or 100 new words. Days 1–3 (300 A1 words) are included; new days are added in `days.js`.

## Progress

**Fortschritt** tracks days completed, words learned, words you said correctly, words to review, new words per day and speaking minutes, with backup and restore.

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
days.js      the daily 100-word course (add new days at the end)
data.js      starter words, role-plays, daily questions
words_pro.js work, interview, office and bureaucracy vocabulary
exercises.js Hören, Lesen, Schreiben, Sprechen and interview material (add more here)
placement.js level test questions
```

The earlier version with accounts and an AI conversation partner (it needs a server) is kept on the `server-version` branch.

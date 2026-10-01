# Auf Deutsch: product framing

## The one-line pitch

**A daily speaking gym with a personal German tutor that remembers your mistakes.**

It's a speaking app with a vocabulary engine underneath, not a vocabulary app with a speaking tab. Every feature has to answer one question: *does this get people speaking German more often, with faster correction?*

## Who it's for

- 10–15 friends, roughly A1–B2, mostly living in Germany, who want to **speak** rather than pass a grammar test.
- They each have different levels, goals, deadlines and amounts of free time, so one fixed plan won't work for everyone.
- Small group, so we optimise for quality and low running cost, not scale. One small server, one SQLite file, invite code, no app store.

## Where I pushed back (and what changed)

| Original idea | Concern | What the app does instead |
|---|---|---|
| 2,000 words in 30 days for everyone | ~70 new words a day is recognition at best and burns people out. Speaking needs words you can *produce*. | The plan comes from each person's minutes per day: about 60% speaking and 40% words. At 30 min/day you get roughly 10 new words a day, which is about 700 usable words plus 20+ hours of speaking by mid-December. |
| "Build an in-house LLM" | Training or fine-tuning a model for 15 people is expensive, slow, and would correct German worse than an existing frontier model. Self-hosting an open model costs more than API calls at this size (see [LLM_OPTIONS.md](LLM_OPTIONS.md)). | The personalisation lives in **data** (each person's mistake log, word deck, level, goals), which goes into the prompt on every turn. The model is swappable via one setting, including a self-hosted open model if you want to try it. |
| Pronunciation correction | Browser speech recognition tells you whether the computer **understood** you, not which sound was wrong. It also tends to "hear" correct grammar, which can hide mistakes like a wrong article. | We call it what it is: "understood / close / not recognised" per word, plus sound tips. The tutor prompt is lenient with recognition slips. Real phoneme-level scoring is a later, paid add-on. |
| One shared tracker | Friends need their own progress, words and history. | Accounts behind an invite code. Everything is per person; the admin sees only activity totals. |

## How it adapts to each person

1. **Onboarding**: level (A1–C1), what they want to be able to do, a goal date, minutes per day, a few lines about their life, and correction style ("correct everything" or "only big mistakes").
2. **Word deck**: the starter list (the 150 words from the original tracker) is ranked for their level. People add their own words, ask the tutor for a word pack on any topic ("my job as a nurse", "Ausländerbehörde appointment"), and words they needed in conversation get added automatically.
3. **Spaced repetition**: new words are introduced in full, then reviews ask you to *say* the German (English → German), with the mic if available. This is plain logic, not AI.
4. **Conversations**: role-plays (Bürgeramt, landlord, doctor, job interview…) or free chat. Every turn returns the partner's reply plus the correction: what you said with changes marked, a more natural version, and a one-line reason for each mistake.
5. **The feedback loop**: every mistake is logged with a category (word order, case, gender, tense…). The top three recent categories go into the tutor's instructions for the next conversation, and the words you're currently learning are woven into the partner's lines.
6. **Session review**: when you finish, the tutor estimates your spoken level (A1–C1), lists what went well and what to practise next, and adds the words you were missing to your deck.

## What success looks like

- **North star:** minutes spoken per person per week.
- **Quality:** share of turns with no real mistakes, rising over time; the CEFR estimate moving up.
- **Retention:** streaks; how many of the group are still active after 4 weeks.

## Decisions you still need to make

1. **Who pays for the AI?** Roughly €30–150 a month for the whole group depending on the model and how much people talk (estimates in [LLM_OPTIONS.md](LLM_OPTIONS.md)). There's a per-person daily cap (default 200 tutor replies) so costs can't run away.
2. **Hosting.** It needs a small always-on server with HTTPS (the microphone only works on HTTPS). GitHub Pages can't run it because it has a backend. See the README.
3. **Privacy.** What friends say is stored on your server and sent to the AI provider. Tell them before they join. Everyone can delete their account and data in Settings.
4. **Interface language.** The interface and explanations are in English. If some friends would prefer explanations in another language, that's a small prompt change.

## Roadmap

**Now (this version):** accounts, onboarding, per-person plan, speaking partner with corrections on every turn, phrase drills, spaced repetition with spoken answers, AI word packs, mistake tracking that feeds back into conversations, session reviews with level estimate, progress page, group admin view.

**Next:**
- Self-hosted speech on the same server: Whisper for speech-to-text (works in every browser, more consistent) and Piper for natural German voices (fixes "the voice sounds robotic" on devices without a good German voice).
- Weekly email or message: "You spoke 74 minutes this week. Your top issue is Dativ after prepositions."
- Grammar mini-drills generated from each person's top mistake category.
- Group features: a weekly speaking challenge, or a leaderboard by minutes spoken (opt-in).

**Later:** phoneme-level pronunciation scoring (e.g. Azure Pronunciation Assessment), and a real-time voice mode where you talk without pressing a button.

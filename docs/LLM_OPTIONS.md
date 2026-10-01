# Should we run our own ("in-house") LLM?

**Short answer: not for the tutor's brain, at least not yet. But do self-host the *speech* parts later. That's where open models are strong and cheap.**

A speaking tutor has three AI pieces, and they have different answers:

| Piece | What it does | Today | Self-host? |
|---|---|---|---|
| Speech-to-text | Turns your voice into German text | Browser (Chrome/Edge/Safari) | **Yes, later.** Whisper is open, runs on a CPU server, works in every browser and handles accents well. |
| Conversation + correction | Replies in character and corrects your German | Claude via API | **Not yet.** Correction quality matters most here, and the open models you can afford to host are noticeably weaker at it. |
| Text-to-speech | Reads the partner's lines aloud | Browser voices | **Yes, later.** Piper has free German neural voices that run in real time on a CPU. |

## The conversation model: API vs self-hosted

What a tutor turn needs: catch real errors (case endings, gender, verb position, separable verbs), **not** "correct" valid German, explain each one in a sentence, stay at the learner's level, and return clean structured data, every time, in a couple of seconds.

### Option A: Claude through the API (the default)

- Best correction quality and the most reliable structured output.
- Costs nothing when nobody is practising.
- Your friends' messages go to Anthropic for processing.
- Rough cost per tutor turn: ~2,500 input tokens (instructions + recent conversation, partly cached) and ~400 output tokens.

| Model (`AD_CLAUDE_MODEL`) | ≈ per turn | Group of 15, 15 turns/person/day | Group of 15, 40 turns/person/day |
|---|---|---|---|
| `claude-opus-5-5` (default) | ~$0.018 | ~$125 / month | ~$330 / month |
| `claude-sonnet-5-5` | ~$0.009 | ~$60 / month | ~$165 / month |
| `claude-haiku-4-5` | ~$0.0045 | ~$30 / month | ~$80 / month |

These are estimates from list prices; prompt caching lowers the input part. Try the cheaper models on a few real conversations and compare the corrections before switching. That's your call on quality versus cost. The app caps each person at `AD_DAILY_AI_LIMIT` replies per day (default 200).

### Option B: an open model you host yourself (`AD_LLM_PROVIDER=ollama`)

Already supported: run [Ollama](https://ollama.com) with an open-weights model and point the app at it.

```bash
ollama pull qwen3:14b          # or mistral-small, gemma3:27b, llama3.3:70b …
AD_LLM_PROVIDER=ollama AD_OLLAMA_MODEL=qwen3:14b AD_OLLAMA_URL=http://localhost:11434 uvicorn app.main:app
```

- **Privacy:** nothing leaves your server.
- **Quality:** good 14B–32B models chat fine in German but miss more case and gender errors, and sometimes "correct" things that were right. 7–8B models aren't good enough for correction.
- **Hardware:** a 14B model needs a GPU with ~12–16 GB VRAM for snappy replies, 32B ~24 GB. On CPU, expect 10–30 seconds per turn, which kills the conversation.
- **Cost:** a rented GPU is ~$0.40–1.50 per hour. Always on, that's $300–1,000 a month, more than the API for a group this size. Switching it on only when needed means slow cold starts.

**When self-hosting the LLM makes sense:** if privacy is a hard requirement, if the group grows to hundreds of daily users, or if you already own a suitable GPU machine. Then compare: run the same 30 real learner sentences through both providers and count missed errors and wrong corrections.

### Option C: fine-tune or train our own model

No. A fine-tune needs thousands of high-quality correction examples, still ends up weaker than a frontier model, and must be retrained whenever things change. Everything that makes the tutor "yours" (your level, mistakes, words, goals) already reaches the model through the prompt on every turn, which is cheaper and updates instantly.

## Recommended path

1. **Now:** Claude API for the tutor, browser speech. Measure minutes spoken and API cost for a month.
2. **Next:** add Whisper (speech-to-text) and Piper (German voices) on the same small server. These are the "in-house models" that pay off: free to run, private, and they fix the two biggest complaints (mic only works in some browsers; robotic voices on some devices).
3. **Revisit** the conversation model if costs or privacy become a problem. The provider switch is one setting, so you can A/B test an Ollama model with a couple of friends without changing the app.

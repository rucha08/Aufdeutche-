"""LLM providers behind one interface.

- "anthropic": Claude through the Anthropic API (recommended: best German corrections, pay per use).
- "ollama":    an open-weights model you host yourself (the "in-house" option). See docs/LLM_OPTIONS.md.
- "mock":      offline demo mode for development and tests. No real corrections.

Pick with AD_LLM_PROVIDER. Every provider returns a validated pydantic object.
"""
import json
import os
import re
import urllib.error
import urllib.request
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from . import schemas

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """A problem the user should see as a friendly message."""


class Provider:
    name = "base"

    def generate(self, system: str, messages: list[dict], schema: type[T], max_tokens: int = 4000) -> T:
        raise NotImplementedError


class AnthropicProvider(Provider):
    name = "anthropic"

    def __init__(self):
        import anthropic

        self._anthropic = anthropic
        self.client = anthropic.Anthropic(timeout=60.0, max_retries=2)
        self.model = os.environ.get("AD_CLAUDE_MODEL", "claude-opus-5-5")
        # Conversation turns are short; low effort keeps replies fast. Raise it if corrections feel shallow.
        self.effort = os.environ.get("AD_CLAUDE_EFFORT", "low")
        # Server-side refusal fallback (Claude API only). Set AD_CLAUDE_FALLBACKS=0 to turn off.
        self.fallbacks = os.environ.get("AD_CLAUDE_FALLBACKS", "1") != "0"

    def generate(self, system, messages, schema, max_tokens=4000):
        a = self._anthropic
        kwargs = dict(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            output_format=schema,
            output_config={"effort": self.effort},
            cache_control={"type": "ephemeral"},
        )
        if self.fallbacks:
            kwargs.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        try:
            resp = self.client.beta.messages.parse(**kwargs)
        except a.RateLimitError:
            raise LLMError("The tutor is busy right now. Try again in a minute.")
        except a.AuthenticationError:
            raise LLMError("The server's API key is missing or invalid. Ask the admin to check AD_LLM_PROVIDER / ANTHROPIC_API_KEY.")
        except a.APIStatusError as e:
            raise LLMError(f"The tutor service returned an error ({e.status_code}). Try again.")
        except a.APIConnectionError:
            raise LLMError("Could not reach the tutor service. Check the server's internet connection.")
        if resp.stop_reason == "refusal":
            raise LLMError("The tutor couldn't answer that message. Try rephrasing it.")
        if resp.stop_reason == "max_tokens" or resp.parsed_output is None:
            raise LLMError("The tutor's answer was cut off. Try a shorter message.")
        return resp.parsed_output


class OllamaProvider(Provider):
    """Self-hosted open-weights model via Ollama's /api/chat with JSON-schema constrained output."""
    name = "ollama"

    def __init__(self):
        self.url = os.environ.get("AD_OLLAMA_URL", "http://localhost:11434").rstrip("/")
        self.model = os.environ.get("AD_OLLAMA_MODEL", "qwen3:14b")

    def generate(self, system, messages, schema, max_tokens=4000):
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}] + messages,
            "format": schema.model_json_schema(),
            "stream": False,
            "options": {"temperature": 0.4, "num_predict": max_tokens},
        }
        req = urllib.request.Request(f"{self.url}/api/chat", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
        except (urllib.error.URLError, TimeoutError) as e:
            raise LLMError(f"Could not reach the local model server ({e}).")
        try:
            return schema.model_validate_json(data["message"]["content"])
        except (KeyError, ValidationError, ValueError):
            raise LLMError("The local model returned an answer in the wrong format. Try again, or use a larger model.")


class MockProvider(Provider):
    """Deterministic stand-in so the whole app runs without any model. It does not really correct German."""
    name = "mock"

    def generate(self, system, messages, schema, max_tokens=4000):
        last = messages[-1]["content"] if messages else ""
        m = re.search(r"<<<\n?(.*?)\n?>>>", last, re.S)
        said = (m.group(1) if m else last).strip()
        if schema is schemas.Opening:
            return schemas.Opening(reply="Hallo! Schön, dass Sie da sind. Wie geht es Ihnen heute?",
                                   reply_en="Hello! Nice that you're here. How are you today?")
        if schema is schemas.TutorTurn:
            mistakes = []
            corrected = said[:1].upper() + said[1:] if said else said
            if re.search(r"\bich habe gegangen\b", said, re.I):
                corrected = re.sub(r"ich habe gegangen", "ich bin gegangen", corrected, flags=re.I)
                mistakes.append(schemas.Mistake(wrong="habe gegangen", right="bin gegangen",
                                                why="Verbs of movement form the Perfekt with sein.", category="tense"))
            if corrected and corrected[-1] not in ".!?":
                corrected += "."
            return schemas.TutorTurn(
                reply="Interessant! Erzählen Sie mir mehr darüber. Was machen Sie heute noch?",
                reply_en="Interesting! Tell me more about it. What else are you doing today?",
                feedback=schemas.Feedback(is_correct=not mistakes, corrected=corrected, natural=corrected,
                                          mistakes=mistakes, praise="Demo mode: connect a model for real feedback.",
                                          used_target_words=[]),
                new_words=[schemas.NewWord(de="erzählen", article="", en="to tell")],
            )
        if schema is schemas.SessionReview:
            return schemas.SessionReview(cefr_estimate="A2", strengths=["You kept the conversation going."],
                                         focus_next=["Connect a real model to get a proper review."],
                                         summary="Demo mode review.", words_to_learn=[])
        if schema is schemas.WordPack:
            return schemas.WordPack(words=[
                schemas.PackWord(de="Beispiel", article="das", plural="-e", en="example",
                                 example="Das ist nur ein Beispiel.", example_en="That's just an example.", level="A1"),
                schemas.PackWord(de="üben", article="", plural="", en="to practise",
                                 example="Ich übe jeden Tag Deutsch.", example_en="I practise German every day.", level="A1"),
            ])
        raise LLMError("Unsupported request in demo mode.")


_provider: Provider | None = None


def get_provider() -> Provider:
    global _provider
    if _provider is None:
        name = os.environ.get("AD_LLM_PROVIDER", "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "mock")
        _provider = {"anthropic": AnthropicProvider, "ollama": OllamaProvider, "mock": MockProvider}[name]()
    return _provider


def reset_provider() -> None:
    global _provider
    _provider = None

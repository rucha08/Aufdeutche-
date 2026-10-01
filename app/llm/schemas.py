"""Structured outputs the tutor model must return. Every provider is validated against these."""
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["word_order", "verb_form", "case", "gender", "preposition", "tense",
                   "separable_verb", "vocabulary", "register", "spelling", "other"]


class Mistake(BaseModel):
    wrong: str = Field(description="The exact wrong fragment the learner said")
    right: str = Field(description="The corrected fragment")
    why: str = Field(description="One short sentence in English explaining the rule")
    category: Category


class Feedback(BaseModel):
    is_correct: bool = Field(description="True if the learner's sentence had no real errors")
    corrected: str = Field(description="The learner's message with only the errors fixed")
    natural: str = Field(description="How a native speaker would say it, at the learner's level")
    mistakes: list[Mistake]
    praise: str = Field(description="One short, specific encouraging remark in English")
    used_target_words: list[str] = Field(description="Target words the learner used correctly")


class NewWord(BaseModel):
    de: str = Field(description="Dictionary form, without article")
    article: Literal["der", "die", "das", ""]
    en: str


class TutorTurn(BaseModel):
    reply: str = Field(description="Your next line in German, 1-3 short sentences, ending with a question or prompt")
    reply_en: str = Field(description="English translation of reply")
    feedback: Feedback
    new_words: list[NewWord] = Field(description="Up to 3 useful words from your reply or the correction the learner may not know")


class Opening(BaseModel):
    reply: str
    reply_en: str


class SessionReview(BaseModel):
    cefr_estimate: Literal["A1", "A2", "B1", "B2", "C1"]
    strengths: list[str] = Field(description="2-3 specific things the learner did well, in English")
    focus_next: list[str] = Field(description="2-3 concrete things to practise next, in English")
    summary: str = Field(description="Two or three sentences in English addressed to the learner")
    words_to_learn: list[NewWord] = Field(description="Up to 6 words the learner needed or got wrong")


class PackWord(BaseModel):
    de: str = Field(description="Dictionary form without article")
    article: Literal["der", "die", "das", ""]
    plural: str = Field(description="Plural ending like -en, or empty for non-nouns")
    en: str
    example: str = Field(description="A natural example sentence that fits the learner's life")
    example_en: str
    level: Literal["A1", "A2", "B1", "B2", "C1"]


class WordPack(BaseModel):
    words: list[PackWord]

from fastapi import FastAPI
from pydantic import BaseModel
from natasha import Segmenter, MorphVocab, NewsEmbedding, NewsNERTagger, Doc
import pymorphy2

app = FastAPI()

segmenter = Segmenter()
morph_vocab = MorphVocab()
emb = NewsEmbedding()
ner_tagger = NewsNERTagger(emb)
morph = pymorphy2.MorphAnalyzer()

SUPPORTED_TYPES = {"PER", "ORG", "LOC"}

# Имена изданий/агентств — не должны быть FIRST-сущностью
MEDIA_NAMES = {
    "rbc", "lenta", "tass", "reuters", "bloomberg", "bbc", "cnn",
    "guardian", "al jazeera", "aljazeera", "ap", "ap news",
    "interfax", "ria", "itar-tass", "rt", "sputnik",
    "dw", "deutsche welle", "euronews", "kommersant", "vedomosti",
    "nyt", "new york times", "habr", "primaedia", "dvhab",
    "nord-news", "portamur", "todaykhv", "dvnovosti", "asn24",
    "коммерсантъ", "ведомости", "риа", "тасс", "спутник",
    "лента", "хабр", "примамедиа", "полуостров",
}


def to_nominative(word: str) -> str:
    parsed = morph.parse(word)
    if not parsed:
        return word
    for p in parsed:
        inflected = p.inflect({'nomn'})
        if inflected:
            result = inflected.word
            # Если исходное слово целиком в верхнем регистре (аббревиатура) — сохраняем
            if word.isupper():
                return word
            if word[0].isupper():
                result = result.capitalize()
            return result
    return word


def normalize_span(text: str) -> str:
    """Normalize each word in a multi-word span to nominative case."""
    words = text.split()
    return ' '.join(to_nominative(w) for w in words)


def is_media(text: str) -> bool:
    return text.lower().strip() in MEDIA_NAMES


def extract(text: str) -> dict:
    doc = Doc(text)
    doc.segment(segmenter)
    doc.tag_ner(ner_tagger)
    for span in doc.spans:
        span.normalize(morph_vocab)

    result: dict[str, list[str]] = {"PER": [], "ORG": [], "LOC": [], "FIRST": []}
    seen: set[str] = set()
    first_set = False
    for span in doc.spans:
        if span.type not in SUPPORTED_TYPES:
            continue
        base = (span.normal or span.text).strip()
        normal = normalize_span(base)
        key = (span.type, normal.lower())
        if key in seen:
            continue
        seen.add(key)
        result[span.type].append(normal)
        # FIRST — первая сущность не являющаяся именем издания
        if not first_set and not is_media(normal):
            result["FIRST"] = [normal]
            first_set = True
    return result


class BatchRequest(BaseModel):
    texts: list[str]


class NormalizeRequest(BaseModel):
    tokens: list[str]


@app.post("/normalize")
def normalize_tokens(req: NormalizeRequest) -> dict:
    """Normalize tokens to nominative case using pymorphy2."""
    return {"tokens": [to_nominative(t) for t in req.tokens]}


@app.post("/extract")
def extract_batch(req: BatchRequest) -> list[dict]:
    return [extract(t) for t in req.texts]


@app.get("/health")
def health():
    return {"ok": True}

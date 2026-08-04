import json
import os
from typing import Dict

TRANSLATIONS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "translations"
)

_cache: Dict[str, dict] = {}


def load_translation(lang: str) -> dict | None:
    lang = (lang or "").lower().split("-")[0]
    if lang in _cache:
        return _cache[lang]
    path = os.path.join(TRANSLATIONS_DIR, f"{lang}.json")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    _cache[lang] = data
    return data


def supported_languages() -> list[str]:
    if not os.path.isdir(TRANSLATIONS_DIR):
        return []
    return sorted(
        os.path.splitext(f)[0]
        for f in os.listdir(TRANSLATIONS_DIR)
        if f.endswith(".json")
    )

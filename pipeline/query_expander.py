from typing import List
import re
import unicodedata


BASE_THEMES_EN = [
    "political violence",
    "state power",
    "law and order",
    "police investigation",
    "justice system",
    "citizen rights",
    "constitution",
    "democracy",
]

BASE_THEMES_HI = [
    "राज्य की शक्ति",
    "नागरिक अधिकार",
    "संविधान",
    "लोकतंत्र",
    "पुलिस की भूमिका",
    "कानून और व्यवस्था",
    "न्याय व्यवस्था",
]


KEYWORD_THEME_MAP_EN = {
    "murder": ["political violence", "law and order", "police investigation"],
    "killing": ["political violence", "law and order"],
    "student": ["youth politics", "campus democracy"],
    "leader": ["leadership", "state power"],
    "criminal": ["criminal law", "state authority"],
    "law": ["criminal law", "constitution", "citizen rights"],
    "police": ["police power", "state authority", "law and order"],
    "constitution": ["constitution", "citizen rights", "democracy"],
    "rights": ["citizen rights", "constitution"],
    "riot": ["political violence", "law and order"],
    "protest": ["state power", "citizen rights", "democracy"],
    "border": ["state power", "security", "law and order"],
    "iran": ["विदेश नीति", "तेल राजनीति", "राज्य की शक्ति"],
}

KEYWORD_THEME_MAP_HI = {
    "हत्या": ["राजनीतिक हिंसा", "कानून और व्यवस्था"],
    "छात्र": ["युवा राजनीति", "कैंपस लोकतंत्र"],
    "नेता": ["राजनीतिक नेतृत्व", "राज्य की शक्ति"],
    "पुलिस": ["पुलिस की शक्ति", "कानून और व्यवस्था"],
    "संविधान": ["संविधान", "नागरिक अधिकार", "लोकतंत्र"],
    "अधिकार": ["नागरिक अधिकार", "संविधान"],
    "लोकतंत्र": ["लोकतंत्र", "राज्य की शक्ति"],
}


def _contains_devanagari(text: str) -> bool:
    return any("\u0900" <= ch <= "\u097f" for ch in text)


_PUNCT_TO_SPACE = str.maketrans(
    {
        "“": " ",
        "”": " ",
        "‘": " ",
        "’": " ",
        "'": " ",
        '"': " ",
        ",": " ",
        ".": " ",
        "(": " ",
        ")": " ",
        "[": " ",
        "]": " ",
        "{": " ",
        "}": " ",
        "-": " ",
        "_": " ",
        "/": " ",
        "\\": " ",
        ":": " ",
        ";": " ",
        "?": " ",
        "!": " ",
        "।": " ",
        "॥": " ",
    }
)


def _tokenize_query(text: str) -> set[str]:
    norm = unicodedata.normalize("NFKC", text or "").translate(_PUNCT_TO_SPACE).casefold()
    return set(re.findall(r"[\u0900-\u097F]+|\w+", norm, flags=re.UNICODE))


def expand_queries_from_news(news_text: str, max_queries: int = 10) -> List[str]:
    """
    Expand a news title/summary into a set of political themes.

    Heuristic approach:
    - Inspect language (basic Devanagari check)
    - Map known keywords into theme buckets
    - Always include some base themes for coverage
    """
    raw_text = news_text or ""
    tokens = _tokenize_query(raw_text)

    is_hindi = _contains_devanagari(raw_text)
    themes: List[str] = []

    if is_hindi:
        for word, mapped_themes in KEYWORD_THEME_MAP_HI.items():
            if word in tokens:
                for t in mapped_themes:
                    if t not in themes:
                        themes.append(t)

        base_list = BASE_THEMES_HI
    else:
        for word, mapped_themes in KEYWORD_THEME_MAP_EN.items():
            if word in tokens:
                for t in mapped_themes:
                    if t not in themes:
                        themes.append(t)

        base_list = BASE_THEMES_EN

    # Fallback: include some base themes if mapping is sparse
    for base in base_list:
        if len(themes) >= max_queries:
            break
        if base not in themes:
            themes.append(base)

    # Cap to requested max size
    return themes[:max_queries]


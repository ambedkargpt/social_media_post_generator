"""
Check a finished post against the material it was written from.

The manual trial established that instructions about facts are followed
inconsistently. A wrong date survived a prompt patch written specifically to
remove it, and a name that appeared in no source was inserted anyway. The same
lesson already drove `_strip_ai_tells`: where a rule can be checked
mechanically, checking beats asking.

So this module re-reads the generated post and asks one question of every
quantity and date in it: does this appear in something the model was actually
given? Anything that does not is reported. The check is deliberately biased
towards silence, because a validator that cries wolf gets switched off.

It reports; it does not rewrite. The caller decides whether to re-ask the model,
store the flags for audit, or both.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Sequence

# Devanagari digits appear in Hindi output even though the prompt asks for
# Arabic ones, so both forms have to normalise to the same thing.
_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

# Hindi number words that realistically precede a unit in a political post.
_HINDI_UNITS: Dict[str, int] = {
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
    "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "बारह": 12, "पंद्रह": 15, "बीस": 20, "पचास": 50, "सौ": 100,
}

_SCALES: Dict[str, int] = {
    "लाख": 100_000, "lakh": 100_000, "lakhs": 100_000,
    "करोड़": 10_000_000, "करोड": 10_000_000, "crore": 10_000_000, "crores": 10_000_000,
    "हजार": 1_000, "हज़ार": 1_000, "thousand": 1_000,
}

_MONTHS: Dict[str, int] = {
    "जनवरी": 1, "फरवरी": 2, "फ़रवरी": 2, "मार्च": 3, "अप्रैल": 4, "मई": 5, "जून": 6,
    "जुलाई": 7, "अगस्त": 8, "सितंबर": 9, "सितम्बर": 9, "अक्टूबर": 10, "अक्तूबर": 10,
    "नवंबर": 11, "नवम्बर": 11, "दिसंबर": 12, "दिसम्बर": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Quantities too common to be evidence of anything. Flagging "2 to 3 paragraphs"
# or a lone "1" would bury the real findings.
_TRIVIAL_VALUES = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100}


@dataclass
class ValidationReport:
    unsupported_numbers: List[str] = field(default_factory=list)
    unsupported_dates: List[str] = field(default_factory=list)
    # Facts whose only support is a chunk from a different video. Not invented,
    # but belonging to another story, which is worse in a way: they look
    # sourced.
    cross_video_numbers: List[str] = field(default_factory=list)
    # Words written against the ceiling content_length asked for. Checked on the
    # output for the same reason the figures are: the instruction is emphatic
    # and still loses. Measured on a live post, "Short -> 3-4 sentences (max 80
    # words)" produced 145 words in 3 paragraphs, because five other profile
    # fields each asked for something to be included and the model resolved the
    # conflict by dropping the only limit that was not content.
    word_count: int = 0
    word_limit: int = 0

    @property
    def over_length(self) -> bool:
        # A tenth of slack. Hindi word counts wobble with compounding and the
        # point is to catch a post at twice its budget, not one three words out.
        return bool(self.word_limit) and self.word_count > self.word_limit * 1.1

    @property
    def ok(self) -> bool:
        return not (
            self.unsupported_numbers
            or self.unsupported_dates
            or self.cross_video_numbers
            or self.over_length
        )

    def as_meta(self) -> Dict[str, Any]:
        return {
            "passed": self.ok,
            "retried": self.retried,
            "unsupported_numbers": self.unsupported_numbers,
            "unsupported_dates": self.unsupported_dates,
            "cross_video_numbers": self.cross_video_numbers,
            "word_count": self.word_count,
            "word_limit": self.word_limit,
            "over_length": self.over_length,
        }

    def as_correction_note(self) -> str:
        """A refinement instruction naming exactly what failed."""
        parts: List[str] = []
        if self.unsupported_numbers:
            parts.append(
                "These figures appear in your post but are not in the news article, "
                "the retrieved chunks, or the research brief: "
                + ", ".join(self.unsupported_numbers)
                + ". Remove them, or replace them with a figure that is actually in the material."
            )
        if self.unsupported_dates:
            parts.append(
                "These dates appear in your post but are not in the material: "
                + ", ".join(self.unsupported_dates)
                + ". Use only dates stated in the material, and attach each to the fact the "
                "material attaches it to. Never use today's date for a past event."
            )
        if self.cross_video_numbers:
            parts.append(
                "These figures come from a DIFFERENT video than the one this story is about: "
                + ", ".join(self.cross_video_numbers)
                + ". They belong to another event. Remove them entirely. Do not rework them into "
                "the post, and do not replace them with similar figures."
            )
        if self.over_length:
            parts.append(
                f"This post is {self.word_count} words against a ceiling of {self.word_limit}. "
                "Cut it to the ceiling. The length in the USER PROFILE outranks every field that "
                "asks for material to be included: drop the Ambedkar quote, the historical "
                "reference, the statistic and the legal note in that order until it fits, and keep "
                "the accusation and the demand, which are the post. Do not summarise it into "
                "something blander, and do not truncate it mid-sentence."
            )
            parts.append("Keep the voice and the argument. Change only what is listed.")
        else:
            parts.append("Keep everything else, including the voice and the length. Change only what is listed.")
        return " ".join(parts)


def _normalise(text: str) -> str:
    return (text or "").translate(_DEVANAGARI_DIGITS).lower()


def _scaled_values(text: str, *, tolerant: bool = False) -> set[int]:
    """
    Every quantity a text asserts, as plain integers.

    `tolerant` widens the set with rounded forms and is used only when reading
    the SOURCE material: a brief saying "302.222 km" should license a post
    saying "302". It is off when reading the post itself, so one figure there
    yields one value and a single error is reported once.

    "2 lakh", "दो लाख" and "200000" all reduce to 200000, so a figure written one
    way in the brief still matches the other way in the post.
    """
    norm = _normalise(text)
    values: set[int] = set()

    # Bare numbers, commas stripped: 4,000 -> 4000. The lookarounds keep "4.68"
    # whole rather than yielding a phantom 4 and 68; a decimal on its own is
    # never a claim, it only means something with the scale word that follows,
    # which the next pass handles.
    for raw in re.findall(r"(?<![\d.])\d[\d,]*(?:\.\d+)?(?![\d.])", norm):
        digits = raw.replace(",", "")
        if digits.isdigit():
            values.add(int(digits))
        elif tolerant:
            # A decimal in the source also licenses its rounded form in the
            # post. "302.222 km" in the brief and "302 किलोमीटर" in the post are
            # the same fact, and flagging the second as invented is wrong.
            try:
                values.add(int(float(digits)))
            except ValueError:
                continue

    scale_alt = "|".join(sorted(map(re.escape, _SCALES), key=len, reverse=True))

    # Digit followed by a scale word: "2 lakh", "4.68 करोड़"
    for num, scale in re.findall(rf"(\d[\d,]*(?:\.\d+)?)\s*({scale_alt})", norm):
        try:
            base = float(num.replace(",", ""))
        except ValueError:
            continue
        values.add(int(round(base * _SCALES[scale])))
        if tolerant:
            # "11,526.73 crores" also licenses "11,526 करोड़": same figure, rounded.
            values.add(int(base) * _SCALES[scale])

    # Hindi word followed by a scale word: "दो लाख"
    word_alt = "|".join(sorted(map(re.escape, _HINDI_UNITS), key=len, reverse=True))
    for word, scale in re.findall(rf"({word_alt})\s*({scale_alt})", norm):
        values.add(_HINDI_UNITS[word] * _SCALES[scale])

    return values


def _dates(text: str) -> set[tuple[int, int]]:
    """
    Day and month pairs, plus month and year pairs, as the post states them.

    Bare years are ignored: a post can reasonably mention a year that the brief
    only implies, and flagging every one would drown the real errors.
    """
    norm = _normalise(text)
    found: set[tuple[int, int]] = set()
    month_alt = "|".join(sorted(map(re.escape, _MONTHS), key=len, reverse=True))

    # "16 फरवरी", "16 february". The (?!\d) guard stops a year being read as a
    # day: without it "अक्टूबर 2023" yields a spurious 20 October.
    for day, month in re.findall(rf"(?<!\d)(\d{{1,2}})(?!\d)\s+({month_alt})", norm):
        found.add((int(day), _MONTHS[month]))
    # "february 16"
    for month, day in re.findall(rf"({month_alt})\s+(?<!\d)(\d{{1,2}})(?!\d)", norm):
        found.add((int(day), _MONTHS[month]))
    # "फरवरी 2023" recorded as (0, month) so a month/year mention is still compared
    for month, _year in re.findall(rf"({month_alt})\s+(\d{{4}})", norm):
        found.add((0, _MONTHS[month]))
    return found


def _strip_hashtags(text: str) -> str:
    """Hashtags carry digits that are styling, not claims."""
    return re.sub(r"#\S+", " ", text or "")



_WORD_CEILING_RE = re.compile(r"(\d{2,4})\s*words", re.I)


def _word_ceiling(content_length: str) -> int:
    """
    The word ceiling named in a content_length option, or 0 when it names none.

    The stored options carry their own limits - "Short -> 3-4 sentences (max 80
    words)", "Medium -> 4-6 sentences (80-150 words)" - so the ceiling is read
    from the option rather than kept in a second table here that would drift
    from it. A range takes its upper bound, which is what "80-150 words" means.
    """
    text = str(content_length or "")
    numbers = [int(n) for n in _WORD_CEILING_RE.findall(text)]
    if numbers:
        return max(numbers)
    # "150-250 words" puts the range before the word, so the regex above sees
    # only the second number. Catch the pair explicitly.
    pair = re.search(r"(\d{2,4})\s*[-–]\s*(\d{2,4})\s*words", text, re.I)
    return int(pair.group(2)) if pair else 0


def _body_word_count(body: str) -> int:
    """Words in the post itself, excluding the labels the format requires."""
    stripped = re.sub(r"^(Headline|Social Media Post|Hashtags)\s*:.*$", "", body, flags=re.M)
    return len([w for w in stripped.split() if w.strip()])


def validate_post(
    post: str,
    *,
    sources: Sequence[str],
    other_video_sources: Sequence[str] = (),
    content_length: str = "",
) -> ValidationReport:
    """
    Compare the post's quantities and dates against everything it was given.

    `sources` is material the post may draw facts from: the news article, the
    story's own video transcript, and the research brief.

    `other_video_sources` is chunk text retrieved from different videos. Those
    are legitimate for framing and unusable as evidence, so a figure whose only
    support is in there is reported separately: it is not invented, it simply
    belongs to another story.
    """
    report = ValidationReport()
    if not post or not post.strip():
        return report

    body = _strip_hashtags(post)

    # Length, against whatever ceiling content_length names.
    report.word_limit = _word_ceiling(content_length)
    if report.word_limit:
        report.word_count = _body_word_count(body)
    haystack = "\n".join(s for s in sources if s)
    foreign = "\n".join(s for s in other_video_sources if s)

    known_values = _scaled_values(haystack, tolerant=True)
    foreign_values = _scaled_values(foreign, tolerant=True) - known_values
    for value in sorted(_scaled_values(body)):
        if value in _TRIVIAL_VALUES or value in known_values:
            continue
        # A four digit number that reads as a year is usually context, not a claim.
        if 1900 <= value <= 2100:
            continue
        if value in foreign_values:
            report.cross_video_numbers.append(f"{value:,}")
            continue
        report.unsupported_numbers.append(f"{value:,}")

    known_dates = _dates(haystack)
    month_names = {v: k for k, v in _MONTHS.items() if k.isascii()}
    post_dates = _dates(body)
    flagged_months = {m for d, m in post_dates if d and (d, m) not in known_dates}
    for day, month in sorted(post_dates):
        if (day, month) in known_dates:
            continue
        # A month with no day is only flagged when the material never mentions
        # that month at all, and when the specific date was not already flagged.
        # Otherwise "3 October" and "October" report the same error twice.
        if day == 0 and (any(m == month for _, m in known_dates) or month in flagged_months):
            continue
        label = f"{day} {month_names.get(month, month)}" if day else month_names.get(month, str(month))
        report.unsupported_dates.append(label)

    return report

"""
AWS Batch entry point: build one party's daily radio bulletin.

    python -m backend.worker.build_radio --tenant congress
    python -m backend.worker.build_radio --tenant congress --date 2026-10-04

Bheem Radio does the work - it reads the day's stories straight out of our own
`news` collection, has DeepSeek write them for the ear, has a second model
fact-check each script against its source, voices them, and mixes one looped
MP3 per party per day into `s3://<bucket>/radio/<tenant>/`.

This module only maps our environment onto its settings and turns the result
into an exit code Batch understands:

    0   published, or skipped because the party had no news today. A skip is
        not a failure: yesterday's bulletin stays on air, which is better than
        silence and better than a job that goes red every quiet Sunday.
    1   the build failed, so the Batch job goes FAILED and the alarm fires.

Based on `integration/ambedkargpt/build_radio.py` from the Bheem Radio repo,
with our own variable names: the names in that template are the ones it
guessed we used, and most of them are not.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

log = logging.getLogger("build_radio")


# Bheem Radio reads BHEEM_*; our worker already holds the same secrets under
# its own names, injected by the Batch job definition's `secrets` block from
# SSM. Copied across rather than duplicated in SSM under a second name, so
# there is one place to rotate a key.
#
# Their template aliases MONGO_URI and ARTIFACTS_BUCKET. We have neither: ours
# are MONGODB_URI and S3_BUCKET.
ENV_ALIASES = {
    "BHEEM_MONGO_URI": "MONGODB_URI",
    "BHEEM_MONGO_DB": "MONGODB_DATABASE",
    "BHEEM_DEEPSEEK_API_KEY": "DEEPSEEK_API_KEY",
    "BHEEM_GEMINI_API_KEY": "GEMINI_API_KEY",
    "BHEEM_SARVAM_API_KEY": "SARVAM_API_KEY",
    "BHEEM_S3_BUCKET": "S3_BUCKET",
}

# Fixed choices for this deployment. Any BHEEM_* set on the job definition
# wins, because these are only defaults.
DEFAULTS = {
    "BHEEM_STORAGE_BACKEND": "s3",
    "BHEEM_DAILY_S3_PREFIX": "radio/",
    # Same model the rest of the app writes with, so the radio sounds like
    # the product rather than like a second system. Note that deepseek-chat
    # is a retired alias (it points at V4-Flash since 24 July 2026) - the
    # whole codebase still names it, and when that is fixed project-wide
    # this line has to move with it.
    "BHEEM_LLM_SCRIPT_WRITER": "deepseek:deepseek-chat",
    "BHEEM_LLM_SCRIPT_WRITER_FALLBACK": "",
    "BHEEM_LANGUAGES": "hi",
    "BHEEM_TIMEZONE": "Asia/Kolkata",
    # Copied into the worker image by Dockerfile.worker.
    "BHEEM_ASSETS_DIR": "/opt/bheem-radio/assets",
    "BHEEM_PROMPTS_DIR": "/opt/bheem-radio/prompts",
    # Scratch space for mixing. The container disk is thrown away afterwards.
    "BHEEM_DATA_DIR": "/tmp/bheem-radio",
    # The whole mapping, not just the part we change. A dict setting read
    # from the environment REPLACES the default - pydantic does not merge -
    # so sending only the one override would drop tenant_slug and news_id
    # with it and every build would find zero stories.
    #
    # The only line that differs from their default is `body`. We have no
    # `body` field; `description` is a second, fuller paragraph that would
    # otherwise go unread, because their `summary or description` fallback
    # stops at our summary.
    "BHEEM_MONGO_FIELDS": json.dumps({
        "id": "news_id",
        "tenant": "tenant_slug",
        "status": "status",
        "title": "headline",
        "summary": "summary",
        "description": "description",
        "body": "description",          # <- ours
        "published_at": "published_at",
        "story_type": "content_type",
        "sources": "sources",
        "source_name": "source_name",
        "source_url": "source_url",
    }),
    # The anchor's voice. Whole dict again, and for the same reason as
    # BHEEM_MONGO_FIELDS above: sending only {"sarvam": ...} would drop every
    # other provider's voice, so the Gemini fallback would have no speaker and
    # a day without Sarvam would fail instead of degrading.
    #
    # The one line that differs from their default is `sarvam`: shreya rather
    # than shubh. Sarvam's speaker names are case-sensitive and lowercase.
    #
    # Pinning the rest has a cost worth naming: if Bheem Radio changes a
    # default voice upstream we keep the old one until this is edited.
    "BHEEM_TTS_VOICES": json.dumps({
        "minimax": {"hi": "English_Persuasive_Man", "en": "English_Persuasive_Man"},
        "selfhosted": {"hi": "agastya", "en": "agastya"},
        "gemini": {"hi": "Charon", "en": "Charon"},
        "sarvam": {"hi": "ritu", "en": "ritu"},         # <- ours
        "openai": {"hi": "onyx", "en": "onyx"},
        "fake": {"hi": "tone", "en": "tone"},
    }),
    # Delivery, chosen by ear from a set of auditions rather than from the
    # catalogue: ritu read faster and with more lift than the rest.
    #
    # Expressiveness is at its ceiling. Bheem Radio's own config says the range
    # is 0.01-2.0; the live API rejects anything above 1.0, so 1.0 is as lively
    # as a stock voice gets and the reader has to supply the rest.
    "BHEEM_SARVAM_PACE": "1.22",
    "BHEEM_SARVAM_TEMPERATURE": "1.0",
    # One bulletin covering every party, dealt in turns - see RoundRobinSource.
    # The order is the order of the first round.
    "RADIO_POOL": "congress,bjp,samajwadi,general",

    # Today only. Measured on 7 October 2026: one day is 56 stories, about an
    # hour of speech; two days is 131, which is two hours twenty and well past
    # what anyone will sit through.
    "BHEEM_DAILY_LOOKBACK_DAYS": "1",

    # The ceiling, not the target. A story runs about 65 seconds, so 80 is
    # roughly 87 minutes - the top of the hour-to-ninety-minutes the bulletin
    # is meant to fill. A quiet day simply comes in shorter.
    "BHEEM_DAILY_MAX_STORIES": "80",
    # Not applicable here: General is dealt in turn with everyone else rather
    # than folded in afterwards, so the separate quota would cap it twice.
    "BHEEM_DAILY_MAX_GENERAL_STORIES": "80",

    # BHEEM_MONGO_LIVE_STATUSES is deliberately not set. Our documents have no
    # status field, and Bheem's default of [] already means "no filter". Any
    # value here would match nothing and build four empty bulletins.
}


def _tts_defaults() -> None:
    """
    Pick the voice and the fact-checker from the keys that are actually set.

    Sarvam is the intended voice and the only one that can clone. Until that
    subscription exists the build still has to run, so it falls back to Gemini,
    whose key we already hold - a stock voice is worth having while the cloned
    one is being licensed.

    The fact-checker is deliberately a different model from the writer, so it
    does not share the writer's blind spots about what it just made up.
    """
    if os.environ.get("BHEEM_SARVAM_API_KEY"):
        os.environ.setdefault("BHEEM_TTS_PRIMARY", "sarvam:bulbul:v3")
        os.environ.setdefault("BHEEM_TTS_FALLBACK", "gemini:gemini-3.8-flash-lite-tts")
    else:
        log.warning("No Sarvam key: voicing with Gemini and a stock voice.")
        os.environ.setdefault("BHEEM_TTS_PRIMARY", "gemini:gemini-3.8-flash-lite-tts")
        os.environ.setdefault("BHEEM_TTS_FALLBACK", "")

    if os.environ.get("BHEEM_GEMINI_API_KEY"):
        os.environ.setdefault("BHEEM_LLM_FACT_CHECKER", "gemini:gemini-3.1-flash-lite")
        os.environ.setdefault("BHEEM_LLM_FACT_CHECKER_FALLBACK", "deepseek:deepseek-chat")
    else:
        os.environ.setdefault("BHEEM_LLM_FACT_CHECKER", "deepseek:deepseek-chat")
        os.environ.setdefault("BHEEM_LLM_FACT_CHECKER_FALLBACK", "")


class RoundRobinSource:
    """
    Every party's news in one bulletin, taken in turns.

    Bheem Radio builds one stream per tenant and `select_stories` concatenates
    whole tenant blocks, so a combined bulletin would have run all of Congress,
    then all of BJP, and whatever the length cap cut would have fallen entirely
    on whoever came last. On a day with 58 Congress and 65 BJP stories that is
    not an ordering problem, it is one party missing.

    So this stands in front of their Mongo source and answers the one stream we
    build with a deal: one story from each party in turn, skipping the ones
    that have run out, until everything is dealt. Each party's own stories stay
    newest-first within its own turn, and a short cap now takes proportionally
    from everyone rather than wholly from the last.

    It is a wrapper rather than an edit to their selection, so moving the
    pinned Bheem Radio commit does not have to be re-done afterwards.
    """

    def __init__(self, inner, order: list[str]) -> None:
        self._inner = inner
        self._order = order

    def stories(self, tenant: str, start, end):
        # Only the stream we actually build is combined. Anything else is
        # passed through, so building one party's own stream still works.
        if tenant not in self._order:
            return self._inner.stories(tenant, start, end)

        queues = []
        for member in self._order:
            found = self._inner.stories(member, start, end)
            if found:
                queues.append(list(found))
            log.info("pool %s: %d stories", member, len(found))

        dealt, seen = [], set()
        while queues:
            for queue in list(queues):
                story = queue.pop(0)
                # A story tagged for two tenants would otherwise play twice.
                if story.id not in seen:
                    seen.add(story.id)
                    dealt.append(story)
                if not queue:
                    queues.remove(queue)
        log.info("combined bulletin: %d stories, dealt in turns", len(dealt))
        return dealt


def prepare_environment() -> None:
    """Copy our variables onto the BHEEM_* names and fill in the defaults."""
    for target, source in ENV_ALIASES.items():
        if not os.environ.get(target) and os.environ.get(source):
            os.environ[target] = os.environ[source]
    for name, value in DEFAULTS.items():
        os.environ.setdefault(name, value)
    _tts_defaults()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build one party's daily radio bulletin")
    # Batch passes this as a job parameter (Ref::tenant in the job definition).
    parser.add_argument("--tenant", default=os.environ.get("RADIO_TENANT"))
    parser.add_argument("--date", help="YYYY-MM-DD, default today in IST")
    args = parser.parse_args(argv)

    prepare_environment()

    # Imported after the environment is prepared: Settings reads it at
    # construction, and bheem_radio is only present in the worker image, so a
    # module-level import would break every other use of this package.
    from bheem_radio.config import Settings
    from bheem_radio.daily.builder import build_daily_services, build_tenant_stream
    from bheem_radio.daily.sources import MongoStorySource
    from bheem_radio.logging_setup import configure_logging

    settings = Settings(_env_file=None)
    configure_logging(settings.log_level)

    if not args.tenant:
        parser.error("--tenant (or RADIO_TENANT) is required")
    if args.tenant not in settings.daily_tenants:
        parser.error(f"unknown tenant {args.tenant!r}; expected one of {settings.daily_tenants}")

    day = (date.fromisoformat(args.date) if args.date
           else datetime.now(ZoneInfo(settings.timezone)).date())

    source = MongoStorySource.from_settings(settings)
    pool = [t.strip() for t in (os.getenv("RADIO_POOL") or "").split(",") if t.strip()]
    if pool:
        source = RoundRobinSource(source, pool)

    services = build_daily_services(settings, source)
    result = build_tenant_stream(args.tenant, day, services)

    stats = services.cache.stats
    log.info("radio %s %s: %s, %d stories, %.0f s; %d TTS characters, %d clips reused",
             result.tenant, result.day, result.status, result.stories, result.duration_sec,
             stats.tts_characters, stats.audio_hits)
    for problem in result.dropped:
        log.warning("dropped %s", problem)
    if result.error:
        log.log(logging.ERROR if result.status == "failed" else logging.WARNING,
                "%s", result.error)
    return 1 if result.status == "failed" else 0


if __name__ == "__main__":
    sys.exit(main())

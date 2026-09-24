"""
Which videos the pipeline has already taken in.

`processed.json` is the pipeline's record of what it has ingested, and reading
it is the one thing the watcher needs from the ingestion side. `backend.Fetch`
has a `load_processed` that does this, but importing it costs yt-dlp,
youtube-transcript-api and python-docx — none of which a watcher, a Lambda or a
test has any use for.

So the parsing lives here, where it is a few lines of json and nothing else, and
both the local watcher and the S3 reader use it. Same format, one place.

The file is a list, holding either objects with an `id` or bare id strings; both
shapes are in the existing data.
"""
from __future__ import annotations

import json
from pathlib import Path


def ids_from_payload(data: object) -> set[str]:
    """The video ids in an already-parsed processed.json."""
    if not isinstance(data, list):
        return set()
    ids: set[str] = set()
    for item in data:
        video_id = item.get("id") if isinstance(item, dict) else item
        if video_id:
            ids.add(str(video_id))
    return ids


def ids_from_file(path: Path) -> set[str]:
    """
    The video ids recorded at this path, or an empty set.

    An absent file is the normal first run for a channel, and an unreadable one
    should not stop a watcher — both mean "nothing known to be ingested", which
    is the safe answer: the pipeline itself checks again before fetching.
    """
    try:
        return ids_from_payload(json.loads(Path(path).read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return set()

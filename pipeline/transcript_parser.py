from typing import List, Dict


def parse_transcripts(raw_text: str) -> List[Dict[str, str]]:
    """
    Parse the Ravish Kumar transcript dataset from a single text blob.

    Expected format:

    ===== VIDEO TITLE =====
    VIDEO TITLE
    Link: https://youtube_link
    Published (UTC): <optional ISO8601>
    Upload date: <optional YYYYMMDD>
    <transcript text>

    Returns:
    videos = [
      {
        "video_title": "...",
        "video_link": "...",
        "full_text": "...",
        optional "upload_datetime_utc", "upload_date"
      }
    ]
    """
    videos: List[Dict[str, str]] = []

    lines = raw_text.splitlines()
    current_title: str | None = None
    current_link: str | None = None
    current_text_lines: List[str] = []
    seen_header_title_line = False
    current_upload_date: str | None = None
    current_upload_utc: str | None = None

    def flush_current() -> None:
        nonlocal current_title, current_link, current_text_lines, seen_header_title_line
        nonlocal current_upload_date, current_upload_utc
        if current_title and current_link and current_text_lines:
            full_text = "\n".join(current_text_lines).strip()
            if full_text:
                entry: Dict[str, str] = {
                    "video_title": current_title.strip(),
                    "video_link": current_link.strip(),
                    "full_text": full_text,
                }
                if current_upload_utc:
                    entry["upload_datetime_utc"] = current_upload_utc.strip()
                if current_upload_date:
                    entry["upload_date"] = current_upload_date.strip()
                videos.append(entry)
        current_title = None
        current_link = None
        current_text_lines = []
        seen_header_title_line = False
        current_upload_date = None
        current_upload_utc = None

    for line in lines:
        stripped = line.strip()

        # Header marker
        if stripped.startswith("=====") and stripped.endswith("====="):
            flush_current()
            # Title is between the markers
            current_title = stripped.strip("=").strip()
            seen_header_title_line = True
            continue

        if current_title and seen_header_title_line and stripped.startswith("Link:"):
            # Link line follows the header/title block
            _, _, link_value = stripped.partition("Link:")
            current_link = link_value.strip()
            seen_header_title_line = False
            continue

        # Optional metadata after Link (not part of transcript body)
        if current_title and current_link and stripped:
            low = stripped.lower()
            if low.startswith("published (utc):"):
                _, _, rest = stripped.partition(":")
                current_upload_utc = rest.strip()
                continue
            if low.startswith("upload date:"):
                _, _, rest = stripped.partition(":")
                current_upload_date = rest.strip()
                continue

        # Skip duplicate title line after header if present
        if current_title and stripped == current_title:
            continue

        if current_title:
            current_text_lines.append(line)

    flush_current()
    return videos

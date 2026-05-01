from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


def _hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _compare(path_a: Path, path_b: Path) -> tuple[bool, str]:
    if not path_a.exists() or not path_b.exists():
        return False, "missing"
    return (_hash_file(path_a) == _hash_file(path_b), "ok")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare legacy vs orchestrator output artifacts.")
    parser.add_argument("--legacy-generated-news", required=True)
    parser.add_argument("--orchestrator-generated-news", required=True)
    parser.add_argument("--legacy-video-summaries", required=True)
    parser.add_argument("--orchestrator-video-summaries", required=True)
    args = parser.parse_args()

    pairs = [
        (Path(args.legacy_generated_news), Path(args.orchestrator_generated_news), "generated_news"),
        (Path(args.legacy_video_summaries), Path(args.orchestrator_video_summaries), "video_summaries"),
    ]
    failed = False
    for old_path, new_path, label in pairs:
        same, status = _compare(old_path, new_path)
        if status == "missing":
            print(f"{label}: missing file(s)")
            failed = True
            continue
        print(f"{label}: {'match' if same else 'diff'}")
        if not same:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import get_settings
from semrag.search_modes import run_semrag_search


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run SEMRAG global graph search.")
    parser.add_argument("query", type=str, help="Query text")
    parser.add_argument("--top-k", type=int, default=10, help="Top chunks to print")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = get_settings()
    out = run_semrag_search(
        query_text=args.query,
        settings=settings,
        mode="global",
        top_k=max(1, int(args.top_k)),
    )
    entities = out.get("query_extraction", {}).get("entities", [])
    print(f"mode={out['mode']} entities={len(entities)} results={len(out['results'])}")
    for row in out["results"]:
        snippet = row["chunk_text"][:180].replace("\n", " ")
        print(
            "rank={rank} chunk_id={chunk_id} score={score:.4f} title={title}\n  {snippet}".format(
                rank=row["rank"],
                chunk_id=row["chunk_id"],
                score=row["score"],
                title=row["video_title"],
                snippet=snippet,
            )
        )


if __name__ == "__main__":
    main()

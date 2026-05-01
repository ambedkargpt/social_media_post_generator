import argparse
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import get_settings
from semrag.search_modes import run_semrag_search

LATEST_RESULTS_PATH = ROOT_DIR / "data" / "semrag" / "temp_semrag_search_results.json"


def _pick_mode() -> str:
    mode_map = {"1": "local", "2": "global", "3": "hybrid"}
    while True:
        print("\nChoose SEMRAG search mode:")
        print("  1 - local")
        print("  2 - global")
        print("  3 - hybrid")
        raw = input("Enter 1/2/3 (or local/global/hybrid): ").strip().lower()
        if raw in mode_map:
            return mode_map[raw]
        if raw in {"local", "global", "hybrid"}:
            return raw
        print("Invalid mode, try again.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Interactive SEMRAG search CLI.")
    parser.add_argument("--query", type=str, default="", help="Optional query. If omitted, prompt interactively.")
    parser.add_argument("--top-k", type=int, default=10, help="Top chunks to print")
    return parser.parse_args()


def _print_results(result: dict) -> None:
    extraction = result.get("query_extraction", {}) or {}
    entities = extraction.get("entities", []) or []
    relations = extraction.get("relations", []) or []
    print(
        "mode={mode} entities={entities} relations={relations} results={results}".format(
            mode=result.get("mode", ""),
            entities=len(entities),
            relations=len(relations),
            results=len(result.get("results", [])),
        )
    )
    for row in result.get("results", []):
        snippet = str(row.get("chunk_text", ""))[:180].replace("\n", " ")
        print(
            "rank={rank} chunk_id={chunk_id} score={score:.4f} title={title}\n  {snippet}".format(
                rank=row.get("rank", 0),
                chunk_id=row.get("chunk_id", ""),
                score=float(row.get("score", 0.0)),
                title=row.get("video_title", ""),
                snippet=snippet,
            )
        )


def _write_latest_results(result: dict) -> None:
    LATEST_RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "mode": result.get("mode", ""),
        "query": result.get("query", ""),
        "query_extraction": result.get("query_extraction", {}),
        "results": result.get("results", []),
    }
    LATEST_RESULTS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved latest results to: {LATEST_RESULTS_PATH}")


def main() -> None:
    args = parse_args()
    settings = get_settings()
    while True:
        query = args.query.strip() if args.query else input("\nEnter query (or blank to exit): ").strip()
        if not query:
            print("Exiting.")
            return
        mode = _pick_mode()
        result = run_semrag_search(
            query_text=query,
            settings=settings,
            mode=mode,
            top_k=max(1, int(args.top_k)),
        )
        _print_results(result)
        _write_latest_results(result)
        again = input("\nRun another query? (y/n): ").strip().lower()
        if again not in {"y", "yes"}:
            return
        args.query = ""


if __name__ == "__main__":
    main()

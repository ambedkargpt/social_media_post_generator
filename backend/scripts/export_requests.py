"""
Turn a research trace into ready-to-send API request bodies.

Every LLM call the pipeline makes is traced with its exact system and user
message. This rebuilds those calls as JSON bodies you can paste straight into
Postman, Insomnia or curl, so each stage can be re-run and tweaked by hand
without touching the app.

    python -m backend.scripts.export_requests                 # newest trace
    python -m backend.scripts.export_requests --run 2
    python -m backend.scripts.export_requests --out requests/
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.core.config import settings

STAGES = [
    ("01_research_angles", "01x_claim_prompt_system.txt", "01x_claim_prompt_user.txt", 8000, 0.2),
    ("02_corroboration_claim1", "01x_factcheck_prompt_system.txt", "01x_factcheck_prompt_user.txt", 16000, 0.1),
    ("03_corroboration_claim2", "02x_factcheck_prompt_system.txt", "02x_factcheck_prompt_user.txt", 16000, 0.1),
    ("04_corroboration_claim3", "03x_factcheck_prompt_system.txt", "03x_factcheck_prompt_user.txt", 16000, 0.1),
]


def body(system: str, user: str, model: str, max_tokens: int, temperature: float) -> dict:
    return {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--run", type=int, default=1, help="1 = newest trace")
    ap.add_argument("--out", default="backend/outputs/postman")
    args = ap.parse_args()

    base = settings.web_research_debug_dir
    if not base:
        print("WEB_RESEARCH_DEBUG_DIR is not set; nothing to export.")
        return 1
    runs = sorted((p for p in Path(base).iterdir() if p.is_dir()), key=lambda p: p.name, reverse=True)
    if not runs or args.run > len(runs):
        print("No such run. Generate a post first.")
        return 1
    run = runs[args.run - 1]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    written = []
    for name, sys_f, usr_f, cap, temp in STAGES:
        sp, up = run / sys_f, run / usr_f
        if not (sp.is_file() and up.is_file()):
            continue
        b = body(sp.read_text(encoding="utf-8"), up.read_text(encoding="utf-8"),
                 settings.research_model, cap, temp)
        f = out / f"{name}.json"
        f.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8")
        written.append(f)

    # The searches, as plain URLs
    lines = []
    for i in range(1, 6):
        s = run / f"{i:02d}a_search.json"
        if s.is_file():
            q = json.loads(s.read_text(encoding="utf-8"))["query"]
            lines.append(f"GET {settings.searxng_url}/search?format=json&q={q}")
    if lines:
        f = out / "00_searxng_urls.txt"
        f.write_text("\n".join(lines), encoding="utf-8")
        written.append(f)

    readme = out / "README.txt"
    readme.write_text(
        "Replaying this run by hand\n"
        "==========================\n\n"
        f"Trace: {run.name}\n\n"
        "1. SEARCH  (no auth)\n"
        "   The URLs in 00_searxng_urls.txt. Paste into a browser or Postman GET.\n\n"
        "2. LLM CALLS  (POST https://api.deepseek.com/chat/completions)\n"
        "   Headers:\n"
        "     Authorization: Bearer <DEEPSEEK_API_KEY>\n"
        "     Content-Type: application/json\n"
        "   Body: the contents of each 0*.json file, in order.\n\n"
        "   01_research_angles      -> which angles to look up, and the search queries\n"
        "   02..04_corroboration_*  -> what the pages establish for each angle\n\n"
        "3. POST GENERATION\n"
        "   Bodies are large; take the system and user message from the trace folder\n"
        "   directly. The user message is the JSON payload the writer receives.\n\n"
        "Edit any prompt in the body and re-send to see the effect. Nothing here\n"
        "touches the app or the database.\n",
        encoding="utf-8",
    )
    written.append(readme)

    print(f"exported from {run.name}:\n")
    for f in written:
        print(f"  {f}  ({f.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())

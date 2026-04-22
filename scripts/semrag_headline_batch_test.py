import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import get_settings
from semrag.build import extract_query_entities, extraction_chat_client
from semrag.retriever import semrag_global_rank_chunks, semrag_hybrid_rank_chunks, semrag_local_rank_chunks
from semrag.store import load_semrag_graph


DEFAULT_OUTPUT_PATH = ROOT_DIR / "data" / "semrag" / "semrag_headline_batch_test_results.json"

TEST_CASES: List[Dict[str, str]] = [
    {
        "id": "case_01",
        "headline": "एपस्टीन फाइल्स पर नए दावे, वैश्विक राजनीति में मची हलचल",
        "subheadline": "Jeffrey Epstein से जुड़े दस्तावेजों पर नए खुलासों के बाद कई प्रभावशाली नाम चर्चा में, अंतरराष्ट्रीय स्तर पर बहस तेज हो गई।",
    },
    {
        "id": "case_02",
        "headline": "नोएडा नाले में डूबकर युवराज मेहता की दर्दनाक मौत",
        "subheadline": "नोएडा के नाले में डूबने से युवराज मेहता की मौत के बाद इलाके में शोक, प्रशासन पर लापरवाही के आरोप लगाए गए।",
    },
    {
        "id": "case_03",
        "headline": "मुस्लिम छात्र के समर्थन में धरना, प्रदर्शन हुआ तेज",
        "subheadline": "मुस्लिम छात्र से जुड़े विवाद के बाद विभिन्न संगठनों ने धरना प्रदर्शन शुरू किया, मामले में निष्पक्ष जांच की मांग उठी।",
    },
    {
        "id": "case_04",
        "headline": "यूट्यूब चैनल बंद होने पर क्रिएटर्स में बढ़ा आक्रोश",
        "subheadline": "लोकप्रिय यूट्यूब चैनल बंद किए जाने के बाद डिजिटल जगत में नाराजगी, कई क्रिएटर्स ने पारदर्शिता की मांग उठाई।",
    },
    {
        "id": "case_05",
        "headline": "ईडी और आईटी छापों से राजनीतिक माहौल गरमाया",
        "subheadline": "Enforcement Directorate और आयकर विभाग की छापेमारी के बाद सियासी बयानबाजी तेज, विपक्ष ने कार्रवाई पर सवाल उठाए।",
    },
    {
        "id": "case_06",
        "headline": "बंगाल में कांग्रेस का वर्चस्व, चुनावी समीकरण बदले",
        "subheadline": "Indian National Congress के बढ़ते प्रभाव से बंगाल की राजनीति में नए समीकरण बनते दिखे, अन्य दलों की चिंता बढ़ी।",
    },
    {
        "id": "case_07",
        "headline": "महिला आरक्षण पर फिर गरमाई राजनीति, बहस तेज",
        "subheadline": "महिला आरक्षण को लेकर संसद से सड़क तक बहस तेज, विभिन्न दलों ने अपने-अपने पक्ष को मजबूती से रखा।",
    },
    {
        "id": "case_08",
        "headline": "गिरते रुपये ने बढ़ाई चिंता, अर्थव्यवस्था पर दबाव",
        "subheadline": "रुपये की कमजोरी से आयात महंगा होने का खतरा बढ़ा, आम जनता और व्यापारियों की चिंताएं गहराने लगीं।",
    },
    {
        "id": "case_09",
        "headline": "सोना-चांदी में उतार-चढ़ाव, निवेशकों की नजर बाजार पर",
        "subheadline": "Gold और चांदी की कीमतों में लगातार बदलाव से निवेशकों में सतर्कता, बाजार विशेषज्ञों ने संयम बरतने की सलाह दी।",
    },
    {
        "id": "case_10",
        "headline": "पैसे दो वोट लो, बंगाल चुनाव में आरोपों की बौछार",
        "subheadline": "बंगाल चुनाव के बीच वोट खरीदने के आरोपों ने सियासी माहौल गरमाया, चुनाव आयोग से सख्त कार्रवाई की मांग उठी।",
    },
    {
        "id": "case_11",
        "headline": "पंजाब में बाढ़ से तबाही, कई इलाके जलमग्न हुए",
        "subheadline": "Punjab में भारी बारिश के बाद बाढ़ जैसे हालात बने, हजारों लोग प्रभावित और राहत कार्य तेज किए गए।",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run SEMRAG local/global/hybrid tests on predefined headline cases.")
    parser.add_argument("--top-k", type=int, default=10, help="Top chunks per mode.")
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_OUTPUT_PATH),
        help="Output JSON file path.",
    )
    return parser.parse_args()


def _summarize_mode_result(mode_result: Dict) -> Dict:
    extraction = mode_result.get("query_extraction", {}) or {}
    entities = extraction.get("entities", []) or []
    relations = extraction.get("relations", []) or []
    rows = mode_result.get("results", []) or []
    return {
        "mode": mode_result.get("mode", ""),
        "entity_count": len(entities),
        "relation_count": len(relations),
        "result_count": len(rows),
        "top_results": [
            {
                "rank": r.get("rank", 0),
                "chunk_id": r.get("chunk_id", ""),
                "score": float(r.get("score", 0.0)),
                "video_title": r.get("video_title", ""),
            }
            for r in rows[:5]
        ],
        "query_extraction": extraction,
    }


def _chunk_index(chunks_path: Path) -> Dict[str, Dict]:
    payload = json.loads(chunks_path.read_text(encoding="utf-8"))
    out: Dict[str, Dict] = {}
    for row in payload:
        chunk_id = str(row.get("chunk_id") or "").strip()
        if chunk_id:
            out[chunk_id] = row
    return out


def _rows_from_ranked(ranked: List, chunks_by_id: Dict[str, Dict], mode: str) -> Dict:
    rows = []
    for rank, (chunk_id, score) in enumerate(ranked, start=1):
        chunk = chunks_by_id.get(str(chunk_id), {})
        rows.append(
            {
                "rank": rank,
                "chunk_id": str(chunk_id),
                "score": float(score),
                "video_title": str(chunk.get("video_title") or ""),
                "video_link": str(chunk.get("video_link") or ""),
                "chunk_text": str(chunk.get("chunk_text") or ""),
            }
        )
    return {"mode": mode, "results": rows}


def main() -> None:
    args = parse_args()
    settings = get_settings()
    top_k = max(1, int(args.top_k))
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    graph = load_semrag_graph(settings.semrag_graph_path)
    chunks_by_id = _chunk_index(settings.semrag_chunks_path)
    client = extraction_chat_client(settings)

    report_cases = []
    pbar = tqdm(TEST_CASES, desc="SEMRAG headline batch test", unit="case")
    for case in pbar:
        query = f"{case['headline']} {case['subheadline']}".strip()
        query_extraction = extract_query_entities(
            client,
            model=settings.semrag_model,
            prompts_dir=settings.prompts_dir,
            query_text=query,
        )

        local_ranked = semrag_local_rank_chunks(graph, query_extraction, top_n=top_k)
        global_ranked = semrag_global_rank_chunks(graph, query_extraction, top_n=top_k)
        hybrid_ranked = semrag_hybrid_rank_chunks(graph, query_extraction, top_n=top_k)

        local = _rows_from_ranked(local_ranked, chunks_by_id, "local")
        global_ = _rows_from_ranked(global_ranked, chunks_by_id, "global")
        hybrid = _rows_from_ranked(hybrid_ranked, chunks_by_id, "hybrid")
        local["query_extraction"] = query_extraction
        global_["query_extraction"] = query_extraction
        hybrid["query_extraction"] = query_extraction
        case_report = {
            "id": case["id"],
            "headline": case["headline"],
            "subheadline": case["subheadline"],
            "query": query,
            "local": _summarize_mode_result(local),
            "global": _summarize_mode_result(global_),
            "hybrid": _summarize_mode_result(hybrid),
        }
        report_cases.append(case_report)
        pbar.set_postfix(
            case=case["id"],
            local=case_report["local"]["result_count"],
            global_=case_report["global"]["result_count"],
            hybrid=case_report["hybrid"]["result_count"],
        )
        print(
            "processed {id}: local={l} global={g} hybrid={h}".format(
                id=case["id"],
                l=case_report["local"]["result_count"],
                g=case_report["global"]["result_count"],
                h=case_report["hybrid"]["result_count"],
            )
        )

    payload = {
        "top_k": top_k,
        "total_cases": len(report_cases),
        "cases": report_cases,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved batch report to: {output_path}")


if __name__ == "__main__":
    main()

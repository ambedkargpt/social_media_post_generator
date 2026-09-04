# The post-generation pipeline

This is what happens between a user clicking a news story and a post appearing.
The orchestration lives in `PostsService.generate_post_for_news`
(`backend/services/posts_service.py:151`).

## Step by step

1. **Validate references.** `_validate_references(user_id, news_id)` checks both
   identifiers are well-formed ObjectIds and that the records exist.
2. **Load the news item.** A missing document is a `404`. The document is
   flattened into an `article` dict by `_news_doc_to_article`.
3. **Log provenance.** `news_id`, tenant, content type, headline and source video
   URL are logged as one record per line. The comment in the code explains why
   they are not a single multi-line record: retrieval drives a `tqdm` bar on the
   same stream, and a bar redrawing with a carriage return lands on top of the
   tail of a multi-line record — the video URL was the last line, so it was the
   line that went missing from the console.
4. **Build the query.** `_query_from_article` turns the headline and description
   into the retrieval query.
5. **Resolve the writing voice.** `_profile_for_user` merges the user's stored
   questionnaire answers with the request's `tone` and `profile_overrides`.
6. **Pick the tenant corpus.** `tenant = article["tenant_slug"] or "general"`,
   then `_rag_stack(tenant)` returns the embedder, vector store and
   `context_by_title` map for that tenant. A party's posts are written from that
   party's corpus.
7. **Retrieve.** `_retrieve_chunks` runs the hybrid retrieval described below.
8. **Expand to full contexts.** `_full_contexts_for_chunks` maps each retrieved
   chunk back to its full video context, so the writer sees more than the
   excerpt window.
9. **Research the story.** `_research_for_article` produces a brief when
   `WEB_RESEARCH_ENABLED` is on; otherwise it is skipped and `brief` is `None`.
10. **Load the transcript.** `_transcript_for_article` loads the story's own
    video transcript. The comment records the intent: the post is written
    against what the speaker actually said, not only the excerpts a retriever
    happened to rank.
11. **Open a trace directory.** `_ensure_trace_dir` runs whether or not research
    ran. It used to belong to the research brief, which meant that with research
    off — how production runs today — a generation left no record at all. That
    is exactly the configuration someone needs to inspect.
12. **Refuse to invent.** If there are no chunks *and* no transcript *and* no
    research brief, the request fails with `503`. Chunks alone are optional;
    having nothing at all is not.
13. **Write the post.** `_generate_with_llm` calls `POST_GENERATION_MODEL`.
    Empty content is a `502`.
14. **Validate and possibly re-ask.** `_validated_post`, described below.
15. **Persist.** A `posts` document is created with `status: "draft"` and a
    `generation_meta` object holding the profile, query, references, snapshot id,
    model used, and the research and validation metadata.
16. **Respond.** `PostGenerateResponse` carries the post, the references, a
    `retrieval_snapshot_id` (`rs_<uuid4hex>`) and `retrieval_reused: false`.

## Retrieval

The retrieval implementation is `backend/pipeline/retriever.py`
(`retrieve_relevant_chunks`), layered as dense + lexical → fusion → optional
rerank → filters.

- **Dense.** The query is embedded with `ChunkEmbedder.embed_query` (Gemini,
  `gemini-embedding-001` by default) and searched in Pinecone. Vectors are L2
  normalised so inner product equals cosine.
- **Lexical.** A BM25 store is built in memory over the chunk texts
  (`backend/pipeline/bm25_store.py`), controlled by `RETRIEVAL_USE_BM25`.
- **Query expansion.** `backend/pipeline/query_expander.py` adds heuristic
  bilingual variants, weighted 0.7 against the raw query's 1.0, which matters
  when the user's phrasing differs from the transcript's.
- **Fusion.** Reciprocal rank fusion combines the two rankings: each chunk
  scores `1/(k + rank)` from whichever lists it appears in, with `k` from
  `RETRIEVAL_RRF_K` (default 60). Contributions from all query variants sum.
  A small title bias (+0.01) favours chunks from candidate videos, and rare-term
  protection can force high-IDF lexical matches into the pool
  (`RETRIEVAL_RARE_TERM_*`).
- **Rerank.** Optional and **off by default** — `RETRIEVAL_ENABLE_RERANK`
  defaults to `false` in code despite the docstring saying otherwise. When on,
  the top `RETRIEVAL_RERANK_TOP_N` candidates are re-embedded along with the
  query and scored by cosine, then blended
  `final_score = 0.7 * rerank_sim + 0.3 * hybrid_score`. There is no
  cross-encoder anywhere in the stack.
- **Filters.** `RETRIEVAL_PER_VIDEO_CAP` (default 2) stops a single video
  dominating the context; `RETRIEVAL_TOP_K` (default 5) is what reaches the
  writer.
- **Graph augmentation.** When SEMRAG is enabled, entity and relation matches
  contribute additional candidates with their own RRF-style bonus, falling back
  to dense + BM25 when the graph returns nothing useful.

`backend/docs/SYSTEM_ARCHITECTURE.md` covers the fusion arithmetic and the two
chunking strategies in more depth.

## Validation

`_validated_post` (`backend/services/posts_service.py:878`) checks the post's
figures and dates against the material it was supposed to come from. The
docstring states the reasoning: a prompt rule about dates was shown to fail even
when written to target one specific error, so the check runs on the output rather
than trusting the instruction.

Sources are split deliberately. Only the story's **own** video counts as a
factual source, determined by `_is_own` in `backend/pipeline/generator.py`:

- **Own sources** — the transcript, the article's title/description/content, the
  chunks from the story's own video, and the research brief.
- **Other-video sources** — chunks from any other video, checked separately so a
  figure lifted from a different briefing is reported as `cross_video` rather
  than as invented.

The transcript is included on purpose; without it every figure the speaker said
aloud would come back flagged as invented.

`validate_post` (`backend/pipeline/post_validation.py`) returns a report with
`unsupported_numbers`, `unsupported_dates`, `cross_video_numbers`, `word_count`
and `word_limit`. If the report is clean the post is returned as is. Otherwise
the writer is re-asked **once**, with `report.as_correction_note()` as a
refinement note.

The retry is kept only when it is actually cleaner — the total flag count must
not increase, because a rewrite that trades one bad figure for two is not an
improvement. Either way the surviving report is marked `retried = True` and
recorded in `generation_meta`. There is no third attempt: a post that still
carries an unsupported figure is returned with the flags recorded rather than
spending another call or denying the user a post.

Set `POST_VALIDATION_ENABLED=false` to skip the whole pass.

## Trace directories

One directory per generation, written even when research is off. Enable the
research-side detail with `WEB_RESEARCH_DEBUG_DIR`.

| File | Contents |
|---|---|
| `00_news_item.txt` | The news item the run started from |
| `01_claims.json` | Claims extracted for research |
| `02…04_corroboration_*` | What the searched pages establish, one set per claim, capped by `WEB_RESEARCH_MAX_CLAIMS` |
| `09_brief_combined.txt` | The assembled research brief |
| `10_post_first_pass.txt` | The first draft |
| `11_validation_first_pass.json` | Validation report for the first draft |
| `12_post_retry.txt` | The re-asked draft, when validation flagged something |
| `13_validation_retry.json` | Validation report for the retry |
| `14_post_final.txt` | What was stored |

`backend/scripts/show_research_trace.py` renders a trace for reading, and
`backend/scripts/export_requests.py` exports the exact prompts sent at each step.

## Regeneration

`POST /posts/{id}/regenerate` calls `regenerate_from_snapshot`
(`backend/services/posts_service.py:284`), which reuses the retrieval result
recorded against the source post instead of retrieving again. The response
reports `retrieval_reused: true`. This makes it cheap to try a different tone or
temperature against identical evidence — and it keeps the comparison honest,
since a fresh retrieval could otherwise change the sources underneath you.

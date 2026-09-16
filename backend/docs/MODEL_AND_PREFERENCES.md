# Model & Preferences

Two questions this answers:

1. Which model writes our posts, and how is it configured?
2. What do we tell it about the user — and how do the questions change with the user's role?

Everything below is what the code does today, not a plan.

---

## 1. The model: DeepSeek V4.1 Flash

DeepSeek has retired the V3 models. The legacy model names still work, but they
now resolve to **V4.1 Flash** — the name only decides whether *thinking* is on:

| `.env` setting | Value | Used for | Resolves to |
|---|---|---|---|
| `POST_GENERATION_MODEL` | `deepseek-chat` | **Writing the post** | V4.1 Flash, thinking **off** |
| `RESEARCH_MODEL` | `deepseek-chat` | Web research / fact-check | V4.1 Flash, thinking **off** |
| `DEEPSEEK_MODEL` | `deepseek-reasoner` | News generation (pipeline) | V4.1 Flash, thinking **on** |
| `DEEPSEEK_MODEL_SUMMARY` | `deepseek-chat` | Video summaries | V4.1 Flash, thinking **off** |

Base URL: `https://api.deepseek.com` (OpenAI-compatible client).

**Why post generation runs with thinking off.** On a reasoning model the
chain-of-thought ate the entire completion budget and returned an empty post —
24,000 tokens of reasoning, 0 characters, 175 seconds. With thinking off the
same job takes about 13 seconds. Research keeps the heavier setting only where
weighing sources against each other is the actual work.

**Call settings**

- `temperature`: `0.7` (per request; the API can override it)
- `max_tokens`: `24000` (`POST_MAX_COMPLETION_TOKENS`). A reasoning model counts
  its thinking against this cap, and Devanagari costs roughly a token per
  character or two, so a Hindi post needs far more headroom than its word count
  suggests. At 4,096 posts were cut off mid-word.

### One risk worth knowing

We never send the `thinking` parameter explicitly. We rely entirely on how
DeepSeek maps the legacy aliases. If they change that mapping — as they will
when V5 ships — **our behaviour changes silently and nothing in our logs says
so.**

Recommended (not done yet): move to the explicit names `deepseek-flash` /
`deepseek-v4-pro` and pass `thinking` + `reasoning_effort` ourselves.

---

## 2. What we send with every post

The prompt carries a JSON payload. Inside it, `user_profile` is a **27-field
object**:

| Source | Fields |
|---|---|
| The user's answers | **25** core preference questions (`profile_*`) |
| The user record | `political_party` — the party name, stated plainly |
| The user record | `party_position` — **not** the raw id. `"district_president"` tells the model nothing, so it is converted to a block of writing guidance |
| The user's answers | `position_preferences` — the **5** questions for their party *and* role (see §3) |

So **30 answers reach the model on every generate**: 25 core + 5 role-specific.

**Unanswered questions are not blank.** We start from a default profile and
write the user's answers over it, so the model always sees a complete 27-field
object. A user who has answered nothing still inherits the defaults — which are
opinionated (`tone: "Fierce, uncompromising, urgent"`). Worth reviewing before
onboarding at scale.

Preferences changed in the panel take priority over saved answers, and a `tone`
sent with the request overrides the profile's tone.

---

## 3. The questions change with the role

This is the part that is easy to miss.

**Core questions — 25, the same for everyone.** Tone, audience, language,
platform, length, perspective and so on. Category `profile`.

**Position questions — 70 in the database, 5 per user.** Category `position`.

```
7 role groups  ×  5 questions  ×  2 parties  =  70
```

The seven groups: **National · State · District · Block · Grassroots ·
Frontal wing · Elected office**

Question ids follow `pos_<party>_<group>_q<n>`, e.g. `pos_inc_national_q1`.

At generation time we resolve the user's party and role group, fetch **only
those 5 ids**, and ignore the other 65. A state leader and a booth worker in the
same party are asked five different questions and give the model five different
instructions.

**Why the question text travels with the answer.** The same slot means
different things in different sets — the third question is *how hard to
challenge the state government* for a state leader, and *how to answer a claim
about your community* for a frontal wing. So each line names the part of the
post it governs, states the answer as the instruction for that part, and keeps
the question after it in brackets. `"Strong opposition voice"` on its own does
not say which question it answered.

### Current coverage

| Party | Position question set |
|---|---|
| Indian National Congress | ✅ 35 questions (7 groups × 5) |
| Bahujan Samaj Party | ✅ 35 questions (7 groups × 5) |
| Samajwadi Party | ❌ none yet |

A Samajwadi user — or any party without a set — gets an empty
`position_preferences` and their prompt is exactly what it was before this
feature existed. Nothing breaks; the role simply does not shape the post yet.

---

## Quick reference

| | |
|---|---|
| Model in production | DeepSeek **V4.1 Flash** (all four paths) |
| Post generation | thinking **off**, temp 0.7, max 24k tokens |
| Questions in the database | 95 active — 25 core + 70 position |
| Questions per generation | 30 — 25 core + 5 for the user's party and role |
| Parties with role questions | INC, BSP |

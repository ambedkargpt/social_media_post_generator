# Model & Preferences

Two questions this answers:

1. Which model writes our posts, and how is it configured?
2. What do we tell it about the user — and how do the questions change with the user's party and role?

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

The prompt carries a JSON payload. Inside it, `user_profile` is a **29-field
object**:

| Source | Fields |
|---|---|
| The user's answers | **25** profile fields (`profile_*`). Only **7** of these are still asked; the other 18 come from the default profile — see below |
| The user record | `political_party` — the party name, stated plainly |
| The user record | `party_position` — **not** the raw id. `"district_president"` tells the model nothing, so it is converted to a block of writing guidance |
| The user's answers | `party_preferences` — the **10** questions about the party itself (see §3) |
| The user's answers | `position_preferences` — the **5** questions for their party *and* role (see §3) |

So **22 answers reach the model on every generate**: 7 core + 10 party + 5 role.

**Unanswered questions are not blank.** We start from a default profile and
write the user's answers over it, so the model always sees a complete object. A
user who has answered nothing still inherits the defaults — which are
opinionated (`tone: "Fierce, uncompromising, urgent"`). Worth reviewing before
onboarding at scale.

**The 18 fine-tuning questions were retired, not deleted.** `language`,
`target_platform`, `formality_level`, `caste_identity` and fourteen others are
no longer asked: they are `is_active: false` in the database and no screen draws
them. Their `PROFILE_FIELDS` entries stay, so the default value still reaches
the prompt and answers users gave before the change are still read back. To
stop them reaching the prompt at all, remove them from
`backend/pipeline/profiles.py` as well.

Preferences changed in the panel take priority over saved answers, and a `tone`
sent with the request overrides the profile's tone.

---

## 3. The questions change with the party and the role

This is the part that is easy to miss. There are three sets, and only the first
is the same for everyone.

**Core questions — 7, the same for everyone.** Role, tone, audience, primary
focus, perspective, length, call to action. Category `profile`, ids
`profile_<field>`.

**Party questions — 20 in the database, 10 per user.** Category `party`, ids
`party_<inc|bsp>_q<n>`.

The ten questions are worded identically for both parties; only the five answer
options change, because the vocabulary does. A Congress supporter chooses
between constitutional and governance framings, a BSP supporter between Bahujan
representation and caste. They ask what the writer wants *said about* their
party: what to lead with when it is in the news, how hard to back a position
they agree with, how to answer its critics, what to do when the party is the one
at fault, how to use its history, and the overall attitude toward it.

**These are not asked at sign-up.** Onboarding asks only the five position
questions. The ten party questions arrive on the Preferences page **already
answered**, on a default set defined in `DEFAULT_NUMBERS`, and the user changes
whichever do not sound like them. The same defaults back the prompt: an
unanswered question falls back to its default in `_party_preferences`, so a user
who never opens the page still generates with a full, coherent set, and what the
page shows is always what the prompt carries.

Each party's defaults read as one writer rather than ten unrelated picks:
supportive of the party and assertive in voice, arguing in the party's own
vocabulary, fact-based on a contested claim, and willing to acknowledge a mistake
with context. Question 10 is deliberately **"Supportive but willing to
criticize"** and not "Strongly supportive" — an unconditional defence is a
position a user should have to choose, not one they are handed.

**Question 10 is marked compulsory** — the overall attitude. Two supporters of
the same party can want opposite posts, and it is the only question that
separates them: one wants an unconditional defence, the other an evidence-led
analysis that concedes a fault when the material shows one. Because it always
has a default it is never actually blank; the flag draws the badge on the card
so the user knows which answer carries the most weight. It is *not* flagged
`is_required` in the database, because the batch save checks every active
required question at once and both parties' sets are active — a BSP user would
be held to the INC question they are never shown.

**A party change needs no migration.** Answers to the old party's set stay in
the database under their own ids, and nothing reads them: the generator resolves
the current party and fetches only that party's ten. Change back and the old
answers are live again.

**Position questions — 70 in the database, 5 per user.** Category `position`.

```
7 role groups  ×  5 questions  ×  2 parties  =  70
```

The seven groups: **National · State · District · Block · Grassroots ·
Frontal wing · Elected office**

Question ids follow `pos_<party>_<group>_q<n>`, e.g. `pos_inc_national_q1`.

At generation time we resolve the user's party and role group, fetch **only
those 5 ids**, and ignore the other 65. These are the five sign-up asks. The
party questions need no role, so a member who never chose a position still has
all ten. A state leader and a booth worker in the
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

| Party | Party set | Position set |
|---|---|---|
| Indian National Congress | ✅ 10 | ✅ 35 (7 groups × 5) |
| Bahujan Samaj Party | ✅ 10 | ✅ 35 (7 groups × 5) |
| Samajwadi Party | ❌ none yet | ❌ none yet |

A Samajwadi user — or any party without a set — gets an empty
`party_preferences` and an empty `position_preferences`, and their prompt is
exactly what it was before these features existed. Nothing breaks; the party and
the role simply do not shape the post yet.

### Existing accounts are caught up once

An account created before `LAUNCHED_AT` in `party_questions.py` never saw these
questions. `GET /questions/pending` reports what such an account still owes, and
`ProtectedRoute` sends it to `/questionnaire` once per browser session to answer
them. The check sits in `ProtectedRoute` rather than in the login screen because
there are five ways into a session — password, OTP, Google, password reset, and
returning with a live token — and only that component is on all five.

| Account | Asked on arrival |
|---|---|
| Created before `LAUNCHED_AT`, nothing answered | 10 party + 5 position |
| Created before, position already answered | 10 party |
| Created after (a fresh sign-up) | 5 position only |
| Anything already answered | nothing |

"Pending" means *none of* a set is answered, not "has a gap". Someone who
answered two of the ten has seen the questionnaire and stopped, and the other
eight already fall back to their defaults — sending them back on every sign-in
would be a nag. Leaving early now saves what has been answered, which it did not
before.

Moving `LAUNCHED_AT` forward re-prompts every user who already answered. Move it
only when a genuinely new set ships, and to that ship date.

### Seeding

```
python -m backend.scripts.seed_position_questions --apply
python -m backend.scripts.seed_party_questions --apply
```

Both are idempotent and additive. `seed_party_questions` also retires the 18
fine-tuning profile questions; pass `--keep-fine-tuning` to seed without that.

---

## Quick reference

| | |
|---|---|
| Model in production | DeepSeek **V4.1 Flash** (all four paths) |
| Post generation | thinking **off**, temp 0.7, max 24k tokens |
| Questions in the database | 97 active — 7 core + 20 party + 70 position |
| Asked at sign-up | 5 — the position questions only |
| Editable on Preferences | 22 — 7 core + 10 party (pre-answered) + 5 for their role |
| Per generation | the same 22, plus 18 retired fields from the default profile |
| Parties with party & role questions | INC, BSP |

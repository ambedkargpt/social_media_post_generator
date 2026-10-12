# AmbedkarGPT — Design Brief

A reference for redesigning the AmbedkarGPT web app. Everything below was read
out of the codebase on 12 October 2026, not recalled — file paths are given so
any value can be checked.

The ask that produced this document: *"currently it looks like a typical
AI-generated website."* That is addressed directly in **§5**, with evidence.

---

## 1. What AmbedkarGPT is

A content platform for Bahujan creators, writers and political workers. It
takes current Indian political news and helps users produce Ambedkarite
commentary from it — posts, scripts, speeches, audio.

Its own stated purpose:

> AmbedkarGPT preserves, structures, and democratizes access to foundational
> Ambedkarite thought through trustworthy AI.

**This matters for design more than anything else in this document.** The
subject is caste, the Constitution, Dalit history and present-day Indian
politics. The audience is people doing political work, many on mid-range
Android phones, many reading in Hindi. It is not a developer tool and not a
SaaS dashboard, and the current design does not know that.

### Products inside it

| Area | Route | State |
|---|---|---|
| Landing / marketing | `/`, `/about`, `/solutions`, `/resources`, `/contact` | live |
| Auth | `/login`, `/signup`, `/otp`, `/forgot-password` | live |
| Onboarding | `/profile-setup`, `/questionnaire` | live |
| Dashboard | `/dashboard` | live |
| Social media post generator | `/generate/social-media` | live |
| Bhim Radio | `/bhimradio` | live |
| Bhim Chatbot | `/bhimbot` | live |
| Music / podcast studio | `/generate/music` | partial |
| Post history, preferences | `/posts`, `/preferences` | live |

Six services are advertised on the landing page: **Social Media Post,
Podcast, Political Speech, Video Generation, Editorial, Debate Analysis.**
Only the first is fully built; the rest carry a "Soon" badge.

### Landing page, in order

Hero → trusted-by strip → "What We Stand For" (four ideas) → use-cases grid →
knowledge section → Dalit Corpus → Dalit history makers → team → contact +
office map → mission statement.

Components are in `frontend/src/components/landing/`.

---

## 2. The constraints a redesign cannot break

These are not preferences. Each one is already load-bearing, and several were
bugs before they were fixed.

### 2.1 Hindi is a first-class language, not a translation layer

- **762 English strings, 761 Hindi strings** (`frontend/src/i18n/en.js`,
  `hi.js`). Every screen exists in both.
- The display faces (Anybody, Inter) **have no Devanagari glyphs.** When a
  heading is set in them under Hindi, the browser silently falls through to
  whatever Devanagari font the OS has, at a line-height tuned for Latin — and
  matras and reph get clipped by the line box. `index.css` fixes this by
  forcing `--font-hindi` and `line-height: 1.4` on `.font-display` and
  `.font-serif` under `:root[lang="hi"]`.
- Devanagari has a **smaller x-height** than Latin at the same `font-size`, so
  13px Hindi reads visibly smaller than 13px English. `index.css` bumps every
  UI text size by roughly 12% under Hindi, size by size, for everything below
  24px.
- **Hindi runs longer than English.** Buttons, nav items and labels cannot be
  sized to their English content.

> **If a redesign picks a display typeface, it must either carry Devanagari or
> be paired with one that does, and the pairing has to be tested at heading
> sizes in Hindi.** This is the single easiest way to break the site.

### 2.2 Motion is already handled responsibly

`index.css` carries **17 `prefers-reduced-motion` blocks**. Every decorative
animation has an off switch. Keep that discipline.

### 2.3 Dark only, today

There is **no light mode** — zero `prefers-color-scheme` rules, zero `dark:`
utilities in any of the JSX files. The whole app assumes a dark ground.
Introducing light mode is a legitimate redesign choice but it is net-new work
across every screen, not a toggle.

### 2.4 Performance on mid-range Android

The landing background alone paints **17 drifting orbs, each
500–750px wide under a 150–190px blur**
(`frontend/src/components/landing/LandingBackground.jsx`). The file's own
comment notes the browser must hold a texture the size of each element plus
about three blur radii on every side. This is the most expensive thing on the
page and it is purely decorative.

---

## 3. The current design system, as built

Tailwind **v4**, tokens declared in `@theme` in `frontend/src/index.css`
(1,479 lines). No `tailwind.config.js` — v4 keeps config in CSS.

### 3.1 Typefaces

| Token | Stack | Used for |
|---|---|---|
| `--font-sans` | **Inter**, system-ui | all body text, the default |
| `--font-display` | **Anybody**, Inter | headings, brand wordmark |
| `--font-serif` | **Cormorant Garamond**, Playfair Display, Georgia | editorial accents, quotes |
| `--font-count` | **Poppins**, Count *(local .otf)* | nav, numerals, UI labels |
| `--font-hindi` | **Mangal**, Noto Sans Devanagari | all Devanagari |

Loaded from Google Fonts in one `@import` at the top of `index.css`. `Count`
is a local `@font-face` from `src/assets/fonts/`.

### 3.2 Colour

```
Ground          navy-950  #05081a   ← body background
                navy-900  #0a0e27
                navy-800  #0d1333
                navy-700  #111a3a
                navy-600  #1a2347
                navy-500  #1a2654
                navy-400  #2a3566
                navy-300  #3a4880

Accent          brand-blue    #4f6bff
                brand-cyan    #3f9fff
                brand-purple  #7b5cff
                brand-violet  #a855f7

Text            primary  #e5e7eb
                muted    #8b94b8
                link     #6b8aff

Inputs          bg #1a2347 (fields use #0f1833)
                border #2a3566
                focus #4f6bff
                error #ef4444
```

Eight navy steps and four accents that sit within about 40° of each other on
the wheel. There is no semantic colour set (success / warning / critical) and
no neutral that is not blue.

### 3.3 Buttons

All four live in `index.css`.

| Class | Appearance |
|---|---|
| `.btn-gradient` | `linear-gradient(90deg, #0a7dff, #3a9fff)`, white text. Hover: `brightness(1.12)` + `0 0 28px rgba(59,145,255,0.5)` glow. Active: `scale(0.98)` |
| `.btn-outline-blue` | transparent, `1px solid rgba(130,170,230,0.55)`. Hover: lifts `-2px`, 30px blue shadow |
| `.btn-glass-violet` | `rgba(123,92,255,0.10)` + `backdrop-filter: blur(6px)` + violet border. Hover: lifts `-2px`, 34px violet shadow |
| `.btn-google` | solid navy, hover `#1e2d5a` + blue glow |

The shared primary (`components/PrimaryButton.jsx`) is `.btn-gradient`, full
width, `rounded-xl`, `py-3.5`, and **always carries a `Sparkles` icon** —
swapped for a spinner while loading.

### 3.4 Surfaces

`GlassCard` (`components/ui/GlassCard.jsx`) is the one card primitive:

```
rounded-2xl
border border-white/10
background: linear-gradient(150deg, rgba(13,22,42,0.92), rgba(10,14,28,0.88))
box-shadow: 0 16px 45px rgba(2,8,22,0.45)
padding: 24px (28px on md)
```

The navbar is `rgba(6,10,24,0.55)` + `backdrop-blur-xl` + a 32px drop shadow,
fixed, 72px tall (80px on md), max width 1440px.

Inputs: `#0f1833` ground, `#2a3566` border, focus ring
`0 0 0 3px rgba(79,107,255,0.2)`.

### 3.5 Gradient text

`.gradient-text` (blue → purple → violet, static) and `.gradient-text-blue` /
`.gradient-text-cyan`, which are 220%-wide gradients animated on a 7–8s
shimmer loop. The brand wordmark is "अंबेडकर" in white + "GPT" in
`.gradient-text-cyan`.

### 3.6 Extra chrome

Four components exist purely as page furniture: `OpeningSplash`,
`CustomCursor`, `TransitionCurtain`, `ScrollProgress`.

---

## 4. The one screen that already broke the mould

**Bhim Radio** (`/bhimradio`) was deliberately built flat and sharp — square
corners, 2px rules, uppercase micro-labels, monospace tabular time, a single
accent (`#1d7afc`), no glass and no gradients. Its tokens are in
`components/radio/radioTokens.js`.

It reads as a broadcast desk rather than as a SaaS card grid, and it is the
one place in the app where the design is about the subject. **It is worth
looking at before deciding where a redesign should land** — not necessarily to
copy, but because it proves the content does not need the glass treatment.

---

## 5. Why it reads as AI-generated

Counted across the JSX files, not estimated:

| Pattern | Occurrences |
|---|---|
| `rounded-full` | **213** |
| `rounded-xl` | **128** |
| `from-… to-…` gradient utilities | **72** |
| `rounded-2xl` | **59** |
| `Sparkles` icon | **32** |
| `.gradient-text*` | **23** |
| `GlassCard` | **21** |
| `.btn-gradient` | **19** |
| `backdrop-blur` | **15** |
| `animate-pulse` | **10** |
| `blur-3xl` | **6** |

Put plainly, the site is built from the exact set of moves that currently
signals "generated":

1. **Near-black navy ground with a blue→purple gradient as the only accent.**
   All four brand colours are a blue or a violet. Nothing on the page is warm,
   and nothing is neutral.
2. **Glassmorphism as the default surface.** One card primitive, applied 21
   times, with a translucent fill, a `white/10` hairline and a large soft
   shadow. Every section looks like every other section.
3. **Everything is rounded.** 213 `rounded-full` and 128 `rounded-xl` means
   essentially no square corner exists in the product.
4. **Inter as the body face.** The safe default.
5. **Sparkles.** 32 of them, including on the primary button of every auth
   screen. A sparkle is the current visual shorthand for "AI did this."
6. **Glow as the hover state.** Every interactive element answers a hover with
   a coloured box-shadow, so nothing feels pressed or physical — just lit.
7. **Floating blurred orbs behind the content.** Seventeen of them, animated.

None of these is wrong on its own. Together they are a template, and the
template belongs to no subject in particular — which is the problem, because
this subject is extremely particular.

### The actual mismatch

The content is about caste, the Constitution, Dalit history and Indian
political power. The design is a generic AI-SaaS skin. A heading that reads
**"POLITICS DIVIDES. CONSTITUTION UNITES."** is currently set in a soft
blue-violet gradient on a glass card with a sparkle nearby. The design is
working against the weight of its own copy.

---

## 6. Where a redesign has room

Free to change, with no technical cost:

- **The entire palette.** Nothing depends on navy. The tokens are in one
  `@theme` block in `index.css`; everything else reads them.
- **Every surface treatment.** `GlassCard` is one 8-line file.
- **All four button styles.** Four class definitions in `index.css`.
- **Corner radii, shadows, glows, the icon set.**
- **The background.** Deleting the orbs is a performance win.
- **Typography**, subject to §2.1 — any display face must handle, or be paired
  for, Devanagari.
- **Layout and section order** on the landing page.

Worth knowing before changing:

- `index.css` is 1,479 lines and carries a lot of hard-won Hindi typography
  fixes. Read lines 70–220 before touching it.
- The dashboard has its own chart components (`CategoriesPieChart`,
  `DailyActivityChart`, `SearchActivityChart`) that read colours
  independently — see `components/dashboard/useChartScale.js`.
- Bhim Radio's tokens are separate on purpose (§4).

---

## 7. What the design should be trying to do

Three things, in order.

1. **Carry the weight of the subject.** This is material about rights,
   history and political struggle. It should feel like it was made by people
   who mean it — closer to a political press, a movement publication or an
   archive than to a product dashboard. The copy is already serious; the
   design should stop softening it.

2. **Read in Hindi first.** Most of the audience will. Devanagari should look
   deliberate and well-set, not like Latin type with a fallback font behind
   it.

3. **Be fast on a cheap phone.** Every decorative layer is paid for by the
   reader. The current background is the clearest example of a cost with no
   return.

A fourth, smaller: **have a second register.** Right now everything is one
dark, low-contrast, blue-on-blue mode. Long reading, archive material and the
corpus would all benefit from somewhere brighter and quieter to sit.

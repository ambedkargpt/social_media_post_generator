# AmbedkarGPT redesign: "Neela Press" implementation brief

**For:** Claude Code, working in `ambedkargpt/social_media_post_generator` (frontend in `frontend/`).
**From:** the design session that produced the concept screens in `design-reference/`.
**Date:** 12 October 2026.

Read this whole file before writing code. Then read `DESIGN-BRIEF.md` (the owner's brief; it lives with this file or in the repo root). Then open the reference mockups listed in §12. Work on a new branch: `git checkout -b redesign/neela-press`.

---

## 0. Scope

**In scope (redesign now):**

| Area | Routes | Files |
|---|---|---|
| Auth | `/login`, `/signup`, `/otp`, `/forgot-password` | `pages/Login.jsx`, `Signup.jsx`, `Otp.jsx`, `ForgotPassword.jsx`, `components/AuthLayout.jsx`, `BrandPanel.jsx` |
| Onboarding | `/questionnaire`, `/profile-setup` (onboarding mode only) | `pages/Questionnaire.jsx`, `ProfileSetup.jsx` |
| Signed-in shell | every route inside `DashboardLayout` | `layouts/DashboardShell.jsx`, `layouts/DashboardLayout.jsx`, `components/dashboard/Sidebar.jsx`, `Topbar.jsx` |
| Dashboard | `/dashboard` | `pages/Dashboard.jsx` + `components/dashboard/*` |
| Services ("Create") | `/generate` | `pages/ServiceSelection.jsx` |
| My posts | `/posts` | `pages/PostHistory.jsx` |
| **Settings (new)** | `/settings` (absorbs `/preferences` and `/profile-setup` edit mode) | new `pages/Settings.jsx`, logic from `Preferences.jsx` and `ProfileSetup.jsx` |
| BhimBot | `/bhimbot` | `pages/BheemBot.jsx` |
| Bhim Radio | `/bhimradio` | `pages/BhimRadio.jsx`, `components/radio/*` |
| Music | `/generate/music`, `/generate/music/:type` | `pages/MusicGeneration.jsx`, `MusicGenerationStudio.jsx` |

**Out of scope. Do not change these:**

- **Landing and marketing pages** (`/`, `/about`, `/solutions`, `/resources`, `/contact`) and everything in `components/landing/`, `Navbar`, `Footer`. The owner is happy with them.
- **The social media post generator** (`/generate/social-media`, `pages/SocialMediaPostGenerator.jsx`, `components/generate/*`, `components/publish/*`). The owner wants to discuss changes first. It must keep working and keep its current look. Links *to* it from new screens are fine.
- **Backend and API contracts.** Every API call in `src/api/*` stays as it is. This is a visual and interaction redesign: keep all state logic, validation, analytics events (`trackEvent`), and auth and redirect flows.

## 1. Guardrails (non-negotiable)

1. **Don't restyle shared primitives in place.** `GlassCard`, `PrimaryButton`, `.btn-gradient`, `.gradient-text*` and `BackgroundDecorations` are used by the landing page and the post generator. Build new primitives in `src/components/np/` (§4) and move the in-scope pages onto them. Leave the old ones alone.
2. **Scope all new CSS under `.np`.** Put `className="np"` on the root of `AuthLayout`, the onboarding layout and `DashboardShell`, plus BhimBot and Music if they render outside the shell. Global selectors must not change landing pages.
3. **Hindi first.** `DESIGN-BRIEF.md §2.1` is the easiest thing to break:
   - All new fonts carry Devanagari (§3.1).
   - Under `:root[lang="hi"] .np`, headings use `line-height ≥ 1.3`, body `≥ 1.6`, and small UI text gets the existing ~12% bump. Read `src/index.css` lines 70–220 first; it holds hard-won fixes.
   - **Never rely on `text-transform: uppercase`** for meaning. Devanagari has no case. Uppercase micro-labels are allowed for English only and must still read correctly when the transform does nothing.
   - Size every button, tab and nav label to fit the **Hindi** string. Test every screen in both languages.
4. **Reduced motion.** Every animation in §7 has a `@media (prefers-reduced-motion: reduce)` path that shows the final state. Keep the existing 17 blocks.
5. **Performance on mid-range Android.** No `backdrop-filter`, no animated blur, no drifting orbs, no animated `box-shadow`. Animate only `transform` and `opacity`, plus the sidebar width (§5.2). The background is static CSS (§3.4).
6. **Remove the "AI look" from in-scope screens:**
   - no `Sparkles` icon;
   - no gradient text;
   - no coloured glow on hover;
   - no `rounded-full` except avatars, party logos, the chakra and toggle knobs.
7. **Accessibility.**
   - Use real `<button>`, `<a>` / `<Link>`, `<label>`.
   - `aria-current="page"` on the active nav item, `aria-label` on icon-only buttons.
   - Visible focus ring: `outline: 2px solid var(--np-neela-300); outline-offset: 2px`.
   - Hit targets ≥ 44px.
   - Text contrast ≥ 4.5:1.

---

## 2. What the redesign is

A **movement newsroom** look ("Neela Press"), generalised from the one screen that already works, Bhim Radio:

- **Ground and blue.** Near-neutral dark ink, with Ambedkar blue (Neela) as the single action colour.
- **Paper.** A warm "Samvidhan paper" surface for anything the user will publish or read at length: drafts, post previews, BhimBot answers. This is the second, brighter register the brief asks for.
- **Type.** Condensed poster type for headings, a Devanagari-first serif for headlines and reading, and a clean bilingual UI face.
- **Chakra.** The 24-spoke chakra is the one decorative shape: loader, progress ring, radio dial. It replaces Sparkles.
- **Party symbols.** The party's real logo and symbol (from `public/party-logos` and `public/party-symbols`) wherever content belongs to a party.
- **Softened, not boxy.** The owner said the first concept was "too boxy". Cards are separated by tone (fill) and a faint 1px edge, not hard outlines. Corners follow a ladder (§3.3). Lists use thin rules.
- **Subtle gradient ground.** A static gradient with grain, not a flat colour (§3.4).
- **Motion that feels expensive but costs little.** The sidebar collapses smoothly, hovers respond, pages cross-fade, and posts "print" onto paper (§7).

---

## 3. Foundations

### 3.1 Fonts

Add to the Google Fonts `@import` at the top of `src/index.css`. Keep the existing families, because the landing page still uses them.

```
family=Anek+Devanagari:wdth,wght@75..125,400..800
family=Mukta:wght@400;500;600;700
family=Tiro+Devanagari+Hindi:ital@0;1
family=IBM+Plex+Mono:wght@500;600
&display=swap
```

Tokens (add inside the existing `@theme` block so Tailwind v4 generates `font-np-*` utilities):

```css
--font-np-display: 'Anek Devanagari', 'Mukta', system-ui, sans-serif; /* headings, buttons, numbers in big type */
--font-np-serif:   'Tiro Devanagari Hindi', Georgia, serif;           /* news headlines, quotes, paper, bot answers */
--font-np-ui:      'Mukta', system-ui, sans-serif;                    /* everything else, both scripts */
--font-np-mono:    'IBM Plex Mono', ui-monospace, monospace;          /* digits, times, counts only, never words */
```

Rules:

- **Display headings** use `font-stretch: 87.5%` (condensed width axis), weight 700–750, letter-spacing `-0.01em` at most (negative tracking breaks Devanagari joins), and line-height 1.05–1.1 in English, 1.3 in Hindi.
- **Inside `.np` the Hindi override must point at Mukta, not Mangal:**
  ```css
  :root[lang="hi"] .np, :root[lang="hi"] .np input, :root[lang="hi"] .np textarea, :root[lang="hi"] .np button { font-family: var(--font-np-ui); }
  :root[lang="hi"] .np .font-np-display { line-height: 1.3; }
  :root[lang="hi"] .np .font-np-serif   { line-height: 1.5; }
  ```
- **Type scale (EN / HI):**

  | Role | EN | HI |
  |---|---|---|
  | display-xl | 56 | 58 |
  | display-l | 40 | 42 |
  | display-m | 30 | 32 |
  | title | 22 | 24 |
  | body | 16 | 18 |
  | small | 14 | 16 |
  | micro | 12 | 14 |

  Headlines in serif run 20–42.

### 3.2 Colour tokens

Add to `@theme`. All new UI reads only these.

```css
/* ground & surfaces */
--color-np-ink:      #0B0D14;  /* page ground (base of gradient) */
--color-np-rail:     #0F1119;  /* sidebar */
--color-np-desk:     #13161F;  /* cards */
--color-np-raised:   #181C27;  /* hover / selected surface */
--color-np-active:   #1C2133;  /* active nav item */
--color-np-track:    #262B3A;  /* progress tracks, input borders */
--color-np-edge:     #1D212C;  /* faint 1px card edge */
--color-np-rule:     #2B303E;  /* list separators */
--color-np-rule-strong: #3A4050; /* outline buttons, section rules */
/* text */
--color-np-text:     #EDEEF2;
--color-np-text-2:   #C9CCD6;
--color-np-muted:    #A6ABBA;  /* min for body text, 8:1 on ink */
--color-np-faint:    #8A90A2;  /* group labels only, ≥14px */
/* action */
--color-np-neela:    #2E56E8;  /* primary buttons (white text 5.3:1) */
--color-np-neela-600:#2447C9;  /* primary hover */
--color-np-neela-700:#1D3AA6;  /* primary active */
--color-np-neela-300:#8FA8FF;  /* links, active icons, focus ring, progress */
--color-np-neela-100:#C9D6FF;  /* link hover */
/* paper (reading register) */
--color-np-paper:    #F3EBDD;
--color-np-paper-ink:#1B1A22;
--color-np-paper-muted:#5E5A66;
--color-np-paper-rule:#DCCFB8;
/* semantic */
--color-np-brass:    #E9B949;  /* milestones, streaks, warnings, "top story" */
--color-np-success:  #4CC38A;
--color-np-critical: #F0705A;  /* errors, ON AIR, destructive */
--color-np-opposition:#FFB27A; /* opposition-news tag */
```

Charts (`components/dashboard/useChartScale.js` and the chart components) read colours on their own. Point them at these tokens: series `#8FA8FF`, inactive `#3A4050`, grid `#2B303E`, labels `#A6ABBA`.

### 3.3 Shape, edges, elevation

**Radius ladder.** Use only these values.

| Use | Radius |
|---|---|
| Cards, panels, modals | `16px` |
| Paper surfaces | `12px` |
| Buttons, inputs, selects, nav items, tabs | `10px` (small buttons `8px`) |
| Chips and tags | `8px` (no pills) |
| Avatars, party logos, chakra, toggle knob | `50%` |

**Edges:**

- A card is `background: var(--color-np-desk); border: 1px solid var(--color-np-edge)`. No 2px outlines.
- Separate list rows with `1px solid var(--color-np-rule)`.
- A section header has a `1px solid var(--color-np-rule-strong)` underline.

**Elevation:**

- Cards have no shadow.
- Paper cards: `0 10px 22px rgba(0,0,0,.45)`, static.
- Popovers and menus: `0 16px 40px rgba(0,0,0,.5)`.
- Never animate shadows.

### 3.4 The gradient background (subtle)

Replace `.dash-bloom`, `.dash-beam`, `.dash-vignette` and `.dash-grain` (index.css ~1246–1320) on in-scope screens, and the `background` prop in `DashboardShell`, with **one static layer**. Do not delete those classes; the post generator may still use them.

```css
.np-bg {
  background-color: #0B0D14;
  background-image:
    radial-gradient(1100px 620px at 12% -8%, rgba(46, 86, 232, 0.16), transparent 60%),
    radial-gradient(900px 520px at 100% 0%, rgba(143, 168, 255, 0.07), transparent 55%),
    radial-gradient(800px 600px at 85% 110%, rgba(233, 185, 73, 0.05), transparent 60%),
    linear-gradient(180deg, #0D1020 0%, #0B0D14 45%, #090B11 100%);
}
.np-bg::after { /* grain: one tiny tiled SVG, static */
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .035;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
```

- Put `.np-bg` on the shell root and the auth/onboarding root, and keep content at `position: relative; z-index: 1`.
- Never use `background-attachment: fixed`; it repaints on scroll on Android. The gradient lives on the non-scrolling shell root, and the scrolling column has a transparent background.
- The rail sits on top as solid `--color-np-rail` at 92% opacity, with no blur.

### 3.5 Motion tokens

```css
--np-ease-out: cubic-bezier(.2, .8, .2, 1);   /* most UI */
--np-ease-in-out: cubic-bezier(.65, 0, .35, 1); /* sidebar, sheets */
--np-spring: cubic-bezier(.34, 1.36, .64, 1);  /* stamps, toggles (small overshoot) */
--np-dur-1: 120ms;  /* hover, press */
--np-dur-2: 200ms;  /* fades, small moves */
--np-dur-3: 320ms;  /* sidebar, sheets, page */
--np-dur-4: 480ms;  /* stamp land, chakra fill */
```

### 3.6 Icons

- Keep `lucide-react`: `strokeWidth={2}`, size 18–20 in nav and 16 in buttons.
- Remove `Sparkles` from in-scope screens. The primary-action icon is `ArrowRight`, `Plus` or the chakra (§4).

---

## 4. New primitives: `src/components/np/`

Build these first, then a small `/np-kit` route (dev only, behind `import.meta.env.DEV`) that renders every primitive in EN and HI. Use it to check them.

| Component | Spec |
|---|---|
| `Button` | Variants: `primary` (neela bg, white), `secondary` (transparent, `1.5px solid rule-strong`, text-2), `ghost` (no border, text-2, hover `raised` bg), `danger` (critical text, hover critical/10 bg). Sizes: `md` 48px tall, `lg` 54px, `sm` 40px. Radius 10px; `font-np-display` 700 for primary `lg`, otherwise `font-np-ui` 600. Props: `loading` (shows `Chakra` spinning 16px in place of the icon and keeps the width), `iconLeft`, `iconRight`, `as={Link}`. Keep `PrimaryButton`'s double-submit guard (`disabled` while loading, `aria-busy`). |
| `Field` / `Input` / `Select` / `Textarea` | Label above (14px 600 text-2). Control 52px tall, bg `desk`, `1px solid track`, radius 10px, 17px text. Hover border `rule-strong`; focus border `neela-300` plus the focus outline; error border `critical` with the message below in critical 14px and `aria-describedby`. Optional prefix slot (e.g. `+91`, `@`) with a 1px divider, and a character counter slot in mono 12px. |
| `Card` | `desk` bg, edge border, radius 16px, padding 24/28. `interactive` prop adds the hover from §7.3. |
| `Paper` | `paper` bg, `paper-ink` text, radius 12px, static shadow, `font-np-serif` body. `tilt` prop (−1 / 0 / 1 deg) for grids of drafts. |
| `Stamp` | `draft` = 2px dashed `paper-muted` border on paper (or `muted` on dark); `published` = 2px solid brass, text brass, rotated −6°; `saved` = brass-dark `#8A6A1E` on paper. Radius 6px, `font-np-display` 700, 12–14px. Animates in with §7.6. Text comes from i18n (Hindi has no uppercase). |
| `Segmented` | Group of buttons inside a `1px solid rule` container, radius 10px, 3px inner padding. The active segment has an `active` bg **that slides between options** (one absolutely positioned indicator, `transform: translateX()`, `--np-dur-2 --np-ease-out`). `role="radiogroup"` or tabs semantics as appropriate. |
| `Tabs` | Same visual as `Segmented` for Settings. Keyboard: arrow keys move, Home/End jump. |
| `Chip` | 40px tall, radius 8px, `1px solid rule`; selected = text bg (`#EDEEF2`) with ink text. Horizontal scroll container on mobile with `scroll-snap-type: x proximity` and a right-edge fade mask. |
| `Chakra` | SVG, 24 spokes (12 diameter lines rotated 15°) + rim + hub. Props: `size`, `mode="spin" \| "progress" \| "static"`, `value` (0–1) for progress. Progress = a track ring + an arc via `stroke-dasharray`, with 24 gap ticks painted over it in the surface colour so it reads as segmented. Spin = `rotate` 1.2s linear infinite (6s when used as decoration). Respects reduced motion (static). |
| `SectionHeader` | `font-np-display` 30/32 condensed 700, optional right slot (link or filter), `1px solid rule-strong` underline, 12px padding-bottom. |
| `Tag` | Text-only label for news category (Party / Opposition / General) in its colour, optionally with a 18–20px party symbol image before it. |
| `PartyLogo` / `PartySymbol` | Wrap `partyLogo(name)` from `utils/politicalParties.js` (round badge, `border-radius: 50%`) and the white-line symbols in `public/party-symbols/` (`congress.png` hand, `samajwadi.png` cycle, `bjp.png` lotus). `alt=""` when decorative, the party name when it's the only label. |
| `Skeleton` | `raised` blocks shaped like the real content, opacity pulse .5↔.8 over 1.4s (static under reduced motion). |
| `EmptyState` | Chakra (static, 64px) + title + one sentence + one action. |

---

## 5. Signed-in shell

### 5.1 Structure

`DashboardShell` becomes:

```
<div class="np np-bg" style="display:grid; grid-template-columns: var(--rail-w) minmax(0,1fr); height:100dvh">
  <Sidebar/>                       // desktop & tablet
  <div class="flex min-w-0 flex-col">
    <NewsTicker/>                  // keep, restyle: 36px strip, rail bg, mono times, serif headlines
    <main class="min-h-0 flex-1 overflow-y-auto"> {children} </main>
  </div>
  <MobileTabBar/>                  // < 768px only
</div>
```

- Move **`/bhimbot`, `/generate/music` and `/generate/music/:type`** inside the `DashboardLayout` route group in `App.jsx`, so they get the shared rail (today each renders its own). Add them to `APP_PATHS` in `App.jsx` and to `ACTIVE_BY_PATH`.
- **Do not move `/generate/social-media`** (out of scope).
- Add `/settings` inside the group.

**Page header** (replaces `Topbar` visuals; keep the `NotificationBell`, `LanguageSwitcher` and `ProfileMenu` logic):

- Left: an optional eyebrow (date in serif 18px muted), then the page title in display-xl.
- Right: the language toggle (44px square-ish button, radius 10px), the notification bell and, on mobile only, the avatar.
- Underline: `1px rule-strong`.
- Sticky inside `main` with a solid `ink` background at 88% opacity (no blur), and a 1px bottom edge that appears once the page has scrolled (toggle a class from an `IntersectionObserver` sentinel).

### 5.2 Sidebar v2 (`components/dashboard/Sidebar.jsx`)

Keep: the `useRadio()` integration, the `localStorage` collapsed state (`ambedkargpt_sidebar_collapsed`), the mobile drawer, logout with loading state, and `data-*` hooks that e2e tests use.

**Expanded width 272px, collapsed 76px.** Top to bottom:

1. **Brand row.** Wordmark "Ambedkar**GPT**" (GPT in `neela-300`; Hindi "अंबेडकर") in display 22px, and a collapse button (36px, radius 8px, `1px solid track`, `PanelLeftClose` / `PanelLeftOpen` icon, `aria-label`, `aria-expanded`). Keyboard shortcut **`[`** toggles it (ignore while typing in inputs).
2. **Party card.** Radius 14px, bg `#161A26`, padding 14px:
   - 42px round party logo (`partyLogo(user.political_party)`);
   - the party name (600) and the role · city (13px muted), both truncating with ellipsis;
   - the party **symbol** as a faint watermark: absolute, top-right, `height: 120px; opacity: .09`;
   - when collapsed, only the logo shows (centred), and a tooltip gives the party name.
   - No party → hide the card.
3. **New post button.**
   - Primary, 50px, radius 12px, `Plus` icon, label "New post" / "नई पोस्ट".
   - A keycap "N" on the right (mono 12px, `rgba(255,255,255,.18)` bg, radius 6px). Pressing `N` outside inputs goes to `/generate`.
   - Collapsed: a 48px square with only the icon.
4. **Group "Workspace" / "कार्यक्षेत्र"** (12px 600 faint label, hidden when collapsed):
   - Today (`House`) → `/dashboard`
   - Create (`LayoutGrid` or `SquarePlus`) → `/generate`
   - My posts (`FileText`) → `/posts`, with a mono count badge (the user's total posts, already available via the daily-quota API's `total_posts`)
5. **Group "Learn & listen" / "सीखें और सुनें":**
   - BhimBot (`MessageCircle`) → `/bhimbot`
   - Bhim Radio (`Radio`) → `/bhimradio`, with a **LIVE** tag (critical bg, ink text, mono 11px 600, radius 6px) when a station is on air (from `useRadio().station`)
   - Music studio (`Music`) → `/generate/music`
6. **Removed:** Saved Prompts, Analytics and Settings "SOON" items, and the Profile and Preferences items (now under Settings).
7. **Footer** (pinned to the bottom with `margin-top: auto`):
   - **Quota meter.** "Posts today · 2/5" (mono), with 5 segments (6px tall, radius 3px, gap 4px) filled `neela-300`/`track` from `getDailyQuota()`. Collapsed: a 28px Chakra progress ring.
   - **Radio mini-player** (hidden on `/bhimradio`): round 38px play/pause button (text bg, ink icon), "● ON AIR" (critical, 12px 700), the bulletin title, and a 4-bar level meter. The bars animate `scaleY` only while playing (§7.8) and are static otherwise. It reuses the existing rail radio logic.
   - **User row** (`1px edge` top border): 36px avatar (initial on `neela`), name and city, a language toggle (36px, shows the *other* language: "हिं" / "EN"), and a Settings icon button (`Settings` icon → `/settings`, active-styled on that route). The logout action moves into the existing `ProfileMenu` (opened from the avatar), so the rail has no permanent logout row.

**Nav item:**

- 44px (46px in Hindi), radius 10px, padding 0 12px, gap 12px.
- Icon colour `muted`, becoming `neela-300` when active.
- Label `text-2`, becoming `text` and 600 when active.

**Active indicator:**

- One absolutely positioned element per group, bg `active`, radius 10px.
- It **slides** to the active item: measure `offsetTop`/`offsetHeight` and animate `transform: translateY()` plus `height` with `--np-dur-3 --np-ease-out`.
- On first mount, place it without animating.

**Hover:**

- bg `raised` fades in over `--np-dur-1`, and the icon nudges `translateX(2px)`.
- Press: `scale(.98)`.

**Collapse animation** (must feel smooth):

- Register the width variable once:
  ```css
  @property --rail-w { syntax: '<length>'; inherits: true; initial-value: 272px; }
  .np-shell { --rail-w: 272px; transition: --rail-w var(--np-dur-3) var(--np-ease-in-out); }
  .np-shell[data-rail="collapsed"] { --rail-w: 76px; }
  ```
  The grid column follows `--rail-w`. Fallback for browsers without `@property`: transition `width` on the `<aside>` itself.
- Labels, group titles, badges and the party text: `opacity 0` + `translateX(-6px)` over `--np-dur-2`.
  - **On collapse** they fade out *first* (0ms delay) while the width animates.
  - **On expand** they fade in after a 120ms delay, so text never wraps mid-animation.
  - Use `white-space: nowrap; overflow: hidden` on labels.
- The collapse button icon rotates 180° over `--np-dur-3`.
- In collapsed mode each item shows a **tooltip** on hover and focus (a custom one, not `title`): it appears to the right after 300ms with a 6px slide and a 120ms fade, `role="tooltip"`, `aria-describedby`.
- Add `contain: layout paint` on `<main>` during the transition (set by a `data-animating` attribute removed on `transitionend`) so heavy pages don't relayout each frame.
- Reduced motion: no transition, instant switch.

**Breakpoints:**

| Width | Rail |
|---|---|
| ≥ 1280px | Expanded by default; the user can collapse it (persisted). |
| 1024–1279px | Collapsed by default; expanding *overlays* the content (absolute, z-30, `0 16px 40px` shadow, scrim `rgba(0,0,0,.4)` fading in) rather than pushing it. |
| 768–1023px | Always the 76px icon rail; the expand button opens the overlay version. |
| < 768px | No rail. A **bottom tab bar** (§5.3); the full rail content (party card, settings, radio, logout) opens as a **left drawer** from the avatar. |

**Drawer** (mobile, and the tablet overlay):

- `transform: translateX(-100%)` → `0` over `--np-dur-3 --np-ease-in-out`; the scrim fades in at the same time.
- Swipe-left to close is optional.
- Focus trap, `Esc` closes, focus returns to the trigger, and body scroll is locked on the scroll container (keep the existing pattern).

### 5.3 Mobile tab bar (< 768px)

- Fixed to the bottom, 64px tall + `env(safe-area-inset-bottom)`, solid `rail` bg, `1px edge` top border.
- Five tabs: **Today, Write (→ `/generate`), BhimBot, Radio, Posts**. Hindi: आज, लिखें, भीमबॉट, रेडियो, पोस्ट.
- Each tab is a 22px icon over a 12px label (14px in Hindi).
- Active tab: `neela-300` icon and label, with a 24×3px `neela-300` bar above the icon that slides between tabs (one indicator, `translateX`).
- `main` gets `padding-bottom: calc(64px + env(safe-area-inset-bottom) + 16px)`.
- Hide the bar while an input is focused (`focusin` / `focusout`) so it doesn't ride the keyboard.

---

## 6. Pages

Each page section gives the layout, the components, what to keep, and how it behaves at each size. The visual reference for each is in `design-reference/` (§12).

### 6.1 Auth layout (`components/AuthLayout.jsx`, rewritten)

- **Split screen:** a portrait panel (`flex: 1 1 520px`; Signup uses a narrower `0 1 420px`) and a form column (`flex: 1 1 520px`).
- **Portrait panel:**
  - `assets/images/ambedkar-portrait.webp`, `object-fit: cover; object-position: center 20%`, duotone: `filter: grayscale(1) contrast(1.1)`, overlaid with `#1B3CC4` at `mix-blend-mode: multiply`;
  - a bottom fade to ink;
  - a faint 560px chakra outline at 18% opacity, top-right, rotating once per 120s (static under reduced motion);
  - the bilingual quote "Educate, Agitate, Organize." / "शिक्षित बनो · संगठित रहो · संघर्ष करो" in serif 44/26px, with "Dr. B. R. Ambedkar" in a 13px label.
  - Load the image with `fetchpriority="high"` and give it `width`/`height` to avoid layout shift.
- **Form column:**
  - Top row: the wordmark (links to `/`) and an EN/हिं `Segmented` toggle.
  - Content: `max-width: 400px` (Signup 520px), vertically centred.
  - Footer: the terms line (13px muted).
- **< 768px:** the portrait becomes a 180px banner at the top (same treatment, quote hidden, wordmark over it). The form follows, with full-width controls.
- Remove `BackgroundDecorations` from auth, and use `.np-bg` on the form column.
- **Entrance:** the form's children stagger in (opacity 0→1, translateY 8px→0, 40ms apart, `--np-dur-3`), and the portrait fades in over 480ms.

### 6.2 Login (`pages/Login.jsx`)

- Order:
  1. The H1 "Log in" (display 60px, condensed) and a one-line subtitle.
  2. **Continue with Google** (`secondary` Button, 52px, Google "G" mark).
  3. An "or" divider.
  4. A tab switch (`Tabs` styled as underline tabs: a 2px `neela-300` underline that slides between them): **Phone** (default, since most users are in India on mobile) | **Email & password**.
- **Phone tab:** a `+91` prefixed input, 19px with letter-spacing .04em, a helper line, and a primary **Send code** button with an arrow icon.
- **Email tab:** email and password fields (keep the `PasswordInput` show/hide), "Forgot password?" right-aligned under the password field, and a primary **Log in** button.
- **Keep:** all existing logic (OTP redirect, `otp_required` handling, Google flow, `auth_redirect`, `friendlyError` messages shown in an inline critical-bordered alert under the form, test-account quick-fill block when `VITE_TEST_PASSWORD` is set).
- **Footer:** "New to AmbedkarGPT? **Create an account** · 3 quick steps".

### 6.3 Signup → three steps (`pages/Signup.jsx`)

This is a wizard on one route with internal `step` state (1 → 3). Keep each step's values in component state, so Back never loses input.

- **Header:**
  - "Step N of 3", with a **Chakra progress ring** (40px, value = step/3) and the step names Account · Where you are · Party & role.
  - Completed steps get a check icon; the current one is bold.
  - Moving forward slides the content left (§7.5); moving back slides it right.
- **Step 1, Account:**
  - The Phone | Email tabs as on Login.
  - Email: email, password and confirm password.
  - Phone: phone only.
  - Optional phone when email is primary (as today).
  - Continue validates this step only.
- **Step 2, Where you are:** State and City (city disabled until a state is chosen; keep `utils/indianStatesCities.js`) and optional date of birth.
- **Step 3, Party & role:**
  - **Party cards** in a grid (`repeat(auto-fit, minmax(200px,1fr))`), from `POLITICAL_PARTIES` (only `available: true`; today that's Congress and Samajwadi):
    - each card is a `role="radio"` button: 84px round **party logo**, the party name (18px 700) and the Hindi name below in muted 15px;
    - the selected card has a `1.5px neela-300` border, a `raised` bg and a check badge in the corner;
    - hover lifts it (§7.3).
  - Then the role selects (party wing + level, `utils/partyRoles.js`).
  - Then a **brass-bordered confirmation panel** with the existing "choose carefully / can be set only once" copy and a required checkbox "I understand this can't be changed later".
  - Then the marketing opt-in and terms checkboxes (existing).
  - Then **Back** (secondary) + **Create account** (primary). Create account is disabled until the checkbox and terms are ticked.
- **Submit:** the existing `signupWithEmail` / `signupWithPhone` calls and the OTP navigation are unchanged. Google signup stays available on step 1. If the Google account has no party, route it to the onboarding party step (today that's `/profile-setup` onboarding mode; §6.6).

### 6.4 OTP (`pages/Otp.jsx`)

- Same auth layout. "Enter the code", then "Sent to +91 98765 43210 · **Change**".
- **Six digit boxes:**
  - each 56×64px, radius 10px, mono 26px;
  - filled boxes: `raised` bg;
  - focused box: `neela-300` border plus the focus ring.
- **Keep the existing behaviour:**
  - paste fills all boxes;
  - auto-advance and backspace;
  - phone users get a **call**, so the copy says "You'll get a call with a 6-digit code";
  - the resend countdown stays **30s**. It shows as a small Chakra progress ring plus "Resend in 0:24" in mono, and becomes a ghost "Call me again" / "Resend code" button.
- **Verify:** primary, full width.
- **On error:** the boxes do a 6px horizontal shake (3 cycles, 300ms), and the critical message appears below.
- **On success:** the boxes turn `success` for 300ms, then navigate.

### 6.5 Forgot password (`pages/ForgotPassword.jsx`)

- Same layout and keeps today's flow (it goes straight to `/otp`).
- Restyle the form: the heading, a subtitle, an email or phone field, and a primary "Send code" button.
- Show an inline success panel (`1px success` border, radius 12px, check icon) for the moment between submit and navigation, so the jump to `/otp` doesn't feel abrupt.
- "Back to log in" link.

### 6.6 Onboarding: Questionnaire (`pages/Questionnaire.jsx`) and ProfileSetup onboarding mode

**Onboarding layout** (shared by both):

- No rail. `.np-bg`.
- A top bar with the wordmark, a **5-part segmented progress bar** (each part a 6px-tall radius-3px segment, filled `neela-300` with a 320ms fill animation), "Question 3 of 5" (mono numbers), and a **Finish later** ghost link. That link keeps the existing "prompted once per session" semantics in `ProtectedRoute`.

**Questionnaire** (one question per screen; keep the existing question sets, answers and save calls):

- **Left (or full width on mobile):**
  - the question in display 40px condensed (Hindi 42/1.3);
  - answers as large cards in a 2-column grid (1 column < 640px). Each card is radius 14px, `desk` bg, edge border, 20px padding, with a mono key hint `1`–`5` at top-left and the answer text in 17px;
  - a selected card gets a `1.5px neela-300` border, a `raised` bg and a check;
  - keys `1`–`5` select, and `Enter` goes Next;
  - an odd last option spans both columns.
  - Back (secondary) and Next (primary) buttons sit at the bottom; on the last question Next becomes "Finish".
- **Right (≥ 1024px):**
  - a tilted `Paper` card, "Your voice, so far", showing a short sample post that reflects the answers so far;
  - **implementation:** a small lookup of sentence fragments keyed by answer id, no API call. Highlight the most recently changed line with a brass underline that draws in (`background-size` 0→100% over 480ms);
  - under it, "Shaped by", listing the previous answers (muted 14px).
  - Hidden below 1024px.
- **Transitions between questions:** the outgoing question fades and slides 24px left, then the incoming one slides in from 24px right (§7.5). Progress segments fill.
- **Finish:** the existing redirect logic (`auth_redirect` or dashboard), and `clearPendingQuestions()` as today.

**ProfileSetup** (`/profile-setup`):

- In **onboarding mode** (`isOnboarding`), render it in this onboarding layout as "Step: Your details" with the same field styling as Settings → Profile. Keep `nextRoute` logic.
- In **edit mode**, redirect to `/settings?tab=profile` (§6.10).

### 6.7 Dashboard → "Today" (`pages/Dashboard.jsx`)

Reorder to put the action first. Keep the data sources (news, posts, quota, profile answers).

1. **Header:** the date eyebrow in serif ("Monday, 12 October", locale-aware) and "Good evening, Bhargav" (time-of-day greeting; display-xl). Remove "Your AI journey continues…".
2. **Hero row** (flex-wrap; the story card `flex: 2 1 520px`, the side column `flex: 1 1 300px`):
   - **Top story card:**
     - eyebrow: a "Top story" brass tag (ink text on brass, radius 6px), the category in its colour, then the source · time in mono;
     - headline in serif 42px (Hindi 1.35 line-height);
     - summary 17px `text-2`, max 640px;
     - actions: primary **Write a post** (→ the generator with this story, the same navigation `TopStoryCarousel` uses today) and secondary **Ask BhimBot about this** (→ `/bhimbot` with the headline prefilled through router state);
     - the **party symbol** watermark: absolute, bottom-right, 230px tall, opacity .07.
     - Keep the carousel behaviour if there are several top stories: dots plus a swipe on mobile, cross-fade 320ms.
   - **Side column:**
     - **Quota card:** a 104px Chakra progress ring with the remaining number in mono 28px in the centre, "3 posts left today", and "2 of 5 used · resets at midnight".
     - **Milestone card** (replaces the orange `MilestoneBanner` on in-scope screens; keep the banner on landing): `1px brass` border, "₹2,000 milestone", "42/200" in mono, a 10px brass progress bar (radius 5px) that animates its width on mount, and "158 posts to go. At 5 a day, that's about 32 days." (computed).
3. **"The wire"** (`SectionHeader` with a `Segmented` filter All / Party / Opposition / General on the right):
   - Rows: time (mono 14 muted, 64px) · tag (100px, with the party symbol 20px: hand/cycle for the user's party, lotus for opposition) · headline (serif 20, flex) · **Write** (secondary sm).
   - Rows are separated by 1px rules. Hovering a row gives a `raised` bg and slides the Write button's arrow 4px.
   - Show 5 rows and a "See all N stories →" link.
   - On mobile, the tag sits above the headline and Write becomes a 44px icon button.
4. **Bottom row:**
   - **"Finish your drafts":** the 3 latest drafts as `Paper` cards (tilts −1, .8, −.5 deg), each with the platform name, a `draft` stamp, a 3-line serif excerpt (line-clamp) and "Edited 20 min ago". Clicking opens the post in My posts.
   - **"This week":** a 7-bar mini chart (today's bar `neela-300`, others `rule-strong`, radius 4px top, bars grow from 0 on mount, staggered 30ms) and a streak line with a brass mono number.
   - **Remove** the big line and bar charts, the categories pie, the stat-card row and the "Preferences Set" tile from the dashboard. If the owner wants analytics later, they become their own page.
5. **Empty and new-user states:**
   - no drafts → an `EmptyState` "Your drafts will appear here" with a Write button;
   - no news → a Chakra spinner, then "News is being gathered".

### 6.8 Create / Services (`pages/ServiceSelection.jsx`)

- Header: "What do you want to make?".
- **Two big live tiles** in a 2-column grid (1 column on mobile), each a `Card interactive` with radius 20px and 32px padding:
  - a 56px icon in a radius-14px tinted square, the title in display 32, one line in `text-2` 17px, and a round 48px arrow button bottom-right;
  - **Social media post:** `1.5px neela` border and a filled arrow. Text: "From today's news to a ready post". It links to the existing generator.
  - **Music:** secondary arrow. Text: "Lyrics, beats and full tracks".
- **"On the way":** a ruled list of the remaining services from `ServiceSelection.jsx` (Podcast, Political Speech, Video, Editorial, Debate Analysis…). Each row has the icon, name, one line, and a **Notify me** toggle button (secondary sm; when on, it becomes "You'll be notified" with a check and `success` text).
  - Persist notify choices in `localStorage` for now (no API exists), wrapped in try/catch.
  - No "Coming soon" badges anywhere.
- Remove the search box and the sort dropdown; with 2 live tools they add nothing.

### 6.9 My posts (`pages/PostHistory.jsx`)

Rename to **My posts** / **मेरी पोस्ट** in nav and title. Keep every action and API call.

- **Header:** "My posts" and the counts.
- **Toolbar:** a search field (with the existing search behaviour), a `Segmented` filter All / Drafts / Published / Archived with mono counts, and a `Segmented` view switch **Grid | List** (persisted in `localStorage`).
- **Grouped by day:**
  - day headers "Today", "Yesterday", "Fri, 9 Oct" as small `SectionHeader`s;
  - **fix the date locale bug:** format with the *UI* language (`lang === 'hi' ? 'hi-IN' : 'en-IN'`). Today English screens show Hindi month names.
- **Grid view:** `Paper` cards (`repeat(auto-fill, minmax(260px, 1fr))`, gap 20px). Each card:
  - the platform label at top-left and a `Stamp` at top-right;
  - a serif excerpt, 6-line clamp;
  - hashtags in `#2240B8` 600;
  - a footer with the time in mono, **one primary action** (Publish for drafts, Copy for published; Copy morphs to a check, §7.7), and a `⋯` icon button.
- **List view:** compact ruled rows: platform · excerpt (1 line) · status stamp · time · actions.
- **`⋯` menu:**
  - a popover (radius 12px, `desk` bg, edge border, menu shadow) with **Listen**, **Translate** (keep the current direction: Hindi posts translate to English), **Read full post** and **Archive**;
  - the menu scales from .96 and fades in over 160ms from the trigger corner;
  - full keyboard menu semantics (`role="menu"`, arrows, Esc).
- **Archive/delete:** the current "Archive" action calls `deletePost`. Show only **Archive**, with a confirm toast "Post archived · Undo" (undo within 5s, then call the API). Do not add a separate Delete item.
- **Read full post:** opens a centred modal with the post on large paper (or a bottom sheet on mobile) and the existing full action set.
- **Empty state:** "No posts yet", with a Write your first post button.

### 6.10 Settings (new `pages/Settings.jsx`, route `/settings`)

This replaces the Profile page and the Preferences page.

- **Redirects:**
  - `/preferences` → `/settings?tab=voice`;
  - `/profile-setup` in edit mode → `/settings?tab=profile`;
  - update `ProfileMenu`, `PreferencesCard`, `ProfileCard`, `DashboardShell.ACTIVE_BY_PATH` and any `navigate('/preferences' | '/profile-setup')` **outside the post generator**. The generator keeps its links; the redirects cover them.
- **Header:** "Settings". Below it, `Tabs`: **Profile · Your voice · Accounts · Language**, synced to `?tab=`. The panel cross-fades on change (opacity + 8px translateY, 200ms).
- **Layout of each tab:** sections where the label column (280px: title 18px 600 plus a one-line muted description) sits next to the content column. They stack on mobile, and sections are separated by 1px rules.
- **Profile tab** (logic from `ProfileSetup.jsx`):
  - full name with a counter `14/100`, username with an `@` prefix and a counter, state and city, optional date of birth;
  - then a **locked "Party & role" block**: 32px party logo, the party name and role in display 24px, a brass lock icon, "Your party and role were set when you joined and can't be changed here.", and a **Contact us to change** link (→ `/contact`).
  - **Save changes** (primary) is sticky at the bottom of the panel on mobile and appears only when the form is dirty; it slides up over 200ms.
- **Your voice tab** (logic from `Preferences.jsx`):
  - the preference questions as grouped `Segmented` or `Chip` rows, plus the existing "answered x / y" meter (5-segment style) and **Reset to defaults** (ghost);
  - the same save behaviour as today.
- **Accounts tab:** the existing `components/publish/ConnectedAccounts.jsx` logic, restyled: a Reddit row with logo, status and a Connect/Disconnect button. The design should make room for more platforms later.
- **Language tab:** two large radio cards, English and हिंदी, each showing a sample sentence in that language. Selecting one calls `changeLanguage`.
- **Log out** sits at the bottom of the Profile tab as a `danger` ghost button, as well as in the avatar menu.

### 6.11 BhimBot (`pages/BheemBot.jsx`)

Now inside the shell. Keep `sendChatMessage`, history and language handling.

- **Layout:** a chat column (max 820px, centred), plus a right column on ≥ 1280px (280px) with "Categories": the 4 real categories and their descriptions from `BheemBot.jsx`. Clicking one inserts a starter question.
- **Header:** "BhimBot" and its one-line description.
- **Messages:**
  - **user:** right-aligned, `raised` bg, radius 16px with the bottom-right corner at 6px, 16px text, max 80%;
  - **bot:** on **`Paper`** (radius 16px, top-left corner 6px), serif 18px / 1.6 (Hindi 19 / 1.7);
    - below it, **source chips** where the API returns sources (if it doesn't, omit them; don't invent any);
    - an action row: **Turn this into a post** (primary sm → `/generate/social-media` with the answer in router state; the generator may ignore it for now), **Listen** (existing TTS) and **Copy**.
  - **Thinking state:** a 24px Chakra spinner and "Reading Ambedkar's writings…" in muted italic serif.
  - **Streaming:** if the response is not streamed, reveal the answer with the §7.6 "print" effect.
- **Empty state:** the chakra, "Ask about the Constitution, Ambedkar's writings or social justice.", then the 4 categories as cards (2×2 grid) and 4 starter chips.
- **Composer** (sticky bottom):
  - an auto-growing textarea (radius 14px, 1–6 rows), a **56px round mic button** labelled "Speak in Hindi" / "बोलकर पूछें" (keep the existing voice input if present; otherwise show it disabled with a tooltip), and a send button (48px, neela);
  - `Enter` sends, `Shift+Enter` adds a newline;
  - the disclaimer line below it in 13px muted.
- **Mobile:** the composer sits above the tab bar; the starter chips scroll horizontally.

### 6.12 Bhim Radio (`pages/BhimRadio.jsx`, `components/radio/*`)

This already fits the direction. Change little:

- Replace the radio tokens (`radioTokens.js`) with the `np` tokens: accent `#1D7AFC` → `neela`. Corners go from square to the ladder (10px buttons, 16px panels).
- **Desk view:**
  - an **ON AIR lamp** (8px critical dot that pulses opacity .5↔1 over 2s while playing);
  - a **280px Chakra dial** that rotates slowly while playing (1 turn / 60s) and stops when paused (pause the animation; don't reset it);
  - the progress arc around the dial = bulletin progress;
  - the story title in serif 28, the transcript in `text-2`;
  - a scrubber (6px track, radius 3px, `neela-300` fill, a 16px thumb that appears on hover/focus), with times in mono;
  - transport: back 15s, a 64px round play/pause, forward 15s.
- **Running order** (right column; it moves below on < 1024px):
  - ruled rows with the air time in mono and the headline in serif;
  - the current row has `active` bg, a "NOW" brass tag and a 3px `neela-300` left bar;
  - clicking a row seeks to it (existing logic).
- **Off-air state:** the static chakra, "Next bulletin at 06:00" (computed from existing schedule data if available; otherwise the existing copy) and a **Remind me** secondary button (`localStorage` flag for now).
- Hide the rail's mini-player on this route.

### 6.13 Music studio (`pages/MusicGeneration.jsx`, `MusicGenerationStudio.jsx`)

Now inside the shell.

- Replace the rainbow gradient title with a plain display H1, "Music studio".
- **Three mode cards** (Lyrics / Beat & Lyrics / Song only, real copy):
  - flat `Card interactive`, each with a line-drawn icon (lyric sheet, cassette, record) at 48px in `neela-300`;
  - a selected card gets a `1.5px neela-300` border;
  - "Most popular" becomes a small brass tag.
- **Studio result player** (Radio style):
  - a 64px play button, the title, and a **waveform of ~48 bars** (2px wide, gap 2px, heights from the audio peaks if available, otherwise a seeded pseudo-random array). Played bars are `neela-300`; the rest `rule-strong`;
  - clicking a bar seeks;
  - time in mono;
  - **lyrics on `Paper`** in serif, with the current line underlined in brass (it moves with playback when timestamps exist; otherwise it's static).

---

## 7. Motion catalogue

All of these are wrapped in `@media (prefers-reduced-motion: no-preference)` or have a reduced-motion override.

**7.1 Page transitions.**

- Inside the shell, keep the shared key (`APP_PATHS`) so the rail never remounts.
- Use React Router's `viewTransition` on `<Link>`/`navigate` for in-app moves where the browser supports it, with this CSS:
  ```css
  ::view-transition-old(np-main) { animation: np-fade-out 160ms var(--np-ease-out) both; }
  ::view-transition-new(np-main) { animation: np-fade-up 240ms var(--np-ease-out) both; }
  main.np-main { view-transition-name: np-main; }
  @keyframes np-fade-out { to { opacity: 0; } }
  @keyframes np-fade-up { from { opacity: 0; transform: translateY(8px); } }
  ```
- **Story → generator:** give the top-story headline `view-transition-name: story-headline` so it morphs into the generator's story title. This only works if the generator element has the same name. Since the generator is out of scope, skip the morph for now and leave a `TODO(generator)` comment.
- Without View Transitions support, fall back to the current `page-enter` fade.

**7.2 Buttons.**

- Hover: background colour change over `--np-dur-1`.
- Primary hover: `neela-600`, and the icon nudges `translateX(2px)` (arrow) or `rotate(90deg)` (plus).
- Active: `neela-700` + `translateY(1px)`.
- No glow, no lift.

**7.3 Interactive cards.**

- Hover: `translateY(-2px)`, border `rule-strong`, over `--np-dur-2 --np-ease-out`.
- Active: `translateY(0)`.
- The `⋯`, arrow and other trailing affordances fade from .7 to 1 opacity.

**7.4 Lists.** On first render, rows fade up 6px with a 30ms stagger (max 8 rows staggered; the rest appear together). Don't animate re-renders, and don't replay on filter changes.

**7.5 Steps** (signup, questionnaire, settings tabs). Direction-aware slide:

- outgoing: `opacity 0, translateX(∓24px)`, 160ms;
- incoming: from `±24px`, 240ms `--np-ease-out`;
- focus moves to the new step's heading (`tabIndex={-1}`).

**7.6 "Print" reveal** (BhimBot answers, and anywhere paper text appears after loading):

- Split by line or sentence; each fades from opacity 0 and `translateY(4px)`, 60ms stagger, max 1.2s total.
- Then the `Stamp`, where present, lands: from `scale(1.4) rotate(-12deg) opacity 0` to `scale(1) rotate(-6deg) opacity 1` over `--np-dur-4 --np-spring`.

**7.7 Copy → check.** The icon cross-fades to `Check` (scale .6→1, 200ms spring), and the label becomes "Copied" for 1.6s.

**7.8 Live meters.** The radio level bars animate `transform: scaleY()` between .3 and 1 at different speeds (0.9–1.3s, alternate), with `transform-origin: bottom`. They run only while audio plays.

**7.9 Progress fills.** The quota ring, milestone bar and questionnaire segments animate from 0 on mount over `--np-dur-4 --np-ease-out`. The chakra ring animates `stroke-dashoffset`.

**7.10 Toasts.** Bottom-centre on mobile, bottom-right on desktop. Radius 12px, `desk` bg, edge border. They slide up 12px and fade in, and auto-dismiss in 4s (5s with Undo).

**7.11 Remove on in-scope routes:** `CustomCursor` and `ScrollProgress` (keep them on the landing page by rendering them only on public marketing paths), and `TransitionCurtain` for in-app navigation. The opening splash stays on the landing page only (as today).

---

## 8. Responsive matrix

| Element | < 640 | 640–767 | 768–1023 | 1024–1279 | ≥ 1280 |
|---|---|---|---|---|---|
| Rail | none (tab bar + drawer) | none (tab bar + drawer) | 76px icon rail, overlay expand | 76px default, overlay expand | 272px, collapsible |
| Page padding | 16px | 20px | 32px | 40px | 48px |
| Display-xl | 36 | 40 | 48 | 52 | 56 |
| Dashboard hero | stacked | stacked | stacked | story 2/3 + side 1/3 | same |
| Wire row | tag above headline, icon Write | same | inline | inline | inline |
| Drafts | 1 col, horizontal scroll-snap | 2 col | 2 col | 3 col | 3 col |
| Auth | portrait banner 180px + form | same | split 45/55 | split | split |
| Questionnaire sample card | hidden | hidden | hidden | right column | right column |
| BhimBot categories column | in empty state only | same | same | same | right column |
| Settings sections | label above content | same | label left 220px | 280px | 280px |
| Radio running order | below the player | below | below | right column | right column |

- Use `100dvh`, never `100vh`, for full-height shells, because of mobile browser bars.
- Test at **360×740** (common Android), 390×844, 768×1024, 1280×800 and 1440×900, in **EN and HI**.

---

## 9. New and changed copy (add to both `i18n/en.js` and `i18n/hi.js`)

Every visible string goes through `t()`. Suggested keys and text:

| Key | EN | HI |
|---|---|---|
| `np.nav.workspace` | Workspace | कार्यक्षेत्र |
| `np.nav.learn` | Learn & listen | सीखें और सुनें |
| `np.nav.today` | Today | आज |
| `np.nav.create` | Create | बनाएँ |
| `np.nav.myPosts` | My posts | मेरी पोस्ट |
| `np.nav.music` | Music studio | संगीत स्टूडियो |
| `np.nav.newPost` | New post | नई पोस्ट |
| `np.nav.settings` | Settings | सेटिंग्स |
| `np.nav.collapse` / `expand` | Collapse sidebar / Expand sidebar | साइडबार छोटा करें / साइडबार बड़ा करें |
| `np.nav.live` | LIVE | लाइव |
| `np.quota.today` | Posts today | आज की पोस्ट |
| `np.quota.left` | {n} posts left today | आज {n} पोस्ट बाकी |
| `np.quota.used` | {used} of {limit} used · resets at midnight | {limit} में से {used} इस्तेमाल · आधी रात को रीसेट |
| `np.greet.morning/afternoon/evening` | Good morning / Good afternoon / Good evening, {name} | सुप्रभात / नमस्ते / शुभ संध्या, {name} |
| `np.dash.topStory` | Top story | मुख्य ख़बर |
| `np.dash.write` | Write a post | पोस्ट लिखें |
| `np.dash.askBot` | Ask BhimBot about this | इस पर भीमबॉट से पूछें |
| `np.dash.wire` | The wire | ताज़ा ख़बरें |
| `np.dash.seeAll` | See all {n} stories | सभी {n} ख़बरें देखें |
| `np.dash.drafts` | Finish your drafts | अधूरे ड्राफ़्ट पूरे करें |
| `np.dash.week` | This week | इस हफ़्ते |
| `np.dash.streak` | day streak, keep it going | दिन लगातार, जारी रखें |
| `np.milestone.title` | ₹2,000 milestone | ₹2,000 का लक्ष्य |
| `np.milestone.togo` | {n} posts to go. At {perDay} a day, that's about {days} days. | {n} पोस्ट बाकी। रोज़ {perDay} के हिसाब से लगभग {days} दिन। |
| `np.stamp.draft` / `published` | Draft / Published | ड्राफ़्ट / प्रकाशित |
| `np.filter.all/party/opposition/general` | All / Party / Opposition / General | सभी / पार्टी / विपक्ष / सामान्य |
| `np.auth.login` | Log in | लॉग इन |
| `np.auth.loginSub` | Pick up where you left off on today's news. | आज की ख़बरों पर वहीं से शुरू करें जहाँ छोड़ा था। |
| `np.auth.sendCode` | Send code | कोड भेजें |
| `np.auth.newHere` | New to AmbedkarGPT? | AmbedkarGPT पर नए हैं? |
| `np.auth.threeSteps` | 3 quick steps | 3 आसान चरण |
| `np.signup.step` | Step {n} of 3 | चरण {n} / 3 |
| `np.signup.s1/s2/s3` | Account / Where you are / Party & role | खाता / आप कहाँ हैं / पार्टी और भूमिका |
| `np.signup.confirm` | I understand this can't be changed later | मैं समझता/समझती हूँ कि इसे बाद में बदला नहीं जा सकता |
| `np.otp.title` | Enter the code | कोड दर्ज करें |
| `np.otp.resendIn` | Resend in {time} | {time} में फिर भेजें |
| `np.q.progress` | Question {n} of {total} | प्रश्न {n} / {total} |
| `np.q.finishLater` | Finish later | बाद में पूरा करें |
| `np.q.voiceSoFar` | Your voice, so far | अब तक आपकी आवाज़ |
| `np.services.title` | What do you want to make? | आज क्या बनाना है? |
| `np.services.onTheWay` | On the way | जल्द आ रहा है |
| `np.services.notify` / `notified` | Notify me / You'll be notified | मुझे बताएँ / आपको बताया जाएगा |
| `np.posts.archived` | Post archived | पोस्ट संग्रहित |
| `np.common.undo` | Undo | वापस लें |
| `np.settings.tabs.*` | Profile / Your voice / Accounts / Language | प्रोफ़ाइल / आपकी आवाज़ / खाते / भाषा |
| `np.settings.locked` | Your party and role were set when you joined and can't be changed here. | आपकी पार्टी और भूमिका जुड़ते समय तय हुई थीं और यहाँ बदली नहीं जा सकतीं। |
| `np.settings.contact` | Contact us to change | बदलने के लिए हमसे संपर्क करें |
| `np.bot.thinking` | Reading Ambedkar's writings… | अंबेडकर के लेखन पढ़ रहे हैं… |
| `np.bot.toPost` | Turn this into a post | इसे पोस्ट बनाएँ |
| `np.bot.speak` | Speak in Hindi | बोलकर पूछें |
| `np.radio.next` | Next bulletin at {time} | अगला बुलेटिन {time} बजे |
| `np.radio.remind` | Remind me | मुझे याद दिलाएँ |

The Hindi above is a starting point. **Ask the owner to review all Hindi copy before release.**

---

## 10. Decisions already made and known bugs

- **Party list:** show only `available: true` parties, which today means Congress and Samajwadi, with their logos. Don't show the full list.
- **Party symbols:** use `public/party-symbols/*` (white line art) as watermarks and next to news tags, and `public/party-logos/*` (round colour badges) for identity (rail card, signup cards, settings).
- **Phone OTP is a call**, and the resend timer is 30s. Copy must say so.
- **Archive = delete** in the API. Show one "Archive" action with Undo. No separate Delete.
- **Date locale bug** in post history: format dates in the UI language.
- **Preferences + Profile → Settings.** `/preferences` and `/profile-setup` (edit mode) redirect.
- **Sidebar "SOON" items are removed**; upcoming services live only on the Create page under "On the way".
- **Orange `MilestoneBanner`:** remove it from signed-in screens and keep it on the landing page.
- **Notify me / Remind me** have no backend yet. Use `localStorage` and mark them `TODO(api)`.

---

## 11. Order of work (each phase = one reviewable commit/PR)

1. **Foundations:** fonts, `@theme` tokens, `.np` scope, `.np-bg`, motion tokens, the Hindi overrides inside `.np`, and the `components/np/*` primitives plus the `/np-kit` dev page.
2. **Shell:** `DashboardShell` grid, Sidebar v2 (collapse, indicator, tooltips, breakpoints), the mobile tab bar and drawer, the page header, and moving BhimBot and Music into the layout route.
3. **Auth:** AuthLayout, Login, Signup wizard, OTP, Forgot password.
4. **Onboarding:** the questionnaire and the ProfileSetup onboarding mode.
5. **Dashboard** ("Today").
6. **Create** (Services) and **My posts**.
7. **Settings**, with the redirects and link updates.
8. **BhimBot**, **Bhim Radio**, **Music**.
9. **Polish:** the motion pass (§7), the responsive pass (§8), and the Hindi pass on every screen.

**After every phase:**

```bash
cd frontend
npm run lint
npm run test        # vitest
npm run build
npx playwright test # e2e: update selectors that change (e.g. /post history/ → /my posts|मेरी पोस्ट/ in dashboard-frame.spec.js); keep data-e2e hooks on the rail
```

**Manual check per screen:** EN and HI; 360px, 768px and 1440px wide; keyboard only (Tab, Shift+Tab, Esc, arrows); reduced motion on; a throttled CPU (4× in DevTools) with sidebar collapse still smooth. Confirm the landing page and `/generate/social-media` look identical to `main`.

---

## 12. Reference files

**`design-reference/`** (shipped with this file). These are the concept screens as HTML with inline styles. They don't run on their own (they need the design canvas runtime), but every colour, size, spacing and string is readable in the markup. Treat them as the visual spec. Where this document and a mockup disagree, **this document wins**: the mockups predate some decisions, e.g. the generator is out of scope here.

| File | Screen |
|---|---|
| `Main.dc.html` | Design rationale and system (tokens, type, motion) |
| `Rail.dc.html` | Sidebar v2 (props `current`, `lang`) |
| `Login.dc.html`, `Signup.dc.html`, `Otp.dc.html`, `ForgotPassword.dc.html` | Auth |
| `Questionnaire.dc.html` | Onboarding |
| `Dashboard.dc.html`, `DashboardHi.dc.html` | Today (EN and HI) |
| `Services.dc.html` | Create |
| `PostHistory.dc.html` | My posts |
| `Settings.dc.html` | Settings |
| `BhimBot.dc.html`, `BhimRadio.dc.html`, `Music.dc.html` | Tools |
| `Phone.dc.html` | Mobile: home, writing, Hindi BhimBot |
| `Generator.dc.html` | **Not to implement now**; kept for context only |

Image URLs in the mockups (`/_blob/…`) point to copies of repo assets:

| Mockup URL | Repo asset |
|---|---|
| `/_blob/d49c9099…` | `src/assets/images/ambedkar-portrait.webp` |
| `/_blob/bf87891e…` | `public/party-logos/inc.png` |
| `/_blob/4bcec940…` | `public/party-logos/sp.png` |
| `/_blob/62ef1c15…` | `public/party-symbols/congress.png` |
| `/_blob/d339d3e4…` | `public/party-symbols/samajwadi.png` |
| `/_blob/cabeabbe…` | `public/party-symbols/bjp.png` |

`assets/party-assets-preview.png` shows these assets side by side.

**In the repo:**

- `DESIGN-BRIEF.md`: the owner's brief (constraints §2, the "AI look" audit §5).
- `src/index.css` lines 70–220: Hindi typography fixes. Read them before touching fonts.
- `src/utils/politicalParties.js`, `public/party-logos/`, `public/party-symbols/`.
- `src/components/radio/*`: the screen whose spirit the whole redesign follows.

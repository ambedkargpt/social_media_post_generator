import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, FileText, Newspaper, Radio, RotateCw, Sparkles } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getNews, getTenants } from '../../api/news';
import { adaptNews, resolveTenantForUser } from '../../utils/newsTenants';
import { formatAxisDate } from '../../utils/dashboardDates';
import { getSiteLanguage } from '../../utils/siteLanguage';
import DevSourceTag from '../DevSourceTag';
import { useI18n } from '../../i18n/index.jsx';

const DWELL_MS = 6000;
const FADE_MS = 500;   // keep in step with .story-text-in / -out in index.css

// Same order and colours as the generator's section cards, so a category reads
// the same on both screens.
const SECTIONS = [
  { id: 'party',      labelKey: 'gen.partyNews',      accent: '#3f9fff' },
  { id: 'opposition', labelKey: 'gen.oppositionNews', accent: '#e5484d' },
  { id: 'general',    labelKey: 'gen.generalNews',    accent: '#f0a63a' },
];

// The party's own election symbol rather than the video's thumbnail: a
// thumbnail is whatever frame YouTube picked, so a run of them reads as noise,
// while the symbol says at a glance whose news this is. These files are alpha
// masks, so the symbol takes the section's accent instead of shipping three
// differently coloured logos.
const SYMBOLS = {
  congress:  '/party-symbols/congress.png',   // the open hand
  samajwadi: '/party-symbols/samajwadi.png',  // the cycle
  bjp:       '/party-symbols/bjp.png',        // the lotus
};

function latest(list) {
  let best = null;
  for (const a of list) {
    if (!best || new Date(a.date || 0) > new Date(best.date || 0)) best = a;
  }
  return best;
}

/**
 * One story: the party's mark on the left, the headline and its metadata on
 * the right. There is no photograph to show — the feed gives us text cut from
 * a video — so the tile is built from the brand instead: a faint grid, one
 * pool of the section's colour, and the symbol over it.
 */
function StorySlide({ slide, className = '', hidden = false }) {
  const { t, lang } = useI18n();
  const { article, accent, labelKey } = slide;
  const mask = SYMBOLS[article.tenantSlug];
  const date = article.date ? new Date(article.date) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? formatAxisDate(date, lang) : '';
  const isPress = article.contentType === 'press_conference';

  return (
    <div
      className={`flex w-full flex-col gap-4 sm:flex-row sm:items-center ${className}`}
      aria-hidden={hidden || undefined}
    >
      <div
        className="relative flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:aspect-video sm:h-auto sm:w-[200px] md:w-[224px]"
        style={{
          borderColor: `${accent}3d`,
          background: `radial-gradient(120% 100% at 50% 0%, ${accent}2b 0%, transparent 62%), linear-gradient(160deg, rgba(14,25,58,0.95) 0%, rgba(8,14,36,0.97) 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 26px ${accent}1a`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(125,175,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(125,175,255,0.10) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(70% 70% at 50% 50%, #000 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(70% 70% at 50% 50%, #000 20%, transparent 100%)',
          }}
        />
        <span
          className="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full blur-2xl"
          style={{ background: `${accent}55` }}
        />
        {mask ? (
          <span
            aria-hidden="true"
            className="story-symbol relative block h-full w-full max-h-[62px] max-w-[96px] sm:max-h-[74px] sm:max-w-[116px]"
            style={{
              backgroundColor: accent,
              WebkitMaskImage: `url(${mask})`,
              maskImage: `url(${mask})`,
              filter: `drop-shadow(0 8px 18px ${accent}59)`,
            }}
          />
        ) : (
          <Newspaper
            size={52}
            strokeWidth={1.4}
            aria-hidden="true"
            className="relative"
            style={{ color: accent, filter: `drop-shadow(0 8px 18px ${accent}59)` }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6fb2ff]">
            <Sparkles size={12} strokeWidth={2.2} />
            {t('dash.topStory')}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: accent, backgroundColor: `${accent}14`, border: `1px solid ${accent}3d` }}
          >
            {t(labelKey)}
          </span>
          <DevSourceTag source={article.source} />
        </div>

        {/* line-clamp hides overflow, and a tight line-height put the tops of
            Devanagari matras (ि ी े) outside the box, so Hindi headlines lost
            them. The taller line and the padding keep them inside. */}
        <h3 className="mt-1.5 line-clamp-2 pt-1 font-display text-[18px] font-semibold leading-[1.5] text-white md:text-[20px]">
          {article.title}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#7d89ad]">
          {dateText && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} strokeWidth={2} />
                {dateText}
              </span>
              <span className="h-3.5 w-px bg-[#2a3a66]" aria-hidden="true" />
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            {isPress ? <Radio size={13} strokeWidth={2} /> : <FileText size={13} strokeWidth={2} />}
            {t(isPress ? 'gen.pressConference' : 'gen.newsArticle')}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The card's own frame, so every state keeps the same box and nothing jumps. */
function StoryShell({ children, ...rest }) {
  return (
    <section className="dash-hero p-4 md:p-5" {...rest}>
      {children}
    </section>
  );
}

/**
 * The dashboard's primary action: the latest party, opposition and general
 * story, one at a time, with Generate Post for whichever is on screen.
 *
 * Reads the feed the generator reads (same party resolution, same query, same
 * language fallback), so the card never offers a story the generator's feed
 * would not.
 */
export default function TopStoryCarousel() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [articles, setArticles] = useState([]);
  const [partySlug, setPartySlug] = useState('');
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [reloadAt, setReloadAt] = useState(0);
  const retry = useCallback(() => setReloadAt(Date.now()), []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      // A tenant lookup that fails is not a failed card: without it the query
      // simply falls back to general news, which is still a story to show.
      const tenants = await getTenants().catch(() => []);
      const party = resolveTenantForUser(currentUser?.political_party, tenants ?? []);
      const scope = party ? { tenant: party.slug, includeGeneral: true, includeOpposition: true } : {};
      try {
        let rows = await getNews({ limit: 100, language: getSiteLanguage() ?? 'hi', ...scope });
        if (!rows?.length) rows = await getNews({ limit: 100, ...scope });
        if (cancelled) return;
        setPartySlug(party?.slug ?? '');
        setArticles((rows ?? []).map(adaptNews));
        setStatus('ready');
      } catch {
        if (cancelled) return;
        setArticles([]);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
    // lang: the site language decides which stories the feed returns.
  }, [currentUser?.political_party, lang, reloadAt]);

  // One story per category, the latest in each. A category with nothing in it
  // is left out, so the card never cycles onto an empty slide.
  const slides = useMemo(() => {
    const pick = {
      party:      partySlug ? latest(articles.filter((a) => a.tenantSlug === partySlug)) : null,
      opposition: latest(articles.filter((a) => a.tenantSlug === 'bjp')),
      general:    latest(articles.filter((a) => a.tenantSlug === 'general')),
    };
    return SECTIONS.filter((s) => pick[s.id]).map((s) => ({ ...s, article: pick[s.id] }));
  }, [articles, partySlug]);

  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const leaveTimer = useRef(null);

  const count = slides.length;
  const safeIndex = count ? Math.min(index, count - 1) : 0;
  const current = count ? slides[safeIndex] : null;
  const leavingSlide = leaving !== null && leaving < count && leaving !== safeIndex ? slides[leaving] : null;
  const paused = hovered || focused || pageHidden;

  function goTo(target) {
    if (count < 2 || target === safeIndex) return;
    clearTimeout(leaveTimer.current);
    setLeaving(safeIndex);
    setIndex(target);
    leaveTimer.current = setTimeout(() => setLeaving(null), FADE_MS + 50);
  }

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const id = setTimeout(() => goTo((safeIndex + 1) % count), DWELL_MS);
    return () => clearTimeout(id);
  }, [paused, count, safeIndex]);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(leaveTimer.current);
    };
  }, []);

  // Opens the generator on the story on screen at the moment of the click,
  // ready to generate; the user starts generation there. Hovering the card
  // pauses the rotation, so the story cannot change under the pointer.
  function handleGenerate() {
    if (!current) return;
    navigate('/generate/social-media', {
      state: { topStory: { newsId: current.article._backendId, section: current.id } },
    });
  }

  // Every state below keeps the same card box, so the page does not reflow
  // when the feed answers.
  if (status === 'loading') {
    return (
      <StoryShell aria-busy="true">
        <div className="flex animate-pulse flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="aspect-video w-full rounded-xl bg-[#13204a] sm:w-[200px] md:w-[224px]" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-40 rounded bg-[#13204a]" />
              <div className="h-5 w-3/4 rounded bg-[#13204a]" />
              <div className="h-3 w-32 rounded bg-[#13204a]" />
            </div>
          </div>
          <div className="h-[52px] w-full rounded-xl bg-[#13204a] lg:w-[240px]" />
        </div>
      </StoryShell>
    );
  }

  if (status === 'error') {
    return (
      <StoryShell>
        <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
          <AlertTriangle size={24} strokeWidth={1.7} className="text-[#e5a23a]" />
          <h3 className="font-display text-[16px] font-semibold text-white md:text-[18px]">
            {t('dash.storyUnavailable')}
          </h3>
          <p className="max-w-[46ch] text-[13px] text-[#8b94b8]">{t('dash.storyUnavailableBody')}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-1 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2a4375]/80 bg-[#0d1531]/80 px-5 text-[13px] font-semibold text-white transition hover:border-[#4d8bff]/70 hover:bg-[#14204a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6fb2ff]/70"
          >
            <RotateCw size={14} strokeWidth={2.2} />
            {t('common.retry')}
          </button>
        </div>
      </StoryShell>
    );
  }

  // Nothing in any category: no card rather than an empty one.
  if (!current) return null;

  return (
    <StoryShell
      aria-roledescription="carousel"
      aria-label={t('dash.topStoryRegion')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        {/* Only the story cross-fades. The button and the dots stay put, so the
            thing being clicked is never the thing moving. */}
        <div className="relative min-w-0 flex-1 overflow-hidden" aria-live={paused ? 'polite' : 'off'}>
          <StorySlide
            key={`in-${current.id}-${current.article.id}`}
            slide={current}
            className={leavingSlide ? 'story-text-in' : ''}
          />
          {leavingSlide && (
            <StorySlide
              key={`out-${leavingSlide.id}-${leavingSlide.article.id}`}
              slide={leavingSlide}
              className="story-text-out absolute inset-0"
              hidden
            />
          )}
        </div>

        <div className="relative flex shrink-0 flex-col gap-2.5 lg:w-[240px]">
          {/* The strongest call to action on the dashboard, and the only one
              with light of its own behind it. */}
          <span
            className="pointer-events-none absolute -inset-3 rounded-2xl opacity-70 blur-xl"
            style={{ background: 'radial-gradient(60% 60% at 50% 30%, rgba(31,118,255,0.45), transparent 70%)' }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={handleGenerate}
            className="group relative inline-flex w-full items-center justify-center gap-3 rounded-xl btn-gradient px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(17,122,255,0.4)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_40px_rgba(17,122,255,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cc8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1330] active:translate-y-0 active:scale-[0.98]"
          >
            <Sparkles size={18} strokeWidth={2.1} />
            {t('gen.generatePost')}
            <ArrowRight size={17} strokeWidth={2.2} className="cta-arrow" />
          </button>
          <p className="relative text-center text-[12px] text-[#7d89ad]">{t('dash.socialPostDesc')}</p>

          {count > 1 && (
            <div className="relative flex items-center justify-center">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={t(s.labelKey)}
                  aria-current={i === safeIndex ? 'true' : undefined}
                  className="rounded-full p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6fb2ff]/70"
                >
                  <span
                    className="block h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === safeIndex ? 18 : 6,
                      backgroundColor: i === safeIndex ? s.accent : 'rgba(120,140,190,0.35)',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </StoryShell>
  );
}

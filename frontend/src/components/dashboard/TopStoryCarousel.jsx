import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, FileText, Newspaper, Radio, Sparkles } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getNews, getTenants } from '../../api/news';
import { adaptNews, resolveTenantForUser, youtubeId } from '../../utils/newsTenants';
import { formatAxisDate } from '../../utils/dashboardDates';
import { getSiteLanguage } from '../../utils/siteLanguage';
import { useI18n } from '../../i18n/index.jsx';

const DWELL_MS = 6000;
const SLIDE_MS = 600;   // keep in step with .story-slide-in / -out in index.css

// Same order and colours as the generator's section cards, so a category reads
// the same on both screens.
const SECTIONS = [
  { id: 'party',      labelKey: 'gen.partyNews',      accent: '#3f9fff' },
  { id: 'opposition', labelKey: 'gen.oppositionNews', accent: '#e5484d' },
  { id: 'general',    labelKey: 'gen.generalNews',    accent: '#f0a63a' },
];

function latest(list) {
  let best = null;
  for (const a of list) {
    if (!best || new Date(a.date || 0) > new Date(best.date || 0)) best = a;
  }
  return best;
}

function StorySlide({ slide, className = '', hidden = false }) {
  const { t, lang } = useI18n();
  const { article, accent, labelKey } = slide;
  const [imgFailed, setImgFailed] = useState(false);
  const vid = youtubeId(article.sourceUrl);
  const date = article.date ? new Date(article.date) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? formatAxisDate(date, lang) : '';
  const isPress = article.contentType === 'press_conference';

  return (
    <div
      className={`flex w-full flex-col gap-4 sm:flex-row sm:items-center ${className}`}
      aria-hidden={hidden || undefined}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-white/5 bg-[#0b1433] sm:w-[200px] md:w-[224px]">
        {vid && !imgFailed ? (
          <img
            src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}2e 0%, rgba(11,20,51,0.6) 100%)` }}
          >
            <Newspaper size={30} strokeWidth={1.6} style={{ color: accent }} />
          </div>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const tenants = await getTenants().catch(() => []);
      const party = resolveTenantForUser(currentUser?.political_party, tenants ?? []);
      const scope = party ? { tenant: party.slug, includeGeneral: true, includeOpposition: true } : {};
      let rows = await getNews({ limit: 100, language: getSiteLanguage() ?? 'hi', ...scope }).catch(() => []);
      if (!rows?.length) rows = await getNews({ limit: 100, ...scope }).catch(() => []);
      if (cancelled) return;
      setPartySlug(party?.slug ?? '');
      setArticles((rows ?? []).map(adaptNews));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // lang: the site language decides which stories the feed returns.
  }, [currentUser?.political_party, lang]);

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
    leaveTimer.current = setTimeout(() => setLeaving(null), SLIDE_MS + 50);
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

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-[#1e3260]/50 bg-[#0b1433]/60 p-4 md:p-5" aria-hidden="true">
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
      </div>
    );
  }

  // Nothing in any category: no card rather than an empty one.
  if (!current) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('dash.topStoryRegion')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
      className="relative mb-6 overflow-hidden rounded-2xl border p-4 md:p-5"
      style={{
        borderColor: 'rgba(63,159,255,0.24)',
        background: 'linear-gradient(135deg, rgba(15,29,70,0.92) 0%, rgba(10,18,44,0.92) 55%, rgba(8,13,32,0.92) 100%)',
        boxShadow: '0 14px 44px rgba(18,52,140,0.18)',
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        {/* Only the story moves. The button and the dots stay put, so the
            thing being clicked is never the thing sliding. */}
        <div className="relative min-w-0 flex-1 overflow-hidden" aria-live={paused ? 'polite' : 'off'}>
          <StorySlide
            key={`in-${current.id}-${current.article.id}`}
            slide={current}
            className={leavingSlide ? 'story-slide-in' : ''}
          />
          {leavingSlide && (
            <StorySlide
              key={`out-${leavingSlide.id}-${leavingSlide.article.id}`}
              slide={leavingSlide}
              className="story-slide-out absolute inset-0"
              hidden
            />
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 lg:w-[240px]">
          <button
            type="button"
            onClick={handleGenerate}
            className="group inline-flex w-full items-center justify-center gap-3 rounded-xl btn-gradient px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(17,122,255,0.35)] transition hover:brightness-110 hover:shadow-[0_12px_38px_rgba(17,122,255,0.5)] active:scale-[0.98]"
          >
            <Sparkles size={18} strokeWidth={2.1} />
            {t('gen.generatePost')}
            <ArrowRight size={17} strokeWidth={2.2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
          <p className="text-center text-[12px] text-[#7d89ad]">{t('dash.socialPostDesc')}</p>

          {count > 1 && (
            <div className="flex items-center justify-center">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={t(s.labelKey)}
                  aria-current={i === safeIndex ? 'true' : undefined}
                  className="p-1.5"
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
    </section>
  );
}

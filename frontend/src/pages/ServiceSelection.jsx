import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, X,
  ImageIcon, Video, Edit3, Music, Mic2,
  Headphones, Newspaper, Film, Scale, MonitorPlay, Trophy, Feather,
} from 'lucide-react';

import DashboardShell from '../layouts/DashboardShell';
import Topbar from '../components/dashboard/Topbar';
import PillDropdown from '../components/dashboard/PillDropdown';
import ScrollRow from '../components/ui/ScrollRow';
import ServiceCard from '../components/generate/ServiceCard';
import { useI18n } from '../i18n/index.jsx';

// `cat` is what the filter tabs read. Every service belongs to exactly one, and
// there is no tab without services behind it.
const SERVICES = [
  {
    id: 'social',
    cat: 'social',
    icon: <Edit3 size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#ff4f8a] to-[#d43a68]',
    glow: 'rgba(255,79,138,0.45)',
    route: '/generate/social-media',
  },
  {
    id: 'music',
    cat: 'media',
    icon: <Music size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#ffb056] to-[#ff7a2d]',
    glow: 'rgba(255,176,86,0.45)',
    badge: 'new',
    route: '/generate/music',
  },
  {
    id: 'podcast',
    cat: 'media',
    icon: <Headphones size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#06b6d4] to-[#0891b2]',
    glow: 'rgba(6,182,212,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'video',
    cat: 'media',
    icon: <Video size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#a855f7] to-[#7b3fd4]',
    glow: 'rgba(168,85,247,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'editorial',
    cat: 'writing',
    icon: <Newspaper size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#f59e0b] to-[#d97706]',
    glow: 'rgba(245,158,11,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'speech',
    cat: 'writing',
    icon: <Mic2 size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#22c55e] to-[#16a34a]',
    glow: 'rgba(34,197,94,0.4)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'shorts',
    cat: 'media',
    icon: <Film size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#ec4899] to-[#be185d]',
    glow: 'rgba(236,72,153,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'debate-analysis',
    cat: 'analysis',
    icon: <Scale size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#3f9fff] to-[#2664d6]',
    glow: 'rgba(63,159,255,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'debate-show',
    cat: 'media',
    icon: <MonitorPlay size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9]',
    glow: 'rgba(139,92,246,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'election',
    cat: 'campaign',
    icon: <Trophy size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#f97316] to-[#c2410c]',
    glow: 'rgba(249,115,22,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'poem',
    cat: 'writing',
    icon: <Feather size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#10b981] to-[#047857]',
    glow: 'rgba(16,185,129,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'image',
    cat: 'media',
    icon: <ImageIcon size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#6366f1] to-[#4338ca]',
    glow: 'rgba(99,102,241,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
];

// Tabs in reading order; 'all' first. Only categories that exist in SERVICES.
const CATEGORIES = ['all', 'social', 'writing', 'media', 'analysis', 'campaign'];

const SORTS = ['recommended', 'available', 'az'];

export default function ServiceSelection() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('recommended');
  const searchRef = useRef(null);

  // Ctrl/Cmd+K puts the cursor in the search field, which is what the hint in
  // the field promises.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = SERVICES.filter((s) => cat === 'all' || s.cat === cat);
    if (q) {
      list = list.filter((s) => {
        const title = t(`sel.${s.id}.title`).toLowerCase();
        const desc = t(`sel.${s.id}.desc`).toLowerCase();
        return title.includes(q) || desc.includes(q);
      });
    }
    if (sort === 'available') {
      // A stable partition: what you can use today, then the rest in their
      // curated order.
      list = [...list].sort((a, b) => Number(!!a.disabled) - Number(!!b.disabled));
    } else if (sort === 'az') {
      list = [...list].sort((a, b) => t(`sel.${a.id}.title`).localeCompare(t(`sel.${b.id}.title`)));
    }
    return list;
    // `t` changes with the language, which is what re-sorts and re-filters.
  }, [query, cat, sort, t]);

  const liveCount = SERVICES.filter((s) => !s.disabled).length;

  return (
    <DashboardShell active="generate">
      <div className="relative px-4 sm:px-6 md:px-10">
        <Topbar
          title={t('sel.title')}
          icon={<Sparkles size={15} strokeWidth={2} className="hidden shrink-0 text-[#4f7fd4] lg:block" />}
        />

        {/* ── Hero ── The page's purpose on the left, the way into it on the
            right. The search sits on the subtitle's baseline from lg up. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <p className="dash-eyebrow">{t('sel.eyebrow')}</p>
            <h1 className="mt-3 font-display text-[clamp(27px,7.6vw,33px)] font-bold leading-[1.15] tracking-tight sm:mt-2.5 sm:text-[36px] sm:leading-tight md:text-[42px]">
              <span className="text-white">{t('sel.chooseA')}</span>
              <span className="gradient-text-blue">{t('sel.chooseB')}</span>
            </h1>
            <p className="mt-3 max-w-[56ch] text-[14.5px] leading-relaxed text-[#8b94b8] sm:mt-2.5 sm:text-[14px] md:text-[15px]">
              {t('sel.sub')}
            </p>
          </div>

          <div className="relative w-full shrink-0 lg:w-[400px]">
            <Search
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5a6e9a]"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sel.searchPlaceholder')}
              aria-label={t('sel.searchPlaceholder')}
              className="h-12 w-full rounded-xl border border-[#1e3260]/80 bg-[#0b1226]/80 pl-10 pr-20 text-[14px] text-white outline-none transition placeholder:text-[#5a6e9a] focus:border-[#3f9fff]/60 focus:shadow-[0_0_0_3px_rgba(63,159,255,0.12)] sm:h-auto sm:py-3"
            />
            {query ? (
              <button
                type="button"
                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                aria-label={t('common.clear')}
                className="dash-icon-btn absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#8b94b8]"
              >
                <X size={14} strokeWidth={2} />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#2a4375]/70 px-1.5 py-0.5 font-count text-[10px] text-[#5a6e9a] sm:block">
                Ctrl K
              </span>
            )}
          </div>
        </div>

        {/* ── Filters ── The chips scroll sideways on a phone, inside their own
            row: the page itself never scrolls sideways. From sm up they wrap
            and sit beside the sort control, exactly as before. */}
        <div className="mt-4 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
          <ScrollRow className="-mx-4 gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {CATEGORIES.map((c) => {
              const on = c === cat;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={on}
                  className={[
                    'h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] transition sm:h-auto sm:px-3.5 sm:py-1.5 sm:text-[12.5px]',
                    on
                      ? 'bg-[#2563eb] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)]'
                      : 'border border-[#1e3260]/70 bg-[#0d1531]/60 font-medium text-[#8b94b8] hover:border-[#3a6bc4]/60 hover:text-white',
                  ].join(' ')}
                >
                  {t(`sel.cat.${c}`)}
                </button>
              );
            })}
          </ScrollRow>

          <PillDropdown
            value={sort}
            onChange={setSort}
            ariaLabel={t('sel.sortBy')}
            options={SORTS.map((id) => ({ id, label: `${t('sel.sortBy')}: ${t(`sel.sort.${id}`)}` }))}
          />
        </div>

        {/* The line between the controls and the results. Phones only: on a
            wider screen the grid already reads as a block of its own. */}
        <div className="mt-6 flex items-baseline justify-between gap-3 sm:hidden">
          <span className="dash-eyebrow">{t('sel.title')}</span>
          <span className="font-count text-[12px] tabular-nums text-[#5a6e9a]">{shown.length}</span>
        </div>

        {/* ── Grid ── */}
        {shown.length === 0 ? (
          <div className="dash-panel mt-5 flex flex-col items-center gap-3 px-4 py-14 text-center">
            <Search size={26} strokeWidth={1.5} className="text-[#2a3566]" />
            <p className="text-[13.5px] text-[#8b94b8]">{t('sel.noMatch')}</p>
            <button
              type="button"
              onClick={() => { setQuery(''); setCat('all'); }}
              className="mt-1 rounded-xl border border-[#2a4375]/80 bg-[#0d1531]/80 px-4 py-2 text-[12.5px] font-semibold text-white transition hover:border-[#4d8bff]/70"
            >
              {t('sel.showAll')}
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3.5 sm:mt-5 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <ServiceCard
                key={s.id}
                icon={s.icon}
                iconGradient={s.iconGradient}
                glow={s.glow}
                title={t(`sel.${s.id}.title`)}
                description={t(`sel.${s.id}.desc`)}
                badge={s.badge}
                disabled={s.disabled}
                onSelect={() => s.route && navigate(s.route)}
              />
            ))}
          </div>
        )}

        <p className="mt-6 pb-10 text-[12.5px] text-[#5a6e9a]">
          {t('sel.liveCount', { live: liveCount, total: SERVICES.length })}
        </p>
      </div>
    </DashboardShell>
  );
}

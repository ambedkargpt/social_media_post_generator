import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, PenLine } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getPosts, getDailyQuota } from '../api/posts';
import useDashboardNews from '../hooks/useDashboardNews';
import { partySymbol } from '../utils/politicalParties';
import { useI18n } from '../i18n/index.jsx';
import {
  Button, Card, Chakra, EmptyState, Paper, PageHeader, Segmented,
  SectionHeader, Skeleton, Stamp, Tag,
} from '../components/np';

/**
 * Today.
 *
 * Phase 5 of docs/redesign/neela-press.md. The data sources are the ones that
 * were here - news, posts, quota - and the route into the generator is the
 * same router state the carousel used.
 *
 * What changed is the order. This screen opened on four stat tiles reading
 * zero, then two empty charts, then a pie, then the news. Someone arriving to
 * write a post had to scroll past their own analytics to find a story. Now
 * the story is first, the quota and the milestone sit beside it, and the rest
 * of the feed is a list under it.
 *
 * The charts, the pie, the stat row and the "Preferences set" tile are gone.
 * None of them answered a question anyone had on the way in; if analytics are
 * wanted they are their own page, not the first thing between a writer and
 * the news.
 */

const MILESTONE = 200;
const MILESTONE_PER_DAY = 5;

function greetingKey(hour) {
  if (hour < 12) return 'np.greet.morning';
  if (hour < 17) return 'np.greet.afternoon';
  return 'np.greet.evening';
}

function timeOf(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

/** The story the day leads on, with the party's own symbol behind it. */
function TopStory({ story, symbol, onWrite, onAsk, t, lang }) {
  return (
    <Card style={{ position: 'relative', overflow: 'hidden', padding: 28 }}>
      {symbol && (
        <img
          className="np-top-watermark"
          src={symbol}
          alt=""
          aria-hidden="true"
        />
      )}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <Tag tone="top">{t('np.dash.topStory')}</Tag>
          <Tag tone={story.kind}>{t(`np.filter.${story.kind}`)}</Tag>
          {(story.source || story.date) && (
            <span className="np-mono" style={{ fontSize: 13, color: 'var(--color-np-faint)' }}>
              {[story.source, timeOf(story.date, lang)].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        <h2 className="np-serif np-top-headline">{story.title}</h2>

        {story.summary && (
          <p className="np-top-summary">{story.summary}</p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
          <Button onClick={onWrite} iconLeft={PenLine}>{t('np.dash.write')}</Button>
          <Button variant="secondary" onClick={onAsk} iconLeft={MessageCircle}>
            {t('np.dash.askBot')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** How much of today is left, as a ring rather than a sentence. */
function QuotaCard({ quota, t }) {
  const limit = Number(quota?.daily_limit) || 0;
  const used = Math.min(Number(quota?.daily_used) || 0, limit);
  const left = Math.max(limit - used, 0);

  return (
    <Card style={{ display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <Chakra size={104} mode="progress" value={limit ? used / limit : 0} className="np-kit-neela" />
        <span className="np-mono np-quota-ring-n">{left}</span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--color-np-text)' }}>
          {t('np.quota.left', { n: left })}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-np-muted)' }}>
          {t('np.quota.used', { used, limit })}
        </p>
      </div>
    </Card>
  );
}

/**
 * The milestone, in brass rather than in an orange strip across the top of
 * the page. The old banner shouted the same number on every screen; this
 * says the same thing once, where the other numbers are.
 */
function MilestoneCard({ total, t }) {
  const done = Math.min(total, MILESTONE);
  const togo = Math.max(MILESTONE - done, 0);
  const days = Math.max(Math.ceil(togo / MILESTONE_PER_DAY), 0);

  return (
    <Card style={{ borderColor: 'var(--color-np-brass)', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <p className="np-display" style={{ margin: 0, fontSize: 20, color: 'var(--color-np-brass)' }}>
          {t('np.milestone.title')}
        </p>
        <span className="np-mono" style={{ fontSize: 16, color: 'var(--color-np-text)' }}>
          {done}/{MILESTONE}
        </span>
      </div>
      <span className="np-milestone-track" aria-hidden="true">
        <span className="np-milestone-fill" style={{ width: `${(done / MILESTONE) * 100}%` }} />
      </span>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-np-muted)' }}>
        {t('np.milestone.togo', { n: togo, perDay: MILESTONE_PER_DAY, days })}
      </p>
    </Card>
  );
}

/** Seven bars. Today is the one in the action colour. */
function WeekChart({ posts, t, lang }) {
  const days = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const n = posts.filter((p) => {
        const at = new Date(p.created_at || p.createdAt || 0);
        return at >= d && at < next;
      }).length;
      out.push({ d, n, today: i === 0 });
    }
    return out;
  }, [posts]);

  const max = Math.max(1, ...days.map((x) => x.n));
  const streak = days.filter((x) => x.n > 0).length;
  const fmt = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'narrow' });

  return (
    <Card style={{ display: 'grid', gap: 16 }}>
      <div className="np-week">
        {days.map(({ d, n, today }, i) => (
          <span key={d.toISOString()} className="np-week-col">
            <span
              className={`np-week-bar ${today ? 'is-today' : ''}`}
              // Grown from zero on mount, staggered, so the week assembles
              // rather than appearing.
              style={{ '--h': `${(n / max) * 100}%`, animationDelay: `${i * 30}ms` }}
              title={String(n)}
            />
            <span className="np-week-label">{fmt.format(d)}</span>
          </span>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-np-muted)' }}>
        <span className="np-mono" style={{ color: 'var(--color-np-brass)', fontSize: 18, fontWeight: 600 }}>
          {streak}
        </span>{' '}
        {t('np.dash.streak')}
      </p>
    </Card>
  );
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  // One piece of state for the answer, carrying the id it answers. `loading`
  // is then derived rather than set at the top of the effect - that extra
  // render bought nothing and is what React's set-state-in-effect rule is
  // about.
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');

  const { stories, status } = useDashboardNews(currentUser?.political_party, lang);

  const userId = currentUser?.id;
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    Promise.all([
      getPosts({ limit: 100 }).catch(() => []),
      getDailyQuota().catch(() => null),
    ]).then(([p, q]) => {
      if (!cancelled) setData({ userId, posts: p ?? [], quota: q });
    });
    return () => { cancelled = true; };
  }, [userId]);

  const fresh = data?.userId === userId ? data : null;
  const posts = fresh?.posts ?? [];
  const quota = fresh?.quota ?? null;
  const loading = !fresh;

  const top = stories[0];
  const wire = useMemo(
    () => stories.slice(1).filter((s) => filter === 'all' || s.kind === filter),
    [stories, filter],
  );
  const drafts = useMemo(
    () => posts.filter((p) => (p.status || '').toLowerCase() === 'draft').slice(0, 3),
    [posts],
  );

  // The same router state the carousel sent, so the generator opens on this
  // story exactly as it did before.
  function writeAbout(story) {
    navigate('/generate/social-media', {
      state: { topStory: { newsId: story._backendId, section: story.kind } },
    });
  }

  function askAbout(story) {
    navigate('/bhimbot', { state: { prefill: story.title } });
  }

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(now);
  const name = (currentUser?.full_name || currentUser?.username || '').split(' ')[0];

  return (
    <div className="np-page">
      <PageHeader eyebrow={dateLabel} title={t(greetingKey(now.getHours()), { name })} />

      {/* ── the day's lead, and the two numbers that matter ── */}
      <div className="np-hero">
        <div className="np-hero-main">
          {status === 'loading' && (
            <Card style={{ display: 'grid', gap: 14 }}>
              <Skeleton width={140} height={14} />
              <Skeleton height={34} />
              <Skeleton height={34} width="80%" />
              <Skeleton height={16} />
            </Card>
          )}
          {status !== 'loading' && top && (
            <TopStory
              story={top}
              symbol={partySymbol(currentUser?.political_party)}
              onWrite={() => writeAbout(top)}
              onAsk={() => askAbout(top)}
              t={t}
              lang={lang}
            />
          )}
          {status !== 'loading' && !top && (
            <Card>
              <EmptyState title={t('dash.noNews')}>{t('dash.noNewsSub')}</EmptyState>
            </Card>
          )}
        </div>

        <div className="np-hero-side">
          {quota && <QuotaCard quota={quota} t={t} />}
          <MilestoneCard total={quota?.total_streak_posts ?? 0} t={t} />
        </div>
      </div>

      {/* ── the rest of the feed ── */}
      <section className="np-block">
        <SectionHeader
          right={(
            <Segmented
              size="sm"
              ariaLabel={t('np.dash.wire')}
              value={filter}
              onChange={setFilter}
              options={['all', 'party', 'opposition', 'general'].map((k) => ({
                value: k, label: t(`np.filter.${k}`),
              }))}
            />
          )}
        >
          {t('np.dash.wire')}
        </SectionHeader>

        <ul className="np-wire">
          {wire.slice(0, 5).map((s) => (
            <li key={s.id} className="np-wire-row">
              <span className="np-mono np-wire-time">{timeOf(s.date, lang)}</span>
              {/* A symbol only where one means something: the lotus for the
                  opposition, the reader's own party's mark for theirs. A
                  general story belongs to nobody and gets none. */}
              <Tag
                tone={s.kind}
                symbol={s.kind === 'opposition' ? '/party-symbols/bjp.png'
                  : s.kind === 'party' ? partySymbol(currentUser?.political_party)
                    : undefined}
              >
                {t(`np.filter.${s.kind}`)}
              </Tag>
              <span className="np-serif np-wire-headline">{s.title}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => writeAbout(s)}
                iconRight={ArrowRight}
                className="np-wire-write"
              >
                {t('np.dash.write')}
              </Button>
            </li>
          ))}
        </ul>

        {wire.length > 5 && (
          <p style={{ margin: '14px 0 0' }}>
            <button
              type="button"
              onClick={() => navigate('/generate')}
              className="np-link"
            >
              {t('np.dash.seeAll', { n: wire.length })} <ArrowRight size={14} strokeWidth={2} />
            </button>
          </p>
        )}
      </section>

      {/* ── what is unfinished, and how the week went ── */}
      <div className="np-bottom">
        <section className="np-block">
          <SectionHeader>{t('np.dash.drafts')}</SectionHeader>
          {loading && <Skeleton height={120} />}
          {!loading && drafts.length === 0 && (
            <Card>
              <EmptyState
                title={t('np.dash.drafts')}
                action={<Button onClick={() => navigate('/generate')} iconRight={ArrowRight}>{t('np.dash.write')}</Button>}
              >
                {t('posts.emptyDesc')}
              </EmptyState>
            </Card>
          )}
          {!loading && drafts.length > 0 && (
            <div className="np-drafts">
              {drafts.map((p, i) => (
                <Paper
                  key={p.id || i}
                  tilt={[-1, 0.8, -0.5][i] ?? 0}
                  onClick={() => navigate('/posts')}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-np-ui)', fontSize: 13, fontWeight: 600, color: 'var(--color-np-paper-muted)' }}>
                      {p.platform || t('posts.post')}
                    </span>
                    <Stamp variant="draft">{t('np.stamp.draft')}</Stamp>
                  </div>
                  <p className="np-draft-excerpt">{p.content || p.caption || ''}</p>
                </Paper>
              ))}
            </div>
          )}
        </section>

        <section className="np-block">
          <SectionHeader>{t('np.dash.week')}</SectionHeader>
          <WeekChart posts={posts} t={t} lang={lang} />
        </section>
      </div>
    </div>
  );
}

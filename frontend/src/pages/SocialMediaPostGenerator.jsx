import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, Sparkles,
  Copy, Check, RefreshCw, ChevronDown, FileText, Star, Radio,
} from 'lucide-react';

import PreferencesPanel from '../components/generate/PreferencesPanel';
import PostContent from '../components/generate/PostContent';
import logoSrc from '../assets/images/logo-animation.png';
import { useAuth } from '../context/AuthContext';
import { getNews, getTenants } from '../api/news';
import { generatePostForNews, regeneratePostFromSnapshot, translatePost, updatePost, getDailyQuota } from '../api/posts';
import { getQuestions } from '../api/questions';
import { getProfileAnswers, saveProfileAnswers } from '../api/profile';
import { CORE_QUESTION_IDS } from '../utils/preferenceQuestions';
import { getSiteLanguage, SITE_LANGUAGES } from '../utils/siteLanguage';
import { parsePost, hashtagsText } from '../utils/parsePost';
import Spinner from '../components/Spinner';
import { useI18n } from '../i18n/index.jsx';
import SpeakButton from '../components/generate/SpeakButton';
import { toneLabel } from '../utils/displayLabel';

const TONES = ['Professional', 'Inspirational', 'Creative', 'Casual', 'Motivational'];
const ALSO_GENERATE = ['Audio', 'Shorts', 'Image'];
const CATEGORIES = ['All', 'Legacy', 'Policy', 'Education', 'Research', 'Grassroots'];

function useCountdown(resetAt) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!resetAt) return;
    function tick() {
      const diff = Math.max(0, Math.floor((new Date(resetAt) - Date.now()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setLabel(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetAt]);
  return label;
}

const PLATFORMS = [
  { id: 'twitter',   label: 'Twitter / X',  short: '𝕏',   limit: 280,  color: '#1d9bf0' },
  { id: 'instagram', label: 'Instagram',     short: 'IG',  limit: 2200, color: '#e1306c' },
  { id: 'linkedin',  label: 'LinkedIn',      short: 'in',  limit: 3000, color: '#0a66c2' },
  { id: 'whatsapp',  label: 'WhatsApp',      short: 'WA',  limit: 5000, color: '#25d366' },
];


const MIN_PANEL = 220;
const MAX_PANEL = 500;
const PAGE_SIZE = 12; // news cards per page

// Build a compact page-number list with ellipsis gaps for the pager
function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) items.push('…');
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push('…');
  items.push(total);
  return items;
}

// Preference questions shown in the right panel, in display order
const PREF_QUESTION_IDS = CORE_QUESTION_IDS;

// Map backend NewsResponse → local article shape
function adaptNews(item) {
  return {
    id:       item.id,
    _backendId: item.id, // valid MongoDB ObjectId from backend
    category: item.tags?.[0] ?? 'General',
    title:    item.headline,
    content:  item.description || item.summary,
    summary:  item.summary || item.description || '',
    source:   item.source_name || '',
    date:     item.published_at || '',
    topic:    item.summary || item.headline,
    tenantId:   item.tenant_id ?? 0,
    tenantSlug: item.tenant_slug || 'general',
    contentType: item.content_type || 'news',
  };
}

// Livestreamed briefings read differently from regular uploads, so the card
// says which it is.
const CONTENT_TYPES = {
  press_conference: { label: 'Press Conference', color: '#f0a63a' },
  news:             { label: 'News Article',     color: '#5a6e9a' },
};

// A party's own uploads are its news, not a neutral article about it, and the
// section decides which reading applies. General keeps "News Article".
function newsTypeLabel(section) {
  return section === 'party' ? 'gen.partyNews' : 'gen.newsArticle';
}

// Two standing ranges, plus a per-day jump built from the days that actually
// carry articles. A free calendar would let the user land on a day with nothing
// published; a list built from the data cannot be picked wrong.
// "Last 7 days" is gone. It was a rolling window over a feed that only ever
// holds a few days, so it selected either everything or nearly everything and
// told nobody which days those were. The day list below does that job, and
// does it from the days that actually carry articles.
const DATE_RANGES = [
  { id: 'all', label: 'All dates', days: null },
];

const DAY_PREFIX = 'day:';

function withinDays(dateValue, days) {
  if (!days) return true;
  if (!dateValue) return false;
  const t = new Date(dateValue).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 86400000;
}

// Day buckets for the feed headings. Compared on local calendar days so an
// article published late yesterday does not read as "Today" on a time diff.
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function dayGroupLabel(dateValue) {
  if (!dateValue) return 'Undated';
  const t = new Date(dateValue);
  if (Number.isNaN(t.getTime())) return 'Undated';
  // The date, always. "Today" and "Day before yesterday" sat in a list beside
  // "Sunday, Aug 30" and read as a different kind of thing, and they are the
  // one label that stops being true while the page is open: a tab left
  // overnight keeps calling yesterday's stories Today.
  return t.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

// Stable per-day identity for the day picker. Articles without a usable date
// still need a bucket, otherwise they vanish from the day list entirely.
function dayKey(dateValue) {
  if (!dateValue) return 'undated';
  const t = new Date(dateValue);
  return Number.isNaN(t.getTime()) ? 'undated' : String(startOfDay(t));
}

function dayKeyLabel(key) {
  return key === 'undated' ? 'Undated' : dayGroupLabel(Number(key));
}

function matchesDate(dateValue, filterId) {
  if (filterId.startsWith(DAY_PREFIX)) {
    return dayKey(dateValue) === filterId.slice(DAY_PREFIX.length);
  }
  return withinDays(dateValue, DATE_RANGES.find((d) => d.id === filterId)?.days ?? null);
}

// Signup stores a display name ("Indian National Congress (INC)"); the tenant
// registry keys on a slug. Match on the registry name being contained in it.
function resolveTenantForUser(partyName, tenants) {
  const raw = (partyName ?? '').trim().toLowerCase();
  if (!raw) return null;
  // The opposition tenant (BJP) is scraped to be countered, never to be
  // someone's own party — excluded here the same way it is excluded from
  // the signup party picker, so it can never become "your party" even if a
  // stray political_party value happened to match its name or slug.
  const selectable = tenants.filter((t) => !t.is_general && !t.is_opposition);
  return (
    selectable.find((t) => raw.includes(String(t.name).toLowerCase()))
    ?? selectable.find((t) => raw.includes(String(t.slug).toLowerCase()))
    ?? null
  );
}

// Accent per section so party news, opposition news and general news are
// visually distinct.
const SECTION_THEME = {
  party:      { accent: '#3f9fff', soft: 'rgba(63,159,255,0.12)', ring: 'rgba(63,159,255,0.45)' },
  opposition: { accent: '#e5484d', soft: 'rgba(229,72,77,0.12)',  ring: 'rgba(229,72,77,0.45)' },
  general:    { accent: '#f0a63a', soft: 'rgba(240,166,58,0.12)', ring: 'rgba(240,166,58,0.45)' },
};

function formatNewsDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Trim card body to a short teaser and append an ellipsis.
function truncateText(text = '', max = 160) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

export default function SocialMediaPostGenerator() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [articles,        setArticles]        = useState([]);
  const [newsLoading,     setNewsLoading]     = useState(true);
  const [newsError,       setNewsError]       = useState(false);
  const [tone,            setTone]           = useState('Professional');
  const [search,          setSearch]          = useState('');
  const [activeFilter,    setActiveFilter]    = useState('All');
  const [dateFilter,      setDateFilter]      = useState('all');
  const [typeFilter,      setTypeFilter]      = useState('all'); // all | news | press_conference
  const [page,            setPage]            = useState(1);
  const [tenants,         setTenants]         = useState([]);
  const [newsSection,     setNewsSection]     = useState('party'); // 'party' | 'opposition' | 'general'
  const [filterOpen,      setFilterOpen]      = useState(false);
  const [view,            setView]            = useState('feed'); // 'feed' | 'preview' | 'generated'
  const [generating,      setGenerating]      = useState(false);
  const [genSeconds,      setGenSeconds]      = useState(0);
  const [generatedPost,   setGeneratedPost]   = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedPostId,  setSelectedPostId]  = useState(null);
  const [copied,          setCopied]          = useState(false);
  const [panelWidth,      setPanelWidth]      = useState(300);
  const [searchInput,     setSearchInput]     = useState('');
  const [prefQuestions,   setPrefQuestions]   = useState([]);
  const [preferences,     setPreferences]     = useState({});
  const [savedPrefs,      setSavedPrefs]      = useState({});
  const [translatedPost,  setTranslatedPost]  = useState('');
  const [showTranslated,  setShowTranslated]  = useState(false);
  const [translating,     setTranslating]     = useState(false);
  const [quota,           setQuota]           = useState(null);
  const [postStatus,      setPostStatus]      = useState('draft');
  const [publishing,      setPublishing]      = useState(false);
  const [platform,        setPlatform]        = useState('twitter');
  // Always the platform preview. The Post/Preview toggle is gone: a plain-text
  // rendering of the same words told nobody anything the preview did not, and
  // the preview is what someone is actually about to publish.
  const postView = 'preview';
  const [refinementNote,  setRefinementNote]  = useState('');
  const [copiedHashtags,  setCopiedHashtags]  = useState(false);
  const [showMobilePrefs, setShowMobilePrefs] = useState(false);
  const filterRef = useRef(null);

  const { t, lang } = useI18n();
  const siteLang = getSiteLanguage() ?? 'hi';
  const atDailyLimit = quota?.daily_remaining === 0;
  const quotaCountdown = useCountdown(atDailyLimit ? quota?.reset_at : null);

  // Fetch daily quota on mount
  useEffect(() => {
    if (!currentUser?.id) return;
    getDailyQuota().then(setQuota).catch(() => {});
  }, [currentUser?.id]);

  // The party comes from the user's signup choice — it is not switchable here.
  // Declared before loadNews because that callback reads it.
  const activeParty = useMemo(
    () => resolveTenantForUser(currentUser?.political_party, tenants),
    [currentUser?.political_party, tenants]
  );
  const selectedParty = activeParty?.slug ?? '';

  const loadNews = useCallback(() => {
    setNewsLoading(true);
    setNewsError(false);
    // Ask for the chosen party plus general and opposition news in one call;
    // the UI splits them into the three sections locally.
    const query = { limit: 100, language: siteLang };
    if (selectedParty) { query.tenant = selectedParty; query.includeGeneral = true; query.includeOpposition = true; }
    getNews(query)
      .then((data) => {
        if (data?.length) {
          setArticles(data.map(adaptNews));
          setNewsLoading(false);
        } else {
          const fallback = { limit: 100 };
          if (selectedParty) { fallback.tenant = selectedParty; fallback.includeGeneral = true; fallback.includeOpposition = true; }
          getNews(fallback).then((all) => {
            if (all?.length) setArticles(all.map(adaptNews));
          }).catch(() => setNewsError(true)).finally(() => setNewsLoading(false));
        }
      })
      .catch(() => { setNewsLoading(false); setNewsError(true); });
  }, [siteLang, selectedParty]);

  // Debounce search input 300ms before filtering
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Fetch news filtered by site language + selected party; fall back to all if empty
  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Load the tenant registry (selectable parties) once
  useEffect(() => {
    getTenants().then(setTenants).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    Promise.all([
      getQuestions(25),
      getProfileAnswers(currentUser.id).catch(() => []),
    ]).then(([allQs, saved]) => {
      // Keep only the 7 preferred questions, in defined display order
      const qMap = Object.fromEntries(allQs.map((q) => [q.question_id, q]));
      const qs = PREF_QUESTION_IDS.map((id) => qMap[id]).filter(Boolean);
      setPrefQuestions(qs);

      // Build a { question_id: answer } map from the saved answers array
      const savedMap = Object.fromEntries(
        (saved ?? []).map((a) => [a.question_id, a.answer])
      );
      // Fill any missing question with first available option
      const initial = Object.fromEntries(
        qs.map((q) => [q.question_id, savedMap[q.question_id] ?? q.options[0] ?? ''])
      );
      setPreferences(initial);
      setSavedPrefs(initial);
    }).catch(() => {});
  }, [currentUser?.id]);

  // Resize drag refs
  const resizing  = useRef(false);
  const startX    = useRef(0);
  const startW    = useRef(0);

  useEffect(() => {
    function onMove(e) {
      if (!resizing.current) return;
      const delta = startX.current - e.clientX;
      setPanelWidth(Math.min(MAX_PANEL, Math.max(MIN_PANEL, startW.current + delta)));
    }
    function onUp() { resizing.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    function onClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  function startResize(e) {
    resizing.current = true;
    startX.current   = e.clientX;
    startW.current   = panelWidth;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }


  // Split the feed into three sections: the chosen party's news, the
  // opposition's (BJP, not scraped yet), and the neutral/general news
  // (Ravish) that every user sees.
  const partyArticles = useMemo(
    () => (activeParty ? articles.filter((a) => a.tenantSlug === activeParty.slug) : []),
    [articles, activeParty]
  );
  // No tenant scrapes BJP yet, so this is always empty for now — the tab
  // exists so the section has a home once that scraping exists, rather than
  // needing this whole area rewired later.
  const oppositionArticles = useMemo(
    () => articles.filter((a) => a.tenantSlug === 'bjp'),
    [articles]
  );
  const generalArticles = useMemo(
    () => articles.filter((a) => a.tenantSlug === 'general'),
    [articles]
  );

  // Without a party chosen there is only one list, so show everything.
  const sectionArticles = !activeParty
    ? articles
    : newsSection === 'party' ? partyArticles
    : newsSection === 'opposition' ? oppositionArticles
    : generalArticles;

  // Accent for the section currently on screen; falls back to the party colour
  // when no party is set, so the heading is never unstyled.
  const theme = SECTION_THEME[activeParty ? newsSection : 'party'] ?? SECTION_THEME.party;

  // Everything except the date rule. The day picker counts off this list, so the
  // number beside each day is what that day will actually show.
  const dateScopedArticles = useMemo(() => {
    const q = search.toLowerCase();
    return sectionArticles.filter((a) => {
      const matchSearch = !search || a.title.toLowerCase().includes(q);
      const matchFilter = activeFilter === 'All' || a.category === activeFilter;
      const matchType   = typeFilter === 'all' || a.contentType === typeFilter;
      return matchSearch && matchFilter && matchType;
    });
  }, [sectionArticles, search, activeFilter, typeFilter]);

  const filteredArticles = useMemo(
    () => dateScopedArticles.filter((a) => matchesDate(a.date, dateFilter)),
    [dateScopedArticles, dateFilter],
  );

  // Days holding at least one article, newest first. Undated sorts last.
  const availableDays = useMemo(() => {
    const counts = new Map();
    for (const a of dateScopedArticles) {
      const key = dayKey(a.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count, label: dayKeyLabel(key) }))
      .sort((a, b) => {
        if (a.key === 'undated') return 1;
        if (b.key === 'undated') return -1;
        return Number(b.key) - Number(a.key);
      });
  }, [dateScopedArticles]);

  // Switching party, section or type can retire the chosen day. Left alone that
  // reads as an empty feed with no visible cause, so fall back to all dates.
  useEffect(() => {
    if (!dateFilter.startsWith(DAY_PREFIX)) return;
    const key = dateFilter.slice(DAY_PREFIX.length);
    if (!availableDays.some((d) => d.key === key)) {
      setDateFilter('all');
      setPage(1);
    }
  }, [availableDays, dateFilter]);

  const selectedDayLabel = dateFilter.startsWith(DAY_PREFIX)
    ? dayKeyLabel(dateFilter.slice(DAY_PREFIX.length))
    : null;

  const filtersActive = (dateFilter !== 'all' ? 1 : 0)
    + (typeFilter !== 'all' ? 1 : 0)
    + (activeFilter !== 'All' ? 1 : 0);

  // Numbered pagination — slice the filtered list into fixed-size pages.
  // Clamp during render so a stale-high page never slices out of range
  // (handlers reset to page 1 whenever the search/filter changes).
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedArticles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredArticles.slice(start, start + PAGE_SIZE);
  }, [filteredArticles, currentPage]);

  // Group the current page into day buckets, preserving the newest-first order
  // the API already applied.
  const pagedGroups = useMemo(() => {
    const groups = [];
    let current = null;
    for (const article of pagedArticles) {
      const label = dayGroupLabel(article.date);
      if (!current || current.label !== label) {
        current = { label, items: [] };
        groups.push(current);
      }
      current.items.push(article);
    }
    return groups;
  }, [pagedArticles]);

  const activeContent = showTranslated && translatedPost ? translatedPost : generatedPost;
  const chars = activeContent.trim().length;
  const words = activeContent.trim() ? activeContent.trim().split(/\s+/).length : 0;
  const activePlatform = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0];
  const charPct = activePlatform.limit ? chars / activePlatform.limit : 0;
  const charOverLimit = chars > activePlatform.limit;
  const charWarning = charPct > 0.85 && !charOverLimit;

  function handlePreview(article) {
    setSelectedArticle(article);
    setGeneratedPost('');
    setSelectedPostId(null);
    setView('preview');
  }

  async function handleGenerate() {
    if (!selectedArticle) return;
    setGenerating(true);
    setGenSeconds(0);
    setView('generated');
    const timer = setInterval(() => setGenSeconds((s) => s + 1), 1000);
    try {
      if (!selectedArticle._backendId || !currentUser?.id) {
        throw new Error('Missing news or user context for generation.');
      }
      // Save preferences to DB so "Preferences Set" count is accurate
      if (currentUser?.id && Object.keys(preferences).length > 0) {
        saveProfileAnswers(currentUser.id, preferences).catch(() => {});
      }
      const platformObj = PLATFORMS.find((p) => p.id === platform);
      const response = await generatePostForNews({
        userId: currentUser.id,
        newsId: selectedArticle._backendId,
        tone,
        language: siteLang,
        profileOverrides: { ...preferences, target_platform: platformObj?.label ?? platform },
      });
      const content = response?.post?.content || '';
      if (!content.trim()) throw new Error('empty_content');
      setGeneratedPost(content);
      setSelectedPostId(response?.post?.id || null);
      setPostStatus('draft');
      setRefinementNote('');
      setTranslatedPost(response?.post?.translations?.[siteLang] || '');
      setShowTranslated(false);
    } catch (err) {
      console.error('Generate failed:', err);
      if (err?.response?.status === 429) {
        const detail = err.response.data?.detail;
        const msg = detail?.message ?? "You've reached your 5 posts/day limit. Come back tomorrow!";
        setGeneratedPost(`⚠️ ${msg}`);
        // Refresh quota so the UI reflects the limit
        getDailyQuota().then(setQuota).catch(() => {});
      } else {
        // Show what the server actually said. It sends a reason on every
        // refusal — "no source material could be gathered", an invalid key,
        // an unavailable dependency — and replacing all of them with "try
        // again" cost two evenings of guessing at a failure that was
        // describing itself the whole time. Falls back to the generic line
        // only when there is genuinely nothing to show (a gateway error, a
        // dropped connection), where the status code is the only signal.
        const detail = err?.response?.data?.detail;
        const reason = typeof detail === 'string' ? detail : detail?.message;
        setGeneratedPost(
          reason
            ? `⚠️ ${reason}`
            : `Could not generate post right now. Please try again.${
                err?.response?.status ? ` (error ${err.response.status})` : ''
              }`,
        );
      }
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedArticle) return;
    // If there's no saved post ID (e.g. previous generation failed), do a fresh generate instead
    if (!selectedPostId) { handleGenerate(); return; }
    setGeneratedPost('');
    setTranslatedPost('');
    setShowTranslated(false);
    setGenerating(true);
    setGenSeconds(0);
    const timer = setInterval(() => setGenSeconds((s) => s + 1), 1000);
    try {
      const response = await regeneratePostFromSnapshot(selectedPostId, {
        language: siteLang,
        profileOverrides: preferences,
        refinementNote,
      });
      const content = response?.post?.content || '';
      if (!content.trim()) throw new Error('empty_content');
      setGeneratedPost(content);
      setSelectedPostId(response?.post?.id || selectedPostId);
      setPostStatus('draft');
      setRefinementNote('');
      setTranslatedPost(response?.post?.translations?.[siteLang] || '');
      setShowTranslated(false);
    } catch (err) {
      console.error('Regenerate failed:', err);
      setGeneratedPost('Could not regenerate post right now. Please try again.');
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  async function handleTranslate() {
    if (!selectedPostId || translating) return;

    // Already translated in this session — just show it, no API call needed
    if (translatedPost) {
      setShowTranslated(true);
      return;
    }

    setTranslating(true);
    try {
      const result = await translatePost(selectedPostId, siteLang);
      setTranslatedPost(result.translated_content);
      setShowTranslated(true);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslating(false);
    }
  }

  async function handleCopyHashtags() {
    const activeContent = showTranslated && translatedPost ? translatedPost : generatedPost;
    const { hashtags } = parsePost(activeContent);
    if (!hashtags.length) return;
    try {
      await navigator.clipboard.writeText(hashtags.join(' '));
      setCopiedHashtags(true);
      setTimeout(() => setCopiedHashtags(false), 1600);
    } catch { /* ignore */ }
  }

  async function handlePublish() {
    if (!selectedPostId || publishing || postStatus === 'published') return;
    setPublishing(true);
    try {
      await updatePost(selectedPostId, { status: 'published' });
      setPostStatus('published');
      // Refresh quota so streak + daily count update immediately
      getDailyQuota().then(setQuota).catch(() => {});
      // Redirect back to the generator feed after publish
      navigate('/generate/social-media');
    } catch (err) {
      console.error('Publish failed:', err);
      if (err?.response?.status === 429) {
        const detail = err.response.data?.detail;
        alert(detail?.message ?? "You've used all 5 posts for today. Come back tomorrow!");
        getDailyQuota().then(setQuota).catch(() => {});
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopy() {
    try {
      const text = showTranslated && translatedPost ? translatedPost : generatedPost;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  }

  return (
    <div
      className="relative flex min-h-screen text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #0c111e 0%, #080b13 55%, #06080e 100%)' }}
    >
      {/* ambient glows */}
      <div className="pointer-events-none fixed left-[240px] top-0 h-[500px] w-[500px] rounded-full bg-[#3f9fff]/8 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-[300px] h-[420px] w-[420px] rounded-full bg-[#7b5cff]/8 blur-[140px]" />

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className="hidden lg:flex w-[240px] shrink-0 flex-col overflow-y-auto border-r border-[#1a2130]/70"
        style={{ background: 'linear-gradient(180deg,#0a0e18 0%,#080b13 100%)' }}
      >
        {/* Brand header */}
        <div className="border-b border-[#141d3a]/70 px-5 py-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            title="Go to Dashboard"
            className="mb-3 flex items-center gap-2 rounded-lg transition hover:opacity-90"
          >
            <img src={logoSrc} alt="AmbedkarGPT" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(63,159,255,0.55)]" />
            <span className="font-display text-[15px] font-bold gradient-text-blue">AmbedkarGPT</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-1.5 text-[11.5px] font-medium text-[#8b94b8] transition hover:border-[#3a6bc4]/60 hover:text-white"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            {t('nav.services')}
          </button>

          {/* Which tool you are in. This used to sit as a banner across the top
              of the feed, where it repeated the logo already shown here and ate
              a strip of vertical space above the stories. In the rail it still
              names the page, and the feed starts at the search bar. */}
          <div className="mt-4">
            <p className="font-display text-[16px] font-bold leading-snug text-white">
              {t('gen.title')}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#6b78a0]">
              {t('gen.motto')}
              <span className="block text-[#5a6584]">{t('brand.attrib')}</span>
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#3f9fff]/20 bg-[#3f9fff]/8 px-2.5 py-1 text-[10.5px] font-semibold text-[#6aa8ff]">
              <Sparkles size={9} strokeWidth={2} />
              {t('gen.aiPowered')}
            </span>
          </div>
        </div>

        {/* User profile card */}
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-[#1e2636]/80 bg-[#0e1320] px-5 py-5">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] text-[22px] font-bold text-white shadow-[0_0_24px_rgba(63,159,255,0.35)]">
                  {(currentUser?.username?.[0] ?? '?').toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#0e1320] bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </div>
              <p className="mt-3 font-display text-[16px] font-semibold text-white">{currentUser?.username ?? '—'}</p>
              <p className="mt-0.5 text-[11.5px] text-[#8b93a5]">{currentUser?.email ?? currentUser?.phone ?? ''}</p>
              <button
                type="button"
                onClick={() => navigate('/profile-setup')}
                className="mt-1 text-[11px] font-medium text-[#ef6a6a] transition hover:text-[#ff8a8a]"
              >
                {t('gen.completeProfile')}
              </button>
            </div>

            {/* Stat cards */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1e2636]/80 bg-[#0b0f18] px-3 py-3 text-center">
                <p className="font-count text-[22px] font-bold text-[#4a9eff]">127</p>
                <p className="mt-0.5 text-[10px] text-[#8b93a5]">{t('gen.activityScore')}</p>
              </div>
              <div className="rounded-xl border border-[#3a3320]/80 bg-[#17130a] px-3 py-3 text-center">
                <p className="flex items-center justify-center gap-1 font-display text-[18px] font-bold text-[#f5b73d]">
                  <Star size={15} strokeWidth={2} className="fill-[#f5b73d]" />
                  Pro
                </p>
                <p className="mt-0.5 text-[10px] text-[#8b93a5]">{t('gen.subscription')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Party affiliation — set at signup, shown read-only */}
        <div className="px-4 pt-5">
          <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8b93a5]">
            {t('gen.yourParty')}
          </p>
          {activeParty ? (
            <div
              className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-medium text-white"
              style={{ borderColor: 'rgba(63,159,255,0.55)', backgroundColor: 'rgba(63,159,255,0.10)' }}
            >
              <Check size={14} strokeWidth={2.5} className="shrink-0 text-[#6aa8ff]" />
              <span className="min-w-0 truncate">{activeParty.name}</span>
            </div>
          ) : (
            // No party on the profile (older accounts, or skipped at signup) —
            // say so instead of silently hiding the whole party feed.
            <button
              type="button"
              onClick={() => navigate('/profile-setup')}
              className="w-full rounded-xl border border-[#1e2636]/80 bg-[#0e1320] px-3.5 py-3 text-left text-[12.5px] text-[#8b93a5] transition hover:border-[#3f9fff]/45 hover:text-white"
            >
              {t('gen.noPartyLine')}
              <span className="mt-0.5 block text-[11.5px] text-[#6aa8ff]">{t('gen.setParty')}</span>
            </button>
          )}
        </div>

        {/* Target platform */}
        <div className="px-4 pt-5">
          <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8b93a5]">{t('gen.targetPlatform')}</p>
          <div className="space-y-2">
            {PLATFORMS.map((p) => {
              const active = platform === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] font-medium transition"
                  style={{
                    borderColor: active ? p.color : 'rgba(30,38,54,0.8)',
                    backgroundColor: active ? `${p.color}1f` : '#0e1320',
                    color: active ? '#ffffff' : '#8b93a5',
                  }}
                >
                  <span className="flex h-6 w-6 items-center justify-center text-[13px] font-bold" style={{ color: p.color }}>
                    {p.short}
                  </span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Select tone */}
        <div className="flex-1 px-4 pb-2 pt-5">
          <div className="rounded-2xl border border-[#1e2636]/80 bg-[#0e1320] p-4">
            <p className="mb-3 text-[13px] font-semibold text-white">{t('gen.selectToneLabel')}</p>
            <div className="space-y-2">
              {TONES.map((tn) => {
                const active = tone === tn;
                return (
                  <button
                    key={tn}
                    type="button"
                    onClick={() => setTone(tn)}
                    className="w-full rounded-lg border py-2.5 text-center text-[12.5px] font-medium transition"
                    style={{
                      borderColor: active ? '#3f9fff' : 'rgba(30,38,54,0.8)',
                      backgroundColor: active ? 'rgba(63,159,255,0.12)' : '#0b0f18',
                      color: active ? '#6aa8ff' : '#8b93a5',
                    }}
                  >
                    {toneLabel(tn, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 text-[11px] font-count text-[#4e5a80] tracking-wide">
          v1.0 · AmbedkarGPT
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div
        className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden border-x border-[#1a2130]/50"
        style={{ background: 'linear-gradient(180deg,#0a0e18 0%,#080b12 100%)' }}
      >

        {/* Search + filter */}
        <header className="flex items-center gap-3 px-6 pb-3 pt-4 md:px-8">
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-2 text-[12px] font-medium text-[#8b94b8] transition hover:text-white lg:hidden"
          >
            <ArrowLeft size={12} strokeWidth={2} />
          </button>

          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b78a0]" strokeWidth={2} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); setView('feed'); }}
              placeholder={t('gen.searchContent')}
              className="w-full rounded-full border border-[#1e3260]/70 bg-[#0a1130]/80 py-2.5 pl-9 pr-4 text-[13px] text-white placeholder-[#6b78a0] outline-none transition focus:border-[#3f9fff]/70 focus:shadow-[0_0_0_3px_rgba(63,159,255,0.12)]"
            />
          </div>

          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => { setFilterOpen((p) => !p); setView('feed'); }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12.5px] font-medium transition ${
                filtersActive
                  ? 'border-[#3f9fff]/60 bg-[#0d1a3a] text-[#6aa8ff]'
                  : 'border-[#1e3260]/70 bg-[#0d1531]/80 text-[#8b94b8] hover:border-[#3a6bc4]/60 hover:text-white'
              }`}
            >
              <Filter size={13} strokeWidth={2} />
              {selectedDayLabel ?? t('gen.filterNewsBtn')}
              {filtersActive > 0 && (
                <span className="rounded-full bg-[#3f9fff] px-1.5 py-0.5 font-count text-[10px] leading-none text-white">
                  {filtersActive}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-64 overflow-hidden rounded-xl border border-[#1e3260]/70 bg-[#0d1531] shadow-xl">
                {/* Date */}
                <p className="px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5a6e9a]">
                  {t('gen.date')}
                </p>
                {DATE_RANGES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { setDateFilter(d.id); setPage(1); setView('feed'); }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-[12.5px] transition hover:bg-[#0f1a3a] ${
                      d.id === dateFilter ? 'text-[#3f9fff]' : 'text-white/80'
                    }`}
                  >
                    {d.label}
                    {d.id === dateFilter && <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff]" />}
                  </button>
                ))}

                {availableDays.length > 0 && (
                  <>
                    <p className="mt-1 border-t border-[#1e3260]/60 px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5a6e9a]">
                      {t('gen.pickADay')}
                    </p>
                    <div className="max-h-52 overflow-y-auto">
                      {availableDays.map((d) => {
                        const id = `${DAY_PREFIX}${d.key}`;
                        const selected = id === dateFilter;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => { setDateFilter(id); setPage(1); setView('feed'); }}
                            className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-[12.5px] transition hover:bg-[#0f1a3a] ${
                              selected ? 'text-[#3f9fff]' : 'text-white/80'
                            }`}
                          >
                            <span className="truncate">{d.label}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="font-count text-[11px] text-[#5a6e9a]">{d.count}</span>
                              {selected && <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {filtersActive > 0 && (
                  <button
                    type="button"
                    onClick={() => { setDateFilter('all'); setTypeFilter('all'); setActiveFilter('All'); setPage(1); }}
                    className="w-full border-t border-[#1e3260]/60 px-4 py-2.5 text-left text-[12px] text-[#8b94b8] transition hover:bg-[#0f1a3a] hover:text-white"
                  >
                    {t('gen.clearFilters')}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── Mobile tone selector (left sidebar is hidden on mobile) ── */}
        <div className="mx-6 mb-3 lg:hidden md:mx-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6aa8ff]">{t('gen.tone')}</span>
            {TONES.map((tn) => (
              <button
                key={tn}
                type="button"
                onClick={() => setTone(tn)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition ${
                  tone === tn
                    ? 'border-[#3f9fff]/60 bg-[#0d1a3a] text-[#3f9fff]'
                    : 'border-[#1e3260]/60 bg-[#0a1130]/60 text-[#6b78a0] hover:text-white'
                }`}
              >
                {toneLabel(tn, lang)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Feed view ── */}
        {view === 'feed' && (
          <div className="flex-1 overflow-y-auto px-6 pb-10 md:px-8">
            {/* Three news sections: chosen party, opposition (BJP, empty
                until it is scraped), and general (neutral) news. Underlined
                tabs rather than pills, and each section carries its own
                accent so it is obvious which feed you are reading. */}
            {activeParty && (
              <div className="mb-5 flex items-end gap-1.5 border-b border-[#1e2636]/90">
                {[
                  { id: 'party',      label: activeParty.name,          count: partyArticles.length },
                  { id: 'opposition', label: t('gen.oppositionNews'),   count: oppositionArticles.length },
                  { id: 'general',    label: t('gen.generalNews'),      count: generalArticles.length },
                ].map((s) => {
                  const active = newsSection === s.id;
                  const tint = SECTION_THEME[s.id].accent;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setNewsSection(s.id);
                        setPage(1);
                        // Neither general nor opposition has press conferences,
                        // so carrying that filter across from the party tab
                        // would show an empty section and look broken.
                        if (s.id === 'general' || s.id === 'opposition') setTypeFilter('all');
                      }}
                      title={s.label}
                      className="group relative -mb-px flex items-center gap-2.5 rounded-t-xl px-4 pb-3 pt-2.5 text-[13.5px] font-semibold transition-colors duration-150"
                      style={{
                        // The active tab is lifted out of the strip and merges
                        // with the feed below, the way a browser tab does.
                        backgroundColor: active ? '#0e1320' : 'transparent',
                        color: active ? '#ffffff' : '#7d8aa6',
                        borderTop: `1px solid ${active ? 'rgba(30,38,54,0.9)' : 'transparent'}`,
                        borderLeft: `1px solid ${active ? 'rgba(30,38,54,0.9)' : 'transparent'}`,
                        borderRight: `1px solid ${active ? 'rgba(30,38,54,0.9)' : 'transparent'}`,
                        borderBottom: `1px solid ${active ? '#0e1320' : 'transparent'}`,
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(20,26,40,0.7)'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Accent dot sits where a browser tab shows its favicon */}
                      <span
                        className="h-2 w-2 shrink-0 rounded-full transition"
                        style={{
                          backgroundColor: active ? tint : '#3a4560',
                          boxShadow: active ? `0 0 8px ${tint}` : 'none',
                        }}
                      />
                      <span className="max-w-[210px] truncate">{s.label}</span>
                      <span
                        className="rounded-md px-1.5 py-0.5 font-count text-[11px] leading-none"
                        style={{
                          backgroundColor: active ? `${tint}22` : 'rgba(30,38,54,0.9)',
                          color: active ? tint : '#5a6e9a',
                        }}
                      >
                        {s.count}
                      </span>
                      {/* Accent bar across the tab top, like a highlighted browser tab */}
                      <span
                        className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl transition-all"
                        style={{
                          backgroundColor: active ? tint : 'transparent',
                          boxShadow: active ? `0 0 10px ${tint}88` : 'none',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content type — pills rather than tabs, so the party tabs above
                stay the primary level of navigation. */}
            <div className="mb-6 flex flex-wrap items-center gap-2.5">
              {(newsSection === 'general' || newsSection === 'opposition'
                // General is scraped from the videos tab alone, so every item
                // is the same type. Three filters over one type is furniture:
                // "All" and "News Articles" select the same set and "Press
                // Conference" selects nothing. Opposition has no data yet, so
                // it gets the same single-chip treatment until its own scrape
                // defines what content types it actually carries.
                ? [{ id: 'all', label: newsTypeLabel(newsSection), color: '#6aa8ff' }]
                : [
                    { id: 'all',              label: 'gen.all',                              color: '#8a9ac0' },
                    { id: 'press_conference', label: 'gen.pressConference',                  color: CONTENT_TYPES.press_conference.color },
                    { id: 'news',             label: newsTypeLabel(newsSection),             color: '#6aa8ff' },
                  ]
              ).map((chip) => {
                const active = typeFilter === chip.id;
                const count = chip.id === 'all'
                  ? sectionArticles.length
                  : sectionArticles.filter((a) => a.contentType === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => { setTypeFilter(chip.id); setPage(1); setView('feed'); }}
                    className="inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-[16px] font-semibold transition"
                    style={{
                      borderColor: active ? chip.color : 'rgba(30,38,54,0.9)',
                      backgroundColor: active ? `${chip.color}1f` : 'transparent',
                      color: active ? chip.color : '#7d8aa6',
                    }}
                  >
                    {chip.id === 'press_conference' && <Radio size={16} strokeWidth={2} />}
                    {chip.id === 'news' && <FileText size={16} strokeWidth={2} />}
                    {t(chip.label)}
                    <span
                      className="rounded-full px-2 py-1 font-count text-[13px] leading-none"
                      style={{
                        backgroundColor: active ? `${chip.color}26` : 'rgba(30,38,54,0.9)',
                        color: active ? chip.color : '#5a6e9a',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {newsLoading && (
              <>
                {/* A spinner above the grid, because six empty rectangles
                    pulsing at low contrast read as a broken page rather than
                    a loading one — especially on the first visit, when there
                    is no remembered content to compare them against. */}
                <div className="flex justify-center py-6">
                  <Spinner size={30} label="Loading news…" showLabel />
                </div>
                <div className="grid gap-5 lg:grid-cols-2" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[240px] w-full animate-pulse rounded-2xl border border-[#1e2636]/60 bg-[#0e1320]/70 p-5"
                    >
                      {/* Card-shaped, so the wait previews what arrives
                          instead of showing a blank box. */}
                      <div className="h-3 w-24 rounded bg-[#1b2340]/70" />
                      <div className="mt-4 h-4 w-4/5 rounded bg-[#1b2340]/80" />
                      <div className="mt-2.5 h-4 w-3/5 rounded bg-[#1b2340]/60" />
                      <div className="mt-6 space-y-2">
                        <div className="h-2.5 w-full rounded bg-[#161d33]/80" />
                        <div className="h-2.5 w-11/12 rounded bg-[#161d33]/70" />
                        <div className="h-2.5 w-9/12 rounded bg-[#161d33]/60" />
                      </div>
                      <div className="mt-6 h-8 w-28 rounded-lg bg-[#1b2340]/70" />
                    </div>
                  ))}
                </div>
              </>
            )}
            {!newsLoading && newsError && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
                <p className="text-[13px] text-red-400">{t('gen.failedToLoad')}</p>
                <button
                  type="button"
                  onClick={loadNews}
                  className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  {t('gen.retry')}
                </button>
              </div>
            )}
            {!newsLoading && !newsError && filteredArticles.length === 0 && newsSection === 'opposition' && (
              // Distinct from the generic empty state below: there is no
              // filter to change here, the scrape just does not exist yet.
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="text-[14px] font-medium" style={{ color: SECTION_THEME.opposition.accent }}>
                  {t('gen.oppositionComingSoon')}
                </p>
                <p className="text-[12px] text-[#4a5a80]">{t('gen.oppositionComingSoonSub')}</p>
              </div>
            )}
            {!newsLoading && !newsError && filteredArticles.length === 0 && newsSection !== 'opposition' && (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="text-[14px] font-medium text-[#6aa8ff]">{t('gen.noArticlesFound')}</p>
                <p className="text-[12px] text-[#4a5a80]">{t('gen.tryDifferent')}</p>
              </div>
            )}
            {!newsLoading && !newsError && filteredArticles.length > 0 && (
              <>
              {/* Section heading for the card grid */}
              <div className="mb-6 mt-1 text-center">
                {/* Centred, so the heading reads as a divider between the
                    filters and the grid rather than as a left-aligned label.
                    The accent bar moves under the title for the same reason:
                    a vertical bar only works against left-aligned text. */}
                <h3 className="font-display text-[34px] font-bold leading-tight tracking-tight text-white md:text-[38px]">
                  {t('gen.headlines')}
                </h3>
                <span
                  className="mx-auto mt-2 block h-[3px] w-16 rounded-full"
                  style={{ backgroundColor: theme.accent, boxShadow: `0 0 12px ${theme.accent}88` }}
                />
                <p className="mt-3 text-[14.5px] text-[#7d8aa6]">
                  {t('gen.pickStory')}
                </p>
              </div>

              {pagedGroups.map((group) => (
                <div key={group.label} className="mb-7 last:mb-0">
                  {/* Day heading */}
                  <div className="mb-3 flex items-center gap-3">
                    <h4 className="font-count text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#8a9ac0]">
                      {group.label}
                    </h4>
                    <span className="font-count text-[11px] text-[#5a6e9a]">{group.items.length}</span>
                    <span className="h-px flex-1 bg-[#1e2636]/80" />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                {group.items.map((article) => {
                  const dateLabel = formatNewsDate(article.date);
                  // Colour follows the article's own tenant, so a mixed list
                  // still reads correctly rather than following the active tab.
                  const cardAccent = article.tenantSlug === 'general'
                    ? SECTION_THEME.general.accent
                    : SECTION_THEME.party.accent;
                  return (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => handlePreview(article)}
                      className="group flex flex-col overflow-hidden rounded-2xl border p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-[#111726] hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                      style={{
                        borderColor: 'rgba(30,38,54,0.8)',
                        backgroundColor: '#0e1320',
                        // Accent rail marks which feed the card belongs to
                        borderLeft: `3px solid ${cardAccent}`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${cardAccent}70`; e.currentTarget.style.borderLeftColor = cardAccent; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(30,38,54,0.8)'; e.currentTarget.style.borderLeftColor = cardAccent; }}
                    >
                      {/* Header row: NEWS ARTICLE label · category tag */}
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span
                          className="inline-flex items-center gap-1.5 font-count text-[11px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: (CONTENT_TYPES[article.contentType] ?? CONTENT_TYPES.news).color }}
                        >
                          {article.contentType === 'press_conference'
                            ? <Radio size={12} strokeWidth={2} />
                            : <FileText size={12} strokeWidth={2} />}
                          {article.contentType === 'press_conference'
                            ? t('gen.pressConference')
                            : t(newsTypeLabel(newsSection))}
                        </span>
                        <span
                          className="shrink-0 rounded-full border px-3 py-1 font-count text-[11px] uppercase tracking-wider"
                          style={{
                            borderColor: `${cardAccent}55`,
                            backgroundColor: `${cardAccent}14`,
                            color: cardAccent,
                          }}
                        >
                          {article.category}
                        </span>
                      </div>

                      <p className="line-clamp-3 font-hindi text-[21px] font-bold leading-[1.6] pt-0.5 text-white">
                        {article.title}
                      </p>
                      <p className="font-hindi mt-3 line-clamp-3 flex-1 text-[16.5px] leading-[1.85] text-[#b9c8e4]">
                        {truncateText(article.summary || article.content, 200)}
                      </p>

                      {/* Footer — short by {source} · date */}
                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#141d3a]/70 pt-3">
                        <span className="min-w-0 truncate font-count text-[11.5px] text-[#5a6e9a]">
                          {dateLabel || 'AmbedkarGPT'}
                        </span>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold transition group-hover:gap-1.5"
                          style={{ color: cardAccent }}
                        >
                          <Sparkles size={12} strokeWidth={2} />
                          Generate
                        </span>
                      </div>
                    </button>
                  );
                })}
                  </div>
                </div>
              ))}

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1e2636]/80 bg-[#0e1320] px-3 text-[12.5px] font-medium text-[#8a9ac0] transition hover:border-[#3f9fff]/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronDown size={13} strokeWidth={2} className="rotate-90" />
                    {t('gen.prev')}
                  </button>

                  {getPageItems(currentPage, totalPages).map((item, i) =>
                    item === '…' ? (
                      <span key={`gap-${i}`} className="px-1.5 text-[13px] text-[#4a5a80]">…</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        aria-current={item === currentPage ? 'page' : undefined}
                        className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 font-count text-[12.5px] font-semibold transition"
                        style={{
                          borderColor: item === currentPage ? '#3f9fff' : 'rgba(30,38,54,0.8)',
                          backgroundColor: item === currentPage ? 'rgba(63,159,255,0.14)' : '#0e1320',
                          color: item === currentPage ? '#6aa8ff' : '#8a9ac0',
                        }}
                      >
                        {item}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1e2636]/80 bg-[#0e1320] px-3 text-[12.5px] font-medium text-[#8a9ac0] transition hover:border-[#3f9fff]/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('gen.next')}
                    <ChevronDown size={13} strokeWidth={2} className="-rotate-90" />
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        )}

        {/* ── Preview view ── */}
        {view === 'preview' && selectedArticle && (
          <div className="flex-1 overflow-y-auto px-6 pb-10 md:px-8">
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView('feed')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-1.5 text-[12px] font-medium text-[#8b94b8] transition hover:border-[#3f9fff]/50 hover:text-white"
              >
                <ArrowLeft size={12} strokeWidth={2} />
                {t('common.back')}
              </button>
              <span className="inline-block rounded-full border border-[#1e3a6e]/60 bg-[#0d1840]/60 px-2.5 py-0.5 font-count text-[10px] uppercase tracking-widest text-[#6aa8ff]">
                {selectedArticle.category}
              </span>
            </div>

            <div className="rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-7 md:p-8">
              <h2 className="font-hindi text-[24px] font-bold leading-[1.55] pt-0.5 text-white md:text-[28px]">
                {selectedArticle.title}
              </h2>
              {/* Prefer the fuller summary over the one-line description, and keep
                  Devanagari at a larger size — it needs more height than Latin
                  to stay legible. */}
              <p className="font-hindi mt-5 text-[19px] leading-[2] text-[#e6eefb] md:text-[21px]">
                {selectedArticle.summary || selectedArticle.content}
              </p>
              {selectedArticle.summary
                && selectedArticle.content
                && selectedArticle.content !== selectedArticle.summary && (
                <p className="font-hindi mt-5 border-t border-[#1e3260]/50 pt-5 text-[17px] leading-[1.95] text-[#c3d3ee] md:text-[18px]">
                  {selectedArticle.content}
                </p>
              )}
            </div>

            {/* Platform selector */}
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6aa8ff]">{t('gen.platform')}</p>
              <div className="grid grid-cols-4 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className="flex flex-col items-center gap-1 rounded-xl border py-2.5 text-center transition"
                    style={{
                      borderColor: platform === p.id ? p.color : 'rgba(30,50,100,0.5)',
                      backgroundColor: platform === p.id ? `${p.color}18` : 'rgba(10,17,48,0.6)',
                    }}
                  >
                    <span className="font-bold text-[13px]" style={{ color: platform === p.id ? p.color : '#5a6e9a' }}>
                      {p.short}
                    </span>
                    <span className="text-[9.5px] font-medium" style={{ color: platform === p.id ? p.color : '#3d4e70' }}>
                      {p.limit.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quota indicator */}
            {quota && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[#1e3260]/50 bg-[#0a1130]/60 px-4 py-2.5">
                <div>
                  <span className="text-[12px] text-[#8b94b8]">
                    {atDailyLimit
                      ? "You've used all 5 posts for today"
                      : `${quota.daily_used} of ${quota.daily_limit ?? 5} published today`}
                  </span>
                  {quota.streak_days > 0 && (
                    <span className="ml-2 text-[11px] font-semibold text-amber-400">
                      🔥 {quota.streak_days}-day streak
                    </span>
                  )}
                </div>
                {atDailyLimit ? (
                  <span className="font-count text-[12px] font-bold tabular-nums text-red-400">
                    Resets {quotaCountdown}
                  </span>
                ) : (
                  <span className="font-count text-[12px] font-semibold text-[#6aa8ff]">
                    {quota.daily_remaining} left
                  </span>
                )}
              </div>
            )}

            {/* ── Mobile preferences (right panel is hidden on mobile) ── */}
            <div className="mt-4 lg:hidden">
              <button
                type="button"
                onClick={() => setShowMobilePrefs((p) => !p)}
                className="flex w-full items-center justify-between rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/60 px-4 py-3 text-left transition hover:border-[#3f9fff]/40"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={13} strokeWidth={2} className="text-[#6aa8ff]" />
                  <span className="text-[13px] font-semibold text-white">{t('gen.postPreferences')}</span>
                  <span className="text-[11px] text-[#6b78a0]">· tune the AI voice</span>
                </div>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={`shrink-0 text-[#6b78a0] transition-transform duration-200 ${showMobilePrefs ? 'rotate-180' : ''}`}
                />
              </button>
              {showMobilePrefs && prefQuestions.length > 0 && (
                <div className="mt-2 space-y-3 rounded-xl border border-[#1e3260]/50 bg-[#07101f] p-4">
                  {prefQuestions.map((q, i) => {
                    const labels = {
                      profile_user_role: 'Your role',
                      profile_tone: 'Preferred tone',
                      profile_target_audience: 'Target audience',
                      profile_primary_focus: 'Primary focus',
                      profile_ambedkarite_perspective: 'Perspective',
                      profile_content_length: 'Content length',
                      profile_call_to_action: 'Call to action',
                    };
                    return (
                      <div key={q.question_id}>
                        <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-[#6aa8ff]">
                          <span className="mr-1 text-[#4e5a80]">{i + 1}.</span>
                          {labels[q.question_id] ?? q.question_text}
                        </label>
                        <div className="relative">
                          <select
                            value={preferences[q.question_id] ?? q.options[0]}
                            onChange={(e) => setPreferences((prev) => ({ ...prev, [q.question_id]: e.target.value }))}
                            className="w-full appearance-none rounded-lg border border-[#1e3260]/70 bg-[#0a1130]/80 py-2 pl-3 pr-8 text-[12.5px] text-white outline-none transition focus:border-[#3f9fff]/60"
                          >
                            {q.options.map((opt) => (
                              <option key={opt} value={opt} className="bg-[#0a1130]">{opt}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} strokeWidth={2} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b78a0]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={atDailyLimit}
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${atDailyLimit ? '' : 'btn-gradient shadow-[0_6px_24px_rgba(17,122,255,0.35)]'}`}
              style={{ background: atDailyLimit ? 'rgba(30,50,100,0.4)' : undefined }}
              title={atDailyLimit ? `Come back in ${quotaCountdown}` : undefined}
            >
              {atDailyLimit ? (
                <>⏳ Come back in {quotaCountdown}</>
              ) : (
                <><Sparkles size={15} strokeWidth={2} /> {t('gen.generatePost')}</>
              )}
            </button>
          </div>
        )}

        {/* ── Generated post view ── */}
        {view === 'generated' && (
          <div className="flex-1 overflow-y-auto px-6 pb-10 md:px-8">
            {/* Header: back + title on left, actions on right.
                Mobile: back/actions are icon-only to prevent overflow. */}
            <div className="mb-4 flex items-center gap-2">
              {/* Back — icon-only on mobile */}
              <button
                type="button"
                onClick={() => setView('preview')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 text-[#8b94b8] transition hover:border-[#3f9fff]/50 hover:text-white sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
              >
                <ArrowLeft size={12} strokeWidth={2} />
                <span className="hidden text-[12px] font-medium sm:inline">{t('gen.article')}</span>
              </button>

              <h2 className="font-display text-[16px] font-semibold text-white sm:text-[18px]">{t('gen.generatedPost')}</h2>

              {/* Action buttons */}
              <div className="ml-auto flex items-center gap-1 sm:gap-2">
                {/* Read aloud. Sits first because in a demo it is the control
                    being reached for, and it speaks whichever version is on
                    screen rather than always the Hindi original. */}
                {!generating && !translating && generatedPost && (
                  <SpeakButton
                    content={showTranslated && translatedPost ? translatedPost : generatedPost}
                    lang={showTranslated && translatedPost ? 'en' : 'hi'}
                  />
                )}
                {/* Translate — hidden on mobile to save space */}
                {selectedPostId && !generating && siteLang !== 'hi' && (
                  <button
                    type="button"
                    onClick={showTranslated ? () => setShowTranslated(false) : handleTranslate}
                    disabled={translating}
                    title={showTranslated ? 'Show Hindi' : 'Translate to English'}
                    className="hidden items-center gap-1.5 rounded-lg border border-[#1e3a6e]/80 bg-[#0d1840]/80 px-3 py-2 text-[12px] font-medium text-[#6aa8ff] transition hover:border-[#3f9fff]/60 hover:text-white disabled:opacity-40 sm:inline-flex"
                  >
                    {translating ? (
                      <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
                      </svg>
                    )}
                    {showTranslated ? 'Show Hindi' : translating ? 'Translating…' : 'Translate'}
                  </button>
                )}

                {/* Regenerate — icon on mobile, icon+label on sm+ */}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={generating}
                  title="Regenerate"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/70 bg-[#0d1531]/60 text-[#8b94b8] transition hover:border-[#3f9fff]/60 hover:text-white disabled:opacity-40 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
                >
                  <RefreshCw size={12} strokeWidth={2} className={generating ? 'animate-spin' : ''} />
                  <span className="hidden text-[12px] font-medium sm:inline">{t('gen.regenerate')}</span>
                </button>

                {/* Copy */}
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/70 bg-[#0d1531]/60 text-[#8b94b8] transition hover:border-[#3f9fff]/60 hover:text-white sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
                  style={{ color: copied ? '#22c55e' : undefined, borderColor: copied ? 'rgba(34,197,94,0.4)' : undefined }}
                >
                  {copied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2} />}
                  <span className="hidden text-[12px] font-medium sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {/* Publish */}
                {selectedPostId && !generating && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing || postStatus === 'published' || charOverLimit}
                    title={postStatus === 'published' ? 'Published' : 'Publish'}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-default disabled:opacity-70 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2"
                    style={{
                      borderColor: postStatus === 'published' ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.35)',
                      backgroundColor: postStatus === 'published' ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                      color: postStatus === 'published' ? '#22c55e' : '#4ade80',
                    }}
                  >
                    <Check size={12} strokeWidth={2.4} />
                    <span className="hidden text-[12px] font-medium sm:inline">
                      {postStatus === 'published' ? 'Published' : publishing ? 'Publishing…' : 'Publish'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Post / Preview toggle + translation badge */}
            {!generating && !translating && generatedPost && (
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showTranslated && translatedPost && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a6e]/60 bg-[#0d1840]/60 px-2.5 py-0.5 font-count text-[10px] uppercase tracking-widest text-[#6aa8ff]">
                      Translated · English
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-count text-[10px] uppercase tracking-wider"
                    style={{ borderColor: `${activePlatform.color}55`, color: activePlatform.color, backgroundColor: `${activePlatform.color}12` }}
                  >
                    {activePlatform.short} · {activePlatform.label}
                  </span>
                </div>
              </div>
            )}

            {(generating || translating) ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-5">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e3260] border-t-[#3f9fff]" />
                <div className="text-center">
                  <p className="text-[13px] font-medium text-[#6aa8ff]">
                    {generating ? 'Generating your post…' : 'Translating…'}
                  </p>
                  {generating && (
                    <p className="mt-1 font-count text-[11px] text-[#3a4e70]">{genSeconds}s elapsed</p>
                  )}
                </div>
              </div>
            ) : postView === 'preview' ? (
              /* ── Mock social card preview ── */
              <div className="rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-5">
                {/* Platform chrome */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] text-[15px] font-bold text-white">
                    {(currentUser?.username?.[0] ?? 'A').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-white">{currentUser?.username ?? 'You'}</p>
                    <p className="text-[11.5px]" style={{ color: activePlatform.color }}>
                      @{currentUser?.username?.toLowerCase() ?? 'user'} · {activePlatform.short}
                    </p>
                  </div>
                </div>
                <div className="border-t border-[#141d3a]/60 pt-4">
                  <PostContent content={showTranslated && translatedPost ? translatedPost : generatedPost} />
                </div>
                {/* Mock engagement row */}
                <div className="mt-4 flex items-center gap-5 border-t border-[#141d3a]/60 pt-3 text-[11.5px] text-[#3a4e70]">
                  <span>💬 Reply</span>
                  <span>🔁 Repost</span>
                  <span>❤️ Like</span>
                  <span>📤 Share</span>
                </div>
              </div>
            ) : (
              /* ── Styled post text ── */
              <div className="min-h-[260px] rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-5">
                <PostContent content={showTranslated && translatedPost ? translatedPost : generatedPost} />
              </div>
            )}

            {/* Refinement note */}
            {!generating && !translating && generatedPost && (
              <div className="mt-3">
                <input
                  type="text"
                  value={refinementNote}
                  onChange={(e) => setRefinementNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refinementNote.trim() && handleRegenerate()}
                  placeholder={t('gen.refinementPlaceholder')}
                  className="w-full rounded-xl border border-[#1e3260]/50 bg-[#0a1130]/60 px-4 py-2.5 text-[12.5px] text-white placeholder-[#3a4e70] outline-none transition focus:border-[#3f9fff]/50 focus:shadow-[0_0_0_3px_rgba(63,159,255,0.1)]"
                />
              </div>
            )}

            {/* Watermark */}
            {!generating && generatedPost && (
              <div className="mt-2 flex items-center gap-1.5 justify-end">
                <img src={logoSrc} alt="" className="h-3.5 w-3.5 object-contain opacity-50" />
                <span className="text-[10.5px] text-[#3a4e70]">{t('gen.generatedBy')}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3">
              {/* Platform-aware char counter */}
              <div
                className="rounded-xl border px-4 py-3 text-center transition"
                style={{
                  borderColor: charOverLimit ? 'rgba(239,68,68,0.5)' : charWarning ? 'rgba(251,191,36,0.4)' : 'rgba(30,50,100,0.6)',
                  backgroundColor: charOverLimit ? 'rgba(239,68,68,0.08)' : 'rgba(10,17,48,0.6)',
                }}
              >
                <div className="text-[10.5px]" style={{ color: charOverLimit ? '#ef4444' : charWarning ? '#fbbf24' : '#8b94b8' }}>
                  Chars · {activePlatform.short} limit {activePlatform.limit.toLocaleString()}
                </div>
                <div
                  className="mt-1 font-count text-[22px] font-bold tabular-nums"
                  style={{ color: charOverLimit ? '#ef4444' : charWarning ? '#fbbf24' : 'white' }}
                >
                  {chars}
                </div>
                {activePlatform.limit && (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#1e3260]/60">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(charPct * 100, 100)}%`,
                        backgroundColor: charOverLimit ? '#ef4444' : charWarning ? '#fbbf24' : '#3f9fff',
                      }}
                    />
                  </div>
                )}
              </div>
              {/* Words */}
              <div className="rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/60 px-4 py-3 text-center">
                <div className="text-[11px] text-[#8b94b8]">{t('gen.words')}</div>
                <div className="mt-1 font-count text-[22px] font-bold tabular-nums text-white">{words}</div>
              </div>
              {/* Hashtags copy */}
              <button
                type="button"
                onClick={handleCopyHashtags}
                disabled={!generatedPost}
                className="rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/60 px-4 py-3 text-center transition hover:border-[#3f9fff]/40 hover:bg-[#0d1635]/70 disabled:opacity-40"
              >
                <div className="text-[11px] text-[#8b94b8]">{t('gen.hashtags')}</div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  {copiedHashtags
                    ? <><Check size={14} strokeWidth={2.5} className="text-[#22c55e]" /><span className="font-count text-[13px] font-bold text-[#22c55e]">{t('gen.copied')}</span></>
                    : <><Copy size={13} strokeWidth={2} className="text-[#5fa5ff]" /><span className="font-count text-[13px] font-bold text-[#5fa5ff]">{t('common.copy')}</span></>
                  }
                </div>
              </button>
            </div>

            {/* You Can Also Generate — card with grid buttons */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-5">
              <p className="mb-4 font-display text-[14px] font-semibold text-white">
                {t('gen.alsoGenerate')}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {ALSO_GENERATE.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="flex items-center justify-center rounded-xl border border-[#1e3a6e]/80 bg-[#0d1840]/80 py-4 text-[13.5px] font-medium text-white transition hover:border-[#3f9fff]/60 hover:bg-[#0f2050]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RESIZE HANDLE + RIGHT SIDEBAR ── */}
      <div className="sticky top-0 z-20 hidden h-screen shrink-0 lg:flex" style={{ width: panelWidth + 8 }}>
        {/* Drag handle */}
        <div
          onMouseDown={startResize}
          className="group flex w-2 shrink-0 cursor-col-resize flex-col items-center justify-center border-l border-[#141d3a]/70 transition-colors hover:border-[#3f9fff]/30 hover:bg-[#3f9fff]/5"
        >
          <div className="h-10 w-[3px] rounded-full bg-[#1e3260] transition-colors group-hover:bg-[#3f9fff]/50" />
        </div>

        {/* Preferences panel */}
        <div className="h-full flex-1 overflow-hidden">
          <PreferencesPanel
            questions={prefQuestions}
            value={preferences}
            onChange={setPreferences}
            defaultValues={savedPrefs}
          />
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, Sparkles,
  Copy, Check, RefreshCw, ChevronDown, Eye, FileText,
} from 'lucide-react';

import PreferencesPanel from '../components/generate/PreferencesPanel';
import PostContent from '../components/generate/PostContent';
import logoSrc from '../assets/images/logo-animation.png';
import { useAuth } from '../context/AuthContext';
import { getNews } from '../api/news';
import { generatePostForNews, regeneratePostFromSnapshot, translatePost, updatePost, getDailyQuota } from '../api/posts';
import { getQuestions } from '../api/questions';
import { getProfileAnswers, saveProfileAnswers } from '../api/profile';
import { getSiteLanguage, SITE_LANGUAGES } from '../utils/siteLanguage';
import { parsePost, hashtagsText } from '../utils/parsePost';

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

// Map backend NewsResponse → local article shape
function adaptNews(item) {
  return {
    id:       item.id,
    _backendId: item.id, // valid MongoDB ObjectId from backend
    category: item.tags?.[0] ?? 'General',
    title:    item.headline,
    content:  item.description || item.summary,
    topic:    item.summary || item.headline,
  };
}

export default function SocialMediaPostGenerator() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [articles,        setArticles]        = useState([]);
  const [newsLoading,     setNewsLoading]     = useState(true);
  const [tone,            setTone]           = useState('Professional');
  const [toneOpen,        setToneOpen]        = useState(false);
  const [search,          setSearch]          = useState('');
  const [activeFilter,    setActiveFilter]    = useState('All');
  const [filterOpen,      setFilterOpen]      = useState(false);
  const [view,            setView]            = useState('feed'); // 'feed' | 'preview' | 'generated'
  const [generating,      setGenerating]      = useState(false);
  const [genSeconds,      setGenSeconds]      = useState(0);
  const [generatedPost,   setGeneratedPost]   = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedPostId,  setSelectedPostId]  = useState(null);
  const [copied,          setCopied]          = useState(false);
  const [panelWidth,      setPanelWidth]      = useState(300);
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
  const [postView,        setPostView]        = useState('post'); // 'post' | 'preview'
  const [refinementNote,  setRefinementNote]  = useState('');
  const [copiedHashtags,  setCopiedHashtags]  = useState(false);
  const filterRef = useRef(null);

  const siteLang = getSiteLanguage() ?? 'en';
  const atDailyLimit = quota?.daily_remaining === 0;
  const quotaCountdown = useCountdown(atDailyLimit ? quota?.reset_at : null);

  // Fetch daily quota on mount
  useEffect(() => {
    if (!currentUser?.id) return;
    getDailyQuota().then(setQuota).catch(() => {});
  }, [currentUser?.id]);

  // Fetch news filtered by site language; fall back to all if empty
  useEffect(() => {
    setNewsLoading(true);
    getNews({ limit: 100, language: siteLang })
      .then((data) => {
        if (data?.length) {
          setArticles(data.map(adaptNews));
          setNewsLoading(false);
        } else {
          getNews({ limit: 100 }).then((all) => {
            if (all?.length) setArticles(all.map(adaptNews));
          }).catch(() => {}).finally(() => setNewsLoading(false));
        }
      })
      .catch(() => setNewsLoading(false));
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    Promise.all([
      getQuestions(7),
      getProfileAnswers(currentUser.id).catch(() => []),
    ]).then(([qs, saved]) => {
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

  const filteredArticles = articles.filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === 'All' || a.category === activeFilter;
    return matchSearch && matchFilter;
  });

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
        language: 'hi',
        profileOverrides: { ...preferences, target_platform: platformObj?.label ?? platform },
      });
      setGeneratedPost(response?.post?.content || '');
      setSelectedPostId(response?.post?.id || null);
      setPostStatus('draft');
      setPostView('post');
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
        setGeneratedPost('Could not generate post right now. Please try again.');
      }
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedArticle || !selectedPostId) return;
    setGenerating(true);
    setGenSeconds(0);
    const timer = setInterval(() => setGenSeconds((s) => s + 1), 1000);
    try {
      const response = await regeneratePostFromSnapshot(selectedPostId, {
        language: 'hi',
        profileOverrides: preferences,
        refinementNote,
      });
      setGeneratedPost(response?.post?.content || '');
      setSelectedPostId(response?.post?.id || selectedPostId);
      setPostStatus('draft');
      setPostView('post');
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
      await navigator.clipboard.writeText(generatedPost);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  }

  return (
    <div
      className="relative flex min-h-screen text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #0d1636 0%, #070b1c 55%, #05081a 100%)' }}
    >
      {/* ambient glows */}
      <div className="pointer-events-none fixed left-[240px] top-0 h-[500px] w-[500px] rounded-full bg-[#3f9fff]/8 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-[300px] h-[420px] w-[420px] rounded-full bg-[#7b5cff]/8 blur-[140px]" />

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className="hidden lg:flex w-[240px] shrink-0 flex-col overflow-y-auto border-r border-[#141d3a]/70"
        style={{ background: 'linear-gradient(180deg,#0a1024 0%,#070b1c 100%)' }}
      >
        {/* Brand header */}
        <div className="border-b border-[#141d3a]/70 px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <img src={logoSrc} alt="AmbedkarGPT" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(63,159,255,0.55)]" />
            <span className="font-display text-[15px] font-bold gradient-text-blue">AmbedkarGPT</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-1.5 text-[11.5px] font-medium text-[#8b94b8] transition hover:border-[#3a6bc4]/60 hover:text-white"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Services
          </button>
        </div>

        {/* User profile */}
        <div className="flex flex-col items-center px-5 pb-5 pt-6">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] text-[22px] font-bold text-white shadow-[0_0_24px_rgba(63,159,255,0.35)]">
              {(currentUser?.username?.[0] ?? '?').toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#070b1c] bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          </div>
          <p className="mt-3 font-display text-[15px] font-semibold text-white">{currentUser?.username ?? '—'}</p>
          <p className="mt-0.5 text-[11px] text-[#6b78a0]">{currentUser?.email ?? currentUser?.phone ?? ''}</p>
        </div>

        <div className="mx-5 border-t border-[#141d3a]/70" />

        {/* Tone selector */}
        <div className="px-5 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6aa8ff]">Select Tone</p>
          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setToneOpen((p) => !p)}
              className="flex w-full items-center justify-between rounded-lg border border-[#1e3260]/70 bg-[#0a1130]/80 px-3 py-2.5 text-[12.5px] font-medium text-white transition hover:border-[#3f9fff]/50"
            >
              {tone}
              <ChevronDown size={13} strokeWidth={2} className={`text-[#8b94b8] transition-transform duration-200 ${toneOpen ? 'rotate-180' : ''}`} />
            </button>
            {toneOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-[#1e3260]/70 bg-[#0d1531] shadow-xl">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTone(t); setToneOpen(false); }}
                    className={`flex w-full items-center px-3 py-2.5 text-[12.5px] transition hover:bg-[#0f1a3a] ${t === tone ? 'text-[#3f9fff]' : 'text-white/80'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Posts generated counter */}
        <div className="flex-1 px-5 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6aa8ff]">This Session</p>
          <div className="mt-3 rounded-xl border border-[#1e3260]/50 bg-[#0a1130]/60 px-4 py-4 text-center">
            <p className="font-count text-[28px] font-bold text-white">{articles.filter((a) => a._backendId).length > 0 ? articles.length : '—'}</p>
            <p className="mt-0.5 text-[10.5px] text-[#6b78a0]">News articles loaded</p>
          </div>
        </div>

        <div className="px-6 py-5 text-[11px] font-count text-[#4e5a80] tracking-wide">
          v1.0 · AmbedkarGPT
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-6 pb-3 pt-5 md:px-8">
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
              value={search}
              onChange={(e) => { setSearch(e.target.value); setView('feed'); }}
              placeholder="Search Your Content"
              className="w-full rounded-full border border-[#1e3260]/70 bg-[#0a1130]/80 py-2.5 pl-9 pr-4 text-[13px] text-white placeholder-[#6b78a0] outline-none transition focus:border-[#3f9fff]/70 focus:shadow-[0_0_0_3px_rgba(63,159,255,0.12)]"
            />
          </div>

          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => { setFilterOpen((p) => !p); setView('feed'); }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12.5px] font-medium transition ${
                activeFilter !== 'All'
                  ? 'border-[#3f9fff]/60 bg-[#0d1a3a] text-[#6aa8ff]'
                  : 'border-[#1e3260]/70 bg-[#0d1531]/80 text-[#8b94b8] hover:border-[#3a6bc4]/60 hover:text-white'
              }`}
            >
              <Filter size={13} strokeWidth={2} />
              {activeFilter === 'All' ? 'Filter News' : activeFilter}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-40 overflow-hidden rounded-xl border border-[#1e3260]/70 bg-[#0d1531] shadow-xl">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setActiveFilter(cat); setFilterOpen(false); setView('feed'); }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-[12.5px] transition hover:bg-[#0f1a3a] ${
                      cat === activeFilter ? 'text-[#3f9fff]' : 'text-white/80'
                    }`}
                  >
                    {cat}
                    {cat === activeFilter && <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* AmbedkarGPT identity banner */}
        <div className="mx-6 mb-3 flex items-center gap-4 rounded-xl border border-[#1a2d55]/50 bg-[#070e22]/80 px-5 py-3 md:mx-8">
          <img src={logoSrc} alt="AmbedkarGPT" className="h-7 w-7 shrink-0 object-contain opacity-90 drop-shadow-[0_0_8px_rgba(63,159,255,0.5)]" />
          <div className="min-w-0">
            <p className="font-display text-[13px] font-semibold text-white">Social Post Generator</p>
            <p className="text-[11px] text-[#6b78a0]">
              Educate &middot; Agitate &middot; Organize &mdash; Dr. B.R. Ambedkar
            </p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#3f9fff]/20 bg-[#3f9fff]/8 px-2.5 py-1 text-[10.5px] font-semibold text-[#6aa8ff]">
            <Sparkles size={9} strokeWidth={2} />
            AI-Powered
          </span>
        </div>

        {/* ── Feed view ── */}
        {view === 'feed' && (
          <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-10 md:px-8">
            {newsLoading && Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[90px] w-full animate-pulse rounded-2xl border border-[#1e3260]/30 bg-[#0a1130]/40"
              />
            ))}
            {!newsLoading && filteredArticles.map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => handlePreview(article)}
                className="flex w-full items-start gap-4 rounded-2xl border border-[#1e3260]/50 bg-[#0a1130]/60 p-5 text-left transition hover:border-[#3f9fff]/40 hover:bg-[#0d1635]/80"
              >
                <div className="min-w-0 flex-1">
                  <span className="mb-1.5 inline-block rounded-full border border-[#1e3a6e]/60 bg-[#0d1840]/60 px-2 py-0.5 font-count text-[10px] uppercase tracking-widest text-[#6aa8ff]">
                    {article.category}
                  </span>
                  <p className="font-display text-[14px] font-semibold leading-snug text-white">{article.title}</p>
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-[1.7] text-[#7a8ab0]">{article.content}</p>
                </div>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className="-rotate-90 mt-1 shrink-0 text-[#3f6aaa]"
                />
              </button>
            ))}
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
                Back
              </button>
              <span className="inline-block rounded-full border border-[#1e3a6e]/60 bg-[#0d1840]/60 px-2.5 py-0.5 font-count text-[10px] uppercase tracking-widest text-[#6aa8ff]">
                {selectedArticle.category}
              </span>
            </div>

            <div className="rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-6">
              <h2 className="font-display text-[20px] font-bold leading-snug text-white md:text-[22px]">
                {selectedArticle.title}
              </h2>
              <p className="mt-4 text-[13.5px] leading-[1.8] text-[#9aafd4]">
                {selectedArticle.content}
              </p>
            </div>

            {/* Platform selector */}
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6aa8ff]">Platform</p>
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
                <><Sparkles size={15} strokeWidth={2} /> Generate Post</>
              )}
            </button>
          </div>
        )}

        {/* ── Generated post view ── */}
        {view === 'generated' && (
          <div className="flex-1 overflow-y-auto px-6 pb-10 md:px-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView('preview')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-1.5 text-[12px] font-medium text-[#8b94b8] transition hover:border-[#3f9fff]/50 hover:text-white"
                >
                  <ArrowLeft size={12} strokeWidth={2} />
                  Article
                </button>
                <h2 className="font-display text-[18px] font-semibold text-white">Generated Post</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Translate button — only shown when site language is English
                    (post is always in Hindi; Hindi users already have it in their language) */}
                {selectedPostId && !generating && siteLang !== 'hi' && (
                  <button
                    type="button"
                    onClick={showTranslated ? () => setShowTranslated(false) : handleTranslate}
                    disabled={translating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e3a6e]/80 bg-[#0d1840]/80 px-3 py-2 text-[12px] font-medium text-[#6aa8ff] transition hover:border-[#3f9fff]/60 hover:text-white disabled:opacity-40"
                  >
                    {translating ? (
                      <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
                      </svg>
                    )}
                    {showTranslated ? 'Show Hindi' : translating ? 'Translating…' : 'Translate to English'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-2 text-[12px] font-medium text-[#8b94b8] transition hover:border-[#3f9fff]/60 hover:text-white disabled:opacity-40"
                >
                  <RefreshCw size={12} strokeWidth={2} className={generating ? 'animate-spin' : ''} />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e3260]/70 bg-[#0d1531]/60 px-3 py-2 text-[12px] font-medium text-[#8b94b8] transition hover:border-[#3f9fff]/60 hover:text-white"
                >
                  {copied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {selectedPostId && !generating && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing || postStatus === 'published'}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition disabled:cursor-default disabled:opacity-70"
                    style={{
                      borderColor: postStatus === 'published' ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.35)',
                      backgroundColor: postStatus === 'published' ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                      color: postStatus === 'published' ? '#22c55e' : '#4ade80',
                    }}
                  >
                    <Check size={12} strokeWidth={2.4} />
                    {postStatus === 'published' ? 'Published' : publishing ? 'Publishing…' : 'Publish'}
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
                <div className="flex rounded-lg border border-[#1e3260]/60 overflow-hidden">
                  {[{ id: 'post', Icon: FileText, label: 'Post' }, { id: 'preview', Icon: Eye, label: 'Preview' }].map(({ id, Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPostView(id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium transition"
                      style={{
                        backgroundColor: postView === id ? 'rgba(63,159,255,0.15)' : 'transparent',
                        color: postView === id ? '#6aa8ff' : '#4a5a80',
                      }}
                    >
                      <Icon size={11} strokeWidth={2} />
                      {label}
                    </button>
                  ))}
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
                  placeholder="What should be different? (optional — press Enter or click Regenerate)"
                  className="w-full rounded-xl border border-[#1e3260]/50 bg-[#0a1130]/60 px-4 py-2.5 text-[12.5px] text-white placeholder-[#3a4e70] outline-none transition focus:border-[#3f9fff]/50 focus:shadow-[0_0_0_3px_rgba(63,159,255,0.1)]"
                />
              </div>
            )}

            {/* Watermark */}
            {!generating && generatedPost && (
              <div className="mt-2 flex items-center gap-1.5 justify-end">
                <img src={logoSrc} alt="" className="h-3.5 w-3.5 object-contain opacity-50" />
                <span className="text-[10.5px] text-[#3a4e70]">Generated by AmbedkarGPT</span>
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
                <div className="text-[11px] text-[#8b94b8]">Words</div>
                <div className="mt-1 font-count text-[22px] font-bold tabular-nums text-white">{words}</div>
              </div>
              {/* Hashtags copy */}
              <button
                type="button"
                onClick={handleCopyHashtags}
                disabled={!generatedPost}
                className="rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/60 px-4 py-3 text-center transition hover:border-[#3f9fff]/40 hover:bg-[#0d1635]/70 disabled:opacity-40"
              >
                <div className="text-[11px] text-[#8b94b8]">Hashtags</div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  {copiedHashtags
                    ? <><Check size={14} strokeWidth={2.5} className="text-[#22c55e]" /><span className="font-count text-[13px] font-bold text-[#22c55e]">Copied!</span></>
                    : <><Copy size={13} strokeWidth={2} className="text-[#5fa5ff]" /><span className="font-count text-[13px] font-bold text-[#5fa5ff]">Copy</span></>
                  }
                </div>
              </button>
            </div>

            {/* You Can Also Generate — card with grid buttons */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-5">
              <p className="mb-4 font-display text-[14px] font-semibold text-white">
                You Can Also Generate
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

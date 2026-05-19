import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, Sparkles,
  Copy, Check, RefreshCw, ChevronDown,
} from 'lucide-react';

import PreferencesPanel from '../components/generate/PreferencesPanel';
import logoSrc from '../assets/images/logo-animation.png';
import { useAuth } from '../context/AuthContext';
import { getNews } from '../api/news';
import { generatePostForNews, regeneratePostFromSnapshot, translatePost } from '../api/posts';
import { getQuestions } from '../api/questions';
import { getProfileAnswers } from '../api/profile';
import { getSiteLanguage, SITE_LANGUAGES } from '../utils/siteLanguage';

const TONES = ['Professional', 'Inspirational', 'Creative', 'Casual', 'Motivational'];
const ALSO_GENERATE = ['Audio', 'Shorts', 'Image'];

const CATEGORIES = ['All', 'Legacy', 'Policy', 'Education', 'Research', 'Grassroots'];

const NEWS_ARTICLES = [
  {
    id: 1,
    category: 'Legacy',
    title: 'Ambedkar Jayanti 2026: Nation Celebrates the Legacy of Dr. B.R. Ambedkar',
    content: 'Millions across India and abroad mark the 135th birth anniversary of Dr. Bhimrao Ramji Ambedkar, the chief architect of the Indian Constitution and a champion of social justice and equality for the marginalised.',
    topic: 'Ambedkar Jayanti 2026 celebration and legacy',
  },
  {
    id: 2,
    category: 'Policy',
    title: 'Supreme Court Upholds Reservation Policy in Government Jobs',
    content: 'The Supreme Court of India has upheld the constitutional validity of reservations for SC/ST communities in government employment, reaffirming Ambedkar\'s vision of social equality for all citizens.',
    topic: 'Supreme Court upholds reservation policy for SC/ST communities',
  },
  {
    id: 3,
    category: 'Legacy',
    title: 'New Dalit Literature Corpus Launched to Preserve Anti-Caste Voices',
    content: 'A major digital archive of Dalit writings, speeches, and historical records has been launched to preserve and promote anti-caste literature and thought for future generations.',
    topic: 'Launch of Dalit Literature Corpus digital archive',
  },
  {
    id: 4,
    category: 'Education',
    title: 'Students Demand Better Implementation of Education Reservations',
    content: 'Student activists across major universities are calling for better implementation of reservation policies in higher education, citing systemic barriers faced by Dalit and OBC students nationwide.',
    topic: 'Student demand for better implementation of education reservations',
  },
  {
    id: 5,
    category: 'Research',
    title: 'New Research Links Caste Discrimination to Mental Health Outcomes',
    content: 'A landmark study reveals significant correlations between experiences of caste-based discrimination and adverse mental health outcomes among Dalit communities across India.',
    topic: 'Research on caste discrimination and mental health outcomes',
  },
  {
    id: 6,
    category: 'Grassroots',
    title: 'Grassroots Movements Revive Ambedkar\'s "Educate, Agitate, Organize" Call',
    content: 'Community leaders and youth groups across rural India are reviving Dr. Ambedkar\'s iconic rallying cry, building new networks to challenge caste hierarchies at the local level.',
    topic: 'Grassroots revival of Ambedkar\'s educate agitate organize movement',
  },
  {
    id: 7,
    category: 'Policy',
    title: 'New Bill Proposes Stricter Penalties for Caste-Based Atrocities',
    content: 'Parliament is debating an amendment to the SC/ST Prevention of Atrocities Act that would introduce faster trials and harsher penalties for crimes motivated by caste discrimination.',
    topic: 'New bill proposing stricter penalties for caste-based atrocities',
  },
  {
    id: 8,
    category: 'Education',
    title: 'IITs Launch Free Online Courses on Constitutional Rights and Equality',
    content: 'Several premier Indian institutions are offering free MOOCs on constitutional rights, Ambedkar\'s philosophy, and social justice frameworks, aimed at reaching underserved communities.',
    topic: 'IITs launching free online courses on constitutional rights and equality',
  },
  {
    id: 9,
    category: 'Research',
    title: 'Study Finds Significant Wage Gap Persists Along Caste Lines in Urban India',
    content: 'A new economic study across 12 major cities shows Dalit workers earn on average 27% less than upper-caste peers in comparable roles, despite similar qualifications and experience.',
    topic: 'Wage gap study along caste lines in urban India',
  },
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

  const [articles,        setArticles]        = useState(NEWS_ARTICLES);
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
  const filterRef = useRef(null);

  const siteLang = getSiteLanguage() ?? 'en';

  // Fetch news filtered by site language; fall back to all if empty
  useEffect(() => {
    getNews({ limit: 100, language: siteLang })
      .then((data) => {
        if (data?.length) {
          setArticles(data.map(adaptNews));
        } else {
          getNews({ limit: 100 }).then((all) => {
            if (all?.length) setArticles(all.map(adaptNews));
          }).catch(() => {});
        }
      })
      .catch(() => {});
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

  const chars = generatedPost.trim().length;
  const words = generatedPost.trim() ? generatedPost.trim().split(/\s+/).length : 0;

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
      setTranslatedPost('');
      setShowTranslated(false);
      const response = await generatePostForNews({
        userId: currentUser.id,
        newsId: selectedArticle._backendId,
        tone,
        language: siteLang,
      });
      setGeneratedPost(response?.post?.content || '');
      setSelectedPostId(response?.post?.id || null);
    } catch (err) {
      console.error('Generate failed:', err);
      setGeneratedPost('Could not generate post right now. Please try again.');
    } finally {
      clearInterval(timer);
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedArticle || !selectedPostId) return;
    setGenerating(true);
    try {
      setTranslatedPost('');
      setShowTranslated(false);
      const response = await regeneratePostFromSnapshot(selectedPostId, {
        language: siteLang,
      });
      setGeneratedPost(response?.post?.content || '');
      setSelectedPostId(response?.post?.id || selectedPostId);
    } catch (err) {
      console.error('Regenerate failed:', err);
      setGeneratedPost('Could not regenerate post right now. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleTranslate() {
    if (!selectedPostId || translating) return;
    setTranslating(true);
    try {
      const targetLang = siteLang === 'hi' ? 'en' : 'hi';
      const result = await translatePost(selectedPostId, targetLang);
      setTranslatedPost(result.translated_content);
      setShowTranslated(true);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslating(false);
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
            {filteredArticles.map((article) => (
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

            <button
              type="button"
              onClick={handleGenerate}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl btn-gradient py-3.5 text-[14px] font-semibold text-white shadow-[0_6px_24px_rgba(17,122,255,0.35)] transition hover:brightness-110"
            >
              <Sparkles size={15} strokeWidth={2} />
              Generate Post
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
                {/* Translate button */}
                {selectedPostId && !generating && (
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
                    {showTranslated ? 'Original' : translating ? 'Translating…' : `Translate to ${siteLang === 'hi' ? 'English' : 'हिंदी'}`}
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
              </div>
            </div>

            {showTranslated && translatedPost && (
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a6e]/60 bg-[#0d1840]/60 px-3 py-1 font-count text-[10.5px] uppercase tracking-widest text-[#6aa8ff]">
                  Translated · {siteLang === 'hi' ? 'English' : 'हिंदी'}
                </span>
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
                    <p className="mt-1 font-count text-[11px] text-[#3a4e70]">
                      {genSeconds}s elapsed
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="min-h-[260px] rounded-2xl border border-[#1e3260]/60 bg-[#0a1130]/70 p-5 text-[13.5px] leading-[1.75] text-[#c7d1eb] whitespace-pre-wrap"
              >
                {showTranslated && translatedPost ? translatedPost : generatedPost}
              </div>
            )}

            {/* Watermark */}
            {!generating && generatedPost && (
              <div className="mt-2 flex items-center gap-1.5 justify-end">
                <img src={logoSrc} alt="" className="h-3.5 w-3.5 object-contain opacity-50" />
                <span className="text-[10.5px] text-[#3a4e70]">Generated by AmbedkarGPT</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/60 px-4 py-3 text-center">
                <div className="text-[11px] text-[#8b94b8]">Characters</div>
                <div className="mt-1 font-count text-[22px] font-bold tabular-nums text-white">{chars}</div>
              </div>
              <div className="rounded-xl border border-[#1e3260]/60 bg-[#0a1130]/60 px-4 py-3 text-center">
                <div className="text-[11px] text-[#8b94b8]">Words</div>
                <div className="mt-1 font-count text-[22px] font-bold tabular-nums text-white">{words}</div>
              </div>
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

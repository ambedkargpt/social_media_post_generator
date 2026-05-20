import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Search, Sparkles, Trash2, BookmarkCheck, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPosts, updatePost, deletePost, translatePost } from '../api/posts';
import logoSrc from '../assets/images/logo-animation.png';

const STATUS_COLORS = {
  draft:     { bg: 'rgba(255,176,56,0.12)',  border: 'rgba(255,176,56,0.35)',  text: '#ffb038' },
  published: { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.35)',   text: '#22c55e' },
  archived:  { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)',  text: '#94a3b8' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {status}
    </span>
  );
}

function PostCard({ post, onCopy, onPublish, onArchive, copiedId }) {
  const [expanded, setExpanded] = useState(false);
  const [translating, setTranslating]     = useState(false);
  const [translated, setTranslated]       = useState('');
  const [showTranslated, setShowTranslated] = useState(false);

  const rawContent = post.content ?? '';
  const content    = showTranslated && translated ? translated : rawContent;
  const preview    = content.slice(0, 200);
  const hasMore    = content.length > 200;
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  async function handleTranslate() {
    if (showTranslated) { setShowTranslated(false); return; }
    if (translated) { setShowTranslated(true); return; }
    setTranslating(true);
    try {
      const res = await translatePost(post.id, 'en');
      setTranslated(res.translated_content ?? '');
      setShowTranslated(true);
    } catch { /* ignore */ }
    finally { setTranslating(false); }
  }

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-200"
      style={{
        backgroundColor: '#07101f',
        borderColor: '#1a2c55',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(63,159,255,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1a2c55'; }}
    >
      {/* top row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusBadge status={post.status} />
          <span className="text-[11.5px] text-[#4e5a80]">{date}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Translate */}
          <button
            type="button"
            onClick={handleTranslate}
            disabled={translating}
            className="flex items-center gap-1 rounded-lg border border-[#1e3260]/60 px-2.5 py-1.5 text-[11.5px] font-medium text-[#6b78a0] transition hover:border-[#3f9fff]/50 hover:text-[#3f9fff] disabled:opacity-50"
            title={showTranslated ? 'Show Hindi' : 'Translate to English'}
            style={showTranslated ? { borderColor: 'rgba(63,159,255,0.4)', color: '#3f9fff' } : {}}
          >
            <Languages size={12} strokeWidth={2} />
            {translating ? '…' : showTranslated ? 'हिंदी' : 'EN'}
          </button>

          {/* Publish */}
          {post.status === 'draft' && (
            <button
              type="button"
              onClick={() => onPublish(post.id)}
              className="flex items-center gap-1 rounded-lg border border-[#1e3260]/60 px-2.5 py-1.5 text-[11.5px] font-medium text-[#6b78a0] transition hover:border-[#22c55e]/50 hover:text-[#22c55e]"
              title="Publish"
            >
              <BookmarkCheck size={12} strokeWidth={2} />
              Publish
            </button>
          )}

          {/* Archive */}
          {post.status !== 'archived' && (
            <button
              type="button"
              onClick={() => onArchive(post.id)}
              className="flex items-center gap-1 rounded-lg border border-[#1e3260]/60 px-2.5 py-1.5 text-[11.5px] font-medium text-[#6b78a0] transition hover:border-red-500/40 hover:text-red-400"
              title="Archive"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          )}

          {/* Copy */}
          <button
            type="button"
            onClick={() => onCopy(post.id, content)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1e3260]/60 px-2.5 py-1.5 text-[11.5px] font-medium transition"
            style={{
              color: copiedId === post.id ? '#22c55e' : '#6b78a0',
              borderColor: copiedId === post.id ? 'rgba(34,197,94,0.4)' : undefined,
            }}
            title="Copy"
          >
            {copiedId === post.id
              ? <><Check size={12} strokeWidth={2.5} /> Copied</>
              : <><Copy size={12} strokeWidth={2} /> Copy</>
            }
          </button>
        </div>
      </div>

      {/* content */}
      <p
        className="whitespace-pre-wrap text-[13.5px] leading-relaxed"
        style={{ color: '#c5d0e8' }}
      >
        {expanded || !hasMore ? content : preview + '…'}
      </p>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="self-start text-[12px] font-medium transition hover:opacity-80"
          style={{ color: '#3f9fff' }}
        >
          {expanded ? 'Show less' : 'Read full post'}
        </button>
      )}

      {/* hashtags */}
      {post.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {post.hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: 'rgba(63,159,255,0.1)', color: '#5fa5ff', border: '1px solid rgba(63,159,255,0.2)' }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostHistory() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [posts,    setPosts]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [filter,   setFilter]  = useState('all');
  const [search,   setSearch]  = useState('');
  const [copiedId, setCopied]  = useState(null);

  useEffect(() => {
    getPosts({ limit: 200 })
      .then((data) => setPosts(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCopy(id, content) {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handlePublish(id) {
    try {
      const updated = await updatePost(id, { status: 'published' });
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } catch (err) {
      if (err?.response?.status === 429) {
        const detail = err.response?.data?.detail;
        alert(detail?.message ?? "You've used all 5 posts for today. Come back tomorrow!");
      }
    }
  }

  async function handleArchive(id) {
    try {
      await deletePost(id);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'archived' } : p)));
    } catch { /* ignore */ }
  }

  const filtered = posts.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.content?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:       posts.length,
    draft:     posts.filter((p) => p.status === 'draft').length,
    published: posts.filter((p) => p.status === 'published').length,
    archived:  posts.filter((p) => p.status === 'archived').length,
  };

  return (
    <div
      className="min-h-screen text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 50% -5%, #0d1636 0%, #070b1c 55%, #05081a 100%)' }}
    >
      <div className="pointer-events-none fixed -left-48 top-0 h-[500px] w-[500px] rounded-full bg-[#3f9fff]/8 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[#7b5cff]/8 blur-[140px]" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-[#141d3a]/70 bg-[#070b1c]/80 backdrop-blur-md">
        <div className="flex w-full items-center gap-5 px-8 py-5 md:px-12">
          {/* Left: brand */}
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} alt="AmbedkarGPT" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(63,159,255,0.5)]" />
            <span className="font-display text-[17px] font-bold text-white">
              Ambedkar<span className="gradient-text-cyan">GPT</span>
            </span>
          </div>

          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-full border border-[#1e3260]/70 px-4 py-2 text-[13px] font-medium text-[#6b78a0] transition hover:border-[#3a6bc4]/60 hover:text-white"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Dashboard
          </button>

          {/* Right: action */}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => navigate('/generate')}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white"
              style={{ background: 'linear-gradient(90deg,#0a7dff,#3a9fff)', boxShadow: '0 4px 18px rgba(10,125,255,0.35)' }}
            >
              <Sparkles size={15} strokeWidth={2.1} />
              Generate New
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[960px] px-6 py-8">
        {/* Title */}
        <div className="mb-7">
          <h1 className="font-display text-[28px] font-bold text-white">Post History</h1>
          <p className="mt-1 text-[13.5px] text-[#6b78a0]">All posts you've generated — read, copy, publish, or archive them.</p>
        </div>

        {/* Search + filter bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4e5a80]" />
            <input
              type="text"
              placeholder="Search posts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#1a2c55] bg-[#07101f] py-2.5 pl-9 pr-4 text-[13.5px] text-white placeholder:text-[#4e5a80] outline-none transition focus:border-[#3f9fff]/50"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-[#1a2c55] bg-[#07101f] p-1">
            {['all', 'draft', 'published', 'archived'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all duration-150"
                style={{
                  backgroundColor: filter === tab ? '#1a2a5e' : 'transparent',
                  color: filter === tab ? '#fff' : '#6b78a0',
                  boxShadow: filter === tab ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
                }}
              >
                {tab} <span className="ml-0.5 opacity-60">({counts[tab]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#4e5a80] text-[14px]">Loading posts…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1e3260]/60 bg-[#07101f]">
              <Sparkles size={24} strokeWidth={1.6} className="text-[#3f9fff]" />
            </div>
            <p className="text-[14px] text-[#6b78a0]">
              {search ? 'No posts match your search.' : 'No posts yet — go generate your first one!'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => navigate('/generate')}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold text-white"
                style={{ background: 'linear-gradient(90deg,#0a7dff,#3a9fff)' }}
              >
                <Sparkles size={13} strokeWidth={2} />
                Generate a post
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onCopy={handleCopy}
                onPublish={handlePublish}
                onArchive={handleArchive}
                copiedId={copiedId}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

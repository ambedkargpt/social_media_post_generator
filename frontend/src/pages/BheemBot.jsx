import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, BookOpen, Heart, HelpCircle,
  Search, Send, Mic, Paperclip,
  Sparkles, LayoutDashboard, Menu, X,
  ChevronRight, Bot,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sendChatMessage } from '../api/chat';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'constitution',
    icon: Scale,
    title: 'Constitution & Law',
    desc: 'Articles, rights, and constitutional history',
    prompt: 'Explain the fundamental rights in the Indian Constitution as drafted by Dr. Ambedkar and why they matter for marginalized communities.',
  },
  {
    id: 'writings',
    icon: BookOpen,
    title: "Ambedkar's Writings",
    desc: 'Books, speeches, and essays',
    prompt: "What are Dr. Ambedkar's most important books and what key ideas does each one explore?",
  },
  {
    id: 'justice',
    icon: Heart,
    title: 'Social Justice',
    desc: 'Caste, equality, and reform movements',
    prompt: 'How did Dr. Ambedkar define social justice and what concrete steps did he propose to achieve it?',
  },
  {
    id: 'faqs',
    icon: HelpCircle,
    title: 'FAQs',
    desc: "Common questions about Ambedkar's life and work",
    prompt: "What are some frequently asked questions about Dr. B.R. Ambedkar's life, education, and legacy?",
  },
];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hello! I'm BheemBot, your AI knowledge assistant trained on Dr. BR Ambedkar's writings and speeches. Ask me about constitutional law, social justice, or his philosophy.",
  sources: [],
  timestamp: Date.now(),
};

const SESSION_KEY = 'bheembot_history';
const CHAT_TIMEOUT_MS = 15_000;

// ── Small helpers ──────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[5px] py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-[#4d94ff]"
          style={{ animation: `bheembot-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const [expanded, setExpanded] = useState(false);

  // Long message collapse logic (≈3 lines ≈ 240 chars)
  const isLong = !isUser && msg.content.length > 480;
  const displayContent = isLong && !expanded ? msg.content.slice(0, 480) + '…' : msg.content;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="mr-2.5 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2d6fff] to-[#7b5cff] shadow-[0_0_14px_rgba(79,107,255,0.4)]">
          <Bot size={14} strokeWidth={2} className="text-white" />
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'max-w-[65%]' : ''}`}>
        <div
          className={[
            'rounded-2xl px-4 py-3 text-[13.5px] leading-[1.7]',
            isUser
              ? 'rounded-tr-sm bg-[#2d6fff] text-white'
              : 'rounded-tl-sm border border-[#1e3260]/60 bg-[#070f24] text-[#d0dff2]',
          ].join(' ')}
        >
          {msg.typing ? (
            <TypingDots />
          ) : (
            <>
              <span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="ml-1.5 text-[#4d94ff] underline underline-offset-2 hover:text-[#7ab4ff]"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Sources */}
        {!isUser && !msg.typing && msg.sources?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {msg.sources.map((s, i) => (
              <span
                key={i}
                title={s.snippet}
                className="inline-flex items-center gap-1 rounded-full border border-[#1a3060]/60 bg-[#0a1428] px-2.5 py-0.5 text-[10.5px] text-[#5a80b8]"
              >
                <BookOpen size={9} strokeWidth={1.8} />
                {s.video_title.length > 40 ? s.video_title.slice(0, 40) + '…' : s.video_title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function ChatSidebar({ onCategoryClick, searchQuery, setSearchQuery, onClose, mobile }) {
  const navigate = useNavigate();
  const filtered = searchQuery
    ? CATEGORIES.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.desc.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : CATEGORIES;

  return (
    <aside
      className={[
        'flex flex-col border-r border-[#141d3a]/70 bg-[#070c1e]',
        mobile ? 'w-full h-full' : 'w-[220px] shrink-0',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] shadow-[0_0_14px_rgba(79,107,255,0.35)]">
            <span className="font-display text-[11px] font-bold text-white">AI</span>
          </div>
          <span className="font-display text-[14px] font-semibold gradient-text-blue">AmbedkarGpt</span>
        </button>
        {mobile && (
          <button type="button" onClick={onClose} className="text-[#5a7a9e] hover:text-white">
            <X size={18} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#1e3260]/60 bg-[#0a1428] px-3 py-2.5">
          <Search size={12} strokeWidth={2} className="shrink-0 text-[#4a6080]" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[12px] text-white placeholder:text-[#4a6080] outline-none"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 pb-2">
        <p className="mb-2 px-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#4a6080]">
          Knowledge Categories
        </p>
        <div className="space-y-1">
          {/* eslint-disable-next-line no-unused-vars */}
          {filtered.map(({ id, icon: CatIcon, title, desc, prompt }) => (
            <button
              key={id}
              type="button"
              onClick={() => { onCategoryClick(prompt); if (mobile) onClose?.(); }}
              className="group w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-[#1e3260]/70 hover:bg-[#0d1531]/70"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#1e3260]/60 bg-[#0a1428] text-[#4d94ff]">
                  <CatIcon size={12} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-[#5a7a9e]">{desc}</p>
                </div>
                <ChevronRight size={12} strokeWidth={1.8} className="mt-1 shrink-0 text-[#1e3260] transition group-hover:text-[#4d94ff]" />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-[11.5px] text-[#4a6080]">No categories match your search.</p>
          )}
        </div>
      </div>

      {/* Back to dashboard */}
      <div className="mt-auto px-3 pb-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex w-full items-center gap-2 rounded-xl border border-[#1e3260]/40 bg-[#0a1428]/60 px-3 py-2 text-[11.5px] text-[#5a7a9e] transition hover:border-[#3a6bc4]/60 hover:text-white"
        >
          <LayoutDashboard size={13} strokeWidth={1.8} />
          Back to Dashboard
        </button>
      </div>

      {/* Footer */}
      <p className="px-4 pb-4 text-[10px] text-[#2a3a5e]">
        Powered by advanced RAG technology
      </p>
    </aside>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BheemBot() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // ── Chat state ──
  const [messages,   setMessages]   = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [WELCOME_MESSAGE];
  });
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Persist chat in sessionStorage ──
  useEffect(() => {
    try {
      // Don't store the typing indicator message
      const toStore = messages.filter((m) => !m.typing);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(toStore));
    } catch { /* storage full — ignore */ }
  }, [messages]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Build history for API (last 6 real messages, no welcome) ──
  function buildHistory(msgs) {
    return msgs
      .filter((m) => m.id !== 'welcome' && !m.typing && (m.role === 'user' || m.role === 'assistant'))
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || sending) return;

    // Clear input immediately
    setInput('');

    // User bubble
    const userMsg = { id: Date.now(), role: 'user', content: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    // Typing indicator
    const typingId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: typingId, role: 'assistant', typing: true, content: '', sources: [] }]);
    setSending(true);

    // Timeout guard
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== typingId),
        {
          id: Date.now(),
          role: 'assistant',
          content: 'BheemBot is taking too long to respond. Please try again.',
          sources: [],
          timestamp: Date.now(),
        },
      ]);
      setSending(false);
    }, CHAT_TIMEOUT_MS);

    try {
      const history = buildHistory(messages.concat(userMsg));
      const { reply, sources } = await sendChatMessage({ message: trimmed, history });
      if (timedOut) return;
      clearTimeout(timer);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== typingId),
        { id: Date.now(), role: 'assistant', content: reply, sources: sources || [], timestamp: Date.now() },
      ]);
    } catch (err) {
      if (timedOut) return;
      clearTimeout(timer);

      // If 401, session expired
      const status = err?.response?.status;
      if (status === 401) {
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant',
            content: 'Your session has expired. Please log in again.',
            sources: [],
            timestamp: Date.now(),
          },
        ]);
        setTimeout(() => {
          sessionStorage.setItem('auth_redirect', '/bheembot');
          logout().catch(() => {});
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== typingId),
          {
            id: Date.now(),
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
            sources: [],
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      if (!timedOut) setSending(false);
    }
  }, [input, sending, messages, navigate, logout]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleCategoryClick(prompt) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  return (
    <div
      className="flex h-screen overflow-hidden text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 20% 0%, #0d1636 0%, #070b1c 55%, #05081a 100%)' }}
    >
      {/* ── CSS for typing dots ── */}
      <style>{`
        @keyframes bheembot-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .5; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex">
        <ChatSidebar
          onCategoryClick={handleCategoryClick}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[260px]">
            <ChatSidebar
              mobile
              onCategoryClick={handleCategoryClick}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main chat area ── */}
      <div className="relative flex flex-1 min-w-0 flex-col">

        {/* ── Ambient glows ── */}
        <div className="pointer-events-none fixed top-0 right-0 h-[380px] w-[380px] rounded-full bg-[#3f9fff]/8 blur-[130px]" />
        <div className="pointer-events-none fixed bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-[#7b5cff]/8 blur-[130px]" />

        {/* ── Header ── */}
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#141d3a]/70 bg-[#070b1c]/90 px-4 py-3.5 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e3260]/60 text-[#5a7a9e] transition hover:text-white md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={16} strokeWidth={1.8} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2d6fff] to-[#7b5cff] shadow-[0_0_18px_rgba(79,107,255,0.4)]">
              <Sparkles size={16} strokeWidth={2} className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-[15px] font-semibold text-white">AI Knowledge Assistant</h1>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                <span className="text-[11px] text-[#22c55e]">Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-[#5a7a9e] sm:block">
              {currentUser?.username ?? ''}
            </span>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hidden items-center gap-1.5 rounded-xl border border-[#1e3260]/60 bg-[#0a1428]/60 px-3 py-1.5 text-[12px] text-[#5a7a9e] transition hover:border-[#3a6bc4]/60 hover:text-white sm:flex"
            >
              <LayoutDashboard size={12} strokeWidth={1.8} />
              Dashboard
            </button>
          </div>
        </header>

        {/* ── Messages ── */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="relative z-10 shrink-0 border-t border-[#141d3a]/70 bg-[#070b1c]/90 px-4 py-4 backdrop-blur-sm md:px-6">
          <div className="flex items-end gap-2.5 rounded-2xl border border-[#1e3260]/70 bg-[#0a1428] px-4 py-3 transition focus-within:border-[#3f6bd4] focus-within:shadow-[0_0_0_3px_rgba(63,107,212,0.15)]">
            {/* Paperclip — disabled */}
            <button
              type="button"
              disabled
              title="Attachment (coming soon)"
              className="mb-0.5 shrink-0 text-[#2a3a5e] transition"
            >
              <Paperclip size={16} strokeWidth={1.8} />
            </button>

            {/* Textarea */}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="flex-1 resize-none bg-transparent text-[13.5px] text-white placeholder:text-[#3a4e6e] outline-none leading-[1.5]"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
            />

            {/* Mic — disabled */}
            <button
              type="button"
              disabled
              title="Voice input (coming soon)"
              className="mb-0.5 shrink-0 text-[#2a3a5e] transition"
            >
              <Mic size={16} strokeWidth={1.8} />
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className={[
                'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition',
                input.trim() && !sending
                  ? 'bg-[#2d6fff] text-white shadow-[0_0_14px_rgba(45,111,255,0.4)] hover:bg-[#3d7fff]'
                  : 'bg-[#0d1531] text-[#2a3a5e]',
              ].join(' ')}
            >
              <Send size={14} strokeWidth={2.2} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10.5px] text-[#2a3a5e]">
            BheemBot may occasionally make mistakes. Always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

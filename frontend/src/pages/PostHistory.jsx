import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  LayoutGrid,
  Languages,
  List,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  Undo2,
  X,
} from "lucide-react";

import SpeakButton from "../components/generate/SpeakButton";
import PublishSheet from "../components/publish/PublishSheet";
import PostContent from "../components/generate/PostContent";
import { useAuth } from "../context/AuthContext";
import { getPosts, deletePost, translatePost, togglePostVersion } from "../api/posts";
import {
  Button, Card, EmptyState, Input, PageHeader, Paper, Segmented, Skeleton, Stamp,
} from "../components/np";
import { useI18n } from "../i18n/index.jsx";

/**
 * My posts.
 *
 * Phase 6 of docs/redesign/neela-press.md. Every action and every API call is
 * the one that was here: copy, publish through the sheet, translate, listen,
 * toggle version, and archive - which is `deletePost` under the name the
 * product shows.
 *
 * What changed is that posts are grouped by the day they were written, drafts
 * sit on paper rather than in dark cards, and the row of actions under each
 * one is now a single primary action plus a menu. A card with six equal
 * buttons has no primary action, and this list is mostly read looking for one
 * thing to finish.
 */

const VIEW_KEY = "ambedkargpt_posts_view";

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/**
 * The day a post belongs to, named the way a person would.
 *
 * The locale is the UI language, not the browser's. English screens were
 * showing Hindi month names because the formatter was left to pick for
 * itself, and the browser of someone reading in English here is routinely
 * set to hi-IN.
 */
function dayLabel(date, lang, t) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const days = Math.round((today - that) / 86400000);
  if (days === 0) return t("np.nav.today");
  if (days === 1) return t("history.yesterday");
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short", day: "numeric", month: "short",
  }).format(d);
}

function timeLabel(date, lang) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

const STAMP_FOR = { draft: "draft", published: "published", archived: "saved" };


// Full-screen reader for one post. A dialog rather than a route so the list
// keeps its scroll position and filters when it closes.
function PostModal({ post, onClose, onCopy, copiedId }) {

  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");
  const [showTranslated, setShowTranslated] = useState(false);

  const content =
    showTranslated && translated ? translated : (post?.content ?? "");

  // Escape to close, and hold the background still while the dialog is open.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleTranslate() {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translated) {
      setShowTranslated(true);
      return;
    }
    setTranslating(true);
    try {
      const res = await translatePost(post.id, "en");
      setTranslated(res.translated_content ?? "");
      setShowTranslated(true);
    } catch {
      /* ignore */
    } finally {
      setTranslating(false);
    }
  }

  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString("hi-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  // Rendered into document.body. An ancestor with will-change/transform becomes
  // the containing block for position:fixed, which pinned the dialog inside the
  // page instead of the viewport and pushed its header off screen.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 md:p-8"
      style={{
        backgroundColor: "rgba(3,6,17,0.86)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative my-auto flex w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "#0a1130",
          borderColor: "#1e3260",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          maxHeight: "calc(100vh - 4rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div
          className="flex shrink-0 items-center gap-3 border-b border-[#1a2c55]/80 px-6 py-4"
          style={{ backgroundColor: "#0a1130" }}
        >
          <StatusBadge status={post.status} />
          <span className="text-[12px] text-[#5a6e9a]">{date}</span>
          <div className="ml-auto flex items-center gap-2">
            <SpeakButton
              content={content}
              lang={showTranslated && translated ? "en" : "hi"}
            />
            <button
              type="button"
              onClick={handleTranslate}
              disabled={translating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e3a6e]/80 bg-[#0d1840]/80 px-3 py-2 text-[12px] font-medium text-[#6aa8ff] transition hover:text-white disabled:opacity-40"
            >
              <Languages size={13} strokeWidth={2} />
              {translating
                ? "Translating…"
                : showTranslated
                  ? "Show original"
                  : "Translate"}
            </button>
            <button
              type="button"
              onClick={() => onCopy(post.id, content)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e3260]/80 bg-[#0d1531]/80 px-3 py-2 text-[12px] font-medium text-[#8b94b8] transition hover:text-white"
            >
              {copiedId === post.id ? (
                <Check size={13} strokeWidth={2.4} />
              ) : (
                <Copy size={13} strokeWidth={2} />
              )}
              {copiedId === post.id ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e3260]/80 text-[#8b94b8] transition hover:text-white"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* body — same renderer as the generator, so it reads identically */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 md:px-8">
          <PostContent content={content} lang={showTranslated && translated ? 'en' : 'hi'} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The overflow menu. A popover rather than a row of five icon buttons: every
 * one of those reads as equally important, and only one of them - finish this
 * draft - is what anyone came for.
 */
function PostMenu({ onOpen, onTranslate, onArchive, onToggleVersion, translating }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { key: "read", label: t("history.readFull"), icon: Maximize2, run: onOpen },
    { key: "translate", label: t("gen.translate"), icon: translating ? RefreshCw : Languages, run: onTranslate },
    { key: "version", label: t("gen.otherVersion"), icon: RefreshCw, run: onToggleVersion },
    { key: "archive", label: t("history.archive"), icon: X, run: onArchive, danger: true },
  ];

  return (
    <span className="np-menu" ref={ref}>
      <button
        type="button"
        className="np-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("common.more")}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} strokeWidth={2} />
      </button>
      {open && (
        <span className="np-menu-pop" role="menu">
          {items.map(({ key, label, icon: Icon, run, danger }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className={`np-menu-item ${danger ? "is-danger" : ""}`}
              onClick={() => { setOpen(false); run?.(); }}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** One post, on paper. */
function PostCard({ post, view, onOpen, onCopy, onPublish, onArchive, onToggleVersion, copiedId }) {
  const { t, lang } = useI18n();
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");
  const [showTranslated, setShowTranslated] = useState(false);

  const raw = post.content ?? "";
  const content = showTranslated && translated ? translated : raw;
  const isDraft = post.status === "draft";
  const copied = copiedId === post.id;

  async function handleTranslate() {
    // Translated once, then toggled. Asking the API again for a string it
    // already returned is a second wait for the same words.
    if (translated) { setShowTranslated((v) => !v); return; }
    setTranslating(true);
    try {
      const res = await translatePost(post.id, "en");
      setTranslated(res.translated_content ?? "");
      setShowTranslated(true);
    } catch {
      /* ignore */
    } finally {
      setTranslating(false);
    }
  }

  const stamp = (
    <Stamp variant={STAMP_FOR[post.status] || "draft"}>
      {t(`np.stamp.${post.status === "published" ? "published" : post.status === "archived" ? "saved" : "draft"}`)}
    </Stamp>
  );

  const primary = isDraft ? (
    <Button size="sm" onClick={() => onPublish(post.id)} iconRight={Send}>
      {t("history.publish")}
    </Button>
  ) : (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => onCopy(post.id, content)}
      iconLeft={copied ? Check : Copy}
      className={copied ? "np-copied" : ""}
    >
      {t(copied ? "common.copied" : "common.copy")}
    </Button>
  );

  const menu = (
    <PostMenu
      translating={translating}
      onOpen={() => onOpen(post)}
      onTranslate={handleTranslate}
      onArchive={() => onArchive(post.id)}
      onToggleVersion={() => onToggleVersion(post.id)}
    />
  );

  if (view === "list") {
    return (
      <li className="np-post-row">
        <span className="np-post-platform">{post.platform || t("posts.post")}</span>
        <span className="np-serif np-post-line">{content}</span>
        {stamp}
        <span className="np-mono np-post-time">{timeLabel(post.created_at, lang)}</span>
        <span className="np-post-actions">
          <SpeakButton text={content} lang={showTranslated && translated ? "en" : "hi"} />
          {primary}
          {menu}
        </span>
      </li>
    );
  }

  return (
    <Paper as="li" className="np-post-card">
      <div className="np-post-top">
        <span className="np-post-platform">{post.platform || t("posts.post")}</span>
        {stamp}
      </div>

      <button type="button" className="np-post-body" onClick={() => onOpen(post)}>
        <PostContent content={content} lang={showTranslated && translated ? "en" : "hi"} />
      </button>

      {post.hashtags?.length > 0 && (
        <p className="np-post-tags">
          {post.hashtags.map((tag) => <span key={tag}>#{tag}</span>)}
        </p>
      )}

      <div className="np-post-foot">
        <span className="np-mono np-post-time">{timeLabel(post.created_at, lang)}</span>
        <SpeakButton text={content} lang={showTranslated && translated ? "en" : "hi"} />
        {primary}
        {menu}
      </div>
    </Paper>
  );
}

export default function PostHistory() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [data, setData] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(readView);
  const [copiedId, setCopied] = useState(null);
  const [openPost, setOpenPost] = useState(null);
  // An archive that can be taken back within five seconds, because the action
  // behind it is a delete and there is no second copy.
  const [undo, setUndo] = useState(null);

  const userId = currentUser?.id;
  useEffect(() => {
    let cancelled = false;
    getPosts({ limit: 200 })
      .then((rows) => { if (!cancelled) setData({ userId, rows: rows ?? [] }); })
      .catch(() => { if (!cancelled) setData({ userId, rows: [] }); });
    return () => { cancelled = true; };
  }, [userId]);

  const fresh = data?.userId === userId ? data : null;
  const posts = fresh?.rows ?? [];
  const loading = !fresh;

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);

  async function handleCopy(id, content) {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  // Publishing means choosing a destination. The sheet does the posting and
  // the status change together, so "published" stops being a flag the user
  // set on their own database row and starts meaning the post is somewhere.
  function handlePublish(id) {
    setPublishing(posts.find((p) => p.id === id) ?? null);
  }

  function handlePublished(id) {
    setData((d) => (d ? {
      ...d,
      rows: d.rows.map((p) => (p.id === id ? { ...p, status: "published" } : p)),
    } : d));
  }

  async function handleToggleVersion(id) {
    try {
      const updated = await togglePostVersion(id);
      setData((d) => (d ? {
        ...d, rows: d.rows.map((p) => (p.id === id ? { ...p, ...updated } : p)),
      } : d));
    } catch {
      /* ignore */
    }
  }

  // The row leaves the list at once and the request waits. Undo inside five
  // seconds puts it back without the API ever hearing about it, which is the
  // only way to undo a delete that has no undo of its own.
  function handleArchive(id) {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    setData((d) => (d ? { ...d, rows: d.rows.filter((p) => p.id !== id) } : d));
    const timer = setTimeout(async () => {
      setUndo(null);
      try { await deletePost(id); } catch { /* ignore */ }
    }, 5000);
    setUndo({ post, timer });
  }

  function undoArchive() {
    if (!undo) return;
    clearTimeout(undo.timer);
    setData((d) => (d ? { ...d, rows: [undo.post, ...d.rows] } : d));
    setUndo(null);
  }

  const filtered = useMemo(() => posts.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search && !p.content?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [posts, filter, search]);

  // Grouped by the day they were written, newest day first.
  const days = useMemo(() => {
    const map = new Map();
    [...filtered]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .forEach((p) => {
        const label = dayLabel(p.created_at, lang, t) || "—";
        if (!map.has(label)) map.set(label, []);
        map.get(label).push(p);
      });
    return [...map.entries()];
  }, [filtered, lang, t]);

  const counts = {
    all: posts.length,
    draft: posts.filter((p) => p.status === "draft").length,
    published: posts.filter((p) => p.status === "published").length,
    archived: posts.filter((p) => p.status === "archived").length,
  };

  return (
    <div className="np-page">
      <PageHeader
        title={t("np.nav.myPosts")}
        actions={(
          <Button size="sm" onClick={() => navigate("/generate")} iconRight={ArrowRight}>
            {t("np.nav.newPost")}
          </Button>
        )}
      />

      <div className="np-posts-bar">
        <span className="np-posts-search">
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          {/* The room for the icon has to be an inline style: Input sets its
              own padding inline, and an inline style beats any class. */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            aria-label={t("history.searchPlaceholder")}
            style={{ paddingInlineStart: 44 }}
          />
        </span>

        <Segmented
          size="sm"
          ariaLabel={t("history.title")}
          value={filter}
          onChange={setFilter}
          options={["all", "draft", "published", "archived"].map((k) => ({
            value: k,
            label: `${t(`history.filter.${k}`)} ${counts[k]}`,
          }))}
        />

        <Segmented
          size="sm"
          ariaLabel={t("history.view")}
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: <LayoutGrid size={16} strokeWidth={2} /> },
            { value: "list", label: <List size={16} strokeWidth={2} /> },
          ]}
        />
      </div>

      {loading && (
        <div className="np-posts-grid" style={{ marginTop: 24 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={200} radius={12} />)}
        </div>
      )}

      {!loading && days.length === 0 && (
        <Card style={{ marginTop: 24 }}>
          <EmptyState
            title={t("history.empty")}
            action={(
              <Button onClick={() => navigate("/generate")} iconRight={ArrowRight}>
                {t("np.dash.write")}
              </Button>
            )}
          >
            {t("posts.emptyDesc")}
          </EmptyState>
        </Card>
      )}

      {!loading && days.map(([label, rows]) => (
        <section key={label} className="np-block">
          <h2 className="np-posts-day">{label}</h2>
          <ul className={view === "grid" ? "np-posts-grid" : "np-posts-list"}>
            {rows.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                view={view}
                onOpen={setOpenPost}
                onCopy={handleCopy}
                onPublish={handlePublish}
                onArchive={handleArchive}
                onToggleVersion={handleToggleVersion}
                copiedId={copiedId}
              />
            ))}
          </ul>
        </section>
      ))}

      {undo && (
        <div className="np-toast" role="status">
          <span>{t("np.posts.archived")}</span>
          <Button size="sm" variant="ghost" onClick={undoArchive} iconLeft={Undo2}>
            {t("np.common.undo")}
          </Button>
        </div>
      )}

      {openPost && (
        <PostModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          onCopy={handleCopy}
          copiedId={copiedId}
        />
      )}

      {publishing && (
        <PublishSheet
          post={publishing}
          onClose={() => setPublishing(null)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}

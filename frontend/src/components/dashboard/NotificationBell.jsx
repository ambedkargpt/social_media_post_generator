import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Trophy, X } from 'lucide-react';

// Milestones worth telling someone about. Close together early, where the
// encouragement matters, then further apart so it stays an achievement.
const MILESTONES = [10, 20, 50, 100, 200, 500];

const SEEN_KEY = 'milestones_seen';

function loadSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private browsing and blocked site data both throw here. Treating that as
    // "nothing seen yet" shows a milestone again, which is harmless; throwing
    // would take the whole topbar down.
    return [];
  }
}

function saveSeen(list) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    // Nothing to do: the badge reappears next session, and that is the
    // acceptable failure.
  }
}

/**
 * Milestone notifications for the dashboard topbar.
 *
 * The bell was decorative: no handler, and a dot that was always lit whether or
 * not anything had happened. A permanent unread badge trains people to ignore
 * it, so the dot now appears only when a milestone is genuinely unseen.
 */
export default function NotificationBell({ totalPosts }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(loadSeen);
  const btnRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  const reached = useMemo(() => {
    if (typeof totalPosts !== 'number') return [];
    return MILESTONES.filter((m) => totalPosts >= m).reverse();
  }, [totalPosts]);

  const unseen = reached.filter((m) => !seen.includes(m));
  const next = MILESTONES.find((m) => typeof totalPosts === 'number' && totalPosts < m);

  // Position the panel from the button, because the topbar sits inside
  // ancestors that create a containing block for fixed elements.
  useEffect(() => {
    if (!open || !btnRef.current) return undefined;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 10, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening is the acknowledgement. Marking on close instead would leave the
    // badge lit through the whole reading of it.
    if (next && unseen.length) {
      const merged = Array.from(new Set([...seen, ...reached]));
      setSeen(merged);
      saveSeen(merged);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={unseen.length ? `Notifications, ${unseen.length} new` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#1a254a]/70 bg-[#0d1531]/60 text-[#a3b0d4] transition hover:border-[#2a4375]/80 hover:text-white"
      >
        <Bell size={16} strokeWidth={1.9} />
        {unseen.length > 0 && (
          <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-[#ff4b7d] shadow-[0_0_8px_rgba(255,75,125,0.7)]" />
        )}
      </button>

      {open && anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Notifications"
            style={{ top: anchor.top, right: Math.max(anchor.right, 12) }}
            className="fixed z-[200] w-[320px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-[#1e3260] bg-[#080e24] shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-[#1a2c55] px-4 py-3">
              <span className="text-[14px] font-semibold text-white">Notifications</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8b94b8] transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {reached.length === 0 ? (
                <div className="px-4 py-6 text-[13px] leading-relaxed text-[#8b94b8]">
                  {typeof totalPosts === 'number' ? (
                    <>No milestones yet. Publish {MILESTONES[0]} posts to reach your first.</>
                  ) : (
                    <>Nothing to show yet.</>
                  )}
                </div>
              ) : (
                <ul>
                  {reached.map((m) => (
                    <li key={m} className="flex items-start gap-3 border-b border-[#141d3a]/70 px-4 py-3 last:border-b-0">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#3a2a10] bg-[#241a06] text-[#f0b643]">
                        <Trophy size={15} strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-white">
                          {m} posts published
                        </p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#8b94b8]">
                          You crossed {m} published posts. Keep going.
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {next && (
              <div className="border-t border-[#1a2c55] px-4 py-3 text-[12.5px] text-[#8b94b8]">
                Next milestone at <span className="font-semibold text-[#9dc3ff]">{next} posts</span>
                {typeof totalPosts === 'number' && <> · {next - totalPosts} to go</>}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

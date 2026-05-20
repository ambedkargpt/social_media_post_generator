import { useState } from 'react';
import { X, Trophy } from 'lucide-react';

const MILESTONE = 200;

export default function MilestoneBanner({ totalPosts, className = '', onHide }) {
  const [visible, setVisible] = useState(true);

  function dismiss() {
    setVisible(false);
    onHide?.();
  }

  if (!visible) return null;

  const reached      = typeof totalPosts === 'number' && totalPosts >= MILESTONE;
  const showProgress = typeof totalPosts === 'number';
  const pct          = showProgress ? Math.min((totalPosts / MILESTONE) * 100, 100) : null;

  if (reached) {
    onHide?.();
    return null;
  }

  return (
    <div
      className={`w-full overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(90deg, #b45309 0%, #d97706 25%, #f59e0b 50%, #d97706 75%, #b45309 100%)',
        backgroundSize: '200% 100%',
        animation: 'banner-shimmer 4s linear infinite, banner-slide-down 0.4s cubic-bezier(0.16,1,0.3,1) both',
      }}
      role="banner"
      aria-label="Milestone reward promotion"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 20px, rgba(255,255,255,0.15) 20px, rgba(255,255,255,0.15) 21px)' }}
      />

      <div className="relative flex min-h-[48px] items-center gap-3 px-4 py-2.5 md:px-6">
        <Trophy size={16} strokeWidth={2} className="shrink-0 text-amber-900/80" />

        <p className="flex-1 text-center text-[12px] font-semibold leading-snug text-amber-950 md:text-[13px]">
          Create{' '}
          <span className="font-black">{MILESTONE} posts</span>{' '}
          and earn{' '}
          <span className="font-black">₹2,000!</span>
          {'  ·  '}
          You&rsquo;re limited to{' '}
          <span className="font-bold">5 posts per day</span>{' '}
          — start today and reach your goal!
          {showProgress && (
            <span className="ml-3 inline-flex items-center gap-1.5">
              <span className="hidden sm:inline font-normal opacity-70">|</span>
              <span className="hidden sm:inline font-bold text-amber-900">
                {totalPosts} / {MILESTONE} posts
              </span>
              <span className="inline-flex h-4 w-20 overflow-hidden rounded-full bg-amber-900/20 align-middle">
                <span
                  className="h-full rounded-full bg-amber-900/70 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </span>
          )}
        </p>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss banner"
          className="shrink-0 rounded-full p-1 text-amber-900/60 transition hover:bg-amber-900/15 hover:text-amber-950"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      <style>{`
        @keyframes banner-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes banner-slide-down {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

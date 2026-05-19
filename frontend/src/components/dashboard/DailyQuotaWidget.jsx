import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

function useCountdown(resetAt) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!resetAt) return;
    function tick() {
      const diff = Math.max(0, Math.floor((new Date(resetAt) - Date.now()) / 1000));
      setSecs(diff);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * quota prop: { used, limit, remaining, reset_at, total_posts, milestone_target }
 */
export default function DailyQuotaWidget({ quota, loading }) {
  const countdown = useCountdown(quota?.remaining === 0 ? quota?.reset_at : null);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#141d3a]/70 bg-[#070b1c]/60 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-[#1e3260]/60 mb-3" />
        <div className="h-2 w-full animate-pulse rounded-full bg-[#1e3260]/40" />
      </div>
    );
  }

  if (!quota) return null;

  const { used, limit, remaining, reset_at, total_posts, milestone_target } = quota;
  const pct = Math.min((used / limit) * 100, 100);
  const milestonePct = Math.min((total_posts / milestone_target) * 100, 100);
  const atLimit = remaining === 0;

  return (
    <div className="rounded-2xl border border-[#141d3a]/70 bg-[#070b1c]/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3f9fff] to-[#7b5cff]">
          <Zap size={13} strokeWidth={2.2} className="text-white" />
        </span>
        <h3 className="font-display text-[14px] font-semibold text-white">Daily Posts</h3>
      </div>

      {/* Daily bar */}
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="text-[#8b94b8]">
          {atLimit ? 'Limit reached' : `${used} of ${limit} posts used today`}
        </span>
        <span className={`font-semibold ${atLimit ? 'text-red-400' : 'text-[#6aa8ff]'}`}>
          {atLimit ? '0 left' : `${remaining} left`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#1e3260]/50">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: atLimit
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : 'linear-gradient(90deg, #3f9fff, #7b5cff)',
          }}
        />
      </div>
      <div className="mt-1 flex justify-between font-count text-[10px] text-[#3a4e70]">
        {[...Array(limit + 1)].map((_, i) => (
          <span key={i}>{i}</span>
        ))}
      </div>

      {/* Countdown if at limit */}
      {atLimit && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2">
          <span className="text-[11px] text-red-400/80">Resets in</span>
          <span className="font-count text-[13px] font-bold tabular-nums text-red-400">{countdown}</span>
        </div>
      )}

      {/* Milestone progress */}
      <div className="mt-4 border-t border-[#141d3a]/70 pt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
          <span className="text-[#8b94b8]">Milestone reward</span>
          <span className="font-semibold text-[#f59e0b]">
            {total_posts} / {milestone_target} posts → ₹2,000
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e3260]/50">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${milestonePct}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              boxShadow: '0 0 8px rgba(245,158,11,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

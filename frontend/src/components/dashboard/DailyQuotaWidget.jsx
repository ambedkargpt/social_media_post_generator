import { useEffect, useState } from 'react';
import { Zap, Flame, AlertTriangle, Trophy } from 'lucide-react';

const DAILY_LIMIT = 5;
const MILESTONE   = 200;

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

/**
 * quota prop shape (from GET /posts/daily-quota):
 * { daily_used, daily_limit, daily_remaining, reset_at,
 *   total_posts, streak_days, total_streak_posts,
 *   streak_at_risk, streak_broken, milestone_target }
 */
export default function DailyQuotaWidget({ quota, loading }) {
  const countdown = useCountdown(quota?.daily_remaining === 0 ? quota?.reset_at : null);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#141d3a]/70 bg-[#070b1c]/60 p-5 space-y-3">
        <div className="h-3 w-28 animate-pulse rounded bg-[#1e3260]/60" />
        <div className="h-2 w-full animate-pulse rounded-full bg-[#1e3260]/40" />
        <div className="h-2 w-3/4 animate-pulse rounded-full bg-[#1e3260]/30" />
      </div>
    );
  }

  if (!quota) return null;

  const {
    daily_used = 0,
    daily_remaining = DAILY_LIMIT,
    reset_at,
    streak_days = 0,
    total_streak_posts = 0,
    streak_at_risk = false,
    streak_broken = false,
  } = quota;

  const atLimit       = daily_remaining === 0;
  const dailyPct      = Math.min((daily_used / DAILY_LIMIT) * 100, 100);
  const milestonePct  = Math.min((total_streak_posts / MILESTONE) * 100, 100);

  return (
    <div className="rounded-2xl border border-[#141d3a]/70 bg-[#070b1c]/60 p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3f9fff] to-[#7b5cff]">
            <Zap size={13} strokeWidth={2.2} className="text-white" />
          </span>
          <h3 className="font-display text-[14px] font-semibold text-white">Daily Posts</h3>
        </div>
        {/* Streak badge */}
        {streak_days > 0 && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              background: streak_days >= 7 ? 'linear-gradient(90deg,#ff6b35,#f59e0b)' : 'rgba(245,158,11,0.15)',
              color: streak_days >= 7 ? 'white' : '#f59e0b',
              border: streak_days >= 7 ? 'none' : '1px solid rgba(245,158,11,0.35)',
            }}
          >
            🔥 {streak_days} day{streak_days !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Streak broken notice */}
      {streak_broken && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" strokeWidth={2} />
          <p className="text-[12px] leading-snug text-red-400">
            <span className="font-semibold">Streak lost.</span> Progress reset to 0. Start again today!
          </p>
        </div>
      )}

      {/* Streak at risk */}
      {streak_at_risk && !streak_broken && streak_days > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
          <Flame size={14} className="mt-0.5 shrink-0 text-amber-400" strokeWidth={2} />
          <p className="text-[12px] leading-snug text-amber-400">
            <span className="font-semibold">Publish today</span> to protect your {streak_days}-day streak!
          </p>
        </div>
      )}

      {/* Daily bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
          <span className="text-[#8b94b8]">
            {atLimit ? 'Daily limit reached' : `${daily_used} of ${DAILY_LIMIT} published today`}
          </span>
          <span className={`font-semibold ${atLimit ? 'text-red-400' : 'text-[#6aa8ff]'}`}>
            {atLimit ? '0 left' : `${daily_remaining} left`}
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1e3260]/50">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${dailyPct}%`,
              background: atLimit
                ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                : 'linear-gradient(90deg,#3f9fff,#7b5cff)',
              boxShadow: atLimit ? '0 0 8px rgba(239,68,68,0.4)' : '0 0 8px rgba(63,159,255,0.35)',
            }}
          />
        </div>

        {/* Pip markers */}
        <div className="mt-1 flex justify-between font-count text-[9.5px] text-[#3a4e70]">
          {[...Array(DAILY_LIMIT + 1)].map((_, i) => <span key={i}>{i}</span>)}
        </div>
      </div>

      {/* Countdown at limit */}
      {atLimit && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/8 px-3.5 py-2.5">
          <span className="text-[12px] text-red-400/80">You've used all 5 posts for today. Resets in</span>
          <span className="font-count text-[14px] font-bold tabular-nums text-red-400">{countdown}</span>
        </div>
      )}

      {/* Milestone streak progress */}
      <div className="border-t border-[#141d3a]/70 pt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy size={12} strokeWidth={2} className="text-amber-400" />
            <span className="text-[11.5px] text-[#8b94b8]">Streak milestone</span>
          </div>
          <span className="text-[11.5px] font-semibold text-amber-400">
            {total_streak_posts} / {MILESTONE} → ₹2,000
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e3260]/50">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${milestonePct}%`,
              background: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
              boxShadow: '0 0 8px rgba(245,158,11,0.45)',
            }}
          />
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#3a4e70]">
          Only counts streak posts — breaking your streak resets this to 0
        </p>
      </div>
    </div>
  );
}

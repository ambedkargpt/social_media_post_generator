import { TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

/**
 * Top-of-dashboard metric tile.
 *
 * @param {object} p
 * @param {string} p.label        – title above value (e.g. "Total Searches")
 * @param {string} p.value        – the big number (formatted, e.g. "1,234")
 * @param {string} p.delta        – change string (e.g. "+12.5%")
 * @param {string} p.deltaLabel   – suffix (e.g. "vs last month")
 * @param {JSX.Element} p.icon    – lucide icon element
 * @param {string} p.iconGradient – tailwind gradient classes for the icon pill
 */
export default function StatCard({ label, value, delta, deltaLabel, icon, iconGradient }) {
  const { t } = useI18n();
  const positive = !delta?.startsWith('-');

  return (
    <div
      className="relative overflow-hidden rounded-2xl border px-5 py-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(180deg, rgba(16,25,55,0.85) 0%, rgba(10,16,38,0.85) 100%)',
        borderColor: 'rgba(60,85,155,0.22)',
      }}
    >
      {/* ambient corner glow */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(79,107,255,0.35) 0%, transparent 70%)' }}
      />

      <div className="flex items-start justify-between">
        <div className="text-[12px] font-medium leading-snug text-[#8b94b8] max-w-[110px]">
          {label}
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] ${iconGradient}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3.5 font-count text-[28px] font-bold leading-none text-white tabular-nums">
        {value}
      </div>

      {delta && (
        <div
          className={`mt-2.5 inline-flex items-center gap-1 font-count text-[11px] font-semibold ${
            positive ? 'text-[#22c55e]' : 'text-[#ef4444]'
          }`}
        >
          <TrendingUp size={11} strokeWidth={2.4} className={positive ? '' : 'rotate-180'} />
          {delta}
          <span className="font-medium text-[#6b78a0]"> {deltaLabel ?? t('stat.vsLastMonth')}</span>
        </div>
      )}
    </div>
  );
}

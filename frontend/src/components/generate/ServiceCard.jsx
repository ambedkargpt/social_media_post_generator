import { ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

/**
 * A selectable AI-service tile used on the /generate page.
 *
 * @param {object}  p
 * @param {JSX.Element} p.icon          – lucide icon element
 * @param {string}  p.iconGradient      – tailwind class(es) for the icon pill
 * @param {string}  p.glow              – subtle ambient corner-glow colour
 * @param {string}  p.title             – service name
 * @param {string}  p.description       – body text
 * @param {('comingSoon'|'new')=} p.badge – top-right corner tag
 * @param {boolean} p.selected          – whether the card is in its active state
 * @param {boolean=} p.disabled         – if true, click does nothing (coming-soon)
 * @param {() => void} p.onSelect       – click handler
 */
export default function ServiceCard({
  icon, iconGradient, glow, title, description,
  badge, selected, disabled, onSelect,
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      className={[
        'group relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300',
        disabled ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-1',
        selected ? 'border-[#3f9fff]/70' : 'border-[rgba(60,85,155,0.22)] hover:border-[#3f9fff]/40',
      ].join(' ')}
      style={{
        background: selected
          ? 'linear-gradient(180deg, rgba(22,44,95,0.85) 0%, rgba(10,18,44,0.85) 100%)'
          : 'linear-gradient(180deg, rgba(16,25,55,0.80) 0%, rgba(10,16,38,0.80) 100%)',
        boxShadow: selected ? '0 0 0 1px rgba(63,159,255,0.4), 0 14px 40px rgba(15,35,90,0.45)' : undefined,
      }}
    >
      {/* ambient corner glow */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
      />

      {/* badge */}
      {badge && (
        <span
          className={[
            'absolute top-4 right-4 rounded-full border px-2.5 py-[3px] text-[10px] font-semibold tracking-wide uppercase',
            badge === 'new'
              ? 'border-[#ffc94a]/50 bg-[#2e2614]/80 text-[#ffc94a]'
              : 'border-[#2a4375]/60 bg-[#0f1b3d]/80 text-[#8aa6e0]',
          ].join(' ')}
        >
          {badge === 'new' ? t('sel.new') : t('sel.comingSoon')}
        </span>
      )}

      {/* icon */}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] ${iconGradient}`}
      >
        {icon}
      </div>

      {/* title + body */}
      <div className="mt-5">
        <h3 className="font-display text-[18px] font-semibold text-white tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#8b94b8]">
          {description}
        </p>
      </div>

      {/* footer action */}
      <div className="mt-6 flex items-center justify-between">
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition',
            selected
              ? 'border-[#3f9fff]/60 bg-[#15295a]/80 text-white'
              : 'border-[#2a4375]/50 bg-[#0d1531]/60 text-[#6aa8ff]',
          ].join(' ')}
        >
          {t('sel.aiService')}
        </span>
        <span
          className={[
            'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300',
            selected
              ? 'bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] text-white shadow-[0_6px_18px_rgba(63,159,255,0.45)]'
              : 'border border-[#2a4375]/60 text-[#8b94b8] group-hover:border-[#3f9fff]/60 group-hover:text-white',
          ].join(' ')}
        >
          <ChevronRight size={14} strokeWidth={2.2} />
        </span>
      </div>
    </button>
  );
}

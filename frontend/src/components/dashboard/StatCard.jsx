/**
 * One activity number.
 *
 * The number is the point, so it carries the weight: a quiet label above, the
 * value large below it, and the icon held in a tinted square rather than a
 * filled gradient chip. The accent colour appears three times only — the hair
 * line along the top, the icon, and the icon's ground — so the tile stays navy
 * and four of these in a row read as a set instead of four coloured cards.
 *
 * @param {object} p
 * @param {string} p.label   – what is being counted
 * @param {string} p.value   – the number, already formatted
 * @param {JSX.Element} p.icon – lucide icon element
 * @param {string} p.accent  – hex accent for this metric
 */
export default function StatCard({ label, value, icon, accent = '#3f9fff' }) {
  return (
    <div className="dash-tile dash-hover px-4 py-3.5">
      {/* The accent as a hairline rather than a wash, so the tile stays navy. */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}b3, transparent)` }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11.5px] font-medium leading-snug text-[#8b94b8]">{label}</div>
          <div className="mt-2 font-count text-[26px] font-bold leading-none tabular-nums text-white sm:text-[30px]">
            {value}
          </div>
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}2e` }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

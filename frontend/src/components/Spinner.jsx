/**
 * The one spinner.
 *
 * There were eleven inline copies of `animate-spin rounded-full border-2`
 * before this, several of them the same ring at the same size with slightly
 * different colours, and the places that most needed one — the lazy route
 * fallback, the news grid — had none at all and rendered a bare coloured div.
 *
 * `label` is read by screen readers and, when `showLabel` is set, printed
 * under the ring. A spinner with no text tells a sighted user something is
 * happening but not what; on a slow connection that difference is the whole
 * message.
 */
export default function Spinner({ size = 32, label = 'Loading', showLabel = false, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite">
      <span
        className="spinner-ring"
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 14)) }}
      />
      {showLabel ? (
        <span className="text-[12.5px] tracking-wide text-[#8b94b8]">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

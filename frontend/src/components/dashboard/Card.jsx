/**
 * Shared dashboard panel (card) wrapper.
 *
 * The surface itself lives in index.css as `.dash-panel`, so every card on the
 * dashboard draws the same border, ground and inner highlight. `interactive`
 * adds the one hover the dashboard uses everywhere; it belongs on cards you
 * can click into, not on cards you only read.
 */
export default function Card({ children, className = '', padded = true, interactive = false }) {
  return (
    <section
      className={[
        'dash-panel overflow-hidden',
        interactive ? 'dash-hover' : '',
        padded ? 'p-4 sm:p-5' : '',
        className,
      ].join(' ')}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`font-display text-[15px] font-semibold text-white tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

/**
 * The marker that opens a section of the dashboard — ACTIVITY, ANALYTICS and
 * so on. `right` holds a control that belongs to the whole section, like the
 * date pill over the activity numbers; below sm it drops to its own line so it
 * never squeezes the label.
 */
export function SectionHeading({ label, right = null, className = '' }) {
  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 ${className}`}>
      <h2 className="dash-eyebrow">{label}</h2>
      {right}
    </div>
  );
}

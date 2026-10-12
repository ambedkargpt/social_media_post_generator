/**
 * A selectable label. Not a pill: the radius ladder stops at 8px for chips,
 * because 213 `rounded-full` elements is most of why the old design read as
 * a template.
 *
 * A selected chip inverts to the text colour rather than taking the action
 * blue - blue is reserved for things that do something when pressed, and a
 * filter does not.
 */
export default function Chip({ selected = false, children, className = '', style, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`np-chip ${className}`}
      style={{
        height: 40,
        padding: '0 14px',
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--color-np-text)' : 'var(--color-np-rule)'}`,
        background: selected ? 'var(--color-np-text)' : 'transparent',
        color: selected ? 'var(--color-np-ink)' : 'var(--color-np-text-2)',
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'background-color var(--np-dur-1) var(--np-ease-out),'
          + ' border-color var(--np-dur-1) var(--np-ease-out),'
          + ' color var(--np-dur-1) var(--np-ease-out)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Chips overflow on a phone. They scroll rather than wrap into four rows, and
 * the fade on the right edge is what tells the reader there is more - a
 * scrollbar does not appear on touch until the scroll has already started.
 */
export function ChipRow({ children, className = '', style }) {
  return (
    <div
      className={`np-chip-row ${className}`}
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        scrollSnapType: 'x proximity',
        scrollbarWidth: 'none',
        maskImage: 'linear-gradient(90deg, #000 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, #000 85%, transparent 100%)',
        paddingRight: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

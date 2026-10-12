/**
 * The state of a piece of writing, stamped on it.
 *
 * Text comes from i18n and never from `text-transform`. Devanagari has no
 * case, so an uppercase rule either does nothing or, worse, carries meaning
 * in English that simply vanishes in Hindi.
 */
const VARIANTS = {
  draft: {
    border: '2px dashed var(--color-np-muted)',
    color: 'var(--color-np-muted)',
    rotate: 0,
  },
  published: {
    border: '2px solid var(--color-np-brass)',
    color: 'var(--color-np-brass)',
    rotate: -6,
  },
  saved: {
    border: '2px solid #8A6A1E',
    color: '#8A6A1E',
    rotate: -3,
  },
};

export default function Stamp({ variant = 'draft', children, animate = false, style, className = '' }) {
  const v = VARIANTS[variant] || VARIANTS.draft;
  return (
    <span
      className={`np-stamp np-display ${animate ? 'np-stamp-land' : ''} ${className}`}
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 6,
        border: v.border,
        color: v.color,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.02em',
        transform: `rotate(${v.rotate}deg)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * The reading register.
 *
 * Everything the user will publish or read at length sits on paper: drafts,
 * post previews, bot answers. The brief asked for "somewhere brighter and
 * quieter to sit", and this is it - the one place in the signed-in app that
 * is not dark.
 *
 * `tilt` is for grids of drafts, where a degree of rotation reads as a stack
 * of sheets rather than as a table of rows. It is cosmetic and never changes
 * the layout, because the rotation happens after layout.
 */
export default function Paper({
  children,
  tilt = 0,                 // -1 | 0 | 1 degrees
  className = '',
  style,
  ...rest
}) {
  return (
    <article
      className={`np-paper ${className}`}
      style={{
        background: 'var(--color-np-paper)',
        color: 'var(--color-np-paper-ink)',
        borderRadius: 12,
        // Static. The spec forbids animated shadows, and this one never moves.
        boxShadow: '0 10px 22px rgba(0,0,0,.45)',
        fontFamily: 'var(--font-np-serif)',
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        padding: 24,
        ...style,
      }}
      {...rest}
    >
      {children}
    </article>
  );
}

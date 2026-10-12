/**
 * A card is a tone and a hairline, not an outline.
 *
 * The old GlassCard separated itself with a translucent fill, a white/10
 * border and a 45px shadow, and because every section used it every section
 * looked the same. Here the fill does the separating, the edge is one pixel,
 * and there is no shadow at all - depth comes from the surface ladder
 * (ink -> desk -> raised -> active), not from blur.
 */
export default function Card({
  children,
  interactive = false,
  as: As = 'div',
  className = '',
  style,
  ...rest
}) {
  // An interactive card must be a real button or link (guardrail §7), and
  // a bare <button> inside a form submits it unless it says otherwise.
  const isButton = As === 'button';
  return (
    <As
      {...(isButton ? { type: 'button' } : null)}
      className={`np-card ${interactive ? 'np-card-interactive' : ''} ${className}`}
      style={{
        background: 'var(--color-np-desk)',
        border: '1px solid var(--color-np-edge)',
        borderRadius: 16,
        padding: 24,
        ...style,
      }}
      {...rest}
    >
      {children}
    </As>
  );
}

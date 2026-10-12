/**
 * Whose news this is. Text in its own colour, optionally behind the party's
 * own symbol - the white line art, not the round logo, because at 18px a
 * colour badge is a smudge and a line drawing still reads.
 */
const TONES = {
  party:      'var(--color-np-neela-300)',
  opposition: 'var(--color-np-opposition)',
  general:    'var(--color-np-muted)',
  top:        'var(--color-np-brass)',
};

export default function Tag({ tone = 'general', symbol, children, style, className = '' }) {
  return (
    <span
      className={`np-tag ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: TONES[tone] || TONES.general,
        fontSize: 13,
        fontWeight: 600,
        ...style,
      }}
    >
      {symbol && (
        <img src={symbol} alt="" aria-hidden="true" width={18} height={18}
             style={{ opacity: 0.9, objectFit: 'contain' }} />
      )}
      {children}
    </span>
  );
}

import { partyLogo, partySymbol } from '../../utils/politicalParties';

/**
 * A party's own marks, used instead of a generic avatar or an icon.
 *
 * Two of them, and they are not interchangeable:
 *   PartyLogo   the round colour badge - identity. The rail card, signup,
 *               settings. Round is the one place the radius ladder allows it.
 *   PartySymbol the white line art - the hand, the cycle, the lotus. Used
 *               small beside a tag, or large and faint as a watermark, where
 *               a colour badge would be a smudge.
 *
 * `alt` is empty when the mark sits beside the party's name, because reading
 * the name twice is noise; it carries the name when the mark is the only
 * label.
 */
export function PartyLogo({ party, size = 32, alt, style, className = '' }) {
  const src = partyLogo(party);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%', objectFit: 'cover', flex: 'none', ...style }}
    />
  );
}

export function PartySymbol({ party, size = 20, alt, watermark = false, style, className = '' }) {
  const src = partySymbol(party);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        flex: 'none',
        opacity: watermark ? 0.06 : 0.9,
        ...style,
      }}
    />
  );
}

import Chakra from './Chakra';

/**
 * The one button.
 *
 * Four variants and three sizes, and nothing that glows. The old
 * `.btn-gradient` answered a hover with a 28px coloured shadow, which reads
 * as lit rather than as pressed; here hover moves the fill and active moves
 * the button, both on transform and colour only.
 *
 * `loading` keeps the button's width while it swaps the icon for a spinning
 * chakra, so the row does not reflow mid-submit, and keeps PrimaryButton's
 * double-submit guard: disabled while loading, with aria-busy for anyone
 * listening.
 */

const SIZES = {
  sm: { h: 40, px: 14, text: 14, radius: 8,  gap: 7,  icon: 15 },
  md: { h: 48, px: 18, text: 15, radius: 10, gap: 8,  icon: 16 },
  lg: { h: 54, px: 22, text: 17, radius: 10, gap: 10, icon: 18 },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  as: As = 'button',
  type = 'button',
  className = '',
  fullWidth = false,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;
  // A primary at lg is the page's one loud element, so it takes the display
  // face. Everything else stays in the UI face, which sits better in Hindi
  // at small sizes.
  const display = variant === 'primary' && size === 'lg';

  const base = {
    height: s.h,
    paddingInline: s.px,
    borderRadius: s.radius,
    gap: s.gap,
    fontSize: s.text,
    fontWeight: display ? 700 : 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: fullWidth ? '100%' : undefined,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled && !loading ? 0.55 : 1,
    transition: 'background-color var(--np-dur-1) var(--np-ease-out),'
      + ' border-color var(--np-dur-1) var(--np-ease-out),'
      + ' color var(--np-dur-1) var(--np-ease-out),'
      + ' transform var(--np-dur-1) var(--np-ease-out)',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  };

  const props = {
    className: `np-btn np-btn-${variant} ${display ? 'np-display' : ''} ${className}`,
    style: base,
    disabled: As === 'button' ? isDisabled : undefined,
    'aria-busy': loading || undefined,
    'aria-disabled': As !== 'button' && isDisabled ? true : undefined,
    ...(As === 'button' ? { type } : {}),
    ...rest,
  };

  return (
    <As {...props}>
      {loading
        ? <Chakra size={s.icon} mode="spin" />
        : IconLeft && <IconLeft size={s.icon} strokeWidth={2} />}
      {children}
      {!loading && IconRight && <IconRight size={s.icon} strokeWidth={2} />}
    </As>
  );
}

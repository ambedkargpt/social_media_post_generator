// Small 4-point sparkle used as decorative separator throughout the design.
export default function Sparkle({ size = 14, className = '', color = '#5fa5ff', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M8 0 L9 7 L16 8 L9 9 L8 16 L7 9 L0 8 L7 7 Z"
        fill={color}
      />
    </svg>
  );
}

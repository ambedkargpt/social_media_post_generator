/**
 * The Ashoka chakra, drawn rather than imported.
 *
 * This is the one decorative shape in the redesign, and it does three jobs:
 * a spinner while something loads, a ring while something fills, and a static
 * mark on empty states. It replaces the Sparkles icon that used to sit on
 * every primary button - a sparkle says "a machine made this", which is the
 * opposite of what this product is arguing.
 *
 * Twenty-four spokes, as on the flag. They are drawn as twelve diameters
 * rather than twenty-four radii: half the elements, identical result.
 */

const SPOKES = 12;           // diameters, so 24 spokes
const VIEW = 48;             // viewBox, so maths below is in one unit
const C = VIEW / 2;

export default function Chakra({
  size = 20,
  mode = 'static',           // 'spin' | 'progress' | 'static'
  value = 0,                 // 0..1, progress only
  decorative = false,        // slower spin when it is not a wait indicator
  className = '',
  title,
}) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  // Clamped rather than trusted: a value over 1 makes the arc wrap and read
  // as though it had gone backwards.
  const filled = Math.max(0, Math.min(1, value)) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={`${mode === 'spin' ? (decorative ? 'np-chakra-slow' : 'np-chakra-spin') : ''} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      {/* rim */}
      <circle cx={C} cy={C} r={r} stroke="currentColor" strokeWidth="2" opacity={mode === 'progress' ? 0.18 : 0.9} />

      {/* the filled arc, drawn from twelve o'clock */}
      {mode === 'progress' && (
        <circle
          cx={C} cy={C} r={r}
          stroke="currentColor" strokeWidth="2" strokeLinecap="butt"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: 'stroke-dasharray var(--np-dur-4) var(--np-ease-out)' }}
        />
      )}

      {/* spokes */}
      <g stroke="currentColor" strokeWidth="1.25" opacity={mode === 'progress' ? 0.35 : 0.75}>
        {Array.from({ length: SPOKES }, (_, i) => {
          const a = (Math.PI / SPOKES) * i;
          const dx = Math.cos(a) * r;
          const dy = Math.sin(a) * r;
          return <line key={i} x1={C - dx} y1={C - dy} x2={C + dx} y2={C + dy} />;
        })}
      </g>

      {/* hub */}
      <circle cx={C} cy={C} r="3.4" fill="currentColor" />
    </svg>
  );
}

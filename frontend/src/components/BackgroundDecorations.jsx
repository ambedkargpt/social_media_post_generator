// Auth page background — replicates the login/signup screenshots:
//   • concentric radar arcs hugging one side of the viewport (behind brand panel)
//   • soft curved wave lines on the opposite bottom corner
//   • scattered 4-point sparkle glyphs
//   • subtle radial glows tinted blue
//
// variant = 'login'  → brand panel on RIGHT  → rings on right, waves bottom-left
// variant = 'signup' → brand panel on LEFT   → rings on left,  waves bottom-right

function Sparkle({ top, left, right, size = 12, opacity = 0.35, color = '#8aabff' }) {
  const style = { top, left, right, opacity, width: size, height: size };
  return (
    <svg className="absolute" style={style} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0 L9 7 L16 8 L9 9 L8 16 L7 9 L0 8 L7 7 Z" fill={color} />
    </svg>
  );
}

function ConcentricRings({ side = 'right' }) {
  // Rings are anchored at ~50% vertical, offset beyond the edge so the visible
  // portion reads as an arc rather than a full circle — matches screenshot.
  const isRight = side === 'right';
  const transform = `translate(${isRight ? '50%' : '-50%'}, -50%)`;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        top: '50%',
        [isRight ? 'right' : 'left']: 0,
        width: '900px',
        height: '900px',
        transform,
      }}
    >
      <svg
        viewBox="0 0 900 900"
        className="h-full w-full"
        style={{ opacity: 0.55 }}
      >
        <defs>
          <radialGradient id="ring-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="rgba(70,130,230,0.0)" />
            <stop offset="60%" stopColor="rgba(70,130,230,0.18)" />
            <stop offset="100%" stopColor="rgba(70,130,230,0.0)" />
          </radialGradient>
          <mask id="ring-mask">
            <circle cx="450" cy="450" r="450" fill="url(#ring-fade)" />
          </mask>
        </defs>

        <g mask="url(#ring-mask)" stroke="#4a78c8" fill="none">
          <circle cx="450" cy="450" r="120" strokeWidth="1"   opacity="0.55" />
          <circle cx="450" cy="450" r="190" strokeWidth="1"   opacity="0.50" />
          <circle cx="450" cy="450" r="260" strokeWidth="1"   opacity="0.42" />
          <circle cx="450" cy="450" r="330" strokeWidth="0.9" opacity="0.35" />
          <circle cx="450" cy="450" r="400" strokeWidth="0.9" opacity="0.28" strokeDasharray="3 10" />
          <circle cx="450" cy="450" r="440" strokeWidth="0.8" opacity="0.22" strokeDasharray="2 12" />
        </g>

        <g>
          <circle cx="450" cy="450" r="4"  fill="#79c4ff" />
          <circle cx="450" cy="450" r="16" fill="#3f9fff" opacity="0.18" />
          <circle cx="450" cy="450" r="40" fill="#3f9fff" opacity="0.08" />
        </g>
      </svg>
    </div>
  );
}

function Waves({ side = 'left' }) {
  const isLeft = side === 'left';
  return (
    <svg
      className="pointer-events-none absolute"
      style={{
        bottom: 160,
        [isLeft ? 'left' : 'right']: -160,
        width: 560,
        height: 240,
        opacity: 0.26,
        transform: isLeft ? 'rotate(38deg)' : 'scaleX(-1) rotate(38deg)',
        transformOrigin: isLeft ? 'bottom left' : 'bottom right',
      }}
      viewBox="0 0 560 240"
      aria-hidden="true"
    >
      <path d="M 0 60  Q 140 15  280 65  T 560 55"  stroke="#7ba3ff" strokeWidth="1.4" fill="none" />
      <path d="M 0 110 Q 150 65  300 112 T 560 108" stroke="#6b8aff" strokeWidth="1.2" fill="none" />
      <path d="M 0 160 Q 170 115 340 162 T 560 158" stroke="#7ba3ff" strokeWidth="1.0" fill="none" />
      <path d="M 0 210 Q 150 168 300 212 T 560 208" stroke="#5a78ff" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export default function BackgroundDecorations({ variant = 'login' }) {
  const ringsSide = variant === 'signup' ? 'left' : 'right';
  const wavesSide = variant === 'signup' ? 'right' : 'left';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient wash — subtle vignette toward the brand-panel side */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'signup'
              ? 'radial-gradient(120% 80% at 20% 50%, rgba(30,70,160,0.18) 0%, rgba(6,10,26,0) 55%), linear-gradient(180deg,#060a1c 0%, #05081a 100%)'
              : 'radial-gradient(120% 80% at 80% 50%, rgba(30,70,160,0.18) 0%, rgba(6,10,26,0) 55%), linear-gradient(180deg,#060a1c 0%, #05081a 100%)',
        }}
      />

      {/* Extra corner glow behind the rings */}
      <div
        className="pointer-events-none absolute h-[820px] w-[820px] rounded-full blur-[120px]"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          [ringsSide]: '-260px',
          background:
            'radial-gradient(circle, rgba(63,159,255,0.22) 0%, rgba(30,70,160,0.09) 40%, transparent 70%)',
        }}
      />

      {/* Central image glow — bright white-blue halo centred on the Ambedkar image */}
      <div
        className="pointer-events-none absolute h-[700px] w-[700px] rounded-full blur-[90px]"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          [ringsSide]: '0px',
          background:
            'radial-gradient(circle, rgba(200,220,255,0.28) 0%, rgba(120,170,255,0.14) 35%, transparent 70%)',
        }}
      />

      <ConcentricRings side={ringsSide} />
      <Waves side={wavesSide} />

      {/* Sparkle glyphs — positions picked to echo the screenshots */}
      <Sparkle top="12%"  left="8%"   size={10} opacity={0.40} />
      <Sparkle top="24%"  left="42%"  size={8}  opacity={0.28} />
      <Sparkle top="18%"  right="14%" size={9}  opacity={0.32} />
      <Sparkle top="58%"  left="6%"   size={11} opacity={0.35} />
      <Sparkle top="72%"  left="38%"  size={7}  opacity={0.22} />
      <Sparkle top="62%"  right="8%"  size={9}  opacity={0.28} />
      <Sparkle top="88%"  left="22%"  size={8}  opacity={0.25} />
      <Sparkle top="38%"  right="32%" size={7}  opacity={0.20} />
    </div>
  );
}

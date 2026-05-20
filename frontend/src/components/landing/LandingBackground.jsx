/**
 * Full-page fixed background for the landing page.
 * Uses multiple evenly-distributed glows so every section
 * has consistent ambient lighting — no dark bands between sections.
 */
const PARTICLES = [
  'hp-1','hp-2','hp-3','hp-4','hp-5','hp-6','hp-7','hp-8',
  'hp-9','hp-10','hp-11','hp-12','hp-13','hp-14','hp-15',
];

export default function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">

      {/* Base animated gradient */}
      <div
        className="hero-bg-shift absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg,#030611 0%,#050a18 25%,#071030 50%,#050a18 75%,#030611 100%)',
        }}
      />

      {/* Even ambient glow — covers full viewport uniformly */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 50%, rgba(20,60,160,0.10) 0%, transparent 70%)',
        }}
      />

      {/* Top-left corner glow */}
      <div
        className="absolute -left-32 top-0 h-[55vh] w-[55vw] rounded-full blur-[140px]"
        style={{ background: 'rgba(29,102,222,0.12)' }}
      />

      {/* Top-right corner glow */}
      <div
        className="absolute -right-32 top-[10vh] h-[50vh] w-[50vw] rounded-full blur-[140px]"
        style={{ background: 'rgba(45,125,251,0.10)' }}
      />

      {/* Centre glow — lights up the middle sections */}
      <div
        className="absolute left-1/2 top-1/2 h-[60vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[160px]"
        style={{ background: 'rgba(30,79,181,0.09)' }}
      />

      {/* Bottom-left glow */}
      <div
        className="absolute -left-24 bottom-[10vh] h-[45vh] w-[45vw] rounded-full blur-[130px]"
        style={{ background: 'rgba(41,108,255,0.10)' }}
      />

      {/* Bottom-right glow */}
      <div
        className="absolute -right-24 bottom-0 h-[50vh] w-[50vw] rounded-full blur-[140px]"
        style={{ background: 'rgba(30,60,150,0.11)' }}
      />

      {/* Floating particles */}
      {PARTICLES.map((cls) => (
        <div key={cls} className={`hero-particle ${cls}`} />
      ))}
    </div>
  );
}

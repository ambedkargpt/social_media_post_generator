import Sparkle from './Sparkle';

export default function SectionLabel({ children, size = 'md' }) {
  const isLg = size === 'lg';
  return (
    <div className="flex justify-center">
      <div
        className={`relative inline-flex items-center gap-4 rounded-full border border-[#4f8fff]/50 bg-[#071228] shadow-[0_0_48px_rgba(63,159,255,0.35),inset_0_0_24px_rgba(63,159,255,0.08)] backdrop-blur-sm ${
          isLg ? 'px-12 py-5' : 'px-11 py-4.5'
        }`}
      >
        {/* inner top-edge highlight */}
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(100,180,255,0.6),transparent)]" />

        <span className="sparkle-twinkle inline-flex">
          <Sparkle size={isLg ? 28 : 26} color="#4fb4ff" />
        </span>

        <span
          className={`font-bold tracking-wide ${
            isLg ? 'text-[28px]' : 'text-[26px]'
          }`}
          style={{
            background: 'linear-gradient(90deg, #a8d0ff 0%, #4fb4ff 50%, #a8d0ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {children}
        </span>

        <span className="sparkle-twinkle-delay inline-flex">
          <Sparkle size={isLg ? 28 : 26} color="#4fb4ff" />
        </span>
      </div>
    </div>
  );
}

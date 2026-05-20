import { GraduationCap, Sparkles, Megaphone, Database } from 'lucide-react';
import SectionLabel from './SectionLabel';
import StaggerReveal from '../ui/StaggerReveal';

const USE_CASES = [
  {
    icon: GraduationCap,
    title: 'Academics, Scholars, Journalists',
    body:  'Find authentic citations, arguments, and context for accurate research.',
  },
  {
    icon: Sparkles,
    title: 'Creators, Influencers & Artists',
    body:  'Inspire authentic, impactful content with Ambedkar’s powerful, original words.',
  },
  {
    icon: Megaphone,
    title: 'Activists & Advocates',
    body:  'Empower advocacy campaigns with Ambedkar’s compelling arguments.',
  },
  {
    icon: Database,
    title: 'Data Scientists, NLP Engineers',
    body:  'Train next-gen AI with authentic, unparalleled data on social justice.',
  },
];

function UseCaseCard({ icon: Icon, title, body }) {
  return (
    <div className="group relative">
      {/* outer glow — same radial shape as the inner bloom, extends beyond the card */}
      <div
        className="pointer-events-none absolute -inset-6 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(63,159,255,0.28) 0%, rgba(63,159,255,0.10) 45%, transparent 70%)', filter: 'blur(18px)' }}
      />

      <div className="glass-card hover-lift relative overflow-hidden p-7 transition-all duration-500 hover:border-[#3f9fff]/30 md:p-8">
        {/* inner illumination — card surface lights up */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(63,159,255,0.22) 0%, rgba(63,159,255,0.10) 40%, transparent 72%)' }}
        />
        {/* corner glow accent */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#3f9fff]/15 blur-3xl" />

        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#2a4375]/80 bg-[#0c1735]/80 text-[#5fa5ff] shadow-[0_0_22px_rgba(63,159,255,0.25)]">
          <Icon size={19} strokeWidth={1.8} />
        </span>

        <h3 className="mt-6 text-[20px] font-semibold text-white md:text-[22px]">
          {title}
        </h3>
        <p className="mt-3 max-w-[420px] text-[14px] leading-relaxed text-[#a6b9d6]">
          {body}
        </p>
      </div>
    </div>
  );
}

// Use Cases — centered title with gradient-accent words, 2×2 feature grid
export default function UseCasesGrid() {
  return (
    <section id="bheem" className="relative py-20 md:py-28">
      {/* Ambient glow — extended to bleed into adjacent sections */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-1/2 top-0 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-[#3f78ff]/8 blur-[150px]" />
        <div className="absolute left-1/2 bottom-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[#2d55c0]/7 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6">
        <SectionLabel>Use Cases</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[46px] font-bold leading-[1.05] text-white md:text-[62px]">
          AI-Powered Knowledge for{' '}
          <span className="italic gradient-text-blue">Equality</span>
          <br className="hidden md:block" />
          {' '}and{' '}
          <span className="italic gradient-text-blue">Empowerment</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[15px] leading-7 text-[#a6b9d6]">
          Our AI system connects scholars, creators, engineers, and changemakers — automating
          knowledge access, providing verified insights, and transforming information into
          actionable understanding.
        </p>

        <StaggerReveal
          step={100}
          className="mt-14 grid gap-6 md:grid-cols-2"
        >
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.title} {...uc} />
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

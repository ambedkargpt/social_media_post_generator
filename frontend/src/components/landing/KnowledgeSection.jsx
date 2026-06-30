import { Link } from 'react-router-dom';
import {
  BarChart2, Users, Sliders, Activity, Zap, Target, Quote,
} from 'lucide-react';
import SectionLabel from './SectionLabel';
import CountUp  from './CountUp';

// Writes the pointer position into CSS vars so a radial "spotlight" overlay
// can follow the cursor inside a card on hover.
function handleCardMove(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  el.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

const FEATURE_CARDS = [
  { icon: BarChart2, title: 'Analytics',       sub: 'Real-time insights'   },
  { icon: Users,     title: 'Audience Growth', sub: 'AI-powered tools'     },
  { icon: Sliders,   title: 'Optimization',    sub: 'Better content'       },
  { icon: Activity,  title: 'Tracking',        sub: 'Performance metrics'  },
  { icon: Zap,       title: 'Automation',      sub: 'Save time'            },
  { icon: Target,    title: 'Goal Setting',    sub: 'Track milestones'     },
];

const STATS = [
  { end: 500,  format: (v) => `${Math.round(v)}K+`, label: 'Active Creators'  },
  { end: 98,   format: (v) => `${Math.round(v)}%`,  label: 'Growth Rate'      },
  { end: 10,   format: (v) => `${Math.round(v)}M+`, label: 'Content Pieces'   },
  { end: 150,  format: (v) => `${Math.round(v)}+`,  label: 'Countries'        },
];

const TESTIMONIALS = [
  {
    stars: 5,
    quote: '"This platform helped me grow from 10K to 500K subscribers in just 8 months. The analytics are game-changing!"',
    name: 'Sarah Martinez',
    role: 'YouTube Creator',
    initials: 'SM',
    gradient: 'from-[#2d6fff] to-[#6b9fff]',
  },
  {
    stars: 5,
    quote: '"AmbedkarGPT transformed how I create content on social justice. I can now generate powerful posts grounded in real research within seconds."',
    name: 'Raj Verma',
    role: 'Social Activist & Blogger',
    initials: 'RV',
    gradient: 'from-[#7b3fd4] to-[#a855f7]',
  },
  {
    stars: 4,
    quote: '"As a student researcher, having an AI that actually understands Ambedkarite thought is invaluable. My essays are more informed and impactful now."',
    name: 'Priya Sharma',
    role: 'PhD Researcher, Delhi University',
    initials: 'PS',
    gradient: 'from-[#059669] to-[#34d399]',
  },
  {
    stars: 5,
    quote: '"I use AmbedkarGPT to create lecture notes and awareness posts. The depth of knowledge it draws from is unlike anything I have seen before."',
    name: 'Dr. Anil Kumar',
    role: 'Professor of Social Sciences',
    initials: 'AK',
    gradient: 'from-[#d97706] to-[#f59e0b]',
  },
  {
    stars: 4,
    quote: '"Finally a tool built for Dalit journalism. The AI understands nuance, tone, and the urgency of the issues we cover every day."',
    name: 'Maya Patel',
    role: 'Independent Journalist',
    initials: 'MP',
    gradient: 'from-[#e11d48] to-[#fb7185]',
  },
  {
    stars: 5,
    quote: '"Our grassroots community has never been more connected. AmbedkarGPT helps us craft messages that resonate and mobilise people at scale."',
    name: 'Arjun Singh',
    role: 'Community Leader, Maharashtra',
    initials: 'AS',
    gradient: 'from-[#0891b2] to-[#22d3ee]',
  },
];

function StarRating({ count }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="15" height="15" viewBox="0 0 14 14"
          fill={i < count ? '#f5a623' : '#1e3260'}
          aria-hidden="true"
        >
          <path d="M7 1l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7 8.885 3.91 10.51l.59-3.44L2 4.632l3.455-.502z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ t, idx }) {
  return (
    <div
      onMouseMove={handleCardMove}
      className="liquid-glass group relative flex h-[320px] w-[330px] shrink-0 flex-col overflow-hidden rounded-2xl p-6 md:w-[360px]"
      aria-hidden={idx >= TESTIMONIALS.length ? true : undefined}
    >
      {/* base top glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(63,159,255,0.10),transparent_60%)]" />
      {/* cursor-following spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(240px circle at var(--mx,50%) var(--my,50%), rgba(63,159,255,0.18), transparent 65%)' }}
      />

      <Quote size={32} className="relative shrink-0 text-[#4d94ff] transition-transform duration-300 group-hover:scale-110" fill="currentColor" strokeWidth={0} />

      <p className="relative mt-4 line-clamp-5 flex-1 text-[14.5px] leading-relaxed text-[#aec3e0]">
        {t.quote}
      </p>

      <div className="relative mt-4 flex items-center gap-2">
        <StarRating count={t.stars} />
        <span className="text-[12.5px] font-medium text-[#7a98bc]">{t.stars}/5</span>
      </div>

      <div className="relative mt-4 flex items-center gap-3 border-t border-[#1e3260]/60 pt-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-[13px] font-bold text-white`}>
          {t.initials}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-white">{t.name}</p>
          <p className="text-[12px] text-[#5a7a9e]">{t.role}</p>
        </div>
      </div>
    </div>
  );
}

// Double the list so the CSS marquee (-50%) loops seamlessly.
const TESTIMONIAL_TRACK = [...TESTIMONIALS, ...TESTIMONIALS];

export default function KnowledgeSection() {
  return (
    <section id="about" className="relative py-8 md:py-10">
      {/* ambient glows — extended vertically so they bleed into adjacent sections */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-[20%] top-[30%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d7dfb]/9 blur-[140px]" />
        <div className="absolute right-[10%] bottom-[20%] h-[380px] w-[380px] rounded-full bg-[#1a5fff]/7 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1320px] px-6">
        <SectionLabel>Creator Growth</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[46px] font-bold leading-[1.05] text-white md:text-[62px]">
          Grow Your Content{' '}
          <span className="gradient-text-blue italic">Creator Journey</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[16px] leading-7 text-[#a6b9d6] md:text-[17px]">
          Transform your passion into a thriving career with powerful analytics,
          automation, and growth tools designed for modern content creators.
        </p>

        {/* ── Stats — one straight line ── */}
        <div className="mx-auto mt-14 grid max-w-[920px] grid-cols-2 gap-y-8 sm:grid-cols-4">
          {STATS.map(({ end, format, label }, i) => (
            <div
              key={label}
              className={`px-4 text-center sm:px-6 ${i > 0 ? 'sm:border-l sm:border-[#1e3260]/60' : ''}`}
            >
              <p className="font-display text-[40px] font-bold leading-none text-[#4d94ff] md:text-[48px]">
                <CountUp end={end} format={format} durationMs={1600} />
              </p>
              <p className="mt-2 text-[13.5px] text-[#7a98bc]">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Feature cards ── */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {FEATURE_CARDS.map(({ icon: Icon, title, sub }) => (
            <div
              key={title}
              onMouseMove={handleCardMove}
              className="liquid-glass group relative overflow-hidden rounded-2xl p-6"
            >
              {/* cursor-following spotlight */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: 'radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(63,159,255,0.20), transparent 65%)' }}
              />
              {/* corner accent */}
              <div className="pointer-events-none absolute -top-14 -right-14 h-32 w-32 rounded-full bg-[#3f9fff]/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#2a4375]/60 bg-[#0c1a3e]/80 text-[#5fa5ff] shadow-[0_0_18px_rgba(63,159,255,0.18)] transition-transform duration-300 group-hover:scale-110 group-hover:text-[#7ab8ff]">
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <p className="relative mt-4 text-[16px] font-semibold text-white">{title}</p>
              <p className="relative mt-1 text-[13.5px] text-[#5a7a9e]">{sub}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Review marquee — full-bleed row of testimonial cards ── */}
      <div className="marquee relative mt-14" style={{ '--marquee-duration': '60s' }}>
        <div className="marquee-track">
          {TESTIMONIAL_TRACK.map((t, i) => (
            <TestimonialCard key={`${t.name}-${i}`} t={t} idx={i} />
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-[1320px] px-6">
        {/* ── CTA ── */}
        <div className="mt-12 flex justify-center">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2d6fff] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_24px_rgba(45,111,255,0.4)] transition-all duration-300 hover:bg-[#3d7fff] hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(45,111,255,0.6)]"
          >
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

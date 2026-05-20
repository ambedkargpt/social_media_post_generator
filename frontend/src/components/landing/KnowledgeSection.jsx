import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2, Users, Sliders, Activity,
  Zap, Target, CheckCircle2, ShieldCheck, Layers,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Sparkle  from './Sparkle';
import CountUp  from './CountUp';
// slot 1 — social media writing / content creation
const creator1 = 'https://images.unsplash.com/photo-1637589308599-3478cc55510d?w=400&h=300&fit=crop&q=80';
// slot 2 — music production / studio
const creator2 = 'https://images.unsplash.com/photo-1642177398844-06d28a8f973a?w=400&h=300&fit=crop&q=80';
// slot 3 — content creator / social media
const creator3 = 'https://images.unsplash.com/photo-1621184078816-62b9eff99925?w=400&h=300&fit=crop&q=80';

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

const CHECKLIST = [
  'Increase engagement by up to 300%',
  'Save 15+ hours per week with automation',
  'Grow your audience 10x faster',
];

const PILLARS = [
  { icon: Zap,        label: 'Lightning Fast'   },
  { icon: ShieldCheck, label: 'Secure Platform' },
  { icon: Layers,     label: 'Expert Support'   },
];

const IMAGES = [creator1, creator2, creator3];

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
          width="13" height="13" viewBox="0 0 14 14"
          fill={i < count ? '#f5a623' : '#1e3260'}
          aria-hidden="true"
        >
          <path d="M7 1l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7 8.885 3.91 10.51l.59-3.44L2 4.632l3.455-.502z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCarousel() {
  const [current,   setCurrent] = useState(0);
  const [direction, setDirection] = useState('next');
  const [busy,      setBusy]    = useState(false);
  const [paused,    setPaused]  = useState(false);

  const total = TESTIMONIALS.length;

  const go = useCallback((next, dir = 'next') => {
    if (busy) return;
    setBusy(true);
    setDirection(dir);
    setCurrent(next);
    setTimeout(() => setBusy(false), 350);
  }, [busy]);

  const goNext = useCallback(() => go((current + 1) % total, 'next'), [current, go, total]);
  const goPrev = useCallback(() => go((current - 1 + total) % total, 'prev'), [current, go, total]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(goNext, 4000);
    return () => clearInterval(id);
  }, [paused, goNext]);

  const t = TESTIMONIALS[current];

  return (
    <div
      className="rounded-xl border border-[#1e3260]/70 bg-[#070f24]/80 p-4 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes slide-from-right {
          from { opacity: 0; transform: translateX(32px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
        @keyframes slide-from-left {
          from { opacity: 0; transform: translateX(-32px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)     scale(1);    }
        }
      `}</style>

      <div
        key={`${current}-${direction}`}
        style={{
          animation: `${direction === 'next' ? 'slide-from-right' : 'slide-from-left'} 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
          minHeight: '110px',
        }}
      >
        <StarRating count={t.stars} />
        <p className="mt-2.5 text-[12.5px] italic leading-relaxed text-[#a8c0de]">
          {t.quote}
        </p>
        <div className="mt-3 flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-[11px] font-bold text-white`}>
            {t.initials}
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-white">{t.name}</p>
            <p className="text-[11px] text-[#5a7a9e]">{t.role}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3.5 flex items-center justify-between">
        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i, i >= current ? 'next' : 'prev')}
              aria-label={`Go to testimonial ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-4 h-1.5 bg-[#4d94ff]'
                  : 'w-1.5 h-1.5 bg-[#1e3260] hover:bg-[#2a4a8a]'
              }`}
            />
          ))}
        </div>

        {/* Prev / Next buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1e3260]/70 text-[#5a7a9e] transition hover:border-[#3f9fff]/50 hover:text-[#3f9fff]"
            aria-label="Previous testimonial"
          >
            <ChevronLeft size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1e3260]/70 text-[#5a7a9e] transition hover:border-[#3f9fff]/50 hover:text-[#3f9fff]"
            aria-label="Next testimonial"
          >
            <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeSection() {
  return (
    <section id="about" className="relative overflow-hidden py-20 md:py-28">
      {/* ambient glows */}
      <div className="pointer-events-none absolute left-[20%] top-[30%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d7dfb]/8 blur-[140px]" />
      <div className="pointer-events-none absolute right-[10%] bottom-[20%] h-[380px] w-[380px] rounded-full bg-[#1a5fff]/6 blur-[120px]" />

      <div className="relative mx-auto grid max-w-[1180px] items-start gap-12 px-6 md:grid-cols-[1fr_1.18fr] md:gap-10">

        {/* ─── LEFT COLUMN ─── */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2a4a8a]/70 bg-[#0c1735]/80 px-4 py-1.5 text-[12px] text-[#7ab0ff]">
            <Sparkle size={12} color="#6b9fff" />
            Trusted by 500K+ creators worldwide
          </div>

          <h2 className="mt-6 font-display text-[40px] font-bold leading-[1.1] tracking-tight text-white md:text-[50px]">
            Grow Your Content
            <br />
            <span className="gradient-text-blue italic">Creator Journey</span>
          </h2>

          <p className="mt-5 text-[14.5px] leading-[1.85] text-[#9fb8dc]">
            Transform your passion into a thriving career with powerful analytics,
            automation, and growth tools designed for modern content creators.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-x-10 gap-y-6">
            {STATS.map(({ end, format, label }) => (
              <div key={label}>
                <p className="font-display text-[32px] font-bold leading-none text-[#4d94ff]">
                  <CountUp end={end} format={format} durationMs={1600} />
                </p>
                <p className="mt-1 text-[13px] text-[#7a98bc]">{label}</p>
              </div>
            ))}
          </div>

          <ul className="mt-8 space-y-3.5">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-[#aec3e0]">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#4d94ff]" />
                {item}
              </li>
            ))}
          </ul>

          <Link
            to="/signup"
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-[#2d6fff] px-7 py-3.5 text-[14.5px] font-semibold text-white shadow-[0_0_24px_rgba(45,111,255,0.4)] transition-all duration-300 hover:bg-[#3d7fff] hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(45,111,255,0.6)]"
          >
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="flex flex-col gap-3">

          {/* Feature cards 2×3 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURE_CARDS.map(({ icon: Icon, title, sub }, i) => (
              <div
                key={title}
                className="hover-lift rounded-xl border border-[#1e3260]/70 bg-[#070f24]/80 p-4 transition-all duration-300"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2a4375]/60 bg-[#0c1a3e]/80 text-[#5fa5ff]">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <p className="mt-3 text-[13.5px] font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-[11.5px] text-[#5a7a9e]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Image strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {IMAGES.map((src, i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden rounded-xl border border-[#1e3260]/60 bg-[#070f24]">
                <img src={src} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
              </div>
            ))}
          </div>

          {/* Testimonial carousel */}
          <TestimonialCarousel />

          {/* Bottom pillars */}
          <div className="grid grid-cols-3 gap-3">
            {PILLARS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-[#1e3260]/60 bg-[#070f24]/60 py-3">
                <Icon size={18} className="text-[#f5a623]" />
                <span className="text-[11.5px] text-[#7a98bc]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

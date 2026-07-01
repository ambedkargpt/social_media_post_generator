import { Link } from 'react-router-dom';
import { Edit3, Music, Mic2, Video, Newspaper, Scale, ArrowRight, Check } from 'lucide-react';
import SectionLabel from './SectionLabel';

const SERVICES = [
  {
    icon: Edit3,
    title: 'Social Media Post',
    sub: 'Generate powerful Ambedkarite posts straight from current news and events.',
    features: ['News-to-post in seconds', 'Multi-platform formats', 'Tone & style control'],
    color: '#ff4f8a',
    gradient: 'from-[#ff4f8a] to-[#d43a68]',
    live: true,
    route: '/generate/social-media',
  },
  {
    icon: Music,
    title: 'Music Generation',
    sub: 'Create AI-powered lyrics, beats, and full instrumental tracks.',
    features: ['AI lyrics & full beats', 'Instrumental track builder', 'Genre & language selection'],
    color: '#ffb056',
    gradient: 'from-[#ffb056] to-[#ff7a2d]',
    live: true,
    route: '/generate/music',
  },
  {
    icon: Mic2,
    title: 'Political Speech',
    sub: 'Compelling speeches grounded in constitutional values and real data.',
    features: ['Constitutional framing', 'Audience-aware language', 'Data-backed arguments'],
    color: '#22c55e',
    gradient: 'from-[#22c55e] to-[#16a34a]',
    live: false,
  },
  {
    icon: Video,
    title: 'Video Generation',
    sub: 'High-quality AI videos from your ideas, scripts, and talking points.',
    features: ['Text-to-video pipeline', 'Script-to-animation', 'HD quality output'],
    color: '#a855f7',
    gradient: 'from-[#a855f7] to-[#7b3fd4]',
    live: false,
  },
  {
    icon: Newspaper,
    title: 'Editorial',
    sub: 'Opinion pieces and long-form articles rooted in Ambedkarite thought.',
    features: ['Research-backed writing', 'Ambedkarite perspective', 'In-depth analysis'],
    color: '#f59e0b',
    gradient: 'from-[#f59e0b] to-[#d97706]',
    live: false,
  },
  {
    icon: Scale,
    title: 'Debate Analysis',
    sub: 'Analyse political debates and arguments through an Ambedkarite lens.',
    features: ['Real-time argument scoring', 'Counter-point generation', 'Fact-check integration'],
    color: '#3f9fff',
    gradient: 'from-[#3f9fff] to-[#5bc0ff]',
    live: false,
  },
];

function handleCardMove(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  el.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

export default function KnowledgeSection() {
  return (
    <section id="about" className="relative py-8 md:py-10">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-[20%] top-[30%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d7dfb]/9 blur-[140px]" />
        <div className="absolute right-[10%] bottom-[20%] h-[380px] w-[380px] rounded-full bg-[#1a5fff]/7 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        <SectionLabel>Our Services</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[46px] font-bold leading-[1.05] text-white md:text-[62px]">
          Grow Your Content{' '}
          <span className="gradient-text-blue italic">Creator Journey</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[19px] leading-8 text-[#bfcfe8] md:text-[21px]">
          Powerful AI tools built for Bahujan creators, researchers, and
          changemakers — from social media to music, speeches to video.
        </p>

        {/* ── Service cards ── */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, sub, features, color, gradient, live, route }) => (
            <div
              key={title}
              onMouseMove={handleCardMove}
              className="liquid-glass group relative flex flex-col overflow-hidden rounded-2xl p-7"
            >
              {/* cursor spotlight */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `radial-gradient(220px circle at var(--mx,50%) var(--my,50%), ${color}22, transparent 65%)` }}
              />
              <div
                className="pointer-events-none absolute -top-14 -right-14 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `${color}20` }}
              />

              {/* ── Top row: icon + badge ── */}
              <div className="relative flex items-start justify-between">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-[0_4px_18px_rgba(0,0,0,0.35)]`}
                >
                  <Icon size={24} strokeWidth={1.8} className="text-white" />
                </span>
                {live ? (
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 font-count text-[11px] font-semibold uppercase tracking-widest text-green-400">
                    Live
                  </span>
                ) : (
                  <span className="rounded-full border border-[#2a4375]/50 bg-[#0c1735]/60 px-2.5 py-1 font-count text-[11px] font-semibold uppercase tracking-widest text-[#5a7aaa]">
                    Soon
                  </span>
                )}
              </div>

              {/* ── Title & description ── */}
              <p className="relative mt-5 text-[26px] font-semibold text-white">{title}</p>
              <p className="relative mt-2 text-[19px] leading-relaxed text-[#8aabcc]">{sub}</p>

              {/* ── Divider ── */}
              <div className="relative my-5 h-px w-full rounded-full bg-[#1e3260]/70" />

              {/* ── Feature bullets ── */}
              <ul className="relative flex-1 space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${color}22` }}
                    >
                      <Check size={11} strokeWidth={2.5} style={{ color }} />
                    </span>
                    <span className="text-[18px] text-[#a8c0dc]">{f}</span>
                  </li>
                ))}
              </ul>

              {/* ── Bottom CTA ── */}
              <div className="relative mt-6 border-t border-[#1e3260]/50 pt-5">
                {live && route ? (
                  <Link
                    to={route}
                    className="inline-flex items-center gap-1.5 text-[18px] font-semibold transition-all duration-200 hover:gap-2.5"
                    style={{ color }}
                  >
                    Try it now
                    <ArrowRight size={14} strokeWidth={2.2} />
                  </Link>
                ) : (
                  <p className="text-[17px] text-[#3d5a80]">Coming soon — stay tuned</p>
                )}
              </div>
            </div>
          ))}
        </div>

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

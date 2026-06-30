import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import SectionLabel from './SectionLabel';
import savitribai from '../../assets/images/makers/savitribai.png';
import gurram     from '../../assets/images/makers/gurram.png';
import jagjivan   from '../../assets/images/makers/jagjivan.png';
import udham      from '../../assets/images/makers/udham.png';
import dakshayani from '../../assets/images/makers/dakshayani.png';
import kanshi     from '../../assets/images/makers/kanshi.png';
import janabai    from '../../assets/images/makers/janabai.png';

const MAKERS = [
  {
    name: 'Savitribai Phule',
    image: savitribai,
    blurb: "India’s first woman teacher and a pioneer of education for every learner, regardless of birth.",
  },
  {
    name: 'Gurram Jashuva',
    image: gurram,
    blurb: 'Poet of the oppressed who turned ignored verse into a clarion call for equality.',
  },
  {
    name: 'Jagjivan Ram',
    image: jagjivan,
    blurb: 'Champion of social justice and a voice for the marginalized across generations.',
  },
  {
    name: 'Udham Singh',
    image: udham,
    blurb: 'A revolutionary who gave voice to the silenced and inspired movements for dignity.',
  },
  {
    name: 'Dakshayani Velayudhan',
    image: dakshayani,
    blurb: 'First and only Dalit woman elected to the Constituent Assembly and a quiet architect of equality.',
  },
  {
    name: 'Kanshi Ram',
    image: kanshi,
    blurb: 'Organiser of the modern Bahujan movement and an unwavering advocate for social justice.',
  },
  {
    name: 'Sant Janabai',
    image: janabai,
    blurb: 'Medieval Marathi saint-poet whose verses centred the lives of labouring Dalit women.',
  },
];

// Double the list so the CSS marquee (-50%) loops seamlessly.
const TRACK = [...MAKERS, ...MAKERS];

function MakerCard({ maker, idx }) {
  return (
    <div
      className="group relative h-[400px] w-[300px] shrink-0 overflow-hidden rounded-2xl border border-[#2a4375]/60 bg-[#0a1430] shadow-[0_20px_50px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:border-[#4a78c8]/80 md:w-[340px]"
      aria-hidden={idx >= MAKERS.length ? true : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#11204a] via-[#0b1633] to-[#070c1f]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_25%,rgba(63,159,255,0.18),transparent_65%)]" />

      <img
        src={maker.image}
        alt={maker.name}
        loading="lazy"
        className="relative h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.04]"
        style={{ filter: 'saturate(1.05) contrast(1.02)' }}
      />

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#030611] via-[#030611]/70 to-transparent p-5">
        <h3 className="text-[22px] font-semibold leading-tight text-white md:text-[25px]">
          {maker.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-[#c2d2ee] md:text-[16px]">
          {maker.blurb}
        </p>
      </div>
    </div>
  );
}

function MobileCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((i) => (i + 1) % MAKERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function goPrev() {
    setActiveIdx((i) => (i - 1 + MAKERS.length) % MAKERS.length);
  }

  function goNext() {
    setActiveIdx((i) => (i + 1) % MAKERS.length);
  }

  const maker = MAKERS[activeIdx];

  return (
    <div className="mt-10 px-6">
      {/* Single card — key change causes React to remount, re-triggering the jump animation */}
      <div className="relative mx-auto h-[420px] max-w-[360px] overflow-hidden rounded-2xl border border-[#2a4375]/60 bg-[#0a1430] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div
          key={activeIdx}
          className="absolute inset-0"
          style={{ animation: 'makerJumpIn 0.22s ease-out both' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#11204a] via-[#0b1633] to-[#070c1f]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_25%,rgba(63,159,255,0.18),transparent_65%)]" />
          <img
            src={maker.image}
            alt={maker.name}
            loading="lazy"
            className="relative h-full w-full object-cover object-top"
            style={{ filter: 'saturate(1.05) contrast(1.02)' }}
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#030611] via-[#030611]/70 to-transparent p-5">
            <h3 className="text-[20px] font-semibold leading-tight text-white">{maker.name}</h3>
            <p className="mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-[#c2d2ee]">{maker.blurb}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2a4375]/60 bg-[#0a1430] text-[#7a90b8] transition hover:border-[#4a78c8]/80 hover:text-white"
          aria-label="Previous"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {MAKERS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={[
                'rounded-full transition-all duration-200',
                i === activeIdx
                  ? 'h-2 w-6 bg-[#3f9fff]'
                  : 'h-2 w-2 bg-[#2a4375]/60 hover:bg-[#3f9fff]/50',
              ].join(' ')}
              aria-label={`Go to ${MAKERS[i].name}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2a4375]/60 bg-[#0a1430] text-[#7a90b8] transition hover:border-[#4a78c8]/80 hover:text-white"
          aria-label="Next"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function DalitHistoryMakers() {
  return (
    <section className="relative py-10 md:py-14">
      {/* Ambient glow — bleeds into Hero above and KnowledgeSection below */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-[#1e4fb5]/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-[1320px] px-6">
        <SectionLabel>Dalit History Makers</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[900px] text-center font-display text-[52px] font-bold leading-[1.05] text-white md:text-[72px]">
          Voices That Shaped{' '}
          <span className="italic gradient-text-blue">Justice</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[16px] leading-7 text-[#a6b9d6] md:text-[17px]">
          Meet the reformers, poets, and thinkers whose ideas built the foundations of
          equality. Their stories live on in every line of the corpus.
        </p>
      </div>

      {/* Mobile: one-by-one carousel */}
      <div className="md:hidden">
        <MobileCarousel />
      </div>

      {/* Desktop: infinite marquee */}
      <div className="hidden md:block">
        <div className="marquee mt-14" style={{ '--marquee-duration': '55s' }}>
          <div className="marquee-track">
            {TRACK.map((maker, i) => (
              <MakerCard key={`${maker.name}-${i}`} maker={maker} idx={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Build your narrative CTA */}
      <div className="mt-10 flex justify-center md:mt-14">
        <button
          type="button"
          className="btn-gradient group inline-flex h-12 items-center gap-2.5 rounded-xl px-7 font-count text-[15px] font-semibold text-white"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20">
            <Play size={11} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
          </span>
          Build your narrative
        </button>
      </div>
    </section>
  );
}

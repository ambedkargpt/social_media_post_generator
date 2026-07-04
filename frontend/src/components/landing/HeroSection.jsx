import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sparkle from "./Sparkle";
import { useAuth } from "../../context/AuthContext";
import squiggleSrc from "../../assets/images/squiggle-lines.png";
import ambedkarPortrait from "../../assets/images/purpose-ambedkar.png";

// Headline words — null = <br /> slot
const RAW_WORDS = [
  { text: "Artificial",   cyan: false },
  { text: "Intelligence", cyan: false },
  { text: "(AI)",         cyan: true  },
  null,
  { text: "Meets",        cyan: true  },
  null,
  { text: "Ambedkar's",  cyan: false },
  { text: "Intelligence", cyan: false },
  { text: "(AI)",         cyan: true  },
];

let _wi = 0;
const WORDS = RAW_WORDS.map((w) =>
  w ? { ...w, delay: 150 + _wi++ * 130 } : null
);

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export default function HeroSection({ splashDone = true }) {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const sectionRef = useRef(null);
  const hasPlayedOnce = useRef(false);

  // Initial play — fires once when splash clears
  useEffect(() => {
    if (!splashDone) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setReady(true);
        hasPlayedOnce.current = true;
      })
    );
    return () => cancelAnimationFrame(id);
  }, [splashDone]);

  // Replay on scroll-back-up
  useEffect(() => {
    if (!splashDone) return;
    const el = sectionRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setReady(false);
        } else if (hasPlayedOnce.current) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => setReady(true))
          );
        }
      },
      { threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [splashDone]);

  function handleBheemBot() {
    if (currentUser) {
      navigate("/bheembot");
    } else {
      sessionStorage.setItem("auth_redirect", "/bheembot");
      navigate("/login");
    }
  }

  function fadeUp(delayMs) {
    return {
      transition: `opacity 0.9s ${EASE}, transform 0.9s ${EASE}`,
      transitionDelay: ready ? `${delayMs}ms` : "0ms",
      opacity: ready ? 1 : 0,
      transform: ready ? "translateY(0)" : "translateY(24px)",
    };
  }

  return (
    <section id="home" ref={sectionRef} className="relative pt-0 md:pt-2">

      {/* Glows + squiggle */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -bottom-32">
        <div className="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_50%_0%,rgba(41,108,255,0.16),transparent_55%)]" />
        <div className="absolute -left-24 -top-16 h-[460px] w-[460px] rounded-full bg-[#2d7dfb]/22 blur-[130px]" />
        <div className="absolute -right-24 top-0 h-[460px] w-[460px] rounded-full bg-[#1d66de]/22 blur-[120px]" />
        <div className="absolute left-1/2 top-[58%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#1e4fb5]/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-[260px] w-[800px] -translate-x-1/2 rounded-full bg-[#1a3fa0]/15 blur-[120px]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${squiggleSrc})` }}
        />
      </div>

      {/* Scanner beam */}
      <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: "96px" }}>
        <div className="hero-scan-beam relative h-px w-full">
          <div
            className="absolute inset-x-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(63,159,255,0.12) 8%, rgba(63,210,255,0.85) 30%, rgba(180,230,255,1) 50%, rgba(63,210,255,0.85) 70%, rgba(63,159,255,0.12) 92%, transparent 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 -top-3 h-7"
            style={{
              background:
                "linear-gradient(90deg, transparent 5%, rgba(63,159,255,0.04) 20%, rgba(100,200,255,0.18) 40%, rgba(160,225,255,0.22) 50%, rgba(100,200,255,0.18) 60%, rgba(63,159,255,0.04) 80%, transparent 95%)",
              filter: "blur(4px)",
            }}
          />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 mx-auto grid max-w-[1440px] items-stretch gap-8 px-6 pb-6 pt-4 md:grid-cols-[1fr_auto] md:pb-10 md:pt-8">

        {/* LEFT: text */}
        <div className="flex flex-col items-start pb-3">

          {/* Badge */}
          <div
            className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#3a5e94] bg-[#0f1d3b]/75 px-7 py-3 text-[18px] text-[#d3e4ff] shadow-[0_0_24px_rgba(43,126,255,0.22)]"
            style={fadeUp(0)}
          >
            <Sparkle size={16} color="#4fb4ff" />
            Amplify Bahujan Thought
          </div>

          {/* Headline — slow word-by-word */}
          <h1 className="mt-1 font-display max-w-[900px] text-[46px] font-bold leading-[1.18] tracking-tight text-white md:text-[60px]">
            {WORDS.map((item, i) => {
              if (!item) return <br key={i} />;
              return (
                <span
                  key={i}
                  className={item.cyan ? "gradient-text-cyan italic" : undefined}
                  style={{
                    display: "inline-block",
                    marginRight: "0.26em",
                    transition: `opacity 0.7s ${EASE}, transform 0.7s ${EASE}`,
                    transitionDelay: ready ? `${item.delay}ms` : "0ms",
                    opacity: ready ? 1 : 0,
                    transform: ready ? "translateY(0)" : "translateY(18px)",
                  }}
                >
                  {item.text}
                </span>
              );
            })}
          </h1>

          {/* Sub-copy */}
          <p
            className="font-count mt-6 max-w-[700px] text-[22px] leading-8 text-[#b7c6e1] md:text-[24px] md:leading-9"
            style={fadeUp(1050)}
          >
            When you create with AmbedkarGPT, you don&apos;t just post. You
            pierce the algorithm, shake the timeline, and wake millions.
          </p>

          {/* CTA */}
          <div className="mt-auto flex flex-wrap items-center gap-4" style={fadeUp(1300)}>
            <button
              type="button"
              onClick={handleBheemBot}
              className="btn-gradient inline-flex h-15 items-center gap-2 rounded-xl px-9 font-count text-[22px] font-semibold text-white"
            >
              BheemBot
              <ArrowRight size={21} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* RIGHT: image */}
        <div
          className="relative hidden md:flex md:w-[460px] md:flex-col md:items-end"
          style={{
            transition: `opacity 1.1s ${EASE}, transform 1.1s ${EASE}`,
            transitionDelay: ready ? "600ms" : "0ms",
            opacity: ready ? 1 : 0,
            transform: ready ? "translateX(0)" : "translateX(36px)",
          }}
        >
          <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: "480px" }}>
            <img
              src={ambedkarPortrait}
              alt="Dr. BR Ambedkar"
              className="h-full w-full object-cover"
              style={{ objectPosition: "center 35%" }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#030611]/60" />
          </div>

          <div className="mt-4 w-full py-3 text-center">
            <span
              className="font-display text-[17px] font-bold text-white md:text-[19px]"
              style={{
                textShadow: "0 0 24px rgba(63,159,255,0.8), 0 0 48px rgba(63,159,255,0.4)",
                letterSpacing: "0.2em",
              }}
            >
              UNBIASED . EQUAL . TRUTHFUL
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}

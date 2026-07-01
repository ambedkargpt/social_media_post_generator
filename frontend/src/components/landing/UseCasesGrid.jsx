import { Cpu, Search, Zap, Target } from "lucide-react";
import SectionLabel from "./SectionLabel";
import StaggerReveal from "../ui/StaggerReveal";

const USE_CASES = [
  {
    icon: Cpu,
    title: "The Ambedkar Principle Engine",
    body: "Use Ambedkar's speeches on current events to build confidence and win elections. Draw on decades of constitutional philosophy to craft arguments that resonate with voters and stand up to scrutiny.",
  },
  {
    icon: Search,
    title: "Understanding Public Problems",
    body: "AI scans local news and ground realities to reveal voter issues so you always speak to real concerns. Stop guessing what matters — know exactly what your constituency needs.",
  },
  {
    icon: Zap,
    title: "Real-Time Debate Assistant",
    body: "During live debates, the AI feeds you quick facts, counter-arguments, and data points via a discreet device, ensuring you always have a logical edge. Never be caught off-guard again.",
  },
  {
    icon: Target,
    title: "Opponent Weakness Finder",
    body: "AI scans opponents' past speeches, promises, and voting records to highlight inconsistencies and unfulfilled promises — all fact-based. Turn research into winning strategy.",
  },
];

function UseCaseCard({ icon: Icon, title, body }) {
  return (
    <div className="group relative">
      <div
        className="pointer-events-none absolute -inset-6 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(63,159,255,0.28) 0%, rgba(63,159,255,0.10) 45%, transparent 70%)",
          filter: "blur(18px)",
        }}
      />

      <div className="glass-card hover-lift relative flex h-full flex-col overflow-hidden p-8 transition-all duration-500 hover:border-[#3f9fff]/30 md:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, rgba(63,159,255,0.22) 0%, rgba(63,159,255,0.10) 40%, transparent 72%)",
          }}
        />
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#3f9fff]/15 blur-3xl" />

        <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#2a4375]/80 bg-[#0c1735]/80 text-[#5fa5ff] shadow-[0_0_22px_rgba(63,159,255,0.25)]">
          <Icon size={24} strokeWidth={1.7} />
        </span>

        <h3 className="mt-7 text-[24px] font-semibold text-white md:text-[26px]">
          {title}
        </h3>
        <div className="mt-3 h-px w-12 rounded-full bg-[#2a4375]/60" />
        <p className="mt-4 flex-1 text-[17px] leading-7 text-[#bfcfe8] md:text-[18px]">
          {body}
        </p>
      </div>
    </div>
  );
}

export default function UseCasesGrid() {
  return (
    <section id="bheem" className="relative py-8 md:py-10">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-1/2 top-0 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-[#3f78ff]/8 blur-[150px]" />
        <div className="absolute left-1/2 bottom-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[#2d55c0]/7 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        <SectionLabel>Use Cases</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[900px] text-center font-display text-[38px] font-bold leading-[1.2] text-white md:text-[52px]">
          AI-Powered Knowledge To Lead With{" "}
          <span className="italic gradient-text-blue">Truth</span>
          {" "}and Win Elections With{" "}
          <span className="italic gradient-text-blue">Guarantee</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[19px] leading-8 text-[#bfcfe8] md:text-[21px]">
          Every tool built for one purpose — to put the power of Ambedkarite knowledge into the hands of those who need it most.
        </p>

        <StaggerReveal step={100} className="mt-14 grid gap-6 md:grid-cols-2">
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.title} {...uc} />
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

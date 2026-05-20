import SectionLabel from './SectionLabel';
import Sparkle from './Sparkle';
import indiaAiLogo     from '../../assets/images/indiaai-logo.png';
import digitalIndiaLogo from '../../assets/images/digital-india-logo.png';

// "Trusted By" partners strip — centered pill label + logos with sparkle separators.
export default function TrustedByStrip() {
  return (
    <section className="relative overflow-hidden py-16 md:py-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d7dfb]/12 blur-[120px]" />

      <div className="relative mx-auto max-w-[1180px] px-6">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#6b8cbf]">
          Trusted By
        </h3>

        <div className="mt-8 flex flex-nowrap items-center gap-x-12 md:gap-x-20">
          <img
            src={indiaAiLogo}
            alt="INDIAai"
            className="h-14 w-auto object-contain drop-shadow-[0_0_24px_rgba(63,159,255,0.25)] md:h-20"
          />

          <img
            src={digitalIndiaLogo}
            alt="Digital India"
            className="h-14 w-auto object-contain drop-shadow-[0_0_24px_rgba(63,159,255,0.25)] md:h-20"
          />
        </div>
      </div>
    </section>
  );
}

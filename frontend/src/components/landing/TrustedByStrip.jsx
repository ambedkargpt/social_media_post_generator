import Sparkle from './Sparkle';
import indiaAiLogo     from '../../assets/images/indiaai-logo.png';
import digitalIndiaLogo from '../../assets/images/digital-india-logo.png';

// "Trusted By" partners strip — logos with evenly spaced sparkle separators.
export default function TrustedByStrip() {
  return (
    <section className="relative py-6 pb-12 md:py-8 md:pb-16">
      <div className="pointer-events-none absolute inset-x-0 -top-16 -bottom-16">
        <div className="absolute left-1/2 top-1/2 h-56 w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d7dfb]/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6">
        <div className="flex flex-col items-center gap-10 md:flex-row md:justify-evenly">
          <Sparkle size={32} color="#ffffff" className="hidden md:inline-flex" />

          <img
            src={indiaAiLogo}
            alt="INDIAai"
            className="h-20 w-auto object-contain drop-shadow-[0_0_24px_rgba(63,159,255,0.25)] md:h-24"
          />

          <Sparkle size={32} color="#ffffff" />

          <img
            src={digitalIndiaLogo}
            alt="Digital India"
            className="h-20 w-auto object-contain drop-shadow-[0_0_24px_rgba(63,159,255,0.25)] md:h-24"
          />

          <Sparkle size={32} color="#ffffff" className="hidden md:inline-flex" />
        </div>
      </div>
    </section>
  );
}

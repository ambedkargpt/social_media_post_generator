import SectionLabel from './SectionLabel';

const IDEAS = [
  {
    emoji: '🌐',
    title: 'BE LOCAL,\nTHINK GLOBAL',
    body: 'Local ideas with the potential to create global impact',
  },
  {
    emoji: '🌱',
    title: 'GRASSROOTS\nFIRST',
    body: 'Discovering talent wherever it exists',
  },
  {
    emoji: '⚙️',
    title: 'BUILD FOR\nBHARAT',
    body: "Solutions for India's unique challenges",
  },
  {
    emoji: '🇮🇳',
    title: 'AATMANIRBHAR\nBHARAT',
    body: 'Powering a self-reliant India',
  },
];

export default function FourIdeasSection() {
  return (
    <section className="relative py-6 md:py-8">
      <div className="pointer-events-none absolute inset-x-0 -top-20 -bottom-20">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d3fa0]/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        <div className="flex flex-col items-center text-center">
          <SectionLabel>What We Stand For</SectionLabel>

          <h2 className="mt-6 font-display text-[46px] font-extrabold leading-[1.05] text-white md:text-[64px]">
            FOUR IDEAS.{' '}
            <span className="gradient-text-blue">ONE BHARAT.</span>
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4">
          {IDEAS.map(({ emoji, title, body }) => (
            <div
              key={title}
              className="liquid-glass hover-lift flex flex-col rounded-2xl p-7 md:p-8"
            >
              <span className="text-[52px] leading-none">{emoji}</span>

              <p className="mt-6 whitespace-pre-line font-display text-[20px] font-bold leading-tight text-white md:text-[22px]">
                {title}
              </p>

              <p className="mt-3 text-[16px] leading-relaxed text-[#9ab8d8] md:text-[17px]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

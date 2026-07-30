import SectionLabel from './SectionLabel';

const IDEAS = [
  {
    emoji: '🤝',
    title: 'POLITICS MUST\nNOT DIVIDE',
    body: 'Unity before political differences',
  },
  {
    emoji: '📜',
    title: 'CONSTITUTION\nSECURES ONE NATION',
    body: 'The Constitution holds the nation together',
  },
  {
    emoji: '🇮🇳',
    title: 'PLACE COUNTRY\nABOVE CREED',
    body: 'Nation first, always',
  },
];

export default function FourIdeasSection() {
  return (
    <section className="relative pt-6 pb-20 md:pt-8 md:pb-28">
      <div className="pointer-events-none absolute inset-x-0 -top-20 -bottom-20">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d3fa0]/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        <div className="flex flex-col items-center text-center">
          <SectionLabel>What We Stand For</SectionLabel>

          <h2 className="mt-6 font-display text-[38px] font-extrabold leading-[1.05] text-white md:text-[58px]">
            POLITICS DIVIDES.{' '}
            <span className="gradient-text-blue">CONSTITUTION UNITES.</span>
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {IDEAS.map(({ emoji, title, body }) => (
            <div
              key={title}
              className="liquid-glass hover-lift flex flex-col rounded-2xl p-7 md:p-8"
            >
              <span className="text-[52px] leading-none">{emoji}</span>

              <p className="mt-6 whitespace-pre-line font-display text-[20px] font-bold leading-tight text-white md:text-[22px]">
                {title}
              </p>

              <p className="mt-3 text-[19px] leading-relaxed text-[#9ab8d8] md:text-[21px]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

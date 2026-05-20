import SectionLabel from './SectionLabel';
import libraryImg   from '../../assets/images/corpus-library.png';

const QA = [
  {
    num: '01',
    question: 'What is a corpus?',
    answer:
      'A Dalit corpus is a digital collection of writings, speeches, and historical records documenting Dalit experiences and thought. It helps users explore social change, identity, and anti-caste movements, functioning like a search engine to discover and connect insights across texts and time.',
  },
  {
    num: '02',
    question: 'How does a corpus work?',
    answer:
      'We collect material from a wide range of Dalit writers, activists, scholars, and community voices. This allows us to trace recurring themes, narratives, and expressions across different contexts and time periods. These patterns shape the insights we present — grounded in documented evidence from diverse sources, rather than the perspective of any single individual.',
  },
];

export default function DalitCorpusSection() {
  return (
    <section id="ambedkarverse" className="relative py-20 md:py-28">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[20%] h-[420px] w-[420px] rounded-full bg-[#2d7dfb]/8 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6">
        {/* Section label centered */}
        <div className="flex justify-center">
          <SectionLabel size="lg">Dalit Corpus</SectionLabel>
        </div>

        {/* Outer container card */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-[#1a2d55]/60 bg-[#070e22]">
          <div className="grid md:grid-cols-[1fr_1fr_1fr]">

            {/* ── Col 1: Q&A 01 ── */}
            <div className="border-b border-[#1a2d55]/50 p-8 md:border-b-0 md:border-r md:p-10">
              <span className="font-display text-[38px] font-light leading-none text-[#1e3570] md:text-[44px]">
                {QA[0].num}
              </span>
              <h3 className="mt-4 font-display text-[17px] font-semibold text-white md:text-[19px]">
                {QA[0].question}
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.9] text-[#7a9ac0]">
                {QA[0].answer}
              </p>
            </div>

            {/* ── Col 2: Q&A 02 ── */}
            <div className="border-b border-[#1a2d55]/50 p-8 md:border-b-0 md:border-r md:p-10">
              <span className="font-display text-[38px] font-light leading-none text-[#1e3570] md:text-[44px]">
                {QA[1].num}
              </span>
              <h3 className="mt-4 font-display text-[17px] font-semibold text-white md:text-[19px]">
                {QA[1].question}
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.9] text-[#7a9ac0]">
                {QA[1].answer}
              </p>
            </div>

            {/* ── Col 3: Library image ── */}
            <div className="min-h-[240px] md:min-h-[420px]">
              <img
                src={libraryImg}
                alt="A vast circular library representing the Dalit Corpus"
                className="h-full w-full object-cover object-center"
              />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

import { CheckCircle2 } from 'lucide-react';
import SectionLabel from './SectionLabel';
import libraryImg   from '../../assets/images/corpus-library.png';

const QA = [
  {
    num: '01',
    question: 'What is a corpus?',
    answer:
      'A Dalit corpus is a digital collection of writings, speeches, and historical records documenting Dalit experiences and thought. It helps users explore social change, identity, and anti-caste movements, functioning like a search engine to discover and connect insights across texts and time.',
    points: [
      'Spans speeches, letters, essays, and oral histories',
      'Organised by theme, era, and author for fast discovery',
      'Continuously growing as new material is digitised',
    ],
  },
  {
    num: '02',
    question: 'How does a corpus work?',
    answer:
      'We collect material from a wide range of Dalit writers, activists, scholars, and community voices. This allows us to trace recurring themes, narratives, and expressions across different contexts and time periods. These patterns shape the insights we present — grounded in documented evidence from diverse sources, rather than the perspective of any single individual.',
    points: [
      'Source material verified for authenticity and context',
      'Recurring themes traced across decades of writing',
      'Every insight links back to its original source text',
    ],
  },
];

export default function DalitCorpusSection() {
  return (
    <section id="ambedkarverse" className="relative pb-12 pt-0 md:pb-16">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-[10%] top-[20%] h-[420px] w-[420px] rounded-full bg-[#2d7dfb]/9 blur-[130px]" />
        <div className="absolute right-[5%] bottom-[10%] h-[360px] w-[360px] rounded-full bg-[#1a3fa0]/7 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6">
        <div className="flex justify-center">
          <SectionLabel size="lg">Dalit Corpus</SectionLabel>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#1a2d55]/60 bg-[#070e22]">
          <div className="grid md:grid-cols-[1fr_1fr_0.5fr]">

            {/* ── Col 1: Q&A 01 ── */}
            <div className="border-b border-[#1a2d55]/50 p-8 md:border-b-0 md:border-r md:p-10">
              <span className="font-display text-[38px] font-light leading-none text-[#1e3570] md:text-[44px]">
                {QA[0].num}
              </span>
              <h3 className="mt-4 font-display text-[20px] font-semibold text-white md:text-[23px]">
                {QA[0].question}
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.9] text-[#7a9ac0]">
                {QA[0].answer}
              </p>
              <ul className="mt-5 space-y-2.5">
                {QA[0].points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[13px] leading-snug text-[#aec3e0]">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#4d94ff]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Col 2: Q&A 02 ── */}
            <div className="border-b border-[#1a2d55]/50 p-8 md:border-b-0 md:border-r md:p-10">
              <span className="font-display text-[38px] font-light leading-none text-[#1e3570] md:text-[44px]">
                {QA[1].num}
              </span>
              <h3 className="mt-4 font-display text-[20px] font-semibold text-white md:text-[23px]">
                {QA[1].question}
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.9] text-[#7a9ac0]">
                {QA[1].answer}
              </p>
              <ul className="mt-5 space-y-2.5">
                {QA[1].points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[13px] leading-snug text-[#aec3e0]">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#4d94ff]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Col 3: Library image (half width) ── */}
            <div className="hidden md:block">
              <img
                src={libraryImg}
                alt="A vast circular library representing the Dalit Corpus"
                className="h-full w-full object-cover object-top"
              />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

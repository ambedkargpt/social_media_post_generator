import { CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SectionLabel from './SectionLabel';
import libraryImg   from '../../assets/images/corpus-library.png';

const CORPUS = {
  question: 'What is Dalit Corpus?',
  intro: [
    'For too long, our history was written by those who oppressed us. They erased our heroes, twisted our words, and buried our truth.',
    'Dalit Corpus is our answer.',
    'It is a growing library of Ambedkarite and Bahujan voices, including speeches, books, songs, slogans, and political writings. Everything is collected and verified by our own community.',
    'Whether you are a student, a creator, or a researcher, Dalit Corpus gives you the real history the mainstream hid from you.',
  ],
  whyItMatters: [
    'It saves our stories before they vanish.',
    'It gives Bahujan creators true, unfiltered knowledge.',
    'It powers AmbedkarGPT with our own words.',
    'It teaches our next generation our history, not theirs.',
  ],
  whyWeNeedIt:
    'The internet is ruled by data, and that data has a caste. Dalit Corpus is our own digital land, built by us, owned by us, and growing with us.',
};

export default function DalitCorpusSection() {
  const navigate = useNavigate();

  function handleContribute() {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleBuyDataset() {
    navigate('/signup');
  }

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

        <h2 className="mx-auto mt-8 max-w-[900px] text-center font-display text-[52px] font-bold leading-[1.05] text-white md:text-[72px]">
          Knowledge That Powers{' '}
          <span className="italic gradient-text-blue">The Movement</span>
        </h2>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-[16px] leading-7 text-[#a6b9d6] md:text-[17px]">
          A caste-bias-free knowledge base of Dalit history, texts, speeches, and political
          thought for creators, researchers, and revolutionaries.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#1a2d55]/60 bg-[#070e22]">
          <div className="grid md:grid-cols-[1.4fr_0.6fr]">

            {/* ── Col 1: Dalit Corpus ── */}
            <div className="border-b border-[#1a2d55]/50 p-8 md:border-b-0 md:border-r md:p-10">
              <h3 className="font-display text-[24px] font-semibold text-white md:text-[28px]">
                {CORPUS.question}
              </h3>
              {CORPUS.intro.map((para) => (
                <p key={para} className="mt-4 text-[15px] leading-[1.9] text-[#a6b9d6]">
                  {para}
                </p>
              ))}

              <h4 className="mt-7 font-display text-[17px] font-semibold text-white">
                Why it matters:
              </h4>
              <ul className="mt-3 space-y-3">
                {CORPUS.whyItMatters.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-[#aec3e0]">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#4d94ff]" />
                    {point}
                  </li>
                ))}
              </ul>

              <h4 className="mt-7 font-display text-[17px] font-semibold text-white">
                Why we need it:
              </h4>
              <p className="mt-3 text-[15px] leading-[1.9] text-[#a6b9d6]">
                {CORPUS.whyWeNeedIt}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleContribute}
                  className="btn-gradient inline-flex h-12 items-center gap-2 rounded-xl px-7 font-count text-[14px] font-semibold text-white"
                >
                  Contribute to Corpus
                </button>
                <button
                  type="button"
                  onClick={handleBuyDataset}
                  className="btn-outline-blue inline-flex h-12 items-center gap-2 rounded-xl px-7 font-count text-[14px] font-medium text-white"
                >
                  Buy Dataset
                </button>
              </div>
            </div>

            {/* ── Col 2: Library image ── */}
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

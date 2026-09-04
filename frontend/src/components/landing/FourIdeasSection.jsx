import SectionLabel from './SectionLabel';
import { useI18n } from '../../i18n/index.jsx';

// Keyed rather than literal: the card copy is translated at render, so the
// array carries identity and the dictionary carries the words.
const IDEAS = [
  { emoji: '🤝', id: 'unite' },
  { emoji: '📜', id: 'const' },
  { emoji: '🇮🇳', id: 'country' },
];

export default function FourIdeasSection() {
  const { t } = useI18n();
  return (
    <section className="relative pt-6 pb-20 md:pt-8 md:pb-28">
      <div className="pointer-events-none absolute inset-x-0 -top-20 -bottom-20">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d3fa0]/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        <div className="flex flex-col items-center text-center">
          <SectionLabel>{t('ideas.label')}</SectionLabel>

          <h2 className="mt-6 font-display text-[38px] font-extrabold leading-[1.05] text-white md:text-[58px]">
            {t('ideas.headA')}{' '}
            <span className="gradient-text-blue">{t('ideas.headB')}</span>
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {IDEAS.map(({ emoji, id }) => (
            <div
              key={id}
              className="liquid-glass hover-lift flex flex-col rounded-2xl p-7 md:p-8"
            >
              <span className="text-[52px] leading-none">{emoji}</span>

              <p className="mt-6 whitespace-pre-line font-display text-[20px] font-bold leading-tight text-white md:text-[22px]">
                {t(`ideas.${id}.title`)}
              </p>

              <p className="mt-3 text-[19px] leading-relaxed text-[#9ab8d8] md:text-[21px]">
                {t(`ideas.${id}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

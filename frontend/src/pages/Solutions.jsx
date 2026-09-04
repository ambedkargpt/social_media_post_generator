import MainLayout from '../layouts/MainLayout';
import SectionHeading from '../components/ui/SectionHeading';
import GlassCard from '../components/ui/GlassCard';
import { solutionCards } from '../utils/siteContent';
import { useI18n } from '../i18n/index.jsx';

export default function Solutions() {
  const { t } = useI18n();
  return (
    <MainLayout>
      <section className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-[91px]">
        <SectionHeading
          eyebrow={t('sol.eyebrow')}
          title={t('sol.title')}
          description={t('sol.desc')}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {solutionCards.map((card) => (
            <GlassCard key={card.titleKey} className="h-full min-h-[220px]">
              <h2 className="text-xl font-medium text-white">{t(card.titleKey)}</h2>
              <p className="mt-3 leading-7 text-[#c7d5ee]">{t(card.descKey)}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </MainLayout>
  );
}

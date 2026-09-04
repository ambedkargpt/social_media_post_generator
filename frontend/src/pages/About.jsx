import MainLayout from '../layouts/MainLayout';
import SectionHeading from '../components/ui/SectionHeading';
import GlassCard from '../components/ui/GlassCard';
import { teamHighlights } from '../utils/siteContent';
import { useI18n } from '../i18n/index.jsx';

export default function About() {
  const { t } = useI18n();
  return (
    <MainLayout>
      <section className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-[91px]">
        <SectionHeading
          eyebrow={t('about.eyebrow')}
          title={t('about.title')}
          description={t('about.desc')}
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {teamHighlights.map((key) => (
            <GlassCard key={key} className="h-full min-h-[140px]">
              <h2 className="text-xl font-medium text-white">{t(key)}</h2>
            </GlassCard>
          ))}
        </div>

        <div className="mt-5">
          <GlassCard className="md:p-10">
            <h3 className="text-2xl font-medium text-white">{t('about.purposeTitle')}</h3>
            <p className="mt-4 max-w-4xl leading-8 text-[#d0d9ea]">
              {t('about.purposeBody')}
            </p>
          </GlassCard>
        </div>
      </section>
    </MainLayout>
  );
}

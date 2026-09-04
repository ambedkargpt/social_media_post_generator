import MainLayout from '../layouts/MainLayout';
import SectionHeading from '../components/ui/SectionHeading';
import GlassCard from '../components/ui/GlassCard';
import { resourceCards } from '../utils/siteContent';
import { useI18n } from '../i18n/index.jsx';

export default function Resources() {
  const { t } = useI18n();
  return (
    <MainLayout>
      <section className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-[91px]">
        <SectionHeading
          eyebrow={t('res.eyebrow')}
          title={t('res.title')}
          description={t('res.desc')}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {resourceCards.map((item) => (
            <GlassCard key={item.titleKey} className="h-full min-h-[220px]">
              <p className="text-xs uppercase tracking-[0.12em] text-[#6daeff]">{t(item.typeKey)}</p>
              <h2 className="mt-2 text-2xl font-medium text-white">{t(item.titleKey)}</h2>
              <p className="mt-3 leading-7 text-[#c7d5ee]">{t(item.descKey)}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </MainLayout>
  );
}

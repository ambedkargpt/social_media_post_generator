import MainLayout from '../layouts/MainLayout';
import SectionHeading from '../components/ui/SectionHeading';
import GlassCard from '../components/ui/GlassCard';
import ContactForm from '../components/forms/ContactForm';
import { useI18n } from '../i18n/index.jsx';

export default function Contact() {
  const { t } = useI18n();
  return (
    <MainLayout>
      <section className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-[91px]">
        <SectionHeading
          eyebrow={t('con.eyebrow')}
          title={t('con.title')}
          description={t('con.desc')}
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="md:p-8">
            <ContactForm />
          </GlassCard>
          <GlassCard className="h-full md:p-8">
            <h2 className="text-2xl font-medium text-white">{t('con.channels')}</h2>
            <div className="mt-5 space-y-4 text-[#d0d9ea]">
              <p>{t('con.emailLine')}</p>
              <p>{t('con.supportLine')}</p>
              <p>{t('con.partnerLine')}</p>
            </div>
          </GlassCard>
        </div>
      </section>
    </MainLayout>
  );
}

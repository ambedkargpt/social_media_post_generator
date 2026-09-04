import MainLayout from '../layouts/MainLayout';
import { useI18n } from '../i18n/index.jsx';
import SectionHeading from '../components/ui/SectionHeading';
import GlassCard from '../components/ui/GlassCard';

const plans = [
  { nameKey: 'price.starter.name', priceKey: 'price.starter.price', summaryKey: 'price.starter.summary' },
  { nameKey: 'price.pro.name', price: 'INR 499/mo', summaryKey: 'price.pro.summary' },
  { nameKey: 'price.institution.name', priceKey: 'price.institution.price', summaryKey: 'price.institution.summary' },
];

export default function Pricing() {
  const { t } = useI18n();
  return (
    <MainLayout>
      <section className="mx-auto w-full max-w-[1440px] px-6 py-16 md:px-[91px]">
        <SectionHeading
          eyebrow={t('price.eyebrow')}
          title={t('price.title')}
          description={t('price.desc')}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <GlassCard key={plan.nameKey} className="h-full min-h-[220px] md:p-8">
              <h2 className="text-2xl font-semibold text-white">{t(plan.nameKey)}</h2>
              <p className="mt-2 text-2xl font-semibold text-[#64b5ff]">{plan.priceKey ? t(plan.priceKey) : plan.price}</p>
              <p className="mt-4 leading-7 text-[#c7d5ee]">{t(plan.summaryKey)}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </MainLayout>
  );
}

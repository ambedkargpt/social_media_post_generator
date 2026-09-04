import { useI18n } from '../../i18n/index.jsx';

export default function ContactForm() {
  const { t } = useI18n();
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
      <label className="flex flex-col gap-2">
        <span className="text-sm text-[#c5d2eb]">{t('landing.contactName')}</span>
        <input
          className="h-12 rounded-lg border border-[#24314c] bg-[#0f1629] px-4 text-white outline-none focus:border-[#4f6bff]"
          type="text"
          placeholder={t('con.yourName')}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-[#c5d2eb]">{t('landing.contactEmail')}</span>
        <input
          className="h-12 rounded-lg border border-[#24314c] bg-[#0f1629] px-4 text-white outline-none focus:border-[#4f6bff]"
          type="email"
          placeholder="you@example.com"
        />
      </label>

      <label className="flex flex-col gap-2 md:col-span-2">
        <span className="text-sm text-[#c5d2eb]">{t('landing.contactMessage')}</span>
        <textarea
          className="min-h-36 rounded-lg border border-[#24314c] bg-[#0f1629] px-4 py-3 text-white outline-none focus:border-[#4f6bff]"
          placeholder={t('con.tellUsNeed')}
        />
      </label>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-[10px] bg-gradient-to-r from-[#00b8db] to-[#2b7fff] px-6 text-sm font-medium text-white"
        >
          {t('landing.sendMessage')}
        </button>
      </div>
    </form>
  );
}

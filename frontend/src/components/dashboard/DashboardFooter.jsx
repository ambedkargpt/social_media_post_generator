import { useState } from 'react';
import { Link } from 'react-router-dom';
import LegalModal from '../LegalModal';
import { useI18n } from '../../i18n/index.jsx';

// Every one of these was an href="#", which scrolls to the top of the page and
// does nothing else: four links that looked live and led nowhere. Privacy and
// Terms open the same modal the landing footer and signup use; Contact goes to
// the section that already exists. Help Center is gone rather than faked — there
// is no help centre to link to, and a dead link is worse than no link.
export default function DashboardFooter() {
  const { t } = useI18n();
  const [legal, setLegal] = useState(null);

  const linkClass = 'text-[12.5px] text-[#8b94b8] transition hover:text-white';

  return (
    <footer className="mt-8 border-t border-[#1a254a]/50 pt-5 pb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12.5px] text-[#6b78a0]">
        © 2026 AmbedkarGPT. All rights reserved.
      </p>

      <nav className="flex flex-wrap items-center gap-6">
        <button type="button" onClick={() => setLegal('privacy')} className={linkClass}>
          {t('landing.privacy')}
        </button>
        <button type="button" onClick={() => setLegal('terms')} className={linkClass}>
          {t('landing.terms')}
        </button>
        <Link to="/#contact" className={linkClass}>
          {t('nav.contact')}
        </Link>
      </nav>

      {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}
    </footer>
  );
}

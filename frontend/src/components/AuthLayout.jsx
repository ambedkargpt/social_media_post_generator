import { Link } from 'react-router-dom';

import { useI18n } from '../i18n/index.jsx';
import Segmented from './np/Segmented';

const portraitSrc = new URL('../assets/images/ambedkar-portrait.webp', import.meta.url).href;

/**
 * The frame every signed-out screen sits in.
 *
 * Phase 3 of docs/redesign/neela-press.md. A portrait panel and a form
 * column, and nothing floating behind either: BackgroundDecorations is gone
 * from auth and the form column paints the one static `.np-bg` instead.
 *
 * The portrait is treated rather than merely placed - greyscale, contrast,
 * and the Neela blue multiplied over it - so it reads as a printed plate on a
 * movement paper instead of a stock photograph with a gradient on top.
 *
 * `wide` gives the form column more room and the portrait less. Signup is a
 * three-step wizard with a grid of party cards in it and does not fit in the
 * 400px the other three use.
 */
export default function AuthLayout({ children, wide = false, footer }) {
  const { t, lang, changeLanguage } = useI18n();

  return (
    <div className="np np-auth">
      <aside className="np-auth-portrait" aria-hidden="true">
        <img
          src={portraitSrc}
          alt=""
          width={1200}
          height={1600}
          fetchPriority="high"
          decoding="async"
        />
        <span className="np-auth-duotone" />
        <span className="np-auth-fade" />
        {/* The one decorative shape in the redesign, at the size it can be
            when nothing has to be read through it. */}
        <svg className="np-auth-chakra" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth=".7" />
          <circle cx="24" cy="24" r="2.6" fill="currentColor" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI / 12) * i;
            const dx = Math.cos(a) * 20;
            const dy = Math.sin(a) * 20;
            return (
              <line
                key={i}
                x1={24 - dx} y1={24 - dy} x2={24 + dx} y2={24 + dy}
                stroke="currentColor" strokeWidth=".45"
              />
            );
          })}
        </svg>

        <blockquote className="np-auth-quote">
          <p className="np-serif np-auth-quote-en">Educate, Agitate, Organize.</p>
          <p className="np-serif np-auth-quote-hi" lang="hi">शिक्षित बनो · संगठित रहो · संघर्ष करो</p>
          <cite>Dr. B. R. Ambedkar</cite>
        </blockquote>
      </aside>

      <div className={`np-bg np-auth-form ${wide ? 'is-wide' : ''}`}>
        <div className="np-auth-top">
          <Link to="/" className="np-brand" aria-label="AmbedkarGPT">
            <span className="np-brand-mark" aria-hidden="true">अ</span>
            <span className="np-brand-text np-display">
              {t('brand.ambedkar')}<span className="np-brand-gpt">GPT</span>
            </span>
          </Link>
          <Segmented
            size="sm"
            ariaLabel="Language"
            value={lang}
            onChange={changeLanguage}
            options={[{ value: 'en', label: 'EN' }, { value: 'hi', label: 'हिं' }]}
          />
        </div>

        <main className="np-auth-body">
          <div className="np-auth-inner np-stagger">{children}</div>
        </main>

        {footer && <footer className="np-auth-foot">{footer}</footer>}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';

import { useI18n } from '../i18n/index.jsx';

/**
 * The frame for the screens between signing up and arriving: the
 * questionnaire, and profile setup the first time through.
 *
 * Phase 4 of docs/redesign/neela-press.md. No rail - there is nowhere else to
 * go yet, and a navigation that cannot be used is a navigation that makes the
 * screen look stuck. What it has instead is a count, so the end is visible
 * from the start, and a way out that does not lose what has been answered.
 *
 * The progress is segments rather than a bar: five questions is a number
 * someone can hold, and five blocks say "five" without being read.
 */
export default function OnboardingLayout({
  step,          // 1-based
  total,
  label,         // e.g. "Question 3 of 5"
  onFinishLater,
  children,
}) {
  const { t } = useI18n();

  return (
    <div className="np np-bg np-onboard">
      <header className="np-onboard-top">
        <Link to="/" className="np-brand" aria-label="AmbedkarGPT">
          <span className="np-brand-mark" aria-hidden="true">अ</span>
          <span className="np-brand-text np-display">
            {t('brand.ambedkar')}<span className="np-brand-gpt">GPT</span>
          </span>
        </Link>

        <div className="np-onboard-progress">
          {total > 0 && (
            <span className="np-onboard-segs" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={i < step ? 'is-filled' : ''} />
              ))}
            </span>
          )}
          {label && <span className="np-mono np-onboard-count">{label}</span>}
        </div>

        {onFinishLater && (
          <button type="button" onClick={onFinishLater} className="np-btn np-btn-ghost np-onboard-later">
            {t('np.q.finishLater')}
          </button>
        )}
      </header>

      <main className="np-onboard-body">{children}</main>
    </div>
  );
}

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useI18n } from '../i18n/index.jsx';

/**
 * The phone field, with its country selector.
 *
 * Moved onto the Neela Press controls with the auth screens. The library
 * renders its own markup, so the look comes from the `.phone-field` rules in
 * index.css; `np-phone` is the class those rules key off for the redesigned
 * screens, leaving the old ones untouched.
 */
export default function PhoneField({ value, onChange, error, optional = false, hint, label }) {
  const { t } = useI18n();
  return (
    <div className="np-field" style={{ display: 'grid', gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-np-text-2)' }}>
        {label ?? t('auth.phone')}
        {optional && (
          <span style={{ marginInlineStart: 6, fontWeight: 400, color: 'var(--color-np-faint)' }}>
            {t('common.optional')}
          </span>
        )}
      </label>
      <div className={`phone-field np-phone${error ? ' error' : ''}`}>
        <PhoneInput
          international
          defaultCountry="IN"
          value={value}
          onChange={onChange}
          placeholder={t('auth.enterPhone')}
        />
      </div>
      {error && <p style={{ margin: 0, fontSize: 14, color: 'var(--color-np-critical)' }}>{error}</p>}
      {hint && !error && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-np-muted)' }}>{hint}</p>
      )}
    </div>
  );
}

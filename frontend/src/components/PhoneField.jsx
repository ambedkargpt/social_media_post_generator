import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useI18n } from '../i18n/index.jsx';

export default function PhoneField({ value, onChange, error, optional = false, hint }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium mb-1" style={{ color: '#9db3d8' }}>
        {t('auth.phone')}
        {optional && <span className="ml-1.5 font-normal" style={{ color: '#5a6e9a' }}>{t('common.optional')}</span>}
      </label>
      <div className={`phone-field${error ? ' error' : ''}`}>
        <PhoneInput
          international
          defaultCountry="IN"
          value={value}
          onChange={onChange}
          placeholder={t('auth.enterPhone')}
        />
      </div>
      {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      {hint && !error && <p className="text-xs mt-1" style={{ color: '#5a6e9a' }}>{hint}</p>}
    </div>
  );
}

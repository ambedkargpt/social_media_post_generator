import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useI18n } from '../i18n/index.jsx';

export default function PhoneField({ value, onChange, error }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium mb-1" style={{ color: '#9db3d8' }}>
        Phone Number
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
    </div>
  );
}

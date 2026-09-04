import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

export default function PasswordInput({ value, onChange, error, label, placeholder = '••••••••••' }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: '#e5e7eb' }}>
        {label ?? t('auth.password')}
      </label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`input-field w-full px-4 py-3 pr-12 rounded-xl text-sm${error ? ' error' : ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
          style={{ color: '#8b94b8' }}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  );
}

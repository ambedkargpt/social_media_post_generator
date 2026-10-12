import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

/**
 * A password field with a reveal.
 *
 * Moved onto the Neela Press controls with the auth screens, which are the
 * only three places it renders. The reveal button stays out of the tab order:
 * it is a convenience, and stopping on it between the field and the submit
 * button on every pass is not convenient.
 */
export default function PasswordInput({
  value,
  onChange,
  error,
  label,
  autoComplete = 'current-password',
  placeholder = '••••••••••',
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="np-field" style={{ display: 'grid', gap: 8 }}>
      <label htmlFor={id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-np-text-2)' }}>
        {label ?? t('auth.password')}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="np-control"
          style={{
            width: '100%', minHeight: 52, padding: '0 48px 0 14px',
            background: 'var(--color-np-desk)',
            border: `1px solid ${error ? 'var(--color-np-critical)' : 'var(--color-np-track)'}`,
            borderRadius: 10, color: 'var(--color-np-text)', fontSize: 17,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          style={{
            position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)',
            width: 36, height: 36, display: 'grid', placeItems: 'center',
            border: 'none', background: 'transparent', borderRadius: 8,
            color: 'var(--color-np-muted)', cursor: 'pointer',
          }}
        >
          {visible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} style={{ margin: 0, fontSize: 14, color: 'var(--color-np-critical)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

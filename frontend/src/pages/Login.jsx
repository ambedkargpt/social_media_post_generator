import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { ArrowRight, TriangleAlert } from 'lucide-react';

import { useAuth, friendlyError } from '../context/AuthContext';
import { useCurtain } from '../context/CurtainContext';
import AuthLayout from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';
import PhoneField from '../components/PhoneField';
import GoogleButton from '../components/GoogleButton';
import { Button, Field, Input, UnderlineTabs } from '../components/np';
import { useI18n } from '../i18n/index.jsx';

/**
 * Phase 3 of docs/redesign/neela-press.md.
 *
 * Every piece of logic here is the one that was here before: the OTP
 * redirect, `otp_required`, the Google flow, `auth_redirect`, friendlyError,
 * and the seeded test accounts. What changed is that phone leads rather than
 * email - most of the people this is for are in India on a phone, and the
 * tab that was second was the one they needed.
 */

// One-click sign-in for the shared team accounts seeded by
// backend/scripts/seed_test_accounts.py.
//
// The password is read from the environment and never written here. Anything
// in this file is compiled into the bundle every visitor downloads, and these
// accounts have no limits at all -- committing their password would publish
// uncapped generation under the project's name to anyone who opened devtools.
// Set VITE_TEST_PASSWORD in frontend/.env locally, or on a staging deployment,
// and the block appears; leave it unset, as production should, and it does not
// render at all.
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD || '';
const TEST_ACCOUNTS = [
  { email: 'test.cong@ambedkargpt.test', label: 'Congress' },
  { email: 'test.sp@ambedkargpt.test', label: 'Samajwadi' },
  { email: 'test.ind@ambedkargpt.test', label: 'No party' },
];

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { loginWithEmail, loginWithPhone, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const e = {};
    if (mode === 'email') {
      if (!email.trim()) e.email = t('auth.emailRequired');
      if (!password) e.password = t('auth.passwordRequired');
    } else {
      if (!phone) e.phone = t('auth.phoneRequired');
      else if (!isValidPhoneNumber(phone)) e.phone = t('auth.phoneInvalid');
      // No password for phone - the code is sent automatically.
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setAuthError('');
    setLoading(true);
    try {
      if (mode === 'phone') {
        const data = await loginWithPhone(phone);
        navigate('/otp', {
          state: {
            identifier: data?.otp_target || phone,
            type: 'phone',
            mode: 'login',
            password: '',
            devOtp: data?.dev_otp || '',
          },
        });
      } else {
        const data = await loginWithEmail(email.trim(), password);
        if (data?.otp_required) {
          navigate('/otp', {
            state: {
              identifier: data.otp_target || email.trim(),
              type: 'email',
              mode: 'login',
              password: '',
              devOtp: data.dev_otp || '',
            },
          });
        } else {
          const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
          sessionStorage.removeItem('auth_redirect');
          curtainGo(redirect, { replace: true });
        }
      }
    } catch (err) {
      setAuthError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(tokenResponse) {
    setAuthError('');
    setLoading(true);
    try {
      await loginWithGoogle(tokenResponse.access_token);
      const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
      sessionStorage.removeItem('auth_redirect');
      curtainGo(redirect, { replace: true });
    } catch (err) {
      setAuthError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setErrors({});
    setAuthError('');
    setPassword('');
  }

  return (
    <AuthLayout
      footer={(
        <p style={{ margin: 0 }}>
          {t('np.auth.newHere')}{' '}
          <Link to="/signup" style={{ color: 'var(--color-np-neela-300)', fontWeight: 600 }}>
            {t('auth.createAccount')}
          </Link>{' '}
          · {t('np.auth.threeSteps')}
        </p>
      )}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div>
          <h1 className="np-auth-h1 np-display">{t('np.auth.login')}</h1>
          <p className="np-auth-sub">{t('np.auth.loginSub')}</p>
        </div>

        <GoogleButton onSuccess={handleGoogle} disabled={loading} />

        <p className="np-or" style={{ margin: 0 }}>{t('auth.or')}</p>

        <UnderlineTabs
          ariaLabel={t('np.auth.login')}
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'phone', label: t('auth.phone') },
            { value: 'email', label: t('auth.email') },
          ]}
        />

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }} noValidate>
          {mode === 'phone' ? (
            <PhoneField
              value={phone}
              onChange={setPhone}
              error={errors.phone}
              hint={t('auth.phoneHelp')}
            />
          ) : (
            <>
              <Field label={t('auth.email')} error={errors.email}>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={!!errors.email}
                  placeholder="you@example.com"
                />
              </Field>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
              <div style={{ marginTop: -6, textAlign: 'end' }}>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: 14, color: 'var(--color-np-neela-300)' }}
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </>
          )}

          {authError && (
            <p className="np-alert" role="alert" style={{ margin: 0 }}>
              <TriangleAlert size={18} strokeWidth={2} style={{ flex: 'none', marginTop: 1 }} />
              <span>{authError}</span>
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            iconRight={ArrowRight}
          >
            {mode === 'phone' ? t('np.auth.sendCode') : t('np.auth.login')}
          </Button>
        </form>

        {/* Only ever rendered when the environment carries the password, which
            production does not. */}
        {TEST_PASSWORD && (
          <div style={{
            display: 'grid', gap: 8, padding: 14, borderRadius: 12,
            border: '1px dashed var(--color-np-rule-strong)',
          }}>
            <p className="np-mono" style={{ margin: 0, fontSize: 12, color: 'var(--color-np-faint)' }}>
              test accounts
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TEST_ACCOUNTS.map((a) => (
                <Button
                  key={a.email}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    switchMode('email');
                    setEmail(a.email);
                    setPassword(TEST_PASSWORD);
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, TriangleAlert } from 'lucide-react';

import { friendlyError, useAuth } from '../context/AuthContext';
import { useCurtain } from '../context/CurtainContext';
import AuthLayout from '../components/AuthLayout';
import GoogleButton from '../components/GoogleButton';
import { Button, Field, Input } from '../components/np';
import { useI18n } from '../i18n/index.jsx';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/**
 * Phase 3 of docs/redesign/neela-press.md. The flow is the one that was
 * here: submit, then straight to /otp, with the Google-account case handled
 * separately because those accounts have no password to reset.
 *
 * The one behavioural addition is that the Google case now says what to do
 * next instead of only what went wrong.
 */
export default function ForgotPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const { go: curtainGo } = useCurtain();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError(t('auth.emailRequired')); return; }
    setError('');
    setIsGoogleAccount(false);
    setLoading(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/forgot-password`, {
        email: email.trim().toLowerCase(),
      });
      navigate('/otp', {
        state: {
          identifier: email.trim().toLowerCase(),
          type: 'email',
          mode: 'reset_password',
          password: '',
          devOtp: data?.dev_otp || '',
        },
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || '';
      if (detail === 'google_account') {
        setIsGoogleAccount(true);
      } else {
        setError(friendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(tokenResponse) {
    setLoading(true);
    try {
      await loginWithGoogle(tokenResponse.access_token);
      const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
      sessionStorage.removeItem('auth_redirect');
      curtainGo(redirect, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      footer={(
        <Link to="/login" style={{ color: 'var(--color-np-neela-300)', fontWeight: 600 }}>
          {t('auth.backToLogin')}
        </Link>
      )}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div>
          <h1 className="np-auth-h1 np-display">{t('auth.forgotTitle')}</h1>
          <p className="np-auth-sub">{t('auth.forgotSub')}</p>
        </div>

        {/* There is nothing to reset on a Google account, so the answer is a
            way in rather than an apology. */}
        {isGoogleAccount ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <p className="np-alert" style={{ margin: 0 }}>
              <TriangleAlert size={18} strokeWidth={2} style={{ flex: 'none', marginTop: 1 }} />
              <span>{t('auth.googleAccountNote')}</span>
            </p>
            <GoogleButton onSuccess={handleGoogle} disabled={loading} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }} noValidate>
            <Field label={t('auth.email')} error={error}>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!error}
                placeholder="you@example.com"
              />
            </Field>

            <Button type="submit" size="lg" fullWidth loading={loading} iconRight={ArrowRight}>
              {t('np.auth.sendCode')}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

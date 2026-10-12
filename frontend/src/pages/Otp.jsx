import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Info, TriangleAlert } from 'lucide-react';

import { useAuth, friendlyError } from '../context/AuthContext';
import { resendOtp as resendOtpApi } from '../api/auth';
import { useCurtain } from '../context/CurtainContext';
import AuthLayout from '../components/AuthLayout';
import { Button, Chakra } from '../components/np';
import { useI18n } from '../i18n/index.jsx';

/**
 * Phase 3 of docs/redesign/neela-press.md.
 *
 * The behaviour is unchanged: paste fills every box, typing advances,
 * backspace retreats, phone users get a call rather than a message, and the
 * resend timer is thirty seconds.
 *
 * What is new, besides the look: every string on this page now goes through
 * t(). "Verify OTP", "You'll receive a call on …", "Not in your inbox?" and
 * "Wrong number?" were hard-coded English, so a Hindi reader reached the one
 * screen that stands between them and an account and found half of it in a
 * language they had already said they did not read.
 */

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

function describeIdentifier(identifier = '') {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    const [local, domain] = trimmed.split('@');
    return { labelKey: 'auth.emailWord', masked: `${local.slice(0, 2)}***@${domain}` };
  }
  const digits = trimmed.replace(/\D/g, '');
  return { labelKey: 'auth.phoneWord', masked: `******${digits.slice(-4)}` };
}

function OtpBoxes({ value, onChange, state }) {
  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);
  const inputRefs = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  function focusBox(i) { inputRefs.current[i]?.focus(); }

  function handleKeyDown(e, i) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      onChange(digits.map((d, j) => (j === i ? '' : d)).join(''));
      if (i > 0) focusBox(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) focusBox(i - 1);
    else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) focusBox(i + 1);
  }

  function handleInput(e, i) {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    onChange(digits.map((d, j) => (j === i ? char : d)).join(''));
    if (i < OTP_LENGTH - 1) focusBox(i + 1);
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(Array(OTP_LENGTH).fill('').map((_, i) => pasted[i] || '').join(''));
    focusBox(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <div className="np-otp" data-state={state || undefined}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          placeholder=" "
          aria-label={`${i + 1}`}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onInput={(e) => handleInput(e, i)}
          onPaste={handlePaste}
          onChange={() => {}}
        />
      ))}
    </div>
  );
}

/**
 * Thirty seconds, shown rather than merely waited out: a ring that fills and
 * a count in mono, so the wait has a visible end.
 */
function ResendTimer({ onResend, type }) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  if (seconds > 0) {
    const mmss = `0:${String(seconds).padStart(2, '0')}`;
    return (
      <p style={{
        margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, fontSize: 14, color: 'var(--color-np-muted)',
      }}>
        <Chakra size={20} mode="progress" value={1 - seconds / RESEND_SECONDS} />
        <span className="np-mono">{t('np.otp.resendIn', { time: mmss })}</span>
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setSeconds(RESEND_SECONDS); onResend(); }}
      >
        {t(type === 'phone' ? 'auth.callAgain' : 'auth.resend')}
      </Button>
    </div>
  );
}

export default function Otp() {
  const { t } = useI18n();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { verifyOtp } = useAuth();

  const identifier = state?.identifier || '';
  const type = state?.type || 'email';      // 'email' | 'phone'
  const mode = state?.mode || 'signup';     // 'signup' | 'login'
  const devOtp = state?.devOtp || '';       // auto-filled in dev mode

  useEffect(() => {
    if (!identifier) navigate('/signup', { replace: true });
  }, [identifier, navigate]);

  const { masked } = describeIdentifier(identifier);
  const [otp, setOtp] = useState(devOtp);
  const [otpError, setOtpError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (otp.length < OTP_LENGTH) { setOtpError(t('auth.otpIncomplete')); return; }
    setOtpError('');
    setLoading(true);
    try {
      const purpose = mode === 'signup' ? 'signup_verify' : 'login_verify';
      await verifyOtp(otp, identifier, type, purpose);
      // The boxes go green for a moment before the screen changes, so the
      // navigation reads as a consequence rather than as an interruption.
      setOk(true);
      const dest = (mode === 'signup' && type === 'phone') ? '/profile-setup'
        : mode === 'signup' ? '/questionnaire'
          : '/dashboard';
      setTimeout(() => curtainGo(dest, { replace: true }), 300);
    } catch (err) {
      setOtpError(friendlyError(err));
      setLoading(false);
    }
  }

  async function handleResend() {
    setOtp('');
    setOtpError('');
    setResendMsg('');
    try {
      const purpose = mode === 'signup' ? 'signup_verify' : 'login_verify';
      const data = await resendOtpApi({ target: identifier, channel: type, purpose });
      setResendMsg(t('auth.otpResent'));
      if (data?.dev_otp) setOtp(data.dev_otp);
      setTimeout(() => setResendMsg(''), 4000);
    } catch (err) {
      setOtpError(friendlyError(err));
    }
  }

  const backTo = mode === 'login' ? '/login' : '/signup';

  return (
    <AuthLayout>
      <div style={{ display: 'grid', gap: 22 }}>
        <div>
          <h1 className="np-auth-h1 np-display">{t('np.otp.title')}</h1>
          <p className="np-auth-sub">
            {t(type === 'phone' ? 'auth.otpCallTo' : 'auth.otpSentTo', { target: masked })}{' '}
            <Link to={backTo} style={{ color: 'var(--color-np-neela-300)', fontWeight: 600 }}>
              {t('auth.change')}
            </Link>
          </p>
          {devOtp && (
            <p className="np-mono" style={{
              margin: '10px 0 0', fontSize: 12, color: 'var(--color-np-success)',
            }}>
              {t('auth.devOtp', { code: devOtp })}
            </p>
          )}
        </div>

        {/* Email only. A code from a new sender is a textbook spam-filter
            catch, and someone who does not know to look there concludes it
            never arrived and gives up on the account. */}
        {type === 'email' && (
          <p className="np-alert" style={{
            margin: 0, borderColor: 'var(--color-np-rule-strong)', background: 'transparent',
            color: 'var(--color-np-muted)',
          }}>
            <Info size={18} strokeWidth={2} style={{ flex: 'none', marginTop: 1 }} />
            <span>{t('auth.spamNote')}</span>
          </p>
        )}

        {resendMsg && (
          <p className="np-alert np-alert-success" style={{ margin: 0 }} role="status">
            {resendMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }} noValidate>
          <OtpBoxes
            value={otp}
            onChange={(v) => { setOtp(v); setOtpError(''); }}
            state={otpError ? 'error' : ok ? 'ok' : ''}
          />

          {otpError && (
            <p className="np-alert" role="alert" style={{ margin: 0 }}>
              <TriangleAlert size={18} strokeWidth={2} style={{ flex: 'none', marginTop: 1 }} />
              <span>{otpError}</span>
            </p>
          )}

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? t('auth.verifying') : t('auth.verify')}
          </Button>
        </form>

        <ResendTimer onResend={handleResend} type={type} />
      </div>
    </AuthLayout>
  );
}

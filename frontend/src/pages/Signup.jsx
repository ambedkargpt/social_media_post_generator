import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { useAuth, friendlyError } from '../context/AuthContext';
import { useCurtain } from '../context/CurtainContext';
import AuthLayout    from '../components/AuthLayout';
import AnimatedInput from '../components/AnimatedInput';
import PasswordInput from '../components/PasswordInput';
import PhoneField    from '../components/PhoneField';
import PrimaryButton from '../components/PrimaryButton';
import GoogleButton  from '../components/GoogleButton';
import LegalModal    from '../components/LegalModal';

const POLITICAL_PARTIES = [
  { name: 'Indian National Congress (INC)',      logo: '/party-logos/inc.png' },
  { name: 'Bharatiya Janata Party (BJP)',         logo: '/party-logos/bjp.png' },
  { name: 'Trinamool Congress (TMC)',             logo: '/party-logos/tmc.png' },
  { name: 'Communist Party of India (CPI)',       logo: '/party-logos/cpi.png' },
  { name: 'Samajwadi Party (SP)',                 logo: '/party-logos/sp.png' },
  { name: 'Aam Aadmi Party (AAP)',               logo: '/party-logos/aap.png' },
  { name: 'Bahujan Samaj Party (BSP)',           logo: '/party-logos/bsp.png' },
  { name: 'Rashtriya Janata Dal (RJD)',          logo: '/party-logos/rjd.png' },
  { name: 'Janata Dal (Loktantrik)',             logo: '/party-logos/jdl.png' },
  { name: 'Azad Samaj Party',                    logo: '/party-logos/azad-samaj.png' },
  { name: 'Jan Suraaj Party',                    logo: '/party-logos/jan-suraaj.png' },
  { name: 'Vikassheel Insaan Party (VIP)',       logo: '/party-logos/vip.png' },
  { name: 'Indian National Lok Dal (INLD)',      logo: '/party-logos/inld.png' },
  { name: 'Jannayak Janta Party (JJP)',          logo: '/party-logos/jjp.png' },
  { name: 'Bharat Adivasi Party (BAP)',          logo: '/party-logos/bap.png' },
  { name: 'None / Not Affiliated',               logo: null },
];

export default function Signup() {
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { signupWithEmail, signupWithPhone, loginWithGoogle } = useAuth();

  const [mode, setMode]                       = useState('email');
  const [email, setEmail]                     = useState('');
  const [phone, setPhone]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [subscribed, setSubscribed]           = useState(false);
  const [termsAccepted, setTermsAccepted]     = useState(false);
  const [politicalParty, setPoliticalParty]   = useState('');
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const partyDropdownRef                      = useRef(null);
  const [modal, setModal]                     = useState(null);
  const [errors, setErrors]                   = useState({});
  const [authError, setAuthError]             = useState('');
  const [loading, setLoading]                 = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target)) {
        setPartyDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function validate() {
    const e = {};
    if (mode === 'email') {
      if (!email.trim())             e.email = 'Email is required.';
      if (!password)                 e.password = 'Password is required.';
      else if (password.length < 8)  e.password = 'Password must be at least 8 characters.';
      if (!confirmPassword)          e.confirmPassword = 'Please confirm your password.';
      else if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match.';
    } else {
      if (!phone)                          e.phone = 'Phone number is required.';
      else if (!isValidPhoneNumber(phone)) e.phone = 'Please enter a valid phone number.';
    }
    if (!politicalParty) e.politicalParty = 'Please select a political party.';
    if (!termsAccepted)  e.terms = 'You must accept the Terms of Service and Privacy Policy.';
    return e;
  }

  function validateForGoogle() {
    const e = {};
    if (!politicalParty) e.politicalParty = 'Please select a political party.';
    if (!termsAccepted)  e.terms = 'You must accept the Terms of Service and Privacy Policy.';
    if (Object.keys(e).length) { setErrors(e); return false; }
    setErrors({});
    return true;
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
        const data = await signupWithPhone(phone, null, politicalParty || undefined);
        navigate('/otp', { state: { identifier: phone, type: 'phone', mode: 'signup', password: '', devOtp: data?.dev_otp || '' } });
      } else {
        const data = await signupWithEmail(email.trim(), password, politicalParty || undefined);
        navigate('/otp', { state: { identifier: email.trim(), type: 'email', mode: 'signup', password, devOtp: data?.dev_otp || '' } });
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
      await loginWithGoogle(tokenResponse.access_token, politicalParty || undefined);
      const redirect = sessionStorage.getItem('auth_redirect') || '/questionnaire';
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
    setConfirmPassword('');
  }

  return (
    <AuthLayout brandSide="left" brandVariant="signup">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-[40px] font-bold leading-tight tracking-tight text-white md:text-[48px]">
            Create an Account
          </h1>
          <p className="mt-3 text-[14px]" style={{ color: '#8b94b8' }}>
            Begin your journey towards knowledge and enlightenment.
          </p>
        </div>

        {/* Email / Phone toggle */}
        <div className="flex rounded-xl p-1" style={{ backgroundColor: '#0a1128', border: '1px solid #1e3260' }}>
          {['email', 'phone'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: mode === m ? '#1a2a5e' : 'transparent',
                color: mode === m ? '#ffffff' : '#8b94b8',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {m === 'email' ? 'Email' : 'Phone Number'}
            </button>
          ))}
        </div>

        {authError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'email' ? (
            <AnimatedInput
              placeholders={['Enter your Email']}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); setAuthError(''); }}
              label="Email"
              error={errors.email}
            />
          ) : (
            <PhoneField
              value={phone}
              onChange={(v) => { setPhone(v ?? ''); setErrors((p) => ({ ...p, phone: '' })); setAuthError(''); }}
              error={errors.phone}
            />
          )}

          {mode === 'email' && (
            <>
              <PasswordInput
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                error={errors.password}
              />
              <PasswordInput
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: '' })); }}
                error={errors.confirmPassword}
              />
            </>
          )}

          {/* Political Party Dropdown */}
          <div ref={partyDropdownRef} className="relative">
            <label className="block mb-1.5 text-sm font-medium" style={{ color: '#c5cde8' }}>
              Indian political party you support? <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <button
              type="button"
              onClick={() => setPartyDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-200"
              style={{
                backgroundColor: '#0d1b3e',
                border: `1px solid ${errors.politicalParty ? '#ef4444' : partyDropdownOpen ? '#4a6fa5' : '#1e3260'}`,
                color: politicalParty ? '#ffffff' : '#8b94b8',
              }}
            >
              {politicalParty ? (
                <span className="flex items-center gap-2.5">
                  {POLITICAL_PARTIES.find((p) => p.name === politicalParty)?.logo && (
                    <img
                      src={POLITICAL_PARTIES.find((p) => p.name === politicalParty).logo}
                      alt=""
                      className="w-5 h-5 object-contain rounded-sm"
                      style={{ background: 'white', padding: '1px' }}
                    />
                  )}
                  {politicalParty}
                </span>
              ) : (
                <span>Select a political party</span>
              )}
              <svg
                className="w-4 h-4 shrink-0 transition-transform duration-200"
                style={{ transform: partyDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#8b94b8' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {partyDropdownOpen && (
              <div
                className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                style={{ backgroundColor: '#0d1b3e', border: '1px solid #1e3260', maxHeight: '240px', overflowY: 'auto' }}
              >
                {POLITICAL_PARTIES.map((party) => (
                  <button
                    key={party.name}
                    type="button"
                    onClick={() => { setPoliticalParty(party.name); setPartyDropdownOpen(false); setErrors((p) => ({ ...p, politicalParty: '' })); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{
                      color: politicalParty === party.name ? '#ffffff' : '#c5cde8',
                      backgroundColor: politicalParty === party.name ? '#1a2a5e' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (politicalParty !== party.name) e.currentTarget.style.backgroundColor = '#131f45'; }}
                    onMouseLeave={(e) => { if (politicalParty !== party.name) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {party.logo ? (
                      <img src={party.logo} alt={party.name} className="w-6 h-6 object-contain rounded-sm shrink-0" style={{ background: 'white', padding: '1px' }} />
                    ) : (
                      <span className="w-6 h-6 rounded-sm shrink-0 flex items-center justify-center text-xs" style={{ background: '#1e3260' }}>—</span>
                    )}
                    {party.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {errors.politicalParty && (
            <p className="text-xs mt-0.5 px-1" style={{ color: '#ef4444' }}>{errors.politicalParty}</p>
          )}

          <label className="flex items-start gap-3 cursor-pointer rounded-md px-1">
            <input type="checkbox" checked={subscribed} onChange={(e) => setSubscribed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer" />
            <span className="text-xs leading-relaxed" style={{ color: '#8b94b8' }}>
              Send me educational content, updates and resources
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded-md px-1">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => { setTermsAccepted(e.target.checked); setErrors((p) => ({ ...p, terms: '' })); }}
              className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer shrink-0"
            />
            <span className="text-xs leading-relaxed" style={{ color: '#8b94b8' }}>
              I have read and agree to AmbedkarGPT&apos;s{' '}
              <button type="button" onClick={() => setModal('privacy')} className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#6b8aff' }}>
                Privacy Policy
              </button>
              {' '}and{' '}
              <button type="button" onClick={() => setModal('terms')} className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#6b8aff' }}>
                Terms of Service
              </button>
            </span>
          </label>
          {errors.terms && <p className="text-xs mt-0.5 px-1" style={{ color: '#ef4444' }}>{errors.terms}</p>}

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Please wait…' : 'Sign up'}
          </PrimaryButton>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: '#2a3566' }} />
          <span className="text-xs" style={{ color: '#8b94b8' }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: '#2a3566' }} />
        </div>

        <GoogleButton
          onSuccess={handleGoogle}
          onError={() => setAuthError('Google sign-in failed. Please try again.')}
          disabled={loading}
          beforeLogin={validateForGoogle}
        />

        <p className="text-center text-sm" style={{ color: '#8b94b8' }}>
          Already have an account?{' '}
          <Link to="/login" className="underline underline-offset-2 hover:opacity-80 transition-opacity font-medium" style={{ color: '#6b8aff' }}>
            Log In
          </Link>
        </p>
      </div>
      {modal && <LegalModal type={modal} onClose={() => setModal(null)} />}
    </AuthLayout>
  );
}

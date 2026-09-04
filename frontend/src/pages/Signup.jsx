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

import { POLITICAL_PARTIES } from '../utils/politicalParties';
import { ROLE_GROUPS, roleLabel, rolesInGroup } from '../utils/partyRoles';
import { INDIAN_STATES, CITIES_BY_STATE } from '../utils/indianStatesCities';
import { useI18n } from '../i18n/index.jsx';
import { partyLabel, levelLabel } from '../utils/displayLabel';

export default function Signup() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { signupWithEmail, signupWithPhone, loginWithGoogle } = useAuth();

  const [mode, setMode]                       = useState('email');
  const [email, setEmail]                     = useState('');
  const [phone, setPhone]                     = useState('');
  // Secondary phone, collected only in email mode — phone mode already has
  // `phone` above as the primary identifier.
  const [secondaryPhone, setSecondaryPhone]   = useState('');
  const [state, setState]                     = useState('');
  // Holds a known city name or the literal 'Other'; `customCity` is the free
  // text typed when the list doesn't have theirs, so a mandatory field never
  // blocks someone whose town isn't in the list.
  const [city, setCity]                       = useState('');
  const [customCity, setCustomCity]           = useState('');
  const [dob, setDob]                         = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [subscribed, setSubscribed]           = useState(false);
  const [termsAccepted, setTermsAccepted]     = useState(false);
  const [politicalParty, setPoliticalParty]   = useState('');
  const [partyLevel, setPartyLevel]           = useState('');
  const [partyPosition, setPartyPosition]     = useState('');
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

  // The city list depends on the state, so switching states leaves a
  // selection from the old list dangling if it isn't cleared here.
  function handleStateChange(newState) {
    setState(newState);
    setCity('');
    setCustomCity('');
    setErrors((p) => ({ ...p, state: '', city: '' }));
  }

  function validate() {
    const e = {};
    if (mode === 'email') {
      if (!email.trim())                              e.email = t('auth.emailRequired');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Please enter a valid email address.';
      if (!password)                 e.password = t('auth.passwordRequired');
      else if (password.length < 8)  e.password = t('auth.passwordMinLen');
      if (!confirmPassword)          e.confirmPassword = t('auth.confirmPasswordRequired');
      else if (confirmPassword !== password) e.confirmPassword = t('auth.passwordMismatch');
      // Optional, but if given it has to actually be a phone number.
      if (secondaryPhone && !isValidPhoneNumber(secondaryPhone)) e.secondaryPhone = 'Please enter a valid phone number.';
    } else {
      if (!phone)                          e.phone = 'Phone number is required.';
      else if (!isValidPhoneNumber(phone)) e.phone = 'Please enter a valid phone number.';
    }
    if (!state) e.state = t('auth.stateRequired');
    if (!city)  e.city = t('auth.cityRequired');
    else if (city === 'Other' && !customCity.trim()) e.city = t('auth.cityRequired');
    if (!politicalParty) e.politicalParty = t('auth.pickPartyFirst');
    if (!termsAccepted)  e.terms = 'You must accept the Terms of Service and Privacy Policy.';
    return e;
  }

  function validateForGoogle() {
    const e = {};
    if (!politicalParty) e.politicalParty = t('auth.pickPartyFirst');
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
      const resolvedCity = city === 'Other' ? customCity.trim() : city;
      const extra = { state, city: resolvedCity, dateOfBirth: dob || undefined };
      if (mode === 'phone') {
        const data = await signupWithPhone(phone, politicalParty || undefined, partyPosition || undefined, extra);
        navigate('/otp', { state: { identifier: data?.otp_target || phone, type: 'phone', mode: 'signup', password: '', devOtp: data?.dev_otp || '' } });
      } else {
        const data = await signupWithEmail(email.trim(), password, politicalParty || undefined, partyPosition || undefined, { ...extra, phone: secondaryPhone || undefined });
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
            {t('auth.createAccount')}
          </h1>
          <p className="mt-3 text-[14px]" style={{ color: '#8b94b8' }}>
            {t('auth.createAccountSub')}
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
              {m === 'email' ? t('auth.email') : t('auth.phone')}
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
              placeholders={[t('auth.enterEmail')]}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); setAuthError(''); }}
              label={t('auth.email')}
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
                label={t('auth.confirmPassword')}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: '' })); }}
                error={errors.confirmPassword}
              />
              {/* Phone mode already collects `phone` as the primary identifier
                  above; email mode has no phone on file at all unless asked
                  here. */}
              <PhoneField
                value={secondaryPhone}
                onChange={(v) => { setSecondaryPhone(v ?? ''); setErrors((p) => ({ ...p, secondaryPhone: '' })); }}
                error={errors.secondaryPhone}
                optional
              />
            </>
          )}

          {/* State → City cascade. City's option list depends on state, so it
              stays disabled (and its own selection cleared) until a state is
              chosen — matching the pattern most address forms use. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#e5e7eb' }}>
                {t('auth.stateLabel')}
              </label>
              <select
                value={state}
                onChange={(e) => handleStateChange(e.target.value)}
                className={`input-field w-full px-4 py-3 rounded-xl text-sm${errors.state ? ' error' : ''}`}
              >
                <option value="">{t('auth.selectState')}</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.state && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.state}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#e5e7eb' }}>
                {t('auth.cityLabel')}
              </label>
              <select
                value={city}
                onChange={(e) => { setCity(e.target.value); setCustomCity(''); setErrors((p) => ({ ...p, city: '' })); }}
                disabled={!state}
                className={`input-field w-full px-4 py-3 rounded-xl text-sm disabled:cursor-not-allowed disabled:opacity-50${errors.city ? ' error' : ''}`}
              >
                <option value="">{state ? t('auth.selectCity') : t('auth.chooseStateFirst')}</option>
                {(CITIES_BY_STATE[state] || []).map((c) => (
                  <option key={c} value={c}>{c === 'Other' ? t('auth.otherCity') : c}</option>
                ))}
              </select>
              {errors.city && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.city}</p>}
            </div>
          </div>

          {city === 'Other' && (
            <input
              type="text"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder={t('auth.customCityPlaceholder')}
              maxLength={100}
              className="input-field w-full px-4 py-3 rounded-xl text-sm"
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: '#e5e7eb' }}>
              {t('auth.dobLabel')}
              <span className="ml-1.5 font-normal" style={{ color: '#5a6e9a' }}>{t('common.optional')}</span>
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="input-field w-full px-4 py-3 rounded-xl text-sm"
            />
          </div>

          {/* Political Party Dropdown */}
          <div ref={partyDropdownRef} className="relative">
            <label className="block mb-1.5 text-sm font-medium" style={{ color: '#c5cde8' }}>
              {t('auth.party')} <span style={{ color: '#ef4444' }}>*</span>
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
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    />
                  )}
                  {partyLabel(politicalParty, lang)}
                </span>
              ) : (
                <span>{t('auth.selectParty')}</span>
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
                    onClick={() => { setPoliticalParty(party.name); setPartyDropdownOpen(false); setPartyLevel(''); setPartyPosition(''); setErrors((p) => ({ ...p, politicalParty: '' })); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{
                      color: politicalParty === party.name ? '#ffffff' : '#c5cde8',
                      backgroundColor: politicalParty === party.name ? '#1a2a5e' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (politicalParty !== party.name) e.currentTarget.style.backgroundColor = '#131f45'; }}
                    onMouseLeave={(e) => { if (politicalParty !== party.name) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {party.logo ? (
                      <img
                        src={party.logo}
                        alt={party.name}
                        className="w-6 h-6 object-contain rounded-sm shrink-0"
                        style={{ background: 'white', padding: '1px' }}
                        // A missing/broken logo should not render as a broken-image icon
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-sm shrink-0 flex items-center justify-center text-xs" style={{ background: '#1e3260' }}>—</span>
                    )}
                    {partyLabel(party.name, lang)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {errors.politicalParty && (
            <p className="text-xs mt-0.5 px-1" style={{ color: '#ef4444' }}>{errors.politicalParty}</p>
          )}

          {/* Position in the party, asked in two steps for the same reason as on
              the profile screen: one list of 41 titles is unreadable, and a
              level is something someone knows about themselves. Optional here,
              since a signup should not be gated on it. */}
          <div className="space-y-1.5">
            <span className="text-xs px-1" style={{ color: '#8b94b8' }}>
              {t('auth.partyPosition')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={partyLevel}
                onChange={(e) => { setPartyLevel(e.target.value); setPartyPosition(''); }}
                disabled={!politicalParty}
                aria-label={t('profile.levelLabel')}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#0d1b3e',
                  border: '1px solid #1e3260',
                  color: partyLevel ? '#ffffff' : '#8b94b8',
                }}
              >
                <option value="">{politicalParty ? t('profile.levelLabel') : t('auth.pickParty')}</option>
                {ROLE_GROUPS.map((g) => (
                  <option key={g.group} value={g.group}>{levelLabel(g.group, lang)}</option>
                ))}
              </select>
              <select
                value={partyPosition}
                onChange={(e) => setPartyPosition(e.target.value)}
                disabled={!partyLevel}
                aria-label={t('profile.positionLabel')}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#0d1b3e',
                  border: '1px solid #1e3260',
                  color: partyPosition ? '#ffffff' : '#8b94b8',
                }}
              >
                <option value="">{partyLevel ? t('profile.positionLabel') : t('auth.pickLevel')}</option>
                {rolesInGroup(partyLevel).map((r) => (
                  <option key={r.id} value={r.id}>{roleLabel(r, politicalParty)}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-md px-1">
            <input type="checkbox" checked={subscribed} onChange={(e) => setSubscribed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer" />
            <span className="text-xs leading-relaxed" style={{ color: '#8b94b8' }}>
              {t('auth.newsletter')}
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
              {t('auth.signupTerms')}{' '}
              <button type="button" onClick={() => setModal('privacy')} className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#6b8aff' }}>
                {t('landing.privacy')}
              </button>
              {' '}{t('auth.andWord')}{' '}
              <button type="button" onClick={() => setModal('terms')} className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#6b8aff' }}>
                {t('landing.terms')}
              </button>
            </span>
          </label>
          {errors.terms && <p className="text-xs mt-0.5 px-1" style={{ color: '#ef4444' }}>{errors.terms}</p>}

          <PrimaryButton type="submit" loading={loading}>
            {loading ? t('auth.pleaseWait') : t('auth.signup')}
          </PrimaryButton>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: '#2a3566' }} />
          <span className="text-xs" style={{ color: '#8b94b8' }}>{t('auth.or')}</span>
          <div className="flex-1 h-px" style={{ backgroundColor: '#2a3566' }} />
        </div>

        <GoogleButton
          onSuccess={handleGoogle}
          onError={() => setAuthError(t('auth.googleFailed'))}
          disabled={loading}
          beforeLogin={validateForGoogle}
        />

        <p className="text-center text-sm" style={{ color: '#8b94b8' }}>
          {t('auth.alreadyAccount')}{' '}
          <Link to="/login" className="underline underline-offset-2 hover:opacity-80 transition-opacity font-medium" style={{ color: '#6b8aff' }}>
            {t('auth.login')}
          </Link>
        </p>
      </div>
      {modal && <LegalModal type={modal} onClose={() => setModal(null)} />}
    </AuthLayout>
  );
}

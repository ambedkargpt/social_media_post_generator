import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
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
import { partyHasQuestions } from '../utils/partyQuestions';

/**
 * Sign-up in three steps: the account, where you are, and party & role.
 *
 * It was one long column - account, location, party, role, a warning panel
 * and two checkboxes at once - which is a lot to look at before anyone has
 * agreed to anything, and on a phone a page scrolled through twice to find
 * what was still empty. The flow follows the Neela Press redesign; the look
 * stays the app's own.
 *
 * All state lives here, not per step, so Back never loses what was typed.
 * Validation runs per step, so the first thing missing is the first thing
 * pointed at. The API calls and the OTP hand-off are unchanged.
 */
const STEP_KEYS = ['signup.s1', 'signup.s2', 'signup.s3'];

export default function Signup() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { signupWithEmail, signupWithPhone, loginWithGoogle } = useAuth();

  const [step, setStep]                       = useState(1);
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
  // Party and position cannot be changed later; this is the reader saying
  // they have seen that, separately from accepting the terms.
  const [understood, setUnderstood]           = useState(false);
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

  function validateStep(n) {
    const e = {};
    if (n === 1) {
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
    }
    if (n === 2) {
      if (!state) e.state = t('auth.stateRequired');
      if (!city)  e.city = t('auth.cityRequired');
      else if (city === 'Other' && !customCity.trim()) e.city = t('auth.cityRequired');
    }
    if (n === 3) {
      if (!politicalParty) e.politicalParty = t('auth.pickPartyFirst');
      // A party whose preference questions are written per position needs
      // one; without it the account would be stopped at profile setup anyway.
      else if (partyHasQuestions(politicalParty) && !partyPosition) e.partyPosition = t('profile.positionRequired');
      if (!understood)     e.understood = t('signup.confirmRequired');
      if (!termsAccepted)  e.terms = 'You must accept the Terms of Service and Privacy Policy.';
    }
    return e;
  }

  function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setAuthError('');
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Enter on steps 1 and 2 moves on rather than submitting half a form.
    if (step < 3) { goNext(); return; }
    // Every step again, and back to the first one that is incomplete.
    for (const n of [1, 2, 3]) {
      const errs = validateStep(n);
      if (Object.keys(errs).length) { setErrors(errs); setStep(n); return; }
    }
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

        {/* Where the reader is: three named steps, the current one lit and
            the finished ones ticked, and a bar that fills as they go. */}
        <div>
          <p className="text-[12px] font-medium" style={{ color: '#8b94b8' }}>
            {t('signup.step', { n: step })}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-1 rounded-full" style={{ backgroundColor: n <= step ? '#3a7bff' : '#1e3260' }} />
            ))}
          </div>
          <ol className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            {STEP_KEYS.map((key, i) => (
              <li
                key={key}
                aria-current={i + 1 === step ? 'step' : undefined}
                className="flex items-center gap-1"
                style={{ color: i + 1 === step ? '#ffffff' : i + 1 < step ? '#6b8aff' : '#5a6e9a', fontWeight: i + 1 === step ? 600 : 400 }}
              >
                {i + 1 < step && <Check size={12} strokeWidth={3} />}
                {t(key)}
              </li>
            ))}
          </ol>
        </div>

        {authError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {step === 1 && (
            <>
              <GoogleButton
                onSuccess={handleGoogle}
                onError={() => setAuthError(t('auth.googleFailed'))}
                disabled={loading}
              />
              {/* Google skips the checkbox on step 3, so the agreement is stated
                  where that path starts instead. */}
              <p className="-mt-1 text-center text-[11.5px] leading-relaxed" style={{ color: '#5a6e9a' }}>
                {t('auth.googleTerms')}{' '}
                <button type="button" onClick={() => setModal('privacy')} className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6b8aff' }}>
                  {t('landing.privacy')}
                </button>
                {' '}{t('auth.andWord')}{' '}
                <button type="button" onClick={() => setModal('terms')} className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6b8aff' }}>
                  {t('landing.terms')}
                </button>
              </p>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: '#2a3566' }} />
                <span className="text-xs" style={{ color: '#8b94b8' }}>{t('auth.or')}</span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#2a3566' }} />
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
            </>
          )}

          {step === 2 && (
            <>
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
            </>
          )}

          {step === 3 && (
            <>
              {/* Both fields below are set once and then fixed, so the warning
                  comes before them rather than after a save is refused. Same
                  reasoning as the profile screen, which carries the same note. */}
              <div
                className="flex gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: 'rgba(240,160,75,0.08)', border: '1px solid rgba(240,160,75,0.28)' }}
              >
                <AlertTriangle size={15} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: '#f0b877' }} />
                <div>
                  <p className="text-[12.5px] font-semibold" style={{ color: '#f0b877' }}>
                    {t('profile.lockWarning.title')}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#c0cde8' }}>
                    {t('profile.lockWarning.body')}
                  </p>
                </div>
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
                  level is something someone knows about themselves. Required for a
                  party whose preference questions are written per position. */}
              <div className="space-y-1.5">
                <span className="text-xs px-1" style={{ color: '#8b94b8' }}>
                  {t('auth.partyPosition')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={partyLevel}
                    onChange={(e) => { setPartyLevel(e.target.value); setPartyPosition(''); setErrors((p) => ({ ...p, partyPosition: '' })); }}
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
                    onChange={(e) => { setPartyPosition(e.target.value); setErrors((p) => ({ ...p, partyPosition: '' })); }}
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
                      <option key={r.id} value={r.id}>{roleLabel(r, politicalParty, lang)}</option>
                    ))}
                  </select>
                </div>
                {errors.partyPosition && (
                  <p className="text-xs mt-0.5 px-1" style={{ color: '#ef4444' }}>{errors.partyPosition}</p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer rounded-md px-1">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => { setUnderstood(e.target.checked); setErrors((p) => ({ ...p, understood: '' })); }}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer shrink-0"
                />
                <span className="text-xs leading-relaxed" style={{ color: '#c0cde8' }}>{t('signup.confirm')}</span>
              </label>
              {errors.understood && <p className="text-xs mt-0.5 px-1" style={{ color: '#ef4444' }}>{errors.understood}</p>}

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
            </>
          )}

          <div className="flex gap-3 pt-1">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition hover:text-white"
                style={{ border: '1px solid #1e3260', color: '#c5cde8' }}
              >
                <ArrowLeft size={15} strokeWidth={2} />
                {t('common.back')}
              </button>
            )}
            <div className="flex-1">
              {step < 3 ? (
                <PrimaryButton type="button" onClick={goNext}>
                  <span className="inline-flex items-center gap-2">{t('common.next')} <ArrowRight size={15} strokeWidth={2.2} /></span>
                </PrimaryButton>
              ) : (
                <PrimaryButton type="submit" loading={loading}>
                  {loading ? t('auth.pleaseWait') : t('auth.signup')}
                </PrimaryButton>
              )}
            </div>
          </div>
        </form>

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

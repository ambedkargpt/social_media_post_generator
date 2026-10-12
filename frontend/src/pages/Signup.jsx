import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { isValidPhoneNumber } from 'react-phone-number-input';

import { useAuth, friendlyError } from '../context/AuthContext';
import { useCurtain } from '../context/CurtainContext';
import AuthLayout from '../components/AuthLayout';
import PasswordInput from '../components/PasswordInput';
import PhoneField from '../components/PhoneField';
import GoogleButton from '../components/GoogleButton';
import LegalModal from '../components/LegalModal';
import {
  Button, Chakra, Field, Input, Select, UnderlineTabs,
} from '../components/np';

import { POLITICAL_PARTIES } from '../utils/politicalParties';
import { ROLE_GROUPS, roleLabel, rolesInGroup } from '../utils/partyRoles';
import { INDIAN_STATES, CITIES_BY_STATE } from '../utils/indianStatesCities';
import { useI18n } from '../i18n/index.jsx';
import { partyLabel, levelLabel } from '../utils/displayLabel';

/**
 * Phase 3 of docs/redesign/neela-press.md.
 *
 * One route, three steps. It was one long column before - account, location,
 * party, roles, a warning panel and two checkboxes, all at once - which is a
 * lot to look at before anyone has agreed to anything, and on a phone it was
 * a page you scrolled through twice to find what was still empty.
 *
 * The state is all held here rather than per step, so Back never loses what
 * was typed. Validation runs per step, so the first thing missing is the
 * first thing pointed at.
 *
 * The API calls, the Google path and the OTP navigation are unchanged.
 */

const STEP_KEYS = ['np.signup.s1', 'np.signup.s2', 'np.signup.s3'];

export default function Signup() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { signupWithEmail, signupWithPhone, loginWithGoogle } = useAuth();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState('forward');

  const [mode, setMode] = useState('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Secondary phone, collected only in email mode - phone mode already has
  // `phone` above as the primary identifier.
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [state, setState] = useState('');
  // Holds a known city name or the literal 'Other'; `customCity` is the free
  // text typed when the list does not have theirs, so a mandatory field never
  // blocks someone whose town is not in it.
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [politicalParty, setPoliticalParty] = useState('');
  const [partyLevel, setPartyLevel] = useState('');
  const [partyPosition, setPartyPosition] = useState('');
  const [modal, setModal] = useState(null);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // The city list depends on the state, so switching states leaves a
  // selection from the old list dangling if it is not cleared here.
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
        if (!email.trim()) e.email = t('auth.emailRequired');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t('auth.emailInvalid');
        if (!password) e.password = t('auth.passwordRequired');
        else if (password.length < 8) e.password = t('auth.passwordMinLen');
        if (!confirmPassword) e.confirmPassword = t('auth.confirmPasswordRequired');
        else if (confirmPassword !== password) e.confirmPassword = t('auth.passwordMismatch');
        // Optional, but if given it has to actually be a phone number.
        if (secondaryPhone && !isValidPhoneNumber(secondaryPhone)) {
          e.secondaryPhone = t('auth.phoneInvalid');
        }
      } else {
        if (!phone) e.phone = t('auth.phoneRequired');
        else if (!isValidPhoneNumber(phone)) e.phone = t('auth.phoneInvalid');
      }
    }
    if (n === 2) {
      if (!state) e.state = t('auth.stateRequired');
      if (!city) e.city = t('auth.cityRequired');
      else if (city === 'Other' && !customCity.trim()) e.city = t('auth.cityRequired');
    }
    if (n === 3) {
      if (!politicalParty) e.politicalParty = t('auth.pickPartyFirst');
      if (!termsAccepted) e.terms = t('auth.termsRequired');
    }
    return e;
  }

  function goNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setDir('forward');
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setErrors({});
    setDir('back');
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = { ...validateStep(1), ...validateStep(2), ...validateStep(3) };
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Send the reader to the step that is actually incomplete rather than
      // showing an error about a field three screens back.
      if (validateStep(1).email || validateStep(1).phone || validateStep(1).password) setStep(1);
      else if (validateStep(2).state || validateStep(2).city) setStep(2);
      return;
    }
    setErrors({});
    setAuthError('');
    setLoading(true);
    try {
      const resolvedCity = city === 'Other' ? customCity.trim() : city;
      const extra = { state, city: resolvedCity, dateOfBirth: dob || undefined };
      if (mode === 'phone') {
        const data = await signupWithPhone(
          phone, politicalParty || undefined, partyPosition || undefined, extra,
        );
        navigate('/otp', {
          state: {
            identifier: data?.otp_target || phone,
            type: 'phone', mode: 'signup', password: '', devOtp: data?.dev_otp || '',
          },
        });
      } else {
        const data = await signupWithEmail(
          email.trim(), password, politicalParty || undefined, partyPosition || undefined,
          { ...extra, phone: secondaryPhone || undefined },
        );
        navigate('/otp', {
          state: {
            identifier: email.trim(), type: 'email', mode: 'signup',
            password, devOtp: data?.dev_otp || '',
          },
        });
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

  const cities = CITIES_BY_STATE[state] || [];

  return (
    <AuthLayout
      wide
      footer={(
        <p style={{ margin: 0 }}>
          {t('auth.alreadyAccount')}{' '}
          <Link to="/login" style={{ color: 'var(--color-np-neela-300)', fontWeight: 600 }}>
            {t('np.auth.login')}
          </Link>
        </p>
      )}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div>
          <h1 className="np-auth-h1 np-display" style={{ fontSize: 44 }}>
            {t('auth.createAccount')}
          </h1>
          <div className="np-steps" style={{ marginTop: 16 }}>
            <Chakra size={40} mode="progress" value={step / 3} className="np-kit-neela" />
            <div>
              <p className="np-mono" style={{ margin: 0, fontSize: 13, color: 'var(--color-np-muted)' }}>
                {t('np.signup.step', { n: step })}
              </p>
              <p className="np-steps-names" style={{ margin: '4px 0 0' }}>
                {STEP_KEYS.map((key, i) => (
                  <span
                    key={key}
                    className={i + 1 === step ? 'is-current' : i + 1 < step ? 'is-done' : ''}
                  >
                    {i + 1 < step && <Check size={13} strokeWidth={3} style={{ marginInlineEnd: 3 }} />}
                    {t(key)}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>

        {authError && (
          <p className="np-alert" role="alert" style={{ margin: 0 }}>
            <TriangleAlert size={18} strokeWidth={2} style={{ flex: 'none', marginTop: 1 }} />
            <span>{authError}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Keyed on the step so the animation restarts on each move. */}
          <div key={step} className="np-step" data-dir={dir} style={{ display: 'grid', gap: 18 }}>

            {step === 1 && (
              <>
                <GoogleButton onSuccess={handleGoogle} disabled={loading} />
                <p className="np-or" style={{ margin: 0 }}>{t('auth.or')}</p>

                <UnderlineTabs
                  ariaLabel={t('auth.createAccount')}
                  value={mode}
                  onChange={switchMode}
                  options={[
                    { value: 'phone', label: t('auth.phone') },
                    { value: 'email', label: t('auth.email') },
                  ]}
                />

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
                        type="email" autoComplete="email" placeholder="you@example.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        error={!!errors.email}
                      />
                    </Field>
                    <PasswordInput
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      error={errors.password}
                      autoComplete="new-password"
                    />
                    <PasswordInput
                      label={t('auth.confirmPassword')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      error={errors.confirmPassword}
                      autoComplete="new-password"
                    />
                    <PhoneField
                      value={secondaryPhone}
                      onChange={setSecondaryPhone}
                      error={errors.secondaryPhone}
                      optional
                    />
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <Field label={t('auth.stateLabel')} error={errors.state}>
                  <Select
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    error={!!errors.state}
                  >
                    <option value="" disabled>{t('auth.selectState')}</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>

                <Field label={t('auth.cityLabel')} error={errors.city}>
                  <Select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    error={!!errors.city}
                    // A city list with no state behind it is a list of
                    // nothing, so the control says so rather than opening
                    // empty.
                    disabled={!state}
                  >
                    <option value="" disabled>{t('auth.selectCity')}</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">{t('auth.otherCity')}</option>
                  </Select>
                </Field>

                {city === 'Other' && (
                  <Field label={t('auth.otherCity')} error={errors.city}>
                    <Input
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      error={!!errors.city}
                    />
                  </Field>
                )}

                <Field label={t('auth.dobLabel')} hint={t('common.optional')}>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--color-np-text-2)' }}>
                    {t('auth.party')}
                  </p>
                  {/* Only the parties with a corpus behind them, which today
                      is two. Offering the rest would promise a voice the
                      product cannot write in yet. */}
                  <div className="np-party-grid" role="radiogroup" aria-label={t('auth.party')}>
                    {POLITICAL_PARTIES.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        role="radio"
                        aria-checked={politicalParty === p.name}
                        onClick={() => {
                          setPoliticalParty(p.name);
                          setPartyLevel('');
                          setPartyPosition('');
                          setErrors((prev) => ({ ...prev, politicalParty: '' }));
                        }}
                        className="np-party-card"
                      >
                        {politicalParty === p.name && (
                          <span className="np-party-check" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                        <img src={p.logo} alt="" aria-hidden="true" />
                        <span className="np-party-card-name">{p.name}</span>
                        <span className="np-party-card-sub" lang={lang === 'en' ? 'hi' : 'en'}>
                          {partyLabel(p.name, lang === 'en' ? 'hi' : 'en')}
                        </span>
                      </button>
                    ))}
                  </div>
                  {errors.politicalParty && (
                    <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-np-critical)' }}>
                      {errors.politicalParty}
                    </p>
                  )}
                </div>

                {politicalParty && (
                  <>
                    <Field label={t('profile.levelLabel')} hint={t('common.optional')}>
                      <Select
                        value={partyLevel}
                        onChange={(e) => { setPartyLevel(e.target.value); setPartyPosition(''); }}
                      >
                        <option value="">{t('auth.pickLevel')}</option>
                        {ROLE_GROUPS.map((g) => (
                          <option key={g} value={g}>{levelLabel(g, lang)}</option>
                        ))}
                      </Select>
                    </Field>

                    {partyLevel && (
                      <Field label={t('auth.partyPosition')} hint={t('common.optional')}>
                        <Select
                          value={partyPosition}
                          onChange={(e) => setPartyPosition(e.target.value)}
                        >
                          <option value="">{t('auth.pickParty')}</option>
                          {rolesInGroup(partyLevel).map((r) => (
                            <option key={r} value={r}>{roleLabel(r, politicalParty, lang)}</option>
                          ))}
                        </Select>
                      </Field>
                    )}
                  </>
                )}

                {/* The one thing on this screen that cannot be undone later,
                    so it is the one thing that gets its own panel. */}
                <div className="np-confirm">
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-np-brass)' }}>
                    {t('profile.lockWarning.title')}
                  </p>
                  <p style={{ margin: 0 }}>{t('profile.lockWarning.body')}</p>
                  <label className="np-check">
                    <input
                      type="checkbox"
                      checked={understood}
                      onChange={(e) => setUnderstood(e.target.checked)}
                    />
                    <span>{t('np.signup.confirm')}</span>
                  </label>
                </div>

                <label className="np-check">
                  <input
                    type="checkbox"
                    checked={subscribed}
                    onChange={(e) => setSubscribed(e.target.checked)}
                  />
                  <span>{t('auth.newsletter')}</span>
                </label>

                <label className="np-check">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      setErrors((p) => ({ ...p, terms: '' }));
                    }}
                  />
                  <span>
                    {t('auth.signupTerms')}{' '}
                    <button
                      type="button"
                      onClick={() => setModal('terms')}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-np-neela-300)', font: 'inherit' }}
                    >
                      {t('landing.terms')}
                    </button>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => setModal('privacy')}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-np-neela-300)', font: 'inherit' }}
                    >
                      {t('landing.privacy')}
                    </button>
                  </span>
                </label>
                {errors.terms && (
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--color-np-critical)' }}>
                    {errors.terms}
                  </p>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {step > 1 && (
              <Button variant="secondary" size="lg" onClick={goBack} iconLeft={ArrowLeft}>
                {t('np.common.back')}
              </Button>
            )}
            {step < 3 ? (
              <Button size="lg" onClick={goNext} iconRight={ArrowRight} fullWidth={step === 1}>
                {t('np.common.next')}
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                loading={loading}
                // Both boxes, not one: the warning panel is there to be read,
                // and terms are a separate agreement.
                disabled={!understood || !termsAccepted}
                iconRight={ArrowRight}
                style={{ flex: 1 }}
              >
                {t('auth.createAccount')}
              </Button>
            )}
          </div>
        </form>
      </div>

      {modal && <LegalModal type={modal} onClose={() => setModal(null)} />}
    </AuthLayout>
  );
}

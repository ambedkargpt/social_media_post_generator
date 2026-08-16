import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, AtSign, ArrowRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurtain } from '../context/CurtainContext';
import { POLITICAL_PARTIES } from '../utils/politicalParties';
import logoSrc     from '../assets/images/logo-animation.png';
import ambedkarSrc from '../assets/images/qna-ambedkar.png';

function FieldInput({ icon: Icon, label, placeholder, value, onChange, error, hint, maxLength }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium" style={{ color: '#c5cde8' }}>
        {label}
      </label>
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
        style={{
          backgroundColor: '#0a1128',
          border: `1px solid ${error ? '#ef4444' : focused ? '#4a6fa5' : '#1e3260'}`,
          boxShadow: focused ? '0 0 0 3px rgba(63,159,255,0.08)' : 'none',
        }}
      >
        <Icon size={16} style={{ color: focused ? '#3f9fff' : '#4a5e8a', flexShrink: 0 }} strokeWidth={1.8} />
        <input
          type="text"
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-[#4a5e8a]"
        />
        {maxLength && (
          <span className="text-[11px] shrink-0" style={{ color: '#3a4e72' }}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {error && <p className="text-[12px]" style={{ color: '#ef4444' }}>{error}</p>}
      {hint && !error && <p className="text-[12px]" style={{ color: '#5a6e9a' }}>{hint}</p>}
    </div>
  );
}

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { currentUser, updateProfile } = useAuth();

  const [fullName, setFullName]   = useState(currentUser?.full_name || '');
  // Onboarding sends the user on to the questionnaire; someone editing an
  // existing profile from the sidebar should land back on the dashboard
  // instead of being pushed through onboarding again.
  const isOnboarding = !currentUser?.full_name;
  const nextRoute = isOnboarding ? '/questionnaire' : '/dashboard';
  const [username, setUsername]   = useState(currentUser?.username || '');
  const [politicalParty, setPoliticalParty] = useState(currentUser?.political_party || '');
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [authError, setAuthError] = useState('');

  function validate() {
    const e = {};
    if (!fullName.trim())          e.fullName = 'Please enter your name.';
    else if (fullName.trim().length < 2) e.fullName = 'Name must be at least 2 characters.';
    if (!username.trim())          e.username = 'Username is required.';
    else if (username.trim().length < 3) e.username = 'Username must be at least 3 characters.';
    else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) e.username = 'Only letters, numbers and underscores.';
    if (!politicalParty) e.politicalParty = 'Please select a political party.';
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
      await updateProfile({
        full_name: fullName.trim(),
        username: username.trim(),
        political_party: politicalParty || undefined,
      });
      curtainGo(nextRoute, { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '';
      if (detail.toLowerCase().includes('already taken') || detail.toLowerCase().includes('already exists')) {
        setErrors({ username: 'This username is already taken. Try another.' });
      } else {
        setAuthError('Could not save your profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    curtainGo(nextRoute, { replace: true });
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'linear-gradient(160deg,#0d1535 0%,#080e22 100%)' }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none fixed -left-48 -top-48 h-[500px] w-[500px] rounded-full bg-[#1e4fb5]/15 blur-[130px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#3f9fff]/10 blur-[120px]" />
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[#7b5cff]/5 blur-[140px]" />

      {/* Top nav */}
      <header className="relative z-10 flex items-center px-8 pt-7 md:px-14">
        <div className="flex items-center gap-2.5">
          <img src={logoSrc} alt="AmbedkarGPT" className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(63,159,255,0.5)]" />
          <span className="font-display text-[20px] font-bold leading-none tracking-tight">
            <span className="text-white">Ambedkar</span>
            <span className="gradient-text-cyan">GPT</span>
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-12 pt-6">
        {/* Ambedkar image */}
        <div className="relative flex items-center justify-center mb-8">
          <div
            className="absolute h-[220px] w-[220px] rounded-full blur-[60px]"
            style={{ background: 'radial-gradient(circle, rgba(63,159,255,0.22) 0%, rgba(123,92,255,0.10) 55%, transparent 75%)' }}
          />
          <img
            src={ambedkarSrc}
            alt="Dr. B.R. Ambedkar"
            className="relative z-10 w-[140px] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)] md:w-[160px]"
          />
        </div>

        {/* Card */}
        <div
          className="w-full max-w-[480px] rounded-2xl p-8"
          style={{
            background: 'rgba(10,17,40,0.7)',
            border: '1px solid rgba(30,50,96,0.6)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          }}
        >
          {/* Step badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'rgba(63,159,255,0.1)', border: '1px solid rgba(63,159,255,0.2)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff]" />
            <span className="text-[11px] font-medium tracking-wide" style={{ color: '#6baaff' }}>{isOnboarding ? 'PROFILE SETUP' : 'YOUR PROFILE'}</span>
          </div>

          <h1 className="font-display text-[28px] font-bold leading-tight text-white md:text-[32px]">
            {isOnboarding ? 'Tell us your name' : 'Edit your profile'}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: '#7a8db5' }}>
            {isOnboarding
              ? 'This will be shown on your profile and posts. You can change it later.'
              : 'Your name, handle and party. Your party decides which news feed you see.'}
          </p>

          {authError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <FieldInput
              icon={User}
              label="Full Name"
              placeholder="e.g. Rajesh Kumar"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: '' })); }}
              error={errors.fullName}
              maxLength={100}
            />
            <FieldInput
              icon={AtSign}
              label="Username"
              placeholder="your_handle"
              value={username}
              onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setErrors((p) => ({ ...p, username: '' })); }}
              error={errors.username}
              hint="Only letters, numbers and underscores. Shown as @username."
              maxLength={50}
            />

            {/* Party affiliation — decides which news feed the user sees */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white">
                Political party you support
              </label>
              <div className="relative">
                <select
                  value={politicalParty}
                  onChange={(e) => { setPoliticalParty(e.target.value); setErrors((p) => ({ ...p, politicalParty: '' })); }}
                  className="w-full appearance-none rounded-xl px-4 py-3.5 pr-10 text-[14px] outline-none transition"
                  style={{
                    backgroundColor: '#0a1130',
                    border: `1px solid ${errors.politicalParty ? '#ef4444' : '#1e3260'}`,
                    color: politicalParty ? '#ffffff' : '#8b94b8',
                  }}
                >
                  <option value="" className="bg-[#0a1130]">Select a political party</option>
                  {POLITICAL_PARTIES.map((p) => (
                    <option key={p.name} value={p.name} className="bg-[#0a1130] text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#8b94b8' }}
                />
              </div>
              {errors.politicalParty
                ? <p className="mt-1.5 text-[12px]" style={{ color: '#ef4444' }}>{errors.politicalParty}</p>
                : <p className="mt-1.5 text-[12px]" style={{ color: '#5a6e9a' }}>Your news feed is tailored to this choice.</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-[14px] font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              style={{
                background: 'linear-gradient(90deg, #0a7dff, #3a9fff)',
                boxShadow: '0 4px 20px rgba(17,122,255,0.35)',
              }}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </>
              ) : (
                <>
                  {isOnboarding ? 'Continue' : 'Save changes'}
                  <ArrowRight size={15} strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={handleSkip}
            className="mt-4 w-full py-2 text-center text-[13px] transition-opacity hover:opacity-100"
            style={{ color: '#4a5e8a', opacity: 0.7 }}
          >
            {isOnboarding ? 'Skip for now' : 'Cancel'}
          </button>
        </div>

        {/* Step indicators */}
        <div className="mt-6 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === 0 ? 20 : 6,
                height: 6,
                background: i === 0 ? '#3f9fff' : 'rgba(63,159,255,0.2)',
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: '#3a4e72' }}>Step 1 of 3</p>
      </main>
    </div>
  );
}

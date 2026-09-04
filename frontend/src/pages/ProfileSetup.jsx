import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, AtSign, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurtain } from '../context/CurtainContext';
import { POLITICAL_PARTIES } from '../utils/politicalParties';
import { ROLE_GROUPS, roleLabel, groupForId, rolesInGroup } from '../utils/partyRoles';
import logoSrc     from '../assets/images/logo-animation.png';
import ambedkarSrc from '../assets/images/qna-ambedkar.png';
import { useI18n } from '../i18n/index.jsx';
import { partyLabel, levelLabel } from '../utils/displayLabel';

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
  const { t, lang } = useI18n();
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
  const [partyPosition, setPartyPosition] = useState(currentUser?.party_position || '');
  // Derived from the saved position so reopening the form lands on the level
  // already chosen, rather than asking someone to find it again.
  const [partyLevel, setPartyLevel] = useState(() => groupForId(currentUser?.party_position || ''));

  function handleLevelChange(level) {
    setPartyLevel(level);
    // The old position belongs to the old level, so keeping it would leave the
    // two selects disagreeing about what was chosen.
    setPartyPosition('');
  }
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [authError, setAuthError] = useState('');

  function validate() {
    const e = {};
    if (!fullName.trim())          e.fullName = 'Please enter your name.';
    else if (fullName.trim().length < 2) e.fullName = 'Name must be at least 2 characters.';
    if (!username.trim())          e.username = 'Username is required.';
    else if (username.trim().length < 3) e.username = 'Username must be at least 3 characters.';
    else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) e.username = t('profile.usernameRule');
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
        // Sent even when blank, because clearing the position is a real choice
        // and undefined would leave the previous one in place.
        party_position: partyPosition,
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
      {/* The only way out used to be a Cancel link under the form, below the
          fold on a laptop, so the page read as a dead end. Editing offers a way
          back at the top; onboarding does not, because a new account has no
          dashboard to return to and an exit there would strand the sign-up. */}
      <header className="relative z-10 flex items-center gap-4 px-8 pt-7 md:px-14">
        {isOnboarding ? (
          <>
            <div className="flex items-center gap-2.5">
              <img src={logoSrc} alt="AmbedkarGPT" className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(63,159,255,0.5)]" />
              <span className="font-display text-[20px] font-bold leading-none tracking-tight">
                <span className="text-white">{t('brand.ambedkar')}</span>
                <span className="gradient-text-cyan">GPT</span>
              </span>
            </div>
            {/* Onboarding gets a skip rather than a back: there is nothing
                behind this screen, signup is already done. It sits up here
                because the only other exit is under the form, and the level
                and position selects pushed that below the fold. */}
            <button
              type="button"
              onClick={handleSkip}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-[#1e3260]/70 px-4 text-[13px] font-medium text-[#8b9dc4] transition hover:border-[#3a6bc4]/70 hover:text-white"
            >
              {t('profile.skip')}
              <ArrowRight size={15} strokeWidth={2} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSkip}
              aria-label={t('profile.backToDash')}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1e3260]/70 px-4 text-[13px] font-medium text-[#8b9dc4] transition hover:border-[#3a6bc4]/70 hover:text-white"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              <span className="hidden sm:inline">{t('common.back')}</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
              aria-label="Back to dashboard"
            >
              <img src={logoSrc} alt="" className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(63,159,255,0.5)]" />
              <span className="font-display text-[20px] font-bold leading-none tracking-tight">
                <span className="text-white">{t('brand.ambedkar')}</span>
                <span className="gradient-text-cyan">GPT</span>
              </span>
            </button>
          </>
        )}
      </header>

      {/* Main
          Two columns from lg up: portrait left, form right. Stacked, the
          portrait was a small image floating above a card with a lot of empty
          space either side of it, and giving it a column of its own is what
          lets it be large enough to read as a portrait rather than a thumbnail. */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-12 pt-6">
        <div className="grid w-full max-w-[1140px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16">

          {/* Left: portrait */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-[340px] w-[340px] rounded-full blur-[80px] lg:h-[540px] lg:w-[540px] lg:blur-[100px]"
              style={{ background: 'radial-gradient(circle, rgba(63,159,255,0.22) 0%, rgba(123,92,255,0.10) 55%, transparent 75%)' }}
            />
            <img
              src={ambedkarSrc}
              alt="Dr. B.R. Ambedkar"
              className="relative z-10 w-[230px] object-contain drop-shadow-[0_20px_56px_rgba(0,0,0,0.6)] sm:w-[300px] lg:w-[460px]"
            />
          </div>

          {/* Right: form */}
          <div className="flex w-full flex-col items-center">

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
            <span className="text-[11px] font-medium tracking-wide" style={{ color: '#6baaff' }}>{isOnboarding ? t('profile.setupCaps') : t('profile.yourProfile')}</span>
          </div>

          <h1 className="font-display text-[28px] font-bold leading-tight text-white md:text-[32px]">
            {isOnboarding ? t('profile.tellName') : t('profile.editProfile')}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: '#7a8db5' }}>
            {isOnboarding ? t('profile.onboardHint') : t('profile.editHint')}
          </p>

          {authError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <FieldInput
              icon={User}
              label={t('profile.fullNameLabel')}
              placeholder="e.g. Rajesh Kumar"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: '' })); }}
              error={errors.fullName}
              maxLength={100}
            />
            <FieldInput
              icon={AtSign}
              label={t('profile.usernameLabel')}
              placeholder="your_handle"
              value={username}
              onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setErrors((p) => ({ ...p, username: '' })); }}
              error={errors.username}
              hint={t('profile.usernameHint')}
              maxLength={50}
            />

            {/* Party affiliation — decides which news feed the user sees */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white">
                {t('profile.partySupport')}
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
                  <option value="" className="bg-[#0a1130]">{t('profile.selectParty')}</option>
                  {POLITICAL_PARTIES.map((p) => (
                    <option key={p.name} value={p.name} className="bg-[#0a1130] text-white">
                      {partyLabel(p.name, lang)}
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
                : <p className="mt-1.5 text-[12px]" style={{ color: '#5a6e9a' }}>{t('profile.feedTailored')}</p>}
            </div>

            {/* Position in the party, asked in two steps. One list of 41 titles
                was accurate and unreadable: someone new does not know whether a
                Zila Mahamantri is above or below a Mandal Adhyaksh, but they do
                know which level they work at. Titles differ between parties for
                the same post, so the options are relabelled from the party
                above. Optional throughout: a supporter with no office is a
                legitimate answer. */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white">
                {t('profile.positionInParty')}
                <span className="ml-1.5 font-normal" style={{ color: '#5a6e9a' }}>(optional)</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <select
                    value={partyLevel}
                    onChange={(e) => handleLevelChange(e.target.value)}
                    disabled={!politicalParty}
                    aria-label={t('profile.levelLabel')}
                    className="w-full appearance-none rounded-xl px-4 py-3.5 pr-10 text-[14px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: '#0a1130',
                      border: '1px solid #1e3260',
                      color: partyLevel ? '#ffffff' : '#8b94b8',
                    }}
                  >
                    <option value="" className="bg-[#0a1130]">
                      {politicalParty ? t('profile.levelLabel') : t('profile.chooseParty')}
                    </option>
                    {ROLE_GROUPS.map((g) => (
                      <option key={g.group} value={g.group} className="bg-[#0a1130] text-white">
                        {levelLabel(g.group, lang)}
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

                <div className="relative">
                  <select
                    value={partyPosition}
                    onChange={(e) => setPartyPosition(e.target.value)}
                    disabled={!partyLevel}
                    aria-label={t('profile.positionLabel')}
                    className="w-full appearance-none rounded-xl px-4 py-3.5 pr-10 text-[14px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: '#0a1130',
                      border: '1px solid #1e3260',
                      color: partyPosition ? '#ffffff' : '#8b94b8',
                    }}
                  >
                    <option value="" className="bg-[#0a1130]">
                      {partyLevel ? t('profile.positionLabel') : t('profile.pickLevelFirst')}
                    </option>
                    {rolesInGroup(partyLevel).map((r) => (
                      <option key={r.id} value={r.id} className="bg-[#0a1130] text-white">
                        {roleLabel(r, politicalParty)}
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
              </div>

              <p className="mt-1.5 text-[12px]" style={{ color: '#5a6e9a' }}>
                {t('profile.positionHint')}
              </p>
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
                  {isOnboarding ? t('common.next') : t('profile.saveChanges')}
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
            {isOnboarding ? t('profile.skip') : t('common.cancel')}
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
        <p className="mt-2 text-[11px]" style={{ color: '#3a4e72' }}>{t('profile.stepOf')}</p>

          </div>
        </div>
      </main>
    </div>
  );
}

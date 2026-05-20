import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Save, Home, ArrowUp } from 'lucide-react';
import logoSrc from '../assets/images/logo-animation.png';
import { useAuth } from '../context/AuthContext';
import { saveProfileAnswers, getProfileAnswers } from '../api/profile';

// ─── Question data ────────────────────────────────────────────────────────────

const COMPULSORY = [
  {
    id: 'profile_user_role',
    label: 'Which role best reflects how you engage with social or political issues?',
    options: ['Mobilizer', 'Analyst', 'Communicator', 'Community Leader', 'Learner'],
  },
  {
    id: 'profile_tone',
    label: 'What tone should be strictly followed?',
    options: ['Assertive', 'Analytical', 'Confrontational', 'Empathetic', 'Hopeful'],
  },
  {
    id: 'profile_target_audience',
    label: 'Who is the primary audience?',
    options: ['General Public', 'Affected Communities', 'Youth / Students', 'Policymakers', 'Opposing Groups'],
  },
  {
    id: 'profile_primary_focus',
    label: 'What should the content focus on most?',
    options: ['Historical Context', 'Current Event', 'Policy Critique', 'Human Impact', 'Systemic Analysis'],
  },
  {
    id: 'profile_ambedkarite_perspective',
    label: 'Which ideological lens should guide interpretation?',
    options: ['Radical Anti-Caste', 'Constitutional', 'Buddhist', 'Caste + Class', 'Human Rights'],
  },
  {
    id: 'profile_language',
    label: 'What language style should be used?',
    options: ['English', 'Hindi', 'Regional', 'Hinglish', 'Adaptive'],
  },
  {
    id: 'profile_formality_level',
    label: 'What writing style should be enforced?',
    options: ['Formal', 'Semi-formal', 'Conversational', 'Informal', 'Raw'],
  },
  {
    id: 'profile_call_to_action',
    label: 'What type of ending should be enforced?',
    options: ['Action', 'Institutional', 'Awareness', 'Reflective', 'None'],
  },
  {
    id: 'profile_intersectionality',
    label: 'How should intersectionality be handled?',
    options: ['Strong', 'Moderate', 'Light', 'Focused', 'None'],
  },
  {
    id: 'profile_target_platform',
    label: 'Where will the content be posted?',
    options: ['Twitter / X', 'Instagram', 'LinkedIn', 'Facebook', 'Messaging Apps'],
  },
  {
    id: 'profile_regional_context',
    label: 'What geographical framing should be used?',
    options: ['Local', 'National', 'Global', 'Mixed', 'Neutral'],
  },
  {
    id: 'profile_content_length',
    label: 'What exact length must the output follow?',
    options: ['Ultra-short', 'Short', 'Medium', 'Long', 'Extended'],
  },
  {
    id: 'profile_engagement_style',
    label: 'What structure should the content follow?',
    options: ['Question-led', 'Declarative', 'Confrontational', 'Narrative', 'Hybrid'],
  },
  {
    id: 'profile_emotional_appeal',
    label: 'What emotional tone should dominate?',
    options: ['Anger', 'Grief', 'Hope', 'Pride', 'Controlled'],
  },
];

const OPTIONAL = [
  {
    id: 'profile_use_of_ambedkar_quotes',
    label: "How should Ambedkar's quotes be used?",
    options: ['Mandatory', 'Preferred', 'Occasional', 'Indirect', 'None'],
  },
  {
    id: 'profile_buddhist_references',
    label: 'How should Buddhist references be handled?',
    options: ['Core', 'Contextual', 'Symbolic', 'Secular', 'None'],
  },
  {
    id: 'profile_include_statistics',
    label: 'How should data / statistics be used?',
    options: ['Mandatory', 'Preferred', 'Optional', 'Minimal', 'None'],
  },
  {
    id: 'profile_personal_story',
    label: 'How should personal narratives be used?',
    options: ['Mandatory', 'Preferred', 'Generalized', 'Minimal', 'None'],
  },
  {
    id: 'profile_hashtags',
    label: 'How should hashtags be used?',
    options: ['High (4–6)', 'Moderate (2–3)', 'Minimal (1)', 'Rare', 'None'],
  },
  {
    id: 'profile_caste_identity',
    label: 'How should identity perspective be reflected?',
    options: ['Insider', 'Ally', 'Neutral', 'Contextual', 'Hidden'],
  },
  {
    id: 'profile_religious_affiliation',
    label: 'How should religion influence the narrative?',
    options: ['Core', 'Contextual', 'Symbolic', 'Secular', 'None'],
  },
  {
    id: 'profile_historical_references',
    label: 'How should historical context be used?',
    options: ['Strong', 'Moderate', 'Light', 'Rare', 'None'],
  },
  {
    id: 'profile_legal_angle',
    label: 'How should legal references be used?',
    options: ['Mandatory', 'Preferred', 'Light', 'Minimal', 'None'],
  },
  {
    id: 'profile_solidarity_expression',
    label: 'How should solidarity be expressed?',
    options: ['Strong', 'Moderate', 'Limited', 'Minimal', 'None'],
  },
  {
    id: 'profile_visual_suggestion',
    label: 'What visual suggestion should be added (if any)?',
    options: ['Poster', 'Data / Infographic', 'Clean', 'Real imagery', 'None'],
  },
];

const DEFAULTS = {
  profile_user_role:               'Communicator',
  profile_tone:                    'Analytical',
  profile_target_audience:         'General Public',
  profile_primary_focus:           'Current Event',
  profile_ambedkarite_perspective: 'Constitutional',
  profile_language:                'English',
  profile_formality_level:         'Semi-formal',
  profile_call_to_action:          'Awareness',
  profile_intersectionality:       'Moderate',
  profile_target_platform:         'LinkedIn',
  profile_regional_context:        'National',
  profile_content_length:          'Medium',
  profile_engagement_style:        'Declarative',
  profile_emotional_appeal:        'Hope',
  profile_use_of_ambedkar_quotes:  'Preferred',
  profile_buddhist_references:     'Contextual',
  profile_include_statistics:      'Preferred',
  profile_personal_story:          'Generalized',
  profile_hashtags:                'Moderate (2–3)',
  profile_caste_identity:          'Neutral',
  profile_religious_affiliation:   'Secular',
  profile_historical_references:   'Moderate',
  profile_legal_angle:             'Preferred',
  profile_solidarity_expression:   'Moderate',
  profile_visual_suggestion:       'None',
};

const STORAGE_KEY = 'ambedkargpt-preferences';

function stripArrow(val) {
  return typeof val === 'string' && val.includes(' -> ') ? val.split(' -> ')[0].trim() : val;
}

function readLocalPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cleaned = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, stripArrow(v)]));
    return { ...DEFAULTS, ...cleaned };
  } catch {
    return null;
  }
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({ q, num, value, onSelect }) {
  return (
    <div className="rounded-2xl border border-[#1a2d50]/60 bg-[#0e1628] p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 shrink-0 font-count text-[13px] font-bold text-[#3f6bd4]">
          {String(num).padStart(2, '0')}
        </span>
        <p className="text-[13.5px] font-medium leading-snug text-[#c0cde8]">{q.label}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {q.options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={[
                'relative flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[12.5px] font-medium transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-[#2563eb] to-[#3f9fff] text-white shadow-[0_4px_18px_rgba(37,99,235,0.45)]'
                  : 'border border-[#1e3260]/70 bg-[#0a1428]/80 text-[#7a90b8] hover:border-[#3f6bd4]/50 hover:bg-[#0f1d3a] hover:text-white',
              ].join(' ')}
            >
              {active && <Check size={11} strokeWidth={3} className="shrink-0" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ label, badge, description }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[18px] font-semibold text-white">{label}</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
              badge === 'Required'
                ? 'bg-[#2563eb]/20 text-[#6aa8ff] border border-[#2563eb]/30'
                : 'bg-[#7b5cff]/15 text-[#a78bfa] border border-[#7b5cff]/30'
            }`}
          >
            {badge}
          </span>
        </div>
        {description && (
          <p className="mt-0.5 text-[12px] text-[#6b78a0]">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Preferences() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Initialise from localStorage immediately so nothing flashes to defaults on revisit
  const [prefs, setPrefs]       = useState(() => readLocalPrefs() ?? DEFAULTS);
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load from DB and sync to localStorage
  useEffect(() => {
    if (!currentUser?.id) return;
    getProfileAnswers(currentUser.id)
      .then((rows) => {
        if (!rows?.length) return;
        const merged = { ...DEFAULTS };
        for (const row of rows) {
          // Backend normalises short labels to "Label -> Description" on save.
          // Strip the description so the short label matches the UI option buttons.
          const raw = row.answer;
          merged[row.question_id] =
            typeof raw === 'string' && raw.includes(' -> ')
              ? raw.split(' -> ')[0].trim()
              : raw;
        }
        setPrefs(merged);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      })
      .catch(() => {}); // silently fall back to localStorage values already in state
  }, [currentUser?.id]);

  function select(id, val) {
    setPrefs((p) => ({ ...p, [id]: val }));
  }

  async function handleSave() {
    if (!currentUser?.id) return;
    setSaving(true);
    setSaveError('');
    try {
      await saveProfileAnswers(currentUser.id, prefs);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
      setSaved(true);
    } catch {
      // Save locally even if remote fails so next visit still shows the right values
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
      setSaveError('Saved locally. Remote sync failed — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPrefs(DEFAULTS);
    setSaved(false);
  }

  const answeredCount = Object.values(prefs).filter(Boolean).length;
  const totalCount    = COMPULSORY.length + OPTIONAL.length;

  return (
    <div
      className="min-h-screen text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 800px at 50% -10%, #0d1636 0%, #070b1c 60%, #05081a 100%)' }}
    >
      {/* ambient glows */}
      <div className="pointer-events-none fixed left-0 top-0 h-[500px] w-[500px] rounded-full bg-[#2563eb]/8 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[#7b5cff]/8 blur-[140px]" />

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-[#141d3a]/70 bg-[#070b1c]/80 backdrop-blur-md">
        <div className="flex w-full items-center gap-5 px-8 py-5 md:px-12">
          {/* Left: brand */}
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} alt="AmbedkarGPT" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(63,159,255,0.5)]" />
            <span className="font-display text-[17px] font-bold text-white">
              Ambedkar<span className="gradient-text-cyan">GPT</span>
            </span>
          </div>

          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 px-4 py-2 text-[13px] font-medium text-[#6b78a0] transition hover:border-[#3a6bc4]/60 hover:text-white"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Dashboard
          </button>

          {/* Right: progress tracker */}
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-[13px] text-[#6b78a0] sm:block">
              <span className="font-count font-bold text-white">{answeredCount}</span>
              <span> / {totalCount} answered</span>
            </span>
            <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-[#0f1a3a] sm:block">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#3f9fff] transition-all duration-500"
                style={{ width: `${(answeredCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[780px] px-5 pb-28 pt-8 md:px-8">

        {/* ── Page hero ── */}
        <div className="mb-10 flex items-start gap-4">
          <img src={logoSrc} alt="AmbedkarGPT" className="mt-1 h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_16px_rgba(63,159,255,0.5)]" />
          <div>
            <h1 className="font-display text-[36px] font-bold leading-none text-white md:text-[44px]">
              Preferences
            </h1>
            <p className="mt-2 text-[14px] text-[#7a90b8]">
              Help us understand you better to personalise your AmbedkarGPT experience
            </p>
          </div>
        </div>

        {/* ── Compulsory questions ── */}
        <SectionHeader
          label="Core Profile"
          badge="Required"
          description="These signals directly shape every piece of content AmbedkarGPT generates for you."
        />
        <div className="space-y-4">
          {COMPULSORY.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              num={i + 1}
              value={prefs[q.id]}
              onSelect={(v) => select(q.id, v)}
            />
          ))}
        </div>

        {/* ── Optional questions ── */}
        <div className="mt-12">
          <SectionHeader
            label="Fine-tuning"
            badge="Optional"
            description="Add more granularity. Skip anything that doesn't apply to you."
          />
          <div className="space-y-4">
            {OPTIONAL.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                num={COMPULSORY.length + i + 1}
                value={prefs[q.id]}
                onSelect={(v) => select(q.id, v)}
              />
            ))}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-[12.5px] text-[#6b78a0] underline underline-offset-2 transition hover:text-white"
          >
            Reset to defaults
          </button>

          <div className="flex flex-col items-end gap-2">
            {saveError && (
              <p className="text-[12px] text-red-400">{saveError}</p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl btn-gradient px-8 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_32px_rgba(37,99,235,0.4)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saved ? <Check size={15} strokeWidth={2.5} /> : <Save size={15} strokeWidth={2} />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Post-save floating toast ── */}
      {saved && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#22c55e]/25 px-5 py-3.5 shadow-2xl backdrop-blur-md"
            style={{ background: 'rgba(5,12,26,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.15)' }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#22c55e]/15">
              <Check size={12} strokeWidth={3} className="text-[#22c55e]" />
            </span>
            <span className="text-[13px] font-medium text-white">Preferences saved!</span>
            <div className="ml-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3260]/70 px-3 py-1.5 text-[12px] font-medium text-[#6b78a0] transition hover:border-[#3a6bc4]/60 hover:text-white"
              >
                <Home size={11} strokeWidth={2} />
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3260]/70 px-3 py-1.5 text-[12px] font-medium text-[#6b78a0] transition hover:border-[#3a6bc4]/60 hover:text-white"
              >
                <ArrowUp size={11} strokeWidth={2} />
                Top
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

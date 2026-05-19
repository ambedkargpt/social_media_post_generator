import { useState } from 'react';
import { Sparkles, ChevronDown, RotateCcw } from 'lucide-react';

// UI-only display metadata per question_id — labels and hints are not stored
// in the DB, so we keep a local map here. Falls back gracefully for unknown ids.
const QUESTION_META = {
  profile_user_role:              { label: 'Your role',         hint: 'Voice & authority layer' },
  profile_tone:                   { label: 'Preferred tone',    hint: 'Word choice & emotional energy' },
  profile_target_audience:        { label: 'Target audience',   hint: 'How the message is framed' },
  profile_primary_focus:          { label: 'Primary focus',     hint: 'What the post is about' },
  profile_ambedkarite_perspective:{ label: 'Perspective',       hint: 'Your core ideological anchor' },
  profile_content_length:         { label: 'Content length',    hint: 'Controls output size' },
  profile_call_to_action:         { label: 'Call to action',    hint: 'Ending & intent of post' },
};

function getMeta(questionId, questionText) {
  return QUESTION_META[questionId] ?? { label: questionText, hint: '' };
}

// Build a defaults map from questions (first option of each)
function buildDefaults(questions) {
  return Object.fromEntries(
    questions.map((q) => [q.question_id, q.options[0] ?? ''])
  );
}

function Dropdown({ value, options, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-[#1e3260]/70 bg-[#0a1130]/80 py-2.5 pl-3 pr-9 text-[12.5px] font-medium text-white outline-none transition focus:border-[#3f9fff]/70 focus:shadow-[0_0_0_3px_rgba(63,159,255,0.15)] hover:border-[#3f9fff]/50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#0a1130] text-white">
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        strokeWidth={2}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b94b8]"
      />
    </div>
  );
}

// questions  — array of { question_id, question_text, options } from the DB
// value      — controlled: { question_id: selectedOption, ... }
// onChange   — controlled setter
// defaultValues — what "reset" snaps back to (user's saved profile answers)
export default function PreferencesPanel({ questions = [], value, onChange, defaultValues }) {
  const fallbackDefaults = buildDefaults(questions);
  const resetTarget = defaultValues ?? fallbackDefaults;

  const [local, setLocal] = useState(() => resetTarget);
  const current = value ?? local;

  function setField(id, v) {
    const next = { ...current, [id]: v };
    if (onChange) onChange(next); else setLocal(next);
  }

  function reset() {
    if (onChange) onChange({ ...resetTarget }); else setLocal({ ...resetTarget });
  }

  const isLoading = questions.length === 0;

  return (
    <aside className="relative flex h-full w-full flex-col border-l border-[#141d3a]/80 bg-gradient-to-b from-[#0a1024]/95 to-[#070b1c]/95">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#141d3a]/70 bg-[#070b1c]/90 px-5 py-5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] text-white shadow-[0_4px_14px_rgba(63,159,255,0.4)]">
              <Sparkles size={11} strokeWidth={2.2} />
            </span>
            <h3 className="font-display text-[15px] font-semibold text-white tracking-tight">
              Your Preferences
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-[#8b94b8]">
            Tune the voice behind every post
          </p>
        </div>

        <button
          type="button"
          onClick={reset}
          title="Reset to defaults"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#1e3260]/70 text-[#8b94b8] transition hover:border-[#3f9fff]/60 hover:text-white"
        >
          <RotateCcw size={11} strokeWidth={2} />
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-[#1e3260]/60" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-[#1e3260]/40" />
            </div>
          ))
        ) : (
          questions.map((q, i) => {
            const { label, hint } = getMeta(q.question_id, q.question_text);
            return (
              <div key={q.question_id}>
                <div className="flex items-baseline justify-between gap-2">
                  <label className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6aa8ff]">
                    <span className="font-count text-[#8b94b8] mr-1">{i + 1}.</span>
                    {label}
                  </label>
                </div>
                {hint && (
                  <p className="mt-0.5 text-[10.5px] text-[#6b78a0] leading-snug">{hint}</p>
                )}
                <div className="mt-2">
                  <Dropdown
                    value={current[q.question_id] ?? q.options[0]}
                    options={q.options}
                    onChange={(v) => setField(q.question_id, v)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#141d3a]/70 bg-[#070b1c]/85 px-5 py-4 text-[10.5px] text-[#6b78a0] leading-snug">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
          {isLoading ? 'Loading…' : `${questions.length} signals active`}
        </span>
      </footer>
    </aside>
  );
}

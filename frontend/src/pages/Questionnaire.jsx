import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import { useCurtain } from '../context/CurtainContext';
import { useAuth } from '../context/AuthContext';
import { saveProfileAnswers } from '../api/profile';
import { getPartyQuestions, getPositionQuestions } from '../api/questions';
import usePendingQuestions, { clearPendingQuestions } from '../hooks/usePendingQuestions';
import { groupForId, roleLabel, rolesInGroup } from '../utils/partyRoles';
import { levelLabel } from '../utils/displayLabel';
import OnboardingLayout from '../layouts/OnboardingLayout';
import { Button, Chakra, Paper, Tag } from '../components/np';
import { useI18n } from '../i18n/index.jsx';

/**
 * Phase 4 of docs/redesign/neela-press.md.
 *
 * Which questions are asked, how progress is stored, what gets saved and when
 * - all of that is unchanged. What changed is that one question now has the
 * screen to itself, the answers are cards a thumb can hit, and there is a
 * sheet of paper beside them showing what the answers are building.
 *
 * ── unchanged from here ──────────────────────────────────────────────────
 * This page asks whichever question sets the user has never answered, which
 * the backend decides and /questions/pending reports.
 *
 * For a new sign-up that is the five questions written for their party and the
 * level of their position in it. The ten party questions are not asked there:
 * a new account starts from their defaults and changes them on the Preferences
 * page, which is what keeps sign-up at five questions rather than fifteen.
 *
 * For an account that predates the party questions it is those ten as well,
 * once. Those users were never offered them and would otherwise generate on
 * defaults they never saw.
 *
 * A new storage key on every change to which questions are asked, because the
 * old one holds a step index counted against the old list. Restored against a
 * shorter list it points past the end and leaves the page on its spinner.
 */
const STORAGE_KEY = 'ambedkargpt_preference_questionnaire';

// Mirrors question_party() in backend/pipeline/position_questions.py.
const HAS_POSITION_SET = /indian national congress|\(inc\)|bahujan samaj|\(bsp\)/i;

function readSaved(party, positionId) {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    // Progress only counts for the party and position it was made against.
    // Both decide which questions are asked, so either changing invalidates it.
    return s.party === party && s.positionId === positionId ? s : {};
  } catch {
    return {};
  }
}

function Loading() {
  const { t } = useI18n();
  return (
    <div className="np np-bg" style={{
      minHeight: '100svh', display: 'grid', placeItems: 'center', gap: 14,
    }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
        <Chakra size={40} mode="spin" className="np-kit-neela" />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-np-muted)' }}>{t('quest.loading')}</p>
      </div>
    </div>
  );
}

export default function Questionnaire() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { currentUser } = useAuth();

  const party = currentUser?.political_party || '';
  const positionId = currentUser?.party_position || '';
  const group = groupForId(positionId);
  const partyHasSet = HAS_POSITION_SET.test(party);
  const role = rolesInGroup(group).find((r) => r.id === positionId);

  const leftRef = useRef(false);
  function leave() {
    if (leftRef.current) return;
    leftRef.current = true;
    const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
    sessionStorage.removeItem('auth_redirect');
    curtainGo(redirect, { replace: true });
  }

  // What is outstanding for this account. Shared with ProtectedRoute, which
  // is what sends an older account here in the first place, so this costs no
  // extra request.
  const { pending, checked } = usePendingQuestions(currentUser?.id);

  // Nothing outstanding: no questions are written for this party, or they have
  // all been answered already.
  useEffect(() => {
    if (currentUser && checked && !pending.party && !pending.position) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      leave();
    }
  }, [currentUser, checked, pending.party, pending.position]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The questions: the party set, then the position set ──
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [fetchErr, setFetchErr] = useState(false);

  useEffect(() => {
    if (!checked || !partyHasSet || (!pending.party && !pending.position)) {
      setQuestions([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingQ(true);
    setFetchErr(false);
    // Only the outstanding sets are requested. Resolving the other to an empty
    // list keeps the two calls one shape.
    Promise.all([
      pending.party ? getPartyQuestions(party) : Promise.resolve([]),
      pending.position && group ? getPositionQuestions(party, group) : Promise.resolve([]),
    ])
      .then(([partyRows, positionRows]) => {
        if (cancelled) return;
        // The English option is what gets saved and validated; the Hindi at the
        // same index is only what gets drawn.
        const toQuestion = (kind) => (q) => ({
          id: q.question_id,
          kind,
          compulsory: Boolean(q.is_compulsory),
          text: q.question_text,
          textHi: q.question_text_hi,
          options: (q.options ?? []).map((opt, i) => ({ value: opt, hi: q.options_hi?.[i] || '' })),
        });
        // The party set first: what someone wants said about their party holds
        // whatever office they hold, so it is the wider question of the two.
        const all = [
          ...partyRows.map(toQuestion('party')),
          ...positionRows.map(toQuestion('position')),
        ];
        if (!all.length) { leave(); return; }
        setQuestions(all);
      })
      .catch(() => { if (!cancelled) setFetchErr(true); })
      .finally(() => { if (!cancelled) setLoadingQ(false); });
    return () => { cancelled = true; };
  }, [party, group, partyHasSet, checked, pending.party, pending.position]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = useMemo(() => readSaved(party, positionId), [party, positionId]);
  const [step, setStep] = useState(saved.step ?? 0);
  const [answers, setAnswers] = useState(saved.answers ?? {});
  const [direction, setDir] = useState('forward');

  const total = questions.length;
  const safeStep = total ? Math.min(step, total - 1) : 0;
  const question = questions[safeStep];
  const selected = question ? answers[question.id] : undefined;
  const isLast = total > 0 && safeStep === total - 1;
  // The one question nobody may skip past. Question 10 of the party set: two
  // supporters of the same party can want opposite posts, and this is the
  // answer that separates them.
  const mustAnswer = Boolean(question?.compulsory) && !selected;

  useEffect(() => {
    if (!party) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ party, positionId, step: safeStep, answers }),
      );
    } catch { /* ignore */ }
  }, [party, positionId, safeStep, answers]);

  function select(value) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  }

  function goNext() {
    if (!selected) return;
    if (isLast) { finish(); return; }
    setDir('forward');
    setStep(safeStep + 1);
  }

  function goBack() {
    if (safeStep === 0) return;
    setDir('back');
    setStep(safeStep - 1);
  }

  // Only the questions on screen are ever sent.
  function answersToSave() {
    const shown = new Set(questions.map((q) => q.id));
    return Object.fromEntries(Object.entries(answers).filter(([id, v]) => shown.has(id) && v));
  }

  function saveAndContinue() {
    // Leaving early used to send nothing, so someone who answered eight of ten
    // and stepped away lost all eight and was asked the whole set again. What
    // has been answered is saved; the rest stay outstanding.
    const toSave = answersToSave();
    if (currentUser?.id && Object.keys(toSave).length) {
      saveProfileAnswers(currentUser.id, toSave).catch(() => {});
      clearPendingQuestions();
    }
    const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
    sessionStorage.removeItem('auth_redirect');
    navigate(redirect);
  }

  function finish() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    const toSave = answersToSave();
    if (currentUser?.id && Object.keys(toSave).length) {
      saveProfileAnswers(currentUser.id, toSave).catch(() => {});
    }
    // Otherwise the next protected route reads a stale "still outstanding" and
    // sends them straight back into the questionnaire they just completed.
    clearPendingQuestions();
    leave();
  }

  // Number keys pick an answer and Enter moves on. Five options and five keys
  // under the fingers is the difference between a questionnaire and a form.
  useEffect(() => {
    function onKey(e) {
      if (!question || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement
        && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length) {
        e.preventDefault();
        select(question.options[n - 1].value);
      }
      if (e.key === 'Enter' && selected) { e.preventDefault(); goNext(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // every render: `question` and `selected` both change under it

  // ── Render ──
  if (!currentUser || !partyHasSet) return <Loading />;

  if (fetchErr) {
    return (
      <OnboardingLayout>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 16, padding: '64px 0' }}>
          <p style={{ margin: 0, color: 'var(--color-np-critical)' }}>{t('questionnaire.loadFailed')}</p>
          <Button variant="secondary" onClick={leave}>{t('quest.skipForNow')}</Button>
        </div>
      </OnboardingLayout>
    );
  }

  if (loadingQ || !question) return <Loading />;

  const roleName = role ? roleLabel(role, party, lang) : '';
  const answered = questions.slice(0, safeStep).filter((q) => answers[q.id]);

  return (
    <OnboardingLayout
      step={safeStep + 1}
      total={total}
      label={t('np.q.progress', { n: safeStep + 1, total })}
      onFinishLater={mustAnswer ? undefined : saveAndContinue}
    >
      <div className="np-q">
        <div key={safeStep} className="np-step np-q-main" data-dir={direction}>
          <p className="np-q-kind">
            <Tag tone={question.kind === 'party' ? 'party' : 'general'}>
              {question.kind === 'party'
                ? t('quest.sectionParty')
                : `${levelLabel(group, lang)}${roleName ? ` · ${roleName}` : ''}`}
            </Tag>
            {question.compulsory && (
              <Tag tone="top">{t('quest.compulsory')}</Tag>
            )}
          </p>

          <h1 className="np-display np-q-text">
            {lang === 'hi' && question.textHi ? question.textHi : question.text}
          </h1>

          {question.compulsory && (
            <p className="np-q-note">{t('quest.compulsoryNote')}</p>
          )}

          <div className="np-q-options">
            {question.options.map((opt, i) => {
              const isSelected = selected === opt.value;
              const odd = question.options.length % 2 === 1
                && i === question.options.length - 1;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => select(opt.value)}
                  aria-pressed={isSelected}
                  className="np-q-option"
                  style={odd ? { gridColumn: '1 / -1' } : undefined}
                >
                  <span className="np-mono np-q-key" aria-hidden="true">{i + 1}</span>
                  <span>{lang === 'hi' && opt.hi ? opt.hi : opt.value}</span>
                  {isSelected && (
                    <span className="np-q-check" aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="np-q-nav">
            <Button
              variant="secondary"
              onClick={goBack}
              disabled={safeStep === 0}
              iconLeft={ArrowLeft}
            >
              {t('common.back')}
            </Button>
            <Button
              onClick={goNext}
              disabled={!selected}
              iconRight={ArrowRight}
              style={{ marginInlineStart: 'auto' }}
            >
              {isLast ? t('quest.finish') : t('common.next')}
            </Button>
          </div>
        </div>

        {/* What the answers are building. No request behind it - the point is
            to show that the questions go somewhere, and a sheet of paper with
            the reader's own choices on it says that better than a progress
            percentage does. Hidden below 1024px, where the question needs the
            whole screen. */}
        <aside className="np-q-aside">
          <Paper tilt={-1}>
            <p className="np-q-aside-title">{t('np.q.voiceSoFar')}</p>
            {answered.length === 0 ? (
              <p className="np-q-aside-empty">{t('quest.compulsoryNote')}</p>
            ) : (
              <ul className="np-q-aside-list">
                {answered.map((q, i) => (
                  <li key={q.id} className={i === answered.length - 1 ? 'is-latest' : ''}>
                    {answers[q.id]}
                  </li>
                ))}
              </ul>
            )}
          </Paper>
        </aside>
      </div>
    </OnboardingLayout>
  );
}

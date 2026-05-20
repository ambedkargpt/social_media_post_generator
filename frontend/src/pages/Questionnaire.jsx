import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurtain } from '../context/CurtainContext';
import { ArrowLeft, ArrowRight, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saveProfileAnswers } from '../api/profile';
import { getQuestions } from '../api/questions';
import logoSrc     from '../assets/images/logo-animation.png';
import ambedkarSrc from '../assets/images/qna-ambedkar.png';

const STORAGE_KEY = 'ambedkargpt_questionnaire';

function useSlideAnim(index, direction) {
  const [display, setDisplay]   = useState(index);
  const [animate, setAnimate]   = useState('idle');
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (index === display) return;
    const exitClass  = direction === 'next' ? 'exit-left'  : 'exit-right';
    const enterClass = direction === 'next' ? 'enter-right' : 'enter-left';
    setAnimating(true);
    setAnimate(exitClass);
    const t1 = setTimeout(() => { setDisplay(index); setAnimate(enterClass); }, 350);
    const t2 = setTimeout(() => { setAnimate('idle'); setAnimating(false); }, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  return { display, animate, animating };
}

const ANIM_STYLES = {
  idle:          { opacity: 1, transform: 'translateX(0)' },
  'exit-left':   { opacity: 0, transform: 'translateX(-52px)' },
  'exit-right':  { opacity: 0, transform: 'translateX(52px)' },
  'enter-right': { opacity: 0, transform: 'translateX(52px)' },
  'enter-left':  { opacity: 0, transform: 'translateX(-52px)' },
};

export default function Questionnaire() {
  const navigate = useNavigate();
  const { go: curtainGo } = useCurtain();
  const { currentUser } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [loadingQ,  setLoadingQ]  = useState(true);
  const [fetchErr,  setFetchErr]  = useState(false);

  useEffect(() => {
    getQuestions(7)
      .then((data) => {
        setQuestions(data.map((q) => ({
          id:       q.question_id,
          question: q.question_text,
          options:  q.options,
        })));
      })
      .catch(() => setFetchErr(true))
      .finally(() => setLoadingQ(false));
  }, []);

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  })();

  const [step, setStep]       = useState(saved.step ?? 0);
  const [answers, setAnswers] = useState(saved.answers ?? {});
  const [direction, setDir]   = useState('next');
  const { display, animate, animating } = useSlideAnim(step, direction);

  const total    = questions.length;
  const question = questions[display];
  const progress = total ? Math.round((step / total) * 100) : 0;
  const selected = question ? answers[question.id] : undefined;
  const isLast   = total > 0 && step === total - 1;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
  }, [step, answers]);

  function select(opt) {
    setAnswers((prev) => ({ ...prev, [question.id]: opt }));
  }

  function goNext() {
    if (!selected || animating) return;
    if (isLast) { finish(); return; }
    setDir('next');
    setStep((s) => s + 1);
  }

  function goBack() {
    if (step === 0 || animating) return;
    setDir('back');
    setStep((s) => s - 1);
  }

  function saveAndContinue() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
    const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
    sessionStorage.removeItem('auth_redirect');
    navigate(redirect);
  }

  function finish() {
    localStorage.removeItem(STORAGE_KEY);
    // Save answers to backend; fire-and-forget so the user isn't blocked
    if (currentUser?.id) {
      saveProfileAnswers(currentUser.id, answers).catch(() => {});
    }
    const redirect = sessionStorage.getItem('auth_redirect') || '/dashboard';
    sessionStorage.removeItem('auth_redirect');
    curtainGo(redirect, { replace: true });
  }

  if (loadingQ || fetchErr || !question) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center"
        style={{ background: 'linear-gradient(160deg,#0d1535 0%,#080e22 100%)' }}
      >
        {fetchErr ? (
          <p className="font-count text-[14px] text-[#e55555]">
            Failed to load questions. Please refresh and try again.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1e3260] border-t-[#3f9fff]" />
            <p className="font-count text-[13px] text-[#5a6e9a]">Loading questions…</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'linear-gradient(160deg,#0d1535 0%,#080e22 100%)' }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none fixed -left-48 -top-48 h-[500px] w-[500px] rounded-full bg-[#1e4fb5]/15 blur-[130px]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#3f9fff]/10 blur-[120px]" />

      {/* ── Top nav bar ── */}
      <header className="relative z-10 flex items-center px-8 pt-7 md:px-14">
        <div className="flex items-center gap-2.5">
          <img src={logoSrc} alt="AmbedkarGPT" className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(63,159,255,0.5)]" />
          <span className="font-display text-[20px] font-bold leading-none tracking-tight">
            <span className="text-white">Ambedkar</span>
            <span className="gradient-text-cyan">GPT</span>
          </span>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-10 pt-8 md:px-14">
        {/* Ambedkar image with glow */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute h-[260px] w-[260px] rounded-full blur-[60px]"
            style={{ background: 'radial-gradient(circle, rgba(63,159,255,0.28) 0%, rgba(123,92,255,0.14) 55%, transparent 75%)' }}
          />
          <img
            src={ambedkarSrc}
            alt="Dr. B.R. Ambedkar"
            className="relative z-10 w-[180px] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)] md:w-[210px]"
          />
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full max-w-[760px]">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#1a2c55]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3f9fff] to-[#7b5cff]"
              style={{
                width: `${Math.max(progress, 3)}%`,
                transition: 'width 500ms cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 0 10px rgba(63,159,255,0.55)',
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between font-count text-[12px] text-[#5a6e9a]">
            <span>Question {step + 1} of {total}</span>
            <span>{progress}% Complete</span>
          </div>
        </div>

        {/* Animated question + options */}
        <div
          className="w-full max-w-[760px]"
          style={{
            ...ANIM_STYLES[animate],
            transition: 'opacity 350ms ease, transform 350ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <h2 className="font-display mt-8 text-[24px] font-semibold leading-snug text-white md:text-[28px]">
            {question.question}
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {question.options.map((opt) => {
              const isSelected = selected === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className="font-count rounded-xl border px-5 py-4 text-left text-[13.5px] font-medium transition-all duration-200"
                  style={{
                    backgroundColor: isSelected ? 'rgba(20,50,110,0.6)'   : 'rgba(255,255,255,0.03)',
                    borderColor:     isSelected ? 'rgba(63,159,255,0.65)' : 'rgba(40,65,120,0.55)',
                    color:           isSelected ? '#d6eaff'               : '#8fa5cc',
                    boxShadow:       isSelected ? '0 0 14px rgba(63,159,255,0.18)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(63,159,255,0.35)';
                      e.currentTarget.style.color = '#b0c5e8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(40,65,120,0.55)';
                      e.currentTarget.style.color = '#8fa5cc';
                    }
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Bottom navigation ── */}
        <div className="mt-10 flex w-full max-w-[760px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || animating}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1e3260]/70 px-5 text-[13px] font-medium text-[#6b80a8] transition-all hover:border-[#3a6bc4]/60 hover:text-white disabled:pointer-events-none disabled:opacity-25"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Back
          </button>

          <button
            type="button"
            onClick={saveAndContinue}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1e3260]/60 px-5 text-[13px] font-medium text-[#6b80a8] transition-all hover:border-[#3a6bc4]/50 hover:text-[#a0bade]"
          >
            <BookmarkCheck size={14} strokeWidth={1.8} />
            Save and Continue Later
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={!selected || animating}
            className="inline-flex h-10 items-center gap-2 rounded-full px-6 text-[13px] font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
            style={{
              background: selected ? 'linear-gradient(90deg,#0a7dff,#3a9fff)' : 'rgba(30,50,100,0.4)',
              boxShadow:  selected ? '0 4px 20px rgba(17,122,255,0.35)'       : 'none',
            }}
          >
            {isLast ? 'Finish' : 'Next'}
            <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </main>
    </div>
  );
}

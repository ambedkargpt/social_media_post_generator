import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePendingQuestions from '../hooks/usePendingQuestions';

/**
 * Wraps a route so only authenticated users can access it.
 * When unauthenticated, saves the intended path in sessionStorage
 * so Login/Signup can redirect back after a successful auth.
 *
 * It also catches accounts that predate the party preference questions and
 * sends them through the questionnaire once. The check lives here rather than
 * in Login because there are five ways into a session: password, OTP, Google,
 * the password reset, and simply returning with a live token. Only this
 * component is on all five.
 */

// One prompt per browser session. The questionnaire can be left for later, and
// bouncing someone back into it on every navigation after they chose that is a
// nag rather than a prompt. They are asked again next time they sign in.
const PROMPTED_KEY = 'ambedkargpt_questionnaire_prompted';

function alreadyPrompted() {
  try { return sessionStorage.getItem(PROMPTED_KEY) === '1'; } catch { return false; }
}

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const { pending, checked } = usePendingQuestions(currentUser?.id);

  useEffect(() => {
    // Save the intended destination before redirecting to login
    if (!loading && !currentUser) {
      const intended = location.pathname + location.search;
      if (intended !== '/login' && intended !== '/signup') {
        sessionStorage.setItem('auth_redirect', intended);
      }
    }
  }, [loading, currentUser, location]);

  // Not from the questionnaire itself, which this also wraps, and not from
  // profile-setup, where the party and position these questions depend on are
  // still being chosen.
  const isSetupRoute =
    location.pathname === '/questionnaire' || location.pathname === '/profile-setup';
  const needsQuestionnaire =
    checked && (pending.party || pending.position) && !alreadyPrompted();
  const willRedirect = needsQuestionnaire && !isSetupRoute;

  // Marked only when the redirect actually happens. Marking it whenever
  // something is outstanding would burn the one prompt on someone who opened
  // the questionnaire themselves, and they would not be offered it again.
  useEffect(() => {
    if (willRedirect) {
      try { sessionStorage.setItem(PROMPTED_KEY, '1'); } catch { /* ignore */ }
    }
  }, [willRedirect]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1e3260] border-t-brand-cyan" />
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;

  if (willRedirect) {
    // Where they were headed, so finishing lands them there instead of on a
    // dashboard they did not ask for.
    try {
      sessionStorage.setItem('auth_redirect', location.pathname + location.search);
    } catch { /* ignore */ }
    return <Navigate to="/questionnaire" replace />;
  }

  return children;
}

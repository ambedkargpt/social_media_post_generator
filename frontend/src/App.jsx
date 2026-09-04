import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurtainProvider } from './context/CurtainContext';
import ProtectedRoute   from './components/ProtectedRoute';

import Home       from './pages/Home';

// Route chunks. Every page used to sit in the entry bundle, so a visitor
// to the landing page downloaded the dashboard, the chatbot, the post
// generator and the music studio before anything could paint. On a weak
// mobile connection that was the difference between a fast load and a
// blank screen for seconds.
const About = lazy(() => import('./pages/About'));
const Solutions = lazy(() => import('./pages/Solutions'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Resources = lazy(() => import('./pages/Resources'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Otp = lazy(() => import('./pages/Otp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Questionnaire = lazy(() => import('./pages/Questionnaire'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const ServiceSelection = lazy(() => import('./pages/ServiceSelection'));
const SocialMediaPostGenerator = lazy(() => import('./pages/SocialMediaPostGenerator'));
const MusicGeneration = lazy(() => import('./pages/MusicGeneration'));
const MusicGenerationStudio = lazy(() => import('./pages/MusicGenerationStudio'));
const Preferences = lazy(() => import('./pages/Preferences'));
const PostHistory = lazy(() => import('./pages/PostHistory'));
const BheemBot = lazy(() => import('./pages/BheemBot'));
import CustomCursor        from './components/CustomCursor';
import ScrollProgress      from './components/ScrollProgress';
import OpeningSplash       from './components/OpeningSplash';
import LanguagePopup       from './components/LanguagePopup';
import Spinner             from './components/Spinner';
import { I18nProvider }    from './i18n/index.jsx';
import TransitionCurtain   from './components/TransitionCurtain';
import ErrorBoundary       from './components/ErrorBoundary';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Wraps <Routes> and re-keys on every pathname change so the CSS
// pageEnter animation replays on each navigation.
function PageTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  );
}

// Splash + language popup are for first-time visitors only. Signed-in users
// have already chosen a language, so refreshing should not ask them again.
// Rendered inside AuthProvider so it can read the session, and it waits for
// `loading` to settle — otherwise the popup flashes before auth resolves.
function IntroGate({ stage, onSplashDone, onLanguageDone }) {
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && currentUser && stage !== 'done') onLanguageDone();
  }, [loading, currentUser, stage, onLanguageDone]);

  if (loading || currentUser) return null;
  return (
    <>
      {stage === 'splash'   && <OpeningSplash onDone={onSplashDone} />}
      {stage === 'language' && <LanguagePopup onDone={onLanguageDone} />}
    </>
  );
}

export default function App() {
  // stage: 'splash' -> 'language' -> 'done'
  const [stage, setStage] = useState(() => {
    const skip = sessionStorage.getItem('skip-splash') === '1';
    if (skip) sessionStorage.removeItem('skip-splash');
    return skip ? 'done' : 'splash';
  });
  const handleSplashDone   = useCallback(() => setStage('language'), []);
  const handleLanguageDone = useCallback(() => setStage('done'), []);
  const splashDone = stage === 'done';

  return (
    <ErrorBoundary>
    <I18nProvider>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <CurtainProvider>
        <AuthProvider>
          <IntroGate
            stage={stage}
            onSplashDone={handleSplashDone}
            onLanguageDone={handleLanguageDone}
          />
          <TransitionCurtain />
          <ScrollProgress />
          <CustomCursor />

          <PageTransition>
          {/* Route chunks load on navigation. The fallback matches the page
              background so a chunk arriving late reads as a pause rather than
              a flash of empty white — but a bare coloured div is
              indistinguishable from a dead page, so it carries a spinner. */}
          <Suspense
            fallback={(
              <div
                className="flex items-center justify-center"
                style={{ minHeight: '100vh', background: '#05081a' }}
              >
                <Spinner size={36} />
              </div>
            )}
          >
          <Routes>
            {/* public */}
            <Route path="/"          element={<Home splashDone={splashDone} />} />
            <Route path="/about"     element={<About />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/pricing"   element={<Pricing />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/contact"   element={<Contact />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/signup"    element={<Signup />} />
            <Route path="/otp"              element={<Otp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* protected */}
            <Route path="/profile-setup" element={
              <ProtectedRoute><ProfileSetup /></ProtectedRoute>
            } />
            <Route path="/questionnaire" element={
              <ProtectedRoute><Questionnaire /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/generate" element={
              <ProtectedRoute><ServiceSelection /></ProtectedRoute>
            } />
            <Route path="/generate/social-media" element={
              <ProtectedRoute><SocialMediaPostGenerator /></ProtectedRoute>
            } />
            <Route path="/generate/music" element={
              <ProtectedRoute><MusicGeneration /></ProtectedRoute>
            } />
            <Route path="/generate/music/:type" element={
              <ProtectedRoute><MusicGenerationStudio /></ProtectedRoute>
            } />
            <Route path="/preferences" element={
              <ProtectedRoute><Preferences /></ProtectedRoute>
            } />
            <Route path="/posts" element={
              <ProtectedRoute><PostHistory /></ProtectedRoute>
            } />
            <Route path="/bheembot" element={
              <ProtectedRoute><BheemBot /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </PageTransition>
        </AuthProvider>
        </CurtainProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
    </I18nProvider>
    </ErrorBoundary>
  );
}

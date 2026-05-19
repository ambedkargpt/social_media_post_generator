import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { CurtainProvider } from './context/CurtainContext';
import ProtectedRoute   from './components/ProtectedRoute';

import Home       from './pages/Home';
import About      from './pages/About';
import Solutions  from './pages/Solutions';
import Pricing    from './pages/Pricing';
import Resources  from './pages/Resources';
import Contact    from './pages/Contact';
import Login      from './pages/Login';
import Signup     from './pages/Signup';
import Otp        from './pages/Otp';
import Dashboard       from './pages/Dashboard';
import ForgotPassword  from './pages/ForgotPassword';
import Questionnaire   from './pages/Questionnaire';
import ServiceSelection          from './pages/ServiceSelection';
import SocialMediaPostGenerator  from './pages/SocialMediaPostGenerator';
import Preferences               from './pages/Preferences';
import PostHistory               from './pages/PostHistory';

import CustomCursor        from './components/CustomCursor';
import ScrollProgress      from './components/ScrollProgress';
import OpeningSplash       from './components/OpeningSplash';
import TransitionCurtain   from './components/TransitionCurtain';
import ErrorBoundary       from './components/ErrorBoundary';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <ErrorBoundary>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <CurtainProvider>
        <AuthProvider>
          {!splashDone && <OpeningSplash onDone={handleSplashDone} />}
          <TransitionCurtain />
          <ScrollProgress />
          <CustomCursor />

          <Routes>
            {/* public */}
            <Route path="/"          element={<Home />} />
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
            <Route path="/preferences" element={
              <ProtectedRoute><Preferences /></ProtectedRoute>
            } />
            <Route path="/posts" element={
              <ProtectedRoute><PostHistory /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
        </CurtainProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

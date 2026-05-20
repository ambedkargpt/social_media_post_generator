import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route so only authenticated users can access it.
 * When unauthenticated, saves the intended path in sessionStorage
 * so Login/Signup can redirect back after a successful auth.
 */
export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Save the intended destination before redirecting to login
    if (!loading && !currentUser) {
      const intended = location.pathname + location.search;
      if (intended !== '/login' && intended !== '/signup') {
        sessionStorage.setItem('auth_redirect', intended);
      }
    }
  }, [loading, currentUser, location]);

  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}

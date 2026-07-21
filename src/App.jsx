import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import FeedPage from './pages/FeedPage/FeedPage';
import PoliticianWall from './pages/PoliticianWall';
import OnboardingFlow from './pages/Onboarding/OnboardingFlow';
import './index.css';

// A simple protected route wrapper
function ProtectedRoute({ children, requireAdmin, requireOnboarding = true }) {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  
  // If user is authenticated but hasn't completed onboarding
  // (covers both a missing profile row and a profile without a role)
  if (requireOnboarding && !profile?.role) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/feed" replace />; // Redirect non-admins to the feed or home
  }
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="explore" element={<UserPage />} />
            <Route 
              path="admin" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
            <Route path="auth" element={<AuthPage />} />
            <Route 
              path="feed" 
              element={
                <ProtectedRoute>
                  <FeedPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="wall/:ghostId" 
              element={
                <ProtectedRoute>
                  <PoliticianWall />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="wall/:ghostId/:slug" 
              element={
                <ProtectedRoute>
                  <PoliticianWall />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="profile" 
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="onboarding" 
              element={
                <ProtectedRoute requireOnboarding={false}>
                  <OnboardingFlow />
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

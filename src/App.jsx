import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import ElectionsAdmin from './pages/Admin/ElectionsAdmin';
import ElectionAdminApplications from './pages/Admin/ElectionAdminApplications';
import BoundaryVisualizer from './pages/Admin/BoundaryVisualizer';
import ThemeAdmin from './pages/Admin/ThemeAdmin';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import FeedPage from './pages/FeedPage/FeedPage';
import PoliticianWall from './pages/PoliticianWall';
import OnboardingFlow from './pages/Onboarding/OnboardingFlow';
import ElectionsPage from './pages/ElectionsPage';
import ElectionSeatPage from './pages/ElectionSeatPage';
import PoliticianElections from './pages/PoliticianElections';
import CandidacyWall from './components/CandidacyWall';
import CandidateApplication from './pages/CandidateApplication';
import './index.css';

// A simple protected route wrapper
function ProtectedRoute({ children, requireAdmin, requireOnboarding = true }) {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  
  // If user is authenticated but hasn't completed onboarding
  if (requireOnboarding && profile?.role !== 'admin' && !profile?.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/feed" replace />; // Redirect non-admins to the feed or home
  }
  
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route
                path="admin"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/elections"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <ElectionsAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/election-admins"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <ElectionAdminApplications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/visualize"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <BoundaryVisualizer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/theme"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <ThemeAdmin />
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
              {/* Public: viewable without an account, like a campaign site */}
              <Route path="elections" element={<ElectionsPage />} />
              <Route path="elections/seat/:seatId" element={<ElectionSeatPage />} />
              <Route path="candidacy/:candidateId" element={<CandidacyWall />} />
              <Route
                path="politician/elections"
                element={
                  <ProtectedRoute>
                    <PoliticianElections />
                  </ProtectedRoute>
                }
              />
              <Route
                path="apply/:candidateId"
                element={
                  <ProtectedRoute>
                    <CandidateApplication />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

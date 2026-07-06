import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProjectsListPage from './pages/ProjectsListPage';
import NewProjectPage from './pages/NewProjectPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import ProjectDashboardPage from './pages/ProjectDashboardPage';

// A component that handles redirecting the root `/` route
const RootRedirect = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Initializing...</p>
      </div>
    );
  }
  
  return user ? <Navigate to="/projects" replace /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/projects" 
            element={
              <ProtectedRoute>
                <ProjectsListPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/projects/new" 
            element={
              <ProtectedRoute>
                <NewProjectPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/projects/:id/settings" 
            element={
              <ProtectedRoute>
                <ProjectSettingsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/projects/:id/dashboard" 
            element={
              <ProtectedRoute>
                <ProjectDashboardPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

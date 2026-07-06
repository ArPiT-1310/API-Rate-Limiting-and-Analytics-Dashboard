import React, { createContext, useState, useEffect, useContext } from 'react';
import { loginApi, signupApi, getMeApi, refreshApi } from '../api/auth.api.js';
import { setAccessToken, registerLogoutCallback } from '../api/axiosInstance.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync token changes to axiosInstance and local state
  const handleSetToken = (token) => {
    setAccessTokenState(token);
    setAccessToken(token);
  };

  const logout = () => {
    setUser(null);
    handleSetToken(null);
    // Note: Cookie clearing isn't strictly required for this simple version.
    // In production, we should call a backend logout endpoint (e.g., POST /auth/logout)
    // to clear the httpOnly refresh token cookie on the server.
  };

  const login = async (email, password) => {
    const data = await loginApi(email, password);
    setUser(data.user);
    handleSetToken(data.accessToken);
    return data;
  };

  const signup = async (name, email, password) => {
    const data = await signupApi(name, email, password);
    setUser(data.user);
    handleSetToken(data.accessToken);
    return data;
  };

  // Attempt refresh and me call on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Step 1: Call refresh to get a fresh token using the refresh cookie
        const refreshData = await refreshApi();
        const token = refreshData.accessToken;
        handleSetToken(token);
        
        // Step 2: Fetch user profile using the new access token
        const meData = await getMeApi();
        setUser(meData.user);
      } catch {
        // Silently fail if not logged in / no refresh token
        setUser(null);
        handleSetToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Register Axios callbacks to handle background refreshes and automatic sign-out
    registerLogoutCallback(logout);
    window.__updateAuthToken = (token) => {
      setAccessTokenState(token);
    };

    return () => {
      window.__updateAuthToken = null;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

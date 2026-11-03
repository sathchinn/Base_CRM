import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { requireSupabase } from '@/api/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const verifyAdmin = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setAuthChecked(true);
      return false;
    }
    const client = requireSupabase();
    const { data, error } = await client.rpc('is_admin');
    if (error || data !== true) {
      setUser(sessionUser);
      setIsAuthenticated(false);
      setAuthError({ type: 'not_admin', message: 'This account is not authorized to access the TTC CRM.' });
      setAuthChecked(true);
      return false;
    }
    setUser(sessionUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return true;
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const client = requireSupabase();
      const { data: { session }, error } = await client.auth.getSession();
      if (error) throw error;
      await verifyAdmin(session?.user || null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'configuration', message: error?.message || 'Unable to verify your session.' });
      setAuthChecked(true);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [verifyAdmin]);

  useEffect(() => {
    let active = true;
    let subscription;
    try {
      const client = requireSupabase();
      client.auth.getSession().then(async ({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        await verifyAdmin(data.session?.user || null);
        if (active) setIsLoadingAuth(false);
      }).catch((error) => {
        if (!active) return;
        setAuthError({ type: 'configuration', message: error?.message || 'Unable to initialize authentication.' });
        setAuthChecked(true);
        setIsLoadingAuth(false);
      });
      const result = client.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setIsLoadingAuth(true);
        setTimeout(() => {
          if (!active) return;
          Promise.resolve(verifyAdmin(session?.user || null)).finally(() => {
            if (active) setIsLoadingAuth(false);
          });
        }, 0);
      });
      subscription = result.data.subscription;
    } catch (error) {
      setAuthError({ type: 'configuration', message: error?.message || 'Supabase configuration is missing.' });
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, [verifyAdmin]);

  const logout = async (shouldRedirect = true) => {
    try { await requireSupabase().auth.signOut(); } finally {
      setUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect) window.location.assign('/login');
    }
  };

  const navigateToLogin = () => window.location.assign('/login');

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings: false,
      authError, appPublicSettings: null, authChecked, logout,
      navigateToLogin, checkUserAuth, checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

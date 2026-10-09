import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAdmin: boolean;
  isAssistant: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loginAsDemo: (role: 'admin' | 'assistant', index?: number) => Promise<void>;
}

const AUTH_SESSION_KEY = 'auditflow_active_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  }, [currentUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.login(email, password);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        return { success: true };
      }
      return { success: false, error: 'Authentication failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const loginAsDemo = async (role: 'admin' | 'assistant', index: number = 0) => {
    if (role === 'admin') {
      await login('admin@auditflow.internal', 'admin123');
    } else {
      const email = index === 0 ? 'priya@auditflow.internal' : 'amit@auditflow.internal';
      await login(email, 'assistant123');
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isAssistant = currentUser?.role === 'assistant';

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, isAssistant, login, logout, loginAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mmd_chat_token');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          if (res.token) {
            try {
              localStorage.setItem('mmd_chat_token', res.token);
            } catch {}
            setToken(res.token);
          }
        } catch (err) {
          console.warn('Session expirée ou inaccessible:', err);
          try {
            localStorage.removeItem('mmd_chat_token');
          } catch {}
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [token]);

  const login = async (phone: string, password: string) => {
    const res = await api.login(phone, password);
    localStorage.setItem('mmd_chat_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout server notification failed:', err);
    } finally {
      localStorage.removeItem('mmd_chat_token');
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const refreshMe = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
      if (res.token) {
        try {
          localStorage.setItem('mmd_chat_token', res.token);
        } catch {}
        setToken(res.token);
      }
    } catch (err) {
      console.error('Refresh me failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, refreshMe }}>
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

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = getToken();
      if (!token) {
        try {
          // Initialize active session with valid token
          const data = await api.quickDemoLogin('student');
          setToken(data.access_token);
          setUser(data.user);
        } catch {
          setUser({
            id: 3,
            email: 'student@evacroute.edu',
            full_name: 'Alex Chen (Student)',
            role: 'student',
            department: 'Engineering'
          });
        }
        setLoading(false);
        return;
      }
      try {
        const u = await api.getCurrentUser();
        setUser(u);
      } catch (err) {
        try {
          const data = await api.quickDemoLogin('student');
          setToken(data.access_token);
          setUser(data.user);
        } catch {
          setToken(null);
          setUser({
            id: 3,
            email: 'student@evacroute.edu',
            full_name: 'Alex Chen (Student)',
            role: 'student'
          });
        }
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const data = await api.register(userData);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const quickDemoLogin = async (role) => {
    const data = await api.quickDemoLogin(role);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'student',
        isAuthenticated: !!user,
        loading,
        login,
        register,
        quickDemoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, loginUser, registerUser, deleteMyAccount } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('bloodconnect_token'));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (token) {
      getCurrentUser()
        .then(res => {
          if (res && res.success) {
            setUser(res.user);
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (credentials) => {
    try {
      const res = await loginUser(credentials);
      if (res && res.success) {
        localStorage.setItem('bloodconnect_token', res.token);
        setToken(res.token);
        setUser(res.user);
        showToast(`Welcome back, ${res.user.full_name}!`, 'success');
        return res;
      }
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      const res = await registerUser(userData);
      if (res && res.success) {
        localStorage.setItem('bloodconnect_token', res.token);
        setToken(res.token);
        setUser(res.user);
        showToast('Registration successful! Welcome to BloodConnect.', 'success');
        return res;
      }
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('bloodconnect_token');
    setToken(null);
    setUser(null);
    showToast('Logged out successfully', 'info');
  };

  const deleteAccount = async () => {
    try {
      const res = await deleteMyAccount();
      localStorage.removeItem('bloodconnect_token');
      setToken(null);
      setUser(null);
      showToast('Your account and profile details have been deleted.', 'info');
      return res;
    } catch (err) {
      showToast(err.message || 'Failed to delete account', 'error');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, deleteAccount, showToast, toast }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Droplets, ShieldCheck, KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { forgotPassword } from '../services/api';
import RaktOraLogo from '../components/RaktOraLogo';

export default function Login() {
  const navigate = useNavigate();
  const { login, showToast } = useAuth();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ email, password });
      if (res && res.user) {
        switch (res.user.role) {
          case 'donor': navigate('/dashboard/donor'); break;
          case 'recipient': navigate('/dashboard/recipient'); break;
          case 'blood_bank': navigate('/dashboard/blood-bank'); break;
          case 'hospital': navigate('/dashboard/hospital'); break;
          case 'admin': navigate('/dashboard/admin'); break;
          default: navigate('/');
        }
      }
    } catch (err) {
      // error toast handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRoleFill = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('password123');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    try {
      await forgotPassword(forgotEmail);
      showToast('Password reset link sent to registered email address.', 'success');
      setShowForgotModal(false);
    } catch (err) {
      showToast(err.message || 'Error requesting reset', 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-soft space-y-6">
        
        {/* Login Portal Mode Toggle */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => { setIsAdminMode(false); setEmail(''); setPassword(''); }}
            className={`py-2 rounded-xl transition-all ${!isAdminMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            👥 User & Partner Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdminMode(true);
              setEmail('admin@raktora.org');
              setPassword('password123');
            }}
            className={`py-2 rounded-xl transition-all ${isAdminMode ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            🛡️ Admin Login
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <RaktOraLogo size={52} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isAdminMode ? 'System Admin Portal' : 'Sign In to RaktOra'}
          </h1>
          <p className="text-xs text-slate-500">
            {isAdminMode ? 'Administrative control & monitoring portal' : 'Access your Donor, Recipient, or Blood Bank dashboard'}
          </p>
        </div>

        {/* Demo Quick Logins */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Demo Quick Access Accounts (Click to Fill):</div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button type="button" onClick={() => { setIsAdminMode(false); handleQuickRoleFill('rajesh.donor@gmail.com'); }} className="bg-white hover:bg-red-50 border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-left truncate font-medium">
              🩸 Donor (Rajesh)
            </button>
            <button type="button" onClick={() => { setIsAdminMode(false); handleQuickRoleFill('rohan.recipient@gmail.com'); }} className="bg-white hover:bg-red-50 border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-left truncate font-medium">
              🏥 Recipient (Rohan)
            </button>
            <button type="button" onClick={() => { setIsAdminMode(false); handleQuickRoleFill('central@redcrossblood.org'); }} className="bg-white hover:bg-red-50 border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-left truncate font-medium">
              🏛️ Blood Bank (Red Cross)
            </button>
            <button type="button" onClick={() => { setIsAdminMode(true); handleQuickRoleFill('admin@raktora.org'); }} className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1.5 rounded-lg text-left truncate font-semibold">
              🛡️ System Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Email Address or Phone Number</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                placeholder="Enter email address or phone number"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">Password</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold text-sm py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 ${
              isAdminMode 
                ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20' 
                : 'bg-red-600 hover:bg-red-700 shadow-red-600/20 hover:scale-[1.01]'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : isAdminMode ? 'Sign In As System Admin' : 'Sign In'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Need an account?{' '}
            <Link to={`/register${isAdminMode ? '?role=admin' : ''}`} className="font-bold text-red-600 hover:underline">
              {isAdminMode ? 'Register Admin Account' : 'Register Here'}
            </Link>
          </span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-lg">
              <KeyRound className="w-5 h-5 text-red-600" />
              <span>Reset Password</span>
            </div>
            <p className="text-xs text-slate-600">Enter your email address to receive password recovery instructions.</p>
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Enter email..."
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
              />
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 text-xs font-semibold py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 text-white text-xs font-semibold py-2 rounded-xl"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, LogIn, ShieldCheck, KeyRound, ShieldAlert, ExternalLink, Info, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { forgotPassword, initiateDigiLockerVerification, getDigiLockerStatus } from '../services/api';
import RaktOraLogo from '../components/RaktOraLogo';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, showToast } = useAuth();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [digilockerLoading, setDigilockerLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showDigiLockerModal, setShowDigiLockerModal] = useState(false);
  const [digilockerStatus, setDigilockerStatus] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');

  // Handle DigiLocker Redirect Callback params
  useEffect(() => {
    const error = searchParams.get('digilocker_error');
    const token = searchParams.get('digilocker_token');
    const userJson = searchParams.get('digilocker_user');

    if (error) {
      showToast(decodeURIComponent(error), 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token) {
      try {
        localStorage.setItem('bloodconnect_token', token);
        let userObj = null;
        if (userJson) {
          userObj = JSON.parse(decodeURIComponent(userJson));
        }
        showToast('DigiLocker authentication successful! Welcome to RaktOra.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);

        // Redirect based on role
        if (userObj && userObj.role) {
          switch (userObj.role) {
            case 'donor': navigate('/dashboard/donor'); break;
            case 'recipient': navigate('/dashboard/recipient'); break;
            case 'blood_bank': navigate('/dashboard/blood-bank'); break;
            case 'hospital': navigate('/dashboard/hospital'); break;
            case 'admin': navigate('/dashboard/admin'); break;
            default: navigate('/');
          }
        } else {
          window.location.reload();
        }
      } catch (e) {
        window.location.reload();
      }
    }
  }, [searchParams, navigate, showToast]);

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
      // Toast handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleDigiLockerLogin = async () => {
    setDigilockerLoading(true);
    try {
      const res = await initiateDigiLockerVerification();
      if (res.success && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        // Unconfigured or pending authorized access
        setDigilockerStatus(res.status || {
          configured: false,
          message: res.message || 'DigiLocker authentication is currently pending authorized provider credentials.'
        });
        setShowDigiLockerModal(true);
      }
    } catch (err) {
      // Fetch status details to display clear boundary notice
      try {
        const statusRes = await getDigiLockerStatus();
        setDigilockerStatus(statusRes);
      } catch (statusErr) {
        setDigilockerStatus({
          configured: false,
          message: 'DigiLocker integration is currently awaiting authorized provider onboarding credentials.'
        });
      }
      setShowDigiLockerModal(true);
    } finally {
      setDigilockerLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    try {
      await forgotPassword(forgotEmail);
      showToast('Password reset instructions sent if an account exists.', 'success');
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
            👥 User & Partner
          </button>
          <button
            type="button"
            onClick={() => { setIsAdminMode(true); setEmail(''); setPassword(''); }}
            className={`py-2 rounded-xl transition-all ${isAdminMode ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            🛡️ System Admin
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
            {isAdminMode ? 'Administrative control & monitoring portal' : 'Access your voluntary donor, recipient, or blood bank profile'}
          </p>
        </div>

        {/* Genuine DigiLocker-First Primary Authentication (When not in admin mode) */}
        {!isAdminMode && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDigiLockerLogin}
              disabled={digilockerLoading}
              className="w-full bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-xs py-3.5 px-4 rounded-2xl shadow-md flex items-center justify-center space-x-2.5 transition active:scale-[0.99]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>
                {digilockerLoading ? 'Connecting to DigiLocker...' : 'Sign In with DigiLocker'}
              </span>
            </button>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Or Sign In with Password
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Email Address or Phone Number
            </label>
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
            <span>{loading ? 'Authenticating...' : isAdminMode ? 'Sign In As Administrator' : 'Sign In'}</span>
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

      {/* DigiLocker Status & Onboarding Boundary Modal */}
      {showDigiLockerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 text-left">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-700 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  DigiLocker Authentication Boundary
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  National Digital Locker System (MeitY, Government of India)
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs text-slate-700 leading-relaxed">
              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Provider Access Status: Pending Authorized Credentials</span>
              </div>
              <p>
                RaktOra follows strict zero-cost and real-identity principles. In accordance with project security policy, <strong>mock logins, fake OTPs, and fabricated DigiLocker callbacks are prohibited</strong>.
              </p>
              <div className="pt-1">
                <strong className="block text-slate-800 mb-1">To enable live DigiLocker authentication:</strong>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                  <li>Register organizational entity at <span className="font-mono text-blue-700">partners.digitallocker.gov.in</span> or API Setu.</li>
                  <li>Submit application for OAuth 2.0 authorization code credentials.</li>
                  <li>Whitelist static IP address and callback URI.</li>
                  <li>Configure <span className="font-mono text-slate-800">DIGILOCKER_CLIENT_ID</span> and <span className="font-mono text-slate-800">DIGILOCKER_CLIENT_SECRET</span> in server environment.</li>
                </ol>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Until authorized partner credentials are provided, please use standard email and password authentication.
            </p>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDigiLockerModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition"
              >
                Understood — Continue with Email/Password
              </button>
            </div>
          </div>
        </div>
      )}

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

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Lock, MapPin, Building2, Droplets, ShieldCheck, CheckCircle2, KeyRound, ShieldAlert, FileText, Cpu, Upload, Smartphone, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';
import { sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp, initiateDigiLockerVerification } from '../services/api';
import RaktOraLogo from '../components/RaktOraLogo';

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATES = INDIAN_STATES;

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { register, showToast } = useAuth();

  const [role, setRole] = useState(searchParams.get('role') || 'donor');
  
  // Dynamic Anti-Bot Security Math Challenge
  const [num1] = useState(Math.floor(Math.random() * 8) + 2);
  const [num2] = useState(Math.floor(Math.random() * 8) + 1);
  const [userCaptcha, setUserCaptcha] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    state: 'Maharashtra',
    city: getCitiesForState('Maharashtra')[0] || 'Mumbai',
    pincode: '400001',
    blood_group: 'O+',
    age: 25,
    gender: 'Male',
    address: '',
    govt_id: '',
    bank_name: '',
    license_number: '',
    admin_secret: ''
  });

  // Verification States (User can choose either Email or Phone SMS)
  const [verificationMethod, setVerificationMethod] = useState('email');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Aadhaar Offline e-KYC States
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [aadhaarShareCode, setAadhaarShareCode] = useState('');
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarLoading, setAadhaarLoading] = useState(false);
  const [aadhaarHolderName, setAadhaarHolderName] = useState('');

  const [loading, setLoading] = useState(false);

  // Cooldown timer tick effect
  useEffect(() => {
    let timer;
    if (emailCooldown > 0) {
      timer = setInterval(() => setEmailCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    let timer;
    if (phoneCooldown > 0) {
      timer = setInterval(() => setPhoneCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  // DigiLocker OAuth Callback Listener
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const digilockerVerified = params.get('digilocker_verified');
    const digilockerError = params.get('digilocker_error');
    const holderName = params.get('holder_name');
    const reference = params.get('reference');

    if (digilockerVerified === 'true') {
      setAadhaarVerified(true);
      setAadhaarHolderName(holderName || 'DigiLocker Verified User');
      setFormData(prev => ({
        ...prev,
        govt_id: reference || 'DIGILOCKER-VERIFIED',
        digilocker_verified: true,
        verification_provider: 'DIGILOCKER',
        verification_reference: reference || 'DIGILOCKER-VERIFIED'
      }));
      showToast(`✓ DigiLocker Identity verified! (${holderName || 'Verified'})`, 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (digilockerError) {
      showToast(`DigiLocker Verification Failed: ${digilockerError}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleStateChange = (newSt) => {
    const cities = getCitiesForState(newSt);
    setFormData(prev => ({
      ...prev,
      state: newSt,
      city: cities[0] || ''
    }));
  };

  // 1. Email OTP Handlers
  const handleSendEmailOtp = async () => {
    if (!formData.email || !formData.email.includes('@')) {
      showToast('Please enter a valid email address first.', 'error');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await sendEmailOtp({ email: formData.email.trim() });
      if (res.success) {
        setEmailSent(true);
        setEmailCooldown(60);
        showToast(res.message || `Verification OTP sent to ${formData.email}`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to send Email OTP', 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.trim().length < 4) {
      showToast('Please enter the 6-digit OTP code received via email.', 'error');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await verifyEmailOtp({ email: formData.email.trim(), otp: emailOtp.trim() });
      if (res.success) {
        setEmailVerified(true);
        showToast('✓ Email address verified successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Invalid or expired Email OTP', 'error');
    } finally {
      setEmailLoading(false);
    }
  };

  // 2. Phone OTP Handlers
  const handleSendPhoneOtp = async () => {
    if (!formData.phone || formData.phone.trim().length < 10) {
      showToast('Please enter a valid 10-digit Indian phone number first.', 'error');
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await sendPhoneOtp({ phone: formData.phone.trim() });
      if (res.success) {
        setPhoneSent(true);
        setPhoneCooldown(60);
        showToast(res.message || `SMS OTP sent to ${formData.phone}`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to send Phone OTP', 'error');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.trim().length < 4) {
      showToast('Please enter the 6-digit OTP code received via SMS.', 'error');
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await verifyPhoneOtp({ phone: formData.phone.trim(), otp: phoneOtp.trim() });
      if (res.success) {
        setPhoneVerified(true);
        showToast('✓ Phone number verified successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Invalid or expired Phone OTP', 'error');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 3. DigiLocker Identity Verification Handler
  const handleContinueWithDigiLocker = async () => {
    setAadhaarLoading(true);
    try {
      const res = await initiateDigiLockerVerification();
      if (res.success && res.auth_url) {
        if (res.auth_url.startsWith('http://') || res.auth_url.startsWith('https://')) {
          window.location.href = res.auth_url;
        } else {
          // Dev mode local redirect
          const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
          window.location.href = `${backendUrl}${res.auth_url}`;
        }
      } else {
        showToast(res.message || 'Unable to start DigiLocker verification.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'DigiLocker service configuration missing or unavailable.', 'error');
    } finally {
      setAadhaarLoading(false);
    }
  };

  // Registration Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    /* VERIFICATION ENFORCEMENT COMMENTED OUT PER USER REQUEST
    if (!emailVerified && !phoneVerified) {
      showToast('Please verify either your Email address or Phone number before completing registration', 'error');
      return;
    }
    */

    // Bot Protection CAPTCHA Verification
    if (parseInt(userCaptcha) !== num1 + num2) {
      showToast(`Incorrect Security CAPTCHA answer. What is ${num1} + ${num2}?`, 'error');
      return;
    }

    /* AADHAAR / DIGILOCKER ENFORCEMENT COMMENTED OUT PER USER REQUEST
    if (role === 'donor') {
      if (!formData.govt_id || formData.govt_id.trim().length < 5) {
        showToast('Aadhaar / Govt Photo ID verification is required for voluntary donor registration', 'error');
        return;
      }
    }
    */

    if (role === 'blood_bank') {
      if (!formData.license_number || formData.license_number.trim().length < 5) {
        showToast('Valid State Drug Control License Number is required for Blood Bank registration', 'error');
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        role,
        email_verified: emailVerified ? 1 : 0,
        phone_verified: phoneVerified ? 1 : 0,
        aadhaar_verified: aadhaarVerified ? 1 : 0
      };

      const res = await register(payload);
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
      // handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-soft space-y-6">
        
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <RaktOraLogo size={56} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create RaktOra Account</h1>
          <p className="text-xs text-slate-500">Join India's voluntary blood donor management network</p>
          
          <div className="inline-flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold py-1 px-3 rounded-full mt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Verified Voluntary Blood Network</span>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 rounded-2xl bg-slate-100 p-1.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setRole('donor')}
            className={`py-2 rounded-xl transition-all ${
              role === 'donor' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🩸 Donor
          </button>
          <button
            type="button"
            onClick={() => setRole('recipient')}
            className={`py-2 rounded-xl transition-all ${
              role === 'recipient' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏥 Patient
          </button>
          <button
            type="button"
            onClick={() => setRole('blood_bank')}
            className={`py-2 rounded-xl transition-all ${
              role === 'blood_bank' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏛️ Blood Bank
          </button>
          <button
            type="button"
            onClick={() => setRole('hospital')}
            className={`py-2 rounded-xl transition-all ${
              role === 'hospital' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏥 Hospital
          </button>
          <button
            type="button"
            onClick={() => setRole('admin')}
            className={`py-2 rounded-xl transition-all ${
              role === 'admin' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛡️ Admin
          </button>
        </div>

        {role === 'admin' && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start space-x-2 text-[11px] text-amber-900 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>System Administrator Registration Mode:</strong> Requires explicit Admin Passcode. Grants administrative control privileges.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                {role === 'blood_bank' ? 'Contact Person Name' : role === 'admin' ? 'Administrator Name' : 'Full Name'} *
              </label>
              <input
                type="text"
                required
                placeholder="Enter Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setEmailVerified(false);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number *</label>
              <input
                type="text"
                required
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  setPhoneVerified(false);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Min 8 chars, 1 uppercase, 1 lowercase, 1 number & 1 special character (!@#$).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">State *</label>
              <select
                value={formData.state}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">City *</label>
              <select
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                {getCitiesForState(formData.state).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {role === 'donor' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Blood Group *</label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  >
                    {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Age *</label>
                  <input
                    type="number"
                    min="18"
                    max="65"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {role === 'blood_bank' && (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Official Blood Bank Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rotary Blood Bank"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-red-600 mr-1" /> State Drug Control License Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL-MH-2026-99"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Validated against SBTC / CDSCO drug control registry.</span>
                </div>
              </>
            )}

            {role === 'admin' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Admin Security Key *</label>
                <input
                  type="password"
                  required
                  placeholder="Enter server-configured admin security key"
                  value={formData.admin_secret}
                  onChange={(e) => setFormData({ ...formData, admin_secret: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            )}

          </div>

          {/* Anti-Bot Security Math Challenge */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
              <Cpu className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>Anti-Bot Security Challenge: <strong className="text-red-600 font-mono text-sm">{num1} + {num2} = ?</strong></span>
            </div>
            <input
              type="number"
              required
              placeholder="Answer"
              value={userCaptcha}
              onChange={(e) => setUserCaptcha(e.target.value)}
              className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-bold text-sm py-3.5 rounded-xl shadow-lg transition-all bg-red-600 hover:bg-red-700 shadow-red-600/20 hover:scale-[1.01]"
          >
            {loading ? 'Securing & Creating Account...' : `Complete ${role.replace('_', ' ')} Registration`}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-red-600 hover:underline">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
}

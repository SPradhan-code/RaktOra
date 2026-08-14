import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Lock, MapPin, Building2, Droplets, ShieldCheck, CheckCircle2, KeyRound, ShieldAlert, FileText, Cpu, Upload, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';
import { sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp, verifyAadhaarEkyc } from '../services/api';
import { encryptPayload } from '../utils/cryptoUtils';
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
    admin_secret: 'ADMIN123'
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

  // 3. Aadhaar Offline e-KYC Verification Handler
  const handleVerifyAadhaarEkyc = async (e) => {
    e.preventDefault();
    if (!aadhaarFile) {
      showToast('Please select your official UIDAI Aadhaar Offline e-KYC ZIP file.', 'error');
      return;
    }

    if (!aadhaarShareCode || aadhaarShareCode.trim().length < 4) {
      showToast('Please enter the 4-digit Share Code for your e-KYC ZIP file.', 'error');
      return;
    }

    setAadhaarLoading(true);
    try {
      const data = new FormData();
      data.append('zipFile', aadhaarFile);
      data.append('shareCode', aadhaarShareCode.trim());

      const res = await verifyAadhaarEkyc(data);
      if (res.success) {
        setAadhaarVerified(true);
        setAadhaarHolderName(res.holder_name || 'Aadhaar Verified Holder');
        setFormData(prev => ({ ...prev, govt_id: res.reference || 'AADHAAR-EKYC-VERIFIED' }));
        showToast(`✓ Aadhaar Offline e-KYC verified! (${res.holder_name || 'Verified'})`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Aadhaar e-KYC verification failed. Check share code.', 'error');
    } finally {
      setAadhaarLoading(false);
    }
  };

  // Registration Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!emailVerified && !phoneVerified) {
      showToast('Please verify either your Email address or Phone number before completing registration', 'error');
      return;
    }

    // Bot Protection CAPTCHA Verification
    if (parseInt(userCaptcha) !== num1 + num2) {
      showToast(`Incorrect Security CAPTCHA answer. What is ${num1} + ${num2}?`, 'error');
      return;
    }

    // Role-specific Verification Checks
    if (role === 'donor') {
      if (!formData.govt_id || formData.govt_id.trim().length < 5) {
        showToast('Aadhaar / Govt Photo ID verification is required for voluntary donor registration', 'error');
        return;
      }
    }

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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Verified RaktOra Account</h1>
          <p className="text-xs text-slate-500">Join India's encrypted, production-verified voluntary blood network</p>
          
          <div className="inline-flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold py-1 px-3 rounded-full mt-1">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>End-to-End Encrypted & Production Verified</span>
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
                  type="text"
                  required
                  placeholder="ADMIN123"
                  value={formData.admin_secret}
                  onChange={(e) => setFormData({ ...formData, admin_secret: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            )}

          </div>

          {/* ============================================================================ */}
          {/* VERIFICATION SECTION: CHOOSE EMAIL OR PHONE SMS OTP VERIFICATION */}
          {/* ============================================================================ */}
          <div className="space-y-4 pt-2">
            
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select Verification Method (Verify 1 Required)
                </span>
                {(emailVerified || phoneVerified) && (
                  <span className="text-emerald-700 text-[11px] font-extrabold flex items-center bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    {emailVerified ? 'Email Verified' : 'Phone Verified'}
                  </span>
                )}
              </div>

              {/* Verification Method Chooser Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setVerificationMethod('email')}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all ${
                    verificationMethod === 'email'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-4 h-4 text-red-600" />
                  <span>Verify via Email</span>
                  {emailVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-1" />}
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationMethod('phone')}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all ${
                    verificationMethod === 'phone'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-red-600" />
                  <span>Verify via Phone SMS</span>
                  {phoneVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-1" />}
                </button>
              </div>

              {/* Method 1: Email OTP */}
              {verificationMethod === 'email' && (
                <div className="pt-2 space-y-3">
                  {!emailVerified ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 font-medium">
                        Verification code will be sent to email: <strong className="text-slate-800">{formData.email || 'your email'}</strong>
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter 6-digit Email OTP"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono tracking-wider focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                        {!emailSent ? (
                          <button
                            type="button"
                            disabled={emailLoading}
                            onClick={handleSendEmailOtp}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                          >
                            {emailLoading ? 'Sending...' : 'Send OTP'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={emailLoading}
                            onClick={handleVerifyEmailOtp}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                          >
                            {emailLoading ? 'Verifying...' : 'Verify Email'}
                          </button>
                        )}
                      </div>

                      {emailSent && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>OTP sent to email address</span>
                          {emailCooldown > 0 ? (
                            <span className="text-slate-400 font-medium">Resend in {emailCooldown}s</span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendEmailOtp}
                              className="text-red-600 font-bold hover:underline"
                            >
                              Resend Email OTP
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Your email address ({formData.email}) is verified.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Method 2: Phone SMS OTP */}
              {verificationMethod === 'phone' && (
                <div className="pt-2 space-y-3">
                  {!phoneVerified ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 font-medium">
                        SMS OTP code will be sent to phone: <strong className="text-slate-800">{formData.phone || 'your phone number'}</strong>
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter 6-digit SMS OTP"
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono tracking-wider focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                        {!phoneSent ? (
                          <button
                            type="button"
                            disabled={phoneLoading}
                            onClick={handleSendPhoneOtp}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                          >
                            {phoneLoading ? 'Sending...' : 'Send OTP'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={phoneLoading}
                            onClick={handleVerifyPhoneOtp}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                          >
                            {phoneLoading ? 'Verifying...' : 'Verify Phone'}
                          </button>
                        )}
                      </div>

                      {phoneSent && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>SMS OTP sent to {formData.phone}</span>
                          {phoneCooldown > 0 ? (
                            <span className="text-slate-400 font-medium">Resend in {phoneCooldown}s</span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendPhoneOtp}
                              className="text-red-600 font-bold hover:underline"
                            >
                              Resend SMS OTP
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Your phone number ({formData.phone}) is verified.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. AADHAAR OFFLINE E-KYC VERIFICATION (REQUIRED FOR DONORS) */}
            {role === 'donor' && (
              <div className="bg-red-50/60 border border-red-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-red-900 uppercase">
                    <FileText className="w-4 h-4 text-red-600" />
                    <span>Aadhaar Verification (UIDAI Offline e-KYC)</span>
                  </div>
                  {aadhaarVerified && (
                    <span className="text-emerald-700 text-[11px] font-extrabold flex items-center bg-emerald-100 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Aadhaar Verified
                    </span>
                  )}
                </div>

                {!aadhaarVerified ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Your Aadhaar identity must be verified before you can complete donor registration. Upload your official <strong>UIDAI Offline e-KYC ZIP</strong> file and enter its 4-digit Share Code.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Upload e-KYC ZIP *</label>
                        <input
                          type="file"
                          accept=".zip"
                          onChange={(e) => setAadhaarFile(e.target.files[0])}
                          className="w-full bg-white text-xs border border-slate-200 rounded-xl px-2 py-1.5 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Share Code (4-digit) *</label>
                        <input
                          type="password"
                          maxLength="4"
                          placeholder="e.g. 1234"
                          value={aadhaarShareCode}
                          onChange={(e) => setAadhaarShareCode(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono tracking-widest focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={aadhaarLoading}
                      onClick={handleVerifyAadhaarEkyc}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-red-400" />
                      <span>{aadhaarLoading ? 'Processing UIDAI e-KYC...' : 'Verify Aadhaar e-KYC'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-100/80 border border-emerald-300 p-3 rounded-xl flex items-center space-x-2 text-emerald-900 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>UIDAI e-KYC Verified for: <strong>{aadhaarHolderName}</strong></span>
                  </div>
                )}
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
            disabled={loading || (!emailVerified && !phoneVerified)}
            className={`w-full text-white font-bold text-sm py-3.5 rounded-xl shadow-lg transition-all ${
              (emailVerified || phoneVerified) 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20 hover:scale-[1.01]' 
                : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Securing & Creating Account...' : `Complete Verified ${role.replace('_', ' ')} Registration`}
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

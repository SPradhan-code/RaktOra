import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toggleAvailability, updateDonorProfile, getBloodRequests, checkEligibility, getMyAppointments, bookAppointment, rescheduleAppointment, cancelAppointment, getBloodBanks, getPrivacyPreferences, updatePrivacyPreferences, pledgeEmergencyResponse, deleteMyAccount } from '../../services/api';
import { User, Heart, Calendar, Award, CheckCircle2, AlertTriangle, Droplets, MapPin, Phone, ShieldCheck, Trash2, Clock, PlusCircle, RefreshCw, XCircle, Bell, Lock, Shield } from 'lucide-react';

export default function DonorDashboard() {
  const navigate = useNavigate();
  const { user, showToast, deleteAccount } = useAuth();
  const [profile, setProfile] = useState(user?.profile || {});
  const [available, setAvailable] = useState(user?.profile?.is_available === 1 || user?.profile?.is_available === true);
  const [requests, setRequests] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);

  // Notification & Privacy Preferences state
  const [privacyPrefs, setPrivacyPrefs] = useState({
    emergency_alerts_enabled: true,
    available_for_donation: true,
    emergency_sms: true,
    emergency_email: true,
    emergency_push: true,
    appointment_reminders: true,
    camp_notifications: true
  });

  const [editing, setEditing] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Appt Booking Form State
  const [selectedBankId, setSelectedBankId] = useState('');
  const [apptDate, setApptDate] = useState(new Date().toISOString().split('T')[0]);
  const [apptSlot, setApptSlot] = useState('10:00 AM');

  const [form, setForm] = useState({
    blood_group: user?.profile?.blood_group || 'O+',
    age: user?.profile?.age || 25,
    gender: user?.profile?.gender || 'Male',
    weight: user?.profile?.weight || 70,
    last_donation_date: user?.profile?.last_donation_date || '',
    address: user?.profile?.address || ''
  });

  const fetchDonorData = async () => {
    try {
      if (user?.profile) {
        setProfile(user.profile);
        setAvailable(user.profile.is_available === 1 || user.profile.is_available === true);
        setForm({
          blood_group: user.profile.blood_group || 'O+',
          age: user.profile.age || 25,
          gender: user.profile.gender || 'Male',
          weight: user.profile.weight || 70,
          last_donation_date: user.profile.last_donation_date || '',
          address: user.profile.address || ''
        });
      }

      // 1. Fetch Eligibility
      const elRes = await checkEligibility();
      if (elRes.success) setEligibility(elRes.eligibility);

      // 2. Fetch Privacy & Notification Preferences
      const prefRes = await getPrivacyPreferences();
      if (prefRes.success) setPrivacyPrefs(prefRes.preferences);

      // 3. Fetch Appointments
      const apRes = await getMyAppointments();
      if (apRes.success) setAppointments(apRes.appointments);

      // 4. Fetch Emergency Requests
      const rRes = await getBloodRequests();
      if (rRes.requests) setRequests(rRes.requests.filter(r => r.status === 'Pending' || r.status === 'APPROVED' || r.status === 'MATCHING'));

      // 5. Fetch Blood Banks for booking
      const bRes = await getBloodBanks();
      if (bRes.bloodBanks) {
        setBloodBanks(bRes.bloodBanks);
        if (bRes.bloodBanks.length > 0) setSelectedBankId(bRes.bloodBanks[0].id);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchDonorData();
  }, [user]);

  const handleToggle = async () => {
    const nextState = !available;
    try {
      await toggleAvailability(nextState);
      setAvailable(nextState);
      setPrivacyPrefs(prev => ({ ...prev, available_for_donation: nextState }));
      showToast(`Availability updated to ${nextState ? 'Available' : 'Unavailable'}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handlePrefToggle = async (key) => {
    const nextValue = !privacyPrefs[key];
    const updated = { ...privacyPrefs, [key]: nextValue };
    setPrivacyPrefs(updated);
    try {
      await updatePrivacyPreferences(updated);
      showToast('Notification & privacy preference updated', 'success');
    } catch (err) {
      showToast('Failed to update preference', 'error');
    }
  };

  const handlePledgeResponse = async (reqId) => {
    try {
      const res = await pledgeEmergencyResponse(reqId);
      if (res.success) {
        showToast(res.message, 'success');
        fetchDonorData();
      }
    } catch (err) {
      showToast(err.message || 'Pledge failed', 'error');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await updateDonorProfile(form);
      if (res.success) {
        setProfile(res.donor);
        setEditing(false);
        showToast('Donor credentials updated successfully!', 'success');
        fetchDonorData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedBankId) {
      showToast('Please select a Blood Bank center', 'error');
      return;
    }

    try {
      const res = await bookAppointment({
        blood_bank_id: selectedBankId,
        date: apptDate,
        start_time: apptSlot
      });
      if (res.success) {
        showToast('Donation appointment booked successfully!', 'success');
        setShowApptModal(false);
        fetchDonorData();
      }
    } catch (err) {
      showToast(err.message || 'Booking failed', 'error');
    }
  };

  const handleCancelAppointment = async (apptId) => {
    try {
      const res = await cancelAppointment(apptId);
      if (res.success) {
        showToast('Appointment cancelled', 'success');
        fetchDonorData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to cancel appointment', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {}
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <img
            src={profile.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'Donor')}&background=E53935&color=fff`}
            alt="Profile"
            className="w-16 h-16 rounded-2xl ring-4 ring-red-100 shadow-md object-cover"
          />
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center">
              Welcome, {user?.full_name}!
              <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-2" title="Verified Donor" />
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" /> {user?.city}, {user?.state} • Donor ID #DON-{user?.id}
            </p>
          </div>
        </div>

        {/* Availability Switch & Book Appt */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowApptModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Donation Appointment</span>
          </button>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center space-x-3">
            <div>
              <div className="text-[11px] font-bold text-slate-700">Availability</div>
              <div className="text-[10px] text-slate-500">{available ? 'Online' : 'Offline'}</div>
            </div>
            <button
              onClick={handleToggle}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${available ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${available ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* SMART ELIGIBILITY CARD */}
      {eligibility && (
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          eligibility.isEligible ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center space-x-2 font-black text-sm uppercase tracking-wide">
              {eligibility.isEligible ? (
                <span className="text-emerald-700 flex items-center"><CheckCircle2 className="w-5 h-5 mr-1 text-emerald-600" /> ELIGIBLE FOR BLOOD DONATION</span>
              ) : (
                <span className="text-amber-800 flex items-center"><AlertTriangle className="w-5 h-5 mr-1 text-amber-600" /> {eligibility.status.replace('_', ' ')}</span>
              )}
            </div>
            <p className="text-xs opacity-90">
              {eligibility.isEligible 
                ? 'You meet all National Blood Transfusion Council (NBTC) health & interval criteria.' 
                : eligibility.reasons.join(' ')}
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xs px-4 py-2 rounded-2xl border border-slate-200/60 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Next Eligible Date</span>
            <span className="text-sm font-black text-slate-900">{eligibility.next_eligible_date}</span>
          </div>
        </div>
      )}

      {/* Grid: Profile Details & Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Health Info & Appointments */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Health Credentials */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="font-bold text-slate-900 text-lg flex items-center">
                <User className="w-5 h-5 text-red-600 mr-2" /> Donor Health Credentials
              </h3>
              <button onClick={() => setEditing(!editing)} className="text-xs font-bold text-red-600 hover:underline">
                {editing ? 'Cancel' : 'Edit Credentials'}
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Blood Group</label>
                  <select value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-red-600">
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Age</label>
                  <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Weight (kg)</label>
                  <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Last Donation Date</label>
                  <input type="date" value={form.last_donation_date} onChange={(e) => setForm({ ...form, last_donation_date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="bg-red-600 text-white font-bold text-xs py-2.5 px-6 rounded-xl">Save Changes</button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-medium block">Blood Group</span>
                  <span className="text-xl font-black text-red-600">{profile.blood_group || 'O+'}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-medium block">Age & Gender</span>
                  <span className="font-bold text-slate-800 text-sm">{profile.age || 25} yrs / {profile.gender || 'Male'}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-medium block">Total Donations</span>
                  <span className="font-bold text-slate-800 text-sm">{profile.total_donations || 0} Times</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 font-medium block">Last Donated</span>
                  <span className="font-bold text-slate-800 text-sm">{profile.last_donation_date || 'None'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Appointments List */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center justify-between">
              <span className="flex items-center"><Calendar className="w-5 h-5 text-red-600 mr-2" /> Scheduled Appointments ({appointments.length})</span>
              <button onClick={() => setShowApptModal(true)} className="text-xs text-red-600 font-bold hover:underline">+ Book New</button>
            </h3>

            {appointments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                No active appointments. Book an appointment at an accredited Blood Centre.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map(a => (
                  <div key={a.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{a.blood_bank_name}</h4>
                      <p className="text-slate-500 font-medium mt-0.5">{a.date} at {a.start_time} • {a.city}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                        a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        a.status === 'BOOKED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {a.status}
                      </span>
                      {a.status === 'BOOKED' && (
                        <button onClick={() => handleCancelAppointment(a.id)} className="text-red-600 font-bold hover:underline">Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incoming Emergency Requests Stream */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center">
              <Droplets className="w-5 h-5 text-red-600 mr-2 fill-current" />
              Matching Emergency Blood Requests ({requests.length})
            </h3>

            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">{r.blood_group}</span>
                      <span className="font-bold text-slate-900 text-sm">{r.patient_name}</span>
                      <span className="text-xs text-slate-500 font-medium">• {r.units_needed} Unit(s)</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Hospital: <strong>{r.hospital_name}</strong> ({r.city})
                    </div>
                  </div>
                  <button
                    onClick={() => handlePledgeResponse(r.id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
                  >
                    Respond & Pledge
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Donor Pass, Privacy Controls & Security */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 text-white rounded-3xl p-6 shadow-2xl border border-slate-700 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
              <span className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1" /> RaktOra Donor Pass
              </span>
              <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded font-extrabold">VERIFIED</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl text-red-400 border border-white/20">
                {profile.blood_group || 'O+'}
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">{user?.full_name}</h4>
                <p className="text-xs text-slate-300">{user?.city}, India</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Privacy Protected</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
              <div>
                <span>Registered Member</span>
                <div className="font-semibold text-slate-200">Voluntary Lifesaver</div>
              </div>
              <div className="text-right">
                <span>Total Donations</span>
                <div className="font-semibold text-red-400">{profile.total_donations || 0} Units</div>
              </div>
            </div>
          </div>

          {/* PRIVACY & NOTIFICATION PREFERENCES CARD */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase text-slate-900 tracking-wider flex items-center">
              <Bell className="w-4 h-4 mr-1.5 text-red-600" /> Privacy & Notification Controls
            </h4>

            <div className="space-y-3 text-xs font-medium">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <span>Receive Emergency Alerts</span>
                <button
                  type="button"
                  onClick={() => handlePrefToggle('emergency_alerts_enabled')}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors ${privacyPrefs.emergency_alerts_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacyPrefs.emergency_alerts_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <span>Emergency SMS</span>
                <button
                  type="button"
                  onClick={() => handlePrefToggle('emergency_sms')}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors ${privacyPrefs.emergency_sms ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacyPrefs.emergency_sms ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <span>Emergency Email</span>
                <button
                  type="button"
                  onClick={() => handlePrefToggle('emergency_email')}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors ${privacyPrefs.emergency_email ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacyPrefs.emergency_email ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <span>Appointment Reminders</span>
                <button
                  type="button"
                  onClick={() => handlePrefToggle('appointment_reminders')}
                  className={`w-10 h-6 rounded-full p-0.5 transition-colors ${privacyPrefs.appointment_reminders ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacyPrefs.appointment_reminders ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-red-100 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase text-red-900 tracking-wider flex items-center">
              <Trash2 className="w-4 h-4 mr-1.5 text-red-600" /> Account Security
            </h4>
            <button onClick={() => setShowDeleteModal(true)} className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs py-2.5 rounded-xl border border-red-200 transition-all flex items-center justify-center space-x-1">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete My Account</span>
            </button>
          </div>
        </div>

      </div>

      {/* Book Appointment Modal */}
      {showApptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center">
                <Calendar className="w-5 h-5 text-red-600 mr-2" /> Book Donation Appointment
              </h3>
              <button onClick={() => setShowApptModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Blood Bank *</label>
                <select
                  value={selectedBankId}
                  onChange={e => setSelectedBankId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  {bloodBanks.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={apptDate}
                  onChange={e => setApptDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Time Slot *</label>
                <select
                  value={apptSlot}
                  onChange={e => setApptSlot(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  <option value="09:00 AM">09:00 AM - 10:00 AM</option>
                  <option value="10:00 AM">10:00 AM - 11:00 AM</option>
                  <option value="11:00 AM">11:00 AM - 12:00 PM</option>
                  <option value="02:00 PM">02:00 PM - 03:00 PM</option>
                  <option value="04:00 PM">04:00 PM - 05:00 PM</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl shadow-md mt-2">
                Confirm & Book Appointment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
              <AlertTriangle className="w-6 h-6" />
              <span>Delete Account?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">Permanently delete account? This cannot be undone.</p>
            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 bg-slate-100 text-slate-700 text-xs font-semibold py-2.5 rounded-xl">Cancel</button>
              <button type="button" onClick={handleDeleteAccount} className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

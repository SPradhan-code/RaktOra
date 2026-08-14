import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Send, Building2, User, Phone, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import { createBloodRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function EmergencyRequest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, showToast } = useAuth();

  const [formData, setFormData] = useState({
    patient_name: '',
    blood_group: searchParams.get('blood_group') || 'O+',
    units_needed: 2,
    hospital_name: '',
    hospital_address: '',
    state: 'Maharashtra',
    city: getCitiesForState('Maharashtra')[0] || 'Mumbai',
    urgency_level: 'Urgent',
    contact_number: user ? user.phone : '',
    required_by_date: new Date().toISOString().split('T')[0]
  });

  const handleStateChange = (newSt) => {
    const cities = getCitiesForState(newSt);
    setFormData(prev => ({
      ...prev,
      state: newSt,
      city: cities[0] || ''
    }));
  };

  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Please sign in to post an official blood request', 'error');
      navigate('/login');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBloodRequest(formData);
      if (res.success) {
        setSuccessData(res);
        showToast('Emergency request broadcasted successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-3xl p-8 shadow-xl space-y-2 relative overflow-hidden">
        <div className="inline-flex items-center bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider mb-1">
          <AlertTriangle className="w-4 h-4 mr-1 text-amber-300" />
          24/7 SOS Broadcast Pipeline
        </div>
        <h1 className="text-3xl font-black tracking-tight">Post Emergency Blood Request</h1>
        <p className="text-red-100 text-xs sm:text-sm max-w-xl leading-relaxed">
          Broadcast your urgent requirement immediately to nearby registered donors, voluntary groups, and partner blood banks.
        </p>
      </div>

      {successData ? (
        <div className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-card text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Request Broadcasted Successfully!</h2>
            <p className="text-slate-600 text-xs max-w-md mx-auto">
              Your SOS alert for <strong>{formData.units_needed} unit(s) of {formData.blood_group}</strong> has been transmitted to eligible donors in {formData.city}.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-left max-w-md mx-auto space-y-1">
            <div><strong className="text-slate-700">Patient:</strong> {formData.patient_name}</div>
            <div><strong className="text-slate-700">Hospital:</strong> {formData.hospital_name}, {formData.city}</div>
            <div><strong className="text-slate-700">Contact:</strong> {formData.contact_number}</div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate('/dashboard/recipient')}
              className="bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-sm"
            >
              Track Request Status in Dashboard
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-card space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Patient Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Patient Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Required Blood Group *
              </label>
              <select
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-red-600 focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Units Needed */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Units Required *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                required
                value={formData.units_needed}
                onChange={(e) => setFormData({ ...formData, units_needed: parseInt(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            {/* Urgency Level */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Urgency Level
              </label>
              <select
                value={formData.urgency_level}
                onChange={(e) => setFormData({ ...formData, urgency_level: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="Critical">Critical (Immediate - Within 2 Hours)</option>
                <option value="Urgent">Urgent (Within 6-12 Hours)</option>
                <option value="Standard">Standard (Planned Surgery)</option>
              </select>
            </div>

            {/* Hospital Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Hospital Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo Hospital, Max Healthcare..."
                  value={formData.hospital_name}
                  onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                State *
              </label>
              <select
                value={formData.state}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                City / Location *
              </label>
              <select
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                {getCitiesForState(formData.state).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Attendant Emergency Contact *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="+91 9876543210"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Hospital Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Full Hospital Address & Ward No.
              </label>
              <textarea
                rows="2"
                placeholder="e.g. ICU Ward 3, 4th Floor, Main Building, Bandra West"
                value={formData.hospital_address}
                onChange={(e) => setFormData({ ...formData, hospital_address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-4 rounded-xl shadow-lg shadow-red-600/20 hover:scale-[1.01] transition-all flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Broadcasting SOS...' : 'Transmit Emergency Request'}</span>
          </button>
        </form>
      )}

    </div>
  );
}

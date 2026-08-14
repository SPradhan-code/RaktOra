import React, { useState, useEffect } from 'react';
import { HeartHandshake, Search, Calendar, MapPin, RefreshCw } from 'lucide-react';
import CampCard from '../components/CampCard';
import { getDonationCamps, registerForCamp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';

const STATES = ['All', ...INDIAN_STATES];

export default function DonationCamps() {
  const { showToast, user } = useAuth();
  const [state, setState] = useState('All');
  const [city, setCity] = useState('');

  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCamps = () => {
    setLoading(true);
    getDonationCamps({ state, city })
      .then(res => setCamps(res.camps || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleStateChange = (newSt) => {
    setState(newSt);
    const cities = getCitiesForState(newSt);
    if (city && newSt !== 'All' && !cities.includes(city)) {
      setCity('');
    }
  };

  useEffect(() => {
    fetchCamps();
  }, [state]);

  const handleRegister = async (camp) => {
    if (!user) {
      showToast('Please sign in to register for blood donation camp', 'info');
      return;
    }
    try {
      const res = await registerForCamp(camp.id);
      if (res.success) {
        showToast(`Registered successfully for ${camp.camp_title}!`, 'success');
        fetchCamps();
      }
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
          <HeartHandshake className="w-8 h-8 text-red-600 mr-2" />
          Blood Donation Camps & Mobile Drives
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Join community blood donation drives organized by Red Cross, Rotary, Lions Club, and corporate partners.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); fetchCamps(); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">State</label>
            <select
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="">All Cities</option>
              {getCitiesForState(state).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1"
            >
              <Search className="w-4 h-4" />
              <span>Find Camps</span>
            </button>
          </div>
        </form>
      </div>

      {/* Camps List */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
          <span>Loading camp schedule...</span>
        </div>
      ) : camps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {camps.map(camp => (
            <CampCard key={camp.id} camp={camp} onRegister={handleRegister} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">No Camps Scheduled in Selected Location</h3>
          <p className="text-xs text-slate-500">Check back soon or explore neighboring cities.</p>
        </div>
      )}

    </div>
  );
}

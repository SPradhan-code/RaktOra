import React, { useState, useEffect } from 'react';
import { Building2, Search, MapPin, RefreshCw } from 'lucide-react';
import BloodBankCard from '../components/BloodBankCard';
import { getBloodBanks } from '../services/api';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';

const STATES = ['All', ...INDIAN_STATES];
const GROUPS = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodBanks() {
  const [state, setState] = useState('All');
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState('All');

  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBanks = () => {
    setLoading(true);
    getBloodBanks({ state, city, blood_group: bloodGroup })
      .then(res => setBanks(res.bloodBanks || []))
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
    fetchBanks();
  }, [state, bloodGroup]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
          <Building2 className="w-8 h-8 text-red-600 mr-2" />
          Licensed Blood Banks & Storage Centres
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Explore real-time blood stock matrices across accredited government and Red Cross blood banks in India.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); fetchBanks(); }} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          
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
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Blood Group Stock</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              {GROUPS.map(g => <option key={g} value={g}>{g === 'All' ? 'All Blood Groups' : g}</option>)}
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
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1"
            >
              <Search className="w-4 h-4" />
              <span>Search Banks</span>
            </button>
          </div>
        </form>
      </div>

      {/* Blood Banks Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
          <span>Fetching live blood bank stock updates...</span>
        </div>
      ) : banks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banks.map(bank => (
            <BloodBankCard key={bank.id} bank={bank} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">No Blood Banks Found</h3>
          <p className="text-xs text-slate-500">Try broadening your city or state filters.</p>
        </div>
      )}

    </div>
  );
}

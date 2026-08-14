import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Droplets, MapPin } from 'lucide-react';
import DonorCard from '../components/DonorCard';
import { searchDonors } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';

const GROUPS = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATES = ['All', ...INDIAN_STATES];

export default function SearchDonors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useAuth();

  const [bloodGroup, setBloodGroup] = useState(searchParams.get('blood_group') || 'All');
  const [state, setState] = useState(searchParams.get('state') || 'All');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [availableOnly, setAvailableOnly] = useState(true);

  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDonors = (bg = bloodGroup, st = state, ct = city, avail = availableOnly) => {
    setLoading(true);
    const filters = {};
    if (bg && bg !== 'All' && bg !== 'All Blood Groups') {
      filters.blood_group = bg;
    }
    if (st && st !== 'All' && st !== 'All States') {
      filters.state = st;
    }
    if (ct && ct.trim() !== '') {
      filters.city = ct.trim();
    }
    if (avail) {
      filters.is_available = 'true';
    }

    searchDonors(filters)
      .then(res => {
        if (res.success) {
          setDonors(res.donors || []);
        }
      })
      .catch(err => showToast(err.message || 'Error fetching donors', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const bgParam = searchParams.get('blood_group') || 'All';
    const stateParam = searchParams.get('state') || 'All';
    const cityParam = searchParams.get('city') || '';
    setBloodGroup(bgParam);
    setState(stateParam);
    setCity(cityParam);
    fetchDonors(bgParam, stateParam, cityParam, availableOnly);
  }, [searchParams, availableOnly]);

  const handleStateChange = (newSt) => {
    setState(newSt);
    const availableCities = getCitiesForState(newSt);
    let nextCity = city;
    if (city && newSt !== 'All' && !availableCities.includes(city)) {
      nextCity = '';
      setCity('');
    }
    fetchDonors(bloodGroup, newSt, nextCity, availableOnly);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams();
    if (bloodGroup !== 'All') newParams.set('blood_group', bloodGroup);
    if (state !== 'All') newParams.set('state', state);
    if (city.trim()) newParams.set('city', city.trim());
    setSearchParams(newParams);
  };

  const handleReset = () => {
    setBloodGroup('All');
    setState('All');
    setCity('');
    setAvailableOnly(false);
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
          <Droplets className="w-8 h-8 text-red-600 mr-2 fill-current" />
          Find Voluntary Blood Donors
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Search verified voluntary donors by blood group, state, city, and immediate availability.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => {
                const val = e.target.value;
                setBloodGroup(val);
                fetchDonors(val, state, city, availableOnly);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              {GROUPS.map(g => <option key={g} value={g}>{g === 'All' ? 'All Blood Groups' : g}</option>)}
            </select>
          </div>

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
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">City / District</label>
            <select
              value={city}
              onChange={(e) => {
                const val = e.target.value;
                setCity(val);
                fetchDonors(bloodGroup, state, val, availableOnly);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="">All Cities</option>
              {getCitiesForState(state).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-end space-x-2">
            <button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-1"
            >
              <Search className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-slate-300"
            />
            <span className="font-semibold text-slate-700">Show Available Donors Only</span>
          </label>

          <span className="text-slate-500 font-medium">
            Found <strong className="text-slate-900">{donors.length}</strong> matching donors
          </span>
        </div>
      </div>

      {/* Donors Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
          <span>Searching donor registry...</span>
        </div>
      ) : donors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {donors.map(donor => (
            <DonorCard
              key={donor.id}
              donor={donor}
              onRequest={() => navigate(`/emergency-request?blood_group=${donor.blood_group}`)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <Droplets className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Donors Matched Your Filter</h3>
          <p className="text-slate-600 text-xs max-w-md mx-auto">
            Try adjusting your search state or city, or post an Emergency Request to broadcast alerts to all surrounding regions.
          </p>
          <button
            onClick={handleReset}
            className="bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

    </div>
  );
}

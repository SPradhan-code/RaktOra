import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, Droplets, AlertTriangle, ShieldCheck, Heart, Users, Building2, 
  MapPin, ArrowRight, Activity, Calendar, CheckCircle2, ChevronRight, 
  Phone, HelpCircle, ChevronDown, ChevronUp, Clock, Award, Sparkles, Zap
} from 'lucide-react';
import BloodGroupCard from '../components/BloodGroupCard';
import DonorCard from '../components/DonorCard';
import BloodBankCard from '../components/BloodBankCard';
import CampCard from '../components/CampCard';
import { getBloodBanks, getDonationCamps, getBloodRequests, searchDonors } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStatesAndCities';

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATES = ['All States', ...INDIAN_STATES];

const HOME_FAQS = [
  {
    q: 'Who is eligible to donate blood in India?',
    a: 'Any healthy adult aged 18 to 65 years, weighing at least 45 kg, with a pulse rate of 60-100 bpm and hemoglobin level above 12.5 g/dL can donate blood.'
  },
  {
    q: 'How frequently can I donate blood safely?',
    a: 'Male donors can donate whole blood every 3 months (90 days), while female donors can donate every 4 months (120 days) to allow iron levels to fully regenerate.'
  },
  {
    q: 'How does the Emergency Blood Request system work?',
    a: 'When you submit an emergency request, RaktOra immediately matches your required blood group & hospital location, broadcasting real-time SMS & app alerts to nearby verified donors.'
  },
  {
    q: 'Is my personal contact information safe on RaktOra?',
    a: 'Yes! All donor phone numbers are shielded and rate-limited. We strictly adhere to privacy guidelines and never share donor data with commercial third parties.'
  },
  {
    q: 'Are blood banks verified on this portal?',
    a: 'All blood banks listed on RaktOra are accredited by the State Blood Transfusion Council (SBTC) and Central Drugs Standard Control Organization (CDSCO).'
  }
];

export default function Home() {
  const navigate = useNavigate();
  const { showToast } = useAuth();

  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedCity, setSelectedCity] = useState('');

  const [featuredDonors, setFeaturedDonors] = useState([]);
  const [featuredBanks, setFeaturedBanks] = useState([]);
  const [upcomingCamps, setUpcomingCamps] = useState([]);
  const [emergencyRequests, setEmergencyRequests] = useState([]);

  const [faqOpenIdx, setFaqOpenIdx] = useState(0);

  useEffect(() => {
    // Fetch live data from backend APIs (only real registered users and entries)
    searchDonors({ is_available: 'true' })
      .then(res => { if (res && res.donors) setFeaturedDonors(res.donors.slice(0, 3)); })
      .catch(() => {});

    getBloodBanks()
      .then(res => { if (res && res.bloodBanks) setFeaturedBanks(res.bloodBanks.slice(0, 2)); })
      .catch(() => {});

    getDonationCamps()
      .then(res => { if (res && res.camps) setUpcomingCamps(res.camps.slice(0, 2)); })
      .catch(() => {});

    getBloodRequests({ urgency_level: 'Critical', status: 'Pending' })
      .then(res => { if (res && res.requests) setEmergencyRequests(res.requests.slice(0, 2)); })
      .catch(() => {});
  }, []);

  const handleStateChange = (st) => {
    setSelectedState(st);
    const cities = getCitiesForState(st);
    if (selectedCity && st !== 'All States' && !cities.includes(selectedCity)) {
      setSelectedCity('');
    }
  };

  const handleHeroSearch = (e) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (selectedGroup !== 'All') query.append('blood_group', selectedGroup);
    if (selectedState !== 'All States') query.append('state', selectedState);
    if (selectedCity) query.append('city', selectedCity);
    navigate(`/search-donors?${query.toString()}`);
  };

  return (
    <div className="space-y-24 pb-20 overflow-hidden">
      
      {/* 1. HERO SECTION WITH CTA BUTTONS & QUICK SEARCH */}
      <section className="relative bg-gradient-to-b from-red-50/80 via-white to-slate-50 pt-10 pb-20 border-b border-slate-200/60">
        {/* Decorative Background Blur Orbs */}
        <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[28rem] h-[28rem] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative">
          
          {/* Emergency Alert Ticker */}
          {emergencyRequests.length > 0 && (
            <div className="mb-8 bg-red-600 text-white rounded-2xl p-4 shadow-xl shadow-red-600/20 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse-subtle border border-red-500">
              <div className="flex items-center space-x-3 text-xs sm:text-sm font-bold">
                <span className="bg-white text-red-600 px-3 py-1 rounded-full uppercase tracking-wider text-[11px] font-black">URGENT SOS</span>
                <span>Critical Need: {emergencyRequests[0].patient_name} requires {emergencyRequests[0].units_needed} unit(s) of {emergencyRequests[0].blood_group} blood in {emergencyRequests[0].city}!</span>
              </div>
              <Link
                to="/emergency-request"
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all flex-shrink-0 shadow-md"
              >
                Respond Immediately
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero Main Content */}
            <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
              
              <div className="inline-flex items-center space-x-2 bg-red-100/90 border border-red-200 text-red-700 px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide shadow-xs">
                <Sparkles className="w-4 h-4 text-red-600 animate-pulse" />
                <span>India's Premier 24/7 Healthcare Blood Alliance</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight">
                Connecting Every Drop To Save A <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-red-500 to-red-700">Human Life.</span>
              </h1>

              <p className="text-slate-600 text-base sm:text-lg max-w-2xl leading-relaxed">
                Seamless real-time matching between verified voluntary donors, accredited blood banks, and hospital emergency wards within seconds during critical care needs.
              </p>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  to="/emergency-request"
                  className="bg-red-600 hover:bg-red-700 text-white font-black text-sm px-7 py-4 rounded-2xl shadow-xl shadow-red-600/30 hover:scale-[1.02] transition-all flex items-center space-x-2.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Request Emergency Blood</span>
                </Link>
                <Link
                  to="/become-donor"
                  className="bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-sm px-7 py-4 rounded-2xl border border-slate-200 shadow-sm transition-all flex items-center space-x-2.5"
                >
                  <Heart className="w-4 h-4 text-red-600 fill-current" />
                  <span>Become a Donor</span>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 font-semibold">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>100% SBTC Verified Donors</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Instant SOS SMS Alert</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-blue-500" />
                  <span>ISO 9001 Certified Protocol</span>
                </div>
              </div>

            </div>

            {/* Hero Quick Search Form Box */}
            <div className="lg:col-span-5">
              <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-200/80 border border-slate-200">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 text-white flex items-center justify-center shadow-md shadow-red-600/20">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Quick Donor & Stock Locator</h3>
                    <p className="text-xs text-slate-500 font-medium">Search live donors & accredited blood banks</p>
                  </div>
                </div>

                <form onSubmit={handleHeroSearch} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Blood Group Required
                    </label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                    >
                      <option value="All">All Blood Groups (A+, B+, O+...)</option>
                      {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select State
                    </label>
                    <select
                      value={selectedState}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                    >
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                      City / District
                    </label>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                    >
                      <option value="">All Cities</option>
                      {getCitiesForState(selectedState).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm py-4 rounded-xl shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center space-x-2"
                  >
                    <Search className="w-4 h-4 text-red-400" />
                    <span>Search Available Donors</span>
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. STATISTICS CARDS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">25,000+</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Donors</div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">450+</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Partner Blood Banks</div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-xs">
              <Heart className="w-6 h-6 text-red-600 fill-current" />
            </div>
            <div className="text-3xl font-black text-red-600 tracking-tight">18,500+</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lives Saved</div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-xs">
              <Clock className="w-6 h-6" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">&lt; 15 Mins</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Response Time</div>
          </div>
        </div>
      </section>

      {/* 3. BLOOD GROUP MATRIX & QUICK SEARCH GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-3.5 py-1 rounded-full border border-red-100">
            Blood Compatibility Matrix
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Select Target Blood Group</h2>
          <p className="text-slate-600 text-sm">
            Click any blood type card to inspect donor compatibility rules and view live matching donors.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          {GROUPS.map((group) => (
            <BloodGroupCard
              key={group}
              group={group}
              onSelect={(g) => navigate(`/search-donors?blood_group=${encodeURIComponent(g)}`)}
            />
          ))}
        </div>
      </section>

      {/* 4. EMERGENCY REQUEST BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-700 rounded-3xl p-8 sm:p-12 text-white shadow-2xl shadow-red-600/25 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12 pointer-events-none">
            <Droplets className="w-96 h-96 fill-current text-white" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-block bg-white/20 text-white text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                Immediate Hospital SOS Dispatch
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                In Need of Emergency Blood Units?
              </h2>
              <p className="text-red-100 text-sm sm:text-base max-w-xl leading-relaxed">
                Post an Emergency Blood Request now. RaktOra automatically broadcasts urgent alerts to verified voluntary donors & licensed blood centers within a 25km radius.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end">
              <Link
                to="/emergency-request"
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-center text-sm py-4 px-6 rounded-2xl shadow-lg transition-all"
              >
                Post Emergency Request
              </Link>
              <a
                href="tel:104"
                className="bg-white hover:bg-red-50 text-red-600 font-extrabold text-center text-sm py-4 px-6 rounded-2xl transition-all"
              >
                Call Helpline (104)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FEATURED DONORS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-3.5 py-1 rounded-full border border-red-100">
              Verified Donors
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-2">Active Voluntary Donors</h2>
          </div>
          <Link
            to="/search-donors"
            className="text-red-600 font-bold text-sm hover:text-red-700 flex items-center space-x-1"
          >
            <span>View All Donors</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredDonors.map((donor) => (
            <DonorCard
              key={donor.id}
              donor={donor}
              onRequest={() => navigate(`/emergency-request?blood_group=${donor.blood_group}`)}
            />
          ))}
        </div>
      </section>

      {/* 6. UPCOMING DONATION CAMPS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-3.5 py-1 rounded-full border border-red-100">
              Donation Drives
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-2">Upcoming Donation Camps</h2>
          </div>
          <Link
            to="/donation-camps"
            className="text-red-600 font-bold text-sm hover:text-red-700 flex items-center space-x-1"
          >
            <span>View All Camps</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {upcomingCamps.map((camp) => (
            <CampCard
              key={camp.id}
              camp={camp}
              onRegister={() => showToast(`Seat reserved for ${camp.camp_title}!`, 'success')}
            />
          ))}
        </div>
      </section>

      {/* 7. BLOOD BANK SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-3.5 py-1 rounded-full border border-red-100">
              Accredited Centers
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-2">Partner Blood Banks & Stocks</h2>
          </div>
          <Link
            to="/blood-banks"
            className="text-red-600 font-bold text-sm hover:text-red-700 flex items-center space-x-1"
          >
            <span>Find All Blood Banks</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredBanks.map((bank) => (
            <BloodBankCard
              key={bank.id}
              bank={bank}
            />
          ))}
        </div>
      </section>

      {/* 8. TESTIMONIALS SECTION */}
      <section className="bg-slate-900 text-white py-16 rounded-3xl max-w-7xl mx-auto px-6 sm:px-12 relative overflow-hidden">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest bg-slate-800 px-3.5 py-1 rounded-full border border-slate-700">
            Real Impact Stories
          </span>
          <h2 className="text-3xl font-black tracking-tight">What Our Lifesavers & Patients Say</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-4">
            <p className="text-xs text-slate-300 italic leading-relaxed">
              "During my mother's cardiac surgery at Lilavati Hospital, we urgently required 3 units of rare O- negative blood. RaktOra connected us to 2 voluntary donors within 20 minutes!"
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100" alt="Rohan" className="w-10 h-10 rounded-full border border-red-500 object-cover" />
              <div>
                <div className="font-bold text-sm text-white">Rohan Malhotra</div>
                <div className="text-[11px] text-slate-400">Patient Relative (Mumbai)</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-4">
            <p className="text-xs text-slate-300 italic leading-relaxed">
              "I have donated blood 12 times through RaktOra. The digital donor badges and timely eligibility notifications keep me motivated to donate regularly."
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" alt="Priya" className="w-10 h-10 rounded-full border border-red-500 object-cover" />
              <div>
                <div className="font-bold text-sm text-white">Priya Patel</div>
                <div className="text-[11px] text-slate-400">Voluntary Donor (Gujarat)</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 space-y-4">
            <p className="text-xs text-slate-300 italic leading-relaxed">
              "Managing blood stock inventory and publishing corporate blood camps has never been easier. RaktOra is a vital asset for our blood bank operations."
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100" alt="Dr. Gupta" className="w-10 h-10 rounded-full border border-red-500 object-cover" />
              <div>
                <div className="font-bold text-sm text-white">Dr. S. K. Gupta</div>
                <div className="text-[11px] text-slate-400">Medical Director (Delhi)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-8 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-3.5 py-1 rounded-full border border-red-100">
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Got Questions? We Have Answers.</h2>
          <p className="text-slate-600 text-sm">
            Learn more about blood donation eligibility, emergency request dispatches, and donor safety.
          </p>
        </div>

        <div className="space-y-3">
          {HOME_FAQS.map((faq, idx) => {
            const isOpen = faqOpenIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs transition-all"
              >
                <button
                  onClick={() => setFaqOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left font-bold text-slate-900 text-base flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center space-x-3">
                    <HelpCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span>{faq.q}</span>
                  </span>
                  {isOpen ? <ChevronUp className="w-5 h-5 text-red-600" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}


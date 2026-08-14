import React, { useState, useEffect } from 'react';
import { Building2, ShieldCheck, AlertCircle, PlusCircle, Droplets, MapPin, Phone, Mail, Clock, CheckCircle2, XCircle, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getHospitalProfile, getHospitalRequests, createHospitalRequest, searchDonors, dispatchEmergencyBatch, getBloodBanks, deleteMyAccount } from '../../services/api';

const COMPONENTS = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP'];

export default function HospitalDashboard() {
  const { user, showToast, logout } = useAuth();

  const [hospital, setHospital] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [newReq, setNewReq] = useState({
    patient_name: '',
    blood_group: 'O+',
    component: 'PRBC',
    units_needed: 2,
    urgency_level: 'Urgent',
    contact_number: '',
    required_by_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hRes = await getHospitalProfile();
      if (hRes.success) {
        setHospital(hRes.hospital);
        setNewReq(prev => ({ ...prev, contact_number: hRes.hospital.phone || user?.phone || '' }));
      }
      const rRes = await getHospitalRequests();
      if (rRes.success) {
        setRequests(rRes.requests);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load hospital data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (hospital?.verification_status !== 'VERIFIED') {
      showToast('Only VERIFIED hospitals can issue official emergency requests.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createHospitalRequest(newReq);
      if (res.success) {
        showToast('Official Hospital Blood Request created successfully!', 'success');
        setShowRequestModal(false);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatchAlertBatch = async (reqId) => {
    try {
      const res = await dispatchEmergencyBatch(reqId, { batch_size: 10, batch_number: 1 });
      if (res.success) {
        showToast(`Emergency alert dispatched to ${res.notified_count} nearest donors!`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to dispatch alert batch', 'error');
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500 font-semibold text-sm">Loading hospital portal...</div>;
  }

  const isVerified = hospital?.verification_status === 'VERIFIED';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-600 rounded-2xl">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{hospital?.name || user?.full_name}</h1>
              <p className="text-xs text-slate-400 font-medium">Official Hospital Portal • Reg: {hospital?.license_number}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isVerified ? (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" /> VERIFIED HOSPITAL
            </span>
          ) : (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center">
              <AlertCircle className="w-4 h-4 mr-1.5 text-amber-400" /> PENDING VERIFICATION
            </span>
          )}

          <button
            onClick={() => setShowRequestModal(true)}
            disabled={!isVerified}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              isVerified ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Emergency Request</span>
          </button>
        </div>
      </div>

      {!isVerified && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3 text-amber-900 text-xs font-medium">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Account Verification Required</h4>
            <p className="mt-0.5">
              Your hospital account is currently awaiting administrative license verification. You will be able to issue official blood & component requests once approved by the state blood administrator.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Hospital Requests */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center">
                <Droplets className="w-5 h-5 text-red-600 mr-2" /> Hospital Blood Requests ({requests.length})
              </h2>
              <button onClick={fetchData} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No blood requests issued yet. Click "Create Emergency Request" to broadcast a need.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(r => (
                  <div key={r.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="bg-red-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-lg">{r.blood_group}</span>
                        <span className="bg-slate-200 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-md">{r.component || 'WHOLE_BLOOD'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          r.urgency_level === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {r.urgency_level}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900">Patient: {r.patient_name}</h3>
                      <p className="text-xs text-slate-500">{r.units_needed} units required • {r.units_fulfilled} fulfilled</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDispatchAlertBatch(r.id)}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1"
                      >
                        <Send className="w-3.5 h-3.5 text-red-400" />
                        <span>Dispatch Alerts</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Hospital Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-soft space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center">
              <Building2 className="w-4 h-4 text-red-600 mr-2" /> Hospital Information
            </h3>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{hospital?.full_address || `${hospital?.city}, ${hospital?.state}`}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{hospital?.phone || user?.phone}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{hospital?.email || user?.email}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Create Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center">
                <PlusCircle className="w-5 h-5 text-red-600 mr-2" /> Official Hospital Blood Request
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Patient Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Patient Name"
                  value={newReq.patient_name}
                  onChange={(e) => setNewReq({ ...newReq, patient_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Blood Group *</label>
                  <select
                    value={newReq.blood_group}
                    onChange={(e) => setNewReq({ ...newReq, blood_group: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-red-600"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Component *</label>
                  <select
                    value={newReq.component}
                    onChange={(e) => setNewReq({ ...newReq, component: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Units Required *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReq.units_needed}
                    onChange={(e) => setNewReq({ ...newReq, units_needed: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Urgency *</label>
                  <select
                    value={newReq.urgency_level}
                    onChange={(e) => setNewReq({ ...newReq, urgency_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all mt-2"
              >
                {submitting ? 'Broadcasting Request...' : 'Issue Hospital Emergency Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

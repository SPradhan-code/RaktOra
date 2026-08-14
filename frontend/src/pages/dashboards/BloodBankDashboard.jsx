import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyBloodBank, updateBloodStock, createDonationCamp, getBloodUnits, createBloodUnits, updateBloodUnitStatus, fefoIssueUnits, getBankAppointments, updateAppointmentStatus, deleteMyAccount } from '../../services/api';
import { Building2, Plus, RefreshCw, Save, HeartHandshake, ShieldCheck, CheckCircle2, Trash2, AlertTriangle, Clock, Layers, Calendar, Check, X } from 'lucide-react';

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENTS = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP'];

export default function BloodBankDashboard() {
  const navigate = useNavigate();
  const { user, showToast, deleteAccount } = useAuth();

  const [bank, setBank] = useState(null);
  const [stockMap, setStockMap] = useState({});
  const [bloodUnits, setBloodUnits] = useState([]);
  const [unitSummary, setUnitSummary] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'units', 'appointments', 'camps'
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // New Unit Form State
  const [newUnitGroup, setNewUnitGroup] = useState('O+');
  const [newUnitComponent, setNewUnitComponent] = useState('PRBC');
  const [newUnitQuantity, setNewUnitQuantity] = useState(1);
  const [newUnitColDate, setNewUnitColDate] = useState(new Date().toISOString().split('T')[0]);
  const [newUnitExpDate, setNewUnitExpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 35);
    return d.toISOString().split('T')[0];
  });

  // Camp Form State
  const [campTitle, setCampTitle] = useState('');
  const [campDate, setCampDate] = useState('2026-08-25');
  const [venue, setVenue] = useState('');

  const fetchBankData = async () => {
    setLoading(true);
    try {
      const res = await getMyBloodBank();
      if (res.bloodBank) {
        setBank(res.bloodBank);
        const sm = {};
        (res.stock || []).forEach(s => sm[`${s.blood_group}_${s.component || 'WHOLE_BLOOD'}`] = s.units_available);
        setStockMap(sm);
      }

      const uRes = await getBloodUnits();
      if (uRes.success) {
        setBloodUnits(uRes.units);
        setUnitSummary(uRes.summary);
      }

      const apptRes = await getBankAppointments();
      if (apptRes.success) {
        setAppointments(apptRes.appointments);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load blood bank data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankData();
  }, [user]);

  const handleStockUpdate = async (blood_group, component, newUnits) => {
    try {
      await updateBloodStock({ blood_group, component, units: parseInt(newUnits) });
      setStockMap({ ...stockMap, [`${blood_group}_${component}`]: parseInt(newUnits) });
      showToast(`Updated ${blood_group} (${component}) stock to ${newUnits} units`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update stock', 'error');
    }
  };

  const handleCreateUnits = async (e) => {
    e.preventDefault();
    try {
      const res = await createBloodUnits({
        blood_group: newUnitGroup,
        component: newUnitComponent,
        collection_date: newUnitColDate,
        expiry_date: newUnitExpDate,
        quantity: newUnitQuantity
      });
      if (res.success) {
        showToast(`Successfully registered ${newUnitQuantity} unit(s) of ${newUnitGroup} ${newUnitComponent}`, 'success');
        fetchBankData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create units', 'error');
    }
  };

  const handleUnitStatusChange = async (unitId, newStatus) => {
    try {
      const res = await updateBloodUnitStatus(unitId, newStatus);
      if (res.success) {
        showToast(`Unit status updated to ${newStatus}`, 'success');
        fetchBankData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update unit status', 'error');
    }
  };

  const handleApptStatusChange = async (apptId, newStatus) => {
    try {
      const res = await updateAppointmentStatus(apptId, newStatus);
      if (res.success) {
        showToast(`Appointment status updated to ${newStatus}`, 'success');
        fetchBankData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update appointment', 'error');
    }
  };

  const handlePublishCamp = async (e) => {
    e.preventDefault();
    try {
      const res = await createDonationCamp({
        camp_title: campTitle,
        date: campDate,
        venue_address: venue || `${user?.city || 'Central'}, ${user?.state || 'State'}`,
        city: user?.city || 'Mumbai',
        state: user?.state || 'Maharashtra',
        organizer_name: bank ? bank.name : 'Blood Centre'
      });
      if (res.success) {
        showToast('Donation camp published successfully!', 'success');
        setCampTitle('');
        setVenue('');
      }
    } catch (err) {
      showToast(err.message || 'Camp publishing failed', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {}
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500 font-semibold text-sm">Loading blood bank portal...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center">
              {bank ? bank.name : 'Blood Bank Portal'}
              <ShieldCheck className="w-5 h-5 text-red-600 ml-2" title="Approved License" />
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              License No: <strong>{bank?.license_number || 'DL-2026-BB'}</strong> • Operating: {bank?.operating_hours || '24/7'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchBankData}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center space-x-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Data</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-red-200 flex items-center space-x-1.5 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Expiry Alert Banner */}
      {unitSummary && unitSummary.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-center justify-between text-amber-900 text-xs font-bold shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>⚠️ Expiry Warning: {unitSummary.expiringSoon} blood unit(s) expire within 3 days! Enforce FEFO dispatch.</span>
          </div>
          <button onClick={() => setActiveTab('units')} className="underline text-amber-800 font-black">View Units</button>
        </div>
      )}

      {/* Dashboard Nav Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}
        >
          🩸 Stock Matrix (Component Wise)
        </button>
        <button
          onClick={() => setActiveTab('units')}
          className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === 'units' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}
        >
          🏷️ Individual Unit Tracking ({bloodUnits.length})
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === 'appointments' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}
        >
          📅 Donor Appointments ({appointments.length})
        </button>
        <button
          onClick={() => setActiveTab('camps')}
          className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === 'camps' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}
        >
          🎪 Donation Camps
        </button>
      </div>

      {/* TAB 1: COMPONENT STOCK MATRIX */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card space-y-6">
          <h3 className="font-bold text-slate-900 text-lg">Real-Time Blood & Component Inventory Matrix</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {GROUPS.map(group => (
              <div key={group} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-black text-red-600 text-xl">{group}</span>
                  <span className="text-[11px] font-bold text-slate-400">All Components</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {COMPONENTS.map(comp => {
                    const key = `${group}_${comp}`;
                    const currentUnits = stockMap[key] !== undefined ? stockMap[key] : 10;
                    return (
                      <div key={comp} className="bg-white p-2 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block truncate">{comp}</span>
                        <input
                          type="number"
                          min="0"
                          value={currentUnits}
                          onChange={(e) => handleStockUpdate(group, comp, e.target.value)}
                          className="w-full text-center bg-slate-50 border border-slate-300 rounded-lg py-1 text-xs font-black"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL UNIT TRACKING & EXPIRY (FEFO) */}
      {activeTab === 'units' && (
        <div className="space-y-6">
          {/* Register Unit Form */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">Register New Blood Units</h3>
            <form onSubmit={handleCreateUnits} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Blood Group</label>
                <select value={newUnitGroup} onChange={e => setNewUnitGroup(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-red-600">
                  {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Component</label>
                <select value={newUnitComponent} onChange={e => setNewUnitComponent(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold">
                  {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Quantity</label>
                <input type="number" min="1" value={newUnitQuantity} onChange={e => setNewUnitQuantity(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Expiry Date</label>
                <input type="date" value={newUnitExpDate} onChange={e => setNewUnitExpDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold" />
              </div>

              <div className="flex items-end">
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl shadow-md">
                  + Add Unit(s)
                </button>
              </div>
            </form>
          </div>

          {/* Unit List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Individual Unit Register</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase">
                    <th className="p-3">Unit ID</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">Component</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bloodUnits.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono font-bold text-slate-900">{u.unit_id}</td>
                      <td className="p-3 font-black text-red-600">{u.blood_group}</td>
                      <td className="p-3 font-bold text-slate-700">{u.component}</td>
                      <td className="p-3 text-slate-600">{u.expiry_date}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                          u.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' :
                          u.status === 'EXPIRED' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-800'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {u.status === 'AVAILABLE' && (
                          <button onClick={() => handleUnitStatusChange(u.id, 'ISSUED')} className="bg-slate-900 text-white px-2 py-1 rounded text-[10px] font-bold">Issue</button>
                        )}
                        {u.status !== 'DISCARDED' && (
                          <button onClick={() => handleUnitStatusChange(u.id, 'DISCARDED')} className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">Discard</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base">Scheduled Donor Appointments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase">
                  <th className="p-3">Donor Name</th>
                  <th className="p-3">Group</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{a.donor_name}</td>
                    <td className="p-3 font-black text-red-600">{a.blood_group}</td>
                    <td className="p-3 text-slate-600">{a.date} at {a.start_time}</td>
                    <td className="p-3 text-slate-600">{a.donor_phone}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                        a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        a.status === 'BOOKED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {a.status === 'BOOKED' && (
                        <button onClick={() => handleApptStatusChange(a.id, 'COMPLETED')} className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold">Mark Completed</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CAMPS */}
      {activeTab === 'camps' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-card space-y-4">
          <h3 className="font-bold text-slate-900 text-lg flex items-center">
            <HeartHandshake className="w-5 h-5 text-red-600 mr-2" /> Publish Blood Donation Camp
          </h3>
          <form onSubmit={handlePublishCamp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Camp Title</label>
              <input type="text" required value={campTitle} onChange={e => setCampTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
              <input type="date" required value={campDate} onChange={e => setCampDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Venue Address</label>
              <input type="text" required value={venue} onChange={e => setVenue(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-md">Publish Camp Schedule</button>
            </div>
          </form>
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

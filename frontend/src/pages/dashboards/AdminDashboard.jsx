import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAdminAnalytics, getAdminUsers, getAdminHospitals, updateHospitalStatus, getAdminAuditLogs, toggleUserVerification, updateUserStatus } from '../../services/api';
import { ShieldCheck, Users, Building2, Droplet, Activity, CheckCircle2, XCircle, BarChart3, AlertCircle, FileText, Clock, RefreshCw, Lock, TrendingUp, AlertTriangle, UserX, UserCheck } from 'lucide-react';

export default function AdminDashboard() {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'hospitals', 'users', 'audit'

  const [dateRange, setDateRange] = useState('30days');
  const [analytics, setAnalytics] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [hospitalsList, setHospitalsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, [dateRange]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [aRes, uRes, hRes, logRes] = await Promise.all([
        getAdminAnalytics({ range: dateRange }),
        getAdminUsers(),
        getAdminHospitals(),
        getAdminAuditLogs()
      ]);

      if (aRes.success) setAnalytics(aRes.analytics);
      if (uRes.success) setUsersList(uRes.users);
      if (hRes.success) setHospitalsList(hRes.hospitals);
      if (logRes.success) setAuditLogs(logRes.logs);
    } catch (err) {
      showToast(err.message || 'Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHospital = async (id, status) => {
    try {
      const res = await updateHospitalStatus(id, status);
      if (res.success) {
        showToast(`Hospital status updated to ${status}`, 'success');
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update hospital status', 'error');
    }
  };

  const handleToggleUserVerif = async (userId, currentStatus) => {
    try {
      await toggleUserVerification(userId, !currentStatus);
      showToast('User verification status updated', 'success');
      fetchAdminData();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleToggleAccountStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await updateUserStatus(userId, newStatus);
      if (res.success) {
        showToast(`Account status updated to '${newStatus}'`, 'success');
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update account status', 'error');
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500 font-semibold text-sm">Loading operational analytics suite...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center mb-1">
            <ShieldCheck className="w-4 h-4 mr-1" /> Real Operational Analytics & Governance
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">RaktOra Admin Control Panel</h1>
        </div>
        <button
          onClick={fetchAdminData}
          className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 flex items-center space-x-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh System Data</span>
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex space-x-1 bg-slate-200/80 p-1.5 rounded-2xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-red-600" />
          <span>📊 Real Operational Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('hospitals')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'hospitals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-red-600" />
          <span>🏥 Hospitals ({hospitalsList.filter(h => h.verification_status === 'PENDING_VERIFICATION').length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-red-600" />
          <span>👥 User Accounts ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-red-600" />
          <span>📜 Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: OPERATIONAL ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Date Filter Bar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700 flex items-center">
              <Clock className="w-4 h-4 text-red-600 mr-1.5" /> Analytics Period Filter:
            </span>
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {[
                { label: 'Today', value: 'today' },
                { label: '7 Days', value: '7days' },
                { label: '30 Days', value: '30days' },
                { label: '90 Days', value: '90days' }
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => setDateRange(item.value)}
                  className={`px-3 py-1 rounded-lg transition-all ${dateRange === item.value ? 'bg-white text-red-600 shadow-xs' : 'text-slate-500'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Fulfillment Rate</span>
              <div className="text-2xl font-black text-emerald-600">{analytics.requests.fulfillmentRate}%</div>
              <span className="text-[10px] text-slate-500 font-medium">{analytics.requests.fulfilled} of {analytics.requests.total} requests</span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Avg Emergency Response</span>
              <div className="text-2xl font-black text-slate-900">{analytics.requests.avgResponseTime}</div>
              <span className="text-[10px] text-slate-400 font-medium">Creation to first donor pledge</span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inventory Wastage Rate</span>
              <div className="text-2xl font-black text-amber-600">{analytics.inventory.wastageRate}%</div>
              <span className="text-[10px] text-slate-400 font-medium">{analytics.inventory.expired + analytics.inventory.discarded} expired/discarded</span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Repeat Donor Rate</span>
              <div className="text-2xl font-black text-red-600">{analytics.donors.repeatRate}%</div>
              <span className="text-[10px] text-slate-400 font-medium">{analytics.donors.repeat} repeat donors</span>
            </div>
          </div>

          {/* Demand & Ranking Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Most Requested Blood Groups */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center">
                <TrendingUp className="w-4 h-4 text-red-600 mr-2" /> Most Requested Blood Groups
              </h3>
              <div className="space-y-2">
                {analytics.requests.topRequestedGroups.map((g, idx) => (
                  <div key={g.blood_group} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800">#{idx + 1} {g.blood_group}</span>
                    <span className="font-black text-red-600">{g.count} requests</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Requested Components */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center">
                <Activity className="w-4 h-4 text-red-600 mr-2" /> Most Requested Components
              </h3>
              <div className="space-y-2">
                {analytics.requests.topRequestedComponents.map((c, idx) => (
                  <div key={c.component} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800">#{idx + 1} {c.component}</span>
                    <span className="font-black text-red-600">{c.count} requests</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Hospital Requests & Conversion Stats */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">Hospital Network Operations & Conversions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <span className="text-slate-500 font-bold block">Verified Hospitals</span>
                <span className="text-xl font-black text-slate-900">{analytics.hospitals.verified} / {analytics.hospitals.total}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <span className="text-slate-500 font-bold block">Active Requesters</span>
                <span className="text-xl font-black text-emerald-600">{analytics.hospitals.activeRequesters} Hospitals</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <span className="text-slate-500 font-bold block">Donor Conversion Rate</span>
                <span className="text-xl font-black text-red-600">{analytics.donors.conversionRate}%</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <span className="text-slate-500 font-bold block">Active Available Donors</span>
                <span className="text-xl font-black text-emerald-600">{analytics.donors.active} Donors</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOSPITALS VERIFICATION MANAGEMENT */}
      {activeTab === 'hospitals' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center">
            <Building2 className="w-5 h-5 text-red-600 mr-2" /> Hospital Verification & Accreditation
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase">
                  <th className="p-3">Hospital Name</th>
                  <th className="p-3">License No</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospitalsList.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">
                      {h.name}
                      <span className="block text-[10px] text-slate-400 font-normal">{h.full_address}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">{h.license_number}</td>
                    <td className="p-3 text-slate-600">{h.city}, {h.state}</td>
                    <td className="p-3 text-slate-600">{h.phone}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                        h.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                        h.verification_status === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {h.verification_status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {h.verification_status !== 'VERIFIED' && (
                        <button
                          onClick={() => handleUpdateHospital(h.id, 'VERIFIED')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]"
                        >
                          Approve
                        </button>
                      )}
                      {h.verification_status !== 'SUSPENDED' && (
                        <button
                          onClick={() => handleUpdateHospital(h.id, 'SUSPENDED')}
                          className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USERS LIST */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base">Registered Users ({usersList.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase">
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">
                      {u.full_name}
                      <span className="block text-[10px] text-slate-400 font-normal">{u.email}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-700 uppercase">{u.role}</td>
                    <td className="p-3 text-slate-600">{u.city}, {u.state}</td>
                    <td className="p-3 text-slate-600">{u.phone}</td>
                    <td className="p-3 space-y-1">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] inline-block mr-1 ${u.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {u.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] inline-block ${u.account_status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                        {u.account_status || 'active'}
                      </span>
                      {u.locked_until && new Date() < new Date(u.locked_until) && (
                        <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold text-[9px] block">
                          🔒 Locked
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleToggleUserVerif(u.id, u.is_verified)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded-lg text-[10px]"
                      >
                        {u.is_verified ? 'Revoke' : 'Verify'}
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleToggleAccountStatus(u.id, u.account_status)}
                          className={`font-bold px-2 py-1 rounded-lg text-[10px] text-white ${
                            u.account_status === 'suspended' 
                              ? 'bg-emerald-600 hover:bg-emerald-700' 
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {u.account_status === 'suspended' ? 'Activate' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center">
            <FileText className="w-5 h-5 text-red-600 mr-2" /> Immutable System Audit Logs ({auditLogs.length})
          </h3>

          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-start justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="bg-slate-900 text-white font-mono font-bold px-2 py-0.5 rounded-md text-[10px]">{log.action}</span>
                    <span className="text-slate-500 font-medium">{log.entity_type} #{log.entity_id}</span>
                  </div>
                  <div className="text-slate-700 font-medium">Actor: {log.actor_name || 'System'} ({log.actor_role || 'System'})</div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

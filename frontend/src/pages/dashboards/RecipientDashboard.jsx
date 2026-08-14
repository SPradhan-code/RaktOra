import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBloodRequests, updateRequestStatus } from '../../services/api';
import { Activity, Plus, Clock, CheckCircle2, AlertTriangle, Phone, MapPin, Trash2 } from 'lucide-react';

export default function RecipientDashboard() {
  const navigate = useNavigate();
  const { user, showToast, deleteAccount } = useAuth();
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchRequests = () => {
    setLoading(true);
    getBloodRequests()
      .then(res => {
        if (res.requests) {
          setMyRequests(res.requests.filter(r => r.requester_id === user?.id || r.requester_name === user?.full_name));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleStatusChange = async (id, status) => {
    try {
      await updateRequestStatus(id, { status });
      showToast('Request status updated', 'success');
      fetchRequests();
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {
      // toast error handled in AuthContext
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Patient & Recipient Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">Manage and track live blood requirements in real time.</p>
        </div>
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <Link
            to="/emergency-request"
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 px-5 rounded-xl shadow-md shadow-red-600/20 inline-flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Blood Request</span>
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs py-3 px-4 rounded-xl inline-flex items-center space-x-1.5 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-card space-y-6">
        <h3 className="font-bold text-slate-900 text-lg flex items-center">
          <Activity className="w-5 h-5 text-red-600 mr-2" />
          Active Emergency Requests ({myRequests.length})
        </h3>

        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">Loading requests...</div>
        ) : myRequests.length > 0 ? (
          <div className="space-y-4">
            {myRequests.map(r => (
              <div key={r.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="w-10 h-10 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center">
                      {r.blood_group}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{r.patient_name}</h4>
                      <p className="text-xs text-slate-500">{r.hospital_name}, {r.city} • {r.units_needed} Units Needed</p>
                    </div>
                  </div>

                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                    r.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {r.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Urgency: <strong className="text-red-600">{r.urgency_level}</strong></span>
                  <div className="space-x-2">
                    {r.status !== 'Fulfilled' && (
                      <button
                        onClick={() => handleStatusChange(r.id, 'Fulfilled')}
                        className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                      >
                        Mark Fulfilled
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs">
            No blood requests posted yet. Click 'New Blood Request' above to create one.
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
              <AlertTriangle className="w-6 h-6" />
              <span>Delete Account?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete your RaktOra account? All your emergency requests and records will be deleted. <strong>This action cannot be undone.</strong>
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-slate-100 text-slate-700 text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-red-700 shadow-md shadow-red-600/20"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

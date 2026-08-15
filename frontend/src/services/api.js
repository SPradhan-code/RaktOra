import axios from 'axios';

// Create Axios Instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bloodconnect_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Error Response
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'API request failed';
    if (error.response?.status === 401) {
      localStorage.removeItem('bloodconnect_token');
    }
    return Promise.reject(new Error(message));
  }
);

// ============================================================================
// 1. AUTHENTICATION APIs
// ============================================================================
export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const registerUser = (userData) => api.post('/auth/register', userData);
export const logoutUser = () => api.post('/auth/logout');
export const sendOtp = (data) => api.post('/auth/send-otp', data);
export const verifyOtp = (data) => api.post('/auth/verify-otp', data);
export const sendEmailOtp = (data) => api.post('/auth/send-email-otp', data);
export const verifyEmailOtp = (data) => api.post('/auth/verify-email-otp', data);
export const sendPhoneOtp = (data) => api.post('/auth/send-phone-otp', data);
export const verifyPhoneOtp = (data) => api.post('/auth/verify-phone-otp', data);
export const initiateDigiLockerVerification = () => api.get('/auth/digilocker/initiate');
export const getCurrentUser = () => api.get('/auth/me');
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (data) => api.post('/auth/reset-password', data);
export const deleteMyAccount = () => api.delete('/auth/me');

// ============================================================================
// 2. DONOR APIs, PRIVACY & ELIGIBILITY / GPS
// ============================================================================
export const searchDonors = (params = {}) => api.get('/donors/search', { params });
export const getDonorById = (id) => api.get(`/donors/${id}`);
export const updateDonorProfile = (data) => api.put('/donors/profile', data);
export const toggleAvailability = (is_available) => api.patch('/donors/availability', { is_available });
export const getDonorHistory = () => api.get('/donors/history/me');
export const checkEligibility = (params = {}) => api.get('/donors/eligibility/check', { params });
export const getNearbyDonors = (params = {}) => api.get('/donors/nearby', { params });
export const getPrivacyPreferences = () => api.get('/donors/privacy-preferences');
export const updatePrivacyPreferences = (data) => api.put('/donors/privacy-preferences', data);

// ============================================================================
// 3. BLOOD REQUEST & EMERGENCY BATCH APIs
// ============================================================================
export const getBloodRequests = (params = {}) => api.get('/requests', { params });
export const getRequestById = (id) => api.get(`/requests/${id}`);
export const createBloodRequest = (data) => api.post('/requests', data);
export const updateRequestStatus = (id, payload) => {
  const status = typeof payload === 'object' ? payload.status : payload;
  const reason = typeof payload === 'object' ? payload.reason : null;
  return api.patch(`/requests/${id}/status`, { status, reason });
};
export const fulfillRequest = (id, units) => api.post(`/requests/${id}/fulfill`, { units });
export const dispatchEmergencyBatch = (id, data = {}) => api.post(`/requests/${id}/dispatch-batch`, data);
export const pledgeEmergencyResponse = (id) => api.post(`/requests/${id}/respond`);

// ============================================================================
// 4. BLOOD BANK & BLOOD UNIT (FEFO) APIs
// ============================================================================
export const getBloodBanks = (params = {}) => api.get('/bloodbanks', { params });
export const getBloodBankById = (id) => api.get(`/bloodbanks/${id}`);
export const getMyBloodBankStock = () => api.get('/bloodbanks/stock/me');
export const getMyBloodBank = getMyBloodBankStock;
export const updateBloodStock = (data) => api.put('/bloodbanks/stock/update', data);
export const getBloodUnits = (params = {}) => api.get('/bloodunits', { params });
export const createBloodUnits = (data) => api.post('/bloodunits', data);
export const updateBloodUnitStatus = (id, payload) => {
  const status = typeof payload === 'object' ? payload.status : payload;
  const testing_status = typeof payload === 'object' ? payload.testing_status : null;
  return api.patch(`/bloodunits/${id}/status`, { status, testing_status });
};
export const fefoIssueUnits = (data) => api.post('/bloodunits/fefo-issue', data);

// ============================================================================
// 5. APPOINTMENTS APIs
// ============================================================================
export const getMyAppointments = () => api.get('/appointments/me');
export const bookAppointment = (data) => api.post('/appointments', data);
export const rescheduleAppointment = (id, data) => api.patch(`/appointments/${id}/reschedule`, data);
export const cancelAppointment = (id) => api.patch(`/appointments/${id}/cancel`);
export const getBankAppointments = (params = {}) => api.get('/appointments/bank', { params });
export const updateAppointmentStatus = (id, status) => api.patch(`/appointments/${id}/status`, { status });

// ============================================================================
// 6. HOSPITAL APIs
// ============================================================================
export const getHospitalProfile = () => api.get('/hospitals/me');
export const updateHospitalProfile = (data) => api.put('/hospitals/profile', data);
export const getHospitalRequests = () => api.get('/hospitals/requests');
export const createHospitalRequest = (data) => api.post('/hospitals/requests', data);

// ============================================================================
// 7. DONATION CAMPS APIs
// ============================================================================
export const getDonationCamps = (params = {}) => api.get('/camps', { params });
export const createDonationCamp = (data) => api.post('/camps', data);
export const registerForCamp = (campId) => api.post(`/camps/${campId}/register`);

// ============================================================================
// 8. ADMIN APIs & ANALYTICS & AUDIT LOGS
// ============================================================================
export const getAdminStats = () => api.get('/admin/stats');
export const getAdminMetrics = getAdminStats;
export const getAdminAnalytics = (params = {}) => api.get('/admin/analytics', { params });
export const getAdminUsers = (params = {}) => api.get('/admin/users', { params });
export const getAdminHospitals = (params = {}) => api.get('/admin/hospitals', { params });
export const updateHospitalStatus = (id, status) => api.patch(`/admin/hospitals/${id}/status`, { status });
export const getAdminAuditLogs = (params = {}) => api.get('/admin/audit-logs', { params });
export const toggleUserVerification = (id, is_verified) => api.patch(`/admin/users/${id}/verify`, { is_verified });
export const updateUserStatus = (id, account_status) => api.patch(`/admin/users/${id}/status`, { account_status });
export const approveBloodBank = (id, is_approved) => api.patch(`/admin/bloodbanks/${id}/approve`, { is_approved });
export const deleteUser = (id) => api.delete(`/admin/users/${id}`);

// ============================================================================
// 9. NOTIFICATION APIs
// ============================================================================
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);

export default api;

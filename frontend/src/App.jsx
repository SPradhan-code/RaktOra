import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import StartupGate from './components/StartupGate';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast from './components/Toast';

import Home from './pages/Home';
import About from './pages/About';
import SearchDonors from './pages/SearchDonors';
import BloodBanks from './pages/BloodBanks';
import DonationCamps from './pages/DonationCamps';
import EmergencyRequest from './pages/EmergencyRequest';
import BecomeDonor from './pages/BecomeDonor';
import Login from './pages/Login';
import Register from './pages/Register';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';

import DonorDashboard from './pages/dashboards/DonorDashboard';
import RecipientDashboard from './pages/dashboards/RecipientDashboard';
import BloodBankDashboard from './pages/dashboards/BloodBankDashboard';
import HospitalDashboard from './pages/dashboards/HospitalDashboard';
import AdminDashboard from './pages/dashboards/AdminDashboard';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="py-20 text-center text-slate-500 font-semibold text-sm">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <StartupGate>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased font-sans">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Pages */}
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/search-donors" element={<SearchDonors />} />
                <Route path="/blood-banks" element={<BloodBanks />} />
                <Route path="/donation-camps" element={<DonationCamps />} />
                <Route path="/emergency-request" element={<EmergencyRequest />} />
                <Route path="/become-donor" element={<BecomeDonor />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />

                {/* 5 Role Dashboards */}
                <Route
                  path="/dashboard/donor"
                  element={
                    <ProtectedRoute allowedRoles={['donor', 'admin']}>
                      <DonorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/recipient"
                  element={
                    <ProtectedRoute allowedRoles={['recipient', 'admin']}>
                      <RecipientDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/blood-bank"
                  element={
                    <ProtectedRoute allowedRoles={['blood_bank', 'admin']}>
                      <BloodBankDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/hospital"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'admin']}>
                      <HospitalDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <Toast />
          </div>
        </Router>
      </AuthProvider>
    </StartupGate>
  );
}

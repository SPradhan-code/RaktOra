import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HeartHandshake, PhoneCall, Menu, X, User, LogOut, ShieldCheck, AlertCircle, Droplets } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RaktOraLogo from './RaktOraLogo';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'donor': return '/dashboard/donor';
      case 'recipient': return '/dashboard/recipient';
      case 'blood_bank': return '/dashboard/blood-bank';
      case 'hospital': return '/dashboard/hospital';
      case 'admin': return '/dashboard/admin';
      default: return '/dashboard/donor';
    }
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Search Donors', path: '/search-donors' },
    { name: 'Blood Banks', path: '/blood-banks' },
    { name: 'Donation Camps', path: '/donation-camps' },
    { name: 'FAQ', path: '/faq' },
    { name: 'Contact', path: '/contact' }
  ];

  return (
    <header className="sticky top-0 z-50 transition-all duration-300">
      {/* 24/7 Helpline Top Bar */}
      <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 sm:px-8 flex flex-wrap justify-between items-center border-b border-slate-800">
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-red-400 font-semibold animate-pulse">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            24/7 Emergency Helpline: <a href="tel:104" className="underline ml-1 text-white hover:text-red-300">104</a> / <a href="tel:1800111000" className="underline ml-1 text-white hover:text-red-300">1800-11-1000</a>
          </span>
          <span className="hidden md:inline-block text-slate-400">| Recognized by Red Cross & State Blood Transfusion Councils</span>
        </div>
        <div className="flex items-center space-x-3 mt-1 sm:mt-0">
          <Link to="/emergency-request" className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide transition-all shadow-sm">
            Emergency Request
          </Link>
          <Link to="/become-donor" className="hover:text-red-400 text-slate-300 font-medium transition-colors">
            Become a Donor
          </Link>
        </div>
      </div>

      {/* Main Glass Navigation Bar */}
      <nav className="glass-nav border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <RaktOraLogo size={42} />
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 flex items-center">
                Rakt<span className="text-red-600">Ora</span>
              </span>
              <span className="block text-[10px] text-slate-500 font-bold tracking-widest uppercase -mt-1">National Blood Network</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-1 font-medium text-sm text-slate-700">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3.5 py-2 rounded-xl transition-colors ${
                  isActive(link.path)
                    ? 'text-red-600 bg-red-50/80 font-semibold'
                    : 'hover:text-red-600 hover:bg-slate-100/60'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* User Profile / Dashboard Button */}
          <div className="hidden lg:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2">
                <Link
                  to={getDashboardPath()}
                  className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
                >
                  <User className="w-4 h-4 text-red-400" />
                  <span>{user.full_name.split(' ')[0]} ({user.role.replace('_', ' ')})</span>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="text-slate-700 hover:text-red-600 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl shadow-md shadow-red-600/20 transition-all hover:scale-[1.02]"
                >
                  Join Portal
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-red-600 hover:bg-slate-100 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-200/80 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${
                  isActive(link.path) ? 'text-red-600 bg-red-50 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {link.name}
              </Link>
            ))}

            <div className="pt-3 border-t border-slate-200 flex flex-col space-y-2">
              {user ? (
                <>
                  <Link
                    to={getDashboardPath()}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold"
                  >
                    Go to Dashboard ({user.role})
                  </Link>
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    className="w-full text-center border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-semibold"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-red-600/20"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

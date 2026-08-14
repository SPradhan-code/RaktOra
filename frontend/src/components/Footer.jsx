import React from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Heart, Shield, Phone, Mail, MapPin, ExternalLink, Award } from 'lucide-react';
import RaktOraLogo from './RaktOraLogo';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          
          {/* Col 1: Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center space-x-2">
              <RaktOraLogo size={38} />
              <span className="text-2xl font-black tracking-tight text-white">
                Rakt<span className="text-red-500">Ora</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              RaktOra is a national digital blood donor platform connecting patients, voluntary blood donors, blood banks, and donation camps across India. Built for speed, trust, and emergency responsiveness.
            </p>
            <div className="flex items-center space-x-3 pt-2 text-xs text-slate-400">
              <span className="flex items-center bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <Award className="w-4 h-4 text-amber-400 mr-1.5" /> ISO 9001 Certified Protocol
              </span>
              <span className="flex items-center bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <Shield className="w-4 h-4 text-emerald-400 mr-1.5" /> 100% Verified Donors
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4 border-b border-red-600/40 pb-1 w-fit">
              Quick Portals
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/search-donors" className="hover:text-red-400 transition-colors">Search Donors</Link></li>
              <li><Link to="/blood-banks" className="hover:text-red-400 transition-colors">Find Blood Banks</Link></li>
              <li><Link to="/donation-camps" className="hover:text-red-400 transition-colors">Upcoming Camps</Link></li>
              <li><Link to="/emergency-request" className="hover:text-red-400 transition-colors font-medium text-red-400">Post Emergency Request</Link></li>
              <li><Link to="/become-donor" className="hover:text-red-400 transition-colors">Become a Voluntary Donor</Link></li>
            </ul>
          </div>

          {/* Col 3: Donor Guidelines */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4 border-b border-red-600/40 pb-1 w-fit">
              Information
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/about" className="hover:text-red-400 transition-colors">About RaktOra</Link></li>
              <li><Link to="/faq" className="hover:text-red-400 transition-colors">Eligibility & FAQs</Link></li>
              <li><Link to="/contact" className="hover:text-red-400 transition-colors">Help & Contact Support</Link></li>
              <li><Link to="/login" className="hover:text-red-400 transition-colors">Role Dashboard Login</Link></li>
              <li><Link to="/login" className="hover:text-amber-400 transition-colors font-medium text-amber-400 flex items-center">🛡️ System Admin Portal</Link></li>
              <li><a href="https://nbtc.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors inline-flex items-center">National Blood Transfusion Council <ExternalLink className="w-3 h-3 ml-1" /></a></li>
            </ul>
          </div>

          {/* Col 4: Emergency Hotlines */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4 border-b border-red-600/40 pb-1 w-fit">
              24/7 Helpline
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start space-x-2.5">
                <Phone className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Emergency Hotline</div>
                  <div className="text-xs text-slate-400">1800-11-1000 / 104</div>
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <Mail className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Email Support</div>
                  <div className="text-xs text-slate-400">help@raktora.org</div>
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white">Headquarters</div>
                  <div className="text-xs text-slate-400">1 Red Cross Road, Connaught Place, New Delhi, India</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 space-y-4 md:space-y-0">
          <div>
            © {new Date().getFullYear()} RaktOra Blood Management System. Built with <Heart className="w-3.5 h-3.5 text-red-500 inline mx-0.5 fill-current" /> for voluntary blood services.
          </div>
          <div className="flex space-x-6">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer">Donor Code of Ethics</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

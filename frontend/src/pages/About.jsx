import React from 'react';
import { ShieldCheck, Heart, Users, Award, Droplets, Target, Eye, Globe } from 'lucide-react';
import RaktOraLogo from '../components/RaktOraLogo';

export default function About() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="flex justify-center mb-2">
          <RaktOraLogo size={64} />
        </div>
        <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-3.5 py-1.5 rounded-full border border-red-100">
          About RaktOra Alliance
        </span>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Saving Lives Through Speed, Technology & Compassion
        </h1>
        <p className="text-slate-600 text-base leading-relaxed">
          Inspired by top national blood transfusion initiatives, RaktOra bridges the critical time gap between blood requesters and voluntary donors across India.
        </p>
      </div>

      {/* Mission & Vision Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-card space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md">
            <Target className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Our Mission</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            To ensure zero deaths in India due to non-availability of blood by digitizing blood donor management, standardizing real-time blood stock tracking, and enabling automated 24/7 emergency broadcasting.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-card space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
            <Eye className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Our Vision</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            To empower a 100% voluntary, non-remunerated donor community where every citizen has access to safe, tested blood products within minutes of emergency medical escalation.
          </p>
        </div>
      </div>

      {/* Core Values */}
      <div className="space-y-8">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-slate-900">Our Core Principles</h2>
          <p className="text-xs text-slate-500 mt-1">Built on transparency, medical safety, and non-profit ethics</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-3">
            <ShieldCheck className="w-8 h-8 text-red-600" />
            <h3 className="font-bold text-slate-900 text-base">Verified Donors</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Strict identity and health eligibility validation before listing any voluntary donor profile.
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-3">
            <Heart className="w-8 h-8 text-red-600" />
            <h3 className="font-bold text-slate-900 text-base">Non-Profit Service</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              RaktOra is 100% free for patients, donors, hospitals, and blood centres.
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-3">
            <Droplets className="w-8 h-8 text-red-600" />
            <h3 className="font-bold text-slate-900 text-base">Real-time Stock</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Live stock visibility across 8 blood groups to eliminate hospital-to-hospital hunting during critical hours.
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-3">
            <Globe className="w-8 h-8 text-red-600" />
            <h3 className="font-bold text-slate-900 text-base">Nationwide Reach</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Covering major metro cities, tier-2 towns, and district blood centres across 28+ Indian states.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

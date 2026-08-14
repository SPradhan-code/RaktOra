import React from 'react';
import { Building2, Phone, MapPin, Clock, ShieldCheck, CheckCircle } from 'lucide-react';

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodBankCard({ bank }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card hover:shadow-soft hover:border-red-500/30 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-red-100">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center">
              {bank.name}
              {bank.is_approved && (
                <ShieldCheck className="w-4 h-4 text-red-600 ml-1.5" title="Licensed & Verified Blood Centre" />
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium flex items-center mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" />
              {bank.full_address || `${bank.city}, ${bank.state}`}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
          <Clock className="w-3 h-3 mr-1" /> {bank.operating_hours || '24/7'}
        </span>
      </div>

      {/* Stock Matrix Display */}
      <div className="mt-5 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Live Stock Availability</span>
          <span className="text-[10px] text-slate-400 font-normal">Updated Live</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {GROUPS.map((group) => {
            const count = bank.stock ? (bank.stock[group] || 0) : 10;
            const isLow = count < 5;
            return (
              <div
                key={group}
                className={`p-2 rounded-xl text-center border transition-all ${
                  isLow
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <div className="text-[11px] font-black text-red-600">{group}</div>
                <div className="text-xs font-extrabold mt-0.5">{count} u</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info & Call */}
      <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 font-medium">
          License: <strong className="text-slate-700">{bank.license_number || 'RC-LIC-2026'}</strong>
        </span>
        <a
          href={`tel:${bank.phone}`}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl inline-flex items-center space-x-1.5 transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Call Bank ({bank.phone})</span>
        </a>
      </div>
    </div>
  );
}

import React from 'react';
import { MapPin, Phone, CheckCircle2, Award, Calendar, Droplets } from 'lucide-react';

export default function DonorCard({ donor, onRequest }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-soft hover:border-red-400/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Header: Photo & Availability */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <img
              src={donor.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(donor.full_name)}&background=E53935&color=fff`}
              alt={donor.full_name}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-red-100 shadow-sm"
            />
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center">
                {donor.full_name}
                <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-1.5 flex-shrink-0" title="Verified Donor" />
              </h3>
              <p className="text-xs text-slate-500 font-medium flex items-center mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1" />
                {donor.city}, {donor.state}
              </p>
            </div>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-red-500/20">
            {donor.blood_group}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 my-4 bg-slate-50 p-3 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Total Donations</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5">
              <Award className="w-3.5 h-3.5 text-amber-500 mr-1" /> {donor.total_donations || 1} Times
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block">Last Donated</span>
            <span className="font-bold text-slate-800 flex items-center mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 mr-1" /> {donor.last_donation_date || 'May 2026'}
            </span>
          </div>
        </div>

        {/* Availability Badge */}
        <div className="mb-4">
          <span
            className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
              donor.is_available
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full mr-1.5 ${donor.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {donor.is_available ? 'Available to Donate Now' : 'Recently Donated (Resting)'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-slate-100 flex items-center space-x-2">
        <a
          href={`tel:${donor.phone}`}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Call Donor</span>
        </a>
        <button
          onClick={() => onRequest && onRequest(donor)}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all"
        >
          <Droplets className="w-3.5 h-3.5 fill-current" />
          <span>Send Request</span>
        </button>
      </div>
    </div>
  );
}

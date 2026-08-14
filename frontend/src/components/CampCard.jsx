import React from 'react';
import { Calendar, Clock, MapPin, Users, HeartHandshake } from 'lucide-react';

export default function CampCard({ camp, onRegister }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card hover:shadow-soft hover:border-red-500/30 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center">
            <HeartHandshake className="w-3.5 h-3.5 mr-1" /> {camp.organizer_name || 'Red Cross Partner'}
          </span>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {camp.status || 'Upcoming'}
          </span>
        </div>

        <h3 className="font-extrabold text-slate-900 text-lg mb-2 line-clamp-1">
          {camp.camp_title}
        </h3>

        <div className="space-y-2 text-xs text-slate-600 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="font-semibold text-slate-800">{camp.date}</span>
            <span className="text-slate-400">|</span>
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{camp.time_start} - {camp.time_end}</span>
          </div>
          <div className="flex items-start space-x-2">
            <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{camp.venue_address}, {camp.city}, {camp.state}</span>
          </div>
        </div>

        {/* Attendance Progress */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-600 flex items-center">
              <Users className="w-3.5 h-3.5 mr-1 text-slate-500" /> Donors Registered
            </span>
            <span className="text-red-600 font-bold">{camp.registered_count || 32} / {camp.expected_donors || 100}</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round(((camp.registered_count || 32) / (camp.expected_donors || 100)) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => onRegister && onRegister(camp)}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-3 rounded-xl shadow-md shadow-red-600/20 hover:scale-[1.01] transition-all flex items-center justify-center space-x-2"
      >
        <HeartHandshake className="w-4 h-4" />
        <span>Register to Donate at Camp</span>
      </button>
    </div>
  );
}

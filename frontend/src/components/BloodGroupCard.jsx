import React from 'react';
import { Droplets, ArrowRight } from 'lucide-react';

const compatibilityData = {
  'A+': { givesTo: 'A+, AB+', receivesFrom: 'A+, A-, O+, O-', rarity: 'Common (34%)' },
  'A-': { givesTo: 'A+, A-, AB+, AB-', receivesFrom: 'A-, O-', rarity: 'Rare (6%)' },
  'B+': { givesTo: 'B+, AB+', receivesFrom: 'B+, B-, O+, O-', rarity: 'Very Common (32%)' },
  'B-': { givesTo: 'B+, B-, AB+, AB-', receivesFrom: 'B-, O-', rarity: 'Rare (2%)' },
  'AB+': { givesTo: 'AB+ Only (Universal Recipient)', receivesFrom: 'Everyone (All Groups)', rarity: 'Universal Recipient (7%)' },
  'AB-': { givesTo: 'AB+, AB-', receivesFrom: 'AB-, A-, B-, O-', rarity: 'Ultra Rare (1%)' },
  'O+': { givesTo: 'O+, A+, B+, AB+', receivesFrom: 'O+, O-', rarity: 'High Demand (38%)' },
  'O-': { givesTo: 'Everyone (Universal Donor)', receivesFrom: 'O- Only', rarity: 'Universal Donor (Rare 7%)' }
};

export default function BloodGroupCard({ group, onSelect }) {
  const info = compatibilityData[group] || { givesTo: 'N/A', receivesFrom: 'N/A', rarity: 'Standard' };

  return (
    <div
      onClick={() => onSelect && onSelect(group)}
      className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-red-500/50 shadow-sm hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-extrabold text-xl group-hover:bg-red-600 group-hover:text-white transition-colors duration-300 shadow-sm">
            {group}
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 group-hover:bg-red-100 group-hover:text-red-700 transition-colors">
            {info.rarity}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="text-slate-500 font-medium block">Can Donate To:</span>
            <span className="font-semibold text-slate-800">{info.givesTo}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">Can Receive From:</span>
            <span className="font-semibold text-slate-800">{info.receivesFrom}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-red-600 group-hover:text-red-700">
        <span>Find {group} Donors</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}

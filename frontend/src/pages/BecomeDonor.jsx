import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, CheckCircle2, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BecomeDonor() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [eligibility, setEligibility] = useState({
    ageOver18: true,
    weightOver45: true,
    noInfection: true,
    noRecentDonation: true
  });

  const allEligible = eligibility.ageOver18 && eligibility.weightOver45 && eligibility.noInfection && eligibility.noRecentDonation;

  const handleProceedToRegister = () => {
    if (user) {
      navigate('/dashboard/donor');
    } else {
      navigate('/register?role=donor');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-10">
      
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center mx-auto shadow-md">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Become A Voluntary Blood Donor</h1>
        <p className="text-slate-600 text-sm">
          Register in 2 minutes. Your willingness to donate can save up to 3 lives per donation cycle.
        </p>
      </div>

      {/* Step 1: Mandatory Eligibility Checklist */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-card space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <ShieldCheck className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Step 1: Health Eligibility Self-Screening</h3>
            <p className="text-xs text-slate-500">According to National Blood Transfusion Council (NBTC) guidelines</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm font-medium">
          <label className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={eligibility.ageOver18}
              onChange={(e) => setEligibility({ ...eligibility, ageOver18: e.target.checked })}
              className="w-5 h-5 text-red-600 rounded mt-0.5"
            />
            <div>
              <span className="font-bold text-slate-900 block">Age between 18 and 65 years</span>
              <span className="text-slate-500 text-xs">First-time donors must be under 60 years old.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={eligibility.weightOver45}
              onChange={(e) => setEligibility({ ...eligibility, weightOver45: e.target.checked })}
              className="w-5 h-5 text-red-600 rounded mt-0.5"
            />
            <div>
              <span className="font-bold text-slate-900 block">Body Weight above 45 kg (100 lbs)</span>
              <span className="text-slate-500 text-xs">Ensures adequate blood volume for safe extraction.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={eligibility.noInfection}
              onChange={(e) => setEligibility({ ...eligibility, noInfection: e.target.checked })}
              className="w-5 h-5 text-red-600 rounded mt-0.5"
            />
            <div>
              <span className="font-bold text-slate-900 block">No chronic medical conditions or active infections</span>
              <span className="text-slate-500 text-xs">Free from HIV, Hepatitis B/C, Syphilis, or major surgeries in past 6 months.</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={eligibility.noRecentDonation}
              onChange={(e) => setEligibility({ ...eligibility, noRecentDonation: e.target.checked })}
              className="w-5 h-5 text-red-600 rounded mt-0.5"
            />
            <div>
              <span className="font-bold text-slate-900 block">Last blood donation was more than 3 months ago (90 days)</span>
              <span className="text-slate-500 text-xs">Allows adequate time for red blood cell regeneration.</span>
            </div>
          </label>
        </div>

        {allEligible ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>You meet all medical criteria for voluntary blood donation!</span>
            </div>
            <button
              onClick={handleProceedToRegister}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-md shadow-red-600/20 flex items-center space-x-1.5"
            >
              <span>{user ? 'Go to Donor Profile' : 'Register As Donor'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center space-x-2 text-amber-800 text-xs font-medium">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>Please confirm all 4 health eligibility requirements above to unlock donor registration.</span>
          </div>
        )}
      </div>

    </div>
  );
}

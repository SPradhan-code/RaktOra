import React, { useState } from 'react';
import { HelpCircle, Search, ChevronDown, ChevronUp, Droplets, ShieldCheck, Heart } from 'lucide-react';

const FAQS = [
  {
    category: 'Donation Eligibility',
    q: 'Who can donate blood in India?',
    a: 'Any healthy individual between 18 and 65 years of age, weighing at least 45 kg, with a pulse rate between 60 to 100, and hemoglobin level of at least 12.5 g/dL can donate blood.'
  },
  {
    category: 'Donation Eligibility',
    q: 'How frequently can I donate blood?',
    a: 'Whole blood can be donated once every 3 months (90 days) for male donors and every 4 months (120 days) for female donors to allow complete iron regeneration.'
  },
  {
    category: 'Donation Process',
    q: 'Does blood donation hurt or make you weak?',
    a: 'No. The needle pinch lasts only a few seconds. The actual extraction takes 8 to 10 minutes. Your body replenishes blood fluid volume within 24-48 hours.'
  },
  {
    category: 'Emergency Requests',
    q: 'How does the Emergency Request broadcasting work?',
    a: 'When you submit an emergency blood request, RaktOra matches your patient’s required blood group and hospital location, dispatching real-time notifications to nearby registered donors.'
  },
  {
    category: 'Safety & Trust',
    q: 'Are blood donor contacts kept secure?',
    a: 'Yes! Phone numbers are protected with rate-limiting and privacy shields to prevent spam. RaktOra never sells or shares donor data with commercial third parties.'
  },
  {
    category: 'Blood Banks',
    q: 'How often is the blood bank stock updated?',
    a: 'Partner blood banks update their live inventory daily through their Blood Bank Management portal.'
  }
];

export default function FAQ() {
  const [searchTerm, setSearchTerm] = useState('');
  const [openIdx, setOpenIdx] = useState(0);

  const filteredFaqs = FAQS.filter(f =>
    f.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.a.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center mx-auto shadow-md">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h1>
        <p className="text-slate-600 text-sm">
          Everything you need to know about blood donation rules, recipient safety, and portal usage.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Search questions by keyword (e.g. eligibility, age, safety...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
        />
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs transition-all"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-5 text-left font-bold text-slate-900 text-base flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                    {faq.category}
                  </span>
                  <span>{faq.q}</span>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-red-600" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

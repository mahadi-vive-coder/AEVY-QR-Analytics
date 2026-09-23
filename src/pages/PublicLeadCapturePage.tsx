import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { api } from '../api/client';

export const PublicLeadCapturePage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const qrId = params.get('qr') || '';
  const campaignId = params.get('camp') || '';
  const destination = params.get('dest') || 'https://aevy-fragrance.vercel.app/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consent) {
      setError('Please acknowledge consent to receive AEVY fragrance allocation updates');
      return;
    }

    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setError('Please provide your name and either an email or phone number');
      return;
    }

    setSubmitting(true);

    try {
      await api.submitLead({
        qr_id: qrId,
        campaign_id: campaignId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        consent,
      });
      setSubmitted(true);
      setTimeout(() => {
        window.location.href = destination;
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit registration');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center p-6 selection:bg-[#C6A46A]/20">
      <div className="w-full max-w-md bg-white border border-[#E8E4DC] p-8 sm:p-10 shadow-sm text-center">
        {/* Brand Header */}
        <div className="mb-6">
          <h1 className="font-serif-luxury text-3xl font-bold tracking-widest text-[#111111] uppercase">
            AEVY
          </h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#888888] mt-1">
            Essence of Fresh Elegance
          </p>
          <div className="w-8 h-px bg-[#C6A46A] mx-auto mt-4" />
        </div>

        {submitted ? (
          <div className="py-8 space-y-3 animate-in fade-in duration-300">
            <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#C6A46A] text-[#C6A46A] flex items-center justify-center mx-auto">
              <Check className="w-5 h-5" />
            </div>
            <h2 className="font-serif-luxury text-xl font-bold text-[#111111]">
              Welcome to the AEVY Society
            </h2>
            <p className="text-xs text-[#666666]">
              Thank you for registering. Redirecting you to the boutique now...
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="text-[10px] uppercase tracking-widest text-[#C6A46A] font-semibold block mb-1">
                Private Fragrance Society
              </span>
              <h2 className="font-serif-luxury text-2xl font-bold text-[#111111] tracking-tight">
                Exclusive Allocation
              </h2>
              <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                Enter your details to receive private batch notices, limited flacon allocations, and invitations to upcoming sensory releases.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs text-left">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left text-xs">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Julian Montgomery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="julian@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 019-2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5D0C7] focus:border-[#111111] focus:outline-none bg-white font-mono-tabular"
                />
              </div>

              <div>
                <label className="flex items-start gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 accent-[#111111]"
                  />
                  <span className="text-[11px] text-[#666666] leading-tight">
                    I consent to receiving private olfactory release invitations and boutique announcements from AEVY.
                  </span>
                </label>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-medium text-white bg-[#111111] hover:bg-[#C6A46A] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register & Enter Boutique'}
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full py-2 px-4 text-xs text-[#888888] hover:text-[#111111] transition-colors flex items-center justify-center gap-1"
                >
                  <span>Skip to Destination</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <div className="mt-6 text-[11px] text-[#888888]">
        AEVY · Essence of Fresh Elegance · Packaging Telemetry
      </div>
    </div>
  );
};

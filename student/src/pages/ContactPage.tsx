import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Send, MessageSquare, AlertCircle, Phone, Globe } from 'lucide-react';
import { DemoBadge } from '../components/DemoBadge';
import { useSite } from '../context/SiteContext';

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const site = useSite();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!site.supportEmail) return;
    const form = new FormData(e.currentTarget);
    const subject = `MEDIFY support: ${String(form.get('category') || 'General inquiry')}`;
    const body = `Name: ${String(form.get('name') || '')}\nEmail: ${String(form.get('email') || '')}\nCollege: ${String(form.get('college') || '')}\n\n${String(form.get('message') || '')}`;
    window.location.href = `mailto:${encodeURIComponent(site.supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      
      {/* Top Breadcrumb & Tag */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xs text-[#1b8e8e] hover:underline">
          ← Home
        </Link>
        <DemoBadge subtext="Placeholder Form" />
      </div>

      {/* Hero Header */}
      <div className="bg-[#0f2837] text-white rounded-xl p-8 sm:p-12 mb-10 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <span className="text-xs font-bold text-[#1b8e8e] uppercase tracking-wider">
            Student Support & Inquiries
          </span>
          <h1 className="font-serif-heading text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Contact {site.siteName}
          </h1>
          <p className="text-base sm:text-lg text-[#e8eef3]/80 leading-relaxed">
            Have questions about your MBBS year package, syllabus alignment, or institutional access? Reach out to our team.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Contact Info Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#cfdbe5] p-6 shadow-xs space-y-4">
            <h2 className="font-serif-heading text-lg font-bold text-[#0f2837]">
              Direct Inquiries
            </h2>
            
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#0f2837] block">Email Support</span>
                  <span>{site.supportEmail || 'Support email not configured'}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#0f2837] block">Location</span>
                  <span>{site.contactLocation || 'Location not configured'}</span>
                </div>
              </div>

              {site.contactPhone && <div className="flex items-start gap-3"><Phone className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" /><a href={`tel:${site.contactPhone.replace(/[^+0-9]/g,'')}`}>{site.contactPhone}</a></div>}
              {site.contactWhatsApp && <div className="flex items-start gap-3"><MessageSquare className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" /><a href={`https://wa.me/${site.contactWhatsApp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer">WhatsApp: {site.contactWhatsApp}</a></div>}
              {site.contactWebsite && <div className="flex items-start gap-3"><Globe className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" /><a href={site.contactWebsite} target="_blank" rel="noopener noreferrer">Official website</a></div>}
              <div className="flex items-start gap-3">
                <MessageSquare className="w-4 h-4 text-[#1b8e8e] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#0f2837] block">Founder</span>
                  <span>{site.founderName || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <span className="font-bold">Contact by email:</span> This form opens your email application with a prepared support message. Please send the email from there.
          </div>
        </div>

        {/* Contact Form Column */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-[#cfdbe5] p-6 sm:p-8 shadow-xs">
            {submitted ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#e8eef3] text-[#1b8e8e] flex items-center justify-center mx-auto">
                  <Send className="w-6 h-6" />
                </div>
                <h3 className="font-serif-heading text-xl font-bold text-[#0f2837]">
                  Thank You for Your Feedback
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Your email application should open with the message prepared. Send it to complete your inquiry.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-2 text-xs font-semibold text-[#1b8e8e] hover:underline"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f2837] mb-1">
                      Your Full Name
                    </label>
                    <input
                      type="text" name="name"
                      required
                      placeholder="e.g. Dr. Ahmed Khan"
                      className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-slate-50/50 focus:bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0f2837] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email" name="email"
                      required
                      placeholder="name@college.edu.pk"
                      className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-slate-50/50 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f2837] mb-1">
                      Medical College
                    </label>
                    <input
                      type="text"
                      name="college" placeholder="e.g. Khyber Medical College (KMC)"
                      className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-slate-50/50 focus:bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0f2837] mb-1">
                      Inquiry Category
                    </label>
                    <select name="category" className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-slate-50/50 focus:bg-white text-slate-800">
                      <option>General Curriculum Question</option>
                      <option>Subscription & Pricing</option>
                      <option>Block Content Feedback</option>
                      <option>College Institutional Access</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0f2837] mb-1">
                    Your Message
                  </label>
                  <textarea
                    rows={4}
                    name="message"
                    required
                    placeholder="Describe your inquiry, suggestion, or question regarding KMU modular notes..."
                    className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-slate-50/50 focus:bg-white text-slate-800"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Opens your email application
                  </span>
                  <button
                    type="submit"
                    disabled={!site.supportEmail}
                    className="px-5 py-2.5 rounded text-xs font-semibold text-white bg-[#1b8e8e] hover:bg-[#147273] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

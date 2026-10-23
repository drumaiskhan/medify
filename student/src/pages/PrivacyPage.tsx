import { Link } from 'react-router-dom';
import { Shield, AlertTriangle } from 'lucide-react';
import { DemoBadge } from '../components/DemoBadge';

export function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      
      {/* Top Breadcrumb & Tag */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xs text-[#1B8E8E] hover:underline">
          ← Home
        </Link>
        <DemoBadge subtext="Legal Document" />
      </div>

      {/* Prominent Draft Notice */}
      <div className="mb-8 p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm text-amber-900 uppercase tracking-wide">
            Draft — to be reviewed.
          </p>
          <p>
            This document is a preliminary placeholder privacy policy for the MEDIFY web application frontend. It does not constitute a finalized legal agreement and is subject to formal legal review before student transactions go live.
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="bg-white rounded-xl border border-[#CFDBE5] p-6 sm:p-10 shadow-xs space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
        <div className="border-b border-[#E8EEF3] pb-4">
          <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#0F2837]">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Status: Draft — to be reviewed. · Last updated: Spring 2026
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0F2837]">
            1. Information Collected (Placeholder)
          </h2>
          <p>
            When user accounts are activated in future phases, MEDIFY will collect account information including student full name, email address, password hash, affiliated medical college, academic MBBS year, and curriculum board (Khyber Medical University).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0F2837]">
            2. Educational Data Usage
          </h2>
          <p>
            Collected student data will be utilized strictly for authenticating platform access, personalizing study progress across modular blocks, and administering active subscription durations. MEDIFY does not sell or share student personal information with third-party advertising brokers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0F2837]">
            3. Local Payment Processing & Manual Transfers
          </h2>
          <p>
            Subscription payments are conducted via direct manual transfers through JazzCash and Meezan Bank. Students provide transaction reference IDs and sender verification information. Screenshots sent via WhatsApp are processed strictly for verification and are not retained on platform servers. Sensitive banking credentials or passwords are never collected or stored by MEDIFY.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0F2837]">
            4. Data Retention & Student Rights
          </h2>
          <p>
            Students will have the ability to inspect, export, or request the deletion of their user accounts upon graduation or termination of their study plans.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0F2837]">
            5. Contact Legal Officer
          </h2>
          <p>
            For privacy inquiries regarding MEDIFY, reach out to Syed Nangyal at{' '}
            <span className="font-semibold text-[#0F2837]">privacy@medify.pk</span> (sample address).
          </p>
        </section>
      </div>

    </div>
  );
}

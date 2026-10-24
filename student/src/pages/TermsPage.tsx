import { Link } from 'react-router-dom';
import { FileText, AlertTriangle } from 'lucide-react';
import { DemoBadge } from '../components/DemoBadge';

export function TermsPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      
      {/* Top Breadcrumb & Tag */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xs text-[#6366F1] hover:underline">
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
            This document is a draft version of the MEDIFY Terms and Conditions. It is clearly marked as placeholder text for review prior to formal platform commercialization.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-[#DDE1F2] p-6 sm:p-10 shadow-xs space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
        <div className="border-b border-[#F0F1FA] pb-4">
          <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#171B35]">
            Terms and Conditions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Status: Draft — to be reviewed. · Governed by laws of Khyber Pakhtunkhwa, Pakistan
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#171B35]">
            1. Acceptance of Terms (Draft)
          </h2>
          <p>
            By accessing or subscribing to MEDIFY ("the Platform"), users agree to abide by these terms. MEDIFY provides supplementary study notes designed for MBBS students following the Khyber Medical University (KMU) syllabus.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#171B35]">
            2. Educational Purpose & Disclaimer
          </h2>
          <p>
            All content published on MEDIFY is strictly intended for educational study and examination revision assistance. MEDIFY content does not constitute clinical medical advice, formal diagnostic guidelines, or real-world patient management directives. Clinical decision-making must adhere to recognized hospital protocols and supervised clinical training.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#171B35]">
            3. Intellectual Property & Prohibited Redistribution
          </h2>
          <p>
            All notes, schematics, high-yield summary tables, and modular block structures curated by Syed Nangyal and contributors remain the exclusive intellectual property of MEDIFY. Unauthorized reproduction, web scraping, redistribution, or sharing of user credentials is strictly prohibited.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#171B35]">
            4. Subscription Durations & Billing
          </h2>
          <p>
            Subscription packages (Quarterly 3 months, Half-Yearly 6 months, Annual 12 months) grant personal access to the designated year's modular blocks for the duration specified at the time of purchase.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#171B35]">
            5. Modifications to Curriculum Content
          </h2>
          <p>
            MEDIFY reserves the right to refine, update, or reorganize subject notes in accordance with syllabus revisions issued by Khyber Medical University or the Pakistan Medical and Dental Council (PM&DC).
          </p>
        </section>
      </div>

    </div>
  );
}

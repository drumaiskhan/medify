import { Link } from 'react-router-dom';
import { RefreshCcw, AlertTriangle } from 'lucide-react';
import { DemoBadge } from '../components/DemoBadge';

export function RefundPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      
      {/* Top Breadcrumb & Tag */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xs text-[#1b8e8e] hover:underline">
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
            This policy outlines draft refund guidelines for the MEDIFY digital learning platform. It is a placeholder document provided for structural completeness and will undergo legal refinement prior to payment gateway activation.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-[#cfdbe5] p-6 sm:p-10 shadow-xs space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
        <div className="border-b border-[#e8eef3] pb-4">
          <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#0f2837]">
            Refund & Cancellation Policy
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Status: Draft — to be reviewed. · Last updated: Spring 2026
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0f2837]">
            1. Digital Educational Content Policy
          </h2>
          <p>
            Due to the immediate digital availability of full medical study notes, tables, and downloadable exam summaries upon account subscription, standard refunds are typically subject to verification of platform usage.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0f2837]">
            2. Grace Period & Technical Dissatisfaction (Draft)
          </h2>
          <p>
            Students who experience unresolved technical failures or proven accidental double-charges during checkout may submit a refund request within 48 hours of initial transaction.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0f2837]">
            3. Free Sample Notes Review
          </h2>
          <p>
            To prevent accidental purchases, MEDIFY provides unrestricted sample chapters (including full clinical tables and schematics) in the Notes Reader so students can evaluate syllabus compatibility prior to subscribing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif-heading text-base font-bold text-[#0f2837]">
            4. Refund Inquiries
          </h2>
          <p>
            For inquiries regarding billing adjustments, students may contact the support desk at{' '}
            <span className="font-semibold text-[#0f2837]">refunds@medify.pk</span> (sample address).
          </p>
        </section>
      </div>

    </div>
  );
}

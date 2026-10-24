import { useSite } from '../context/SiteContext';
import { Link } from 'react-router-dom';
import { BookOpen, UserCheck, Award, HeartHandshake, ArrowRight } from 'lucide-react';
import { DemoBadge } from '../components/DemoBadge';

export function AboutPage() {
  const site = useSite();
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      
      {/* Top Breadcrumb & Tag */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xs text-[#6366F1] hover:underline">
          ← Home
        </Link>
        <DemoBadge subtext="Placeholder Content" />
      </div>

      {/* Hero Header with Official Logo */}
      <div className="bg-[#171B35] text-white rounded-xl p-8 sm:p-12 mb-10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="max-w-2xl space-y-3">
          <span className="text-xs font-bold text-[#6366F1] uppercase tracking-wider">
            Our Mission & Origin
          </span>
          <h1 className="font-serif-heading text-3xl sm:text-4xl font-bold tracking-tight text-white">
            About {site.siteName}
          </h1>
          <p className="text-base sm:text-lg text-[#F0F1FA]/80 leading-relaxed">
            Smart notes engineered specifically for medical undergraduates navigating the integrated modular curriculum at Khyber Medical University (KMU).
          </p>
        </div>

        <div className="shrink-0 self-start md:self-center">
          <img
            src={site.logoUrl}
            alt={`${site.siteName} — ${site.tagline}`}
            className="h-24 sm:h-28 w-auto object-contain drop-shadow-md"
          />
        </div>
      </div>

      <div className="space-y-12">
        
        {/* Founder Section */}
        <section className="bg-white rounded-xl border border-[#DDE1F2] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-[#F0F1FA] border-2 border-[#6366F1] flex items-center justify-center text-[#171B35] shrink-0 font-serif-heading font-bold text-xl">
              SN
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-serif-heading text-xl font-bold text-[#171B35]">
                    Founded by Syed Nangyal
                  </h2>
                  <p className="text-xs text-[#6366F1] font-semibold">
                    Medical Scholar & Academic Developer
                  </p>
                </div>
                <span className="text-xs text-slate-500 bg-[#F0F1FA] px-2.5 py-1 rounded">
                  Peshawar, Khyber Pakhtunkhwa
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {site.siteName} was conceptualized by <strong className="text-[#171B35]">{site.founderName || 'the Medify team'}</strong> after observing firsthand the friction faced by Pakistani MBBS students during the transition to modular system assessments. Traditional textbooks often fragment integrated topics across separate anatomy, physiology, and pathology volumes, leaving students with fragmented knowledge.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                By consolidating high-yield clinical pearls, anatomical schematics, and pharmacology comparison tables strictly aligned with KMU exam blueprints, MEDIFY bridges the gap between voluminous slides and high-scoring exam revisions.
              </p>
            </div>
          </div>
        </section>

        {/* Why KMU Modular Curriculum */}
        <section className="space-y-4">
          <h2 className="font-serif-heading text-2xl font-bold text-[#171B35]">
            Why Focus on the KMU Modular Curriculum?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Khyber Medical University pioneered modular integrated education in Khyber Pakhtunkhwa. Rather than studying isolated subjects independently, students learn systems holistically (e.g. Block D Neuroscience synthesizes neuroanatomy, neurophysiology, and neurobiochemistry together).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="bg-white rounded-lg p-5 border border-[#DDE1F2]">
              <div className="w-8 h-8 rounded bg-[#F0F1FA] text-[#6366F1] flex items-center justify-center mb-3">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-serif-heading text-sm font-bold text-[#171B35] mb-1">
                Zero Syllabus Guesswork
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Notes correspond 1-to-1 with official KMU module guide learning objectives and table of specifications.
              </p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-[#DDE1F2]">
              <div className="w-8 h-8 rounded bg-[#F0F1FA] text-[#6366F1] flex items-center justify-center mb-3">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-serif-heading text-sm font-bold text-[#171B35] mb-1">
                Clinical Exam Orientation
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tailored for SEQ and MCQ formats, emphasizing diagnostic differentials and pharmacological mechanisms.
              </p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-[#DDE1F2]">
              <div className="w-8 h-8 rounded bg-[#F0F1FA] text-[#6366F1] flex items-center justify-center mb-3">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <h3 className="font-serif-heading text-sm font-bold text-[#171B35] mb-1">
                Student-First Pricing
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Affordable quarterly and annual passes accessible for medical students across public and private colleges.
              </p>
            </div>
          </div>
        </section>

        {/* Editorial Notice Callout */}
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <span className="font-bold uppercase tracking-wider">Independent Platform:</span>{' '}
          MEDIFY is an independent educational platform. References to KMU curricula do not imply university endorsement.
        </div>

        {/* CTA Strip */}
        <div className="pt-6 border-t border-[#DDE1F2] flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to="/#years"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-xs font-semibold text-white bg-[#171B35] hover:bg-[#6366F1] transition-colors"
          >
            <span>Browse Year Packages</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/contact"
            className="text-xs font-semibold text-[#6366F1] hover:underline"
          >
            Have questions? Contact our editorial team
          </Link>
        </div>

      </div>
    </div>
  );
}

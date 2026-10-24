import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, HelpCircle, ArrowRight } from 'lucide-react';
import { DemoBadge } from '../components/DemoBadge';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is MEDIFY?',
    answer: 'MEDIFY is a specialized digital medical-notes platform built specifically for MBBS undergraduates in Pakistan. It structures complex medical knowledge into high-yield, exam-oriented notes aligned directly with the integrated modular curriculum of Khyber Medical University (KMU).'
  },
  {
    question: 'How do MEDIFY notes align with the KMU modular system?',
    answer: 'Unlike conventional textbooks that cover Anatomy, Physiology, Pathology, and Pharmacology in separate disconnected silos, MEDIFY organizes study materials into the exact KMU Blocks (e.g. Block D for Neuroscience, Block E for GIT & Renal, Block G for Infection & Inflammation). Every chapter maps directly to official KMU learning objectives and Table of Specifications.'
  },
  {
    question: 'Who founded MEDIFY?',
    answer: 'MEDIFY was founded by Syed Nangyal, a medical scholar and developer from Khyber Pakhtunkhwa, with the mission of eliminating study friction and helping Pakistani med students master high-yield concepts efficiently.'
  },
  {
    question: 'What subscription options are available?',
    answer: 'MEDIFY offers three standard subscription durations for every active year: Quarterly (3 months), Half-Yearly (6 months), and Annual (12 months). All plans include full access to the blocks in the selected academic year, clinical tables, and schematics.'
  },
  {
    question: 'How do I pay for a MEDIFY subscription?',
    answer: 'MEDIFY supports two direct payment methods: JazzCash and Meezan Bank. Once you transfer the subscription fee from your mobile wallet or bank app, simply enter your Transaction ID and the last 4 digits of your sending account on the payment form. You can also send your payment screenshot directly via WhatsApp for swift verification.'
  },
  {
    question: 'When will 1st Year and Final Year notes be released?',
    answer: '1st Year MBBS (Foundation, Blood, Locomotor modules) and Final Year MBBS (Medicine, Surgery, Gynaecology/Obstetrics, Paediatrics) are currently marked as "Coming soon" while our editorial team completes clinical validation. 2nd, 3rd, and 4th Year modules are ready for syllabus review.'
  },
  {
    question: 'Can I view a sample chapter right now?',
    answer: 'Yes! You can preview full sample medical notes in our Notes Reader by visiting any block or clicking "Preview Sample Chapter" from the homepage. The reader features adjustable font sizing and light/dark theme toggles.'
  }
];

export function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      
      {/* Top Breadcrumb & Tag */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xs text-[#6366F1] hover:underline">
          ← Home
        </Link>
        <DemoBadge subtext="Placeholder FAQ" />
      </div>

      {/* Hero Header */}
      <div className="bg-[#171B35] text-white rounded-xl p-8 sm:p-12 mb-10 shadow-sm">
        <div className="max-w-2xl space-y-3">
          <span className="text-xs font-bold text-[#6366F1] uppercase tracking-wider">
            Help & Knowledge Base
          </span>
          <h1 className="font-serif-heading text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Frequently Asked Questions
          </h1>
          <p className="text-base sm:text-lg text-[#F0F1FA]/80 leading-relaxed">
            Everything you need to know about MEDIFY subscriptions, KMU curriculum packages, and study resources.
          </p>
        </div>
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-4 mb-12">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;

          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-[#DDE1F2] overflow-hidden shadow-xs transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                aria-expanded={isOpen}
              >
                <span className="font-serif-heading text-sm sm:text-base font-bold text-[#171B35]">
                  {item.question}
                </span>
                <span className="text-[#6366F1] shrink-0">
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 border-t border-[#F0F1FA] leading-relaxed">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notice & Support Strip */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-8">
        <span className="font-bold">Information:</span> Subscriptions and available content are subject to the current listings on MEDIFY. Contact support for account or payment questions.
      </div>

      <div className="pt-6 border-t border-[#DDE1F2] flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-slate-500">
          Still have questions not answered here?
        </span>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
        >
          <span>Contact Student Support</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}

import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0F2837] text-[#E8EEF3] border-t border-[#0F2837]/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Brand Info with Official Logo */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/logo_d0f8a6a4.png"
                alt="MEDIFY — Smart Notes for Med Students"
                className="h-10 sm:h-11 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="font-serif-heading text-xl font-bold tracking-tight text-white leading-none">
                  MEDIFY
                </span>
                <span className="text-[11px] text-[#CFDBE5] font-sans tracking-wider uppercase mt-1">
                  Smart Notes for Med Students
                </span>
              </div>
            </div>
            <p className="text-sm text-[#E8EEF3]/80 max-w-md leading-relaxed">
              Smart, high-yield digital notes tailored for MBBS students under the Khyber Medical University (KMU) modular curriculum in Pakistan.
            </p>
            <p className="text-xs text-[#E8EEF3]/60">
              Founded by <span className="text-white font-medium">Syed Nangyal</span> to streamline modular medical revisions.
            </p>
          </div>

          {/* Quick Academic Links */}
          <div className="space-y-3">
            <h3 className="font-serif-heading text-sm font-semibold text-white uppercase tracking-wider">
              Curriculum & Hub
            </h3>
            <ul className="space-y-2 text-sm text-[#E8EEF3]/80">
              <li>
                <Link to="/#years" className="hover:text-white transition-colors">
                  MBBS Year Packages
                </Link>
              </li>
              <li>
                <Link to="/year/2nd-year" className="hover:text-white transition-colors">
                  2nd Year (Blocks D, E, F)
                </Link>
              </li>
              <li>
                <Link to="/year/3rd-year" className="hover:text-white transition-colors">
                  3rd Year (Blocks G, H, I)
                </Link>
              </li>
              <li>
                <Link to="/year/4th-year" className="hover:text-white transition-colors">
                  4th Year (Blocks J, K, L)
                </Link>
              </li>
              <li>
                <Link to="/read/chap-d1-1" className="hover:text-white transition-colors">
                  Sample Notes Reader
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies & Institutional */}
          <div className="space-y-3">
            <h3 className="font-serif-heading text-sm font-semibold text-white uppercase tracking-wider">
              Information & Legal
            </h3>
            <ul className="space-y-2 text-sm text-[#E8EEF3]/80">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About MEDIFY
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link to="/refund" className="hover:text-white transition-colors">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Divider & Legal Strip */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#E8EEF3]/60">
          <p>© {currentYear} MEDIFY. All rights reserved. Peshawar, Khyber Pakhtunkhwa, Pakistan.</p>
          <div className="flex items-center gap-4">
            <span>KMU Modular Integrated Syllabus</span>
            <span aria-hidden="true">·</span>
            <span>Front-End Preview</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

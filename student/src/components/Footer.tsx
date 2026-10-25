import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPublishedYears, YearDoc } from '../services/curriculum';
import { useSite } from '../context/SiteContext';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const site = useSite();
  const [years, setYears] = useState<YearDoc[]>([]);
  useEffect(() => {getPublishedYears().then(setYears).catch(() => {});}, []);

  return (
    <footer className="bg-[#0f2837] text-[#e8eef3] border-t border-[#0f2837]/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Brand Info with Official Logo */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={site.logoUrl}
                alt={`${site.siteName} logo`}
                className="h-10 sm:h-11 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="font-serif-heading text-xl font-bold tracking-tight text-white leading-none">
                  {site.siteName}
                </span>
                <span className="text-[11px] text-[#cfdbe5] font-sans tracking-wider uppercase mt-1">
                  {site.tagline}
                </span>
              </div>
            </div>
            <p className="text-sm text-[#e8eef3]/80 max-w-md leading-relaxed">
              {site.footerDescription || site.tagline}
            </p>
            <div className="text-xs text-[#e8eef3]/80 space-y-1">
              {site.supportEmail && <div><a href={`mailto:${site.supportEmail}`} className="hover:text-white">{site.supportEmail}</a></div>}
              {site.contactPhone && <div><a href={`tel:${site.contactPhone.replace(/[^+0-9]/g,'')}`} className="hover:text-white">{site.contactPhone}</a></div>}
              {site.contactWhatsApp && <div><a href={`https://wa.me/${site.contactWhatsApp.replace(/\D/g,'')}`} className="hover:text-white" target="_blank" rel="noopener noreferrer">WhatsApp: {site.contactWhatsApp}</a></div>}
            </div>
            <p className="text-xs text-[#e8eef3]/60">
              {site.founderName && <>Founded by <span className="text-white font-medium">{site.founderName}</span>.</>}
            </p>
          </div>

          {/* Quick Academic Links */}
          <div className="space-y-3">
            <h3 className="font-serif-heading text-sm font-semibold text-white uppercase tracking-wider">
              Curriculum & Hub
            </h3>
            <ul className="space-y-2 text-sm text-[#e8eef3]/80">
              <li>
                <Link to="/#years" className="hover:text-white transition-colors">
                  MBBS Year Packages
                </Link>
              </li>
              {years.map(year => (
                <li key={year.id}>
                  <Link to={`/year/${year.id}`} className="hover:text-white transition-colors">{year.name}</Link>
                </li>
              ))}
              <li><Link to="/books" className="hover:text-white transition-colors">Book library</Link></li>
            </ul>
          </div>

          {/* Policies & Institutional */}
          <div className="space-y-3">
            <h3 className="font-serif-heading text-sm font-semibold text-white uppercase tracking-wider">
              Information & Legal
            </h3>
            <ul className="space-y-2 text-sm text-[#e8eef3]/80">
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
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#e8eef3]/60">
          <p>© {currentYear} {site.siteName}. {site.footerCopyright || 'All rights reserved.'}</p>
          <div className="flex items-center gap-4">
            <span>KMU Modular Integrated Syllabus</span>
            <span aria-hidden="true">·</span>
            <span>{site.contactLocation || site.tagline}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

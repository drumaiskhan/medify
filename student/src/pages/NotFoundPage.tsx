import { Link } from 'react-router-dom';
import { BookOpen, ArrowLeft, Home, Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-md w-full bg-white rounded-xl border border-[#CFDBE5] p-8 shadow-xs space-y-5">
        <div className="w-14 h-14 rounded-full bg-[#E8EEF3] text-[#1B8E8E] flex items-center justify-center mx-auto">
          <Compass className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-[#1B8E8E] uppercase tracking-wider">
            Error 404 · Page Not Found
          </span>
          <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#0F2837]">
            Curriculum Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            The page, block, or chapter URL you requested does not exist in the MEDIFY KMU modular curriculum directory.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-semibold text-white bg-[#0F2837] hover:bg-[#1B8E8E] transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Go to Homepage</span>
          </Link>
          <Link
            to="/year/2nd-year"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-semibold text-[#0F2837] bg-[#E8EEF3] hover:bg-[#CFDBE5] transition-colors"
          >
            <span>Browse 2nd Year</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

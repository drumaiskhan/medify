import {NotificationBell} from './NotificationBell';
import {useSite} from '../context/SiteContext';
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, BookOpen, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from '../lib/data';
import { db } from '../lib/client';

export function Navbar() {
  const site=useSite();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  const [firstName, setFirstName] = useState<string>('');

  useEffect(() => {
    if (!user) {
      setFirstName('');
      return;
    }

    if (user.displayName) {
      setFirstName(user.displayName.trim().split(' ')[0]);
    } else {
      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (snap.exists() && snap.data()?.fullName) {
            setFirstName(snap.data().fullName.trim().split(' ')[0]);
          } else if (user.email) {
            setFirstName(user.email.split('@')[0]);
          }
        })
        .catch(() => {
          if (user.email) {
            setFirstName(user.email.split('@')[0]);
          }
        });
    }
  }, [user]);

  const navLinks = [
    { label: 'Home', path: '/' },
    ...(user ? [{label:'Feedback',path:'/feedback'}] : []),
    { label: 'Books', path: '/books' },
    { label: 'Years', path: '/#years' },
    { label: 'Plans', path: '/#plans' },
    { label: 'About', path: '/about' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Contact', path: '/contact' }
  ];

  const isActive = (path: string) => {
    if (path.startsWith('/#')) {
      return false;
    }
    return location.pathname === path;
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0F2837] text-white border-b border-[#0F2837]/60 shadow-sm w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Zone with Official Logo */}
          <Link
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity shrink-0 py-1"
          >
            <img
              src={site.logoUrl}
              alt={`${site.siteName} — ${site.tagline}`}
              className="h-9 sm:h-10 w-auto object-contain"
            />
            <div className="flex flex-col">
              <span className="font-serif-heading text-lg sm:text-xl font-bold tracking-tight text-white leading-none">
                {site.siteName}
              </span>
              <span className="text-[10px] text-[#CFDBE5] font-sans tracking-wider uppercase mt-0.5">
                KMU MBBS Notes
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            {navLinks.filter(link=>link.path!=='/books'||site.booksEnabled).map((link) => (
              <Link
                key={link.label}
                to={link.path}
                className={`transition-colors whitespace-nowrap py-1 border-b-2 ${
                  isActive(link.path)
                    ? 'text-white border-[#1B8E8E] font-semibold'
                    : 'text-[#E8EEF3]/80 border-transparent hover:text-white hover:border-[#1B8E8E]/60'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <NotificationBell/>
          {/* Desktop Auth Section */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-[#E8EEF3] truncate max-w-[130px]" title={user.email || ''}>
                  {firstName || 'Student'}
                </span>
                {isAdmin && (
                  <a
                    href={window.MEDIFY_CONFIG?.ADMIN_URL || import.meta.env.VITE_ADMIN_URL || "http://localhost:3001"}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors border whitespace-nowrap flex items-center gap-1.5 ${
                      location.pathname.startsWith('/admin')
                        ? 'bg-amber-500 text-slate-900 border-amber-400 font-bold'
                        : 'bg-amber-500/20 text-amber-200 border-amber-400/40 hover:bg-amber-500/30'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </a>
                )}
                <Link
                  to="/dashboard"
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors border whitespace-nowrap ${
                    location.pathname === '/dashboard'
                      ? 'bg-[#1B8E8E] text-white border-[#1B8E8E]'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  }`}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-white/90 hover:text-white transition-colors rounded hover:bg-white/10 whitespace-nowrap"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1B8E8E] hover:bg-[#147273] rounded transition-colors shadow-xs whitespace-nowrap"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button & Quick Auth State */}
          <div className="flex items-center gap-2 lg:hidden">
            {user ? (
              <Link
                to="/dashboard"
                className="px-2 py-1 text-xs font-medium text-white/90 bg-white/10 rounded truncate max-w-[90px]"
              >
                {firstName || 'Profile'}
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-2.5 py-1.5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap"
              >
                Log in
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded text-white hover:bg-white/10 transition-colors focus:ring-2 focus:ring-[#1B8E8E] focus:outline-hidden"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0F2837] px-4 pt-3 pb-6 space-y-3">
          <nav className="flex flex-col space-y-1">
            {navLinks.filter(link=>link.path!=='/books'||site.booksEnabled).map((link) => (
              <Link
                key={link.label}
                to={link.path}
                onClick={closeMenu}
                className={`px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-[#1B8E8E] text-white'
                    : 'text-[#E8EEF3]/90 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            {user ? (
              <>
                <div className="px-3 py-1.5 text-xs text-[#E8EEF3]/80 flex items-center justify-between">
                  <span>Signed in as <span className="font-semibold text-white">{firstName || user.email}</span></span>
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-900 uppercase">
                      Admin
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <a
                    href={window.MEDIFY_CONFIG?.ADMIN_URL || import.meta.env.VITE_ADMIN_URL || "http://localhost:3001"}
                    onClick={closeMenu}
                    className="w-full text-center px-4 py-2.5 text-sm font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin Console</span>
                  </a>
                )}
                <Link
                  to="/dashboard"
                  onClick={closeMenu}
                  className="w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-[#1B8E8E] hover:bg-[#147273] rounded transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-center px-4 py-2.5 text-sm font-medium text-slate-200 border border-white/20 rounded hover:bg-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="w-full text-center px-4 py-2.5 text-sm font-medium text-white border border-white/20 rounded hover:bg-white/5 transition-colors"
                >
                  Log in to {site.siteName}
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-[#1B8E8E] hover:bg-[#147273] rounded transition-colors"
                >
                  Create Student Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

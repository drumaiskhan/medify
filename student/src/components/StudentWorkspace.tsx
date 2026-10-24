import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BookMarked, BookOpen, ChevronRight, CircleHelp, CreditCard, GraduationCap, Home, LayoutDashboard, LogOut, Menu, MessageSquareText, Sparkles, UserRound, X, Bell, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import './student-workspace.css';

type NavItem = { label: string; to: string; icon: typeof Home; detail?: string };
const studyLinks: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Books library', to: '/books', icon: BookOpen },
  { label: 'My notes', to: '/dashboard#my-notes', icon: BookMarked },
  { label: 'Study visualizer', to: '/visualizer', icon: Sparkles },
];
const accountLinks: NavItem[] = [
  { label: 'Membership', to: '/dashboard#membership', icon: CreditCard },
  { label: 'My account', to: '/dashboard#account', icon: UserRound },
  { label: 'Notifications', to: '/notifications', icon: Bell },
];
const helpLinks: NavItem[] = [
  { label: 'Send feedback', to: '/feedback', icon: MessageSquareText },
  { label: 'Help & FAQ', to: '/faq', icon: CircleHelp },
];

export function StudentWorkspace({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const site = useSite();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);
  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Student';
  const initials = name.split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase();
  const activeFor = (to: string) => to.includes('#')
    ? location.pathname === '/dashboard' && location.hash === '#' + to.split('#')[1]
    : to === '/dashboard'
      ? location.pathname === '/dashboard' && !location.hash
      : location.pathname === to || (to === '/books' && location.pathname.startsWith('/books/'));
  const navGroup = (label: string, links: NavItem[]) => (
    <div className="sw-nav-group" key={label}>
      <p className="sw-nav-heading">{label}</p>
      {links.filter(link => link.to !== '/books' || site.booksEnabled).map(({ label: text, to, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/dashboard'} className={`sw-nav-link ${activeFor(to) ? 'is-active' : ''}`} aria-current={activeFor(to) ? 'page' : undefined}>
          <Icon size={19} strokeWidth={1.85} aria-hidden="true" />
          <span>{text}</span>
          {activeFor(to) && <span className="sw-active-dot" aria-hidden="true" />}
        </NavLink>
      ))}
    </div>
  );
  const signOut = async () => { try { await logout(); navigate('/'); } catch (e) { console.error('Could not sign out', e); } };
  return (
    <div className="sw-layout">
      {drawerOpen && <button className="sw-drawer-backdrop" aria-label="Close sidebar" onClick={() => setDrawerOpen(false)} />}
      <aside className={`sw-sidebar ${drawerOpen ? 'sw-sidebar-open' : ''}`} aria-label="Student navigation">
        <div className="sw-logo-area">
          <Link to="/" className="sw-brand" aria-label={`${site.siteName} home`}>
            {site.logoUrl ? <img src={site.logoUrl} alt="" className="sw-logo" /> : <span className="sw-brand-icon"><GraduationCap size={22} /></span>}
            <span><strong>{site.siteName || 'Medify'}</strong><small>Student workspace</small></span>
          </Link>
          <button className="sw-mobile-close" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}><X size={20}/></button>
        </div>
        <div className="sw-nav-scroll">
          {navGroup('LEARNING', studyLinks)}
          {navGroup('YOUR SPACE', accountLinks)}
          {navGroup('SUPPORT', helpLinks)}
          {isAdmin && <a className="sw-nav-link" href={window.MEDIFY_CONFIG?.ADMIN_URL || import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001'}><ShieldCheck size={19}/> Admin panel</a>}
        </div>
        <div className="sw-sidebar-bottom">
          <div className="sw-assistance"><span className="sw-assistance-icon"><Sparkles size={17}/></span><strong>Made for focused studying</strong><p>Everything you need, in one organized space.</p></div>
          <button className="sw-signout" type="button" onClick={signOut}><LogOut size={18}/> Sign out <ChevronRight size={16}/></button>
        </div>
      </aside>
      <div className="sw-page-column">
        <header className="sw-topbar">
          <div className="sw-topbar-left">
            <button className="sw-menu-toggle" type="button" aria-label="Open sidebar" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={22}/></button>
            <div><div className="sw-breadcrumb"><Link to="/dashboard">Workspace</Link><ChevronRight size={13}/><span>{location.pathname === '/dashboard' ? (location.hash === '#membership' ? 'Membership' : location.hash === '#account' ? 'Account' : location.hash === '#my-notes' ? 'My notes' : 'Overview') : location.pathname === '/books' ? 'Books library' : location.pathname === '/visualizer' ? 'Study visualizer' : location.pathname === '/feedback' ? 'Feedback' : location.pathname === '/notifications' ? 'Notifications' : 'Study materials'}</span></div><h2 className="sw-topbar-title">Your study space</h2></div>
          </div>
          <div className="sw-topbar-right"><span className="sw-welcome">Welcome back, <strong>{name.split(' ')[0]}</strong></span><Link to="/dashboard#account" className="sw-avatar" title="My account" aria-label="My account">{initials || 'ST'}</Link></div>
        </header>
        <main className="sw-content" id="main-content">{children}</main>
        <div className="sw-endnote">© {new Date().getFullYear()} {site.siteName || 'Medify'} · Your medical learning companion</div>
      </div>
    </div>
  );
}

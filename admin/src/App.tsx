import { useEffect, useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Layers,
  Users,
  Settings,
  CreditCard,
  Ticket,
  MessageSquare,
  Bell,
  LogOut,
  Menu,
  ExternalLink,
  X,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminRoute } from "./components/AdminRoute";
import { LoginPage } from "./pages/LoginPage";
import { AuthActionPage } from "./pages/AuthActionPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CouponsPage } from "./pages/CouponsPage";
import { api } from "./lib/client";
import "./studio.css";
const BooksPage = lazy(() =>
  import("./pages/BooksPage").then((m) => ({ default: m.BooksPage })),
);
const AdminPage = lazy(() =>
  import("./pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
import {FeedbackPage} from './pages/FeedbackPage';
import {NotificationsPage} from './pages/NotificationsPage';
const links = [
  { to: "/", title: "Overview", icon: LayoutDashboard },
  { to: "/books", title: "Book library", icon: BookOpen },
  { to: "/notes", title: "Subject notes", icon: FileText },
  { to: "/curriculum", title: "Curriculum", icon: Layers },
  { to: "/students", title: "Students & payments", icon: Users },
  { to: "/payment-details", title: "Payment details", icon: CreditCard },
  { to: "/coupons", title: "Discount coupons", icon: Ticket },
  { to: "/feedback", title: "Feedback inbox", icon: MessageSquare },
  { to: "/notifications", title: "Notifications", icon: Bell },
  { to: "/settings", title: "Settings", icon: Settings },
];
function Workspace() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false),
    [name, setName] = useState("MEDIFY"),
    [error, setError] = useState("");
  const location = useLocation();
  const [feedbackCount,setFeedbackCount]=useState(0);
  const [registrationCount,setRegistrationCount]=useState<number|null>(null);
  useEffect(()=>{let active=true;const refresh=()=>{if(document.hidden)return;api('/admin/registrations/summary').then(d=>{if(active)setRegistrationCount(d.pending);}).catch(()=>{if(active)setRegistrationCount(null);});};refresh();const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('registrations-updated',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('registrations-updated',refresh);};},[]);
  useEffect(()=>{let active=true;const refresh=()=>api('/admin/feedback/summary').then(d=>{if(active)setFeedbackCount(d.open);}).catch(()=>{});refresh();const timer=window.setInterval(refresh,60000);window.addEventListener('inbox-updated',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('inbox-updated',refresh);};},[]);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    api("/site-settings")
      .then((s) => {
        setName(s.siteName);
        document.documentElement.style.setProperty("--brand", s.accent);
      })
      .catch(() => {});
  }, [location.pathname]);
  const title =
    links.find((l) => l.to === location.pathname)?.title || "Workspace";
  return (
    <div className="studio">
      <button
        className={`studio-scrim ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
        aria-label="Close navigation"
      />
      <aside className={`studio-sidebar ${open ? "open" : ""}`}>
        <a href="/" className="studio-brand">
          <span className="studio-brand-icon">
            <BookOpen size={23} />
          </span>
          <span>
            {name}
            <small>ADMIN WORKSPACE</small>
          </span>
        </a>
        <div className="studio-group">Manage & create</div>
        <nav aria-label="Admin navigation">
          {links.map(({ to, title, icon: Icon }, i) => (
            <NavLink
              key={to}
              end={to === "/"}
              to={to}
              className={({ isActive }) =>
                `studio-nav ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              {title}{to === "/students" && registrationCount !== null && registrationCount > 0 && <span className="studio-pill" title="Registrations awaiting approval">{registrationCount}</span>}{to === "/feedback" && feedbackCount > 0 && <span className="studio-pill">{feedbackCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="studio-bottom">
          <div style={{ padding: "0 12px", marginBottom: 12 }}>
            <strong style={{ color: "white" }}>Administrator</strong>
            <p style={{ marginTop: 5 }}>{user?.email}</p>
          </div>
          <a
            className="studio-nav"
            href={
              window.MEDIFY_CONFIG?.STUDENT_URL ||
              import.meta.env.VITE_STUDENT_URL ||
              "http://localhost:3000"
            }
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Open student site
          </a>
          <button
            className="studio-nav"
            style={{ width: "100%" }}
            onClick={() => logout().catch((e) => setError(e.message))}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="studio-main">
        <header className="studio-header">
          <div className="studio-actions">
            <button
              className="studio-btn studio-mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="Toggle navigation"
            >
              {open ? <X /> : <Menu />}
            </button>
            <small>
              Workspace{" "}
              <span style={{ padding: "0 10px", color: "#bdccce" }}>/</span>
              <strong style={{ color: "#304a50" }}>{title}</strong>
            </small>
          </div>
          <span className="studio-pill" style={{ background: "#e8f4ed" }}>
            ● Administrator
          </span>
        </header>
        <main className="studio-content">
          {error && <div className="studio-alert">{error}</div>}
          <Suspense
            fallback={<div className="studio-empty">Opening workspace…</div>}
          >
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/admin" element={<Navigate to="/" replace />} />
              <Route path="/books" element={<BooksPage />} />
              <Route path="/feedback" element={<FeedbackPage admin />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/coupons" element={<CouponsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {[
                { path: "/notes", tab: "notes", title: "Subject notes" },
                { path: "/curriculum", tab: "year", title: "Curriculum" },
                {
                  path: "/students",
                  tab: "payments",
                  title: "Students & payments",
                },
                {
                  path: "/payment-details",
                  tab: "settings",
                  title: "Payment details",
                },
              ].map((p) => (
                <Route
                  key={p.path}
                  path={p.path}
                  element={
                    <>
                      <div className="studio-heading">
                        <div>
                          <div className="studio-eyebrow">
                            MANAGE YOUR PLATFORM
                          </div>
                          <h1>{p.title}</h1>
                        </div>
                      </div>
                      <div className="studio-legacy">
                        <AdminPage key={p.tab} section={p.tab as any} />
                      </div>
                    </>
                  }
                />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/action" element={<AuthActionPage />} />
      <Route
        path="/*"
        element={
          <AdminRoute>
            <Workspace />
          </AdminRoute>
        }
      />
    </Routes>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}

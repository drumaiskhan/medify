import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { StudentWorkspace } from './components/StudentWorkspace';
import { useAuth } from './context/AuthContext';

import {AuthActionPage} from './pages/AuthActionPage';
import {SiteProvider,useSite} from './context/SiteContext';
import './library.css';
const BooksPage=lazy(()=>import('./pages/BooksPage').then(m=>({default:m.BooksPage})));
const BookReaderPage=lazy(()=>import('./pages/BookReaderPage').then(m=>({default:m.BookReaderPage})));
import {FeedbackPage} from './pages/FeedbackPage';
import {NotificationsPage} from './pages/NotificationsPage';
// Pages
import { HomePage } from './pages/HomePage';
import { YearPage } from './pages/YearPage';
import { BlockPage } from './pages/BlockPage';
import { ReaderPage } from './pages/ReaderPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { FaqPage } from './pages/FaqPage';
import { StudyVisualizerPage } from './pages/StudyVisualizerPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { RefundPage } from './pages/RefundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Scroll to top helper on route transition
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [pathname, hash]);

  return null;
}

// App Layout Controller
function AppContent() {
  const location = useLocation();
  const site=useSite();
  const { user } = useAuth();
  const isBookReader=/^\/books\/[^/]+\/read/.test(location.pathname);
  const isReaderView = location.pathname.startsWith('/read/')||isBookReader;
  const isWorkspace = Boolean(user) && !isReaderView && (/^\/(dashboard|books|year|block|visualizer|feedback|notifications)(\/|$)/.test(location.pathname));

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-800 antialiased selection:bg-[#6366F1] selection:text-white w-full max-w-full overflow-x-hidden">
      <ScrollToTop />
      {!isBookReader&&!isWorkspace&&<Navbar />}
      {!isReaderView&&!isWorkspace&&site.announcement&&<div className="library-announcement">{site.announcement}</div>}

      {isWorkspace ? <StudentWorkspace>
        <Suspense fallback={<div className="library-empty">Opening your study space…</div>}>
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}/>
            <Route path="/books" element={<BooksPage/>}/>
            <Route path="/year/:yearId" element={<YearPage/>}/>
            <Route path="/block/:blockId" element={<BlockPage/>}/>
            <Route path="/visualizer" element={<ProtectedRoute><StudyVisualizerPage/></ProtectedRoute>}/>
            <Route path="/feedback" element={<ProtectedRoute><FeedbackPage/></ProtectedRoute>}/>
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage/></ProtectedRoute>}/>
          </Routes>
        </Suspense>
      </StudentWorkspace> : <main className="flex-1 flex flex-col w-full max-w-full min-w-0">
<Suspense fallback={<div className="library-empty">Opening your study space…</div>}>
        <Routes>
<Route path="/visualizer" element={<ProtectedRoute><StudyVisualizerPage/></ProtectedRoute>}/>
<Route path="/feedback" element={<ProtectedRoute><FeedbackPage/></ProtectedRoute>}/>
<Route path="/notifications" element={<ProtectedRoute><NotificationsPage/></ProtectedRoute>}/>
          <Route path="/books" element={<BooksPage/>}/>
          <Route path="/books/:id/read" element={<BookReaderPage/>}/>
          <Route path="/auth/action" element={<AuthActionPage/>} />
          <Route path="/" element={<HomePage />} />
          <Route path="/year/:yearId" element={<YearPage />} />
          <Route path="/block/:blockId" element={<BlockPage />} />
          <Route path="/read/subject/:subjectId" element={<ReaderPage />} />
          <Route path="/read/:chapterId" element={<ReaderPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </main>}

      {/* Footer rendered on all pages except the immersive Reader */}
      {!isReaderView && !isWorkspace && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider><SiteProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SiteProvider></AuthProvider>
  );
}

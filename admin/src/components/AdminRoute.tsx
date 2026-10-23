import { ReactNode } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Home, LayoutDashboard } from 'lucide-react';

interface AdminRouteProps {
  children?: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-10 h-10 border-3 border-[#1B8E8E] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Verifying administrative access...</p>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not an admin -> show Not authorised screen
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#CFDBE5] p-8 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h1 className="font-serif-heading text-2xl font-bold text-[#0F2837] mb-2">
            Not Authorised
          </h1>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your account (<span className="font-mono text-xs text-slate-700">{user.email}</span>) does not have administrative privileges to manage the curriculum structure.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={()=>logout()} className="px-4 py-2.5 rounded bg-teal-700 text-white">Sign out and use an admin account</button>
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-semibold text-white bg-[#1B8E8E] hover:bg-[#147273] transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Homepage</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

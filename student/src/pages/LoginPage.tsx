import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from '../lib/auth';
import { auth } from '../lib/client';
import { BookOpen, ArrowLeft, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = (location.state as any)?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Incorrect email or password. Please check your credentials and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Access to this account has been temporarily disabled. Please reset your password or try again later.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetMessage(null);

    if (!email.trim()) {
      setError('Please enter your email address in the field above to receive a reset link.');
      return;
    }

    try {
      setIsResetting(true);
      await sendPasswordResetEmail(auth, email.trim());
      // Neutral message per instructions
      setResetMessage('If an account exists for this email, a reset link has been sent.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Unable to send reset email. Contact the administrator.');
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto w-full flex flex-col justify-center">
      
      {/* Top Back Link */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b8e8e] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#cfdbe5] p-6 sm:p-8 shadow-xs space-y-6">
        
        {/* Header with Official Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/assets/aistudio/logo_d0f8a6a4.png"
              alt="MEDIFY"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="font-serif-heading text-2xl font-bold text-[#0f2837]">
            Log in to MEDIFY
          </h1>
          <p className="text-xs text-slate-500">
            Access your KMU modular notes and student dashboard
          </p>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resetMessage && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{resetMessage}</span>
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0f2837] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-white text-slate-800 focus:border-[#1b8e8e] focus:outline-hidden"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#0f2837]">
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-xs font-semibold text-[#1b8e8e] hover:underline focus:outline-hidden cursor-pointer"
              >
                {isResetting ? 'Sending link...' : 'Forgot password?'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-xs rounded border border-[#cfdbe5] bg-white text-slate-800 focus:border-[#1b8e8e] focus:outline-hidden pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded text-xs font-semibold text-white bg-[#1b8e8e] hover:bg-[#147273] disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Log in to MEDIFY</span>
              )}
            </button>
          </div>
        </form>

        {/* Bottom Switch to Register */}
        <div className="pt-4 border-t border-[#e8eef3] text-center text-xs text-slate-600">
          <span>Don't have a student account? </span>
          <Link to="/register" className="font-semibold text-[#1b8e8e] hover:underline">
            Register here
          </Link>
        </div>

      </div>

    </div>
  );
}

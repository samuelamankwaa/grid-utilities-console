import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { loginThunk, clearAuthError } from '../store/authSlice';
import { validateEmailAddress } from '../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Lock,
  Mail,
  Eye,
  EyeOff,
  // ShieldCheck,
  // UserCheck,
  AlertCircle,
  ArrowRight,
  // Sparkles,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, authError } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Field validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [clientErrors, setClientErrors] = useState<{ email?: string; password?: string }>({});

  const validateEmail = (val: string) => {
    return validateEmailAddress(val);
  };

  const validatePassword = (val: string) => {
    if (!val) return 'Password is required';
    if (val.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (authError) dispatch(clearAuthError());
    if (emailTouched) {
      const err = validateEmail(val);
      setClientErrors((prev) => ({ ...prev, email: err }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (authError) dispatch(clearAuthError());
    if (passwordTouched) {
      const err = validatePassword(val);
      setClientErrors((prev) => ({ ...prev, password: err }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    if (emailErr || passErr) {
      setClientErrors({ email: emailErr, password: passErr });
      return;
    }

    setClientErrors({});
    dispatch(loginThunk({ email: email.trim(), password }));
  };

  const isEmailValid = emailTouched && !validateEmail(email);
  const isPasswordValid = passwordTouched && !validatePassword(password);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/40 flex flex-col justify-center items-center px-4 relative font-sans select-none">
      {/* Decorative Ambient Background Shapes */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md z-10 my-auto"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.35 }}
            className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25 mb-3 ring-4 ring-white"
          >
            <LayoutGrid className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Power Grid Utilities Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Sign in to access your role-based console
          </p>
        </div>

        {/* Login White Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)] relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Work Email
                </label>
                {clientErrors.email && (
                  <span className="text-[10px] font-semibold text-rose-500 animate-fadeIn">
                    {clientErrors.email}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => {
                    setEmailTouched(true);
                    setClientErrors((prev) => ({ ...prev, email: validateEmail(email) }));
                  }}
                  placeholder="name@company.com"
                  className={`w-full bg-slate-50/70 border rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all font-medium ${clientErrors.email
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                    : isEmailValid
                      ? 'border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                />
                {isEmailValid && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                {clientErrors.password && (
                  <span className="text-[10px] font-semibold text-rose-500 animate-fadeIn">
                    {clientErrors.password}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={() => {
                    setPasswordTouched(true);
                    setClientErrors((prev) => ({ ...prev, password: validatePassword(password) }));
                  }}
                  placeholder="••••••••"
                  className={`w-full bg-slate-50/70 border rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all font-medium ${clientErrors.password
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                    : isPasswordValid
                      ? 'border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Auth Server Error Message */}
            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{authError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 relative group overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </div>
              ) : (
                <>
                  <span className="text-xs sm:text-sm">Sign In</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

        </div>
      </motion.div>
    </div>
  );
};
export default LoginPage;


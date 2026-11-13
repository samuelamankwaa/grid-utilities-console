import React, { useState, useEffect, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store/store';
import { fetchDbState } from './store/dbSlice';
import { Header } from './components/Header';
import { Filters } from './components/Filters';
import { Kpis } from './components/Kpis';
import { CrewMetricsTable } from './components/CrewMetricsTable';
import { LoginPage } from './components/LoginPage';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

// Code-split components loaded dynamically on demand (§2.2)
const TimesheetTab = React.lazy(() => import('./components/TimesheetTab'));
const UploadModal = React.lazy(() => import('./components/UploadModal').then((m) => ({ default: m.UploadModal })));
const EmployeePositionModal = React.lazy(() => import('./components/EmployeePositionModal').then((m) => ({ default: m.EmployeePositionModal })));
const UserSettingsModal = React.lazy(() => import('./components/UserSettingsModal').then((m) => ({ default: m.UserSettingsModal })));
const ProfitMarginOverTime = React.lazy(() => import('./components/ProfitMarginOverTime').then((m) => ({ default: m.ProfitMarginOverTime })));
const ServiceMap = React.lazy(() => import('./components/ServiceMap').then((m) => ({ default: m.ServiceMap })));

// Lightweight loading fallback matching the existing application design system
const ComponentLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Loading component...' }) => (
  <div className="flex items-center justify-center p-8 text-xs text-blue-700 bg-blue-50/70 border border-blue-200/80 rounded-2xl font-mono">
    <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
    <span>{label}</span>
  </div>
);

export const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPositionOpen, setIsPositionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timesheet'>('dashboard');

  const { status, employeePositionsLoadError } = useSelector((state: RootState) => state.db);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const { isAuthenticated, currentUser, previewRole } = useSelector((state: RootState) => state.auth);

  const actualRole = currentUser?.role || 'Employee';
  const isSupervisorActual = actualRole === 'Supervisor';
  const displayRole = (isSupervisorActual && previewRole) ? previewRole : actualRole;
  const isSupervisor = displayRole === 'Supervisor';

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchDbState() as any);
    }
  }, [dispatch, isAuthenticated]);

  // If not authenticated, render clean Login Page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenPosition={() => setIsPositionOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Global Filter Bar */}
      <Filters />

      {/* Overrides failed to load: labor costs would silently ignore assignments, so say so. */}
      {employeePositionsLoadError && status === 'succeeded' && (
        <div role="alert" className="mx-4 sm:mx-6 mt-4 flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Employee position assignments could not be loaded ({employeePositionsLoadError}). Labor costs currently use automatic role
            classification and timesheet rates.
          </span>
        </div>
      )}

      {activeTab === 'dashboard' ? (
        <main className="flex-1 flex flex-col gap-6 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {/* Database Sync Status Indicator */}
          <AnimatePresence>
            {status === 'loading' && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl font-mono"
              >
                <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Connecting to persistent Supabase cloud database & syncing records...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* KPIs Row */}
          <Kpis />

          {/* Crew Performance Metrics */}
          <CrewMetricsTable />

          {/* Supervisor Analytics (Lazy Loaded) */}
          {isSupervisor && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Suspense fallback={<ComponentLoadingFallback label="Loading profit margin analytics..." />}>
                <ProfitMarginOverTime />
              </Suspense>
              <Suspense fallback={<ComponentLoadingFallback label="Loading service territory map..." />}>
                <ServiceMap />
              </Suspense>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {/* Database Sync Status Indicator */}
          <AnimatePresence>
            {status === 'loading' && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl font-mono mb-6"
              >
                <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Connecting to persistent Supabase cloud database & syncing records...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Suspense fallback={<ComponentLoadingFallback label="Loading timesheet & labor records..." />}>
            <TimesheetTab />
          </Suspense>
        </main>
      )}

      {/* Upload Modal (Lazy Loaded on demand) */}
      {isUploadOpen && (
        <Suspense fallback={<ComponentLoadingFallback label="Loading upload dialog..." />}>
          <UploadModal onClose={() => setIsUploadOpen(false)} />
        </Suspense>
      )}

      {/* Employee Position Modal (Lazy Loaded on demand) */}
      {isPositionOpen && (
        <Suspense fallback={<ComponentLoadingFallback label="Loading position editor..." />}>
          <EmployeePositionModal
            onClose={() => setIsPositionOpen(false)}
            onSaved={(message) => {
              setIsPositionOpen(false);
              setNotice(message);
            }}
          />
        </Suspense>
      )}

      {/* Success notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 right-4 z-[60] max-w-sm flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium px-4 py-3 rounded-xl shadow-lg"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Settings Modal (Lazy Loaded on demand) */}
      {isSettingsOpen && (
        <Suspense fallback={<ComponentLoadingFallback label="Loading user settings..." />}>
          <UserSettingsModal onClose={() => setIsSettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default App;

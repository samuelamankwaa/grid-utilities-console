import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { logout, clearUiPreviewRole, UserRole } from '../store/authSlice';
import { LayoutGrid, UploadCloud, Settings, LogOut, ChevronDown, Clock, BarChart3, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderProps {
  activeTab: 'dashboard' | 'timesheet';
  onTabChange: (tab: 'dashboard' | 'timesheet') => void;
  onOpenUpload: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenUpload, onOpenSettings }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { workOrders, invoices } = useSelector((state: RootState) => state.db);
  const { currentUser, previewRole } = useSelector((state: RootState) => state.auth);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formattedDate = '18 Aug 2026';
  const actualRole = currentUser?.role || 'Employee';
  const isActualSupervisor = actualRole === 'Supervisor';

  // UI view persona (only available to actual Supervisor for previewing permissions UI)
  const displayRole: UserRole = (isActualSupervisor && previewRole) ? previewRole : actualRole;
  const isEmployee = displayRole === 'Employee';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    setDropdownOpen(false);
  };

  const getRoleBadgeClasses = (userRole: UserRole) => {
    switch (userRole) {
      case 'Supervisor':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Admin':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Employee':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <>
      {/* UI Persona Preview Warning Banner (Supervisor Only) */}
      {isActualSupervisor && previewRole && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 text-xs px-6 py-1.5 flex items-center justify-between font-mono z-50">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>
              <strong>UI Preview Active:</strong> Previewing layout as <strong>{previewRole}</strong> (Interface simulation only — backend privileges remain Supervisor).
            </span>
          </div>
          <button
            type="button"
            onClick={() => dispatch(clearUiPreviewRole())}
            className="flex items-center gap-1 text-amber-300 hover:text-white underline cursor-pointer text-[11px]"
          >
            <X className="w-3 h-3" />
            <span>Exit Preview</span>
          </button>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-5 px-6 sm:px-8 bg-slate-900 border-b border-slate-800 text-white select-none relative z-40 gap-4">
        {/* Brand & Stats */}
        <div className="flex items-center gap-3.5">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white my-0">
                Power Grid Utilities Console
              </h1>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border ${getRoleBadgeClasses(
                  displayRole
                )}`}
              >
                {displayRole}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5 font-mono">
              {isEmployee
                ? `${workOrders.length} active work orders · as of ${formattedDate}`
                : `${workOrders.length} work orders · ${invoices.length} invoices · as of ${formattedDate}`}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-850 p-1 rounded-xl border border-slate-700/80 shadow-inner">
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('timesheet')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeTab === 'timesheet'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timesheet</span>
          </button>
        </div>

        {/* Action Buttons & User Menu */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {!isEmployee && (
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 shadow-sm transition-all duration-200 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Upload Console Data</span>
              <span className="sm:hidden">Upload</span>
            </button>
          )}

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {currentUser?.name?.slice(0, 2).toUpperCase() || 'GU'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight">
                  {currentUser?.name || 'User'}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  {actualRole}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 py-2 z-50 text-slate-200"
                >
                  {/* User Info Header */}
                  <div className="px-4 py-2.5 border-b border-slate-800/80">
                    <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider border ${getRoleBadgeClasses(
                          actualRole
                        )}`}
                      >
                        {actualRole} Access
                      </span>
                    </div>
                  </div>

                  {/* User Settings Option */}
                  <div className="p-1 border-b border-slate-800/80">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <Settings className="w-4 h-4 text-blue-400" />
                      <span>User Settings & Team</span>
                    </button>
                  </div>

                  {/* Supervisor UI-Only Preview Section */}
                  {/* {isActualSupervisor && (
                    <div className="p-2 border-b border-slate-800/80">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1">
                        <Eye className="w-3 h-3 text-blue-400" />
                        <span>Preview Role View</span>
                      </p>
                      <div className="space-y-0.5">
                        <button
                          onClick={() => {
                            dispatch(setUiPreviewRole('Supervisor'));
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${displayRole === 'Supervisor'
                              ? 'bg-purple-950/60 text-purple-300 font-bold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                        >
                          <span>Supervisor View</span>
                          {displayRole === 'Supervisor' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                        </button>
                        <button
                          onClick={() => {
                            dispatch(setUiPreviewRole('Admin'));
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${displayRole === 'Admin'
                              ? 'bg-blue-950/60 text-blue-300 font-bold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                        >
                          <span>Admin View</span>
                          {displayRole === 'Admin' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </button>
                        <button
                          onClick={() => {
                            dispatch(setUiPreviewRole('Employee'));
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${displayRole === 'Employee'
                              ? 'bg-emerald-950/60 text-emerald-300 font-bold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                        >
                          <span>Employee View</span>
                          {displayRole === 'Employee' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      </div>
                    </div>
                  )} */}

                  {/* Sign Out Option */}
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;

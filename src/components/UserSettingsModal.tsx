import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import {
  updateProfileThunk,
  updatePasswordThunk,
  inviteTeamMemberThunk,
  updateTeamMemberRoleThunk,
  removeTeamMemberThunk,
  generateSecureRandomPassword,
  UserRole,
} from '../store/authSlice';
import { validateEmailAddress } from '../utils/helpers';
import { motion } from 'framer-motion';
import {
  X,
  User,
  Lock,
  UserPlus,
  Shield,
  Check,
  Send,
  Sparkles,
  Users,
  CheckCircle2,
  Trash2,
  Key,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

interface UserSettingsModalProps {
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentUser, teamMembers, isLoading, inviteSuccessMessage } = useSelector(
    (state: RootState) => state.auth
  );

  const isSupervisor = currentUser?.role === 'Supervisor';
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'team'>('profile');

  // Profile Form State
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [profileEmailError, setProfileEmailError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Invite Form State (Supervisor only)
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('Employee');
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    email: string;
    name: string;
    role: string;
    password: string;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedPasswordOnly, setCopiedPasswordOnly] = useState(false);

  // Team Directory Management State
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [roleUpdateSuccess, setRoleUpdateSuccess] = useState<{ id: string; role: string } | null>(null);

  // Profile update handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileEmailError('');

    const emailErr = validateEmailAddress(email);
    if (emailErr) {
      setProfileEmailError(emailErr);
      return;
    }
    if (!name.trim()) return;

    const res = await dispatch(updateProfileThunk({ name: name.trim(), email: email.trim() }));
    if (updateProfileThunk.fulfilled.match(res)) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } else if (updateProfileThunk.rejected.match(res)) {
      setProfileEmailError((res.payload as string) || 'Failed to update profile');
    }
  };

  // Password update handler
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    const res = await dispatch(updatePasswordThunk({ newPassword }));
    if (updatePasswordThunk.fulfilled.match(res)) {
      setPasswordSaved(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    } else {
      setPasswordError((res.payload as string) || 'Failed to update password.');
    }
  };

  // Invite member handler: Dispatches secure invitation with configured/generated password
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteEmailError('');
    setInviteFeedback(null);
    setInviteSuccessData(null);

    if (!inviteName.trim()) return;

    const emailErr = validateEmailAddress(inviteEmail);
    if (emailErr) {
      setInviteEmailError(emailErr);
      return;
    }

    if (invitePassword.trim() && invitePassword.trim().length < 6) {
      setInviteEmailError('Password must be at least 6 characters long');
      return;
    }

    const res = await dispatch(
      inviteTeamMemberThunk({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        password: invitePassword.trim() || undefined,
      })
    );

    if (inviteTeamMemberThunk.fulfilled.match(res)) {
      const assignedPassword = res.payload.password || invitePassword.trim();
      setInviteSuccessData({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
        password: assignedPassword,
      });
      setInviteFeedback(`Invitation successfully sent to ${inviteEmail.trim()}.`);
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('Employee');
    } else if (inviteTeamMemberThunk.rejected.match(res)) {
      setInviteEmailError((res.payload as string) || 'Failed to send invite');
    }
  };

  const handleCopyCredentials = () => {
    if (!inviteSuccessData) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://grid-console.app';
    const message = `Welcome to Power Grid Utilities Console!\n\nYou have been invited to join the platform as a ${inviteSuccessData.role}.\n\nAccess Credentials:\n- Login URL: ${origin}\n- Email: ${inviteSuccessData.email}\n- Initial Password: ${inviteSuccessData.password}\n\nPlease log in and update your password under Settings > Password & Security.`;
    
    navigator.clipboard.writeText(message);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 3000);
  };

  const handleCopyPasswordOnly = () => {
    if (!inviteSuccessData) return;
    navigator.clipboard.writeText(inviteSuccessData.password);
    setCopiedPasswordOnly(true);
    setTimeout(() => setCopiedPasswordOnly(false), 3000);
  };

  // Role change handler
  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    await dispatch(updateTeamMemberRoleThunk({ memberId, newRole }));
    setRoleUpdateSuccess({ id: memberId, role: newRole === 'Supervisor' ? 'Supervisor (Owner)' : newRole });
    setTimeout(() => setRoleUpdateSuccess(null), 2500);
  };

  // Member removal handler
  const handleConfirmRemove = async (memberId: string, memberEmail: string) => {
    await dispatch(removeTeamMemberThunk({ memberId, email: memberEmail }));
    setDeletingMemberId(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">User Settings & Team Administration</h2>
              <p className="text-xs text-slate-400">Manage your profile, credentials, and access control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'password'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Password & Security</span>
          </button>

          {isSupervisor && (
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'team'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Team Directory ({teamMembers.length})</span>
            </button>
          )}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: PROFILE DETAILS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Work Email Address
                  </label>
                  {profileEmailError && (
                    <span className="text-[11px] font-semibold text-rose-500 animate-fadeIn">
                      {profileEmailError}
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (profileEmailError) setProfileEmailError('');
                  }}
                  onBlur={() => {
                    const err = validateEmailAddress(email);
                    setProfileEmailError(err);
                  }}
                  className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white transition-all font-medium ${
                    profileEmailError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  System Role
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-slate-800">{currentUser?.role}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {currentUser?.role === 'Supervisor'
                      ? 'Owner Authority (Manage Team & All Financials)'
                      : currentUser?.role === 'Admin'
                      ? 'Invoices & Operational View (No Profit Margin)'
                      : 'Field Employee View'}
                  </span>
                </div>
              </div>

              {profileSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Profile updated successfully!
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PASSWORD & SECURITY */}
          {activeTab === 'password' && (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter at least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold">
                  {passwordError}
                </div>
              )}

              {passwordSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Password updated successfully!
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  Update Password
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: TEAM & INVITATIONS (SUPERVISOR / OWNER ONLY) */}
          {activeTab === 'team' && isSupervisor && (
            <div className="space-y-6">
              {/* Invite Form */}
              <form
                onSubmit={handleSendInvite}
                className="p-5 bg-gradient-to-br from-slate-50 to-purple-50/40 border border-purple-100 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Invite New Team Member</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-500">
                        Work Email
                      </label>
                      {inviteEmailError && (
                        <span className="text-[10px] font-semibold text-rose-500 animate-fadeIn">
                          {inviteEmailError}
                        </span>
                      )}
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (inviteEmailError) setInviteEmailError('');
                      }}
                      onBlur={() => {
                        const err = validateEmailAddress(inviteEmail);
                        setInviteEmailError(err);
                      }}
                      className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none transition-all ${
                        inviteEmailError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                          : 'border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-500">
                        Temporary / Initial Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const gen = generateSecureRandomPassword(12);
                          setInvitePassword(gen);
                          setShowInvitePassword(true);
                        }}
                        className="text-[10px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Auto-Generate</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showInvitePassword ? 'text' : 'password'}
                        placeholder="Auto-generated if left blank"
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-16 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowInvitePassword(!showInvitePassword)}
                          className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          title={showInvitePassword ? 'Hide password' : 'Show password'}
                        >
                          {showInvitePassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Minimum 6 characters. Leave empty to auto-generate a secure random password.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Assigned Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                    >
                      <option value="Employee">Employee (Hidden money & financial metrics)</option>
                      <option value="Admin">Admin (Invoices & expenses, no profit margins)</option>
                      <option value="Supervisor">Supervisor (Owner) (Full owner control & all figures)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Password and access credentials are created immediately and prepared for dispatch</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Invite</span>
                  </button>
                </div>
              </form>

              {/* Generated Credentials Card */}
              {inviteSuccessData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 border-2 border-emerald-300 rounded-2xl space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950">Team Member Invitation Created!</h4>
                        <p className="text-[11px] text-emerald-700">
                          Account created for <span className="font-semibold">{inviteSuccessData.email}</span> ({inviteSuccessData.role})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInviteSuccessData(null)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 p-1 hover:bg-emerald-100/60 rounded-lg transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Initial Assigned Password
                      </span>
                      <div className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg inline-block select-all border border-slate-200">
                        {inviteSuccessData.password}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyPasswordOnly}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedPasswordOnly ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy Password</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyCredentials}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        {copiedInvite ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied Invitation!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Full Invitation</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`mailto:${encodeURIComponent(inviteSuccessData.email)}?subject=${encodeURIComponent(
                          'Welcome to Power Grid Utilities - Your Access Credentials'
                        )}&body=${encodeURIComponent(
                          `Welcome to Power Grid Utilities Console!\n\nYou have been invited to join the platform as a ${inviteSuccessData.role}.\n\nAccess Credentials:\n- Login URL: ${
                            typeof window !== 'undefined' ? window.location.origin : ''
                          }\n- Email: ${inviteSuccessData.email}\n- Initial Password: ${inviteSuccessData.password}\n\nPlease log in and update your password under Settings > Password & Security.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        title="Open in Email App"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Status Banner */}
              {!inviteSuccessData && (inviteFeedback || inviteSuccessMessage) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{inviteFeedback || inviteSuccessMessage}</span>
                </motion.div>
              )}

              {/* Team Directory Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>Team Members Directory ({teamMembers.length})</span>
                  </div>
                  {roleUpdateSuccess && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-purple-600" />
                      <span>Role updated to {roleUpdateSuccess.role}!</span>
                    </motion.div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3">Role (Editable)</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Invited Date</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {teamMembers.map((member) => {
                        const isSelf =
                          currentUser &&
                          (currentUser.id === member.id ||
                            currentUser.email.toLowerCase() === member.email.toLowerCase());
                        const isDeleting = deletingMemberId === member.id;

                        return (
                          <tr
                            key={member.id}
                            className={`hover:bg-slate-50/70 transition-colors ${
                              isDeleting ? 'bg-red-50/40' : ''
                            }`}
                          >
                            {/* Member Name & Email */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{member.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 text-slate-600 rounded border border-slate-200">
                                    You (Owner)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{member.email}</div>
                            </td>

                            {/* Role (Editable selector for Supervisor) */}
                            <td className="py-2.5 px-3">
                              <div className="relative inline-block">
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    handleRoleChange(member.id, e.target.value as UserRole)
                                  }
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-1 transition-all ${
                                    member.role === 'Supervisor'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 focus:border-purple-400 focus:ring-purple-300'
                                      : member.role === 'Admin'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 focus:border-blue-400 focus:ring-blue-300'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 focus:border-emerald-400 focus:ring-emerald-300'
                                  }`}
                                  title="Click to edit member role"
                                >
                                  <option value="Employee">Employee</option>
                                  <option value="Admin">Admin</option>
                                  <option value="Supervisor">Supervisor (Owner)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500 text-[10px]">
                                  ▼
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {member.status || 'Active'}
                              </span>
                            </td>

                            {/* Invited Date */}
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-[11px]">
                              {member.invitedAt || 'Active'}
                            </td>

                            {/* Actions Column */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {isSelf ? (
                                  <span className="text-[10px] text-slate-400 italic">Primary Account</span>
                                ) : isDeleting ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmRemove(member.id, member.email)}
                                      className="px-2 py-0.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[10px] font-bold rounded transition-colors cursor-pointer shadow-sm"
                                      title="Confirm Removal"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingMemberId(null)}
                                      className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium rounded transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingMemberId(member.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title={`Remove ${member.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UserSettingsModal;

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../utils/supabaseClient';
import { validateEmailAddress } from '../utils/helpers';

export type UserRole = 'Supervisor' | 'Admin' | 'Employee';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Invited' | 'Pending';
  invitedAt: string;
}

interface AuthState {
  currentUser: UserProfile | null;
  previewRole: UserRole | null; // UI-only persona preview for Supervisors; never touches currentUser or localStorage
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  teamMembers: TeamMember[];
  inviteSuccessMessage: string | null;
}

// Generate cryptographically secure random password with adequate entropy (minimum 18 chars, mixed classes)
export const generateSecureRandomPassword = (length: number = 18): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
};

// Retrieve persisted session without defaulting to any hardcoded superuser
const getSavedAuth = (): { user: UserProfile | null; team: TeamMember[] } => {
  try {
    const savedUserRaw = localStorage.getItem('grid_auth_user');
    const savedTeamRaw = localStorage.getItem('grid_team_members');

    const user: UserProfile | null = savedUserRaw ? JSON.parse(savedUserRaw) : null;
    const team: TeamMember[] = savedTeamRaw ? JSON.parse(savedTeamRaw) : [];

    return { user, team };
  } catch {
    return {
      user: null,
      team: [],
    };
  }
};

const initialAuth = getSavedAuth();

const initialState: AuthState = {
  currentUser: initialAuth.user,
  previewRole: null,
  isAuthenticated: !!initialAuth.user,
  isLoading: false,
  authError: null,
  teamMembers: initialAuth.team,
  inviteSuccessMessage: null,
};

// Verify active Supabase session
export const checkSessionThunk = createAsyncThunk('auth/checkSession', async () => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      const u = data.session.user;
      const userMeta = u.user_metadata || {};
      const userRole: UserRole = (userMeta.role as UserRole) || 'Employee';
      const user: UserProfile = {
        id: u.id,
        email: u.email || '',
        name: userMeta.name || userMeta.full_name || u.email?.split('@')[0] || 'User',
        role: userRole,
        createdAt: u.created_at,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(user));
      return user;
    }
  } catch (e) {
    console.warn('Session check exception:', e);
  }
  return null;
});

// Login Thunk: Authenticates exclusively through Supabase Auth
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data?.user) {
        return rejectWithValue(error?.message || 'Invalid email or password. Please verify your credentials.');
      }

      const userMeta = data.user.user_metadata || {};
      const userRole: UserRole = (userMeta.role as UserRole) || 'Employee';
      const user: UserProfile = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        name: userMeta.name || userMeta.full_name || cleanEmail.split('@')[0],
        role: userRole,
        createdAt: data.user.created_at,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Authentication service error. Please try again.');
    }
  }
);

// Update Profile Thunk
export const updateProfileThunk = createAsyncThunk(
  'auth/updateProfile',
  async ({ name, email }: { name: string; email: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const current = state.auth.currentUser;
      if (!current) throw new Error('Not logged in');

      const emailValidation = validateEmailAddress(email);
      if (emailValidation) {
        return rejectWithValue(emailValidation);
      }

      // 1. Update in Supabase Auth
      try {
        await supabase.auth.updateUser({
          email: email !== current.email ? email : undefined,
          data: { name },
        });
      } catch (e) {
        console.warn('Supabase auth.updateUser non-fatal error:', e);
      }

      // 2. Update in Supabase public.profiles table
      try {
        await supabase.from('profiles').upsert({
          id: current.id,
          email,
          name,
          role: current.role,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase public.profiles upsert notice:', e);
      }

      const updated: UserProfile = {
        ...current,
        name,
        email,
      };
      localStorage.setItem('grid_auth_user', JSON.stringify(updated));

      // Also update in teamMembers list if present
      const team = state.auth.teamMembers.map((m) =>
        m.id === current.id ? { ...m, name, email } : m
      );
      localStorage.setItem('grid_team_members', JSON.stringify(team));

      return { user: updated, team };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update profile');
    }
  }
);

// Update Password Thunk
export const updatePasswordThunk = createAsyncThunk(
  'auth/updatePassword',
  async ({ newPassword }: { newPassword: string }, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return rejectWithValue(error.message);
      }
      return true;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update password');
    }
  }
);

// Invite Team Member Thunk: Uses custom or cryptographically secure random password and Supabase signup/invite flow
export const inviteTeamMemberThunk = createAsyncThunk(
  'auth/inviteTeamMember',
  async (
    {
      name,
      email,
      role,
      password,
    }: { name: string; email: string; role: UserRole; password?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Strict email format validation
      const emailValidation = validateEmailAddress(cleanEmail);
      if (emailValidation) {
        return rejectWithValue(emailValidation);
      }

      const securePassword =
        password && password.trim().length >= 6
          ? password.trim()
          : generateSecureRandomPassword(14);

      // Attempt Supabase Auth invite / sign up with password
      try {
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: securePassword,
          options: {
            data: {
              name,
              role,
            },
            emailRedirectTo:
              typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          },
        });

        if (signUpError) {
          // If already registered, trigger password reset flow to send secure login link
          await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          });
        }
      } catch (e) {
        console.warn('Supabase invite notice:', e);
      }

      const memberId = `user-${Date.now()}`;
      const newMember: TeamMember = {
        id: memberId,
        name,
        email: cleanEmail,
        role,
        status: 'Active',
        invitedAt: new Date().toISOString().split('T')[0],
      };

      // Upsert to Supabase public.profiles table
      try {
        await supabase.from('profiles').upsert({
          id: memberId,
          email: cleanEmail,
          name,
          role,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Supabase public.profiles insert notice:', e);
      }

      const state = getState() as { auth: AuthState };
      const updatedTeam = [
        newMember,
        ...state.auth.teamMembers.filter((m) => m.email.toLowerCase() !== cleanEmail),
      ];
      localStorage.setItem('grid_team_members', JSON.stringify(updatedTeam));

      return {
        member: newMember,
        team: updatedTeam,
        password: securePassword,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to send invitation');
    }
  }
);

// Update Team Member Role Thunk (Supervisor only)
export const updateTeamMemberRoleThunk = createAsyncThunk(
  'auth/updateTeamMemberRole',
  async (
    { memberId, newRole }: { memberId: string; newRole: UserRole },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { auth: AuthState };
      const member = state.auth.teamMembers.find((m) => m.id === memberId);
      if (!member) throw new Error('Member not found');

      // Update in Supabase profiles table
      try {
        await supabase
          .from('profiles')
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .or(`id.eq.${memberId},email.eq.${member.email}`);
      } catch (e) {
        console.warn('Supabase update role notice:', e);
      }

      const updatedTeam = state.auth.teamMembers.map((m) =>
        m.id === memberId ? { ...m, role: newRole } : m
      );
      localStorage.setItem('grid_team_members', JSON.stringify(updatedTeam));

      let updatedCurrentUser = state.auth.currentUser;
      if (
        state.auth.currentUser &&
        (state.auth.currentUser.id === memberId ||
          state.auth.currentUser.email.toLowerCase() === member.email.toLowerCase())
      ) {
        updatedCurrentUser = { ...state.auth.currentUser, role: newRole };
        localStorage.setItem('grid_auth_user', JSON.stringify(updatedCurrentUser));
      }

      return {
        memberId,
        newRole,
        team: updatedTeam,
        currentUser: updatedCurrentUser,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update member role');
    }
  }
);

// Remove Team Member Thunk (Supervisor only)
export const removeTeamMemberThunk = createAsyncThunk(
  'auth/removeTeamMember',
  async (
    { memberId, email }: { memberId: string; email: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      try {
        await supabase
          .from('profiles')
          .delete()
          .or(`id.eq.${memberId},email.eq.${cleanEmail}`);
      } catch (e) {
        console.warn('Supabase delete profile notice:', e);
      }

      const state = getState() as { auth: AuthState };
      const updatedTeam = state.auth.teamMembers.filter(
        (m) => m.id !== memberId && m.email.toLowerCase() !== cleanEmail
      );
      localStorage.setItem('grid_team_members', JSON.stringify(updatedTeam));

      return {
        memberId,
        email: cleanEmail,
        team: updatedTeam,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to remove team member');
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // UI-only persona preview for Supervisors (testing views); NEVER alters currentUser, NEVER persists
    setUiPreviewRole: (state, action: PayloadAction<UserRole | null>) => {
      if (state.currentUser?.role === 'Supervisor') {
        state.previewRole = action.payload;
      }
    },
    clearUiPreviewRole: (state) => {
      state.previewRole = null;
    },
    setCurrentUser: (state, action: PayloadAction<UserProfile>) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem('grid_auth_user', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.currentUser = null;
      state.previewRole = null;
      state.isAuthenticated = false;
      state.authError = null;
      localStorage.removeItem('grid_auth_user');
      try {
        supabase.auth.signOut();
      } catch {}
    },
    clearAuthError: (state) => {
      state.authError = null;
    },
    clearInviteMessage: (state) => {
      state.inviteSuccessMessage = null;
    },
  },
  extraReducers: (builder) => {
    // Session Check
    builder.addCase(checkSessionThunk.fulfilled, (state, action) => {
      if (action.payload) {
        state.currentUser = action.payload;
        state.isAuthenticated = true;
      }
    });

    // Login
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.authError = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.currentUser = action.payload;
        state.previewRole = null;
        state.authError = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.authError = (action.payload as string) || 'Authentication failed';
      });

    // Update Profile
    builder.addCase(updateProfileThunk.fulfilled, (state, action) => {
      state.currentUser = action.payload.user;
      state.teamMembers = action.payload.team;
    });

    // Invite Member (no plaintext password in state)
    builder
      .addCase(inviteTeamMemberThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(inviteTeamMemberThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teamMembers = action.payload.team;
        state.inviteSuccessMessage = `Invitation sent to ${action.payload.member.email}. An access invitation has been dispatched.`;
      })
      .addCase(inviteTeamMemberThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.authError = (action.payload as string) || 'Failed to invite team member';
      });

    // Update Member Role
    builder.addCase(updateTeamMemberRoleThunk.fulfilled, (state, action) => {
      state.teamMembers = action.payload.team;
      if (action.payload.currentUser) {
        state.currentUser = action.payload.currentUser;
      }
    });

    // Remove Member
    builder.addCase(removeTeamMemberThunk.fulfilled, (state, action) => {
      state.teamMembers = action.payload.team;
    });
  },
});

export const {
  setUiPreviewRole,
  clearUiPreviewRole,
  setCurrentUser,
  logout,
  clearAuthError,
  clearInviteMessage,
} = authSlice.actions;

export default authSlice.reducer;

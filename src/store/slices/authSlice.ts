import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../api/auth';
import { errorMessage, setAuthToken } from '../../api/client';
import { usersApi } from '../../api/users';
import { isAdminUser, type User } from '../../api/types';
import { readJson, secureToken, storage, writeJson } from '../../lib/storage';
import { queryClient } from '../../lib/queryClient';
import { IDLE_TIMEOUT_MS } from '../../config/env';
import { stopPush } from '../../features/notifications/push';

// Session state. The JWT lives in the Keychain/Keystore (never in Redux or MMKV);
// the profile is cached in MMKV so the app opens signed in without a network call.

const USER_KEY = 'auth.user';
export const KEEP_KEY = 'auth.keepLoggedIn';
export const BACKGROUND_AT_KEY = 'auth.backgroundAt';
const GENERATED_USERNAME_KEY = 'auth.generatedUsername';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  isAdmin: boolean;
  /** Why the session ended on its own (401 / idle), shown on the sign-in screen. */
  notice: string | null;
}

const initialState: AuthState = { status: 'loading', user: null, isAdmin: false, notice: null };

const LOGIN_FAILED =
  'Login failed. Please check your credentials and try again. If the problem persists, contact support.';
export const IDLE_NOTICE = 'You were signed out after 15 minutes away.';
export const EXPIRED_NOTICE = 'Your session has expired. Please sign in again.';

/** Saves the cached profile; called from the store subscription in store/index.ts. */
export const persistUser = (user: User | null) => (user ? writeJson(USER_KEY, user) : storage.remove(USER_KEY));

// ─── Thunks ───────────────────────────────────────────────────────────────────
export const signOut = createAsyncThunk('auth/signOut', async (notice: string | undefined) => {
  // Unregister this phone for push while the JWT is still valid (skipped after a 401/expiry).
  if (notice === undefined) await stopPush();
  setAuthToken(null);
  await secureToken.clear();
  persistUser(null);
  storage.remove(BACKGROUND_AT_KEY);
  queryClient.clear();
  return notice ?? null;
});

export const refreshUser = createAsyncThunk<User | null, void, { state: { auth: AuthState } }>(
  'auth/refreshUser',
  async (_, { getState }) => {
    const base = getState().auth.user;
    if (!base?.userPkId) return null;
    try {
      const fetched = await usersApi.getById(base.userPkId);
      if (!fetched) return null;
      const image = fetched.profileImageUrl || fetched.imageUrl || base.profileImageUrl || base.imageUrl || null;
      return { ...base, ...fetched, profileImageUrl: image, imageUrl: image };
    } catch {
      return null; // keep the cached profile
    }
  },
);

/** Restores the session on app start. */
export const hydrate = createAsyncThunk<User | null, void, { state: { auth: AuthState } }>('auth/hydrate', async (_, { dispatch }) => {
  const user = readJson<User | null>(USER_KEY, null);
  const token = await secureToken.get();
  const keep = storage.getBoolean(KEEP_KEY) ?? true;
  const backgroundAt = storage.getNumber(BACKGROUND_AT_KEY) ?? 0;
  const idleExpired = !keep && backgroundAt > 0 && Date.now() - backgroundAt > IDLE_TIMEOUT_MS;

  if (!user || !token || idleExpired) {
    if (user || token) await dispatch(signOut(idleExpired ? IDLE_NOTICE : undefined));
    return null;
  }
  setAuthToken(token);
  dispatch(refreshUser());
  return user;
});

export const signIn = createAsyncThunk<
  User,
  { username: string; password: string; keepLoggedIn: boolean },
  { state: { auth: AuthState }; rejectValue: string }
>('auth/signIn', async ({ username, password, keepLoggedIn }, { dispatch, rejectWithValue }) => {
  try {
    const res = await authApi.login(username.trim(), password);
    if (!res?.user || !res?.token) return rejectWithValue(LOGIN_FAILED);
    await secureToken.set(res.token);
    setAuthToken(res.token);
    storage.set(KEEP_KEY, keepLoggedIn);
    storage.remove(BACKGROUND_AT_KEY);
    // The login payload may not include the profile image — fetch the full profile.
    setTimeout(() => dispatch(refreshUser()), 0);
    return res.user;
  } catch (e: any) {
    if (e?.status === 0)
      return rejectWithValue('Network error occurred. Please check your internet connection and try again.');
    if ([400, 401, 403].includes(e?.status)) return rejectWithValue(LOGIN_FAILED);
    return rejectWithValue(errorMessage(e));
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (!state.user) return;
      state.user = { ...state.user, ...action.payload };
      state.isAdmin = isAdminUser(state.user);
    },
    clearNotice(state) {
      state.notice = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(hydrate.fulfilled, (state, { payload }) => {
      if (payload) {
        state.status = 'signedIn';
        state.user = payload;
        state.isAdmin = isAdminUser(payload);
      } else if (state.status === 'loading') {
        state.status = 'signedOut';
      }
    });
    b.addCase(hydrate.rejected, (state) => {
      state.status = 'signedOut';
    });
    b.addCase(signIn.fulfilled, (state, { payload }) => {
      state.status = 'signedIn';
      state.user = payload;
      state.isAdmin = isAdminUser(payload);
      state.notice = null;
    });
    b.addCase(signOut.fulfilled, (_state, { payload }) => ({ ...initialState, status: 'signedOut', notice: payload }));
    b.addCase(refreshUser.fulfilled, (state, { payload }) => {
      if (!payload || state.user?.userPkId !== payload.userPkId) return;
      state.user = payload;
      state.isAdmin = isAdminUser(payload);
    });
  },
});

export const { updateUser, clearNotice } = authSlice.actions;
export default authSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────
type WithAuth = { auth: AuthState };
export const selectUser = (s: WithAuth) => s.auth.user;
export const selectNodeId = (s: WithAuth) => s.auth.user?.nodeId ?? null;
export const selectIsAdmin = (s: WithAuth) => s.auth.isAdmin;
export const selectAuthStatus = (s: WithAuth) => s.auth.status;
export const selectIsSignedIn = (s: WithAuth) => s.auth.status === 'signedIn';
export const selectAuthNotice = (s: WithAuth) => s.auth.notice;

// ─── Generated username hand-off (sign-up → sign-in prefill) ──────────────────
export const takeGeneratedUsername = () => {
  const u = storage.getString(GENERATED_USERNAME_KEY);
  if (u) storage.remove(GENERATED_USERNAME_KEY);
  return u ?? '';
};
export const saveGeneratedUsername = (u: string) => storage.set(GENERATED_USERNAME_KEY, u);

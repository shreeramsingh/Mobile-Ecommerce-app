import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import {
  persistReducer,
  persistStore,
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  type Storage,
} from 'redux-persist';
import { AppState } from 'react-native';
import { storage } from '../lib/storage';
import { setUnauthorizedHandler } from '../api/client';
import { IDLE_TIMEOUT_MS } from '../config/env';
import authReducer, { BACKGROUND_AT_KEY, EXPIRED_NOTICE, IDLE_NOTICE, KEEP_KEY, persistUser, signOut } from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import filtersReducer from './slices/filtersSlice';
import recentlyViewedReducer from './slices/recentlyViewedSlice';
import chatReducer from './slices/chatSlice';

// redux-persist storage backed by MMKV (fast, synchronous native storage).
const mmkvStorage: Storage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key: string) => Promise.resolve(storage.getString(key) ?? null),
  removeItem: (key: string) => {
    storage.remove(key);
    return Promise.resolve();
  },
};

const rootReducer = combineReducers({
  // Session is restored by the `hydrate` thunk (token in Keychain), not by redux-persist.
  auth: authReducer,
  cart: persistReducer({ key: 'cart', version: 1, storage: mmkvStorage }, cartReducer),
  // Remember the chosen city, not the search text.
  filters: persistReducer({ key: 'filters', storage: mmkvStorage, whitelist: ['selectedCity'] }, filtersReducer),
  recentlyViewed: persistReducer({ key: 'recentlyViewed', storage: mmkvStorage }, recentlyViewedReducer),
  // Unread counts come from the server on sign-in, so they aren't persisted.
  chat: chatReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) =>
    getDefault({
      // redux-persist dispatches non-serializable actions; ignore them.
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// Keep the cached profile in MMKV in sync with the store (skipped while still loading).
let lastUser = store.getState().auth.user;
store.subscribe(() => {
  const { user, status } = store.getState().auth;
  if (user === lastUser || status === 'loading') return;
  lastUser = user;
  persistUser(user);
});

// ─── Session wiring ───────────────────────────────────────────────────────────
// Any 401 from a protected endpoint ends the session (same as the website).
setUnauthorizedHandler(() => {
  if (store.getState().auth.status === 'signedIn') store.dispatch(signOut(EXPIRED_NOTICE));
});

// Without "keep me logged in", end the session after 15 minutes in the background.
AppState.addEventListener('change', (next) => {
  if (store.getState().auth.status !== 'signedIn') return;
  if (next === 'background') {
    storage.set(BACKGROUND_AT_KEY, Date.now());
  } else if (next === 'active') {
    const keep = storage.getBoolean(KEEP_KEY) ?? true;
    const at = storage.getNumber(BACKGROUND_AT_KEY) ?? 0;
    storage.remove(BACKGROUND_AT_KEY);
    if (!keep && at > 0 && Date.now() - at > IDLE_TIMEOUT_MS) store.dispatch(signOut(IDLE_NOTICE));
  }
});

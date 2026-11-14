import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from '../api/client';

// Server-state cache for the whole app. Sensible defaults for a large user base:
// short stale time (fresh data without hammering the API), no retries on client errors,
// limited retries with backoff on network/server errors.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

// Refetch stale queries when the app returns to the foreground.
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

// Treat requests as online by default; failed fetches surface as errors and retry on reconnect.
onlineManager.setOnline(true);

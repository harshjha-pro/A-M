// Server data rules (IMPLEMENTATION §3.5): reads retried twice on network
// errors; writes never retried automatically; no optimistic "saved".
// networkMode 'always': with no internet a read still runs, so api() can answer from the
// phone's copy (PWA §5.1). React Query's default ('online') pauses every read once the
// phone goes offline, leaving screens on "…" (found in Session 14).
import { QueryClient } from '@tanstack/react-query';
import { OfflineError } from './api/errors.js';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (count, err) => err instanceof OfflineError && err.code !== 'not_cached' && err.code !== 'needs_internet' && count < 2,
        networkMode: 'always',
      },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

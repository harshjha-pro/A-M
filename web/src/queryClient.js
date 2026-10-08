// Server data rules (IMPLEMENTATION §3.5): reads retried twice on network
// errors; writes never retried automatically; no optimistic "saved".
import { QueryClient } from '@tanstack/react-query';
import { OfflineError } from './api/errors.js';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (count, err) => err instanceof OfflineError && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

// Shared QueryClient + persistence + online/focus wiring for React Query.
// One client per app instance; persisted to AsyncStorage so cold-start renders
// from disk while we revalidate in the background.

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 30s — within that window we don't refetch on focus.
      staleTime: 30_000,
      // Keep in memory + disk for 7 days.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
      // We use realtime + manual invalidation; focus refetch is just a safety net.
      refetchOnWindowFocus: true,
      // Realtime + cached data means we can be liberal here.
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'familycal.qc-v1',
  throttleTime: 1000,
});

// Wire react-native foreground/background to React Query's focus manager.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    handleFocus(status === 'active');
  });
  return () => sub.remove();
});

// Wire NetInfo to React Query's online manager.
onlineManager.setEventListener((setOnline) => {
  const unsub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    setOnline(online);
  });
  return () => unsub();
});

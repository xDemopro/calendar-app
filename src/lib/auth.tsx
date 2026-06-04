import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { clearOutbox } from './outbox';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

// Keep this in sync with `persister.key` in queryClient.ts. Hardcoded here to
// avoid an import cycle; the value is the persisted React Query cache.
const QC_PERSIST_KEY = 'ffcal.qc-v1';

// Wipe everything user-scoped. Device-scoped state (theme mode, calendar view
// mode) lives under different keys and is intentionally NOT cleared.
async function clearUserScopedState() {
  // Cancel in-flight fetches so they don't write a stale response back into the
  // freshly-cleared cache.
  await queryClient.cancelQueries();
  queryClient.clear();
  try {
    await AsyncStorage.removeItem(QC_PERSIST_KEY);
  } catch {
    // best-effort
  }
  await clearOutbox();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks the last user id we observed so we can detect account switches
  // (vs. token refreshes for the same user, which must NOT clear the cache).
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      const currentUserId = s?.user.id ?? null;
      const previousId = previousUserId.current;

      // Clear on explicit sign-out, OR when the user id changes between
      // observations (account switch). We deliberately don't clear when
      // previousId is null on first observation — that's the normal cold-start
      // path where the persisted cache is valid for the signed-in user.
      const userChanged = previousId !== null && previousId !== currentUserId;
      if (event === 'SIGNED_OUT' || userChanged) {
        await clearUserScopedState();
      }

      previousUserId.current = currentUserId;
      setSession(s);
    });

    // Resume token auto-refresh when the app foregrounds.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      sub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUser() {
  const { session } = useAuth();
  return session?.user ?? null;
}

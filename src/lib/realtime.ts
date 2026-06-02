// Supabase realtime subscriptions. We watch the relevant tables and invalidate
// the matching React Query keys so screens refresh as other family members make
// changes. The subscription is scoped to a single family — see useFamilyRealtime.

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { qk, qkMatch } from './queryKeys';
import { supabase } from './supabase';

export function useFamilyRealtime(familyId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`family:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` },
        () => {
          qc.invalidateQueries(qkMatch.anyEventsForFamily(familyId));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_participants' },
        (payload: any) => {
          // We don't have family_id on participants, so invalidate broadly.
          const eventId = (payload.new ?? payload.old)?.event_id;
          if (eventId) {
            qc.invalidateQueries({ queryKey: qk.participants(eventId) });
            qc.invalidateQueries(qkMatch.anyEventsForFamily(familyId));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_attachments' },
        (payload: any) => {
          const eventId = (payload.new ?? payload.old)?.event_id;
          if (eventId) qc.invalidateQueries({ queryKey: qk.attachments(eventId) });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` },
        () => {
          qc.invalidateQueries({ queryKey: qk.familyMembers(familyId) });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${familyId}` },
        () => {
          qc.invalidateQueries({ queryKey: qk.family(familyId) });
          qc.invalidateQueries({ queryKey: qk.families() });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, qc]);
}

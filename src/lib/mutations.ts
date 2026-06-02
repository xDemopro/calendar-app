// useMutation hooks layered over the outbox. The pattern:
//
//   1. onMutate: optimistically update the React Query cache (so UI reflects the
//      change immediately, online or offline).
//   2. mutationFn: enqueue the op in the outbox. Returns immediately.
//   3. The outbox drainer talks to Supabase in the background, retrying on
//      reconnect. When it finishes, realtime + invalidation pick up the real
//      server row.
//
// This means EVERY write is "offline-safe": even when online, we never block
// the UI on the network round-trip; the optimistic state is applied instantly
// and the actual write goes through the queue.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  EventInsert,
  EventRow,
  EventUpdate,
} from './database.types';
import { enqueue } from './outbox';
import { qk, qkMatch } from './queryKeys';
import { supabase } from './supabase';

function newClientId() {
  return `tmp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function authedUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// ----- events -----

export function useCreateEventMutation(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventInsert, 'created_by'>) => {
      const created_by = await authedUserId();
      const clientId = newClientId();
      const fullInput: EventInsert = { ...input, created_by };
      const optimistic: EventRow = {
        id: clientId,
        family_id: fullInput.family_id,
        title: fullInput.title,
        description: fullInput.description ?? null,
        location: fullInput.location ?? null,
        starts_at: fullInput.starts_at,
        ends_at: fullInput.ends_at ?? null,
        all_day: fullInput.all_day ?? false,
        created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Patch every cached events-list for this family.
      qc.getQueriesData<EventRow[]>(qkMatch.anyEventsForFamily(familyId)).forEach(([key, list]) => {
        if (Array.isArray(list)) qc.setQueryData(key, [...list, optimistic]);
      });
      await enqueue({ kind: 'create_event', clientId, input: fullInput });
      return optimistic;
    },
    onSettled: () => {
      qc.invalidateQueries(qkMatch.anyEventsForFamily(familyId));
    },
  });
}

export function useUpdateEventMutation(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: EventUpdate }) => {
      // Optimistically merge in every cached list.
      qc.getQueriesData<EventRow[]>(qkMatch.anyEventsForFamily(familyId)).forEach(([key, list]) => {
        if (Array.isArray(list)) {
          qc.setQueryData(
            key,
            list.map((e) => (e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e)),
          );
        }
      });
      qc.setQueryData<EventRow | undefined>(qk.event(id), (prev) =>
        prev ? { ...prev, ...patch, updated_at: new Date().toISOString() } : prev,
      );
      await enqueue({ kind: 'update_event', id, patch });
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries(qkMatch.anyEventsForFamily(familyId));
      qc.invalidateQueries({ queryKey: qk.event(vars.id) });
    },
  });
}

export function useDeleteEventMutation(familyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      qc.getQueriesData<EventRow[]>(qkMatch.anyEventsForFamily(familyId)).forEach(([key, list]) => {
        if (Array.isArray(list)) qc.setQueryData(key, list.filter((e) => e.id !== id));
      });
      qc.removeQueries({ queryKey: qk.event(id) });
      await enqueue({ kind: 'delete_event', id });
    },
    onSettled: () => {
      qc.invalidateQueries(qkMatch.anyEventsForFamily(familyId));
    },
  });
}

// ----- participants -----

export function useAddParticipantMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const addedBy = await authedUserId();
      // Optimistic: add a placeholder entry with the user_id (UI will resolve
      // the profile via cache when realtime fills it in).
      qc.setQueryData<any[]>(qk.participants(eventId), (prev) =>
        prev ? [...prev, { user_id: userId, added_at: new Date().toISOString(), profile: null }] : prev,
      );
      await enqueue({ kind: 'add_participant', eventId, userId, addedBy });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.participants(eventId) });
    },
  });
}

export function useRemoveParticipantMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      qc.setQueryData<any[]>(qk.participants(eventId), (prev) =>
        prev ? prev.filter((p) => p.user_id !== userId) : prev,
      );
      await enqueue({ kind: 'remove_participant', eventId, userId });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.participants(eventId) });
    },
  });
}

// ----- attachments (notes only — pictures/files still require online for upload) -----

export function useCreateNoteMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; body: string }) => {
      const createdBy = await authedUserId();
      const clientId = newClientId();
      const optimistic = {
        id: clientId,
        event_id: eventId,
        kind: 'note' as const,
        data,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<any[]>(qk.attachments(eventId), (prev) =>
        prev ? [...prev, optimistic] : prev,
      );
      await enqueue({ kind: 'create_note', clientId, eventId, createdBy, data });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.attachments(eventId) });
    },
  });
}

export function useUpdateNoteMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; body: string } }) => {
      qc.setQueryData<any[]>(qk.attachments(eventId), (prev) =>
        prev ? prev.map((a) => (a.id === id ? { ...a, data } : a)) : prev,
      );
      await enqueue({ kind: 'update_note', id, data });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.attachments(eventId) });
    },
  });
}

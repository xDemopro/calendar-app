// Persisted outbox for offline-tolerant mutations. Each mutation pushes an op
// here; a drainer worker calls Supabase for each op when the device is online.
//
// Optimistic updates to the React Query cache happen at the call site (see
// src/lib/mutations.ts), independently from this queue. After a successful
// server write the outbox itself reconciles the cache via
// queryClient.invalidateQueries — so the optimistic row is replaced with the
// real one, not blown away too early.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';

import type { EventInsert, EventUpdate } from './database.types';
import { queryClient } from './queryClient';
import { qk, qkMatch } from './queryKeys';
import { supabase } from './supabase';

const STORAGE_KEY = 'ffcal.outbox-v1';

export type OutboxOp =
  | { kind: 'create_event'; clientId: string; input: EventInsert }
  | { kind: 'update_event'; id: string; patch: EventUpdate }
  | { kind: 'delete_event'; id: string }
  | { kind: 'add_participant'; eventId: string; userId: string; addedBy: string }
  | { kind: 'remove_participant'; eventId: string; userId: string }
  | { kind: 'create_note'; clientId: string; eventId: string; createdBy: string; data: { title: string; body: string } }
  | { kind: 'update_note'; id: string; data: { title: string; body: string } }
  | { kind: 'create_link'; clientId: string; eventId: string; createdBy: string; data: { url: string; title?: string } }
  | { kind: 'update_link'; id: string; data: { url: string; title?: string } }
  | { kind: 'delete_attachment_row'; id: string };

export type OutboxItem = {
  id: string;
  createdAt: number;
  op: OutboxOp;
  retries: number;
  lastError?: string;
};

type Listener = (state: { items: OutboxItem[]; draining: boolean }) => void;

let items: OutboxItem[] = [];
let draining = false;
let loaded = false;
let listeners: Listener[] = [];

function notify() {
  const snap = { items: [...items], draining };
  listeners.forEach((l) => l(snap));
}

export function subscribeOutbox(l: Listener): () => void {
  listeners.push(l);
  // Send the current snapshot immediately so subscribers don't wait for the
  // next change.
  l({ items: [...items], draining });
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function getPending(): OutboxItem[] {
  return [...items];
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // best-effort
  }
}

async function loadFromDisk() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) items = JSON.parse(raw);
  } catch {
    items = [];
  }
  loaded = true;
  notify();
}

let lastEnqueueOrder = 0;
function generateId() {
  // We don't have a real RNG here that's allowed to be called freely (Date.now()
  // is fine), so combine timestamp + counter.
  lastEnqueueOrder = (lastEnqueueOrder + 1) & 0xffff;
  return `ob_${Date.now().toString(36)}_${lastEnqueueOrder.toString(36)}`;
}

export async function enqueue(op: OutboxOp): Promise<OutboxItem> {
  await loadFromDisk();
  const item: OutboxItem = {
    id: generateId(),
    createdAt: Date.now(),
    op,
    retries: 0,
  };
  items.push(item);
  await persist();
  notify();
  // Try to drain right away; if offline this is a no-op.
  drain().catch(() => {});
  return item;
}

async function applyOp(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case 'create_event': {
      const { error } = await supabase.from('events').insert(op.input);
      if (error) throw error;
      queryClient.invalidateQueries(qkMatch.anyEventsForFamily(op.input.family_id));
      return;
    }
    case 'update_event': {
      const { error } = await supabase.from('events').update(op.patch).eq('id', op.id);
      if (error) throw error;
      // We don't track family_id on this op shape, but invalidating the event
      // and broadly invalidating events queries works since the predicate also
      // matches by familyId we typically don't have here. Just bust the event
      // entry; the list queries will refetch on next focus/pull.
      queryClient.invalidateQueries({ queryKey: qk.event(op.id) });
      return;
    }
    case 'delete_event': {
      const { error } = await supabase.from('events').delete().eq('id', op.id);
      if (error) throw error;
      queryClient.removeQueries({ queryKey: qk.event(op.id) });
      return;
    }
    case 'add_participant': {
      const { error } = await supabase.from('event_participants').insert({
        event_id: op.eventId,
        user_id: op.userId,
        added_by: op.addedBy,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: qk.participants(op.eventId) });
      return;
    }
    case 'remove_participant': {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', op.eventId)
        .eq('user_id', op.userId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: qk.participants(op.eventId) });
      return;
    }
    case 'create_note': {
      const { error } = await supabase.from('event_attachments').insert({
        event_id: op.eventId,
        kind: 'note',
        data: op.data as any,
        created_by: op.createdBy,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: qk.attachments(op.eventId) });
      return;
    }
    case 'update_note': {
      const { error } = await supabase
        .from('event_attachments')
        .update({ data: op.data as any })
        .eq('id', op.id);
      if (error) throw error;
      // We don't know the event_id here — accept this and let realtime / focus
      // bring the cache in line.
      return;
    }
    case 'create_link': {
      const { error } = await supabase.from('event_attachments').insert({
        event_id: op.eventId,
        kind: 'link',
        data: op.data as any,
        created_by: op.createdBy,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: qk.attachments(op.eventId) });
      return;
    }
    case 'update_link': {
      const { error } = await supabase
        .from('event_attachments')
        .update({ data: op.data as any })
        .eq('id', op.id);
      if (error) throw error;
      // Same as update_note: no event_id on the op; realtime/focus reconciles.
      return;
    }
    case 'delete_attachment_row': {
      const { error } = await supabase.from('event_attachments').delete().eq('id', op.id);
      if (error) throw error;
      return;
    }
  }
}

// Wipe queue + disk + notify subscribers. Called from auth when the user signs
// out or switches accounts so user A's pending mutations don't run as user B.
export async function clearOutbox(): Promise<void> {
  items = [];
  lastEnqueueOrder = 0;
  loaded = true; // skip the next loadFromDisk(); we know disk is empty
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
  notify();
}

export async function drain(): Promise<void> {
  await loadFromDisk();
  if (draining) return;
  if (!onlineManager.isOnline()) return;
  if (items.length === 0) return;

  draining = true;
  notify();
  try {
    while (items.length > 0 && onlineManager.isOnline()) {
      const head = items[0];
      try {
        await applyOp(head.op);
        items.shift();
        await persist();
        notify();
      } catch (e: any) {
        head.retries += 1;
        head.lastError = e?.message ?? String(e);
        await persist();
        notify();
        // Give up after 5 retries to avoid spinning forever on a broken op.
        // Move it to the back of the line so other ops can flow.
        if (head.retries >= 5) {
          items.shift();
          items.push(head);
          await persist();
          notify();
        }
        // Backoff before next attempt.
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
  } finally {
    draining = false;
    notify();
  }
}

// Drain whenever we come online.
onlineManager.subscribe((isOnline) => {
  if (isOnline) drain().catch(() => {});
});

// Eager-load so subscribers see existing pending items right away.
loadFromDisk().then(() => {
  drain().catch(() => {});
});

// Canonical query keys. Keep all keys here so invalidation is type-safe and consistent.

export const qk = {
  families: () => ['families'] as const,
  family: (id: string) => ['family', id] as const,
  familyMembers: (familyId: string) => ['family', familyId, 'members'] as const,

  // Calendar event lists are windowed by month range — keys include the bounds.
  events: (familyId: string, fromIso: string, toIso: string) =>
    ['events', familyId, fromIso, toIso] as const,
  // Bar-view 42-day grid uses the same shape but with grid bounds.
  eventsWithParticipants: (familyId: string, fromIso: string, toIso: string) =>
    ['eventsWithParticipants', familyId, fromIso, toIso] as const,

  event: (id: string) => ['event', id] as const,
  attachments: (eventId: string) => ['attachments', eventId] as const,
  participants: (eventId: string) => ['participants', eventId] as const,

  profile: (userId: string) => ['profile', userId] as const,
};

/** Convenience: invalidation matchers used after mutations. */
export const qkMatch = {
  /** Any events query for a family (across all month windows). */
  anyEventsForFamily: (familyId: string) => ({ predicate: (q: any) => {
    const k = q.queryKey;
    return Array.isArray(k) && (k[0] === 'events' || k[0] === 'eventsWithParticipants') && k[1] === familyId;
  } }),
};

# F&F Calendar — Claude context

A shared family calendar built on Expo + Supabase. Each family is a small group of users who can all see, add, and edit a single calendar; events can carry rich attachments (notes today, hotel bookings / boarding passes later).

This file is loaded automatically by Claude Code in this repo. Skim it before making changes.

---

## Stack

- **Expo SDK 54** (do not bump without expecting churn — the babel/hermes-parser chain is sensitive)
- **React Native 0.81.5**, **Expo Router** with `experiments.typedRoutes` on
- **TypeScript** strict, paths: `@/*` → `./src/*`
- **Hanken Grotesk** via `@expo-google-fonts/hanken-grotesk` (5 weights)
- **Supabase** (Postgres + Auth + Storage + Realtime)
  - Project ref: `hkqxxdhvkddijkbhwhwd`
- **TanStack Query v5** with `@tanstack/query-async-storage-persister` for offline-first reads
- **`@expo/vector-icons` → Feather** as the only icon family in use

Do **not** turn `experiments.reactCompiler` back on. It triples bundle time and the gains are negligible at this scale.

---

## Run / dev

```bash
npx expo start         # daily — incremental, Fast Refresh
npx expo start -c      # clears Metro cache; only after upgrading a package
npx tsc --noEmit       # type-only check (no test suite)
```

There is **no test suite**. There is **no lint script** wired up beyond what tsc catches.

For physical-device testing: Expo Go on iOS works fine. The native Apple Sign In does work in Expo Go on iOS thanks to `expo-apple-authentication`.

---

## Project layout

```
src/
  app/                       expo-router file-based routes (see below)
  components/                reusable UI (Button, Input, Screen, ContextMenu,
                             UserAvatar, FamilyAvatar, EventForm,
                             ParticipantsRow, AttachmentsSection, BarMonthView,
                             OfflineBanner)
  lib/
    supabase.ts              Supabase client w/ AsyncStorage session persistence
    auth.tsx                 AuthProvider, useAuth, useUser
    queryClient.ts           single QueryClient + AsyncStorage persister +
                             onlineManager/focusManager wiring
    queryKeys.ts             canonical keys + invalidation matchers (qk, qkMatch)
    mutations.ts             useMutation hooks that go through the outbox
    outbox.ts                persistent mutation queue; drains on reconnect;
                             invalidates queries AFTER server write succeeds
    realtime.ts              useFamilyRealtime(familyId): postgres_changes
                             subscriptions that invalidate query keys
    queries.ts               raw Supabase read helpers
    attachments.ts           pictures/files: pickers + storage upload
    storage.ts               generic upload + publicUrl + signedUrl helpers
    eventColor.ts            deterministic per-event color from a 10-hue palette
    viewMode.ts              AsyncStorage-backed bar/dot view toggle
    database.types.ts        hand-maintained mirror of Supabase types
  theme/
    tokens.ts                source of truth: light + dark palettes, event palette,
                             type scale (per-weight family names), space, radius,
                             motion
    ThemeContext.tsx         ThemeProvider, useTheme(), useThemeColors()
    AccentContext.tsx        DEPRECATED shim — re-exports ThemeContext under old
                             names so older imports compile. Don't add new code
                             against this.
    theme.ts                 legacy compat layer of static `colors`/`spacing`/
                             `typography` (resolves to LIGHT palette). New code
                             should use useThemeColors() + tokens directly.
```

### Routes

```
(auth)/sign-in.tsx                              Email/pw + Google + native Apple
(app)/(tabs)/index.tsx                          Families home (large title, search,
                                                Create/Join row, long-press menu)
(app)/(tabs)/settings.tsx                       Profile + System/Light/Dark + Sign out
(app)/new-family.tsx                            modal
(app)/join-family.tsx                           modal
(app)/family/[id]/index.tsx                     Calendar (Bars/Dots toggle in header)
(app)/family/[id]/edit.tsx                      owner only
(app)/family/[id]/invite.tsx                    modal — code + truncated link + copy
(app)/family/[id]/event/new.tsx                 modal
(app)/family/[id]/event/[eventId]/index.tsx     view-only
(app)/family/[id]/event/[eventId]/edit.tsx      modal
(app)/family/[id]/event/[eventId]/note.tsx      modal (note attachment editor)
(app)/family/[id]/event/[eventId]/link.tsx      modal (link attachment editor)
(app)/family/[id]/event/[eventId]/add-participant.tsx  modal
(app)/profile/[userId].tsx                      modal
```

Typed routes are on — if you add a new route, the next `npx expo start` will regenerate `.expo/types/router.d.ts`. If TypeScript complains about a new pathname literal, restart Metro briefly to regen.

---

## How data flows (read this before touching queries)

### Reads

Every read uses `useQuery` with a key from `qk.*` in `src/lib/queryKeys.ts`. The QueryClient persists to AsyncStorage (7-day TTL) — cold starts render from disk immediately while a background revalidation hits Supabase.

```ts
const { data: events = [] } = useQuery({
  queryKey: qk.eventsWithParticipants(familyId, fromIso, toIso),
  queryFn: () => listEventsWithParticipants(familyId, fromIso, toIso),
});
```

Do **not** call `getX()` inside a `useEffect` or `useFocusEffect` for screen data — that pattern is gone. The exceptions are one-shot signed URL minting (e.g. opening a picture attachment) where caching wouldn't help.

### Writes (offline-tolerant)

Every mutation goes through the **outbox** in `src/lib/outbox.ts`. The pattern:

1. **Optimistic** — the mutation hook in `mutations.ts` writes directly to the React Query cache so the UI updates instantly.
2. **Enqueue** — the op is pushed onto a persisted queue in AsyncStorage.
3. **Drain** — when online, `drain()` pops the head, calls Supabase, and on success **invalidates the right query keys**. The invalidation lives inside `applyOp` in `outbox.ts`, NOT in the mutation hook.

Why: the previous design invalidated in `onSettled` (right after enqueue), which raced the outbox drain and would overwrite the optimistic update with stale server data. Don't add `onSettled: invalidate(...)` back to mutations.

Picture/file uploads currently still require online — they don't go through the outbox. Notes do.

### Realtime

`useFamilyRealtime(familyId)` (called in the calendar screen) subscribes to `postgres_changes` on `events`, `event_participants`, `event_attachments`, `family_members`, `families` (filtered to the family). When a change arrives, the matching query keys are invalidated.

**Critical:** Supabase realtime requires tables to be in the `supabase_realtime` publication. If you add a new table that needs live updates, run:

```sql
alter publication supabase_realtime add table public.<name>;
```

The current publication includes all six tables above plus `profiles`.

### Auth lifecycle — cache + outbox reset

`AuthProvider` (`src/lib/auth.tsx`) listens to `supabase.auth.onAuthStateChange`
and clears all **user-scoped** state when:

- the event is `SIGNED_OUT` (Settings sign-out, token revocation, refresh failure), or
- the observed user id changes between two consecutive events (account switch)

What gets cleared:
- React Query in-memory cache (`queryClient.clear()`)
- React Query disk persistence (`AsyncStorage.removeItem('ffcal.qc-v1')`)
- The outbox queue (`clearOutbox()` in `outbox.ts`)

What is **not** cleared (device-scoped, survives user switches):
- `ffcal.themeMode` (light/dark/system)
- `ffcal.viewMode` (bars vs dots)

`previousUserId` is null on first observation, so the **normal cold-start path**
(open the app already signed in) does NOT clear — the persisted cache is still
valid for that user. Token refreshes for the same user also don't clear.

If you add new user-scoped AsyncStorage keys (e.g. drafts, last-visited family),
clear them inside `clearUserScopedState` in `auth.tsx`. If you add new
device-scoped keys, do nothing — they should persist across users.

### Online/offline UI

`<OfflineBanner />` is mounted in the root layout. It shows:
- Hidden when online + outbox empty (the common case).
- Amber "Offline · N changes queued" when no network.
- Accent "Syncing N changes…" while the drainer catches up after reconnect.

`onlineManager` is wired to `@react-native-community/netinfo`; `focusManager` to `AppState`.

---

## Theming

Two themes from `tokens.ts`:
- **Light** — warm cream paper (`#F3ECDE` bg, amber `#B47B26` accent).
- **Dark** — fireside warm-charcoal (`#171411` bg, brighter amber `#E6A848` accent).

Mode is picked in Settings: **System / Light / Dark**. Persisted via AsyncStorage.

Use **`useThemeColors()`** for any color in a new component:

```ts
const t = useThemeColors();
// t.bg, t.bgElev, t.bgRaised, t.ink, t.fgMed, t.fgLow,
// t.border, t.borderStr, t.accent, t.accentSoft, t.onAccent,
// t.today, t.danger, t.success, t.warning, t.sheet
```

Use the **`type` scale** from `tokens.ts`:

```ts
import { type } from '@/theme/tokens';
<Text style={[type.headline, { color: t.ink }]}>…</Text>
```

Important: with custom fonts, React Native does not auto-bold based on `fontWeight`. The `type.*` styles already pick the right per-weight Hanken family (`HankenGrotesk_400Regular`, `_700Bold`, etc.). If you set `fontWeight: '700'` manually without setting `fontFamily: FONT_FAMILY_BY_WEIGHT['700']`, you'll get the regular weight rendered.

The **per-event color** (bar background + dot + text) comes from `colorForEvent(id, scheme)` / `barBgForEvent(id, scheme)` in `src/lib/eventColor.ts`. Deterministic per event id; mode-aware solid + tinted-bg variants.

---

## Sharp edges (real ones, not hypothetical)

### 1. Don't develop from inside iCloud-synced folders

The project used to live at `~/Desktop/calendar-app`. macOS Desktop is iCloud-synced; iCloud kept creating "conflicted copy" duplicates inside `node_modules` (`@expo 2`, `@react-native 2`, etc.) which broke Metro's module resolution and made bundling hang. The project now lives at `~/Developer/calendar-app` — Apple-blessed location, explicitly NOT iCloud-synced.

If `node_modules` gets corrupted again (Metro hangs, "Cannot find module ...", babel `BlockStatement is not iterable`):

```bash
pkill -f "expo start"; pkill -f "metro"
mv node_modules node_modules.trash && rm -rf node_modules.trash &
rm -f package-lock.json
npm install --legacy-peer-deps
```

The atomic `mv` is the key — `rm -rf node_modules` directly can race with a watcher and never finish.

### 2. Use `--legacy-peer-deps` for installs

Some Expo SDK 54 peer requirements clash with current `react-native-windows` peers. We've consistently used `--legacy-peer-deps`. Be aware: chaining many such installs without a fresh `package-lock.json` can leave mismatched transitive deps (we've hit this with hermes-parser specifically). If anything starts behaving weirdly after several installs, do the clean reinstall above.

### 3. Supabase Storage RLS — qualify `name`

In a policy on `storage.objects`, if you write a subquery against another table, unqualified `name` will resolve to **that other table's** `name` column, not the storage object's path. Always write `storage.objects.name` explicitly. We hit this with family avatars (`family_avatar_family_id(name)` resolved to `families.name` and tried to cast "Dengizmans" to UUID).

### 4. The Supabase MCP server defaulted to read-only

If you spin up a new session and your MCP-driven Supabase migrations fail with "Cannot apply migration in read-only mode," check `~/.claude.json` → `mcpServers.supabase.args` and remove `--read-only`.

### 5. Picture / file uploads are online-only

The `addPictureFromLibrary` / `addFileFromDocuments` paths upload to Supabase Storage synchronously. Don't move them into the outbox without first solving "copy the picked file to a stable local path and queue the upload" — picker URIs are not stable.

### 6. Routes with the same dynamic segment

`family/[id]/event/[eventId]/` is a directory (`index.tsx` is the view screen). If you ever want both `[eventId].tsx` and `[eventId]/something.tsx`, expo-router will refuse — keep the directory layout.

### 7. expo-file-system legacy submodule

`expo-file-system/legacy` is imported by `src/lib/storage.ts` for `readAsStringAsync`. Metro resolves this at runtime, but tsc can't find a type declaration because the package has no `exports` map. The shim at `src/types/expo-file-system-legacy.d.ts` keeps tsc happy.

---

## Database

Schema lives in Supabase (project `hkqxxdhvkddijkbhwhwd`). Tables: `profiles`, `families`, `family_members`, `events`, `event_participants`, `event_attachments`.

Helper RPCs (all SECURITY DEFINER, granted only to `authenticated`):
- `create_family(p_name)` — creates family + adds caller as owner
- `join_family_by_code(p_code)` — adds caller as member
- `kick_family_member(p_family, p_user)` — owner only
- `is_family_member(p_family, p_user)` — used inside RLS policies

Storage buckets:
- `event-attachments` (private) — `<event_id>/<file>` path layout
- `family-avatars` (private) — `<family_id>/<file>` path layout
- `user-avatars` (**public**) — `<user_id>/<file>` path layout

All RLS policies are membership-scoped via `is_family_member()`.

When adding migrations: prefer the Supabase MCP `apply_migration` tool. If unavailable, write SQL into `supabase/migrations/` and paste into the dashboard SQL editor.

---

## What's not done yet (in priority order)

- **Picture / file uploads offline**: outbox doesn't handle them; would need expo-file-system to copy picked file to a stable local path before queueing.
- **Signed-URL cache**: every picture remount calls `createSignedUrl`. A `Map<path, {url, expiresAt}>` would eliminate the per-mount roundtrip.
- **expo-image swap**: `Image` works fine but `expo-image` has a better disk cache + memory cache. One-file change.
- **Invite link**: `https://ffcal.app/join/<CODE>` is a placeholder. There's no domain yet, no landing page, no universal link. Wire when ready to ship.
- **Member kick is not symmetric**: an owner can't promote another member to owner. There's only one owner per family by construction. If you need multi-owner, change `family_members.role` semantics.
- **Empty states** are plain text. Per the design brief, illustrations would help.
- **App icon / splash** are still the Expo defaults.

---

## Style / conventions

- Avoid adding new abstractions until there's a second caller. The codebase favors a few well-known patterns repeated, not deep abstraction trees.
- Don't add comments that just restate the code. Save comments for the "why" — especially for the outbox, realtime, RLS, and theming, all of which have non-obvious decisions worth preserving.
- Don't add error handling for cases that can't happen. Trust framework guarantees. Validate at boundaries (user input, Supabase responses), not throughout the call stack.
- If you remove a feature, delete its code rather than leaving `// removed` markers or `_unused` renames.
- Prefer `useThemeColors()` + tokens over hardcoded hex.
- Prefer the `type.*` scale over inline `fontSize`/`fontWeight`.
- For new icons, use `Feather` from `@expo/vector-icons` to stay consistent with the rest of the UI.

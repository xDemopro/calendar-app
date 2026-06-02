# FamilyCal

A shared calendar app for families, built on Expo (React Native) + Supabase.

## Quick start

```bash
npm install      # already done if you ran the scaffold
npm start        # opens the Expo dev server — scan the QR with Expo Go
```

`.env` is committed locally with the Supabase URL and publishable key for this project. **Don't commit `.env` to a real repo** — `.gitignore` already excludes it.

### Test it

1. `npm start`, scan QR with **Expo Go** on your phone.
2. Create an account with email + password (you'll get a confirmation email — check it before signing in).
3. Tap **Create a new family** → give it a name → you'll get a shareable **invite code**.
4. From another account/device, tap **Join a family with a code** and paste the code.
5. Tap the family to open the calendar. Tap **+ Add event** to create events.

## Project structure

```
src/
  app/                       expo-router screens
    _layout.tsx              auth gate (redirects to /sign-in if signed out)
    (auth)/sign-in.tsx       email+password / Google / Apple
    (app)/
      _layout.tsx            stack for signed-in screens
      index.tsx              your families
      new-family.tsx         create a family (modal)
      join-family.tsx        join with invite code (modal)
      family/[id]/
        index.tsx            month calendar + day events
        event/new.tsx        create event
        event/[eventId].tsx  view / edit / delete event
  components/                Button, Input, Screen, EventForm
  lib/
    supabase.ts              Supabase client with AsyncStorage session
    auth.tsx                 AuthProvider + useAuth hook
    queries.ts               typed query helpers
    database.types.ts        types generated from Supabase
  theme/theme.ts             colors / spacing / typography tokens
```

## Backend (Supabase)

Tables (all RLS-protected):
- `profiles` — extends `auth.users`, auto-created on sign-up.
- `families` — one row per family, has a short `invite_code`.
- `family_members` — `(family_id, user_id, role)` junction.
- `events` — events scoped to a family.
- `event_attachments` — `jsonb` payload keyed by `kind` (`hotel`, `flight`, `boarding_pass`, …). **Not yet wired into the UI**; this is the table the rich-attachment feature will use.

RPC helpers (SECURITY DEFINER, callable by `authenticated` only):
- `create_family(p_name)` — creates a family + adds the caller as `owner`.
- `join_family_by_code(p_code)` — adds the caller as a `member` of the family with that code.

### RLS summary

- A user can see / edit only families they're a member of and events within them.
- `family_members` inserts are blocked at the table level — joins go through `join_family_by_code` only, so you need the invite code.

## What's done vs. what's next

Done:
- Schema + RLS + helper RPCs.
- Auth (email/password, Google OAuth via browser, Apple Sign In on iOS).
- Family list, create, join.
- Month calendar, day's events, create / view / edit / delete events.

Next:
- **Rich event attachments** — UI for adding hotel bookings, boarding passes, files. Table is already there (`event_attachments`).
- **Storage** — Supabase Storage bucket for PDFs / images.
- Members list per family + kick / leave UI.
- Push notifications for shared events.
- Polished frontend (animations, week view, agenda view).

## Configuring OAuth providers

The Supabase project needs Google and Apple providers configured before the OAuth buttons actually work:

1. **Google**: Supabase Dashboard → Authentication → Providers → Google. Add a Google OAuth client (Web type) and paste the client ID + secret. Add `https://hkqxxdhvkddijkbhwhwd.supabase.co/auth/v1/callback` to the Google Cloud OAuth client's "Authorized redirect URIs".
2. **Apple**: Supabase Dashboard → Authentication → Providers → Apple. Create a Services ID in Apple Developer, add the Supabase callback URL above as the return URL, and paste the credentials. For native Apple Sign In on iOS (which uses `expo-apple-authentication`), no extra Supabase config beyond the provider being enabled is needed.

Until those are configured, the Google / Apple buttons will return an error. Email + password works out of the box.

## Notes

- The calendar fetches events one month at a time. For very busy calendars, switch to a windowed query keyed off the visible range.
- Session is persisted with `AsyncStorage`. The auth provider re-runs token refresh when the app foregrounds.
- All datetimes are stored as `timestamptz` in UTC and rendered in the device's local timezone with `date-fns`.

# FamilyCal — Design brief

I'm working on a React Native app called **FamilyCal**: a shared calendar where every member of a family can see, add, and edit each other's events, and attach rich content to events (notes, photos, eventually hotel bookings and boarding passes). It's already functionally complete and runs on iOS/Android via Expo. Now I want a serious visual + interaction design pass before I write the polished frontend.

Please review every screen below, propose a refined visual system (colors, type, spacing, iconography, motion), and produce screen-by-screen mockups or wireframes that I can hand back to my engineer. Where the current implementation feels generic or unfinished, propose something better — don't preserve the current look for its own sake.

---

## Product context

- **Who it's for**: families and small close-knit groups (siblings, partners, parents-and-kids, friends-as-family). Multi-generational — should not feel like a startup productivity tool.
- **The two big moments**:
  1. Glancing at the month to see what's happening this week.
  2. Pulling up a specific event to find the hotel booking, boarding pass, or note someone in the family added.
- **Mood**: warm, calm, a bit playful. Not corporate. Not gamified. Closer to *Notion's photo library* or *Apple Notes' new look* than to *Google Calendar*.
- **Platform**: iOS-first (looks/feels native there), Android second. Phones primarily; tablet later.
- **Theme**: currently dark-only. I'm open to dual light/dark, with dark as the primary mode.

---

## Identity / aesthetic direction (current and what I want)

**Current state** (placeholder):
- Single dark theme. Deep navy/charcoal background (`#0B0F14`), card panel (`#1B232C`), border (`#262F3A`), muted text (`#9AA4B2`).
- Accent color is user-selectable from a fixed palette of 7 hues (Blue, Teal, Green, Amber, Pink, Purple, Red). The user picks one in Settings and the whole chrome (buttons, tab bar active state, today highlight, calendar arrows) adopts it.
- Event bars in the bar-view calendar are color-coded **per event** using a deterministic 10-hue palette (pink, orange, amber, lime, emerald, teal, cyan, sky, purple, red). The same event keeps the same color across months.
- Typography is system default. Spacing tokens are 4 / 8 / 12 / 16 / 24 / 32. Radius tokens are 6 / 10 / 16 / pill.

**What I want from you**:
- A real visual identity. Logotype/wordmark for "FamilyCal", a 1024×1024 app icon, a launch screen.
- A typographic scale (display / title / body / caption / etc.) — feel free to suggest a custom font pairing.
- A refined color system with named tokens: backgrounds (default, elevated, raised), foreground (high/medium/low contrast), accents, status (success/warning/danger), and a dedicated palette for event tinting.
- Iconography — currently using Unicode emoji as tab icons (👪, ⚙). Replace with a coherent icon set.
- Motion guidelines — what eases, what doesn't, default durations.

Keep the user-selectable accent (it matters emotionally to families — "ours is teal"), but make it work harmoniously with the per-event color palette so they don't fight visually.

---

## Architecture / nav model

- **Auth gate** at the root. Signed-out users see one screen.
- Signed in: **bottom tab bar** with two tabs — *Families* and *Settings*.
- Tapping a family from the Families tab pushes a **Stack** of screens above the tab bar: family calendar, event detail, edit screens, etc. (The tab bar is hidden while inside a family.)
- Modal presentations are used for: New family / Join family / Note editor / Event editor / Add participants / Profile sheet.

---

## Screen-by-screen

### 1. Sign in / Sign up (only screen when signed out)

Single screen with a vertical flow:
- App title and one-line subtitle ("A shared calendar for the people you care about.")
- Email input
- Password input (with show/hide toggle ideally)
- Primary button: "Sign in" (toggles to "Create account" via a ghost-button row below it: "Need an account? Sign up")
- Divider with "OR" label
- Secondary buttons:
  - "Continue with Google" — opens browser OAuth.
  - "Continue with Apple" — native sheet on iOS, browser fallback on Android.
- Error text appears between the password field and the primary button when an attempt fails.
- After sign-up, an alert tells the user to check their email for confirmation.

Currently it's a plain stacked form on dark background. I'd love a hero/illustration treatment that feels welcoming, not "another fintech".

### 2. Families tab (signed-in home)

A scrollable list of the user's families. Each family is a **card**:
- 52-px round **family avatar** on the left (a real photo if set, otherwise a colored circle with the family's first initial — color follows the accent).
- Family name (subtitle weight).
- Role line: "Owner" or "Member".
- Hint line: "Long-press for more".

Long-pressing a card triggers an **iOS-style context menu**: a Reanimated-driven Modal that:
- Adds a haptic tick.
- Scales the pressed card up ~4% via a spring (1.04 scale).
- Blurs and dims the background (BlurView intensity 30, tint dark, opacity fade-in over 180ms).
- Floats a translucent action list below (or above if no room) with a fade + 8px slide-up.

Actions:
- **Invite** — opens OS share sheet pre-filled with the family's invite code.
- **Edit** (owner only).
- **Delete family** (owner only, with confirmation).
- **Leave family** (non-owner only, with confirmation).

Empty state: when the user has no families, an empty-state message + nudge toward the Settings tab where they can create/join.

The invite code is intentionally never visible without explicitly tapping Invite.

### 3. Settings tab

Several sections, stacked vertically with consistent spacing:

**Profile section** (top, visually emphasized):
- Large tappable circular **user avatar** (104 px).
- Caption: "Tap photo to change".
- Display-name input, autocapitalize=words, placeholder "What should we call you?".
- Greyed email line below the input.
- "Save name" button.

Tapping the avatar opens a system action sheet: Pick / Change photo, Remove photo, Cancel. Pick goes through `expo-image-picker` with 1:1 crop, quality 0.85. Uploaded to a public Supabase Storage bucket; the public URL is used directly so the image loads instantly without a signed-URL roundtrip.

**Appearance section**:
- "Accent color" label.
- Row of 7 color swatches (40-px circles). The currently selected swatch has a white border. Tapping changes the accent app-wide, persisted via AsyncStorage.

**Families section**:
- "Create a new family" primary button → opens a modal where you type a name and submit.
- "Join a family with a code" secondary button → opens a modal where you type the 8-char invite code (alphanum, no 0/O/I/1).

**Account section**:
- "Sign out" danger button — confirmation alert before signing out.

### 4. Create-family modal / Join-family modal

Plain modals presented over the Settings tab:
- Create: title, single text input "Family name", primary "Create" button. On success, navigate straight into the new family's calendar.
- Join: title, single uppercase-locked text input "Invite code" (max 12, autocapitalize=characters), primary "Join" button. On success, navigate into that family.

### 5. Family calendar (the heart of the app)

This is the screen you reach by tapping a family. There are **two view modes** the user can toggle between, persisted globally:

Header (custom):
- 28-px family avatar + family name (left-aligned in the header).
- Right side: **"Bars" / "Dots"** text button to toggle the view mode + **"Invite"** text button.
- Back button shows "Families" (not the route group name).

**5a. Dot view** (default):
- A swipeable `react-native-calendars` `CalendarList` in horizontal-paging mode.
- Each day with events shows up to 4 small colored dots, one per event (using the per-event palette). Multi-day events contribute a dot to every day they span.
- Below the calendar, a "Day header" with the selected day's date and a spinner if loading.
- Below that, a **vertical list of events for the selected day**, each event a card:
  - Title (bold)
  - Time range or "All day"
  - Optional location line
- Tap an event card → opens the **view** screen (read-only).
- Long-press an event card → context menu (same animation as families list) with **Edit** and **Delete**.
- Floating bottom button: "+ Add event" (full-width primary).

**5b. Bar view** (Apple Calendar-style):
- Full-screen month grid. **No day list below.**
- Monday-start week. Weekday header `M T W T F S S`, weekends muted.
- Cells show day numbers; today's number is in a filled accent-color circle.
- Trailing next-month days are hidden (cells stay there but with no number). Leading previous-month days are shown muted (lower opacity).
- Events render as colored **bars** stretched across the days they span (multi-day events are one continuous bar, broken only by week boundaries). Each bar shows: up to 3 small (18-px) participant avatars on the left (overlapping), then a `+N` badge if more, then the event title in the per-event color. The bar background is the per-event color at ~20% alpha.
- Multi-day events that cross a week-row boundary: the **first** week shows participants + title; subsequent weeks show just the colored bar with no text.
- Max 3 lanes per cell. Events beyond the third lane are dropped from the visual stack — a tiny `+N` indicator appears at the bottom of each day that has overflow.
- Tap a bar → view screen.
- Swipe horizontally to flip months (paged, gentle drags stay put).

Floating bottom button: same "+ Add event".

I'd love the bar view to feel more **expressive** than my current implementation — better typography in the bars, maybe a soft drop-shadow per bar, smarter handling of crowded days (today Apple just gives up and shows "+2"; we could do better).

### 6. Event view (read-only)

Reached by tapping an event in the calendar.

- Header title is the event name. (No edit/delete buttons here.)
- Card with rows: "When", "Where", "Notes" (the description text).
- **Participants** section: row of 48-px circular avatars + a 48-px **dashed-outline circle with a `+`** at the end (the add-participant trigger). Tap an avatar → opens that person's profile sheet. Long-press an avatar → context menu with "View profile" / "Remove from event".
- **Attachments** section. Renders a vertical stack of attachment cards, then a "+ Add component" secondary button:
  - **Note** attachment card: title (if set, bold) + truncated body.
  - **Picture** attachment card: full-width image with the original aspect ratio.
  - **File** attachment card: 📄 icon + filename + mime type + size.
- Tap on a picture/file → opens via signed Supabase Storage URL (browser/native viewer).
- Long-press an attachment → context menu with "Edit" (notes only) + "Delete".

Adding components is via Alert with options: Note / Picture / File / Cancel. Note opens the editor; Picture goes through the image picker; File goes through the document picker. All three upload (where applicable) and immediately appear in the list.

### 7. New event / Edit event (modal)

Stacked form:
- Title input (placeholder "What's happening?")
- Location input ("Optional")
- Notes multi-line input ("Optional")
- **Date & time card**:
  - Row: "All day" with a switch.
  - Row: "Starts date" tappable, value shows formatted date.
  - Row: "Starts time" tappable (hidden when all-day).
  - Row: "Ends date" — always present (no opt-in toggle). Defaults to start date.
  - Row: "Ends time" (hidden when all-day). Defaults to start + 1 hour.
- Native iOS inline date/time picker appears below the form when a row is tapped. "Done" button dismisses.
- Primary button at the bottom: "Create event" / "Save". Validation: title required, end ≥ start (pushed automatically if user moves start past end).
- Edit screen also has a "Cancel" ghost button. Deletion is **not** here — it lives on the calendar long-press menu.

### 8. Edit family (owner-only)

- Tappable 104-px family avatar at top, "Tap photo to change" caption. Same picker pattern as Settings/profile.
- "Name" section: input + "Save name" button.
- "Members (N)" section: each member is a row:
  - 44-px tappable user avatar → opens that user's profile sheet.
  - Display name (plus " (you)" if self).
  - Role label (owner / member).
  - "Remove" danger button (only shown for non-self non-owner rows). Confirmation alert before removing.

### 9. Profile sheet (modal)

Reached by tapping any user's avatar anywhere in the app.
- Centered large user avatar (160 px).
- Display name (title weight) below it.
- Currently spare — could grow to show shared families, mutual events, recent activity. For the brief, just propose what should live here.

### 10. Note editor (modal)

Reached when creating or editing a note attachment.
- Title input (optional)
- Body multi-line input (~180 px tall, top-aligned)
- "Save note" primary button.

### 11. Add participants (modal)

Reached from the `+` in the participants row.
- Title and subtitle ("Pick from your family members").
- Vertical list of rows, one per family member who isn't already a participant:
  - 44-px avatar
  - Display name
  - Role (owner/member)
  - "Add" link on the right (turns into a spinner while inserting). The list shrinks after each add.
- "Done" link at the bottom to dismiss.

---

## Reusable components in the app

I'd like a coherent design for each:

- **Button**: primary (filled accent), secondary (card-colored with border), ghost (transparent, accent text), danger (filled red). Height 48 px today. Loading state shows a spinner in place of the label.
- **Input**: labeled text field. 48 px min height. Subtle border, slightly darker bg than the surrounding card. Error state shows a red bottom message under it.
- **Family avatar**: round, sized prop. Solid accent-colored placeholder with the first letter when no photo.
- **User avatar**: round, sized prop. Solid placeholder color is **deterministic per name** (hash → palette) — different family members get different placeholder colors. Falls back to a photo when set.
- **Context menu**: the iOS-style press-and-hold component described above. Used on families list, events list, and attachments.
- **Screen**: SafeAreaView wrapper with consistent padding, optional scroll.
- **Event bar** (bar view): the colored row in the month grid described above.
- **Tab bar**: bottom, two items (Families / Settings).
- **Header**: per-screen, with optional avatar + title cluster, right-side text actions.

---

## Motion + interaction principles I want a stance on

1. **Long-press context menu**: the snappy-but-soft Apple feel. What spring config? How should the action list animate vs the focused card?
2. **Month change in bar view**: currently a native paged scroll. Should there be a parallax/translate on weekday names? A momentary date stamp during the swipe?
3. **Tab switch**: instant currently. Should there be a crossfade or a shared-element transition between tabs?
4. **Avatar upload progress**: currently a translucent overlay with a spinner over the avatar. Could be cuter.
5. **Empty states**: families empty list, day with no events, event with no participants/attachments. Right now they're plain text. Would love illustration-driven empty states without overdoing it.

---

## Specific asks for you, the designer

For each screen above, please produce:

1. A **mid-fidelity** mockup (light + dark if you go dual-mode; otherwise dark).
2. The component-level **specs** I'd need to implement it (padding, font size/weight, exact tokens).
3. **Annotations** for any motion or interaction that isn't obvious from the still frame.
4. At least one **flow diagram** for: signup → first family → first event with picture attachment. Show the empty states the user passes through.
5. A **token doc**: colors (every named role), typography (every scale step), spacing, radius, shadows, motion (easings + durations), iconography.

If you think a screen or flow should be restructured rather than re-skinned, **say so** and propose the alternative — I'd rather rebuild a screen than polish a bad layout.

---

## Things I'm not asking you to decide

- Backend / data model. That's set (Supabase, the schema is fine).
- Auth providers — already wired (email/password + Google + Apple).
- Tech stack — React Native with Expo Router, Reanimated, react-native-calendars.

But if any of those choices materially limit what you can design for, flag it and we'll talk.

---

Thanks. Take as much room as you need. I'd rather get one polished, opinionated direction than three half-baked ones.

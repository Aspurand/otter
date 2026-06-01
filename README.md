# otter

A private, two-person long-distance relationship PWA. One couple per "space" — no feed, no friends list, no discovery.

Stack: **Vite + React 19 + Supabase + vite-plugin-pwa**, hosted on GitHub Pages.

The folder on disk is still called `Twosome/` — the public name, manifest, and base path are `otter`. Renaming the folder is a separate step (see [Renaming the folder](#renaming-the-folder)).

## Status

All seven features from the original spec are in:

- [x] **PWA scaffold** (Vite + React 19, service worker via `vite-plugin-pwa`, base path `/otter/`, installable, offline shell)
- [x] **Cute otter PWA icon** at 192/512/180 px, generated from [`public/otter.svg`](public/otter.svg)
- [x] **Auth + couple pairing** (magic-link email + Google OAuth, 6-char invite code, 2-person cap enforced at RPC + trigger level)
- [x] **Time-zone presence bar** (both partners' local times, status dots, Realtime Presence sync, reachout-hint based on partner's local hour + status)
- [x] **Reunion countdown** (live `d/h/m` ticking to the next event flagged `is_reunion`, inline "set next reunion" form)
- [x] **Nudges** ("thinking of you" instant tap → realtime toast + browser notification on partner's device)
- [x] **Scheduled love notes** (compose body, optional future delivery time; pg_cron job flips `delivered` once `deliver_at` passes; receiver's UPDATE subscription surfaces the toast)
- [x] **Love-language prompt** (daily suggestion on Home tailored to the partner's love language; rotates through static prompts per `kind`)
- [x] **Chat** (text, realtime via `postgres_changes`, infinite-scroll-up pagination, typing indicator via broadcast channel, read receipts when partner opens the thread, mobile composer with sticky bottom). Media (image/voice in chat) is deferred — voice/photo memories are already in the Memories album.
- [x] **Calendar** (list view of upcoming events, day-grouped, types: date/call/visit/anniversary, inline add/edit/delete, reunion pill)
- [x] **Memories album / timeline** (note/photo/voice memories with caption + happened_at, month-grouped, uploads go to the private `memories` bucket, signed URLs minted on read)
- [x] **Watch-together** (HTML5 video URL with realtime sync of play/pause/position via `watch_sessions` table; 2-second drift tolerance; either side can drive; end session clears for both)
- [x] **Games hub**: **Daily Question** (both answer one prompt a day, reveal when both submit) and **Would-You-Rather** (card deck of either-or; both pick A or B, reveal + matched/opposites indicator)
- [x] **Settings sheet** (display name, timezone, love language)

## Setup

```powershell
# from c:\Github Aspurand\Twosome
npm install
# .env.local is already filled with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Dev server: `http://localhost:5173/otter/`.

## Supabase configuration you still need to do in the dashboard

1. **Auth → URL Configuration → Site URL**: `http://localhost:5173/otter/` for dev. Add your GitHub Pages URL when you deploy.
2. **Auth → URL Configuration → Redirect URLs**: add `http://localhost:5173/otter/` and `https://<your-github-username>.github.io/otter/`.
3. **Auth → Providers → Google**: enable and paste OAuth credentials from Google Cloud Console. Authorized redirect URI on the Google side: `https://rgqrbfgwhzoxavmheckj.supabase.co/auth/v1/callback`.
4. **Auth → Email**: magic-link is on by default — confirm it's enabled.
5. **Database → Cron**: the `deliver-nudges` job (every minute) should already be visible — added by migration 0006.

## Migrations

```
supabase/migrations/
  20260601000001_schema.sql                 -- tables + indexes
  20260601000002_functions.sql              -- onboarding RPCs, current_couple_id, 2-person cap trigger, auth.users → profile trigger
  20260601000003_rls.sql                    -- row-level security on every table
  20260601000004_storage_and_realtime.sql   -- chat-media / memories / avatars buckets + realtime publication
  20260601000005_realtime_nudges.sql        -- add nudges to realtime publication
  20260601000006_scheduled_nudges_cron.sql  -- pg_cron job to deliver scheduled love notes
  20260601000007_game_state_helpers.sql     -- atomic jsonb-key writer for safe concurrent game-state writes
```

Re-apply with `supabase db push --linked` from the project root.

## Architecture notes

### Pairing model

- The top-level tenant is **`couples`**. Every feature table carries `couple_id`.
- A user gets a `profiles` row auto-created on signup via a trigger on `auth.users`.
- Onboarding RPCs (`create_couple()`, `join_couple(p_code)`) are `security definer` and enforce auth, one-couple-per-user, and the 2-person cap.
- Defense-in-depth: a `enforce_couple_cap` trigger on `profiles` blocks a 3rd member even if the RPC is bypassed.

### Row-level security

Every public table has RLS on. The standard rule for couple-scoped tables is `couple_id = public.current_couple_id()`. `current_couple_id()` is `stable security definer` so policies on `profiles` don't recurse.

### Realtime

- **Presence channel** (`couple-presence:<id>`) — broadcasts each user's `{ id, status, at }`; partner card mirrors live status without a DB roundtrip.
- **postgres_changes** subscriptions cover: messages (chat realtime + read receipts), nudges (instant + scheduled delivery), watch_sessions (play/pause/seek sync), game_sessions (Daily Question answers, WYR picks).
- **Broadcast channel** (`chat-typing:<id>`) — the typing indicator.

### Storage

Three private buckets: `chat-media`, `memories`, `avatars`. Convention: files live at `<couple_id>/<filename>`. Storage policies check `(storage.foldername(name))[1] = current_couple_id()::text`. Reads use signed URLs (4 hour TTL for memories).

### Data layer — the SDK deadlock workaround

`supabase-js` v2 has previously deadlocked on plain CRUD calls. To keep that swappable, **all data calls go through [`src/lib/db.js`](src/lib/db.js)** (`db.select / db.insert / db.update / db.remove / db.rpc`). Auth, Realtime, and Storage still go through the SDK directly.

Flip transports by setting `VITE_DB_USE_FETCH=1` in `.env.local` — `db.js` will issue raw `fetch()` calls against PostgREST instead. Same API surface, no app-code changes needed.

### Logo

[`public/otter.svg`](public/otter.svg) is the editable source. `npm run icons` re-renders `pwa-192.png`, `pwa-512.png`, `apple-touch-icon.png`, and `favicon-32.png` via `sharp`.

## File layout

```
supabase/migrations/                # SQL migrations, numbered + dated
scripts/build-icons.mjs             # otter.svg → PWA PNGs
src/
  components/
    Brand.jsx                       # logo + wordmark header
    PresenceBar.jsx                 # local times, status dots, status picker
    ReunionCountdown.jsx            # live d/h/m countdown + inline reunion form
    NudgeButton.jsx                 # tap nudge + scheduled love-note receiver
    LoveNoteSheet.jsx               # compose love note (now or scheduled)
    LoveLanguagePrompt.jsx          # daily suggestion based on partner's love language
    SettingsSheet.jsx               # display name, timezone, love language
    DailyQuestion.jsx               # game: both answer one prompt a day
    WouldYouRather.jsx              # game: card-deck either-or
  lib/
    env.js                          # env reader
    supabase.js                     # SDK client (auth + realtime)
    db.js                           # CRUD wrapper (SDK ↔ raw-fetch swappable)
    auth.js                         # sign-in / sign-out helpers
    couples.js                      # pairing RPCs + profile fetches
    profile.js                      # updateMyProfile + detectTimezone
    timezone.js                     # formatters + relativeAgo
    nudges.js                       # sendNudge (immediate + scheduled)
    events.js                       # calendar CRUD + next-reunion lookup
    chat.js                         # fetchMessages / sendMessage / markRead
    memories.js                     # fetch / upload / signed URLs / delete
    watch.js                        # current session / start / sync / end
    games.js                        # session helpers + atomic state setter + prompt lists
  pages/
    SignIn.jsx
    Onboarding.jsx
    Home.jsx                        # presence + countdown + LL prompt + nudges + nav
    Chat.jsx
    Calendar.jsx
    Memories.jsx
    Watch.jsx
    Games.jsx                       # hub → DailyQuestion / WouldYouRather
  App.jsx                           # phase machine (auth) + route state (in-app navigation)
  App.css
  main.jsx
  index.css
public/otter.svg                    # logo source (also favicon)
public/pwa-192.png pwa-512.png apple-touch-icon.png favicon-32.png  # generated
vite.config.js                      # PWA plugin, base=/otter/
.env.example
.env.local                          # gitignored via *.local
```

## Renaming the folder

Currently `c:\Github Aspurand\Twosome\`. If you want the on-disk name to match:

1. Stop the dev server.
2. Move the folder to `c:\Github Aspurand\Otter\`.
3. The supabase CLI link survives the move (it's tracked in `supabase/.temp/project-ref`, which is just metadata).
4. When you create the GitHub repo, name it `otter` (or whatever) — and either leave `vite.config.js` as `base=/otter/`, or override at build time via `VITE_BASE=/your-repo-name/ npm run build`.

## Deploying to GitHub Pages

1. Create a repo whose name matches the base path (default `/otter/`). Push.
2. Build: `npm run build` → `dist/`.
3. Publish `dist/` to the `gh-pages` branch (use the `gh-pages` package, or a GitHub Actions workflow).
4. Set the GitHub Pages source to that branch.

If your repo name differs from `otter`, set `VITE_BASE=/Other-Name/` before `npm run build`.

## Privacy posture

- Every row is RLS-gated by `couple_id` — no client query can ever return another couple's data.
- Media buckets are private; reads go through signed URLs.
- Transport is TLS; data at rest is Supabase-encrypted.
- **No client-side end-to-end encryption** yet. If you want true E2E (so Supabase staff can't read message bodies / notes), that's an explicit follow-up: per-couple keypair stored on each client, body fields encrypted before insert, decrypted in the React tree only.

## Web Push notifications

OS-level notifications (the kind that wake your phone when the app is closed). All free — uses VAPID against Apple/Google/Mozilla's free push services. Server is a Supabase Edge Function; trigger is a Postgres trigger on `nudges`.

**One-time setup:**

1. Generate VAPID keys:
   ```powershell
   node scripts/gen-vapid.mjs
   ```
   Copy the `VITE_VAPID_PUBLIC_KEY` into `.env.local`. The private key + public key + a generated `PUSH_SHARED_SECRET` should already be set as Supabase secrets (you can re-set them with `supabase secrets set ...`).

2. Migration 0009 created the `push_subscriptions` table + the `notify_partner_on_nudge` trigger. Migration 0010 hardcoded the function URL + shared secret into the trigger function (we can't use database GUCs from the API).

3. The edge function is deployed: `supabase functions deploy send-push --project-ref rgqrbfgwhzoxavmheckj --no-verify-jwt`.

**Per-user setup:**

- Open Settings → tick "push notifications". Browser asks permission, the device subscribes via the Push API, and the subscription row is saved.
- On iPhone: this *only works after installing the PWA to the home screen* (Safari → Share → Add to Home Screen, then open the home-screen icon and try again). iOS doesn't expose push to regular Safari tabs.

**How it fires:**

When any `nudges` row becomes deliverable (INSERT with `delivered=true`, or UPDATE flipping `delivered` from false → true via the `pg_cron` scheduled-delivery job), the trigger posts to the edge function. The function looks up every device subscription for the recipient and sends a Web Push to each. The service worker (`src/sw.js`) receives the push and calls `showNotification`. Tapping it focuses the open tab or opens the app.

**Persistent unread cards:**

Web Push is the "tap on the shoulder" — but if it gets missed (silenced, do-not-disturb, app uninstalled), the nudge is still in the DB with `read_at IS NULL`. The Home screen surfaces it as a **persistent card** above the presence bar. The card stays until tapped. (Migration 0009 added `nudges.read_at`.)

## Roadmap follow-ups (not in v1)

- YouTube embed in watch-together (currently direct video URLs only).
- Voice-note recording in chat (`MediaRecorder`; uploads to memories already work via file picker).
- E2E encryption for message + love-note bodies.
- More games — Truth or Dare, etc.

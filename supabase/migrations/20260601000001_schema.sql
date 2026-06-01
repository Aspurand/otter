-- Twosome: core schema.
-- Every couple-scoped table carries couple_id; RLS policies live in 0003.

create extension if not exists "pgcrypto";

-- Couples (tenant). Exactly two profiles allowed; enforced by trigger in 0002.
create table couples (
  id          uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at  timestamptz not null default now()
);

-- Profiles. 1:1 with auth.users. couple_id is set during pairing.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  couple_id     uuid references couples(id) on delete set null,
  display_name  text,
  avatar_url    text,
  timezone      text not null default 'UTC',
  love_language text check (love_language in ('words','acts','gifts','time','touch')),
  status        text not null default 'free' check (status in ('free','busy','asleep','away')),
  last_active   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index profiles_couple_idx on profiles(couple_id);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references couples(id) on delete cascade,
  sender_id  uuid not null references profiles(id),
  kind       text not null default 'text' check (kind in ('text','image','voice')),
  body       text,
  media_url  text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index messages_couple_created_idx on messages(couple_id, created_at desc);

create table events (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couples(id) on delete cascade,
  created_by  uuid not null references profiles(id),
  title       text not null,
  description text,
  type        text not null default 'date' check (type in ('date','call','visit','anniversary')),
  is_reunion  boolean not null default false,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  reminder_at timestamptz,
  created_at  timestamptz not null default now()
);
create index events_couple_start_idx on events(couple_id, starts_at);

create table memories (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couples(id) on delete cascade,
  created_by  uuid not null references profiles(id),
  kind        text not null default 'photo' check (kind in ('photo','voice','note')),
  media_url   text,
  caption     text,
  happened_at timestamptz,
  created_at  timestamptz not null default now()
);
create index memories_couple_happened_idx on memories(couple_id, coalesce(happened_at, created_at) desc);

create table nudges (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references couples(id) on delete cascade,
  sender_id  uuid not null references profiles(id),
  kind       text not null default 'thinking_of_you' check (kind in ('thinking_of_you','love_note')),
  body       text,
  deliver_at timestamptz not null default now(),
  delivered  boolean not null default false,
  created_at timestamptz not null default now()
);
create index nudges_deliver_pending_idx on nudges(deliver_at) where delivered = false;
create index nudges_couple_idx on nudges(couple_id, created_at desc);

create table watch_sessions (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references couples(id) on delete cascade,
  host_id           uuid not null references profiles(id),
  content_url       text not null,
  is_playing        boolean not null default false,
  playback_position numeric not null default 0,
  updated_at        timestamptz not null default now()
);
create index watch_sessions_couple_idx on watch_sessions(couple_id, updated_at desc);

create table game_sessions (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references couples(id) on delete cascade,
  game_type    text not null check (game_type in ('daily_question','wyr','truth_dare')),
  state        jsonb not null default '{}'::jsonb,
  turn_user_id uuid references profiles(id),
  updated_at   timestamptz not null default now()
);
create index game_sessions_couple_idx on game_sessions(couple_id, updated_at desc);

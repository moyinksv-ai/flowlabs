create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.idea_type as enum (
  'hook','concept','phrase','melody','unfinished_line','theme','reference','snippet','voice_note','discarded_version','other'
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  artist_name text not null default '',
  artist_id uuid references public.artists(id) on delete set null,
  title text not null,
  bpm integer check (bpm between 1 and 400),
  musical_key text not null default '',
  mood text not null default '',
  notes text not null default '',
  current_version_id uuid,
  sections jsonb not null default '["verse","chorus"]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.song_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  parent_version_id uuid references public.song_versions(id) on delete set null,
  version_number integer not null check (version_number > 0),
  title text not null default '',
  body text not null default '',
  section_map jsonb not null default '{}'::jsonb,
  change_note text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique(song_id, version_number)
);

alter table public.songs drop constraint if exists songs_current_version_fk;
alter table public.songs add constraint songs_current_version_fk foreign key (current_version_id) references public.song_versions(id) on delete set null;

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid references public.songs(id) on delete set null,
  type public.idea_type not null,
  title text not null,
  content text not null default '',
  notes text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idea_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_idea_id uuid references public.ideas(id) on delete cascade,
  to_idea_id uuid references public.ideas(id) on delete cascade,
  song_id uuid references public.songs(id) on delete cascade,
  relation text not null default 'related',
  created_at timestamptz not null default now(),
  check ((from_idea_id is not null and to_idea_id is not null) or (from_idea_id is not null and song_id is not null) or (to_idea_id is not null and song_id is not null))
);

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idea_id uuid references public.ideas(id) on delete cascade,
  song_id uuid references public.songs(id) on delete cascade,
  kind text not null check (kind in ('melody','voice_note','beat','reference_audio')),
  storage_path text not null,
  duration_ms integer,
  mime_type text not null default 'audio/webm',
  created_at timestamptz not null default now()
);

create index if not exists ideas_owner_updated_idx on public.ideas(owner_id, updated_at desc);
create index if not exists ideas_owner_type_idx on public.ideas(owner_id, type);
create index if not exists songs_owner_updated_idx on public.songs(owner_id, updated_at desc);
create index if not exists versions_song_number_idx on public.song_versions(song_id, version_number desc);
create index if not exists links_owner_idx on public.idea_links(owner_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.songs enable row level security;
alter table public.song_versions enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_links enable row level security;
alter table public.audio_assets enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists artists_owner on public.artists;
create policy artists_owner on public.artists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists songs_owner on public.songs;
create policy songs_owner on public.songs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists versions_owner on public.song_versions;
create policy versions_owner on public.song_versions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists ideas_owner on public.ideas;
create policy ideas_owner on public.ideas for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists links_owner on public.idea_links;
create policy links_owner on public.idea_links for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists assets_owner on public.audio_assets;
create policy assets_owner on public.audio_assets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists artists_touch on public.artists;
create trigger artists_touch before update on public.artists for each row execute function public.touch_updated_at();
drop trigger if exists songs_touch on public.songs;
create trigger songs_touch before update on public.songs for each row execute function public.touch_updated_at();
drop trigger if exists ideas_touch on public.ideas;
create trigger ideas_touch before update on public.ideas for each row execute function public.touch_updated_at();


insert into storage.buckets (id, name, public) values ('flowlab-audio', 'flowlab-audio', false) on conflict (id) do nothing;

drop policy if exists flowlab_audio_select on storage.objects;
create policy flowlab_audio_select on storage.objects for select to authenticated
using (bucket_id = 'flowlab-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists flowlab_audio_insert on storage.objects;
create policy flowlab_audio_insert on storage.objects for insert to authenticated
with check (bucket_id = 'flowlab-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists flowlab_audio_delete on storage.objects;
create policy flowlab_audio_delete on storage.objects for delete to authenticated
using (bucket_id = 'flowlab-audio' and (storage.foldername(name))[1] = auth.uid()::text);

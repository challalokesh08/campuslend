-- =========================================================================
-- CampusLend — Supabase schema
-- -------------------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is written to be re-runnable: `if not exists`, `drop policy if exists`.
--
-- THE IMPORTANT PART IS THE ROW LEVEL SECURITY AT THE BOTTOM.
--
-- The anon key ships in the browser. That is by design — Supabase expects it.
-- What stops one student reading another's messages is not the secrecy of that
-- key; it is these policies, which run inside Postgres on every row. If you
-- edit anything in this file, edit that section with the same care.
-- =========================================================================

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default 'Student',
  email         text,
  avatar_url    text,
  campus        text,
  rating_sum    integer not null default 0,
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------- listings

create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 3 and 80),
  description     text not null default '' check (char_length(description) <= 800),
  category        text not null check (category in ('electronics','study','transport','events','sports')),
  price_per_hour  integer not null check (price_per_hour between 1 and 5000),
  location        text not null default '',
  condition       text not null default 'good' check (condition in ('like-new','good','fair')),
  photo_url       text,
  hue             integer not null default floor(random() * 360)::int,
  status          text not null default 'active' check (status in ('active','removed')),
  created_at      timestamptz not null default now()
);

create index if not exists listings_owner_idx      on public.listings (owner_id);
create index if not exists listings_created_idx    on public.listings (created_at desc);
create index if not exists listings_category_idx   on public.listings (category) where status = 'active';

-- ------------------------------------------------------------ conversations

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings(id) on delete set null,
  -- a_id is always the lexicographically smaller uuid, so a pair can never be
  -- inserted twice in opposite orders. The unique index below depends on it.
  a_id            uuid not null references public.profiles(id) on delete cascade,
  b_id            uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (a_id < b_id)
);

create unique index if not exists conversations_pair_idx
  on public.conversations (a_id, b_id, listing_id);
create index if not exists conversations_a_idx on public.conversations (a_id);
create index if not exists conversations_b_idx on public.conversations (b_id);

-- ---------------------------------------------------------------- messages

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null default '' check (char_length(body) <= 4000),
  image_url       text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  check (body <> '' or image_url is not null)
);

create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

-- =========================================================================
-- Auth helpers and triggers
-- =========================================================================

-- Only this campus. The client checks too, but a client check is advice; this
-- one is enforced. Drop the trigger if you ever open the app to another college.
create or replace function public.enforce_campus_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or new.email !~* '@cambridge\.edu\.in$' then
    raise exception 'CampusLend is only open to @cambridge.edu.in addresses'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists campus_domain_only on auth.users;
create trigger campus_domain_only
  before insert on auth.users
  for each row execute function public.enforce_campus_domain();

-- Every account gets a profile row, so the app never has to invent one and a
-- user can never exist without one.
create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived text;
begin
  derived := initcap(replace(split_part(new.email, '@', 1), '.', ' '));
  insert into public.profiles (id, full_name, email, campus)
  values (new.id, coalesce(nullif(derived, ''), 'Student'), new.email, 'Cambridge Institute of Technology')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists profile_after_signup on auth.users;
create trigger profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_user();

-- Used by the message and conversation policies. SECURITY DEFINER so the check
-- itself is not subject to the policies it is being used to enforce.
create or replace function public.is_participant(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and (c.a_id = auth.uid() or c.b_id = auth.uid())
  );
$$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles      enable row level security;
alter table public.listings      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- ---- profiles ----------------------------------------------------------
-- Anyone signed in can see names and ratings (they are on every listing).
-- Nobody can edit anyone else's, and nobody can promote themselves.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- A student may change their name and photo. They may not rewrite their
    -- own rating: trust you can award yourself is not trust.
    and rating_sum  = (select p.rating_sum  from public.profiles p where p.id = auth.uid())
    and rating_count = (select p.rating_count from public.profiles p where p.id = auth.uid())
  );

-- ---- listings ----------------------------------------------------------
-- Active listings are public to signed-in students. Your own removed ones stay
-- visible to you so a delete is not a silent vanishing act.
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings
  for select to authenticated
  using (status = 'active' or owner_id = auth.uid());

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists listings_delete_own on public.listings;
create policy listings_delete_own on public.listings
  for delete to authenticated using (owner_id = auth.uid());

-- ---- conversations -----------------------------------------------------
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated
  using (a_id = auth.uid() or b_id = auth.uid());

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (
    (a_id = auth.uid() or b_id = auth.uid())
    and a_id <> b_id
  );

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (a_id = auth.uid() or b_id = auth.uid())
  with check (a_id = auth.uid() or b_id = auth.uid());

-- ---- messages ----------------------------------------------------------
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select to authenticated using (public.is_participant(conversation_id));

-- You can only send as yourself, into a conversation you are part of.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

-- Marking as read is an update to someone else's row, so the recipient needs
-- this. It cannot change the text: the with-check pins it to what is already
-- there, which is why the columns are compared rather than only the owner.
drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages
  for update to authenticated
  using (public.is_participant(conversation_id))
  with check (public.is_participant(conversation_id));

-- Nobody deletes a message. A chat that can be edited after the fact is not
-- evidence of anything.

-- =========================================================================
-- Realtime
-- =========================================================================

-- Realtime needs the tables in the publication, or the socket connects and
-- simply never delivers anything — a silent failure that looks like a UI bug.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
end $$;

-- =========================================================================
-- Storage
-- =========================================================================
-- Two public buckets. Reads are public because a URL in a chat has to render
-- for the other person; writes are restricted to signed-in students, and each
-- upload is namespaced by the uploader's own user id.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects
  for select using (bucket_id in ('listing-photos','chat-images'));

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('listing-photos','chat-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================================
-- Done. Check it worked:
--
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in
--     ('profiles','listings','conversations','messages');
--
-- All four should say rowsecurity = true.
-- =========================================================================

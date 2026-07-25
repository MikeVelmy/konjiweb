-- Konji v1 schema.
--
-- Two product rules are load-bearing enough that they are enforced here rather
-- than in the app: a chat thread cannot exist until the receiving user accepts,
-- and a face photo cannot be read until BOTH users have accepted a reveal. Both
-- are expressed as row-level security policies, so a compromised or modified
-- client still cannot reach the data.

create extension if not exists "pgcrypto";

create type gender as enum ('male', 'female');
create type pairing_status as enum ('pending', 'accepted', 'declined', 'ended');
create type report_reason as enum (
  'harassment', 'sexual_content', 'spam_or_scam', 'underage', 'impersonation', 'other'
);
create type report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

-- ---------------------------------------------------------------------------
-- Country rules
-- ---------------------------------------------------------------------------

-- Drives the matching-mode gate. `same_gender_matching` is a legal/policy input
-- and must be reviewed by counsel per jurisdiction before a row is flipped.
create table country_rules (
  code text primary key,
  name text not null,
  same_gender_matching boolean not null default false,
  launched boolean not null default false
);

insert into country_rules (code, name, same_gender_matching, launched) values
  ('GH', 'Ghana', false, true),
  ('NG', 'Nigeria', false, false),
  ('KE', 'Kenya', false, false),
  ('ZA', 'South Africa', true, false),
  ('GB', 'United Kingdom', true, false),
  ('CA', 'Canada', true, false),
  ('US', 'United States', true, false);

alter table country_rules enable row level security;

create policy "country rules are public"
  on country_rules for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  country text not null references country_rules (code),
  gender gender not null,
  gender_preference gender not null,
  display_name text not null,
  is_custom_name boolean not null default false,
  -- { skin, color, outfit, outfitColor, hairColor } — the only visual identity
  -- a user has before a reveal.
  avatar jsonb not null,
  gps_opt_in boolean not null default false,
  has_photo boolean not null default false,
  age_attested_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index profiles_matching_idx on profiles (country, gender, gender_preference);

-- The country gate, applied on every write so it cannot be bypassed by editing
-- a profile after onboarding.
create function enforce_country_rules() returns trigger
language plpgsql as $$
declare
  rules country_rules;
begin
  select * into rules from country_rules where code = new.country;
  if rules is null then
    raise exception 'Unknown country %', new.country;
  end if;
  if not rules.launched then
    raise exception 'Konji is not available in % yet', rules.name;
  end if;
  if new.gender = new.gender_preference and not rules.same_gender_matching then
    raise exception 'Same-gender matching is not offered in %', rules.name;
  end if;
  return new;
end $$;

create trigger profiles_country_rules
  before insert or update on profiles
  for each row execute function enforce_country_rules();

alter table profiles enable row level security;

-- A profile is readable by its owner, and by anyone it already has a pairing
-- with (that second policy lives further down, once `pairings` exists). The
-- candidate draw does not rely on either — it runs as a security definer
-- function — so the whole user pool is never broadly readable.
create policy "read own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "insert own profile"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Face photos
-- ---------------------------------------------------------------------------

-- Kept out of `profiles` on purpose: it is the one column whose read rule is
-- "only after mutual consent", and isolating it makes that rule auditable.
create table profile_photos (
  user_id uuid primary key references profiles (id) on delete cascade,
  storage_path text not null,
  updated_at timestamptz not null default now()
);

alter table profile_photos enable row level security;

create policy "read own photo"
  on profile_photos for select
  to authenticated
  using (user_id = auth.uid());

-- The mutual-reveal read policy — the core privacy guarantee of the product —
-- is declared below, once `pairings` and `reveal_requests` exist.

create policy "write own photo"
  on profile_photos for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Pairings
-- ---------------------------------------------------------------------------

-- Convention relied on by every policy below: user_a is always the initiator
-- and user_b is always the person who must accept.
create table pairings (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles (id) on delete cascade,
  user_b uuid not null references profiles (id) on delete cascade,
  status pairing_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_pairing check (user_a <> user_b)
);

-- At most one live pairing between any two people, in either direction.
create unique index pairings_unique_live on pairings (
  least(user_a, user_b), greatest(user_a, user_b)
) where status in ('pending', 'accepted');

create index pairings_user_a_idx on pairings (user_a, status);
create index pairings_user_b_idx on pairings (user_b, status);

alter table pairings enable row level security;

create policy "read own pairings"
  on pairings for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

create policy "initiate a pairing as yourself"
  on pairings for insert
  to authenticated
  with check (user_a = auth.uid() and status = 'pending');

-- Only the receiving user can move a request out of pending. This is the
-- mutual-consent rule: the initiator cannot self-accept into someone's inbox.
create policy "receiver responds to a request"
  on pairings for update
  to authenticated
  using (user_b = auth.uid() and status = 'pending')
  with check (status in ('accepted', 'declined'));

-- Either party can end an accepted pairing at any time.
create policy "either party can end a pairing"
  on pairings for update
  to authenticated
  using ((user_a = auth.uid() or user_b = auth.uid()) and status = 'accepted')
  with check (status = 'ended');

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create table messages (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references pairings (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  sent_at timestamptz not null default now()
);

create index messages_pairing_idx on messages (pairing_id, sent_at);

alter table messages enable row level security;

-- Note the `status = 'accepted'` clause in both policies: a thread is not
-- readable or writable while the pairing is still pending. The chat literally
-- does not exist until the receiver says yes.
create policy "read messages in an accepted pairing"
  on messages for select
  to authenticated
  using (
    exists (
      select 1 from pairings p
      where p.id = messages.pairing_id
        and p.status = 'accepted'
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

create policy "send messages in an accepted pairing"
  on messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from pairings p
      where p.id = messages.pairing_id
        and p.status = 'accepted'
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

create table read_receipts (
  pairing_id uuid not null references pairings (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (pairing_id, user_id)
);

alter table read_receipts enable row level security;

create policy "manage own read receipts"
  on read_receipts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Face reveal
-- ---------------------------------------------------------------------------

-- Acceptance is stored per side so that neither participant can ever write the
-- other's consent. Writes go exclusively through respond_to_reveal() below.
create table reveal_requests (
  pairing_id uuid primary key references pairings (id) on delete cascade,
  requested_by uuid not null references profiles (id) on delete cascade,
  user_a_accepted boolean not null default false,
  user_b_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table reveal_requests enable row level security;

create policy "read reveal state for own pairings"
  on reveal_requests for select
  to authenticated
  using (
    exists (
      select 1 from pairings p
      where p.id = reveal_requests.pairing_id
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Deferred policies
--
-- These two depend on `pairings` and `reveal_requests`, so they are declared
-- here rather than alongside the tables they protect.
-- ---------------------------------------------------------------------------

create policy "read profiles you are paired with"
  on profiles for select
  to authenticated
  using (
    exists (
      select 1 from pairings p
      where p.status <> 'declined'
        and ((p.user_a = auth.uid() and p.user_b = profiles.id)
          or (p.user_b = auth.uid() and p.user_a = profiles.id))
    )
  );

-- The core privacy guarantee of the product: a face is unreadable until both
-- sides have said yes, enforced in the database rather than in the UI.
create policy "read a partner photo only after a mutual reveal"
  on profile_photos for select
  to authenticated
  using (
    exists (
      select 1
      from pairings p
      join reveal_requests r on r.pairing_id = p.id
      where p.status = 'accepted'
        and r.user_a_accepted
        and r.user_b_accepted
        and ((p.user_a = auth.uid() and p.user_b = profile_photos.user_id)
          or (p.user_b = auth.uid() and p.user_a = profile_photos.user_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Blocks, passes, reports
-- ---------------------------------------------------------------------------

create table blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table blocks enable row level security;

create policy "manage own blocks"
  on blocks for all
  to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- A "pass" is short-lived on purpose: with a small user base a permanent pass
-- list drains the matching pool to nothing within a session.
create table passes (
  user_id uuid not null references profiles (id) on delete cascade,
  candidate_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, candidate_id)
);

alter table passes enable row level security;

create policy "manage own passes"
  on passes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  reported_user_id uuid not null references profiles (id) on delete cascade,
  pairing_id uuid references pairings (id) on delete set null,
  reason report_reason not null,
  detail text,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

create index reports_status_idx on reports (status, created_at);

alter table reports enable row level security;

-- Reporters can file and see their own reports but never read anyone else's,
-- and cannot see moderation outcomes for other users.
create policy "file a report"
  on reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "read own reports"
  on reports for select
  to authenticated
  using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- The lucky draw. Runs as security definer because it must read across the user
-- pool, which no ordinary client is allowed to do. It returns exactly one row,
-- or none when the pool is genuinely empty.
create function draw_candidate()
returns table (
  id uuid,
  display_name text,
  is_custom_name boolean,
  avatar jsonb,
  gender gender,
  country text,
  has_photo boolean,
  is_online boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles;
begin
  select * into me from profiles where profiles.id = auth.uid();
  if me is null then
    raise exception 'Profile not found';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.is_custom_name,
    p.avatar,
    p.gender,
    p.country,
    p.has_photo,
    (p.last_seen_at > now() - interval '5 minutes') as is_online
  from profiles p
  where p.id <> me.id
    -- Deliberately broad: gender and stated preference only. No age or distance
    -- filter at launch, because a small pool plus narrow filters means dead ends.
    and p.gender = me.gender_preference
    and p.gender_preference = me.gender
    and p.country = me.country
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = me.id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = me.id)
    )
    and not exists (
      select 1 from pairings pr
      where pr.status in ('pending', 'accepted')
        and ((pr.user_a = me.id and pr.user_b = p.id)
          or (pr.user_b = me.id and pr.user_a = p.id))
    )
    and not exists (
      select 1 from passes ps
      where ps.user_id = me.id
        and ps.candidate_id = p.id
        and ps.created_at > now() - interval '1 hour'
    )
  order by random()
  limit 1;
end $$;

revoke execute on function draw_candidate() from public;
grant execute on function draw_candidate() to authenticated;

-- Requesting a reveal counts as your own yes and nothing more. Writing the
-- other side's acceptance is impossible through this function, which is why
-- reveal_requests has no client-facing insert or update policy at all.
create function respond_to_reveal(target_pairing uuid, accept boolean)
returns reveal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  p pairings;
  result reveal_requests;
  is_user_a boolean;
begin
  select * into p from pairings where pairings.id = target_pairing;
  if p is null or p.status <> 'accepted' then
    raise exception 'No open pairing';
  end if;
  if auth.uid() not in (p.user_a, p.user_b) then
    raise exception 'Not a participant';
  end if;
  is_user_a := (p.user_a = auth.uid());

  if not accept then
    -- Declining clears the whole request rather than leaving a half-answered
    -- prompt sitting in both people's chats.
    delete from reveal_requests where pairing_id = target_pairing;
    return null;
  end if;

  insert into reveal_requests (pairing_id, requested_by, user_a_accepted, user_b_accepted)
  values (target_pairing, auth.uid(), is_user_a, not is_user_a)
  on conflict (pairing_id) do update
    set user_a_accepted = reveal_requests.user_a_accepted or is_user_a,
        user_b_accepted = reveal_requests.user_b_accepted or not is_user_a
  returning * into result;

  return result;
end $$;

revoke execute on function respond_to_reveal(uuid, boolean) from public;
grant execute on function respond_to_reveal(uuid, boolean) to authenticated;

-- Blocking is a safety action, so it takes effect immediately and in both
-- directions: the pairing ends and neither person can redraw the other.
create function block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into blocks (blocker_id, blocked_id)
  values (auth.uid(), target)
  on conflict do nothing;

  update pairings
  set status = 'ended', responded_at = now()
  where status in ('pending', 'accepted')
    and ((user_a = auth.uid() and user_b = target)
      or (user_b = auth.uid() and user_a = target));
end $$;

revoke execute on function block_user(uuid) from public;
grant execute on function block_user(uuid) to authenticated;

create function touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function touch_last_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
--
-- Face photos live in a private bucket keyed by user id (faces/<uid>/face.jpg).
-- The object policies mirror profile_photos exactly — the row and the file have
-- to agree, or the reveal rule would hold in one place and leak in the other.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('faces', 'faces', false)
on conflict (id) do nothing;

create policy "read own face file"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'faces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read a partner face file only after a mutual reveal"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'faces'
    and exists (
      select 1
      from pairings p
      join reveal_requests r on r.pairing_id = p.id
      where p.status = 'accepted'
        and r.user_a_accepted
        and r.user_b_accepted
        and (
          (p.user_a = auth.uid() and p.user_b::text = (storage.foldername(name))[1])
          or (p.user_b = auth.uid() and p.user_a::text = (storage.foldername(name))[1])
        )
    )
  );

create policy "write own face file"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'faces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace own face file"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'faces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table pairings;
alter publication supabase_realtime add table reveal_requests;

-- Rewards Chart — database setup
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Then run seed.sql to add Tommy, Louie and their jobs.

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

-- Who can use the app. Every login (each parent, and the kids' iPad) gets a row.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('parent', 'tablet')),
  display_name text,
  parent_unlocked_until timestamptz,   -- tablet only: parent mode open until this time
  pin_failed_attempts int not null default 0,
  pin_locked_until timestamptz
);

-- One row of family-wide settings.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  timezone text not null default 'Australia/Melbourne',
  leave_time time not null default '08:15',
  school_days int[] not null default '{1,2,3,4,5}',      -- 1 = Monday … 7 = Sunday
  countdown_minutes int not null default 45,             -- length of the countdown ring
  speed_bonus_minutes int not null default 15,           -- finish this early for the speed bonus
  speed_bonus_stars int not null default 20,
  stars_per_dollar int not null default 30,
  bonus_tech_minutes int not null default 10,            -- extra tech minutes this week per approved bonus job
  updated_at timestamptz not null default now()
);

-- The parent PIN lives in its own table with no read access, so the iPad can never see it.
create table if not exists public.parent_pin (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);

create table if not exists public.kids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  color text not null default '#2EE6D6',
  weekly_pocket_money numeric(6,2) not null default 8 check (weekly_pocket_money >= 0),
  weekly_tech_minutes int not null default 210 check (weekly_tech_minutes >= 0),  -- tech time per week (Mon–Sun)
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  kid_ids uuid[] not null default '{}' check (cardinality(kid_ids) >= 1),   -- who the job is for
  title text not null check (char_length(title) between 1 and 40),
  icon text not null default 'star',
  kind text not null check (kind in ('daily', 'bonus')),
  period text not null default 'morning' check (period in ('morning', 'evening')),
  assign_mode text not null default 'each' check (assign_mode in ('each', 'rotate_daily', 'rotate_weekly')),
  rotation_offset int not null default 0,                                  -- shifts whose turn it is
  stars int not null default 10 check (stars between 0 and 200),
  max_per_week int not null default 3 check (max_per_week between 1 and 14),
  days int[] not null default '{1,2,3,4,5,6,7}',          -- daily jobs: which days they show
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- A daily job ticked off on a given day.
create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  kid_id uuid not null references public.kids on delete cascade,
  day date not null,
  stars int not null default 0,
  created_at timestamptz not null default now(),
  unique (job_id, kid_id, day)
);

-- A bonus job logged by a kid (waits for a parent thumbs-up).
create table if not exists public.bonus_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  kid_id uuid not null references public.kids on delete cascade,
  day date not null,
  stars int not null default 0,
  tech_minutes int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Things parents give or take away. Positive = given, negative = taken away.
--   money: dollars off/on this week's pocket money
--   tech:  minutes off/on today's tech time
--   stars: stars off/on this week
create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids on delete cascade,
  kind text not null check (kind in ('money', 'tech', 'stars')),
  amount numeric(8,2) not null check (amount <> 0),
  reason text not null default '' check (char_length(reason) <= 80),
  day date not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- Pocket money paid out for a week (Monday start).
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids on delete cascade,
  week_start date not null,
  amount numeric(6,2) not null,
  paid_at timestamptz not null default now(),
  unique (kid_id, week_start)
);

create index if not exists completions_kid_day on public.completions (kid_id, day);
create index if not exists bonus_logs_kid_day on public.bonus_logs (kid_id, day);
create index if not exists adjustments_kid_day on public.adjustments (kid_id, day);

-- ─────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────

-- Anyone signed in with a profile (parents or the iPad).
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid());
$$;

-- Parents, or the iPad while parent mode is unlocked with the PIN.
create or replace function public.can_manage() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and (role = 'parent' or (role = 'tablet' and parent_unlocked_until > now()))
  );
$$;

create or replace function public.my_access() returns table (role text, parent_unlocked_until timestamptz)
language sql stable security definer set search_path = public as $$
  select p.role, p.parent_unlocked_until from public.profiles p where p.user_id = auth.uid();
$$;

-- Check the PIN on the iPad. Opens parent mode for 15 minutes.
-- After 5 wrong tries the PIN is locked for 5 minutes.
create or replace function public.unlock_parent_mode(pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  p public.profiles;
  h text;
begin
  select * into p from public.profiles where user_id = auth.uid();
  if not found then return 'not_member'; end if;
  if p.pin_locked_until is not null and p.pin_locked_until > now() then return 'locked'; end if;

  select pin_hash into h from public.parent_pin where id = 1;
  if h is null or crypt(pin, h) <> h then
    update public.profiles
      set pin_failed_attempts = pin_failed_attempts + 1,
          pin_locked_until = case when pin_failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
      where user_id = auth.uid();
    return 'wrong';
  end if;

  update public.profiles
    set parent_unlocked_until = now() + interval '15 minutes',
        pin_failed_attempts = 0,
        pin_locked_until = null
    where user_id = auth.uid();
  return 'ok';
end $$;

create or replace function public.lock_parent_mode() returns void
language sql security definer set search_path = public as $$
  update public.profiles set parent_unlocked_until = null where user_id = auth.uid();
$$;

-- Change the PIN (signed-in parents only, not the iPad).
create or replace function public.set_parent_pin(new_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'parent') then
    raise exception 'Only a parent login can change the PIN';
  end if;
  if new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;
  insert into public.parent_pin (id, pin_hash) values (1, crypt(new_pin, gen_salt('bf')))
    on conflict (id) do update set pin_hash = excluded.pin_hash;
end $$;

-- Completions: stars always come from the job, and the kid must be one the job is assigned to.
create or replace function public.completions_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  if not found or j.kind <> 'daily' then raise exception 'Not a daily job'; end if;
  if not (new.kid_id = any (j.kid_ids)) then raise exception 'That job is not assigned to this child'; end if;
  new.stars := j.stars;
  return new;
end $$;

drop trigger if exists completions_fill on public.completions;
create trigger completions_fill before insert on public.completions
  for each row execute function public.completions_fill();

-- Bonus logs: stars/minutes come from the job and settings, weekly limit is enforced,
-- and logs made by a parent are approved straight away.
create or replace function public.bonus_logs_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j public.jobs;
  used int;
  mins int;
begin
  select * into j from public.jobs where id = new.job_id;
  if not found or j.kind <> 'bonus' then raise exception 'Not a bonus job'; end if;
  if not (new.kid_id = any (j.kid_ids)) then raise exception 'That job is not assigned to this child'; end if;
  select count(*) into used from public.bonus_logs
    where job_id = j.id and kid_id = new.kid_id and status <> 'rejected'
      and day >= date_trunc('week', new.day)::date
      and day < date_trunc('week', new.day)::date + 7;
  if used >= j.max_per_week then raise exception 'Weekly limit reached for this job'; end if;
  select bonus_tech_minutes into mins from public.settings where id = 1;
  new.stars := j.stars;
  new.tech_minutes := coalesce(mins, 10);
  if public.can_manage() then
    new.status := 'approved';
    new.reviewed_at := now();
  else
    new.status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists bonus_logs_fill on public.bonus_logs;
create trigger bonus_logs_fill before insert on public.bonus_logs
  for each row execute function public.bonus_logs_fill();

create or replace function public.adjustments_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

drop trigger if exists adjustments_fill on public.adjustments;
create trigger adjustments_fill before insert on public.adjustments
  for each row execute function public.adjustments_fill();

-- ─────────────────────────────────────────────────────────────
-- Security rules (Row Level Security)
-- ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.parent_pin enable row level security;   -- no policies: nobody reads it directly
alter table public.kids enable row level security;
alter table public.jobs enable row level security;
alter table public.completions enable row level security;
alter table public.bonus_logs enable row level security;
alter table public.adjustments enable row level security;
alter table public.payouts enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (user_id = auth.uid());

-- Settings, kids, jobs, payouts: everyone in the family reads; parents change.
do $$
declare t text;
begin
  foreach t in array array['settings', 'kids', 'jobs', 'payouts', 'adjustments'] loop
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('create policy "members read" on public.%I for select using (public.is_member())', t);
    execute format('drop policy if exists "parents write" on public.%I', t);
    execute format('create policy "parents write" on public.%I for all using (public.can_manage()) with check (public.can_manage())', t);
  end loop;
end $$;

-- Daily jobs: the iPad can tick and untick today (and yesterday, for late ticks); parents can fix any day.
drop policy if exists "members read" on public.completions;
create policy "members read" on public.completions for select using (public.is_member());
drop policy if exists "members tick" on public.completions;
create policy "members tick" on public.completions for insert
  with check (public.is_member() and (public.can_manage() or day >= current_date - 1));
drop policy if exists "members untick" on public.completions;
create policy "members untick" on public.completions for delete
  using (public.is_member() and (public.can_manage() or day >= current_date - 1));

-- Bonus jobs: the iPad can log one and undo it while it's still waiting; parents approve or reject.
drop policy if exists "members read" on public.bonus_logs;
create policy "members read" on public.bonus_logs for select using (public.is_member());
drop policy if exists "members log" on public.bonus_logs;
create policy "members log" on public.bonus_logs for insert
  with check (public.is_member() and (public.can_manage() or day >= current_date - 1));
drop policy if exists "parents review" on public.bonus_logs;
create policy "parents review" on public.bonus_logs for update
  using (public.can_manage()) with check (public.can_manage());
drop policy if exists "undo pending" on public.bonus_logs;
create policy "undo pending" on public.bonus_logs for delete
  using (public.can_manage() or (public.is_member() and status = 'pending'));

-- Nobody signed out can call any of these; trigger helpers only ever run as triggers.
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.can_manage() from public, anon;
revoke execute on function public.my_access() from public, anon;
revoke execute on function public.unlock_parent_mode(text) from public, anon;
revoke execute on function public.lock_parent_mode() from public, anon;
revoke execute on function public.set_parent_pin(text) from public, anon;
revoke execute on function public.completions_fill() from public, anon, authenticated;
revoke execute on function public.bonus_logs_fill() from public, anon, authenticated;
revoke execute on function public.adjustments_fill() from public, anon, authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.can_manage() to authenticated;
grant execute on function public.my_access() to authenticated;
grant execute on function public.unlock_parent_mode(text) to authenticated;
grant execute on function public.lock_parent_mode() to authenticated;
grant execute on function public.set_parent_pin(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Live updates between the iPad and phones
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['settings', 'kids', 'jobs', 'completions', 'bonus_logs', 'adjustments', 'payouts'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Game-character pictures
-- ─────────────────────────────────────────────────────────────
alter table public.kids add column if not exists avatar_path text;

-- Private picture store: only signed-in family members can view; only the make-avatar function writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists "family can view avatars" on storage.objects;
create policy "family can view avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_member());

-- Older installs: tech time used to be daily; it is now a weekly allowance.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'kids' and column_name = 'daily_tech_minutes') then
    alter table public.kids rename column daily_tech_minutes to weekly_tech_minutes;
    update public.kids set weekly_tech_minutes = weekly_tech_minutes * 7;
  end if;
end $$;

-- Older installs: jobs used to belong to one child each; now they have a list of kids,
-- morning/evening, and can be shared or take turns.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'jobs' and column_name = 'kid_id') then
    alter table public.jobs add column if not exists kid_ids uuid[];
    alter table public.jobs add column if not exists period text not null default 'morning';
    alter table public.jobs add column if not exists assign_mode text not null default 'each';
    alter table public.jobs add column if not exists rotation_offset int not null default 0;
    update public.jobs set kid_ids = array[kid_id] where kid_ids is null;
    alter table public.jobs alter column kid_ids set not null;
    alter table public.jobs drop column kid_id;
    alter table public.completions drop constraint if exists completions_job_id_day_key;
    alter table public.completions add constraint completions_job_kid_day_key unique (job_id, kid_id, day);
  end if;
end $$;

-- "Tech time dead": a parent can ban tech time completely, for a set time or until lifted.
alter table public.kids add column if not exists tech_banned boolean not null default false;
alter table public.kids add column if not exists tech_ban_until timestamptz;      -- null = until a parent lifts it
alter table public.kids add column if not exists tech_ban_reason text not null default '';
alter table public.kids add column if not exists tech_ban_started_at timestamptz;

-- Pet jobs: shown in the dog's own box on the iPad instead of with the quests.
alter table public.jobs add column if not exists category text not null default 'quest';
do $$ begin
  alter table public.jobs add constraint jobs_category_check check (category in ('quest', 'pet'));
exception when duplicate_object then null; end $$;
alter table public.settings add column if not exists pet_name text not null default 'Bruno';

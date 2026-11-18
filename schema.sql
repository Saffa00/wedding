-- Wedding Invitation & QR Attendance — Supabase schema
-- Run in the Supabase SQL editor. Create the 3 staff users in Supabase Auth first,
-- then insert their profiles (see bottom).

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       text not null check (role in ('admin', 'usher')),
  created_at timestamptz not null default now()
);

create table public.wedding_settings (
  id          boolean primary key default true check (id),  -- single row
  bride_name  text not null,
  groom_name  text not null,
  event_date  timestamptz not null,
  venue       text not null,
  timezone    text not null default 'Africa/Freetown'
);

create table public.seating_tables (
  id       uuid primary key default gen_random_uuid(),
  number   int  not null unique check (number > 0),
  label    text,
  capacity int  not null check (capacity > 0)
);

create table public.guests (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  side       text not null check (side in ('bride', 'groom')),
  phone      text,
  email      text,
  table_id   uuid references public.seating_tables(id) on delete set null,
  created_at timestamptz not null default now()
);
create index guests_side_idx  on public.guests(side);
create index guests_table_idx on public.guests(table_id);

create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  guest_id   uuid not null unique references public.guests(id) on delete cascade,
  reference  text not null unique,                 -- human-readable, e.g. WED-7K3Q9X
  token_hash text not null unique,                 -- sha256 of the QR token; plaintext never stored
  status     text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade, -- unique = no duplicates
  guest_id      uuid not null references public.guests(id) on delete cascade,
  usher_id      uuid not null references public.profiles(id),
  checked_in_at timestamptz not null default now()
);
create index check_ins_time_idx on public.check_ins(checked_in_at desc);

-- ---------- business rules ----------

-- Exactly one admin and at most two ushers.
create or replace function public.enforce_staff_limits() returns trigger
language plpgsql as $$
begin
  if new.role = 'admin' and (
       select count(*) from public.profiles where role = 'admin' and id <> new.id) >= 1 then
    raise exception 'Only one administrator is allowed';
  end if;
  if new.role = 'usher' and (
       select count(*) from public.profiles where role = 'usher' and id <> new.id) >= 2 then
    raise exception 'Only two ushers are allowed';
  end if;
  return new;
end $$;

create trigger profiles_limits
  before insert or update of role on public.profiles
  for each row execute function public.enforce_staff_limits();

-- Table capacity validation (locks the table row to avoid races).
create or replace function public.enforce_table_capacity() returns trigger
language plpgsql as $$
declare cap int; seated int;
begin
  if new.table_id is null then return new; end if;
  select capacity into cap from public.seating_tables where id = new.table_id for update;
  select count(*) into seated from public.guests
    where table_id = new.table_id and id <> new.id;
  if seated >= cap then
    raise exception 'Table is full';
  end if;
  return new;
end $$;

create trigger guests_capacity
  before insert or update of table_id on public.guests
  for each row execute function public.enforce_table_capacity();

-- ---------- server-side verification & atomic check-in ----------
-- Called ONLY by the Express backend (service role). Not exposed to browsers.

create or replace function public.verify_invitation(p_token_hash text)
returns table (
  invitation_id uuid, reference text, status text,
  guest_name text, side text, table_number int,
  checked_in boolean, checked_in_at timestamptz
)
language sql security definer set search_path = public as $$
  select i.id, i.reference, i.status, g.full_name, g.side, t.number,
         c.id is not null, c.checked_in_at
  from invitations i
  join guests g on g.id = i.guest_id
  left join seating_tables t on t.id = g.table_id
  left join check_ins c on c.invitation_id = i.id
  where i.token_hash = p_token_hash;
$$;

create or replace function public.check_in_guest(p_token_hash text, p_usher_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv invitations; new_id uuid; existing timestamptz;
begin
  select * into inv from invitations where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  if inv.status = 'revoked' then return jsonb_build_object('result', 'revoked'); end if;

  insert into check_ins (invitation_id, guest_id, usher_id)
  values (inv.id, inv.guest_id, p_usher_id)
  on conflict (invitation_id) do nothing
  returning id into new_id;

  if new_id is null then
    select checked_in_at into existing from check_ins where invitation_id = inv.id;
    return jsonb_build_object('result', 'already_checked_in', 'checked_in_at', existing);
  end if;
  return jsonb_build_object('result', 'success');
end $$;

revoke all on function public.verify_invitation(text)        from public, anon, authenticated;
revoke all on function public.check_in_guest(text, uuid)     from public, anon, authenticated;
grant  execute on function public.verify_invitation(text)    to service_role;
grant  execute on function public.check_in_guest(text, uuid) to service_role;

-- ---------- Row Level Security ----------

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

alter table public.profiles         enable row level security;
alter table public.wedding_settings enable row level security;
alter table public.seating_tables   enable row level security;
alter table public.guests           enable row level security;
alter table public.invitations      enable row level security;
alter table public.check_ins        enable row level security;

-- profiles: everyone reads their own; admin reads/manages all
create policy "own profile"   on public.profiles for select using (id = auth.uid());
create policy "admin profiles" on public.profiles for all
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- settings: staff read, admin write
create policy "staff read settings" on public.wedding_settings for select
  using (current_role_name() in ('admin', 'usher'));
create policy "admin write settings" on public.wedding_settings for all
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- seating tables: staff read, admin write
create policy "staff read tables" on public.seating_tables for select
  using (current_role_name() in ('admin', 'usher'));
create policy "admin write tables" on public.seating_tables for all
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- guests: staff read (manual lookup), admin write
create policy "staff read guests" on public.guests for select
  using (current_role_name() in ('admin', 'usher'));
create policy "admin write guests" on public.guests for all
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- invitations: admin only (ushers verify through the backend, never read tokens)
create policy "admin invitations" on public.invitations for all
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- check-ins: staff read; NO insert/update/delete policies, so writes only happen via check_in_guest()
create policy "staff read check_ins" on public.check_ins for select
  using (current_role_name() in ('admin', 'usher'));

-- ---------- after creating the 3 Auth users ----------
-- insert into public.profiles (id, full_name, role) values
--   ('<admin-auth-uid>',  'Administrator', 'admin'),
--   ('<usher1-auth-uid>', 'Usher One',     'usher'),
--   ('<usher2-auth-uid>', 'Usher Two',     'usher');
--
-- insert into public.wedding_settings (bride_name, groom_name, event_date, venue)
-- values ('Bride', 'Groom', '2027-01-01 15:00+00', 'Venue name');

-- Already ran an earlier version of this file? Add the new column with:
-- alter table public.wedding_settings add column if not exists timezone text not null default 'Africa/Freetown';

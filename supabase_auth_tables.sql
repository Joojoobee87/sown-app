-- ─── Run this in your Supabase SQL Editor ───────────────────────────────────
-- Adds the user_profiles table for Pro status tracking
-- Run after your existing tables from the setup guide

-- User profiles — stores Pro status, preferences, location
create table user_profiles (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null unique,
  full_name   text,
  is_pro      boolean default false,
  pro_expiry  timestamptz,             -- null = lifetime Pro
  pro_source  text,                    -- e.g. 'grow_code:SOWN-2026-ABCD' or 'stripe'
  location    text default 'Leeds',   -- for frost alerts
  lat         float,                  -- user's latitude
  lon         float,                  -- user's longitude
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Row Level Security — users can only read/write their own profile
alter table user_profiles enable row level security;

create policy "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on user_profiles for insert
  with check (auth.uid() = user_id);


-- ─── Also add RLS to your existing tables ────────────────────────────────────
-- Run these if you haven't already — they ensure users only see their own data

-- user_plants RLS
alter table user_plants enable row level security;

create policy "Users can read own plants"
  on user_plants for select
  using (auth.uid() = user_id);

create policy "Users can insert own plants"
  on user_plants for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plants"
  on user_plants for update
  using (auth.uid() = user_id);

create policy "Users can delete own plants"
  on user_plants for delete
  using (auth.uid() = user_id);


-- plants table — readable by everyone, only editable by authenticated users
alter table plants enable row level security;

create policy "Plants readable by all authenticated users"
  on plants for select
  to authenticated
  using (true);

create policy "Plants insertable by authenticated users"
  on plants for insert
  to authenticated
  with check (true);

-- grow_codes — readable by authenticated, only redeemable once
alter table grow_codes enable row level security;

create policy "Grow codes readable by authenticated"
  on grow_codes for select
  to authenticated
  using (true);

create policy "Grow codes updatable by authenticated"
  on grow_codes for update
  to authenticated
  using (true);

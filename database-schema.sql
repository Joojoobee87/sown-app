-- Plants database (species knowledge)
create table plants (
  id uuid default gen_random_uuid() primary key,
  common_name text not null,
  latin_name text,
  sun_requirements text,
  soil_type text,
  height_cm_min int,
  height_cm_max int,
  aspect text,
  flowering_season text,
  care_notes text,
  photo_url text,
  illustration_url text,
  created_at timestamptz default now()
);

-- User plant library (saved plants per user)
create table user_plants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  plant_id uuid references plants,
  location text,
  personal_notes text,
  date_added date default current_date,
  status text default 'growing',
  created_at timestamptz default now()
);

-- Grow codes (product bundle redemption)
create table grow_codes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  product text,
  pro_months int,
  redeemed boolean default false,
  redeemed_by uuid references auth.users,
  redeemed_at timestamptz
);

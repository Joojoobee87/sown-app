-- Push notification subscriptions (one active subscription per user/device)
create table push_subscriptions (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users not null,
  endpoint     text not null,
  subscription jsonb not null,
  created_at   timestamptz default now(),
  unique(user_id, endpoint)
);

-- Only the authenticated user can read/write their own rows
alter table push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on push_subscriptions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists planner_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table planner_data enable row level security;

create policy "select own row"
  on planner_data for select
  using (auth.uid() = user_id);

create policy "insert own row"
  on planner_data for insert
  with check (auth.uid() = user_id);

create policy "update own row"
  on planner_data for update
  using (auth.uid() = user_id);

-- lets other signed-in devices receive live updates to this row
alter publication supabase_realtime add table planner_data;

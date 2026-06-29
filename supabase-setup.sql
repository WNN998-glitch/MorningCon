-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run

create extension if not exists pgcrypto;

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  hn text not null,
  cc text not null,
  hpi text,
  pe text,
  inv text,
  dx text,
  mgmt text,
  photos jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table cases enable row level security;

create policy "select_own_cases" on cases
  for select using (auth.uid() = user_id);

create policy "insert_own_cases" on cases
  for insert with check (auth.uid() = user_id);

create policy "update_own_cases" on cases
  for update using (auth.uid() = user_id);

create policy "delete_own_cases" on cases
  for delete using (auth.uid() = user_id);

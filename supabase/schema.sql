-- Run once in the Supabase SQL editor.
-- Also enable: Authentication -> Sign In / Providers -> "Allow anonymous sign-ins".

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,      -- client time of the edit, used for last-write-wins
  deleted boolean not null default false,
  server_at timestamptz not null default now(), -- server time, used as the pull cursor
  primary key (user_id, kind, id)
);

create index if not exists records_pull on public.records (user_id, server_at);

create or replace function public.touch_server_at() returns trigger
language plpgsql as $$
begin
  new.server_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.touch_server_at();

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

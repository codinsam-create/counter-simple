-- Zähler als unveränderliches Event-Log.
-- Der Zählerstand eines Users ist die Summe aller seiner Deltas.
--
-- Ausführen im Supabase Dashboard: SQL Editor -> New query -> einfügen -> Run.

create table public.counter_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  client_event_id uuid not null,
  created_at timestamptz not null default now(),
  constraint counter_events_client_event_unique unique (user_id, client_event_id)
);

comment on table public.counter_events is
  'Unveränderliche Zähl-Events. Der Zählerstand ist die Summe der Deltas.';

create index counter_events_user_created_idx
  on public.counter_events (user_id, created_at desc);

alter table public.counter_events enable row level security;

create policy "Eigene Events lesen"
  on public.counter_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Eigene Events einfuegen"
  on public.counter_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Bewusst keine UPDATE-/DELETE-Policies: Events sind unveränderlich.
-- Gelöscht wird nur kaskadierend über auth.users.

revoke all on public.counter_events from anon;
grant select, insert on public.counter_events to authenticated;

create or replace function public.counter_total()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer
  from public.counter_events
  where user_id = (select auth.uid());
$$;

comment on function public.counter_total() is
  'Liefert die Summe der Deltas des eingeloggten Users.';

revoke execute on function public.counter_total() from public, anon;
grant execute on function public.counter_total() to authenticated;

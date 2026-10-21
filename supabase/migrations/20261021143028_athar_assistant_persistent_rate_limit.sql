-- Durable per-IP rate limits for the public Athar assistant.
create table if not exists public.athar_assistant_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.athar_assistant_rate_limits enable row level security;
revoke all on table public.athar_assistant_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_athar_assistant_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_started timestamptz;
  v_count integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.athar_assistant_rate_limits as current_limit
    (key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update
  set window_started_at = case
        when current_limit.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= v_now
        then v_now else current_limit.window_started_at end,
      request_count = case
        when current_limit.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= v_now
        then 1 when current_limit.request_count >= p_limit + 1 then p_limit + 1 else current_limit.request_count + 1 end,
      updated_at = v_now
  returning window_started_at, request_count into v_started, v_count;

  if pg_catalog.random() < 0.01 then
    delete from public.athar_assistant_rate_limits
    where updated_at < v_now - interval '1 day';
  end if;

  return query select
    v_count <= p_limit,
    case when v_count >= p_limit then 0 else p_limit - v_count end,
    v_started + pg_catalog.make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_athar_assistant_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_athar_assistant_rate_limit(text, integer, integer) to service_role;

comment on table public.athar_assistant_rate_limits is 'Server-only hashed identifiers and counters for Athar assistant request throttling.';
comment on function public.consume_athar_assistant_rate_limit(text, integer, integer) is 'Atomically consumes one request from a bounded rate-limit window; callable only by service_role.';

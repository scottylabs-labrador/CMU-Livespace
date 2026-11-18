create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  building text,
  description text,
  created_at timestamptz not null default now(),
  readings_updated_at timestamptz
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique check (device_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  location_id uuid not null references public.locations(id),
  device_name text,
  credential_hash text not null check (credential_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  enabled boolean not null default true,
  stale_after_seconds integer not null default 120 check (stale_after_seconds between 30 and 86400)
);
create index devices_location on public.devices(location_id);

create table public.noise_readings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id),
  measurement_id text not null check (measurement_id ~ '^[A-Za-z0-9_-]{1,96}$'),
  timestamp timestamptz not null default now(),
  noise_dbfs double precision not null check (noise_dbfs between -160 and 0),
  measurement_duration_ms integer not null check (measurement_duration_ms between 1000 and 120000),
  created_at timestamptz not null default now(),
  unique (device_id, measurement_id)
);
create index noise_device_time on public.noise_readings(device_id, timestamp desc, id desc);

alter table public.locations enable row level security;
alter table public.devices enable row level security;
alter table public.noise_readings enable row level security;
revoke all on public.locations, public.devices, public.noise_readings from anon, authenticated;
grant select on public.locations to anon, authenticated;
create policy locations_read on public.locations for select to anon, authenticated using (true);

insert into public.locations (slug, name) values ('skibo-cafe', 'Skibo Cafe');
alter publication supabase_realtime add table public.locations;

-- Keep authentication, deduplication, throttling, and writes in one transaction.
create function public.ingest_noise(
  p_device text, p_hash text, p_measurement text,
  p_noise double precision, p_duration integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  device public.devices%rowtype;
  reading public.noise_readings%rowtype;
  received timestamptz;
begin
  select * into device from public.devices
    where device_id = p_device and enabled and credential_hash = p_hash for update;
  if not found then return jsonb_build_object('status', 'unauthorized'); end if;

  select * into reading from public.noise_readings
    where device_id = device.id and measurement_id = p_measurement;
  if found then
    if reading.noise_dbfs <> p_noise or reading.measurement_duration_ms <> p_duration then
      return jsonb_build_object('status', 'conflict');
    end if;
    return jsonb_build_object('status', 'duplicate', 'timestamp', reading.timestamp);
  end if;

  received := clock_timestamp();
  if device.last_seen_at > received - interval '5 seconds' then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.noise_readings
    (device_id, measurement_id, timestamp, noise_dbfs, measurement_duration_ms)
    values (device.id, p_measurement, received, p_noise, p_duration);
  update public.devices set last_seen_at = received where id = device.id;
  update public.locations set readings_updated_at = greatest(readings_updated_at, received)
    where id = device.location_id;
  return jsonb_build_object('status', 'stored', 'timestamp', received);
end $$;
revoke all on function public.ingest_noise(text,text,text,double precision,integer) from public, anon, authenticated;
grant execute on function public.ingest_noise(text,text,text,double precision,integer) to service_role;

create function public.location_snapshot(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', l.name,
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.device_name, 'enabled', d.enabled,
        'staleAfterSeconds', d.stale_after_seconds, 'lastSeenAt', d.last_seen_at,
        'latest', case when n.id is not null then jsonb_build_object(
          'timestamp', n.timestamp, 'noise_dbfs', n.noise_dbfs) end
      ) order by d.created_at, d.id)
      from public.devices d
      left join lateral (
        select id, timestamp, noise_dbfs from public.noise_readings
        where device_id = d.id order by timestamp desc, id desc limit 1
      ) n on d.enabled
      where d.location_id = l.id
    ), '[]'::jsonb)
  ) from public.locations l where l.slug = p_slug;
$$;

create function public.noise_history(
  p_slug text, p_from timestamptz, p_to timestamptz,
  p_before_time timestamptz default null, p_before_id uuid default null,
  p_limit integer default 250
) returns table (id uuid, device_id uuid, "timestamp" timestamptz, noise_dbfs double precision)
language sql stable security definer set search_path = '' as $$
  select n.id, n.device_id, n.timestamp, n.noise_dbfs
  from public.noise_readings n
  join public.devices d on d.id = n.device_id
  join public.locations l on l.id = d.location_id
  where l.slug = p_slug and p_to > p_from and p_to - p_from <= interval '31 days'
    and n.timestamp >= p_from and n.timestamp < p_to
    and (p_before_time is null or (n.timestamp, n.id) < (p_before_time, p_before_id))
  order by n.timestamp desc, n.id desc
  limit least(greatest(coalesce(p_limit,250),1),1000);
$$;

create function public.noise_summary(p_slug text, p_from timestamptz, p_to timestamptz, p_bucket text)
returns table (device_id uuid, bucket timestamptz, count bigint, equivalent_dbfs double precision)
language sql stable security definer set search_path = '' as $$
  select n.device_id, date_trunc(p_bucket,n.timestamp,'UTC'), count(*),
    10 * log(sum(n.measurement_duration_ms * power(10.0,n.noise_dbfs/10.0))
      / sum(n.measurement_duration_ms))
  from public.noise_readings n
  join public.devices d on d.id = n.device_id
  join public.locations l on l.id = d.location_id
  where l.slug = p_slug and p_bucket in ('hour','day')
    and p_to > p_from and p_to - p_from <= interval '31 days'
    and n.timestamp >= p_from and n.timestamp < p_to
  group by 1,2 order by 2,1;
$$;

revoke all on function public.location_snapshot(text),
  public.noise_history(text,timestamptz,timestamptz,timestamptz,uuid,integer),
  public.noise_summary(text,timestamptz,timestamptz,text) from public;
grant execute on function public.location_snapshot(text),
  public.noise_history(text,timestamptz,timestamptz,timestamptz,uuid,integer),
  public.noise_summary(text,timestamptz,timestamptz,text) to anon, authenticated;

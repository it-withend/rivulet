create table satellite_readings (
  id uuid primary key default gen_random_uuid(),
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  acquired_at timestamptz not null,
  scene_id text not null,
  cloud_cover numeric,
  usable_pixels integer not null,
  ndci numeric,
  turbidity numeric,
  forel_ule_equivalent integer check (forel_ule_equivalent between 1 and 21),
  hue_angle numeric,
  created_at timestamptz not null default now(),
  unique (waterbody_id, scene_id)
);
alter table satellite_readings enable row level security;
create policy "Satellite readings are public" on satellite_readings
  for select to anon, authenticated using (true);
create index satellite_readings_waterbody_idx
  on satellite_readings (waterbody_id, acquired_at desc);

-- Bounding box of a city's water bodies, for the Sentinel-2 STAC search in
-- scripts/satellite/ingest.ts. `security definer` so the ingest script's
-- service-role call needs no broader table grant, and `search_path` is
-- pinned per the pattern in 0006_spatial_helpers.sql.
create or replace function city_bbox(p_city text)
returns table (
  min_lon double precision,
  min_lat double precision,
  max_lon double precision,
  max_lat double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_xmin(ext), st_ymin(ext), st_xmax(ext), st_ymax(ext)
  from (
    select st_extent(geometry) as ext
    from waterbodies
    where city = p_city
  ) s;
$$;

alter function city_bbox(text) owner to postgres;

revoke all on function city_bbox(text) from public;
grant execute on function city_bbox(text) to service_role;

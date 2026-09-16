-- One Health exposure: who is near the water. Places where people, children
-- and dogs come close to a stream, loaded from OpenStreetMap by
-- scripts/seed/seed-exposure.ts, and a per-water-body summary of what lies
-- within a radius of it. Hazard comes from observations; this is the
-- exposure half of "hazard x exposure".

create table exposure_sites (
  osm_id text primary key, -- "node/123", "way/456", "relation/789"
  city text not null,
  kind text not null check (kind in (
    'playground', 'school', 'kindergarten', 'dog_park', 'park',
    'bathing', 'fishing', 'allotments', 'picnic'
  )),
  name text,
  geometry geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now()
);

create index exposure_sites_geometry_idx on exposure_sites using gist (geometry);
create index exposure_sites_city_idx on exposure_sites (city);

create table waterbody_exposure (
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  kind text not null,
  site_count integer not null,
  nearest_m double precision not null,
  nearest_name text,
  primary key (waterbody_id, kind)
);

alter table exposure_sites enable row level security;
alter table waterbody_exposure enable row level security;

create policy "Exposure sites are public" on exposure_sites
  for select to anon, authenticated using (true);
create policy "Water body exposure is public" on waterbody_exposure
  for select to anon, authenticated using (true);

-- Also created by the parked satellite migration; identical definition.
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
revoke all on function city_bbox(text) from anon, authenticated;
grant execute on function city_bbox(text) to service_role;

-- Rebuilds one city's summary. Distances are measured to the site's own
-- shape (a park's edge, not its centre). The geometry pre-filter in degrees
-- is deliberately generous so the index does the work before the exact
-- geography distance is taken.
create or replace function refresh_waterbody_exposure(
  p_city text,
  p_radius_m double precision
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted integer;
begin
  delete from waterbody_exposure
  where waterbody_id in (select id from waterbodies where city = p_city);

  insert into waterbody_exposure (waterbody_id, kind, site_count, nearest_m, nearest_name)
  select
    waterbody_id,
    kind,
    count(*)::integer,
    min(distance_m),
    (array_agg(name order by distance_m) filter (where name is not null))[1]
  from (
    select
      w.id as waterbody_id,
      s.kind,
      s.name,
      st_distance(w.geometry::geography, s.geometry::geography) as distance_m
    from waterbodies w
    join exposure_sites s
      on s.city = p_city
     and st_dwithin(w.geometry, s.geometry, p_radius_m / 50000.0)
    where w.city = p_city
  ) near
  where distance_m <= p_radius_m
  group by waterbody_id, kind;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

alter function refresh_waterbody_exposure(text, double precision) owner to postgres;
revoke all on function refresh_waterbody_exposure(text, double precision) from public;
revoke all on function refresh_waterbody_exposure(text, double precision) from anon, authenticated;
grant execute on function refresh_waterbody_exposure(text, double precision) to service_role;

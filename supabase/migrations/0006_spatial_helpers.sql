-- Server-side geometry checks for the observation pipeline (see review
-- 2026-09-16 §1.2): the API previously trusted `waterbodyId` and the
-- submitted GPS point together with no check that the point is actually
-- near the claimed water body's geometry.
--
-- Both functions are `security definer` so callers with column-restricted
-- (or no) direct table access can still compute a distance/ranking without
-- being granted broader table privileges, and both pin `search_path` to
-- avoid a search-path hijack through a same-named function/type in another
-- schema.

create or replace function waterbody_distance_m(
  p_waterbody uuid,
  p_lon double precision,
  p_lat double precision
)
returns double precision
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_distance(
    w.geometry::geography,
    st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
  )
  from waterbodies w
  where w.id = p_waterbody;
$$;

alter function waterbody_distance_m(uuid, double precision, double precision) owner to postgres;

revoke all on function waterbody_distance_m(uuid, double precision, double precision) from public;
revoke all on function waterbody_distance_m(uuid, double precision, double precision) from anon, authenticated;
grant execute on function waterbody_distance_m(uuid, double precision, double precision) to service_role;

-- Nearest water bodies to a point, for the map-less `/observe` entry point
-- (Task 19.3): ordered using the `<->` KNN operator against the existing
-- `waterbodies_geometry_idx` GiST index on the geometry column, then
-- reported in metres via a geography cast per row.
create or replace function nearest_waterbodies(
  p_lon double precision,
  p_lat double precision,
  p_limit int default 8
)
returns table (id uuid, name text, city text, distance_m double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    w.id,
    w.name,
    w.city,
    st_distance(
      w.geometry::geography,
      st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
    ) as distance_m
  from waterbodies w
  order by w.geometry <-> st_setsrid(st_makepoint(p_lon, p_lat), 4326)
  limit p_limit;
$$;

alter function nearest_waterbodies(double precision, double precision, int) owner to postgres;

revoke all on function nearest_waterbodies(double precision, double precision, int) from public;
grant execute on function nearest_waterbodies(double precision, double precision, int)
  to anon, authenticated, service_role;

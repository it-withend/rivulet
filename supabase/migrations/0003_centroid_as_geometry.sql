-- PostgREST returns geometry columns as GeoJSON but geography columns as WKB hex,
-- so the centroid is stored as geometry to be readable by the app.
alter table waterbodies
  alter column centroid type geometry(Point, 4326)
  using centroid::geometry;

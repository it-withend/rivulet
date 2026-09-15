create extension if not exists postgis with schema extensions;

create table waterbodies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  kind text not null check (kind in ('river','stream','pond','lake')),
  geometry geometry(Geometry, 4326) not null,
  centroid geography(Point, 4326) not null,
  wfd_code text,
  population_within_500m integer,
  has_recreation_area boolean not null default false,
  has_playground boolean not null default false,
  distance_to_abstraction_m integer,
  created_at timestamptz not null default now()
);

create index waterbodies_geometry_idx on waterbodies using gist (geometry);
create index waterbodies_city_idx on waterbodies (city);

create table observers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  locale text not null default 'en',
  email text,
  is_minor boolean not null default false,
  trust_score numeric not null default 0.5,
  created_at timestamptz not null default now()
);

create table observations (
  id uuid primary key default gen_random_uuid(),
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  observer_id uuid references observers(id) on delete set null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  location geography(Point, 4326) not null,
  gps_accuracy_m integer,
  photo_path text,
  forel_ule_index integer check (forel_ule_index between 1 and 21),
  forel_ule_confidence numeric,
  survey jsonb not null,
  indicators jsonb not null,
  quality_weight numeric not null,
  validation_status text not null default 'pending'
    check (validation_status in ('pending','auto_approved','flagged','human_approved','rejected')),
  is_synthetic boolean not null default false
);

create index observations_waterbody_idx on observations (waterbody_id, observed_at desc);

create table index_snapshots (
  id uuid primary key default gen_random_uuid(),
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  computed_at timestamptz not null default now(),
  posterior_mean numeric not null,
  ci_lower numeric not null,
  ci_upper numeric not null,
  alpha numeric not null,
  beta numeric not null,
  wfd_class text check (wfd_class in ('high','good','moderate','poor','bad')),
  class_probabilities jsonb not null,
  data_confidence numeric not null,
  sufficient_data boolean not null,
  observation_count integer not null,
  unique_observers integer not null,
  method_version text not null,
  inputs_snapshot jsonb not null
);

create index index_snapshots_waterbody_idx
  on index_snapshots (waterbody_id, computed_at desc);

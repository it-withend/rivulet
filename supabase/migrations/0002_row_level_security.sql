-- The anon key ships to browsers, so every table needs RLS; writes go through
-- server routes using the service role, which bypasses RLS.
alter table waterbodies enable row level security;
alter table observers enable row level security;
alter table observations enable row level security;
alter table index_snapshots enable row level security;

create policy "Water bodies are public" on waterbodies
  for select to anon, authenticated using (true);

create policy "Observations are public" on observations
  for select to anon, authenticated using (true);

create policy "Snapshots are public" on index_snapshots
  for select to anon, authenticated using (true);

-- observers has no policies: display names and emails are never readable publicly.

-- An observer's exact position must never be public; expose every other column.
revoke select on observations from anon, authenticated;
grant select (
  id,
  waterbody_id,
  observer_id,
  observed_at,
  created_at,
  forel_ule_index,
  forel_ule_confidence,
  survey,
  indicators,
  quality_weight,
  validation_status,
  is_synthetic
) on observations to anon, authenticated;

alter table observers
  add column token_hash text unique,
  add column is_synthetic boolean not null default false;

create policy "Observer profiles are public" on observers
  for select to anon, authenticated using (true);
revoke select on observers from anon, authenticated;
grant select (id, display_name, trust_score, is_synthetic, created_at)
  on observers to anon, authenticated;

create index observations_observer_idx on observations (observer_id, observed_at desc);

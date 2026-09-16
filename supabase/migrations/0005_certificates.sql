create table certificates (
  id uuid primary key default gen_random_uuid(),
  observer_id uuid not null references observers(id) on delete cascade,
  tier text not null check (tier in ('contributor','data_steward')),
  recipient_name text not null,
  credential jsonb not null,
  jwt text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  endorsements jsonb not null default '[]'
);
alter table certificates enable row level security;
create policy "Certificates are publicly verifiable" on certificates
  for select to anon, authenticated using (true);
revoke select on certificates from anon, authenticated;
grant select (id, tier, recipient_name, credential, jwt, issued_at, revoked_at, endorsements)
  on certificates to anon, authenticated;
create unique index certificates_one_per_tier on certificates (observer_id, tier)
  where revoked_at is null;

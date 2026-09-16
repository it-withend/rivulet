-- Human review queue (closes the "flagged has no review UI" gap from the
-- 2026-09-16 review, §F7): every automatic reason an observation was held
-- back is now recorded, and a moderator can approve or reject it.
--
-- There are no moderator accounts — this is a two-person hackathon team, not
-- a platform — so moderation is gated by a single shared secret
-- (RIVULET_MODERATOR_TOKEN, checked server-side) rather than a real auth
-- system. Never expose that token to anon/authenticated.

alter table observations
  add column flag_reason text,
  add column reviewed_at timestamptz;

comment on column observations.flag_reason is
  'Why plausibilityStatus (or the photo check) held this observation for review: gps_accuracy, rate_limit, distance_from_waterbody, or ai_not_water. Null once auto_approved.';
comment on column observations.reviewed_at is
  'When a moderator approved or rejected this observation. Null while still pending or if it was auto_approved.';

-- Column-level grants are additive and explicit (see 0002), so these two
-- columns are simply never granted — anon and authenticated cannot read
-- them, and only the service role (moderation API) can.

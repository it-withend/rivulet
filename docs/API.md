# API

Base URL: `https://rivulet-xi.vercel.app`. JSON unless stated. Reading is public; anything that writes as a person uses the
pseudonymous observer token as `Authorization: Bearer <token>`.

## FHIR (read-only, public)

Base `/fhir`. The endpoint's own [CapabilityStatement](https://rivulet-xi.vercel.app/fhir/metadata) is authoritative.

| Request | Returns |
|---|---|
| `GET /fhir/metadata` | CapabilityStatement |
| `GET /fhir/Location?city=<city>[&_count=50&_offset=0]` | Searchset of `LocationOah` (max 200 per page) |
| `GET /fhir/Location/<id>` | One `LocationOah` |
| `GET /fhir/Observation?subject=Location/<id>` | Searchset of `ObservationIndicatorsOah` plus the Location |
| `GET /fhir/DetectedIssue?implicated=Location/<id>` | The One Health warning, if any, plus the Location |
| `GET /fhir/CodeSystem/rivulet-derived` | The codes Rivulet adds beyond the OneAquaHealth code system |
| `GET /api/fhir/Observation?waterbody=<id>` | One Bundle with the Location, Observations, Provenance and DetectedIssue |

Errors are `OperationOutcome`. Observations held for review are never returned; seeded demonstration data carries
`meta.tag` `HTEST`.

## Reports

| Request | Purpose |
|---|---|
| `POST /api/observers` | Create a pseudonymous observer; returns `{id, displayName, token}` once |
| `GET /api/waterbodies/nearest?lon=&lat=` | The nearest mapped streams to a position |
| `GET /api/waterbodies/search?q=<name>` | Find a stream by name |
| `POST /api/observations` | Submit a report (see below) |

`POST /api/observations` body:

```json
{
  "waterbodyId": "uuid",
  "observedAt": "2026-09-20T10:00:00.000Z",
  "longitude": -8.42, "latitude": 40.22, "gpsAccuracyM": 12,
  "forelUleIndex": 9, "forelUleConfidence": 0.7,
  "survey": { "odour": "none", "foam": false, "litter": 0, "deadFish": false, "visibleAlgae": false,
              "clarity": "clear", "flow": "normal", "indicatorTaxa": [], "forelUle": 9, "measurements": {} },
  "photoThumbnail": "data:image/jpeg;base64,..."
}
```

`observedAt` may be up to 30 days in the past (so a report written offline keeps its true time) and at most five minutes in
the future. The response includes `id`, `heldForReview` and the effect on the stream's assessment. Status `400` means the
body failed validation and `404` an unknown water body; the plausibility checks never reject, they hold the report for review.

## Map and pages

| Request | Purpose |
|---|---|
| `GET /api/city/<city>/map` | Everything the map needs for a city; CDN-cached |
| `GET /api/city/<city>/data` | The city as a CSV: status class, 90% interval, data confidence, report counts, One Health concern |
| `GET /api/badges/stats` | How many observers hold each badge, for the rarity on the journal |

## Credentials

| Request | Purpose |
|---|---|
| `GET /api/observers/me/summary` | The caller's contribution summary (needs the observer token) |
| `POST /api/certificates` | Claim a certificate the caller qualifies for: `{"tier":"contributor"|"data_steward","recipientName":"..."}`; `403 not_eligible` lists what is missing |
| `GET /api/certificates/<id>` | The signed Open Badges credential (JSON and the compact JWS) |
| `GET /api/certificates/<id>/pdf` | The certificate as a PDF; refused when revoked or when the signature does not verify |
| `GET /api/issuer/jwks` | The issuer's public key as a JWK set |

## Moderation

Requires the `x-moderator-token` header; the page at `/moderate` uses it.

| Request | Purpose |
|---|---|
| `GET /api/moderation/observations` | Observations held for review, with the reason |
| `POST /api/moderation/observations/<id>` | `{"action":"approve"}` or `{"action":"reject"}`; recomputes trust for that water body |

# AquaPulse — Design Specification

**Date:** 2026-09-15
**Event:** IEEE OneAquaHealth Global Hackathon 2026
**Primary track:** Track 2 — Data-to-Insight
**Supporting tracks:** Track 1 (Citizen Science UX), Track 3 (AI-Supported Assessment), Track 5 (Community & Gamification), Track 6 (Resilience Informatics), Track 7 (Digital Health Standards)
**Team:** 2 people (1 developer, 1 reviewer)
**Timeline:** 2–3 weeks to MVP

---

## 1. Summary

AquaPulse turns citizen observations of urban freshwater bodies into scientifically grounded,
uncertainty-aware assessments of ecosystem condition and human health risk.

A resident photographs a stream. The platform derives a quantitative water-colour index from that
photo, cross-checks it against Sentinel-2 satellite imagery, aggregates it with other observations
using a Bayesian model weighted by observer reliability, maps the result onto EU Water Framework
Directive ecological status classes, and converts ecological hazard into a One Health risk estimate
based on how people actually come into contact with that water.

Every number is traceable to its inputs, its formula, and the published method it came from.

**Positioning:** AquaPulse is an analytics and insight layer designed to sit *on top of* citizen
science data collection such as the OneAquaHealth Citizen Science App — complementary, not
competing. Its data model and exports are built for that integration.

---

## 2. Problem

Urban freshwater ecosystems are under pressure from urbanisation and climate change, but official
monitoring is sparse in both space and time. Citizen science can close that gap, yet citizen data
has three chronic weaknesses:

1. **It is qualitative.** "The water looked green" cannot enter a scientific model.
2. **It is noisy.** Observer skill varies, and quality is rarely quantified.
3. **It stops at ecology.** The link to human health — the core of the One Health vision — is
   usually asserted rather than modelled.

Most tooling in this space either visualises raw observations without interpretation, or invents an
opaque "health score" that no ecologist or regulator can defend.

---

## 3. Design principles

These constrain every decision below.

1. **No invented metrics.** Every indicator maps to a documented, citable method.
2. **Absence of data never reads as good news.** Low confidence is displayed as low confidence,
   never as green.
3. **Honest uncertainty over false precision.** Estimates ship with credible intervals.
4. **AI supports, never replaces, human judgement.** Explanations cite concrete evidence.
5. **Gamification rewards quality and usefulness, never raw volume.**
6. **Two audiences, one product.** A resident sees a traffic light; a researcher sees the maths.
7. **Privacy by design.** Anonymous participation is the default path.
8. **State limitations explicitly.** These are proxy estimates, not laboratory measurements.

---

## 4. Scientific basis

| Component | Method | Role in the system |
|---|---|---|
| Water colour from photo | Forel–Ule scale (21 classes), as used in citizen-science water-colour projects | Converts a photo into a quantitative index correlated with chlorophyll-a, CDOM and trophic state |
| Satellite water quality | Sentinel-2 (Copernicus), NDCI and turbidity indices | Independent observation of the same water body |
| Ecological status | EU Water Framework Directive 2000/60/EC classes (High/Good/Moderate/Poor/Bad) | Output expressed in the language European authorities report in |
| Biological indicators | BMWP/ASPT-style family sensitivity, EPT presence | Citizen-reported indicator taxa become a scientific signal |
| Aggregation | Bayesian updating (Beta conjugate), observation-weighted | Produces an estimate with an explicit credible interval |
| Observer agreement | Cohen's kappa | Standard citizen-science quality-assurance statistic |
| Health risk | Hazard × Exposure × Vulnerability | Standard environmental-epidemiology risk framing |
| Trend | Robust regression over a trailing window | Short-horizon early warning, labelled as trend extrapolation |

**Novelty claim (stated honestly):** no individual component is new. The contribution is the
*integration* — trust-weighted fusion of citizen and satellite observation, divergence between them
treated as an informative signal rather than error, and a transparent path from ecological state to
human health risk.

---

## 5. Architecture

**Application:** Next.js (App Router, TypeScript), deployed on Vercel. One codebase serving the
landing page, public map, observation wizard, validation queue, and API routes.

**Database:** Supabase (PostgreSQL + PostGIS + Auth + Storage). PostGIS handles water body geometry
and spatial queries. Storage holds observation photos. Realtime powers live map updates.

**AI:** Server-side LLM calls for (a) observation plausibility assessment with evidence-cited
explanation, and (b) plain-language summaries of a water body's recent history. Never on the
critical path — failure falls back to rule-based logic.

**Satellite data:** Copernicus Sentinel-2 derived indices, **pre-fetched and cached** for the demo
region. The live demo must never depend on a third-party API responding.

**Delivery:** Responsive web app with PWA capabilities — installable, works offline for observation
capture, syncs when connectivity returns. No native app build required.

---

## 6. Data model

### Core entities

**`waterbodies`**
Geometry (PostGIS), name, type, optional official WFD water body code, and pre-computed exposure
attributes: population within 500 m, presence of recreation areas and playgrounds, distance to
abstraction points, bathing designation. These change rarely and are computed once at seed time.

**`observers`**
Display name, locale, `trust_score` and its components, optional email (only if a certificate is
requested), minor flag (forces coarse geolocation). Anonymous participation supported.

**`observations`**
Position and GPS accuracy, timestamps, optional photo with derived Forel–Ule index and match
confidence. Resident-facing fields: colour, odour, foam, litter level, dead fish, visible algae,
clarity, flow state. Indicator taxa observed. Optional instrument readings (pH, dissolved oxygen,
temperature, turbidity, nitrate). Validation status and computed quality weight.

**`satellite_readings`**
Acquisition date, cloud cover, NDCI, turbidity index, chlorophyll proxy, Forel–Ule equivalent,
sampled pixel count.

**`index_snapshots`**
Posterior estimate with credible interval bounds, WFD class with per-class probabilities, data
confidence, observation and observer counts, agreement kappa, satellite agreement, `method_version`,
and `inputs_snapshot` (JSON) — a complete record of the inputs so any past assessment can be
reproduced exactly.

**`risk_assessments`**
Hazard, exposure and vulnerability scores with their components, combined risk score and class,
forecast horizon and trend, and a structured explanation with source references.

**`method_versions`**
Formulas, thresholds and citations stored as versioned records. Every computation is stamped with
the method version that produced it. This powers the "Why this score?" disclosure and makes results
reproducible.

**`validations`**
Human decisions on flagged observations, alongside the AI suggestion and explanation, and whether
the human agreed — which feeds both trust scoring and an auditable record of AI performance.

**`quests`**, **`guardianships`**, **`achievements`**, **`certificates`**
Engagement mechanics (detailed in §8).

**`external_measurements`**
Official open water-quality measurements for the demo region, used to validate our index against
reality (§10).

---

## 7. Computation pipeline

**Step 1 — Normalise.** Each survey field maps to a documented indicator: sewage odour to a faecal
contamination proxy, foam plus visible algae to cyanobacterial bloom potential, mayflies and
caddisflies to high pollution sensitivity, and so on.

**Step 2 — Weight the observation.** Quality weight derives from observer trust score, survey
completeness, photo presence, GPS accuracy, and recency.

**Step 3 — Bayesian aggregation.** Water body condition is modelled as a Beta distribution. The
prior comes from satellite readings and history; weighted observations update it. Output is a
posterior mean with a 90% credible interval.

**Step 4 — Map to WFD class.** Reported with probability mass, e.g. *"Moderate (68% likely; 22%
probability the true class is Poor)"*.

**Step 5 — Data confidence.** Derived from observation count, observer diversity, recency, inter-
observer agreement, and satellite availability. Below threshold, the UI renders an explicit
"insufficient data" state rather than any status colour.

**Step 6 — Divergence engine.** Citizen-derived Forel–Ule is compared against the satellite
equivalent. Significant divergence between two recent sources is flagged and automatically
generates a verification quest. Divergence is treated as signal: satellites see the whole surface
coarsely, people see one bank precisely, and disagreement can indicate a localised event below
satellite resolution.

**Step 7 — One Health risk.** Hazard (cyanobacterial potential, faecal proxy, stagnation, vector
breeding conditions) × Exposure (proximity of housing, recreation, playgrounds, abstraction) ×
Vulnerability (population density, vulnerable groups), each normalised, with components disclosed.

**Step 8 — Forecast.** Robust regression over a trailing window plus a temperature factor, producing
direction and confidence over a 5–7 day horizon. Labelled in the UI as trend extrapolation, not
prediction.

---

## 8. Engagement mechanics

The design deliberately avoids volume-based scoring, which is documented to degrade citizen-science
data quality.

**Trust Score as a statistical weight.** An observer's historical agreement with satellite data,
with other observers, and with validator decisions produces a trust score — and that same score is
the observation's weight in the Bayesian model. The leaderboard is therefore a real quantity inside
the science, not a cosmetic layer.

**Quests generated from scientific gaps.** The system knows where data is stale, where satellites
show an anomaly nobody has checked, and where citizen and satellite readings diverge. It converts
these into valued missions, so players chase exactly the observations the model needs. This is
targeted sampling expressed as a game mechanic.

**Stream Guardian.** A resident adopts a specific water body and commits to regular observation,
with attribution on that water body's page. Directly addresses low repeat engagement.

**District leaderboards.** Collective goals alongside individual ones, which sustain participation
longer than pure individual competition.

**Badges for real contributions.** First to detect a bloom, confirmed a satellite anomaly, recorded
an indicator species, closed a data gap — not "submitted ten observations".

**Anti-gaming.** Points award only after validation. Geolocation is checked, repeat submissions at
one location per day are capped, and duplicates are detected.

### Certificates

**Constraint:** the platform must not issue credentials bearing EU, IEEE or OneAquaHealth
endorsement without authorisation. Doing so would be fabricating an official document.

**Approach:** AquaPulse issues verifiable credentials under its own name, with a structural slot for
institutional co-signing. The pitch position is that the mechanism is built and standards-compliant,
ready for a municipality or the consortium to endorse.

Credentials follow **Open Badges 3.0 / W3C Verifiable Credentials**, compatible with the European
digital credentials framework, and each has a public verification page — meaning the certificate
cannot be forged by editing a PDF.

Recognition tiers: Contributor, Stream Guardian, Data Steward, and annual city-level recognition.
Statistics on the certificate are concrete and verifiable: validated observations, contribution
hours, water bodies under guardianship, anomalies confirmed.

**Highest-value reward:** when an accumulated dataset is published with a DOI, contributing
observers are named in the dataset's contributor list — a real scientific citation.

---

## 9. Screens

1. **Landing page (home).** Startup-style scrolling page: hero with live map backdrop, problem
   framing, three-step explanation, live counters, a "the science behind this" section with
   citations, a One Health diagram, community highlights, open data section, call to action.

2. **City map.** Water bodies coloured by WFD class, with toggleable layers: citizen observations,
   satellite layer, One Health risk heatmap, and the citizen-satellite divergence layer.

3. **Water body page.** Current class with credible interval and data confidence, time series with
   uncertainty band, observation feed with photos and Forel–Ule values, citizen-vs-satellite
   agreement panel, risk forecast, and a **"Why this score?"** disclosure exposing inputs, formula,
   method version and sources.

4. **Observation wizard (mobile-first).** Stepwise, not a single long form: location, then photo
   with **immediate on-screen Forel–Ule feedback**, then picture-based plain-language questions,
   then optional instrument readings. Closes with how the observation moved the water body's
   assessment.

5. **Validation queue.** AI-flagged observations with evidence and reasoning; a human confirms or
   rejects. Inter-observer agreement statistics are computed here.

6. **Open data page.** Live examples of Darwin Core and FHIR exports and the public API.

### Display modes

A user-level toggle:

- **Simple (default):** traffic light, one sentence on condition, one sentence on what it means for
  people nearby.
- **Scientific:** intervals, WFD classes, formulas, method version, citations.

Progressive disclosure is mandatory — scientific depth must never be the first thing a resident
sees.

---

## 10. Interoperability and validation

**Exports.** Ecological observations export as **Darwin Core** (the biodiversity standard behind
GBIF and iNaturalist); health-related outputs export as **HL7 FHIR**. Combining both in one model is
a literal implementation of One Health interoperability, and follows FAIR data principles.

**Method validation.** Our index is compared against official open water-quality measurements for
the demo region, and the correlation is presented in the UI and the pitch. This is the difference
between claiming a formula works and showing that it tracks reality.

**Limitations, stated explicitly.** Photo-derived colour is a proxy, not a measurement. Satellite
pixels are coarse relative to small urban streams. Citizen observations are spatially biased toward
accessible banks. Forecasts are trend extrapolations. These appear in the product and in the pitch.

---

## 11. Error handling

Guiding rule: **missing data never becomes good news.**

- No photo — Forel–Ule is null, weight is reduced, observation still accepted.
- Cloud-covered satellite pass — recorded as unavailable, never as "no divergence".
- Sparse observations — wide credible interval and an explicit low-confidence state.
- Poor GPS — the user is asked to confirm the nearest water body.
- LLM failure — falls back to rule-based validation; **submission is never blocked**.
- Offline — queued locally and synced when connectivity returns.

---

## 12. Privacy and GDPR

- Anonymous participation by default; email collected only for certificates.
- **EXIF metadata stripped server-side** on photo upload.
- Public display snaps position to the water body rather than showing the observer's exact location.
- Coarse geolocation enforced for accounts flagged as minors.
- Data subject rights implemented: export and deletion endpoints.
- No tracking analytics, no third-party cookies.
- A plain-language data page in the product, and a dedicated pitch slide.

---

## 13. Testing

- **Golden tests** on scoring functions: known inputs to documented outputs.
- Forel–Ule matching verified against the reference colour table.
- **Property tests** on the Bayesian model: more data narrows the interval; conflicting data widens
  it.
- Correlation check against the external reference dataset.
- End-to-end: submit observation, see it on the map, see the index recompute.
- Realistic seed data generator.

---

## 14. Scope discipline

Judged submissions are penalised harder for half-finished features than for absent ones. Therefore:

**Must ship, fully working:**
observation wizard with live Forel–Ule feedback; city map with WFD classes; water body page with
credible intervals and "Why this score?"; Bayesian aggregation; simple/scientific mode toggle;
privacy handling.

**Ship if on schedule:**
satellite layer and divergence engine; One Health risk model and forecast; validation queue;
quests and Trust Score; Darwin Core and FHIR export.

**Cut without hesitation if at risk:**
certificates and badge issuance; district leaderboards; guardianship mechanics.

Anything not finished is removed from the interface entirely and, where relevant, presented as
future work rather than left as a dead button.

---

## 15. Submission checklist

- [ ] Track alignment stated explicitly (Track 2 primary)
- [ ] Project description: problem, solution, users, expected ecosystem and health impact
- [ ] Demo video 3–5 minutes, **opening with a resident at a river, not with architecture**
- [ ] Public repository with source and documentation
- [ ] Working prototype at a live URL
- [ ] Limitations slide
- [ ] GDPR and ethics slide
- [ ] Method validation chart against official data
- [ ] Adoption pathways: schools, municipalities, corporate volunteering, EU youth programmes

# Rivulet — Design Specification

**Date:** 2026-09-15
**Event:** IEEE OneAquaHealth Global Hackathon 2026
**Primary track:** Track 2 — Data-to-Insight
**Supporting tracks:** Track 1 (Citizen Science UX), Track 3 (AI-Supported Assessment), Track 5 (Community & Gamification), Track 6 (Resilience Informatics), Track 7 (Digital Health Standards)
**Team:** 2 people (1 developer, 1 reviewer)
**Timeline:** 2–3 weeks to MVP
**Demo region:** Coimbra, Portugal (primary); Toulouse, Benevento, Ghent, Oslo seeded

---

## 1. Summary

Rivulet is a **trust and quality layer for citizen observations of urban freshwater**.

It takes citizen observations, quantifies how much each one can be trusted, aggregates them into an
uncertainty-aware estimate of ecosystem condition, expresses that estimate in EU Water Framework
Directive ecological status classes, converts it into a One Health risk estimate for the people who
actually come into contact with that water, and emits everything through the **OneAquaHealth HL7
FHIR Implementation Guide** developed by HL7 Europe.

Every number is traceable to its inputs, its formula, and the published method it came from.

---

## 2. Positioning — what we are *not* building

The OneAquaHealth consortium has **already built** a CitizenScience App, a Community platform, an
AI-based Environmental Surveillance System with early warning, a Decision Support System, and a
FHIR Implementation Guide.

Any hackathon submission that presents "a citizen app plus an AI dashboard plus early warning" is
therefore proposing a weaker copy of what the client already runs. This is the central trap of this
hackathon.

**Rivulet is deliberately the complement, not the replacement.** Citizen data collection exists; what
is missing is a rigorous, transparent answer to the question *"how much should we believe this
observation, and what does it mean for the people who live here?"*

Our claim is narrow and defensible:

> We do not build another monitoring system — one already exists. We build the **quality and trust
> layer** that turns resident observations into estimates with measurable uncertainty, expressed in
> WFD classes and encoded in the consortium's own FHIR Implementation Guide.

---

## 3. Competitive landscape (researched 2026-09-15)

Honest assessment of prior art, so that no claim in the pitch can be punctured by a judge.

| System | What it does | Overlap with Rivulet |
|---|---|---|
| **EyeOnWater** / AquaWatch Australia (CSIRO) | Citizens photograph water; the WACODI algorithm derives hue angle and Forel–Ule index; data explicitly validates and calibrates satellite water-quality products | **High.** Photo→Forel–Ule and citizen↔satellite cross-validation are established practice, not novel |
| **CrowdWater** (Univ. Zurich) | Citizen hydrological data without equipment; virtual staff gauge | Low — focuses on water level and flow, not quality or health |
| **FreshWater Watch** (Earthwatch) | Test kits for nitrate and orthophosphate | Low — hardware-based measurement, no satellite or health layer |
| **EarthEcho Water Challenge** | Education-oriented kits: temperature, pH, dissolved oxygen | Low |
| **Riverfly Partnership** (UK) | Citizens count invertebrate groups on a BMWP-like protocol | Moderate on biological indicators only |
| **OneAquaHealth** itself | CitizenScience App, Community, Environmental Surveillance System, Decision Support System, FHIR IG | The client. We integrate, not compete |

**Consequence for our claims.** Forel–Ule derivation and citizen–satellite comparison are presented
as *adopting validated prior art*, never as our invention. Knowing and citing the literature is a
credibility gain; claiming invention here would be immediately falsifiable.

**What remains genuinely ours:**

1. Observer trust score used as a **statistical weight inside a Bayesian model**, not as a cosmetic leaderboard.
2. Transfer from ecological state to **human health risk** (hazard × exposure × vulnerability), encoded into the IG's health-indicator profile.
3. Quests generated from **scientific data gaps** — targeted sampling expressed as a game mechanic.
4. **Conformance to the OneAquaHealth FHIR IG** — as far as we can establish, the first external implementation.
5. Verifiable credentials for volunteers under Open Badges 3.0 / W3C VC.

---

## 4. Problem

Urban freshwater monitoring is sparse in space and time. Citizen science can close that gap, but
citizen data has three chronic weaknesses:

1. **It is qualitative.** "The water looked green" cannot enter a model.
2. **Its reliability is unquantified.** Observer skill varies and is rarely measured.
3. **It stops at ecology.** The link to human health — the core of One Health — is asserted rather
   than modelled.

---

## 5. Design principles

1. **No invented metrics.** Every indicator maps to a documented, citable method.
2. **Absence of data never reads as good news.** Low confidence displays as low confidence, never as green.
3. **Honest uncertainty over false precision.** Estimates ship with credible intervals.
4. **AI supports, never replaces, human judgement.** Explanations cite concrete evidence.
5. **Gamification rewards quality and usefulness, never raw volume.**
6. **Two audiences, one product.** A resident sees a traffic light; a researcher sees the maths.
7. **Privacy by design.** Anonymous participation is the default path.
8. **State limitations explicitly.** These are proxy estimates, not laboratory measurements.

---

## 6. Scientific basis

| Component | Method | Role |
|---|---|---|
| Water colour from photo | Forel–Ule scale (21 classes), as validated in EyeOnWater / AquaWatch | Converts a photo into a quantitative index correlated with chlorophyll-a, CDOM and trophic state |
| Satellite water quality | Sentinel-2 (Copernicus), NDCI and turbidity indices | Independent observation of the same water body |
| Ecological status | EU Water Framework Directive 2000/60/EC classes | Output in the language European authorities report in — and the framework the OAH FHIR IG aligns to |
| Biological indicators | BMWP/ASPT-style family sensitivity, EPT presence | Citizen-reported indicator taxa become a scientific signal |
| Aggregation | Bayesian updating (Beta conjugate), observation-weighted | Estimate with an explicit credible interval |
| Observer agreement | Cohen's kappa | Standard citizen-science quality-assurance statistic |
| Health risk | Hazard × Exposure × Vulnerability | Standard environmental-epidemiology risk framing |
| Trend | Robust regression over a trailing window | Short-horizon early warning, labelled as trend extrapolation |

**Novelty claim, stated precisely:** no individual component is new. The contribution is the
integration — trust-weighted fusion, divergence treated as signal, and a transparent path from
ecological state to standards-encoded health risk.

---

## 7. FHIR conformance (verified 2026-09-15)

The consortium's IG lives at `github.com/hl7-eu/oah`. Profile definitions inspected directly from
source. Two profiles matter to us:

**`ObservationIndicatorsOah`** (parent: `Observation`)
- `status` fixed to `final`
- `code` bound to `OahIndicatorsNoHealthOahVs` (preferred)
- `subject` restricted to `Reference(LocationOah)` — the water body
- `specimen` restricted to `Reference(SpecimenOah)`
- `effective[x]` required; `performer` required
- `value[x]` restricted to `CodeableConcept` or `Quantity`; components supported

→ **Our ecological outputs map here.** Water body becomes a `LocationOah`; Forel–Ule index, WFD
class, and component indicators become coded or quantitative values.

**`ObservationHealthMeasureOah`** (parent: `Observation`)
- `code` bound to `HealthIndicatorsOahVs` (preferred)
- `subject` restricted to `Reference(LocationOah)`
- `focus` restricted to `Reference(GroupOah)` — a population group
- `value[x]` restricted to `CodeableConcept` or `Quantity`

→ **Our One Health risk output maps here**, with `focus` pointing at the exposed resident
population. This is precisely the ecology-to-health link the IG exists to carry, and it is the
sharpest available demonstration that Rivulet is built to plug into the consortium's architecture.

**Open item:** the rendered IG at `build.fhir.org/ig/hl7-eu/oah/` currently returns 404, so value set
contents (`OahIndicatorsNoHealthOahVs`, `HealthIndicatorsOahVs`) have not yet been read. These must
be pulled from `input/fsh/terminologies/` before coding the mapping. If a required code is absent,
we extend locally and document the gap rather than silently inventing codes.

---

## 8. Architecture

**Application:** Next.js (App Router, TypeScript) on Vercel. One codebase serving landing page,
public map, observation wizard, validation queue, and API routes.

**Database:** Supabase (PostgreSQL + PostGIS + Auth + Storage). PostGIS for water body geometry and
spatial queries, Storage for photos, Realtime for live map updates.

**AI:** Server-side LLM calls for (a) observation plausibility assessment with evidence-cited
explanation and (b) plain-language summaries. Never on the critical path — failure falls back to
rule-based logic.

**Satellite data:** Copernicus Sentinel-2 derived indices, **pre-fetched and cached** for the demo
region. The live demo must never depend on a third-party API responding.

**Delivery:** Responsive web app with PWA capabilities — installable, offline observation capture,
sync on reconnect. No native build.

**Multi-city from day one.** Coimbra receives deep data; the other four pilot cities are seeded more
lightly. A city switcher demonstrates scalability directly in the demo at negligible cost.

---

## 9. Data model

**`waterbodies`** — geometry (PostGIS), name, type, city, optional official WFD water body code, and
pre-computed exposure attributes: population within 500 m, recreation areas and playgrounds,
distance to abstraction points, bathing designation. Computed once at seed time.

**`observers`** — display name, locale, `trust_score` and components, optional email (certificates
only), minor flag (forces coarse geolocation). Anonymous participation supported.

**`observations`** — position and GPS accuracy, timestamps, optional photo with derived Forel–Ule
index and match confidence. Resident-facing fields: colour, odour, foam, litter, dead fish, visible
algae, clarity, flow state. Indicator taxa observed. Optional instrument readings (pH, dissolved
oxygen, temperature, turbidity, nitrate). Validation status and computed quality weight.

**`satellite_readings`** — acquisition date, cloud cover, NDCI, turbidity index, chlorophyll proxy,
Forel–Ule equivalent, sampled pixel count.

**`index_snapshots`** — posterior estimate with credible interval, WFD class with per-class
probabilities, data confidence, observation and observer counts, agreement kappa, satellite
agreement, `method_version`, and `inputs_snapshot` (JSON) — a complete record of inputs so any past
assessment can be reproduced exactly.

**`risk_assessments`** — hazard, exposure and vulnerability scores with components, combined risk
score and class, forecast horizon and trend, structured explanation with source references.

**`method_versions`** — formulas, thresholds and citations as versioned records. Every computation is
stamped with the version that produced it. Powers the "Why this score?" disclosure.

**`validations`** — human decisions on flagged observations alongside the AI suggestion and
explanation, and whether the human agreed — feeding both trust scoring and an auditable record of
AI performance.

**`quests`**, **`guardianships`**, **`achievements`**, **`certificates`** — engagement mechanics (§11).

**`external_measurements`** — official open water-quality measurements for Coimbra (Portuguese
national water data), used to validate our index against reality.

---

## 10. Computation pipeline

**1 — Normalise.** Survey fields map to documented indicators: sewage odour to a faecal
contamination proxy, foam plus visible algae to cyanobacterial bloom potential, mayflies and
caddisflies to high pollution sensitivity.

**2 — Weight the observation.** From observer trust score, survey completeness, photo presence, GPS
accuracy, and recency.

**3 — Bayesian aggregation.** Water body condition modelled as a Beta distribution. Prior from
satellite readings and history; weighted observations update it. Output: posterior mean with a 90%
credible interval.

**4 — Map to WFD class**, reported with probability mass, e.g. *"Moderate (68% likely; 22%
probability the true class is Poor)"*.

**5 — Data confidence** from observation count, observer diversity, recency, inter-observer
agreement, and satellite availability. Below threshold the UI renders an explicit "insufficient
data" state rather than any status colour.

**6 — Divergence engine.** Citizen-derived Forel–Ule compared against the satellite equivalent.
Significant divergence between two recent sources is flagged and generates a verification quest.
Satellites see the whole surface coarsely; people see one bank precisely; disagreement can indicate
a localised event below satellite resolution.

**7 — One Health risk.** Hazard (cyanobacterial potential, faecal proxy, stagnation, vector breeding
conditions) × Exposure (proximity of housing, recreation, playgrounds, abstraction) × Vulnerability
(population density, vulnerable groups), each normalised, components disclosed.

**8 — Forecast.** Robust regression over a trailing window plus a temperature factor; direction and
confidence over 5–7 days. Labelled in the UI as trend extrapolation, not prediction.

---

## 11. Engagement mechanics

Volume-based scoring is avoided deliberately — it is documented to degrade citizen-science data
quality.

**Trust Score as a statistical weight.** An observer's historical agreement with satellite data, with
other observers, and with validator decisions produces a trust score — and that same score is the
observation's weight in the Bayesian model. The leaderboard is a real quantity inside the science.

**Quests from scientific gaps.** The system knows where data is stale, where satellites show an
unchecked anomaly, and where citizen and satellite readings diverge, and converts these into valued
missions. Targeted sampling as a game mechanic.

**Stream Guardian.** A resident adopts a water body and commits to regular observation, with
attribution on its page. Directly addresses low repeat engagement.

**District leaderboards.** Collective goals alongside individual ones.

**Badges for real contributions** — first to detect a bloom, confirmed a satellite anomaly, recorded
an indicator species, closed a data gap.

**Anti-gaming.** Points award only after validation; geolocation checked; repeat submissions at one
location per day capped; duplicates detected.

### Certificates

**Constraint:** Rivulet must not issue credentials bearing EU, IEEE or OneAquaHealth endorsement
without authorisation — that would be fabricating an official document.

**Approach:** credentials are issued under Rivulet's own name with a structural slot for
institutional co-signing. The pitch position is that the mechanism is built and standards-compliant,
ready for a municipality or the consortium to endorse.

Credentials follow **Open Badges 3.0 / W3C Verifiable Credentials**, compatible with the European
digital credentials framework, each with a public verification page — so the certificate cannot be
forged by editing a PDF.

Tiers: Contributor, Stream Guardian, Data Steward, annual city-level recognition. Statistics are
concrete and verifiable: validated observations, contribution hours, water bodies under
guardianship, anomalies confirmed.

**Highest-value reward:** when an accumulated dataset is published with a DOI, contributing observers
are named in the dataset's contributor list — a real scientific citation.

---

## 12. Screens

1. **Landing page (home).** Startup-style scrolling page: hero with live map backdrop, problem
   framing, three-step explanation, live counters, a "the science behind this" section with
   citations, a One Health diagram, community highlights, open data section, call to action.

2. **City map.** Water bodies coloured by WFD class; toggleable layers for citizen observations,
   satellite readings, One Health risk heatmap, and citizen–satellite divergence. City switcher
   across the five pilot cities.

3. **Water body page.** Current class with credible interval and data confidence, time series with
   uncertainty band, observation feed with photos and Forel–Ule values, citizen-vs-satellite
   agreement panel, risk forecast, and a **"Why this score?"** disclosure exposing inputs, formula,
   method version and sources.

4. **Observation wizard (mobile-first).** Stepwise: location, then photo with **immediate on-screen
   Forel–Ule feedback**, then picture-based plain-language questions, then optional instrument
   readings. Closes with how the observation moved the water body's assessment.

5. **Validation queue.** AI-flagged observations with evidence and reasoning; a human confirms or
   rejects. Inter-observer agreement computed here.

6. **Open data page.** Live FHIR (OAH IG profiles) and Darwin Core exports, plus the public API.

### Display modes

A user-level toggle:
- **Simple (default):** traffic light, one sentence on condition, one sentence on what it means for people nearby.
- **Scientific:** intervals, WFD classes, formulas, method version, citations.

Progressive disclosure is mandatory — scientific depth must never be the first thing a resident sees.

---

## 13. Interoperability and validation

**Exports.** Health-relevant outputs conform to the **OneAquaHealth FHIR IG** profiles (§7).
Biodiversity observations additionally export as **Darwin Core**, the standard behind GBIF and
iNaturalist. Both follow FAIR data principles.

**Method validation.** Our index is compared against official open water-quality measurements for
Coimbra, and the correlation is presented in the UI and the pitch. This is the difference between
claiming a formula works and showing it tracks reality.

**Limitations, stated explicitly.** Photo-derived colour is a proxy, not a measurement. Satellite
pixels are coarse relative to small urban streams. Citizen observations are spatially biased toward
accessible banks. Forecasts are trend extrapolations. These appear in the product and the pitch.

---

## 14. Error handling

Guiding rule: **missing data never becomes good news.**

- No photo — Forel–Ule null, weight reduced, observation still accepted.
- Cloud-covered satellite pass — recorded as unavailable, never as "no divergence".
- Sparse observations — wide credible interval and an explicit low-confidence state.
- Poor GPS — user asked to confirm the nearest water body.
- LLM failure — falls back to rule-based validation; **submission is never blocked**.
- Offline — queued locally, synced on reconnect.

---

## 15. Privacy and GDPR

- Anonymous participation by default; email only for certificates.
- **EXIF metadata stripped server-side** on photo upload.
- Public display snaps position to the water body rather than the observer's exact location.
- Coarse geolocation enforced for accounts flagged as minors.
- Data subject rights implemented: export and deletion endpoints.
- No tracking analytics, no third-party cookies.
- A plain-language data page in the product, and a dedicated pitch slide.

---

## 16. Testing

- **Golden tests** on scoring functions: known inputs to documented outputs.
- Forel–Ule matching verified against the reference colour table.
- **Property tests** on the Bayesian model: more data narrows the interval; conflicting data widens it.
- FHIR output validated against the OAH IG profiles.
- Correlation check against the external reference dataset.
- End-to-end: submit observation, see it on the map, see the index recompute.
- Realistic seed data generator.

---

## 17. Scope discipline

Submissions are penalised harder for half-finished features than for absent ones.

**Must ship, fully working:**
observation wizard with live Forel–Ule feedback; city map with WFD classes; water body page with
credible intervals and "Why this score?"; Bayesian aggregation; simple/scientific mode toggle;
privacy handling; FHIR export conforming to the OAH IG.

**Ship if on schedule:**
satellite layer and divergence engine; One Health risk model and forecast; validation queue; quests
and Trust Score; Darwin Core export; method validation chart.

**Cut without hesitation if at risk:**
certificates and badge issuance; district leaderboards; guardianship mechanics.

Anything unfinished is removed from the interface entirely and presented as future work rather than
left as a dead button.

---

## 18. Submission checklist

- [ ] Track alignment stated explicitly (Track 2 primary)
- [ ] Project description: problem, solution, users, expected ecosystem and health impact
- [ ] Demo video 3–5 minutes, **opening with a resident at a river, not with architecture**
- [ ] Public repository with source and documentation
- [ ] Working prototype at a live URL
- [ ] Positioning slide: complement to the consortium's stack, not a competitor
- [ ] FHIR IG conformance demonstrated live
- [ ] Limitations slide
- [ ] GDPR and ethics slide
- [ ] Method validation chart against official Coimbra data
- [ ] Adoption pathways: schools, municipalities, corporate volunteering, EU youth programmes

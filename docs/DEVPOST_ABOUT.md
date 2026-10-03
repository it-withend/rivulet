# Devpost "About the project", as submitted

The text below is what goes into the **About the project** field (Markdown). Figures were read from the live site and the
database on 2026-10-03. `docs/SUBMISSION.md` holds the rest of the submission material.

```
## Inspiration

Small urban streams are everywhere and almost no one checks them, yet people and dogs touch the water every day. Citizen science can fill the gap, but collecting reports is the easy half. A report on its own is hard to believe and hard to compare, so what a city needs first is an answer to "how far do I trust this?". Rivulet is built around that question: it weighs reports, says how sure it is, and says "insufficient data" when it does not know.

## Track alignment statement

**Primary: Track 2, Data-to-Insight.** Rivulet turns citizen stream observations into interpretable, decision-ready insight: an uncertainty-aware status for each stream, a One Health reading of who and what is exposed, a city report that says where to take care and where a visit would help most, and trends over time.

**Also addresses Track 5 (Community & Gamification):** a private journal with badges, a collection of all 21 Forel-Ule water colours, a leaderboard whose points reward validated, trust-weighted reports and filling data gaps, and signed volunteer certificates. **And Track 7 (Digital Health Standards):** a read-only FHIR R4 endpoint profiled to the OneAquaHealth Implementation Guide and validated with the HL7 validator in CI. It touches Track 3 in a deliberately limited way: an optional AI check flags a photo for a person, and a person decides.

## What it does

A resident photographs the water and answers a few plain questions in **about two minutes, with no account**. The colour is read on the phone on the 21-step Forel-Ule scale, and the full photo never leaves the device. Rivulet then:

- **Checks every report** (GPS accuracy, distance from the stream, rate limits, an optional AI "is this water?" check) and holds doubtful ones for a person to review.
- **Weighs each observer** by how often they agree with others who reported the same stream.
- **Estimates a status** named after the EU Water Framework Directive, with a 90% credible interval, or says "insufficient data". No learned model decides a status; the rules are published on the Method page.
- **Reads warning signs against the places people and dogs use** (playgrounds, schools, parks, dog areas): a One Health reading for people, dogs and wildlife.
- **Maps it.** An interactive map of 4,864 stream sections in six cities (Coimbra, Toulouse, Benevento, Gent, Oslo, Tashkent) with three layers: water health, "Safe to touch?" and a coarse Sentinel-2 satellite check.
- **Writes a city report:** where to take care, and where a visit would help most, with a CSV for each city.
- **Rewards residents.** A private journal, badges with progress, a collection of all 21 water colours, a leaderboard, and a **signed, verifiable volunteer certificate** (Open Badges 3.0, Ed25519, QR code and PDF).
- **Protects them.** A pseudonymous identity, the photo stays on the phone, and each person can download or delete their data.
- **Exports FHIR R4** profiled to the OneAquaHealth guide through a read-only endpoint.

It installs as an offline-capable app: a report written without signal waits on the phone and is sent, with its true time, when the connection returns.

## How we built it

Next.js 16 (App Router, TypeScript strict), React 19, Tailwind CSS 4, MapLibre GL, Supabase (Postgres, PostGIS, row-level security with column grants), Zod, pdf-lib, Ed25519 signatures, an optional Groq vision model for the photo check, GitHub Actions and Vercel. The science engine and the FHIR mapping are pure functions with **212 unit tests**. On every change, a workflow builds the OneAquaHealth guide from source and runs the official HL7 validator on Rivulet's own output: **0 errors**. Every constant in the model is either a cited standard or a declared, uncalibrated prior, published live on the Method page. Automated axe-core checks found no WCAG A/AA violations on ten key pages at desktop and phone width (an automated test, not a full audit).

## Challenges we ran into

- **Honest science with little data.** We refused to invent calibration, so each constant is labelled and the model says "insufficient data" instead of guessing.
- **Thin streams, coarse pixels.** Most urban streams are narrower than a 10 m Sentinel-2 pixel, so the satellite check stays grey for most of them, and we say so.
- **A standard that is still moving.** The guide is a draft with no published package. We build it from source, and the validator found real defects in our first export, which we fixed.
- **Speed.** The first map took seconds per city switch. It now renders at once, caches city data at the edge and swaps only the line data on the map.

## Accomplishments that we're proud of

- A deployed prototype covering the whole path: report, review, trust, estimate, One Health, map, city report, certificate, FHIR.
- A read-only FHIR endpoint validated in CI against the OneAquaHealth guide.
- A model that shows its uncertainty and its method instead of hiding them.
- A signed, verifiable volunteer certificate that anyone can check from a QR code.
- Six cities mapped with their streams and canals, 4,864 stream sections in all.

## What we learned

The hard problem in citizen science is not collecting but qualifying: who to believe, and how to say "we do not know yet" in a way people can act on.

## Scale and integration

Adding a city is a short seeding run (stream geometry and nearby places come from OpenStreetMap), which is how we reached six. City data is cached at the edge, and the FHIR and CSV exports let a city's existing systems consume the results. We have not yet tested beyond a pilot-sized load.

## Honest limits

- Rivulet is indicative, not a laboratory, regulatory or public-health assessment; nothing here says water is safe.
- Class limits are priors, not calibrated ecological quality boundaries; colour from a phone is an uncalibrated proxy.
- Trust is peer agreement, not truth. The model is not yet validated against independent measurements.
- Coimbra's observations are synthetic demonstration data, tagged HTEST in FHIR and marked DEMO on the leaderboard. The **real reports are 12, all from one observer** (Tashkent 6, Coimbra 4, Benevento 2). We claim no traction.
- Not endorsed by the EU, IEEE or the OneAquaHealth consortium.

## What's next for Rivulet

A pilot that tests the model: choose a city and streams with a partner, recruit volunteers, and compare Rivulet's estimates and trust with independent measurements from the OneAquaHealth field protocols. Then calibrate or retire the priors and measure usefulness to city services. Success would be repeat participation, the share of streams with a fresh report, the share of raised warnings that independent checks confirm, and the time and cost of a useful check.

## Try it in three minutes

Open the live map, choose Tashkent or Coimbra and switch between the three layers. Open the City report, then a stream page. Open Open data to follow the live FHIR examples, and Method to see every constant.
```

## Built with

`nextjs`, `react`, `typescript`, `tailwindcss`, `supabase`, `postgresql`, `postgis`, `maplibre`, `fhir`, `hl7`,
`openstreetmap`, `sentinel-2`, `groq`, `vercel`, `github-actions`, `vitest`, `zod`, `pwa`, `open-badges`

## Try it out links

1. https://rivulet-xi.vercel.app
2. https://github.com/it-withend/rivulet
3. https://rivulet-xi.vercel.app/method
4. https://rivulet-xi.vercel.app/open-data
5. https://github.com/it-withend/rivulet/tree/fhir-validation-report

## Image captions (Devpost allows 140 characters)

| Image | Caption |
|---|---|
| Cover | Rivulet: how far to trust a citizen report on an urban stream. |
| Poster | How a report becomes a status: checked, trust-weighted, estimated with a 90% interval, read for One Health, exported as FHIR. |
| Homepage | Home: the 21-step Forel-Ule water colour scale, real report counts apart from demo data, 4,864 stream sections in six cities. |
| Map | Map of Coimbra: colour by water health, "Safe to touch?" or satellite check. Tap a stream for its status or to add a report. |
| City report | City report: where to take care (warning signs near playgrounds, schools, dog areas) and where a visit would help most. |
| Method | Method page: every step and constant, cited or declared as an uncalibrated prior. No learned model decides a status. |
| Open data | Open data: a read-only FHIR R4 endpoint profiled to the OneAquaHealth guide, plus CSV, with live example links. No key needed. |
| Report form | Report a stream in about two minutes, no sign-up. The colour is read on the phone; the full photo never leaves it. |
| Journal | Journal: your impact and a pseudonymous profile, with the option to download or delete your data at any time. |
| Certificates | Signed volunteer certificates with progress, and a collection of all 21 water colours. |
| Leaderboard | Leaderboard: points reward validated, trust-weighted reports and filling data gaps. Demo observers are labelled DEMO. |
| Stream page | A stream page: status and certainty, who and what is exposed (people, dogs, wildlife), and how it has changed. |

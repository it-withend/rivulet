# Demo video script (3 to 5 minutes)

The hackathon asks for a 3–5 minute video that shows the project working. Target **4:30**. Film the screen with a phone
frame for the report step if you can; record voice separately for a clean track. Speak plainly and slowly; do not read the
screen.

**Before recording:** open the live site in a fresh browser profile; have Tashkent and Coimbra loaded; be near a real stream
if you can (a real report at the water is the strongest 20 seconds in the video); close other tabs; set the window to
1920×1080; check that `RIVULET_MODERATOR_TOKEN` and `GROQ_API_KEY` are set on Vercel.

## Verified against the live site (2026-10-02)

Use these exact pages. Labels below are the ones on screen today.

| Shot | Open | What it shows today |
|---|---|---|
| Map | `/map?city=Coimbra` | Layers *Water health*, *Safe to touch?*, *Satellite check*; city tabs Coimbra, Toulouse, Benevento, Gent, Oslo, Tashkent |
| Stream, One Health | `/water/8a823a1f-5385-4052-97ac-121832042c38` (Rio Mondego, Coimbra) | Named river with a bathing spot 9 m away, a park 86 m away; algae in 56% of 4 recent reports. Two of its 10 reports are real, the rest are demo data |
| Real data | `/city?city=Tashkent` | 581 stream sections, 5 reports in the last 30 days, 1 person reporting. "Джун" is flagged *Take care*, with a school 8 m away |
| City report, scale | `/city?city=Coimbra` | 578 sections, 599 reports, 46 people: **all demonstration data**, say so |
| Report form | `/observe` | Has a no-location path, *Just curious? Read the colour of any water*; use it at a desk, the full report needs a GPS fix |
| Moderation | `/moderate` | Asks for a passphrase (masked). Show the page text and the pipeline diagram; do not show the passphrase or the queue contents |
| Certificate | `/certificates/0b4911ba-1449-400f-9a28-3b3576a45906` | Loads, PDF downloads (`/api/certificates/<id>/pdf`) |
| FHIR | `/open-data`, then `/fhir/Location?city=Tashkent&_count=1` | Live Bundle; validation report on the `fhir-validation-report` branch |

**Two things to avoid or explain on camera**

- Do not open the stream that `/open-data` links to as its example (`/water/303820be-c065-4dea-ad28-17c4287e3826`, an unnamed
  Coimbra stream): it reads *Healthy* while its One Health block lists sewage smell, algae and chemical smell. The status is
  built from all of a stream's history; the One Health reading uses only the last 30 days. It is explainable but looks like a
  contradiction in a 5-second shot.
- Rio Mondego reads *Healthy* and *Avoid contact with the water* together, for the same reason. If you use it, say it: "overall
  condition is healthy, but recent reports raise a warning near a bathing spot".

**Before you press record:** open `/city`, `/leaderboard` and the map for the city you will show a few minutes earlier. The
first visit after a quiet period took 5 to 6 seconds; repeat visits are under two seconds. Real reports are all from 15 and
16 September; they stay in the "last 30 days" figures until about 15 October.

| Time | On screen | Say (the meaning, in your words) |
|---|---|---|
| 0:00–0:25 | You at or beside a stream, then the phone | "There are thousands of small streams in our cities that nobody checks. People notice when something is wrong, but a report on its own is hard to trust and hard to compare. Rivulet is the layer that says how far to trust a report and where to look next." |
| 0:25–1:00 | `/observe` on the phone: pick the stream, take the photo, answer the questions, send | "Two minutes, no account. The colour is read on the phone on the Forel–Ule scale; the photo itself stays on the device." Show the result: what changed for the stream. |
| 1:00–1:40 | The `/moderate` page (passphrase field, no queue shown), then the pipeline diagram from the README | "Before a report counts we check GPS, distance from the stream, how many that hour, and optionally whether the photo is water. Doubtful reports wait for a person. Each observer earns trust from agreement with others." |
| 1:40–2:20 | A stream page: status, credible interval, "Why this score?" | "A Bayesian model turns the weighted reports into a status with a 90% credible interval. With too little data it says *insufficient data*, never good news." Open `/method`: "Every constant is a cited standard or a declared prior." |
| 2:20–3:00 | `/map`: switch city, then *Safe to touch?* and *Satellite check*; tap a stream | "Colour layers switch instantly. *Safe to touch?* reads warning signs against the playgrounds, schools and dog areas nearby. The satellite check is a coarse second opinion, and most streams stay grey — that is honest." |
| 3:00–3:30 | `/city` | "For a city or a school: where to take care, and where a visit would help most. These are the actions the data supports." |
| 3:30–4:05 | `/open-data`, then a live FHIR link, then the GitHub validation report | "Everything leaves as FHIR, profiled to the OneAquaHealth guide. On every change, the official HL7 validator checks our output against the guide: zero errors." |
| 4:05–4:30 | The certificate, then the limits line | "Volunteers get a signed, verifiable certificate. Rivulet is indicative, not a laboratory or public-health assessment; the reports in Coimbra are synthetic demonstration data; and we are looking for a partner to test the model against independent measurements." |

## Rules for the recording

- **Say what is synthetic.** Coimbra is demonstration data; Tashkent has real reports. Never present demo data as findings.
- **Do not overclaim.** No "official", "certified" or "endorsed" about the science, FHIR or the certificate.
- **Show, do not scroll.** One clear action per shot; pause a second on each result.
- **Keep the numbers you say true.** Read them off the live site the day you record (reports, streams mapped).
- **Subtitles.** Add English subtitles; judges may watch without sound.

## Shot list for b-roll (optional)

A stream close-up; the phone taking the photo; the Forel–Ule ribbon in the header; the certificate QR being scanned.

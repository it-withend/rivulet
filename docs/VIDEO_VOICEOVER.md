# Video voiceover (about 4 minutes)

About 460 words, which is 3.5 minutes of speech; the pauses while the screen changes bring it to about 4. Read it aloud at a
calm pace, about 130 words a minute. The screen column says what to show while you speak; every page below
was opened and checked on 2026-10-03. Say the numbers as written here: they do not move with the clock.

| Time | On screen | Say |
|---|---|---|
| 0:00 | A stream (photo or b-roll), then the phone | There are thousands of small streams in our cities that nobody checks. Residents notice when something is wrong, but a single report is hard to trust and hard to compare. Rivulet is the layer that says how far to trust a report, how sure we are, and where to look next. |
| 0:25 | Phone screen: `/observe`, then the colour reading ("Just curious? Read the colour of any water") | A report takes about two minutes, with no account. You pick the stream, take a photo and answer a few plain questions. The colour of the water is read on your phone against the 21-step Forel-Ule scale, and the full photo never leaves the device. If there is no signal at the stream, the report waits on the phone and is sent, with its true time, when you are back online. |
| 1:00 | The README pipeline diagram, then `/method` | Before a report counts, we check it: GPS accuracy, distance from the stream, how many reports that hour, and optionally whether the photo really shows water. Anything doubtful waits for a person. Each observer then earns trust from how often they agree with others who reported the same stream. That trust is agreement, not truth, and we say so. |
| 1:40 | `/water/8a823a1f-5385-4052-97ac-121832042c38` (Rio Mondego), open "How we work this out" | A Bayesian model turns the weighted reports into a status named after the EU Water Framework Directive, with a ninety percent credible interval. With too little data it says insufficient data, never good news. No learned model decides a status: every constant is a cited standard or a declared prior, listed on the method page. This river reads healthy overall, but recent reports near a bathing spot raise a warning, because the status uses the whole history and the One Health reading only the last thirty days. |
| 2:20 | `/map?city=Coimbra`: switch the three layers, tap a stream | On the map, switch the colours: water health, Safe to touch, and a satellite check. Safe to touch reads warning signs against the playgrounds, schools and dog areas within a hundred and fifty metres. The satellite is only a coarse second opinion, and most streams stay grey, because most are narrower than a pixel. Six cities, almost five thousand stream sections. |
| 3:00 | `/city?city=Tashkent`, then `/city?city=Coimbra` | The city report says where to take care and where a visit would help most. In Tashkent, a real report flags a stream beside a school. Coimbra is demonstration data, and every demo report is labelled as such. |
| 3:30 | `/open-data`, then a live FHIR link, then the validation report on GitHub | Everything leaves as FHIR, profiled to the OneAquaHealth guide. On every change, the official HL7 validator checks our output against the guide: zero errors. A city can also download its data as a spreadsheet. |
| 4:05 | `/journal` (badges, colour collection), then the certificate | Residents get a journal, badges, a collection of all twenty-one water colours, and a signed volunteer certificate that anyone can verify from a QR code. Rivulet is indicative, not a laboratory assessment. Coimbra's reports are synthetic; the real ones number twelve. We are looking for a partner to test the model against independent measurements. Thank you. |

## Before you record

- Use a fresh browser profile, window 1920x1080, other tabs closed, browser zoom 100%.
- Open `/city`, `/map` and `/leaderboard` a few minutes earlier so the first view is quick.
- Do not show the moderator passphrase. The `/moderate` page can appear for a second without the queue.
- Record the phone part with the phone's own screen recorder.

## After you record

1. Upload to YouTube as **Public** or **Unlisted**, not "made for kids".
2. In YouTube Studio, open Subtitles, choose Add, then "Auto-sync", and paste the "Say" column as plain text. This gives English subtitles in the right places without timing them by hand.
3. Open the link in a private window and check that it plays without signing in. Paste that link into Devpost.

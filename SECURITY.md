# Security policy

Rivulet is a student hackathon prototype (IEEE OneAquaHealth Global Hackathon 2026), not a production
service, but it does handle real requests from real people, so we take reports seriously within that scope.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security report. Instead, email the maintainers (see
the repository's contributors) or reach out through the contact on the Devpost submission, with:

- What you found and where (URL, endpoint, or file and line).
- Steps to reproduce, and the impact you believe it has.
- Whether you have already disclosed it elsewhere.

We aim to acknowledge a report within a few days and to fix confirmed issues before the next deploy. We
have no bug bounty; we do credit reporters, if they want that, once a fix ships.

## Scope

In scope: the deployed application at `rivulet-xi.vercel.app` and this repository's code.

Known, deliberate limits (not vulnerabilities): there are no user accounts (an observer is a
browser-held pseudonymous token); moderation uses a single shared passphrase, appropriate for a
two-person pilot and stated as such in the README; the FHIR endpoint is read-only and unauthenticated
by design, serving only data that is already public.

## Practices already in place

- Secrets live only in environment variables, never in the repository (`.env.example` carries names,
  never values).
- Row-level security in Postgres, with column-level grants — anonymous reads cannot reach GPS accuracy,
  precise report locations, or moderation fields.
- Certificates are signed (Ed25519) and independently verifiable; a tampered or revoked one is refused.
- Dependencies: `npm audit` is run before each release; see the [CI workflow](.github/workflows/ci.yml).
- A baseline set of security headers (CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) is
  set in `next.config.ts`.

# Security policy

## Reporting a vulnerability

If you've found a security issue in **port** (this repository — the public
frontend that serves <https://dragnet.dev>), please report it privately via
GitHub's [security advisory form](https://github.com/dragnet-dev/port/security/advisories/new).

We aim to acknowledge reports within **3 business days** and to have a fix or
mitigation in place within **30 days** for confirmed issues, depending on
severity. Lower-severity findings (CVSS < 4.0) may be batched into a regular
release.

Please do not open public GitHub issues for security findings, and do not
submit PoCs as PRs.

## What's in scope

This repository (`dragnet-dev/port`) contains:

- The Hono + TypeScript worker code that serves the site
- The static assets and HTML layout it ships
- The `_headers` policy and `wrangler.toml` configuration
- The CI workflows under `.github/workflows/`

The site reads data from a separate public repo,
[`dragnet-dev/haul`](https://github.com/dragnet-dev/haul). Issues with the
*content* of that data (incorrect IOCs, false-positive rules) belong there.
Issues with how port *handles* that data belong here.

## Out of scope

- Findings against `dragnet-dev/haul` data quality — report there.
- Findings against the upstream Cloudflare, Cloudflare Pages, or
  raw.githubusercontent.com infrastructure — report to the relevant vendor.
- Social engineering, physical attacks, or DDoS volume tests.
- Automated scanner output without a demonstrated impact.

## Hall of thanks

A list will appear here once we have something to acknowledge. If you'd
prefer not to be credited, say so when you report.

# Publishing status

2026-10-22

- Public website: https://gridline-indol.vercel.app — anonymous production access verified. FormCheck's existing Vercel account, Hobby plan. No new Render account was needed.
- Repository: https://github.com/terry0524/gridline — public source; connected to Vercel so main-branch pushes trigger production deployment.
- Release data: six SHA-256-pinned GitHub assets. Only normalized historical data, manifest and season seeds are published; no raw archives, captures, credentials or private local paths.
- Historical Replay scope: **2024 Bahrain, Monaco and Belgian/Spa only**. Other calendar races have results/schedules but are not marked Replay available until imported and validated.
- Public Replay endpoints verified: Bahrain20drivers/432,280locations/VER1:32.608L39; Monaco20/684,920/HAM1:14.165L63; Spa20/393,460/PER1:44.701L44. The final fastest laps were computed using the existing RaceState model against actual publicly downloaded replay data. Monaco retains PARTIAL tire-source warnings.
- Public browser:22route/viewport cells at1440and320px, page overflow0, console warning/error0. Home,Schedule,Standings,Results,Race/Driver/TeamDetail,RaceCenter and all3Replay routes rendered. Bahrain Play/Pause/8x and Monaco mobile Track/Seek End checked. This is browser emulation, not a physical-device claim.
- Season API:2024and2026 responses checked;2026round17and23GPs. Serverless background season refresh was verified with a new2026-10-22fetchedAt and stale=false; original seed timestamps are not rewritten.
- Runtime: existing UI, data normalization and replay renderer retained. Vercel uses static CDN replay delivery and a Node Function wrapping the original HTTP handler, writable per-instance temporary cache, and official waitUntil for background season refresh. Standalone Node deployment/collector remains supported.
- Security checks: anonymous API and deep-link access; capture/developer endpoints403; actual Live start403; foreign POST origin403; .env.local/server.js404; npm audit0vulnerabilities. Local regression47/47, no skips; syntax check passed.
- Public Live acquisition remains disabled. Active-session continuous timing, free Position/telemetry, audio access/public-use conditions and singleton collector hosting remain unverified. Existing local collector/capture/simulation tools are preserved. No active F1 session was tested.
- Cost: existing Vercel Hobby plan. No paid compute/storage, custom domain or API subscription purchased. Platform free usage limits apply; no unlimited/always-on Live guarantee is claimed.

Evidence: docs/qa/publishing/vercel/{qa.json,public-api.json,tests.log,syntax.log,audit.json,*.png}. GitHub CI restores normalized assets and checks capture/live/season/hosting tests; the full local regression also uses the unpublished raw provenance archive.

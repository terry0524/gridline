# Server deployment

GRIDLINE needs one long-running Node.js process for the collector, SSE fanout and caches. A static GitHub Pages deployment does not provide these functions. The existing frontend/domain/replay models are preserved.

## Render

[Deploy GRIDLINE](https://render.com/deploy?repo=https://github.com/terry0524/gridline) imports render.yaml. Sign in to your own Render account, confirm the Free plan, then deploy. No API key or paid OpenF1 subscription is required. A hosting login/terms decision must be completed by the owner; creating the GitHub repository is not proof of a live site.

The blueprint uses Node22, HOST=0.0.0.0, the platform PORT and exact RENDER_EXTERNAL_HOSTNAME/URL allowlisting. /healthz performs a lightweight process check without starting a Live connection. POST Origin checks and developer endpoint restrictions remain enabled. Custom domains require GRIDLINE_PUBLIC_URL=https://your-domain.example.

The startup command verifies/restores six immutable, SHA-256-pinned historical assets from the replay-data-v4 GitHub release. They contain the three actual normalized replays, the manifest, and season seed data. They exclude raw captures, raw upstream archives, credentials and local filesystem paths. Runtime data refresh uses the existing providers; old seed data keeps its original fetchedAt and is refreshed rather than presented as newly fetched.

The Free plan can sleep after15minutes without traffic and has an ephemeral filesystem. The next visit may need a cold start. Historical assets are restored after restart; captures and later manual imports are not durable on the Free plan. Long-running Live/production guarantees are not claimed. A persistent disk/always-on plan is a separate paid decision and is not enabled automatically. Check [Render's current free-plan limits](https://render.com/docs/free).

GRIDLINE_LIVE_ENABLED=0 and GRIDLINE_AUTO_LIVE=0 are the initial public release preset. The existing local collector, simulation and capture tooling remain available in the source. Enable public Live only after actual-session and source-use verification; changing hosting must not be described as validating the live feed.

## Local/public-origin smoke test

```sh
npm ci
npm run check
npm test
HOST=0.0.0.0 GRIDLINE_PUBLIC_URL=https://your-domain.example NODE_ENV=production npm start
```

Without HOST, local development still binds127.0.0.1. No wildcard host/origin bypass is used. Docker/static-only rewrites are not required.

## Regression data

The original44tests include checks against local raw upstream response archives. The source repository intentionally excludes .cache and captures. CI restores the normalized Replay seed assets, then runs the24capture/live/season tests plus hosting tests, and syntax validation. For full44+hosting replay provenance tests, use the original verified local archive. `npm run import-replay -- --year 2024 --round 8` can independently collect a race, but later provider corrections can change the pinned historical counts/hashes.

GitHub release bootstrap is for running the site and does not claim to recreate the excluded raw-response provenance archive. Current test results and public deployment verification are documented separately in PUBLISHING_STATUS.md.

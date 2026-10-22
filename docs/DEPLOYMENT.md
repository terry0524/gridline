# Server deployment

Public site: https://gridline-indol.vercel.app (Vercel Hobby, using the existing FormCheck hosting account). The existing frontend/domain/replay models are preserved. A single Vercel Daemon now runs the original collector; the HTTP Function reads shared snapshots and fans them out over SSE. The original standalone Node deployment remains supported.

## Vercel — current public deployment

No new Render account is required. `vercel.json` runs `node scripts/build-vercel.js`, which produces the official Build Output API layout. The build restores six SHA-256-pinned historical assets into a temporary directory. It publishes the existing allowlisted frontend files and three unchanged replay datasets through the CDN. Large Replay responses bypass Function body-size limits by using static CDN files at the existing `/api/replay/<sessionKey>/data` URLs. No raw archives/captures or local credentials are copied.

The remaining APIs reuse `server.js`'s exported request handler. Standalone `npm start` still starts the original Node server. Each Vercel Function gets a writable `/tmp` cache seeded with the verified release assets. Official `@vercel/functions` `waitUntil` keeps existing season refresh work alive after a response. `fetchedAt` and stale flags are preserved; unavailable providers keep the existing partial/error states. The temporary cache is per instance and is not durable shared storage.

Only platform-provided exact hostnames are allowed. Debug, capture endpoints and simulation controls stay disabled in the public adapter. Production Live uses one configured timing-collector Daemon in iad1. It publishes normalized snapshots through an authenticated internal ingress into a namespaced regional runtime cache; HTTP Function instances only read/fan out this state and never create a new F1 connection per viewer. In steady state, ten viewers share one upstream collector. A rollout may briefly overlap old/new workers; SIGTERM closes the old connection. Actual active-session continuous-feed verification remains separate; no fake Live data is substituted.

```sh
npm ci
npm run check
npm test
npx vercel login # existing account, only when the CLI session expired
npx vercel deploy --prod --yes
```

The GitHub repository is connected to the Vercel project, so main-branch pushes trigger production deployment. `.vercel/` and `.env*` are ignored. Do not commit CLI credentials or Vercel OIDC values. Preview deployment URLs can require Vercel login; use the public production alias above.

### Hosted Live

`Dockerfile.live` runs the existing Node22 collector without raw capture. Daemons are available on Hobby within its quota, so no extra hosting account was created. The source remains the undocumented anonymous F1 SignalR Core endpoint, not paid OpenF1 Live. An internal `GRIDLINE_LIVE_BRIDGE_SECRET` is stored only in Vercel production and the operator's ignored private local cache; it is an application relay credential, not an F1 subscription/key. Never commit it or pass it to a browser.

Snapshots are compressed before shared-cache storage. Active sessions publish about once per second; inactive sessions publish a heartbeat once per minute. Cache TTL is240seconds. Missing heartbeats mark retained data RECONNECTING/OFFLINE, and old session timestamps are never rewritten as fresh TimingData. SSE closes cleanly at270seconds before the300second Function limit; EventSource reconnects while retaining the last displayed state. Clients are removed on response close. Preview deployments do not run a Daemon or share production cache.

Hobby quotas apply (including Daemon Active CPU and Function/cache/network usage). No Pro upgrade, payment plan or paid API was activated. Exceeding a quota can pause the feature; this is not an unlimited/always-on guarantee. Runtime cache is ephemeral: eviction/missing data must show waiting/unavailable. Store namespaces keep GRIDLINE state separate from other projects in the Hobby team.

### Expanding historical library

The original three snapshots stay as pinned bootstrap assets. Additional GP/Sprint sessions are collected sequentially by `.github/workflows/replay-library.yml`, validated, then uploaded as normalized gzip assets to the `replay-library-v1` release. Its index is updated only after an asset upload succeeds. The website merges this library into the existing manifest at runtime; a race addition does not require another full website build. A missing library index must not overwrite an existing published index with an empty one.

Additional Replay downloads are size/hash checked, cached in the Function's writable temporary directory and validated against their session identity before use. Large JSON responses stream through the existing API URL; the three bootstrap datasets remain on the CDN. No browser calls OpenF1 directly or re-fetches raw hundreds-of-thousands-row archives per replay. Old local raw archives remain untouched. Failed imports are logged in the workflow progress artifact and are not advertised as available.

Official references: [Build Output API](https://vercel.com/docs/build-output-api), [waitUntil](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [Function limits](https://vercel.com/docs/functions/limitations), [Daemons limits/Hobby quota](https://vercel.com/docs/daemons/limits), [Runtime cache](https://vercel.com/docs/caching/runtime-cache).

## Render — optional original Node hosting

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

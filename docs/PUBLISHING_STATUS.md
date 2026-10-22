# Publishing status

2026-10-22

- Public site: https://gridline-indol.vercel.app; repository: https://github.com/terry0524/gridline. Existing Vercel Hobby account, no new hosting account or paid OpenF1 Live subscription.
- Historical library: expands from2023to current ended GP and Sprint sessions. Only normalized, validated assets appear in the runtime manifest. The original Bahrain/Monaco/Spa snapshots remain pinned. The current count is returned by `/api/replay/manifest`; unfinished/invalid sessions are never advertised as AVAILABLE.
- Replay import: sequential/throttled OpenF1 fetch, official-result/session matching, validation, indexes, versioned gzip cache, SHA-256, GitHub release upload and library index update. GitHub Actions resumes published sessions and runs weekly after race weekends. No raw archives or credentials are published.
- New large Replay delivery was checked against the public API:6,341,536compressed bytes,28,589,750JSON bytes,22drivers,1,004,344observed locations; PARTIAL source warnings retained. This verifies large streamed response delivery, not GPS precision.
- Public Live: the previous deployment-disabled403has been removed. One Vercel Daemon runs the existing anonymous SignalR collector; Functions read compressed shared cache and fan out via SSE. An authenticated internal ingress keeps the producer credential out of browsers.
- Actual source connection and ended-session snapshot confirmed:22drivers, sourceInstances1/upstreamConnections1, NO ACTIVE SESSION. Browser Timing connect succeeded with no old disabled error or console warnings/errors. Position/telemetry capabilities were false and no positions/telemetry were fabricated.
- Active-session continuous Live feed, free actual Position/CarData and radio audio remain unverified. No active F1 session was tested. Radio metadata only; raw capture stays off in production.
- Regression:52/52local tests, no skips, syntax passed. The original Bahrain provenance test now opens only its exact hashed source archives rather than retaining every newly imported race in memory. All existing data assertions remain. The prior2026-empty-catalog assertion now checks the catalog against the actual manifest because2026replays exist.
- Vercel functions use exact Host/Origin allowlisting, streamed large Replay responses, bounded payloads and cache reads, SSE cleanup and270second reconnect leases. Inactive collector heartbeats are throttled; free-plan quotas can pause service. No Pro upgrade, payment plan, paid API or extra storage service was activated.

Detailed deployment/runtime limits: DEPLOYMENT.md. Existing publishing QA and original raw provenance archives remain preserved. Additional import progress is available in the Import historical replay library workflow and its progress artifact.

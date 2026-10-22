# Publishing status

2026-10-22

## Completed library expansion

The public manifest contains **111 sessions: 87 Grand Prix races and 24 Sprints**.

| Season | GP races | Sprints |
| --- | ---: | ---: |
| 2023 | 22 | 6 |
| 2024 | 24 | 6 |
| 2025 | 24 | 6 |
| 2026, completed as of this check | 17 | 6 |

The resumed cloud import finished successfully at 2026-10-22 11:35:32 UTC: 73 additional sessions, zero failed imports and zero ambiguous/unmatched result/session pairs. Together with 35 earlier imports and the three unchanged bootstrap snapshots, all 111 are present in the public API. Each cache passed automated source/schema/timeline/coordinate validation; this does not mean every session was manually watched in a browser.

Quality: 51 VALID, 60 PARTIAL, zero INVALID exposed. PARTIAL warnings remain attached to the session: excluded malformed source rows, missing endpoint/time windows, DNS/retired driver timelines, or source/classification discrepancies. The fastest-lap discrepancy flags on 2026 Australia and 2025 China are retained; historical timing is not silently rewritten as the official final result. The 2023 Singapore GP and Azerbaijan Sprint also retain driver/classification count warnings. Both timing and position capabilities exist for all 111; other capabilities are session dependent.

2023 onward is the supported OpenF1 historical range. Cancelled/unrun races and sessions without published results were excluded. No invented pre-2023 position data, paid Live subscription or authentication bypass was introduced.

- Public site: https://gridline-indol.vercel.app; repository: https://github.com/terry0524/gridline. Existing Vercel Hobby account, no new hosting account or paid OpenF1 Live subscription.
- Historical library: expands from2023to current ended GP and Sprint sessions. Only normalized, validated assets appear in the runtime manifest. The original Bahrain/Monaco/Spa snapshots remain pinned. The current count is returned by `/api/replay/manifest`; unfinished/invalid sessions are never advertised as AVAILABLE.
- Replay import: sequential/throttled OpenF1 fetch, official-result/session matching, validation, indexes, versioned gzip cache, SHA-256, GitHub release upload and library index update. GitHub Actions resumes published sessions and runs weekly after race weekends. No raw archives or credentials are published.
- New large Replay delivery was checked against the public API:6,341,536compressed bytes,28,589,750JSON bytes,22drivers,1,004,344observed locations; PARTIAL source warnings retained. This verifies large streamed response delivery, not GPS precision.
- Public Live: the previous deployment-disabled403has been removed. One Vercel Daemon runs the existing anonymous SignalR collector; Functions read compressed shared cache and fan out via SSE. An authenticated internal ingress keeps the producer credential out of browsers.
- Actual source connection and ended-session snapshot confirmed:22drivers, sourceInstances1/upstreamConnections1, NO ACTIVE SESSION. Browser Timing connect succeeded with no old disabled error or console warnings/errors. Position/telemetry capabilities were false and no positions/telemetry were fabricated.
- Active-session continuous Live feed, free actual Position/CarData and radio audio remain unverified. No active F1 session was tested. Radio metadata only; raw capture stays off in production.
- Regression: 54/54 local tests, no skips, syntax passed. The original Bahrain provenance test now opens only its exact hashed source archives rather than retaining every newly imported race in memory. All existing data assertions remain. The prior 2026-empty-catalog assertion now checks the catalog against the actual manifest because 2026 replays exist.
- Vercel functions use exact Host/Origin allowlisting, streamed large Replay responses, bounded payloads and cache reads, SSE cleanup and270second reconnect leases. Inactive collector heartbeats are throttled; free-plan quotas can pause service. No Pro upgrade, payment plan, paid API or extra storage service was activated.

Detailed deployment/runtime limits: DEPLOYMENT.md. Existing publishing QA and original raw provenance archives remain preserved. Additional import progress is available in the Import historical replay library workflow and its progress artifact.

## Public browser / transport checks

- 2026 Singapore GP: 22 drivers, 537,064 observed locations; lap 20 deep link, 8× playback and end seek checked. End fastest lap: LEC, 1:35.202, lap 41.
- 2026 Singapore Sprint: 22 drivers, 387,904 locations; end seek, timing, positions, tires/pit, fastest lap and weather rendered.
- 1440 / 1024 / 320px Race Center: no page-level horizontal overflow; mobile Timing/Track switching checked. Browser warning/error logs: none. Screenshots: `docs/qa/expansion/`.
- Ten simultaneous public SSE clients received HTTP 200, the same collector generation and 22 drivers. A separate connection ended cleanly after 271.2s (270s lease + network overhead), received 273 state frames, then reconnected with HTTP 200 and 22 drivers. This validates transport with an ended-session snapshot, not an active racing feed.
- Late driver/track/session metadata forwarding has a regression test; empty startup states do not replace the preceding shared snapshot.
- Index replacement retries bypass cached redirects to deleted release assets. The last verified library remains usable during a transient publication failure.
- 2025 Monaco: 20 drivers, 477,660 observed locations; lap 40 deep link rendered, 20/20 markers, no overflow or console warnings/errors.
- 2023 Abu Dhabi: 20 drivers, 426,260 observed locations; lap 45 deep link and end seek rendered, 20/20 markers, VER 1:26.993 / lap 45 fastest lap, session weather, no overflow or console warnings/errors. All four imported seasons appeared in the selector.

# 2026 Mexico City GP — resident UTC verification

Source checked: https://www.formula1.com/en/racing/2026/mexico

| Session | Official UTC start | Korean start | Observation starts KST |
| --- | --- | --- | --- |
| FP1 | Oct 30 18:30Z | Oct 31 03:30 | Oct 31 03:32 |
| FP2 | Oct 30 22:00Z | Oct 31 07:00 | Oct 31 07:02 |
| FP3 | Oct 31 17:30Z | Nov 1 02:30 | Nov 1 02:32 |
| Qualifying | Oct 31 21:00Z | Nov 1 06:00 | Nov 1 06:02 |
| Race | Nov 1 20:00Z | Nov 2 05:00 | Nov 2 05:02 |

## What changed after the missed US GP checks

The existing single Vercel collector daemon runs an independent one-second UTC clock check. `src/live/verification-plan.js` holds explicit ISO instants ending in Z. A local Codex wake-up or queued GitHub runner does **not** trigger collection. The daemon starts the existing production-SSE observer for 15 minutes at the scheduled instant, without adding an F1 upstream connection. No changes to frontend, Replay data, parser or RaceState are needed.

Each task records `scheduledAt`, `actualStartedAt`, `delayMs`, progress, source timestamp advances, timing changes, capabilities and the final verdict. A restart restores completed checks; an interrupted observation is recorded as interrupted and never treated as continuous. If the remaining window cannot provide ten minutes, it records MISSED / NOT_VERIFIED. An unverified observation may retry once if another complete window remains. Timing in UTC / Asia/Seoul / America/Los_Angeles is tested, including the November date boundary.

On each daemon boot a separate 20-second transport drill is scheduled 60 seconds ahead through the same clock. It records actual start delay, HTTP status and real SSE receipt times. Its verdict is always transport-only or failure; it cannot prove active Live. Unit-test clocks/fixtures are not actual-session evidence.

## Evidence and delivery

Public status: https://gridline-indol.vercel.app/api/live/verification

This shows the deployed plan digest, future session instants/KST display, resident heartbeat, drill and session results. READY requires a recent daemon checkpoint. DONE means all session tasks have terminal records, not that every record passed.

The daemon saves local checkpoints and posts bounded, credential-free checkpoints through the existing private relay credential. A separate compressed runtime-cache namespace retains results for up to 30 days. This cache and daemon disk are ephemeral; neither is a durability guarantee. `Export Mexico GP verification evidence` copies the returned report into 30-day GitHub artifacts after each session. Export can run late without changing collection time. Its green status means export succeeded, not that Live was verified; read the individual verdicts. The original US-GP collection workflow remains disabled.

Only allowlisted normalized evidence is retained, approximately one proof sample per minute plus aggregate counters; no raw SignalR frames, cookies/tokens, radio URLs or audio. Position/telemetry must contain fresh actual values. A missing capability only describes that observation window. Browser/TV comparison, paid service access, permanent free-source availability and full-race stability are not implied by a 15-minute observation.

Codex may review the final stored report once after the weekend. Its notification can wait for the app to run; collection does not depend on that notification. After the final tasks the resident checker stops scheduling new work, and the one-off export workflow is disabled during final review.

## Operational boundary

Hosting outage, quota exhaustion, process downtime covering a session, an official timetable change, or loss/eviction before backup can still prevent a complete observation. These must be recorded honestly, not backfilled with replay or stale data. No paid plan, additional account, new provider key, F1TV authentication or DRM bypass is introduced. Existing website functionality and the three original replay hashes are preserved.

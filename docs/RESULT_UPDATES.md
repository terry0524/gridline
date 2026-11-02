# Automatic result updates

Implemented 2026-11-02. This is ordinary Node/HTTP application code. It does not call an AI model, consume inference tokens, or create a Codex/GitHub checking automation. Provider request limits and hosting usage still apply. It reuses the existing resident Live collector and existing relay credential; no paid OpenF1 Live service or additional SignalR connection is introduced.

## Flow

- `deploy/result-monitor.js` observes the existing collector. A fresh active session must have actually been observed before an explicit `Ends` / `Finished` / `Finalised` transition can save a provisional result. An ended snapshot seen only after a restart is insufficient. Qualifying `Ends` alone is insufficient. Aborted sessions and simulated/replay states are excluded.
- The provisional record contains only observed timing fields. Grid and awarded points stay unavailable. It is visibly labelled provisional; it never contributes points to championship progression.
- `src/result-sync.js` checks only due Race/Sprint/Qualifying round endpoints. Near an expected finish it may check whether results have been published without asserting that the session has ended. During the first six hours from scheduled start, pending results are checked every minute; then every five minutes until 24 hours, then every 30 minutes for seven days. Published results are checked every five minutes for the first six hours, every 30 minutes until 24 hours, then every six hours for seven days. Errors use exponential backoff. Schedule/identity information refreshes every six hours.
- If Jolpica has no result, an optional OpenF1 lookup runs at most once per target per five minutes. Only a unique, non-cancelled session with an ended historical access window (existing 30-minute safety boundary) is eligible. Actual `session_result` payloads supply classification, qualifying segments and any published points present; missing fields stay unavailable. Label: OpenF1 result, awaiting Jolpica comparison. No paid endpoint authentication is attempted.
- Published Jolpica results supersede provisional/OpenF1 records. Driver/constructor standings and previous-round changes are fetched from published standings, not calculated from provisional positions. A missing earlier round truncates the cumulative chart before that gap, rather than plotting an incorrect cumulative total. Newer ordinary provider responses continue to supersede older monitor records after the focused monitoring window ends.

## Sharing and persistence

The single daemon submits bounded, allowlisted normalized records through authenticated `/api/internal/results-ingest`. No raw frames, cookies, tokens, radio metadata/audio or arbitrary URLs are stored here. `/api/results/{year}` and `/api/results/{year}/revision` are read-only. Browser revision checks read shared cache, never start upstream polling; ten browsers do not create ten result monitors. An open ordinary page checks revisions every 15–60 seconds and updates Home/Results/Standings from the shared revision. Existing Replay rendering is independent.

Production uses the existing Vercel Runtime Cache in a separate `gridline-results-v1` namespace (30-day TTL) plus a local daemon checkpoint. Both are ephemeral; they are not a permanent database. Published records can be restored from providers. A provisional record may be unavailable if the collector missed the live finish or all checkpoints were lost. Last valid results survive optional provider failures; older checkpoints cannot downgrade a published result. No fixed publication latency is guaranteed when providers or hosting are unavailable.

## Validation

`tests/fixtures/mexico-result-sources.json` contains actual historical 2026 Mexico Race/Qualifying and United States Race responses with source URLs and observation time. Tests verify source parsing, awarded points, actual-source agreement, end-transition gating, source priority, corrections, missing-round handling, single-flight polling, cadence/backoff, authenticated ingestion and persistence. Controlled end-transition tests are simulations, not evidence that a future actual-session finish has already been observed. Actual production end-transition verification remains for a future session.

Run `npm run check` and `npm test`. No `.env` or external key is required for local tests. Existing historical fixtures/raw provenance requirements remain unchanged.

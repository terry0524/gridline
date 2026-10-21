# Observed protocol fixtures

`observed-core-snapshot.json` is a field projection from the actual anonymous F1 Core snapshot observed 2026-10-12T01:39:24.805Z, session11388 Singapore Race Ends. It preserves22 driver timing/stints and only3 control/radio records. Provenance is embedded. It is not an invented active race or proof of authorization to redistribute F1 data.

`historical-position.z.json` and `historical-car.z.json` are unchanged HTTP200 body strings from the public historical archive:
- https://livetiming.formula1.com/static/2024/2024-03-02_Bahrain_Grand_Prix/2024-03-02_Race/Position.z.json
- https://livetiming.formula1.com/static/2024/2024-03-02_Bahrain_Grand_Prix/2024-03-02_Race/CarData.z.json

They validate raw-deflate/base64 schema only. Historical availability is not free Live GPS entitlement. Full research responses stay in the ignored `.cache/research` folder. No connection tokens/cookies/account credentials are stored in fixtures. Local development/QA; source data rights are separate from implementation licenses.

`season-2024.json.gz` / `season-2026.json.gz`: real normalized Jolpica season snapshots fetched 2026-10-13 KST. Include race/sprint awards, previous-round changes and provider URLs/SHA-256 provenance. 2024 has 479 race-result records across 24 rounds (Brazil lists 19), not an assumed 20×24. 2026 snapshot is Round 17; it is a fixed regression fixture, not a current-data source. UI uses the backend provider, never these fixtures. Raw cache hashes are checked in tests.

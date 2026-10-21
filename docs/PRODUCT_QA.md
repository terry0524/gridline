# Product completion — 2026-10-13 KST

## 변경 범위

- HOME / SCHEDULE / STANDINGS / RESULTS / RACE CENTER. Native sidebar/mobile navigation, canonical paths, history navigation and legacy capture URLs. Driver/Team profiles, search dialog, actual Race Detail and Replay links.
- src/season-model.js / season-service.js: shared normalized domain models, complete Jolpica pagination, previous-round standings comparison, Race/Sprint awarded-points progression, independent per-year scoring metadata. Null awards stay unavailable; corrections are flagged instead of distributed backward. Sprint awards appear before Sunday Race. Driver season number/team come from the latest actual season result.
- app.js / chart.js / index.html / styles.css / src/router.js / src/brand.js / models.d.ts. Existing ESM/SVG styling reused; no dependency or framework migration. General routes do not load replay.js or chart.js until needed. Hidden Race Center skips painting and cannot overwrite general-route breadcrumbs. Chart selections persist and hover only updates when the inspected round changes.
- server.js / provider.js: normalized season APIs, persistent cache with background refresh, historical weather summary, canonical HTML routes and identifying Jolpica User-Agent. Live collector/parser/capture/SSE modules preserved. Normal automatic session discovery uses the existing API. GRIDLINE_AUTO_LIVE=0 was used for product QA, so no active live validation was attempted.
- scripts/verify-season.js / tests/season.test.js / immutable real-provider fixture archives. Existing 24 tests unchanged; 9 season tests added. src/race-model.js and Bahrain cached replay preserved.

## 실제 데이터

[Provider URL/hash evidence](qa/season-verification.json). API responses were fetched directly and normalized, not replaced with mocks. 2024: calendar 24, Race 24, Sprint 6, driver standings 24, constructors 10. 479 race-result rows: Brazil has 19 listed entries. All 34 final point totals match: VER 437, McLaren 666. Round 1 VER 26 includes the actual 2024 fastest-lap award exactly once. China Sprint-only test yields VER 85 before the Race, then the completed round yields 110.

2026 as of this verification: calendar 23, Race 17, Sprint 6, driver standings 23, constructors 11. All 34 totals match published Round 17 standings: Antonelli 340, Mercedes 578. Recent Singapore podium: VER / LEC / ANT. Next US Race 2026-10-25T20:00Z = 2026-10-26 05:00 KST. FP1 = 2026-10-24 02:30 KST.

Cross-checks: [official current drivers](https://www.formula1.com/en/results/2026/drivers), [constructors](https://www.formula1.com/en/results/2026/team), [calendar](https://www.formula1.com/en/racing/2026), [Singapore classification](https://www.formula1.com/en/results/2026/races/1296/singapore/race-result). The relocated Bahrain GP in Malaysia is in the actual official calendar; no original calendar assumption was substituted.

[Weather response](qa/product-weather.json): OpenF1 historical Singapore 11388, 160 measured session samples; mean air 30.3°C, track 42.5°C, humidity 72.2%. A historical session average, not a forecast or a live observation. Bahrain summary uses existing actual imported weather. Source time/hash retained. Failed/unavailable weather does not block results or Replay links.

Scoring references: [Jolpica documentation](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md), [FIA Section A Issue 02, A2.2](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_a_general_provisions_-_iss_02_-_2026-02-27.pdf). FIA lists Issue 03 as current; its PDF returned 403 during lookup, so its full content was not verified. Historical charts use actual awarded result points and reconciliation instead of predicting regulatory outcomes.

## QA

- 33/33 tests; original 24 preserved. npm run check passes.
- Bahrain 9472: 20 drivers, 432,280 locations, VER 1:32.608 / Lap 39. Actual Track/Timing/Weather/Race Control checked. Simulated Live remains EXACT / SIMULATED with the same field and fastest lap; development options hidden by default. Estimated position default OFF preserved.
- Desktop 1440, Tablet 1024, Mobile 320: HOME / SCHEDULE / STANDINGS / RESULTS / Race Center / Replay checked. No page-level horizontal overflow. Mobile Race Center Timing/Track/Driver/Control tabs checked. [Layout observations](qa/product-layout-checks.json).
- [64 actual navigation paths](qa/product-routes.json): HTTP 200 / app shell for all; no broken tested path. Browser season change, search Bahrain 2024, driver/team links, history back and results tabs checked. Native 2024 Bahrain Sprint-empty response displayed explicitly.
- Normal product flow console error/warning 0. Deliberately injected offline network failure displayed a retry message; restoring network and Retry recovered actual 2024 data. That separate QA tab was closed after restoration. Expected browser network errors during the fault injection are excluded from the normal-flow count.
- Keyboard ⌘ K / Tab / Escape, visible focus, semantic tables and labeled inputs checked. Reduced-motion emulation yielded animation/transition 0s and was reset. Visible Race Center/nav text check: 11 elements, minimum contrast 4.9:1 against opaque backgrounds. This is a focused check, not a full WCAG certification or physical-device/screen-reader test.
- Desktop HOME and full-width recent podium visually inspected; mobile pages and Replay screenshots retained in qa/.

## 남은 검증

Actual active-session continuous feed, free live Position/CarData payload and radio-audio access conditions remain unverified. Full Replay import/individual validation beyond Bahrain is still needed when those sessions are opened. Historical weather works independently of a full location import. No paid API, new account, publication or F1 video/audio integration was added.

# GRIDLINE — Circuit Atlas design QA

Completed 2026-11-03 (Asia/Seoul). Existing vanilla JS component/runtime system retained. No data model, collector, parser, replay engine, scoring or routing changes.

## Audit and direction selection

The current production Home, Schedule, Standings, Results, Driver/Team profiles and Race Center were opened and captured before editing. The old sidebar dominated a mostly flat hierarchy, the Home had repeated season context, and all pages used the same small-heading treatment. Detailed results repeated a generic masthead above the GP title.

Three separate visual concepts were generated and compared:

| Direction | Strength | Tradeoff | Decision |
| --- | --- | --- | --- |
| Pitlane Editorial | Emotional magazine composition and large type | Photography competes with data and needs ongoing image curation | Rejected |
| Circuit Atlas | Distinctive typography and factual circuit geometry; fast and reusable | Historical geometry must be clearly labeled and unavailable assets must stay unavailable | Selected |
| Timing Room | Strong precision/telemetry character | Still resembles the dashboard the user wanted to move beyond | Rejected |

References: [Type 7](https://type7.com/) and its [studio case study](https://www.mata.services/works/type-7) informed editorial hierarchy only. No reference branding, imagery or source code was reused. Lazyweb tools were unavailable in the session; primary public references were inspected instead.

## Visual truth and evidence

- Selected target: `/Users/parkjongseok/.codex/generated_images/01a12d95-31bc-7d61-b276-cc20ec83fd77/exec-40897d8c-a956-402c-b5d5-e1c7a0e9b4fb.png`.
- Target pixels: 1487 × 1058, normalized to 1440 × 1024 for composition comparison.
- Implementation: `http://localhost:3011/`, 1440 × 1024 CSS/pixels, deviceScaleFactor 1, dark theme.
- Source and implementation together: `.cache/ui-redesign/direction-comparison.png`.
- Before: `.cache/ui-redesign/before-home-1440.png`.
- Home: `.cache/ui-redesign/qa-home-1440.png`, `qa-home-1024.png`, `qa-home-390.png`, `qa-home-320.png`.
- Additional evidence: `.cache/ui-redesign/qa-{page}-{width}.png`, `matrix.json`, `home-light-320.png`, `chart-320.png`, `replay-track-320.png`.
- Screenshot evidence is local and ignored by Git. It is not included in the production payload.

This is a direction-to-product implementation, not a pixel clone of generated statistics or geography. The generated mock's incorrect circuit, dates and podium are intentionally replaced by real source data. The actual upcoming GP and countdown remain dynamic. Sector/DRS/coordinate annotations from the generated concept are not invented in the Home visual. The implementation deliberately gives championship summaries more space below the fold.

## Fidelity surfaces

- Typography: self-hosted Barlow Condensed display headings, Manrope body, Korean system fallback, tabular figures. GP names scale within their own column. Key data are 14–16px or larger; Race Center uses a separate compact timing scale. Small metadata remains tertiary.
- Spacing/layout: horizontal global navigation replaces the sidebar. Asymmetric GP/circuit hero, independent countdown and next-session strips, open secondary sections, no repeated rounded card grid. Existing detailed tables become compact mobile rows.
- Colors: warm graphite/bone-white with restrained lime selection/action accent. Purple fastest lap and flag/tire/team semantics are preserved. Light appearance is retained.
- Image/assets: 24 factual circuit SVGs extracted from verified replay assets, year-labeled; no raster hero downloaded on every route. Official font/icon licenses are bundled. Real search/theme icons replace navigation glyph decoration.
- Content: all current schedule, podium and points come from existing providers/domain state. No generated concept records enter production. Generic Results masthead is suppressed on race detail so the actual GP becomes its single main heading.

## Iteration history

1. P2: Home repeated season/timezone labels above its primary hero. Removed visual duplication while retaining accessible context. Evidence: `home-v1-1440.png` → `qa-home-1440.png`.
2. P2: Mobile navigation and icon hit targets were too small. Increased nav labels and made icon controls 44px. Long GP names now scale by their actual length/column width. Evidence: `home-v1-390.png` → `qa-home-320.png` / `home-light-320.png`.
3. P2: Expanded session setup pushed the Race Center's track below the fold. Restored progressive disclosure, grouped source status, compressed mobile masthead and removed completed loading-stage clutter. Evidence: `replay-v1-1440.png` → `qa-replay-1440.png` / `qa-replay-320.png`.
4. P2: Results detail repeated the generic page title above the GP title. Detail routes now use the actual GP as H1. Index routes retain their own Results H1. Targeted responsive recheck after this change.
5. P2: Mobile timing secondary statistics had an awkward extra row. Re-grouped point/win/change and time/grid/points metadata. Track labels use a larger mobile visual scale; map coordinates/interpolation remain unchanged.

## Browser and regression verification

| Screen | 1440 | 1024 | 390 | 320 |
| --- | --- | --- | --- | --- |
| Home | pass | pass | pass | pass |
| Schedule | pass | pass | pass | pass |
| Standings | pass | pass | pass | pass |
| Results index | pass | pass | pass | pass |
| Race detail | pass | pass | pass | pass |
| Driver detail | pass | pass | pass | pass |
| Team detail | pass | pass | pass | pass |
| Race Center | pass | pass | pass | pass |
| Bahrain Replay | pass | pass | pass | pass |

The 36-screen browser matrix reported 0 page-level horizontal overflow, 0 broken visible images and loaded display fonts. Normal browsing reported 0 console errors/warnings. Intentional Network blocking for the failure test is excluded from that count. Subsequent refinements received targeted screenshot/DOM rechecks; a redundant full-matrix rerun was interrupted by the browser automation timeout, not counted as a successful new run.

Actual interactions checked: global navigation; driver/constructor tabs; chart Round slider (R1 ANT18 / VER8 / HAM12 / RUS25); keyboard-open search, Mexico search and Escape; saved light mode after reload; replay Play/Pause, seek to end and 8×; mobile Timing/Track/Driver/Control/Live views; VER/NOR battle; Weather and Race Control. API failure showed a clear retry state, then recovered to all 23 calendar rows. A non-Sprint Bahrain result showed its actual empty state.

Bahrain UI regression: 20 drivers, 432,280 actual location records, EXACT POSITION, lap 40/57, fastest VER 1:32.608 / Lap 39. Weather, 43 race-control events and Driver Battle were inspected at the same replay timestamp.

`npm run check` passed. Existing full regression: 77/77 passed, including actual Bahrain/Monaco/Spa and season provenance. The isolated hydrated QA workspace was compared to Git-index source hashes; unchanged core files match, and modified UI/runtime files match the working tree. `node scripts/build-vercel.js` passed, including font/circuit/icon assets in both static output and the function bundle.

Keyboard focus, semantic controls, native details disclosure, table captions/row headings, chart accessible readout, explicit season label and reduced-motion CSS were checked. This is a browser accessibility pass, not a physical-device or screen-reader usability study. No active-session Live reception was attempted in this design task.

## Final review

No actionable P0/P1/P2 visual findings remain in the inspected states. The actual circuit reference and calmer lower-page density are intentional deviations from the concept. Source and implementation were reviewed together at full composition level; individual Home, narrow standings, race details, chart and Replay screenshots supplied focused readability evidence.

P3: very small tertiary chart-axis/metadata labels could receive further product-specific research; all core numeric readouts and keyboard alternatives remain available. No new feature work is included.

final result: passed

# Release Candidate QA

검증일: 2026-10-13. Node v22.22.2 / macOS arm64, local production UI. Active-session Live 검증은 하지 않았습니다. 실제 캐시·Jolpica reference·OpenF1 records를 사용하며 장애 주입은 browser-only 응답에서 분리했고 영속 원본을 수정하지 않았습니다.

## Bahrain-specific audit 및 변경 파일

- `src/replay-loader.js`, `scripts/import-replay.js`: 기본 session 9472와 Bahrain 전용 import 제거, year/round/session lookup. scheduled start와 실제 lap start를 함께 고려해 Monaco red flag 초기 데이터를 보존.
- `src/replay-store.js`, `src/replay-validation.js`, `src/race-model.js`: session/meeting/name/date/lap count/driver/fastest/weather/circuit metadata 기반 처리, schema 4 normalized cache·시간 index·manifest·validation·공통 좌표 transform. 수동 GP별 CSS transform 없음.
- `replay.js`, `app.js`, `index.html`, `styles.css`, `src/router.js`, `src/championship-chart.js`: manifest selector, loaded-only URL, lap deep link, loading/error/retry/partial UI, navigation cancel guard, accessibility/touch/focus와 부분 점수 결측 처리.
- `src/live/simulation.js`, `src/live/service.js`: Bahrain 기본 key 제거; 선택한 실제 import dataset 재사용. SignalR collector/parser/capture 구조 유지.
- `src/config.js`, `server.js`, `src/provider.js`, `src/season-service.js`, `src/models.d.ts`, package manifests: 환경·cache-only·debug 경계·크기/path validation·domain 계약·availability.
- `tests/release.test.js`, `tests/fixtures/replay-regressions.json`, `scripts/benchmark-replay.js`, README 및 RC 문서 추가. 기존 33개 test files는 변경하지 않았습니다.
- Bahrain 값은 명시적으로 이름 붙인 regression fixture/기존 provenance에 남습니다. docs/sample-*는 개발용 실제 응답 스냅샷이며 production UI에서 fixture로 표시하지 않습니다. mock/placeholder/TODO/fake/demo 검색에서 실제 정보처럼 사용하는 대체 race data를 추가하지 않았습니다.

## 실제 Race 검증

| 2024 Race | session / meeting | Drivers | Normalized locations | Laps | Fastest lap | Weather / RC / Stints / Pit | Classification |
|---|---|---:|---:|---:|---|---|---|
| Bahrain / Sakhir | 9472 / 1229 | 20 | 432,280 | 57 | VER 1:32.608 / L39 | 157 / 71 / 63 / 43 | VALID |
| Monaco / Monte Carlo | 9523 / 1236 | 20 | 684,920 | 78 | HAM 1:14.165 / L63 | 200 / 122 / 39 / 23 | PARTIAL |
| Belgian / Spa | 9574 / 1242 | 20 | 393,460 | 44 | PER 1:44.701 / L44 | 137 / 23 / 58 / 34 | VALID |

각 fastest/driver/lap reference를 실제 Jolpica 결과와 대조했고 source URL/SHA를 fixture와 manifest에 기록했습니다. Monaco raw locations 686,138개에서 중복 timestamp 정규화 후 684,920개. invalid stint 4개를 제외하여 PARTIAL을 그대로 노출합니다. Telemetry는 Bahrain 기존 실제 일부 구간 2,878 rows만 유지; Monaco/Spa 이번 import는 telemetry 미요청입니다.

Spa on-track timing은 RUS P1이고 post-race DSQ가 반영된 공식 Results는 HAM P1입니다. historical race state를 최종 결과로 덮어쓰지 않습니다. Bahrain 끝에서 Race Control 70개인 것은 마지막 Replay timestamp 이후 1개가 있어 raw 총71개와 구분한 결과입니다.

Track과 모든 차량에 metadata rotation, measured bounds, center/scale/padding을 동일 적용. 실제 좌표 sampling clipping 0. completed timed lap 내 non-pit-out 구간과 기준 centerline 거리 p95는 Bahrain 5.644 / Monaco 4.578 / Spa 3.899 SVG px; 모든 좌표(parked/pit/red flag 포함)는 5.970 / 17.313 / 5.940 px. 이 값은 renderer 정합 진단이며 meter/GPS 정확도 점수가 아닙니다. [원본 정합 측정](qa/rc/track-running-alignment.json).

## Performance

warm filesystem / cold Node dataset cache, GP별 독립 process. 실제 persisted upstream 응답을 rebuild하여 normalization/index 시간을 측정하고 deterministic seek 200회를 사용했습니다.

| Race | Cache initial load ms | Normalize ms | Index ms | Heap / RSS after load MiB | Process peak RSS MiB | Seek median / p95 ms |
|---|---:|---:|---:|---|---:|---|
| Bahrain | 186.26 | 255.45 | 0.350 | 55.51 / 156.77 | 308.59 | 0.802 / 3.132 |
| Monaco | 228.96 | 459.75 | 0.319 | 75.11 / 189.67 | 369.55 | 0.512 / 4.359 |
| Spa | 159.21 | 212.63 | 0.319 | 45.72 / 148.70 | 316.27 | 0.333 / 0.976 |

Peak RSS는 raw rebuild와 original dataset 동시 보유를 포함하므로 browser memory가 아닙니다. browser requestAnimationFrame 180회 간격 median은 세 Race 모두16.7ms, p95 17.5–17.7ms. 전체 rendering FPS/drop-frame/memory stress 인증은 아닙니다. [Bahrain](qa/rc/benchmark-9472.json), [Monaco](qa/rc/benchmark-9523.json), [Spa](qa/rc/benchmark-9574.json), [frame 측정](qa/rc/browser-frame-metrics.json).

Bahrain original432,280 rows 유지. 동일 1,000 seek ×3 비교의 마지막 iteration은 legacy median/p95 0.758/3.099ms, RC 0.813/3.238ms (+0.056/+0.139ms). 모든 비교에서 median<1ms,p95<5ms이며 성능 개선을 주장하지 않습니다. [비교](qa/rc/bahrain-performance-comparison.json).

## Regression 및 offline

- 기존33 + 신규11 = **44/44**, skipped0. [test log](qa/rc/rc-tests-release.log), [syntax check](qa/rc/rc-check-release.log).
- 3GP 실제 counts/fastest/provenance, reverse seek/index/pit/interpolation/clipping, manifest partial/import-only, 안전 path/lap query, malformed payload/timing-only/optional source failure, production tooling guards/cache-only HTTP를 확인했습니다.
- CLI Bahrain import 재실행이 cache를 재사용하고432,280 rows를 보존함. [log](qa/rc/import-reuse-proof.log).
- 서버 `GRIDLINE_OFFLINE=1 GRIDLINE_AUTO_LIVE=0`로 upstream 없이 3GP를 로드했습니다. 로드 후 browser 전체 network를 offline으로 바꿔 End/Home seek, Play/Pause,4x/8x,20 recorded markers, timing/fastest/weather/control 확인. [offline evidence](qa/rc/offline.json). 새 browser page를 완전 offline에서 bootstrap하는 PWA는 아닙니다.
- Bahrain v3 original SHA256: `522e1d1f4ba8fb3d0088bf3453e4e8d7538e7878428a595098a7c621faae8891`. 원본 삭제 없음.

## Final QA matrix

PASS는 render, 직접 URL, page overflow0, normal console error/warning0, 이름 없는 controls0, keyboard skip/focus 및 주입된503 error+Retry 복구를 의미합니다. screenshots와 [normal matrix](qa/rc/matrix.json), [error matrix](qa/rc/error-matrix.json)를 보존했습니다.

| View | 1440 | 1024 | 320 |
|---|---|---|---|
| home | PASS | PASS | PASS |
| schedule | PASS | PASS | PASS |
| standings | PASS | PASS | PASS |
| results | PASS | PASS | PASS |
| race-detail | PASS | PASS | PASS |
| driver-detail | PASS | PASS | PASS |
| team-detail | PASS | PASS | PASS |
| race-center | PASS | PASS | PASS |
| replay | PASS | PASS | PASS |

Manual Monaco → Spa 선택이 `/replay/2024/belgian?session=9574`로 바뀌고 Back으로 Monaco lap65가 복원됨을 실제 확인했습니다. Skip link로 lap65가 유지되고 HAM 선택 및 LEC/PIA Battle 비교도 확인했습니다. [navigation evidence](qa/rc/navigation.json), [최종 Monaco 화면](qa/rc/monaco-rc.png).

각viewport의 screenshot은 `docs/qa/rc/<view>-<width>.png`입니다. 이 matrix는 모든 keyboard 동작이나 모든 possible route를 exhaustive 검사했다는 뜻은 아닙니다.

## Partial failures / Security / Accessibility / Visual

- 실제 Spa payload에서 WX/RC만 제거한 browser fault에서도 timing/tires/20markers 유지, 해당영역Unavailable. standings failure에서도 constructors와 Schedule 유지. [Replay fault](qa/rc/partial-replay-fault.json), [season fault](qa/rc/partial-season-fault.json).
- npm audit vulnerabilities0, 추가 external dependencies0. [audit](qa/rc/audit.json). Node runtime CVE 점검·full penetration test는 미수행.
- loopback host / POST Origin / positive safe session ID / static allowlist / capture path / JSON request limits / gzip bounds / replay SHA & identity checks. 기존 protocol prototype pollution 차단 및 compressed payload/frame bounds 유지. SSE max clients/backpressure/close cleanup, LRU2 cache. 단기 테스트로 장시간 memory leak 부재를 주장하지 않습니다.
- production Simulated Live/capture replay/raw topic diagnostics hidden, debug controls denied. 새로운 credential/APIkey/.env 없음.
- semantic navigation/tables, labeled controls, focus outline/skiplink, chart text alternative/round control, tire letters+colors, selected driver/battle labels, primary touch targets44px 확인. 작은 SVG marker는 같은 드라이버의44px timing control로도 선택 가능.
- mobile table semantics 유지,320px page horizontal overflow0. reduced-motion 장식 transition 제거; 핵심 실제 차량 보간은 pause 가능. complete WCAG/screenreader/physical device 인증은 아닙니다.
- 기존 dark timing system, 숫자 tabular 정렬, dense rows, independent brand 유지. 실제1440/1024/320 screenshots를 검토했고 불필요한 UI 재설계/장식 animation은 추가하지 않았습니다.

## 아직 필요한 검증

[Release readiness](RELEASE_READINESS.md)의 READY — NEEDS LIVE VALIDATION 및 NOT AVAILABLE을 참고하세요. 다음 실제 F1 세션에서만 continuous timing,무료Position/CarData payload, freshness/reconnect와 Radio access conditions를 검증합니다. 이번 RC 단계에서는 actual active-session Live 테스트를 하지 않았습니다.

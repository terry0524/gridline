# GRIDLINE · F1 Live Companion

중계를 함께 보면서 사용하는 비공식 Second Screen. 기존 vanilla ESM/SVG 제품과 무료 Historical Replay를 유지합니다. Node.js 22.22 이상, 추가 npm 의존성·API key·유료 OpenF1 Live 구독은 필요하지 않습니다. 현재 버전은 **0.6.0-rc.1**입니다.

[GitHub](https://github.com/terry0524/gridline) · [Render 배포](https://render.com/deploy?repo=https://github.com/terry0524/gridline) · [배포 방법과 한계](docs/DEPLOYMENT.md) · [데이터 출처/라이선스](NOTICE.md)

호스팅 설정은 준비되어 있지만 Render 계정 연결 및 실제 URL 확인 전에는 사이트 배포 완료로 표시하지 않습니다.

## 실행

```sh
npm run dev
# 일반 사용자용 production UI
npm start
```

[HOME](http://localhost:3000/)에서 Schedule / Standings / Results / Race Center로 이동합니다. 포트는 `PORT=3001`로 변경할 수 있고 서버는 loopback에만 바인딩됩니다. Production에서는 Simulated Live, Capture Replay 및 raw diagnostics가 숨겨지고 개발 제어 API도 차단됩니다. 개발용으로 명시적으로 열려면 `GRIDLINE_DEBUG=1 npm start`를 사용합니다.

실제로 import된 Replay만 선택하거나 Results에서 WATCH REPLAY로 열 수 있습니다.

- `/replay/2024/bahrain?lap=39`
- `/replay/2024/monaco?lap=65`
- `/replay/2024/belgian?lap=39`

`lap`은 관측된 해당 랩 시작으로 이동합니다. Fastest Lap은 랩이 완료된 뒤 갱신됩니다. LIVE는 실제 active-session이 확인되었을 때만 활성화합니다. 이번 RC 작업에서는 실제 Live 연결을 실행하지 않았습니다.

## Historical Replay import

```sh
npm run import-replay -- --year 2024 --round 1
npm run import-replay -- --year 2024 --round 8
npm run import-replay -- --year 2024 --round 14
# 선택한 과거 세션의 telemetry도 수집할 때
npm run import-replay -- --year 2024 --round 8 --telemetry --force
```

Jolpica 일정 → OpenF1 과거 Race 세션 lookup → 실제 endpoint 수집 → 검증·정규화·시간 인덱스 → gzip cache → manifest 순서입니다. `--session-key`도 지원합니다. 종료되지 않은 세션은 historical import 대상이 아닙니다. 기본 실행은 기존 cache를 재사용합니다. **`--force`는 실제 source를 다시 조회하므로 snapshot 수치가 바뀔 수 있습니다.** 변경 후 regression 기준을 다시 검증해야 합니다.

Schema 4 cache는 `.cache/replays/<season>/<sessionKey>-v4.json.gz`, 목록은 `.cache/replays/manifest-v1.json`입니다. 기존 Bahrain v3 원본을 보존하면서 migration했고 SHA-256, schema, session identity를 검증합니다. INVALID 또는 손상된 cache는 일반 selector에 노출하지 않습니다. PARTIAL은 누락·제외된 데이터를 표시합니다. import하지 않은 GP를 AVAILABLE로 표시하거나 브라우저에서 수십만 row를 새로 수집하지 않습니다. 다른 GP까지 모두 검증한 것은 아닙니다.

로딩은 Session / Drivers / Track / Timing / Strategy / Race Control 단계로 표시하며 가짜 백분율을 만들지 않습니다. track과 차량은 같은 측정 좌표·metadata rotation·bounding box 투영을 사용합니다. 코너/sector/S/F 정보가 근사인 경우 ≈로 유지하고 DRS zone을 만들어내지 않습니다. Live 위치 추정은 기존 Bahrain blind-test 오차 때문에 기본 OFF입니다.

## 검증

```sh
npm run check
npm test
npm run benchmark:replay -- 9472
npm run benchmark:replay -- 9523
npm run benchmark:replay -- 9574
# upstream 없이 기존 server cache만 사용
GRIDLINE_AUTO_LIVE=0 GRIDLINE_OFFLINE=1 npm start
```

테스트에는 실제 import cache가 필요하며 mock으로 대체하지 않습니다. 2024 Bahrain / Monaco / Belgian GP의 실제 20명씩을 검증했고 기존 33개를 포함한 **44/44**가 통과했습니다. 상세 측정·27개 화면 QA·부분 장애와 offline 범위는 [RC QA](docs/RC_QA.md), 준비 상태는 [Release readiness](docs/RELEASE_READINESS.md)에 기록했습니다. 캐시는 현재 작업 공간의 개발 데이터이며 별도 배포 번들에 자동 포함되지 않습니다.

## Live 개발 도구

Historical OpenF1 → RaceState와 anonymous F1 SignalR → single Node collector/parser → RaceState → SSE 경로를 보존했습니다. Debug Simulated Live는 선택한 실제 import cache를 사용합니다. 기본 production 실행은 raw capture를 하지 않습니다.

```sh
npm run dev
# 별도 터미널: 실제 세션 때만
npm run capture-live
npm run analyze-capture
npm run replay-capture -- captures/<출력된-폴더명>
```

[실제 세션 체크리스트](docs/LIVE_SESSION_CHECKLIST.md), [capture QA](docs/CAPTURE_QA.md), [source 조사·위험 분류](docs/LIVE_RESEARCH.md)를 참고하세요. 실제 active-session continuous feed, 무료 Position/telemetry, Radio audio는 미검증입니다. Radio는 metadata/reference만 처리하고 오디오·영상 재생이나 인증 우회는 구현하지 않습니다.

## 구조 및 한계

`src/season-service.js`의 Jolpica domain model과 `src/race-model.js`의 공통 RaceState를 UI에서 사용합니다. `src/replay-loader.js` / `src/replay-validation.js` / `src/replay-store.js`가 import와 schema-aware cache를 맡습니다. `replay.js`는 독립 차량 애니메이션과 timing UI, `app.js`는 일반 화면, `src/live/`는 기존 collector와 adapter입니다. 브랜드는 `src/brand.js`에서 관리합니다. 전체 TypeScript migration은 하지 않았습니다.

Weather/Race Control/telemetry가 없어도 핵심 timing/track을 유지하고 없는 값은 Unavailable 또는 —로 표시합니다. Championship chart는 실제 Race/Sprint 지급 점수를 누적하며 2025 이후 Fastest Lap bonus를 추가하지 않습니다. Championship Live Projection은 미구현입니다. Spa Replay의 RUS P1은 당시 on-track timing이며, 경기 후 DSQ가 반영된 공식 Results의 HAM P1과 구분합니다.

새 page의 완전한 browser-only offline/PWA, 공식 GIS/차선 정확도, 장시간 memory leak 검증, 실제 휴대폰·보조공학 인증은 주장하지 않습니다. 이미 로드한 Replay는 브라우저 네트워크를 끊어도 재생·seek·속도 변경할 수 있고 fresh page는 로컬 서버가 필요합니다.

## 출처와 라이선스

Unofficial fan project. Not affiliated with Formula 1. 공식 로고를 복제하지 않았습니다. 비상업적 팬 프로젝트입니다. 데이터 출처·CC BY-NC-SA 조건을 유지하며, 상업 배포 허가는 포함하지 않습니다. 초기 공개 호스팅 preset은 아직 검증되지 않은 실제 Live 수집을 비활성화합니다.

- [OpenF1 공식 문서](https://openf1.org/docs/): 과거 데이터와 유료 Live 접근을 구분합니다.
- [Jolpica Terms](https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md): 데이터와 구현 소프트웨어의 라이선스를 구분합니다.
- [기존 데이터·참고 프로젝트 조사](docs/DATA_SOURCES.md): f1-dash의 AGPL 및 f1-race-replay tree의 라이선스 상태를 기록했습니다. 두 프로젝트의 코드·자산을 복사하지 않았습니다.

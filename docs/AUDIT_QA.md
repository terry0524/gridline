# 감사 및 첫 Replay milestone QA — 2026-10-12

## 입력 보존 / 기존 감사

원본 `F1/f1-live-companion.zip`: SHA-256 `9155a7c4c786a08240e3a0f0fae8bd5faec564ddf86fe843424b023557c44b11`.

ZIP에는 index.html/styles.css/app.js/server.js/package.json/README.md 6개 파일. 별도 AGENTS, lockfile, build tool, 의존성 또는 React/shadcn 없음. Node 22.22.2로 원본을 실행하고 브라우저 확인.

| 항목 | 기존에서 직접 확인 | 수정/현재 상태 |
|---|---|---|
| 일정 / standings | 실제 Jolpica 응답으로 다음 GP와 양쪽 순위 표시. 초기 console 오류 없음 | 보존, 사용자 local time, weekend sessions·결과 종류·5분 refresh 추가 |
| Replay 실행 | Singapore 2026 조회에서 **429 weather**, console Promise.all 실패 | 순차 수집 큐 / 재시도 / 중복 요청 병합 / 영속 캐시 / 진행률 |
| 트랙 | 첫 드라이버의 전체 session 궤적을 한 선으로 연결 | 한 완료 lap의 실제 trace, 모두 동일 transform |
| 랩 | date_start 대신 없는 date로 정렬 | 실제 필드 parser, completion 시각 기반 조회 |
| 순위 / 좌표 | 좌표 없음/20초 경과 드라이버를 timing에서도 제거 | timing/location 분리; 위치 누락이면 마커만 숨김 |
| interpolation | 250ms 점프 + 전체 SVG 재생성 | persistent 20 SVG groups, requestAnimationFrame, bracket interpolation |
| 타이어 / 피트 | stints 수집하지만 사용하지 않음, pit endpoint 미구현 | compound/age/pit event count·status |
| Fastest Lap | 숫자와 보유자 기본 표시, 알림 없음 | 팀·랩·보유자, 실제 갱신 toast, timing ◆, 명시적 deleted lap 제외 |
| Weather | 6개 필드, wind direction 누락 | 7개 필드 + observation timestamp |
| 하드코딩 | 일반/replay 모두 2026만 요청, 고정 KST, 1/5/15/60× | 일반 현재 연도, Replay 2023~현재 catalog/session_key, local zone, 1/2/4/8× |
| mock | 임의 차량/기록 mock은 없었음; Waiting 상태는 안내 placeholder | 실제 cache만 사용, 미확보 데이터는 — / unavailable |
| 보안 | 원본 키/secret 없음. server.js/package 등 루트 파일에 접근 가능 | 정적 allowlist, 캐시/서버 파일 404, endpoint allowlist, 동일 origin POST, localhost bind, CSP, no embedded frames |
| 접근성 | label 연결 없음, glyph-only play, div timing row, focus/reduce-motion 규칙 부족 | 연결 label/ARIA, button row, keyboard SVG, focus outline, skip link, 색 외 문자열·기호 |
| 반응형 | 모바일 전체 섹션을 세로 나열, desktop 지도/순위 2열 | Desktop 3열, Tablet track/timing, Mobile 5뷰+공통 playbar |

## Phase 진행 상태

| Phase | 파일 / 구현 | 실제 검증 / 남은 일 |
|---|---|---|
| 1 | 원본 감사·server.js | 원본 브라우저/API 429 재현, 원본 ZIP 보존 |
| 2 | src/provider.js, replay-loader.js, race-model.js, models.d.ts | 13 endpoint 성공 schema 확인, provenance 해시 일치. 공통 RaceState는 구현; 일반 모드 전체 normalization/TS migration은 남음 |
| 3 | app.js, index.html | 기존 일정/standings/chart 보존·세션 시간/결과 전환 추가. 독립 Driver/Team 상세 페이지는 남음 |
| 4 | replay.js, replay-loader.js | Bahrain 전체 구간, Play/Pause/Seek/1·2·4·8×. 다른 모든 GP 보장 아님 |
| 5 | race-model.js, replay.js | 실제 432,280 좌표, 15 코너. 8,660 sample의 reference 거리 p95=5.972 SVG px. S/F/sector 근사, DRS 미확보 |
| 6 | race-model.js, replay.js | 완료 후 VER 1:32.608 L39, 실제 전환 toast 확인; tire/stint/pit boundaries 테스트 |
| 7 | race-model.js, replay.js | 7 weather 필드, 시각 이전 RC timeline/전역 상태. 일반 예보 및 모든 중요 사건 알림은 남음 |
| 8 | replay.js | VER–NOR 비교 및 두 차량 강조 확인. Championship Projection 미구현 |
| 9 | src/live/, server.js, replay.js | 이번 추가 작업: 무료 Core timing collector + actual Bahrain SSE simulation. [Live QA](LIVE_QA.md). 실제 active race·무료 GPS는 미검증 |
| 10 | styles.css, tests/replay.test.js | 실제 데이터 9 tests, 3 화면 폭·모바일 뷰·console·offline 확인. 전체 시즌/장시간/부하·스크린리더 실기 QA는 남음 |

## 검증 결과

- Bahrain Race 9472, 20명, 432,280 locations, 157 weather observations, 71 RC records(재생 끝 시각까지의 UI 이벤트는 70개), 22개 provenance 응답. race start 2024-03-02T15:03:42.341Z, replay end 16:37:00.763Z. F1 lap start 자체는 근사.
- Replay gzip 파일 3,944,766 bytes / JSON 13,556,578 bytes. 캐시 파일은 공개 정적 파일 경로로 노출하지 않음.
- **9/9 실제 데이터 테스트 통과:** 시간 정렬/전체 field, 해시, 공식 Fastest Lap 교차확인, reverse Seek, pit/stint boundary, interpolation/no-gap-bridging, location 누락 시 timing 유지, geometry consistency, live window access guard.
- 실제 브라우저: 70% Seek에서 20 markers, 43 RC events, VER L39 1:32.608, air17.9/track22.4°C. NOR 선택 P6, HARD 및 telemetry 확인.
- 실제 8× Play 후 timeline 70→73.25%, NOR transform `translate(642.49 415.67)`→`translate(520.49 174.65)`; Pause 후 유지.
- L39 직전 재생에서 `FASTEST LAP / Max VERSTAPPEN · 1:32.608 · L39` 표시 순간 캡처.
- 390/1024/1440 CSS pixels에서 가로 overflow 없음. 모바일 TIMING 20행, TRACK 20 markers, DRIVER 및 CONTROL 별도 화면 확인.
- CDP network offline 테스트: `OFFLINE · CACHED REPLAY`, 20 markers, Fastest Lap 유지. 이후 네트워크 설정 복원. Reload 후 빈 네트워크에서 새 세션 다운로드까지 가능하다는 뜻은 아님.
- 일반 모드 실제 화면: Australia 2026 FP1/2/3/Qualifying/Race의 KST 시간 확인, Australia Race/Qualifying 및 China Sprint 결과 확인. Driver standings 23행·Constructor 11행, 양쪽 상위 5개 누적 곡선 확인.
- SVG 마커의 Space 선택 시 NOR로 변경되고 재생은 Pause 상태를 유지하는 키보드 동작 확인. 1/2/4/8× 옵션 선택 확인; 실제 차량 이동은 8×에서 확인.
- 최종 QA 탭의 error/warn console 0개 확인(원본 429 로그와 구분).
- `/server.js`, `/.cache/replays/...` →404, 무효 endpoint/`latest` 동적 조회 →400. 첫 Replay 감사 당시 `/api/live/status` → available:false. 현재는 [Live QA](LIVE_QA.md)의 상태 API로 변경.

[Desktop](qa/desktop-replay.jpg), [Fastest alert](qa/fastest-lap-alert.jpg), [Mobile LIVE](qa/mobile-live.jpg), [Mobile TRACK](qa/mobile-track.jpg), [Tablet](qa/tablet-replay.jpg).

## 해석 제한

좌표 비교는 같은 OpenF1 lap trace와의 내부 일관성 검사이며 공식 GIS/실제 도로폭 정확도의 증명은 아님. Pit event timestamp를 정확한 pit entry/exit로 해석하지 않음. 공식 기록이 없는 driver retirement, deleted-lap validity, DRS zone 또는 forecast를 추측하지 않음. 실제 라이브·Projection·모든 GP 검증은 완료로 표시하지 않음.

# Live pipeline QA — 2026-10-12

## 이번 변경

- 추가: `src/live/collector.js`, `protocol.js`, `f1-adapter.js`, `simulation.js`, `service.js`, `scripts/probe-live.js`, `tests/live.test.js`, 실제 응답에서 추린 `tests/fixtures/*`.
- 수정: `server.js`(singleton stream/API), `src/race-model.js`(공통 fastest selector/선택적 마지막 위치 유지), `src/models.d.ts`(nullable source 시각/live 계약), `replay.js`(공통 화면/SSE/stream interpolation), `index.html`(모드·개발 reconnect 버튼), `styles.css`(모드/상태 최소 보완), `package.json`(Node22.22+, probe/check), README 및 조사·QA 문서.
- 기존 `app.js`, general mode, 실제 Historical Replay 수집/cache는 보존. UI 전체 redesign이나 framework migration 없음.

## 직접 확인한 것

1. **실제 upstream:** 자체 Node collector `npm run probe:live` 성공. Core 익명 negotiate / WS / Hub handshake / Subscribe. F1 TV 계정·bearer/API key 없음. 실제 반환 14 topic, session11388 Singapore 2026 Race **Ends**,22 drivers,153 RC,32 radio metadata, air30.2/track41.5°C. metadata/current best는 source 기록 그대로다. 생성된 날짜를 관측 날짜로 가장하지 않았다.
2. **추가 topic 확인:** 익명 `Position.z`, `CarData.z`, `ChampionshipPrediction` Subscribe completion에는 error 없으나 결과 empty. production default는 이 topics를 제외. 위치/telemetry가 무료 실제 Live로 동작한다고 주장하지 않음.
3. **Live UI:** `LIVE · WAITING`, `OFFLINE`,62/62,22 tower rows, LEC1:35.202 lap41 source snapshot,153 RC,weather `Snapshot · 관측 시각 없음`. 실제 Singapore circuit geometry 표시, 차량0/22,telemetry—. active live로 보이지 않음. play/seek disabled. [종료 snapshot 화면](qa/live-ended-snapshot.jpg).
4. **Simulated Live:** 실제 OpenF1 Bahrain9472 캐시,432280 observed coordinates,20 drivers,57 laps. Node→RaceState→SSE→기존 Race Center에서20/20 cars,순위/gap/interval/랩/compound S/M/H/I/W/tire age/pit/weather/control/battle 표시. 원본파일과 session clock을 같이 사용. 가상의 F1 기록 없음.
5. **실제 fastest 전환:** Bahrain L39 completion 직전부터 1×재생. 기존 LEC1:34.090에서 VER1:32.608 Lap39로 갱신. overlay와 purple timing indicator 직접 확인. [알림](qa/simulated-fastest-alert.jpg).
6. **재연결:** UI 연결 복구 테스트로 downstream SSE를 종료. 즉시 `RECONNECTING · LAST DATA`,20 cars/기록 유지. EventSource reconnect 후 `SIMULATED · LIVE`,동일 pause 시각·fastest 유지. upstream/producer clock reset 없음.
7. **fanout:** 실제 HTTP SSE client10개로 integration test. sourceInstances1,upstreamConnections0(sim),clients10; 같은 actual race timestamp/20 positions. 종료 후 새 SSE connection에 full metadata+state 수신,seek/pause 시계 유지. actual source UI 연결 시 status는 collector CONNECTED,upstreamConnections1. 10명의 실제 사용자를 운영했다는 의미는 아님.
8. **controls:** browser Play/Pause,End/Home seek,8×선택,reverse seek. automated actual Bahrain clock1/8×,pause,seek10/100%,오래된 위치 유지,no future weather/control,shared fastest 검증.1/2/4/8 옵션 유지.
9. **responsive / accessibility:**1440×1000 desktop,390×844 mobile에서 horizontal overflow 없음. Mobile TRACK20 positions,TIMING20 rows 확인. 기존 views/ARIA/keyboard/select controls 유지. 전체 screen-reader 실기 검증 아님.
10. **mode transition regression:** Simulated Live→Replay에서 stub driver에 locations가 없는데 Replay rAF가 먼저 실행되는 오류를 실제 console로 발견. mode를 실제 Replay dataset 설치 시에만 전환하고 loading 중 프레임을 보류하는 방식으로 수정. 새 QA tab에서 동일 전환 반복,Historical Replay57/57,20/20 positions,VER1:32.608 표시,**console error/warn0** 확인. 실제 Core WebSocket close/error가 동기적으로 재진입하던 collector 오류도 socket을 먼저 detach해 해결하고 회귀 테스트 추가.
11. **검사:** `npm run check`, `npm test` **15/15 통과**. 기존9 actual Replay tests 유지. 추가6은 실제 snapshot/historical compressed schema,actual simulation/SSE fanout 및 protocol/재진입 robustness tests. 고의적인 malformed patch와 fragmented frame unit cases는 실제 경기 데이터로 가장하지 않는다.

## 보존 확인

- 원본 ZIP SHA256 `9155a7c4c786a08240e3a0f0fae8bd5faec564ddf86fe843424b023557c44b11` 동일.
- 기존 Bahrain normalized gzip SHA256 `522e1d1f4ba8fb3d0088bf3453e4e8d7538e7878428a595098a7c621faae8891` 동일.
- 기존 Replay provenance의 전체 upstream response hash 테스트 통과. 원본·캐시 삭제/대체 없음.
- 외부 runtime dependency 설치 없음. secrets/로그인/음성·영상 재송출 없음. 실제 HTTP `/server.js`, `/.cache/replays/9472-v3.json.gz`, `/src/live/collector.js`404,invalid mode400,foreign Origin POST403 확인. 정적 allowlist,localhost binding,동일 origin POST,cache/server 비노출 유지. stream raw transient token/cookie를 프론트나 QA 기록에 보내지 않음.

## 확인하지 못한 것 / 남은 문제

- 실제 진행 중인 레이스의 지속 feed/timing latency/순위 전환/SC·VSC/new session/장시간 reconnect. 확인 시점은 종료 snapshot이다.
- 무료 실제 Live Position/CarData. parser와 same renderer는 준비됐지만 anonymous Live source가 이를 제공한다는 증거 없음. 임의 progress/GPS fallback을 실제 좌표로 표시하지 않았다.
- 정확한 Live pit stop duration. 공개 snapshot 필드에 없으면null. tire age는 제공된stint.TotalLaps,entry/exit는source boolean.
- radio audio playback 가능성/허가,전체 source 데이터 공개·상업 배포 권한. metadata 수신과 이용권은 구분.
- 실제 생성된 SC/red flag 이벤트를 이번 sim의 Bahrain 데이터가 포함하지 않는다면 검증했다고 주장하지 않음. source enum/state parser 준비와 실제 사건 경험은 구분.
- Championship Projection 및 이전 milestone의 남은 제품 범위는 삭제하지 않았고 이번 변경 범위에는 구현하지 않음.

[연결 evidence](live-connection-evidence.json), [source/법적 분류/구조 조사](LIVE_RESEARCH.md), [Desktop](qa/desktop-simulated-live.jpg), [Mobile Track](qa/mobile-simulated-track.jpg), [Mobile Timing](qa/mobile-simulated-timing.jpg).

실행은 Node>=22.22 `npm run dev`→Race Center 모드 선택. QA 종료 시 자체 server와 임시 browser tab은 종료한다.

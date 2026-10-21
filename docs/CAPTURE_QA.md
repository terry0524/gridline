# Capture readiness / QA — 2026-10-12

이번 범위는 실제 세션에서 바로 기록·진단·재생하는 준비다. 실제 진행 중인 레이스는 검증하지 않았다.

## 구현과 경계

- npm capture-live / analyze-capture / replay-capture. 기존 localhost backend를 재사용하거나 없으면 자체 backend를 시작. 하나의 Node collector와 capture journal을 공유. CLI raw 수집을 별도 upstream으로 만들지 않음.
- JSON Hub frame과 수신 시각을 raw.ndjson, adapter 결과를 normalized.ndjson, connection/warning을 events.log, session/meeting/circuit/upstream/parser version을metadata.json, channel 계측을 capabilities.json에 기록. files0600/unique directory0700,5초 checkpoint,정상 종료 flush.
- 12개 요청 channel은 RECEIVED/EMPTY/NOT RECEIVED/ERROR 및 first/lastReceivedAt,messageCount,payloadBytes,empty/error count. raw completion의 빈 optional result와 새 feed를 구분.
- 공개 topics Subscribe와 optional Position.z/CarData.z Subscribe를 같은 익명 socket의 별도 invocation으로 수행. optional 거절이 public Timing 수신을 중단시키지 않음. F1TV credentials/login/bearer 발급이나 인증 우회 없음. 익명 transport token과 affinity cookie는 연결 메모리에만 유지.
- unknown Hub type / malformed JSON / unknown channel / unsupported schema를 warning으로 남기고 이후 packet을 계속 처리. frames size/deflate depth 제한 유지. 파일 I/O 오류도 collector를 종료하지 않음; storageError는 표시.
- capability8개는 실제 정규화 값으로 계산. position과telemetry는 유효 관측값이 있어야true,없는 값은null/Unavailable. numeric0은 실제 관측값일 때 유효. Radio는 reference만 production state에 남음.
- TimingData 중심 freshness:5s DELAYED/15s STALE. WeatherData120s/300s,Position/CarData3s/10s. CONNECTED와 sessionStarted만으로 active를 추정하지 않음. freshTimingData+sessionStatus가 함께 확인되어야LIVE SESSION AVAILABLE. 종료 세션은NO ACTIVE SESSION,불확실하면SESSION UNCONFIRMED.
- next-session은 실제 Jolpica calendar의 Practice/Sprint/Qualifying/Race 시간을 UTC로 파싱하고 browser local(KST) 시간·countdown으로 표시. 일정은 세션 활성 증거가 아님.
- capture replay는 wall-clock 수신 순서(sequence tie-break)로 raw와 recorded connection events를 현재 parser에 다시 공급. 별도capture playback clock/seek·pause·speed. recorded state와 live state UI는 동일하고CAPTURE REPLAY label. reverse seek는 engine reset 후 이전 raw까지만 처리. future driver/telemetry/detail도 제거.
- estimated prototype: 실제 timing mini-sector 상태와 circuit metadata miniSectorsIndexes로 진행률/centerline endpoint 추정. actual coordinates 우선, opt-in estimated 다음, 없으면unavailable. state/driver positionQuality와estimatedLocation/trackProgress 포함. exact capability와estimated를 혼동하지 않음. no GPS input to predictor. 기본OFF.

## 실제 endpoint/CLI 결과

`npm run capture-live -- --duration 12` 실제 실행:
- directory `captures/2026-10-12T03-13-52-259Z_Waiting-for-session`.
- metadata session11388 Singapore2026 Race Ends/Finalised. raw3frames(Handshake,public completion,optional completion),normalized state 파일 저장. active session false.
- channel TimingData/TimingAppData/DriverList/SessionInfo/SessionData/LapCount/TrackStatus/WeatherData/RaceControlMessages/TeamRadio RECEIVED 각snapshot1회. Position.z/CarData.z **EMPTY**,channel messages0,payload bytes0.
- source14topics,22drivers,153 RC,32 radio metadata. reconnect0,unknown0,truncated0. continuous feed검증 아님.
- analyze-capture가 위 저장 파일을 읽어 위 counts와 timing/intervals/tires/weather/control/radioMetadata true,position/telemetry false를 산출.
- replay-capture CLI로 server를 자동 시작,source 재처리 후 실제 browser에서22 towerrows/LEC1:35.202 L41/weather snapshot/153control을 확인. F1 upstream0. 캡처 앞부분 reverse seek 시0drivers/미수신 state로 복귀.
- 실제 next-session response:United States GP Practice1,2026-10-23T17:30:00Z →한국2026-10-24 02:30 KST. 조회시점의 calendar 기록이며 일정이 변경될 수 있음.

## 최종 브라우저 및 CLI 회귀

- 최신 화면에서 NO ACTIVE SESSION / LIVE · WAITING / STALE, TimingData age unavailable, LIVE TELEMETRY Unavailable을 확인. 다음 United States Practice1 시간이 KST로 표시됨. Desktop1440 및 Mobile390에서 가로 overflow 없음, console error/warning0.
- Capture Replay의 Home seek에서 driver/detail/telemetry가 Waiting/Unavailable로 제거되고 End에서 실제22명 snapshot으로 복귀. 캐시된 파일 재생의 upstream은0.
- Bahrain Simulated Live는 EXACT / SIMULATED,20/20 cars,VER1:32.608 L39. Historical Replay로 전환 후에도20/20 cars,같은 기록을 확인.
- 이미 실행 중인 dev backend에 capture-live --duration3을 붙인 추가시험에서도 upstream1,종료 후 HTTP200/기존 server 유지. 경기 없는 이3초 구간에는 새 채널 메시지가 없어 NOT RECEIVED/0으로 기록됐으며 이전 snapshot은 명시된 bootstrap으로만 남음. 이를 continuous feed로 판단하지 않음.
- captures/raw,server.js,src/capture/journal.js의 실제 HTTP 접근은404. 원본ZIP SHA2569155a7c4c786a08240e3a0f0fae8bd5faec564ddf86fe843424b023557c44b11과 Bahrain gzip522e1d1f4ba8fb3d0088bf3453e4e8d7538e7878428a595098a7c621faae8891 보존 확인.

[Desktop 준비 화면](qa/capture-ready-desktop.jpg), [Mobile 준비 화면](qa/capture-ready-mobile.jpg).

## Blind validation

[기계 판독 결과](ESTIMATED_POSITION_VALIDATION.json), [설명/출처](ESTIMATED_POSITION_VALIDATION.md). Bahrain20drivers,432280 held-out actual OpenF1 location records 중5초 sample 평가. estimator input은 received archive TimingData(70208patches)와 independent2022-derived MultiViewer circuit geometry. GPS는 평가 단계만 읽음. UTC alignment는Heartbeat로만 계산; GPS로 timestamp 튜닝하지 않음.

- evaluated21079 /eligible22380,coverage94.19%.
- circular lap progress median3.85% /p95 6.25%.
- approximate XY distance median180.67m /p95 326.85m.
- completed-lap+estimated-progress vs real OpenF1 classification pairwise ordering97.67%,179152pairs.
- median150m gate를넘어fail. 기본활성화안함. geometry/timing timestamp uncertainty와endpoint hold 때문에 lane/position 정확도를 주장하지 않음.

## 자동검사

기존15개를 그대로 유지하며 capture9개추가: **24/24 pass**. 기존 Bahrain20drivers/432280locations/VER92.608 lap39/provenance/track consistency도통과. 새 cases는 실제 snapshot 및 compressed fixtures를 사용하며 unknown/schema/connection/privacy adversarial inputs는 명시적unit harness로 구분. active-race 검증으로 가장하지 않음.

주요 파일:src/live/{collector,protocol,hub-events,pipeline,diagnostics,health,position-estimator,session-discovery}.js,src/capture/{privacy,journal,replay}.js,scripts/{capture-live,analyze-capture,replay-capture,live-command-utils,validate-estimated,check-syntax}.js,tests/capture.test.js,실제mini-sector fixture,server.js,replay.js,index.html,styles.css,models.d.ts,package.json,README/.gitignore. 기존 일반모드 app.js와normalizedBahraincache/원본ZIP 보존.

남은 실제검증:10~15분active continuous feed/방송비교,라이브Position/CarData실payload,실제재접속 및세션전환,오디오접근조건. 공개배포하지않음. [실행체크리스트](LIVE_SESSION_CHECKLIST.md).

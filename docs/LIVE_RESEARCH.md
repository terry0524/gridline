# 무료 Live source 조사 및 연결 범위 — 2026-10-12

실시간 F1 Second Screen과 실제 차량 위치 목표를 유지한다. OpenF1 paid Live, F1 TV 영상/로그인/DRM 우회는 사용하지 않는다. 기존 실제 Bahrain Historical Replay는 보존한다. 이번 구현은 무료 timing collector와 실제 과거 데이터를 쓰는 Simulated Live이며, **무료 실제 Live 좌표는 미확보**다.

## 후보와 A / B / C 구분

| 후보 | 현재 source code / 직접 확인 | 판정 |
|---|---|---|
| F1 SignalR **Core** anonymous | 실제 OPTIONS(405), POST negotiate(200), WebSocket open, Hub handshake/Subscribe 성공, 공개 14 topic snapshot | **B**: F1 소유 공개 접근 endpoint이나 공개 개발자 API 계약/재배포 허가가 아님. Node collector로 선정. 진행 중 세션의 연속 feed는 미검증 |
| FastF1 3.8.3 | 최신 PyPI·GitHub release 2026-04-29. `SignalRClient`는 명칭만 legacy이며 Core 구현. `no_auth=True` 지원, empty/partial 가능 경고 | B의 다른 client. 별도 provider 또는 무료 GPS 보장 아님. Python recorder 도입 없이 Node로 직접 연결 |
| f1-dash / f1-live-api / pitwall | 모두 F1 Core를 backend가 읽어 자체 API로 전달 | 동일 B upstream을 쓰는 참고 구현. 독립 무료 provider 아님 |
| LiveF1 legacy SignalR | 코드의 `/signalr/negotiate` 실제 HTTP 401 | 현재 동작한다고 검증되지 않아 선택 제외. Core migration 가능성은 별도 조사 대상 |
| OpenF1 Historical / Jolpica | 공개 문서·과거 데이터 / 일정·확정 results·standings | 문서가 있는 공개 데이터 서비스(A 범주), 실시간 위치 대안이 아님. 기존 용도 유지 |
| 인증이 요구되는 timing/CarData/Position 및 F1TV media | 권한 발급·paywall/DRM 우회 없이 무료 사용 가능하다고 확인하지 못함 | **C 우회 방식은 제외**. 공개 접속 B와 유료 영상 우회를 혼동하지 않음 |

정식 공개 API로 무료 전체 live timing+GPS를 제공하며 이 앱의 공개 배포까지 허용한 공급원은 이번 조사에서 확인되지 않았다. **B의 접근 성공은 A의 이용 허가를 의미하지 않는다.** [F1 Guidelines의 Timing Data 항목](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt)은 timing의 권리 및 상당량 데이터 재사용 제한을 설명한다. [Legal Notices](https://www.formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt)도 적용 검토 대상이다. 구현/시험은 localhost에 한정했고 공개·상업 배포나 라이선스 계약은 하지 않았다. OSS 코드 라이선스는 원천 데이터·음성·영상 재배포 권리를 주지 않는다.

## f1-dash source pipeline — README 외 실제 코드 추적

검토 commit `d21607afbbab44a97863a605bad174d3c92367f2`, repository pushed 2026-06-14, [AGPL-3.0](https://github.com/slowlydev/f1-dash/blob/main/LICENSE).

1. [signalr/src/lib.rs](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/signalr/src/lib.rs): `https://livetiming.formula1.com/signalrcore/negotiate` OPTIONS에서 익명 AWSALBCORS affinity cookie, POST `negotiateVersion=1`, transient `connectionToken`; `wss://livetiming.formula1.com/signalrcore?id=…` 연결. JSON Hub handshake + record separator `0x1e`. `Subscribe` 호출. completion(type 3) snapshot, feed(type 1) `[topic,data,utc]`.
2. [realtime/src/f1.rs](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/realtime/src/f1.rs): 17 topic Subscribe, initial state 설치, topic별 updates를 broadcast하고 state에 merge. SessionInfo 변경 시 ingestion 재시작.
3. [realtime/src/main.rs](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/realtime/src/main.rs): 단일 ingestion task와 reconnect loop.
4. [state_service.rs](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/realtime/src/services/state_service.rs): nested object / numeric index patch merge. full snapshot과 incremental update 분리.
5. [http_server/realtime.rs](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/realtime/src/http_server/realtime.rs): 자체 Axum `/api/realtime` **SSE**, 초기 전체 state+update+keepalive. browser당 F1 WebSocket 생성하지 않음.
6. [useSocket.ts](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/dashboard/src/hooks/useSocket.ts): frontend EventSource `NEXT_PUBLIC_LIVE_URL/api/realtime`.
7. [useDataEngine.ts](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/dashboard/src/hooks/useDataEngine.ts): 200 ms buffer, timestamp/delay, `.z` inflation, Zustand updates.
8. [Map.tsx](https://github.com/slowlydev/f1-dash/blob/d21607afbbab44a97863a605bad174d3c92367f2/dashboard/src/components/dashboard/Map.tsx): 확인한 버전은 actual positions store가 주석 처리되어 있고 timing mini-sector progress로 위치를 근사한다. 그 지도 동작을 **무료 실제 GPS 수신 증거로 삼지 않았다**.

F1 upstream Core WebSocket → Rust collector/merge → 자체 SSE → browser. OpenF1/FastF1를 경유하지 않는다. 17 topics는 아래 공개 14개에 `Position.z`, `CarData.z`, `ChampionshipPrediction`을 더한 구성이다. Subscribe에 썼다는 사실이 수신 권한을 증명하지 않는다. 코드·자산을 가져오지 않고 wire 규격과 경계만 독립 구현했다.

## FastF1 및 다른 유지보수 프로젝트

- [FastF1 v3.8.3 실제 client](https://github.com/theOehrly/Fast-F1/blob/v3.8.3/fastf1/livetiming/client.py), [release](https://github.com/theOehrly/Fast-F1/releases/tag/v3.8.3), [MIT](https://github.com/theOehrly/Fast-F1/blob/v3.8.3/LICENSE). main SHA `227cf301fb4bcf1705bcb1866de1fe5dbcef6071`, pushed 2026-10-02. release와 main 모두 `signalrcore` 패키지를 사용. 기본 경로는 인증 token, `no_auth=True`는 익명 일부 데이터. `LiveTimingData`는 수집 파일을 Session.load에 주는 사후 파서이고 즉시 RaceState를 제공하지 않는다. async_start는 지원되지 않으며 reconnect도 이 client만으로 완성되지 않는다. 우리 프로세스에서 Python package를 설치/실행한 것은 아니고 **공식 source + 동등 Core handshake**를 확인했다.
- [harsh779/f1-live-api](https://github.com/harsh779/f1-live-api/blob/7e2040aa01641f92a6242f9c6e755c3a0142210e/src/f1timing/client.js), MIT, pushed 2026-06-21. Node Core negotiate→WebSocket→snapshot/feed→parser/자체 API. 같은 F1 upstream.
- [darshjoshi/pitwall topics.py](https://github.com/darshjoshi/pitwall/blob/2a70ceba16b85e45696094bfb6392c96fb4cc0d2/topics.py), MIT, pushed 2026-08-02. Python raw Core client와 FREE_TOPICS. source는 `Position.z`/`CarData.z`를 2025-08 이후 인증 topic으로 구분한다. 이것은 유지보수 프로젝트의 설명이며 F1의 공개 API 계약으로 해석하지 않았다. 실제 익명 추가 topic probe에서도 데이터가 돌아오지 않았다.
- [LiveF1](https://github.com/GoktugOcal/LiveF1), MIT, SHA `7e3594762984d439068642225909adcfa3111982`, pushed 2026-09-13. `RealF1Client` / signalr_aio / constants를 추적했으며 확인 버전의 legacy `/signalr` 요청은 401. README만으로 사용 가능한 후보로 남기지 않았다.
- [IAmTomShaw/f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay/blob/81369312f90956c6e226f6b00ab6cef541b24559/src/f1_data.py), pushed 2026-10-09. FastF1 cache/load→reference lap/frame 생성. [services/stream.py](https://github.com/IAmTomShaw/f1-race-replay/blob/81369312f90956c6e226f6b00ab6cef541b24559/src/services/stream.py)는 자체 replay frame TCP fanout이고 live upstream이 아니다. recursive tree에 license 파일을 찾지 못해 코드·자산 재사용하지 않았다. 하나의 clock, 공통 state, source/renderer 분리 개념만 참고했다.

## 직접 확인한 source channels / 실제 schema

2026-10-12 10:39 KST 첫 probe 및 11:01 KST 구현 collector 재검증. 인증 credentials 없음. load-balancer cookie/익명 transport token은 메모리에만 유지하며 로그·SSE·파일로 노출하지 않는다. affinity cookie는 로그인 token이 아니다. 실제 수신 session **11388, Singapore GP Race, Ends/Finalised, 62/62**. snapshot은 현재 경기 검증이 아니다.

| topic | 실제 응답과 adapter |
|---|---|
| Heartbeat | `Utc`; source timestamp. 현재 벽시계로 snapshot을 새 기록처럼 만들지 않음 |
| DriverList | numeric driver key, Tla, FullName, TeamName, TeamColour; 22명 |
| TimingData | Lines[n].Position, GapToLeader, IntervalToPositionAhead.Value, NumberOfLaps, LastLapTime.Value, BestLapTime.Value/Lap, InPit, PitOut, NumberOfPitStops, Retired |
| TimingAppData | Lines[n].Stints numeric/array patches, Compound, TotalLaps; stint tire age |
| TimingStats | Lines[n].PersonalBestLapTime.Value/Lap; best lap 보완 |
| SessionInfo | Key, Meeting/Circuit, StartDate/EndDate + GmtOffset, safe archive Path |
| SessionStatus | Status=Ends, Started=Finished; active session 구분 |
| LapCount | CurrentLap=62, TotalLaps=62 |
| TrackStatus | Status / Message. 1 green,2 yellow,4 SC,5 red,6 VSC,7 VSC ending; 모르는 코드는 원문/대기 |
| WeatherData | string 수치 AirTemp30.2, TrackTemp41.5, Humidity77.4, Pressure1011.1, Rainfall0, WindSpeed1.4, WindDirection204. 초기 snapshot 자체 관측 시각 없음→null |
| RaceControlMessages | Messages[n].Utc/Message/Category/Flag/Scope/RacingNumber/Lap/Sector; 153개 |
| TeamRadio | Captures[n].Utc/RacingNumber/Path; 32 metadata. 링크만, 재생·재송출 없음 |
| ExtrapolatedClock / SessionData | 제공 확인. Extrapolating=false인 종료 clock을 현재 레이스 진행으로 해석하지 않음 |

추가 익명 probe는 `Position.z`, `CarData.z`, `ChampionshipPrediction`을 요청했다. Subscribe error는 없지만 **returned topics=[]**였다. 인증 우회를 시도하지 않았고 production collector는 이 세 topic을 요청하지 않는다. `.cache/research/extra-channels-probe.json`에 결과 저장.

별도 **공개 historical archive**의 Bahrain 2024 `Position.z.json`(HTTP200,502 bytes), `CarData.z.json`(HTTP200,298 bytes)로 raw-deflate/base64 parser만 검증했다:
- Position.Position[].Timestamp, Entries[n].X/Y/Z/Status.
- CarData.Entries[].Utc, Cars[n].Channels; 0 RPM,2 speed,3 gear,4 throttle,5 brake,45 DRS.
- archive 접근 성공은 무료 **Live** 좌표/telemetry 권한을 증명하지 않는다. 범위 밖 throttle/brake 값은 정상 %처럼 표시하지 않는다.

## 선택 및 구현 architecture

```text
F1 anonymous Core WebSocket             Actual cached Historical OpenF1 Bahrain
      ↓ one Node collector                       ↓ one ReplayStreamSource clock
Hub frame / delta patch parser                   ↓ Live Adapter (simulation)
      ↓ F1StateAdapter                        raceStateAt + shared fastest engine
      └───────────────── Normalized RaceState ───────────────┘
                                ↓ one RaceStreamService
                        SSE metadata + race-state, 4 Hz
                                ↓ browser EventSource
             shared timing/weather/control/detail + SVG rAF interpolation
```

- `collector.js`: 익명 negotiate/affinity/Hub handshake, 한 upstream, ping, timeout, exponential reconnect. 제한 채널과 F1 TV 계정은 사용하지 않음.
- `protocol.js`: record separator fragmented frames, bounded deflate, nested numeric-index patch, 위험한 prototype key 제거.
- `f1-adapter.js`: upstream 응답을 기존 number/location/gap/compound/tyreAge 이름의 RaceState로 변환. 기존 모델 이름을 유지해 UI를 재사용한다. weather timestamp·pit duration·DRS 정보 없으면 null.
- `simulation.js`: 캐시된 session 9472로 shared clock, pause/play/seek/1·2·4·8×. Historical Replay의 same state engine. telemetry는 **이미 받은 실제 historical window만**. 가상의 GPS/날씨/랩을 만들지 않는다.
- `service.js`: 연결한 client 수와 관계없이 source 1개. initial/reconnect full metadata+RaceState, 10s heartbeat,30 client local cap, slow-client backlog 제한. 모드는 server 하나에서 공유; 다른 client가 바꾸면 stream client 모두 같은 모드로 이동. 일반 Replay는 브라우저 자체 clock.
- `replay.js`: 공통 paintState, 기존 map projector + locationAt interpolation, 지속 SVG markers. stream gap 때 마지막 좌표 유지, SSE error에 RECONNECTING, stale source에 DELAYED/OFFLINE. 종료 snapshot은 LIVE · WAITING / OFFLINE. 실제 Live 좌표가 없으면 실제 circuit 형상만,0 markers. Bahrain 좌표를 다른 circuit에 재활용하지 않음.
- Fastest Lap은 `selectFastestLap`을 두 adapter에서 공유, 신규 기록 overlay + purple tower indicator. Live best/deleted correction은 source가 보낸 갱신대로 재계산. 과거 기록 지우기 여부를 상상하지 않음.

Team Radio의 익명 metadata/path 제공은 확인했다. 음성 재생/공개 재배포 권한 및 URL의 재생 가능성을 확인한 것은 아니다. 무료 timing stream을 이유로 오디오 권리까지 허용됐다고 가정하지 않았다.

## 비용과 남은 검증

현재 localhost 실행에 API subscription·API key·로그인·새 runtime package 비용 없음. Node >=22.22.0의 내장 fetch/WebSocket 사용. hosting을 선택할 때 hosting 비용과 source 사용권은 별도다.

무료 Live 좌표/telemetry, active session 연속 feed의 실시간 정확성, 장시간 collector reconnect, session change 당일 동작, 오디오 재생 권한, 공개 배포 허가가 남았다. 단일 익명 handshake + 종료 snapshot + 실제 과거 sim 검증을 전체 실제 Live 완성으로 표현하지 않는다. 실시간 Track Map 목표를 삭제하지 않았다.

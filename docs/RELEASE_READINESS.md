# Release readiness — 0.6.0-rc.1

검증일: 2026-10-13. 이번 단계의 신규 기능 개발을 마치고 로컬 Release Candidate로 취급합니다. 공개/상업 배포 완료나 실제 active-session Live 검증 완료를 의미하지 않습니다.

## READY

- HOME / SCHEDULE / STANDINGS / RESULTS / Race·Driver·Team Detail / Quick Jump / Championship progression: 기존 구현 유지. 기존 2024 final 및 현재 시즌 검증은 [제품 QA](PRODUCT_QA.md)와 [season evidence](qa/season-verification.json)에 별도 기록되어 있습니다.
- Imported Historical Replay: 2024 Bahrain (VALID), Monaco (PARTIAL: invalid stint 4개 제외), Belgian/Spa (VALID). 공통 renderer/clock/adapter, seek·속도·Battle·타이어·pit·Fastest Lap·Weather·Race Control.
- Session lookup / validation / normalization / indexes / versioned cache / manifest / imported-only selector / Replay deep links와 Race Detail CTA.
- 서버 cache-only 실행 및 로드 완료 후 browser network-off 재생. fresh page에는 로컬 서버가 필요합니다.
- Development-only Simulated Live / capture-live / analyze-capture / replay-capture를 보존. production UI/API에서 debug 도구 분리.
- 기존 33개 + RC 11개 = 44/44. 9화면 × 3viewport의 render/keyboard/overflow/console 및 503 retry/부분 장애 QA. [측정·한계](RC_QA.md).

## READY — NEEDS LIVE VALIDATION

- 기존 anonymous SignalR single collector, parser/patch merge, runtime capabilities, reconnect, RaceState adapter, SSE fanout, capture와 capture replay.
- Live Race Center의 Timing / intervals / lap / tires / Fastest Lap / Weather / Race Control / flag 상태 전달 구조.
- 다음 실제 세션에서 10–15분 이상 continuous feed, channel payload/freshness, source timestamp, 실제 중계와 비교, reconnect·SSE client cleanup·longer memory stability를 확인해야 합니다. [실행 체크리스트](LIVE_SESSION_CHECKLIST.md).
- 이번 작업은 `GRIDLINE_AUTO_LIVE=0`으로 QA했고 실제 source handshake조차 다시 실행하지 않았습니다. 이전 handshake 증거와 continuous feed 검증은 구분합니다.

## NOT AVAILABLE

- 무료 actual Live Position: payload 미검증. 없으면 Position unavailable; estimated prototype은 기본 OFF, Not GPS.
- 무료 actual Live Car telemetry: payload 미검증. historical telemetry는 Bahrain 일부 실제 cached 구간만 포함; Monaco/Spa는 이번 import에 포함하지 않았습니다.
- Team Radio audio 재생 및 onboard 영상: 미구현. metadata/reference만 유지, 인증/DRM/영상 우회 없음.
- DRS zone 정확한 지도, 공식 GIS/차선 위치 정확도, Championship Live Projection, 완전한 offline PWA.

## 운영 경계

- 유료 OpenF1 Live subscription·API key·필수 .env 없음. Historical OpenF1/Jolpica를 사용하고 Live source는 undocumented endpoint이므로 안정성·이용 조건을 보장하지 않습니다.
- npm dependency audit 0 vulnerabilities, 추가 외부 dependency 0. Node 런타임 취약점 검증·penetration test·장시간 leak 검증·완전 WCAG 인증은 수행하지 않았습니다.
- 기존 ZIP과 Bahrain v3 원본을 보존했습니다. 실제 replay caches는 현재 작업 공간에 있으므로 다른 환경에서는 import가 필요합니다.
- 수정된 replay schema의 cache key에 season/sessionKey/schemaVersion을 포함하고 manifest/file hash를 검증합니다. `--force` 재import 후에는 실제 source 변경에 맞춰 fixture를 재검증해야 합니다.

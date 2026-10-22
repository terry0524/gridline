# Release readiness — public historical library and hosted Timing

검증일:2026-10-22. 공개 사이트는 https://gridline-indol.vercel.app 입니다. 과거RC 검증 자료는 RC_QA.md / PRODUCT_QA.md / UI_READABILITY_QA.md에 보존합니다.

## READY

- HOME / SCHEDULE / STANDINGS / RESULTS / Race·Driver·Team Detail / Quick Jump / Championship progression: 기존 구현과 읽기 쉬운 UI 유지.
- 2023이후 종료 GP와 Sprint의 수집·검증·게시 pipeline, hash 검증 remote library, 기존3개 pinned Replay, 공통 renderer/clock/model, seek·속도·Battle·타이어·pit·Fastest Lap·Weather·Race Control.
- 완료된 Replay는 재배포 없이 manifest/selector/Results CTA에 반영. INVALID는 숨기고 누락·불일치는 PARTIAL DATA로 표시. 아직 수집되지 않은 GP는 AVAILABLE로 표시하지 않음.
- 공개 Replay 111개: 2023 GP 22 + Sprint 6, 2024 GP 24 + Sprint 6, 2025 GP 24 + Sprint 6, 2026 현재 종료 GP 17 + Sprint 6. 자동 검증 51 VALID / 60 PARTIAL, 노출 INVALID 0. 수집 실패·세션 매칭 실패 0. 상세 품질 경계는 PUBLISHING_STATUS.md 참고.
- Public Timing 연결의 deployment-disabled 오류 수정. Vercel 단일 Daemon → authenticated ingress → compressed regional runtime cache → SSE. 종료 session snapshot과 NO ACTIVE SESSION 표시 확인.
- 기존 local collector / Simulated Live / capture-live / analyze-capture / replay-capture 보존. production debug와 raw capture 비활성화.
- Local regression 54/54. Bahrain 20 drivers / 432,280 locations / VER 1:32.608 L39, Monaco/Spa 원본 fixture 보존. 대량 cache에 맞춰 Bahrain 테스트의 원본 파일 읽기 범위만 제한하고 모든 데이터 assertion 유지.

## READY — NEEDS LIVE VALIDATION

- 실제 진행 중 세션의10–15분 이상 continuous feed, channel payload/freshness, 중계 비교, Session rollover, 장시간 reconnect/memory stability.
- 공개 배포는 anonymous SignalR 연결과 종료 snapshot을 확인한 단계. 실제 active-session 검증 완료를 주장하지 않음. LIVE_SESSION_CHECKLIST.md 참고.

## NOT AVAILABLE / SOURCE DEPENDENT

- 무료 실제 Live Position / CarData: 현재 snapshot payload 없음. 다음 active-session에서 확인 필요. 실제 payload가 들어올 때만 capability가 켜짐.
- Team Radio audio/onboard 영상: 제공하지 않음. metadata/reference만 처리. 인증·DRM·유료 영상 우회 없음.
- 원본이 없는 과거 session /2023이전 OpenF1 Replay / 아직 수집·검증되지 않은 session.
- 공식 GIS/차선 위치 정확도, DRS zone, Championship Live Projection, 완전한 browser-only offline PWA는 미구현.

## 운영 경계

기존 Vercel Hobby의 Daemon/Function/cache/network quota 안에서 운영하며 자동 유료 전환을 활성화하지 않았습니다. Runtime cache는 ephemeral이며 누락·지연 시 마지막 정상 상태와 waiting/reconnecting/offline을 구분합니다. 무료 API/undocumented F1 source의 안정성이나 이용 허가는 보장하지 않습니다. 비상업 팬 프로젝트의 데이터 attribution/라이선스는 NOTICE.md에 유지합니다.

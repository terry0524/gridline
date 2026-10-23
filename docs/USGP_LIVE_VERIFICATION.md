# 2026 미국 GP 한시적 Live 수신 점검

공식 일정: https://www.formula1.com/en/racing/2026/united-states

| 세션 | 한국 시간 KST | GitHub 예약 UTC |
| --- | --- | --- |
| FP1 | 10월 24일 02:30 | 10월 23일 17:25 |
| FP2 | 10월 24일 06:00 | 10월 23일 20:55 |
| FP3 | 10월 25일 02:30 | 10월 24일 17:25 |
| Qualifying | 10월 25일 06:00 | 10월 24일 20:55 |
| Race | 10월 26일 05:00 | 10월 25일 19:55 |

`Verify US GP 2026 Live reception` workflow가 기존 공개 서버의 단일 collector에 SSE client 하나로 접속합니다. F1 원본 연결을 추가하지 않습니다. 세션 시작 2분 후부터 15분간 관측하고, GitHub 예약 지연 시 남은 세션 구간에서 관측합니다. 현재 연도의 지정 세션 창 밖에서는 요청하지 않습니다. GitHub 예약 실행은 시작 시각이 보장되지 않으므로 여러 연습·예선·결승을 점검합니다.

성공 기준: 실제 2026 United States의 해당 세션, LIVE 모드, active 상태, 신선한 원본 TimingData timestamp, 10분 이상의 연속 freshness, 30회 이상의 원본 timestamp 전진, 3회 이상의 실제 timing 값 변화. handshake·과거 snapshot·수신 시각만 바뀌는 반복 데이터·simulated-live는 성공으로 판정하지 않습니다. 체크가 실패하면 workflow도 실패하며 결과 artifact는 남깁니다. 지연/중단/적기 미실행은 NOT VERIFIED로 구분하며 존재하지 않는 기록을 만들어 채우지 않습니다.

관측: Timing/gap/interval/lap/last/best/fastest/tire/age/pit/weather/race-control, 정확한 위치와 telemetry payload의 실제 유무, Radio metadata 건수, SSE 연결/종료/오류. 세션별 JSON/Markdown과 5초 간격 allowlist NDJSON을 30일간 GitHub artifact로 보관합니다. 이는 **normalized SSE 관측**이며 raw SignalR channel count, TV 중계 대조, 브라우저 검증, audio 접근 또는 GPS 정확도 검증과 다릅니다. raw frame, 쿠키, 토큰, 오디오 URL/reference는 저장하지 않습니다.

수동 transport-only 점검은 workflow dispatch의 `session=smoke`로 20초간 수행합니다. 이는 실제 active Live 검증을 뜻하지 않습니다. 로컬에서는 `OBSERVE_SESSION=smoke node scripts/verify-live-session.js`로 동일하게 실행합니다. `auto`는 현재 시간에 맞는 세션만 선택합니다. 유료 서비스·새 계정·새 secret은 필요하지 않습니다.

Codex의 이 채팅 heartbeat가 결과를 검토하고 첫 의미 있는 성공·새 capability·장애만 알립니다. GitHub 관측은 맥 전원과 무관하지만 Codex 알림은 앱이 실행될 때 처리됩니다. 10월 26일 오전 9시 이후 최종 보고 후 heartbeat를 정지하고 `gh workflow disable usgp-live-validation.yml --repo terry0524/gridline`로 이 한시적 점검을 종료합니다. 공식 일정 변경/연기는 검증 창을 갱신해야 합니다. 제품 UI·collector·Replay 코드에는 변경이 없습니다.

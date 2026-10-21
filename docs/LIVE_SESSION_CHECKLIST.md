# 다음 실제 F1 세션 체크리스트

Node >=22.22.0. 이 프로젝트 폴더에서 실행합니다. OpenF1 paid Live/API key/F1TV 로그인 없이 익명 timing만 사용합니다.

## 실행 — 터미널 2개

터미널 1:
```sh
npm run dev
```

터미널 2, 세션 시작 전에:
```sh
npm run capture-live
```

1. 출력된 `CAPTURE:` 폴더를 기억합니다. 기록은 같은 backend collector에 붙으므로 브라우저 수가 늘어도 upstream은 하나입니다.
2. [Race Center](http://localhost:3000/#live)에서 **LIVE · 무료 Timing → Timing 연결**. 기본 화면은 Historical Replay이므로 모드를 선택해야 실제 Live 화면입니다.
3. **LIVE SESSION AVAILABLE**와 TimingData의 age를 확인합니다. `NO ACTIVE SESSION`, `SESSION UNCONFIRMED`, 오래된 snapshot은 진행 중인 경기 검증으로 판단하지 않습니다. 일정 countdown만으로 LIVE가 되지 않습니다.
4. 실제 중계와 순위·Gap/Interval·Lap·Last/Best·Fastest·Tire/age·Pit·Weather·Race Control을 비교합니다. 중계 자체가 지연될 수 있으므로 화면의 session timestamp도 기록합니다.
5. **10~15분 이상 유지**하고 lap/position 변화, 신규 fastest, weather/control 갱신을 확인합니다. 가능하면 실제 lap/flag 사건이 발생한 시간을 메모합니다. 추정 위치 실험은 기본 OFF; 사용할 때만 checkbox를 켭니다. `ESTIMATED POSITION`은 GPS가 아닙니다.
6. 터미널 2에서 **Ctrl+C** 한 번. `CAPTURE SAVED:` 출력까지 기다립니다. 터미널 1의 서버는 계속 실행됩니다.
7. 분석과 재생:
```sh
npm run analyze-capture
npm run replay-capture -- captures/<CAPTURE-SAVED에-출력된-폴더명>
```
`analyze-capture`는 인자 없이 가장 최근 종료된 캡처를 선택합니다. 지정하려면:
```sh
npm run analyze-capture -- captures/<폴더명>
```
`replay-capture`가 출력한 URL을 열면 **CAPTURE REPLAY**입니다. Play/Pause/Seek/1·2·4·8× 및 연결 복구 시험을 사용할 수 있습니다. raw를 현재 parser/adapter에 다시 공급하며 F1 upstream에 연결하지 않습니다. 실제 Live와 혼동하지 않습니다.

## 결과 해석

- `RECEIVED`: 비어 있지 않은 지원 payload가 실제 도착. snapshot 1회와 continuous feed는 다릅니다. messageCount, first/lastReceivedAt, lastKind(snapshot/feed), payloadBytes를 함께 봅니다.
- `EMPTY`: 빈 payload/빈 optional subscription만 관측. optional subscription에 topic이 빠졌으면 messageCount는0이고 EMPTY로 표시합니다.
- `NOT RECEIVED`: 해당 topic의 메시지가 기록 구간에 전혀 없음.
- `ERROR`: 압축/shape/지원 schema 오류. 원문은 redaction 후 raw와 warning log에 남고 collector는 계속 실행.
- `Position.z`/`CarData.z`가 존재하거나 Subscribe가 성공했다는 이유로 Available이 되지 않습니다. 유효 좌표/telemetry 값이 필요합니다. 수신되면 자동으로 capability가 켜집니다.
- timing은5s 후 DELAYED,15s 후 STALE. weather는120s/300s 기준. snapshot은 관측 시각이 없을 수 있으며 이를 현재 시각으로 바꾸지 않습니다.
- reconnect 수, unknown frame 수, storageError, truncatedLines도 확인합니다. `storageError`가 있으면 정상 capture 완료로 판단하지 않습니다.
- 캡처 시작 전에 collector가 이미 데이터를 받았다면 metadata.bootstrap은 그 이전 merged state입니다. **captured raw frame으로 집계하지 않으며** 채널 messageCount도 늘리지 않습니다.
- Team Radio는 timestamp/driver/capture reference만 표시합니다. audio 접근·재생·재배포 권한은 확인하지 않았습니다.

## 저장 파일

`captures/<시작UTC-폴더명>/`: metadata.json, raw.ndjson, normalized.ndjson, capabilities.json, events.log. 분석 후 analysis.json 추가. 5초 checkpoint, Ctrl+C/정상 server 종료 시 finalization. cookie/token/auth/email/contact/IP 필드 및 흔한 credential 문자열은 저장 전 제거하며 정상 비민감 raw는 그대로 보존합니다. 접속 URL의 anonymous transport token/affinity cookie는 raw 기록 대상이 아닙니다. 공개 driver/team 식별 정보는 제품 데이터로 유지합니다.

captures/는 Git ignore 및 정적 서버 비노출입니다. 로컬 검증용으로 보관하고 공개 업로드는 별도 데이터 권리 검토 후 판단합니다. 강제 kill/전원 종료로 captureEndedAt가 null이면 finalized replay로 열지 않습니다. partial NDJSON의 잘린 마지막 줄은 분석에서 별도 집계합니다.

서버가 없을 때 `capture-live` 또는 `replay-capture`를 단독 실행하면 로컬 서버를 자동으로 시작합니다. 그 경우 별도 `npm run dev`는 필요 없으며 command 종료 시 자신이 시작한 서버만 종료합니다. 기존 dev server에 연결했으면 그 서버는 종료하지 않습니다.

이번 개발의 실제 endpoint 시험은 **종료된 Singapore snapshot의12초 기록**이며 active session continuous live 검증이 아닙니다.

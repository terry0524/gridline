# 데이터 및 참고 프로젝트 조사 — 2026-10-12

실시간 source의 추가 조사·최신 선택은 [LIVE_RESEARCH.md](LIVE_RESEARCH.md) 참조. OpenF1은 historical에만 사용하고 paid Live subscription 의존성을 두지 않는다.

## 선택

| 공급처 | 사용 범위 | 접근/한계 |
|---|---|---|
| [OpenF1](https://openf1.org/docs/) | 실제 Replay timing/location/weather/control/stints/pit/radio metadata, 선택 차량 telemetry | 2023 이후 과거 무료. live는 유료 권한; 세션 전후 30분 포함. 무료 3 req/s·30 req/min, 앱은 단일 큐 약 27 req/min. 위치 3.7 Hz 근사 좌표 |
| [Jolpica](https://github.com/jolpica/jolpica-f1) | 시즌 일정, 확정 standings, round progression, Race/Sprint/Qualifying 결과 | Live 위치 피드 아님. [데이터 CC BY-NC-SA 4.0](https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md). [호출 제한](https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md) 준수 필요; 앱 큐/캐시로 중복 감소 |
| [FastF1](https://github.com/theOehrly/Fast-F1) | 향후 Python batch importer / 교차검증 후보 | 캐시·Pandas telemetry 및 circuit metadata. [MIT](https://github.com/theOehrly/Fast-F1/blob/master/LICENSE); 데이터/미디어 권리와 별개. 이번 Node 앱에는 설치하지 않음 |
| [MultiViewer circuit API](https://api.multiviewer.app/api/v1/circuits/63/2024) | circuit rotation, corner metadata | OpenF1 meetings 공식 문서가 참조하는 서비스. 동일 raw x/y 좌표로 비교. 코너 오차 및 권리 검토 필요; 상업/공개 배포 권한을 가정하지 않음 |

일반 날씨 API는 이번 milestone에 연결하지 않음. 별도 forecast adapter가 필요할 때 air temperature/precipitation probability 필드를 분리하고 session track temperature를 대체하지 않도록 해야 함.

## 실제 응답 확인

2024 Bahrain Race `session_key=9472`, `meeting_key=1229`. 각 `sample-*.json`에는 성공 응답 URL, HTTP status, count, 실제 샘플이 있음. 원본 전체 응답은 `.cache/upstream`에 gzip으로 보존하고 SHA-256/fetchedAt을 추적. `replay-provenance.json` 참조.

| endpoint | 확인한 실제 필드 / 처리 |
|---|---|
| meetings | meeting_key, meeting_name, country, circuit_key, circuit_info_url, date_start/end |
| sessions | session_key, session_name/type, year, date_start/end; 명시적 session_key 선택으로 GP 모호성 제거 |
| drivers | driver_number, name_acronym, full_name, team_name, team_colour; hex color 검증 |
| position | date, driver_number, position; 시각 이전의 마지막 기록 |
| location | date, driver_number, x/y/z; compact [epochMs,x,y], timestamp 정렬·중복 제거 |
| intervals | date, gap_to_leader, interval; number/string/null 보존(예: +1 LAP) |
| laps | **date_start**, lap_duration, lap_number, sector durations, is_pit_out_lap; 완료 시각=start+duration |
| stints | lap_start/end, compound, tyre_age_at_start; lap 기반 선택, 누락 age는 null |
| pit | date, lap_number, lane_duration, stop_duration, pit_duration; 이번 2024 응답의 stop_duration은 null 가능 |
| weather | date, air/track_temperature, humidity, pressure, wind_speed/direction, rainfall; null을 0으로 바꾸지 않음 |
| race_control | date/category/flag/scope/message, driver/lap/sector optional; 원문 보존·시점 필터 |
| team_radio | date, driver_number, recording_url; 허용 원본 도메인 https 링크만, 플레이어 없음 |
| car_data | date, speed, throttle, brake(0/100), n_gear, rpm, drs; 선택 차량 한 분 구간 조회 |

OpenF1의 query parser는 비교 연산자를 문자열에서 처리함. `URLSearchParams({'date>': value})`는 `date%3E=value`가 되어 실제 `>=` 조회에 사용됨. `date>=`를 키로 넣으면 `>==`로 해석되어 이번 조사에서 HTTP 500이 발생함. 실제 성공 URL과 응답으로 확인 후 수정했음. 겹치는 구간 경계는 정규화 시 중복 제거.

DRS 코드: 공식 OpenF1 문서에서 10/12/14는 ON, 0/1은 OFF, 8은 eligible. 기타 코드는 추측하지 않고 UNKNOWN. 2026 세션에 동일한 DRS 체계가 존재한다고 가정하지 않음.

## 참고 프로젝트 — 복사 없이 조사

- [IAmTomShaw/f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay), 조사 SHA `81369312f90956c6e226f6b00ab6cef541b24559`. `src/f1_data.py`의 FastF1 load/cache, frame 생성, reference lap/rotation 경계를 확인. recursive tree에 LICENSE/COPYING 파일이 없었으므로 코드·자산 재사용하지 않음. simulated safety car 위치는 실측이 아니어서 채택하지 않음.
- [slowlydev/f1-dash](https://github.com/slowlydev/f1-dash), 조사 SHA `d21607afbbab44a97863a605bad174d3c92367f2`. api/realtime/signalr/dashboard 분리, `useDataStore`, LeaderBoard 및 Map의 circuit rotation/annotation 처리를 확인. [AGPL-3.0](https://github.com/slowlydev/f1-dash/blob/main/LICENSE). 코드·자산 재사용하지 않음. 조사한 Map의 segment progress 기반 근사 위치를 실측 GPS로 취급하지 않음.
- [Amicro](https://amicro.vercel.app/)와 제공 GitHub URL은 이번 도구 조회에서 열리지 않았음. 코드/자산을 사용하지 않음. Fastest Lap 알림은 데이터 사건을 전달하는 자체 구현이며 장식 animation 없음.

## 다음 작업의 근거

Championship projection을 만들 때 최신 [FIA 규정 목록](https://www.fia.com/regulation/category/110), 2026 Section A A2.2 및 해당 시즌 규정을 실제 scoring layer로 옮겨 검증해야 함. 이번 milestone은 projection을 구현하지 않았으며 점수를 새로 계산하지 않음. 2024 검증 GP의 공식 26점과 2025 이후 Fastest Lap bonus 폐지를 혼동하지 않아야 함.

UI는 기존 GRIDLINE web identity와 native HTML controls 유지. React/shadcn이 없는 프로젝트여서 UI 패키지 도입을 하지 않음. [Apple HIG accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)의 계층·가독성·상태 의미 원칙을 참고하되 웹 동작을 유지. 44px 컨트롤, 숫자 tabular alignment, 색+문자/기호, 키보드 선택, 모바일 progressive disclosure를 적용.

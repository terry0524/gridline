# Estimated Position — Bahrain blind validation

알고리즘 입력은 수신된TimingData와 독립 circuit geometry뿐이다. 실제2024 GPS를 feature/보정/시간 튜닝에 사용하지 않았다. 실제 좌표432280개가 있는 기존Historical Replay는 평가 기준으로만 읽었다.

## 재실행
```sh
npm run validate:estimated
```
원본 TimingData.jsonStream/Heartbeat.jsonStream은 `.cache/validation`에 보존한다. 없으면 공개2024Bahrain archive에서 실제 수집한다. 회귀 기준cache를 덮어쓰지 않는다. 응답 URL/bytes/SHA256,geometry candidate lap은[JSON결과](ESTIMATED_POSITION_VALIDATION.json)에 있다.

- predictor: mini-sector current lap의 처음부터 연속으로 확인된 completion status2048/2049/2050/2051만 사용. reset0/carry-over2064/unknown은 진행 증거로 확정하지 않음. geometry.miniSectorsIndexes의 endpoint를 arc length로 정규화해trackProgress0~1을 얻음. pit/out/retired/stopped/geometry mismatch는unavailable.
- geometry: MultiViewer circuit63/2024. candidate reference는2022-03-18 BahrainFP1 VERlap3이며2024 held-outGPS가 아니다.
- time: archive relative timestamp+Heartbeat UTC의 medianoffset. race 중 증가하는heartbeat400개,offsetp05/p95 약1.9초 범위. GPS를보고offset을조정하지않음.
- scoring: 전체race5초간격. 실제location을 동일centerline에 nearest-segment projection해 circular lap-progress error를 평가. Euclidean distance는[FastF1 원천position 단위1/10m](https://github.com/theOehrly/Fast-F1/blob/main/fastf1/core.py)를 적용한근사값. [mini-sector schema reference](https://github.com/matteocelani/f1-telemetry/blob/main/docs/live-timing-types.md)도검토했으나코드를복사하지않았다. 직접받은실제Bahrain패치를기준으로parser를검증했다.
- ordering: 예측NumberOfLaps+progress 순서를실제OpenF1classification과pairwise비교. sourcePosition값으로예측순서를만들지않음. road상같은lap순서/차선정확도의증거는아님.

| 지표 | 실제 결과 |
|---|---:|
| 평가 추정/유효 실제좌표 |21079/22380|
| coverage |94.19%|
| lap progress 중앙값 /p95 |3.85% /6.25%|
| position distance 중앙값 /p95 |180.67m /326.85m|
| driver ordering accuracy |97.67%|

사전 gate는coverage≥70%,median≤150m,p95≤500m,p95progress≤10%,ordering≥90%. **median기준fail →기본OFF**. 실험checkbox로만estimated 표시하며tooltip은`Estimated from timing data. Not GPS.`다. exact측정이있으면항상우선한다. 정상값이없으면추정하지않는다.

성능 한계: endpoint는다음timingupdate까지정지,carry-over판단불확실,source별time acquisition차이,2022 centerline과2024location차이,approximateGPS/lateral placement한계. 다른GP로일반화검증하지않았고임의구간별GPS보정은하지않았다.

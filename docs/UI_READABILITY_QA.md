# GRIDLINE readability / hierarchy QA

2026-10-13 · UI presentation-only update. 변경 기존 파일: `app.js`, `index.html`, `styles.css`.

## 현재 화면 감사와 변경

이번 run에서 기존1440px Home/Schedule/Standings/Results/Race Detail/Driver Detail/Team Detail/Replay를 직접 캡처했습니다. 각 `*-before-1440.png`에 원본 화면이 있습니다.

1. Home: Your race week headline, GP,5세션 strip,큰 inactive Race Center가 비슷한 강도로 경쟁했습니다. GP를63.36px(primary),countdown48px,다음 세션22px/시각16px로 만들었습니다. 주말은 다음1세션만 보여주고 VIEW WEEKEND가 기존Schedule로 연결됩니다. Schedule의 다음주말 이동 + Weekend disclosure로5세션을 확인했습니다.
2. Championship: 동시에10명/팀과 작은 metadata가 노출됐습니다. Home만 각Top3으로 줄이고 실제 이름·순위·점수와 Standings link를 유지합니다. 전체순위는 기존Standings에 남습니다.
3. Recent Race: 중복Results links,team/points metadata,podium3cards를 GP이름+podium3명으로 축약했습니다. 최근경기Replay availability 규칙은 유지합니다. 실제Live가 확인될 때만 WATCH LIVE가 강한CTA로 표시되고 inactive 영역은 숨깁니다.
4. Schedule:22px GP제목/16px 시각,14px session disclosure,12px tertiary상태. GP 사이 whitespace를 늘리고 현재 주말 강조를 보존했습니다.
5. Standings/Results: 주요값16px/points22px/보조14px,기존표·전환·차트 유지.768px 이하에서는 compact list로 reflow하며 글자를 축소하지 않습니다.
6. Race/Driver/Team Detail:32–40px 제목,24–28px 핵심facts,16px 결과rows,14px supporting정보. Podium 배경·과도한 border를 제거하고 실제 season정보를 유지합니다.
7. Race Center/Replay:timing항목/20명/차량/animation 유지. Driver15–16px,Gap/Tire14px,랩세부12px,선택Driver수치18–20px. 세션설정·capability/source·telemetry·Battle은 native details로 공개합니다. 핵심session/lap/health/fastest/weather/control은 유지하며 실제 오류·PARTIAL 경고는 접지 않습니다. Race panels의outer border/반복card배경을 제거했습니다.
8. Responsive:Desktop220pxsidebar/14pxtext/52px이상hitarea;Mobile64pxnav/핵심본문16px/GP36–40px. 작은globalnav/tertiarylabels12px전후는 역할상 유지합니다. Timing정보를 숨기거나 전체RaceCenter를 Desktop비율로 축소하지 않습니다.

[1440px Home 비교](qa/readability/home-comparison-1440.png): 변화전후 같은viewport에서 실제캡처를 나란히 확인했습니다. GP가 첫focal point가 되고 기존hero의red border,sessiongrid divider,inactiveRaceCentercontainer,mini-rowdivider,podiumcard배경이 제거됐습니다. 정보량 감소분을 더 큰글자와 section spacing에 사용했고 한화면에 모든section을 맞추지 않았습니다.

## Typography / UX 근거

Systemfont와tabularfigures를 유지했습니다. 주요본문/데이터16px,보조14px,제한된metadata12px를 적용하고 작은uppercase/letter-spacing의 사용을 줄였습니다. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines)의clarity/hierarchy와[Typography](https://developer.apple.com/design/human-interface-guidelines/typography)를 참고했습니다. Web기존vanillaCSS체계를 유지하며 nativeApplecomponent를 복제하거나 shadcn/framework/Amicro 의존성을 추가하지 않았습니다.

Hick:Home선택수와동시정보량감소. Progressive Disclosure:주말상세·세션설정·source·telemetry·Battle. Proximity:GP/시각/countdown과nextsession,summaryrows는group내가깝게,group간32–56pxspacing. VonRestorff:HomeprimaryGP와activeLive/action에강조제한. Fitts:Desktopnav52px+와touch44px+,nativekeyboarddetails/focus유지.

## 화면 QA

Production local preview, `GRIDLINE_AUTO_LIVE=0 GRIDLINE_OFFLINE=1`; 실제active-sessionLive를연결하거나검증하지않았습니다.9화면×5너비 **45개조합** 직접로드/캡처,render성공,page/table overflow0. 수정후clean browser session의consoleerror/warning0. [matrix](qa/readability/matrix.json),각 `<view>-after-<width>.png`와viewport별contactsheet를보존했습니다.

| 화면 | 1440 | 1024 | 768 | 390 | 320 |
|---|---|---|---|---|---|
| home | PASS | PASS | PASS | PASS | PASS |
| schedule | PASS | PASS | PASS | PASS | PASS |
| standings | PASS | PASS | PASS | PASS | PASS |
| results | PASS | PASS | PASS | PASS | PASS |
| race-detail | PASS | PASS | PASS | PASS | PASS |
| driver-detail | PASS | PASS | PASS | PASS | PASS |
| team-detail | PASS | PASS | PASS | PASS | PASS |
| race-center | PASS | PASS | PASS | PASS | PASS |
| replay | PASS | PASS | PASS | PASS | PASS |

## 실제 상호작용 및 regression

- Home VIEW WEEKEND→Schedule→다음주말이동→FP1/FP2/FP3/Qualifying/Race확인.
- Constructors전환,RoundsliderArrowLeft,QuickJump Monaco2024검색 확인.
- Monaco lap65 모바일TIMING/TRACK/LIVE/CONTROL/DRIVER전환:20markers,EXACT POSITION,HAM1:14.165/L63,실제sessionweather,102control events. Battle disclosure에서LEC vsPIA실제비교값 확인.
- Bahrain20drivers,VER1:32.608/L39,4x선택,Endseek→Lap57. 세션disclosureEnter키로열리고loadcontrol접근확인.
- 기존44/44통과,syntaxcheck통과. 데이터/Replay/collector/router/API/tests를변경하지않았고beforeSHA와대조한[protectedfilehashes](qa/readability/preserved-files.json)에보존증거를기록했습니다. [tests](qa/readability/readability-tests.log),[syntax](qa/readability/readability-check.log),[interaction evidence](qa/readability/interactions.json).
- QA중telemetrylabel의기존DOMhook을누락해Replay오류가발생했고markup에복원했습니다. Replayengine수정없이해결했으며실패캡처는최종after이미지로대체했습니다.

## 검증 한계

SCREENREADER/physicalphone/fullWCAG인증은아닙니다. 긴table/chart는전체페이지캡처+상단contactsheet로검토했으며정보동일성을hash+기존actualdataregression으로확인했습니다. LiveCTA의실제active-session노출은source를연결하지않아이번에검증하지않았습니다. 기능추가·API재설계·newanimation없음.

import {circuitArt} from './src/circuit-art.js';
import {brand} from './src/brand.js';
import {parseRoute} from './src/router.js';
import {weekendStatus} from './src/season-model.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:1});
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone,zone=timezone==='Asia/Seoul'?'KST':timezone;
const date=at=>Number.isFinite(at)?new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(at):'시간 미정';
const currentYear=new Date().getFullYear();let route=parseRoute(location.href),data=null,activeStanding='drivers',resultKind=route.kind,sequence=0,replayModule=null,chartModule=null,availabilityPromise=null,detailSequence=0,refreshing=false;
const seasonCache=new Map(),seasonLoadedAt=new Map(),chartSelection=new Map();const href=(view,year=route.year)=>`/${view}${year!==currentYear?'?season='+year:''}`;
const raceURL=m=>`/results/${m.season}/${m.slug}`,driverURL=id=>`/drivers/${route.year}/${id}`,teamURL=id=>`/teams/${route.year}/${id}`;
const driverLink=(d,cls='')=>d.id?link(driverURL(d.id),d.name,cls):`<span class="${cls}">${esc(d.name)}</span>`;
const teamLink=t=>t.id?link(teamURL(t.id),t.name):esc(t.name);
const visibleRaces=()=>{const rows=new Map((data?.earlyResults??[]).map(m=>[m.round,m]));for(const m of data?.races??[])rows.set(m.round,m);return [...rows.values()].sort((a,b)=>a.round-b.round);};
const publication=m=>m?.resultStatus==='PROVISIONAL'?'잠정 결과':m?.resultStatus==='SOURCE_RESULT'?'OpenF1 게시 결과':'게시 결과';
const link=(url,text,cls='')=>`<a href="${esc(url)}" data-route class="${cls}">${esc(text)}</a>`;
async function api(url){const r=await fetch(url);const d=await r.json();if(!r.ok)throw Error(d.error??`HTTP ${r.status}`);return d;}
function empty(message='No data available'){return`<div class="empty">${esc(message)}</div>`;}
function failure(message){return`<div class="empty error-state"><strong>${esc(message)}</strong><p>데이터 공급원 또는 연결 상태를 확인한 후 다시 시도하세요.</p><button class="results-btn" data-retry>다시 시도</button></div>`;}
function busy(id,label){$(id).innerHTML=`<div class="skeleton" role="status">${esc(label)} 불러오는 중…</div>`;}
function setBrand(){document.title=`${brand.name} — ${brand.descriptor}`;$('#brandName').textContent=brand.name.toUpperCase();$('#brandDescriptor').textContent=brand.descriptor.toUpperCase();$('#brandInitial').firstChild.textContent=brand.initial;$('#footerBrand').textContent=brand.name.toUpperCase();$('#brandDisclaimer').textContent=brand.disclaimer;$('#localZone').textContent=`YOUR TIMEZONE · ${zone}`;}
setBrand();$('#seasonSelect').innerHTML=Array.from({length:currentYear-2022},(_,i)=>currentYear-i).map(y=>`<option value="${y}">${y}</option>`).join('');$('#seasonSelect').value=route.year;
function updateNav(){$('#results').classList.toggle('is-race-detail',route.view==='results'&&Boolean(route.slug));
 const back = $('#replayResultsLink');
 back.classList.toggle('hidden', route.view !== 'replay');
 if (route.view === 'replay' && route.slug) back.href = `/results/${route.year}/${encodeURIComponent(route.slug)}`;
 const section=['replay','race-center'].includes(route.view)?'race-center':['drivers','teams'].includes(route.view)?'standings':route.view;document.querySelectorAll('.view').forEach(e=>e.classList.toggle('active',e.id===(section==='race-center'?'live':['drivers','teams'].includes(route.view)?'entity':section)));document.querySelectorAll('#nav a').forEach(e=>{e.classList.toggle('active',e.dataset.view===section);if(e.dataset.view===section)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');e.href=e.dataset.view==='home'?'/':href(e.dataset.view);});$('#breadcrumbs').textContent=`${route.year} SEASON / ${section.toUpperCase().replace('-',' ')}`;$('#seasonSelect').value=route.year;$('.season-label').classList.toggle('hidden',section==='race-center');$('#homeSeason').textContent=`FORMULA ONE · ${route.year} SEASON`;}
async function navigate(url,{replace=false}={}){if(replace)history.replaceState(null,'',url);else history.pushState(null,'',url);route=parseRoute(location.href);updateNav();window.scrollTo(0,0);await renderRoute();$('#mainContent').focus({preventScroll:true});}
document.addEventListener('click',e=>{const a=e.target.closest('[data-route]');if(a&&a.tagName==='A'&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&e.button===0){e.preventDefault();$('#quickJump').close();navigate(a.href);}if(e.target.closest('[data-retry]')){seasonCache.delete(route.year);loadSeason(true);}});
window.addEventListener('popstate',()=>{route=parseRoute(location.href);updateNav();renderRoute();});window.addEventListener('hashchange',()=>{if(location.pathname==='/'&&/^#(?:dashboard|calendar|standings|results|live|home|schedule|race-center)$/.test(location.hash)){route=parseRoute(location.href);updateNav();renderRoute();}});
document.addEventListener('gridline-replay-loaded',e=>{if(!['race-center','replay'].includes(route.view))return;const {key,year,slug}=e.detail;const url=`/replay/${year}/${slug}?session=${key}`;if(location.pathname+location.search!==url)history.pushState({},'',url);route=parseRoute(location.href);updateNav();$('#breadcrumbs').textContent=`${year} REPLAY / RACE CENTER`;});
$('#seasonSelect').addEventListener('change',()=>{const y=Number($('#seasonSelect').value);navigate(route.view==='results'?`/results?season=${y}`:['drivers','teams','replay','race-center'].includes(route.view)?`/standings?season=${y}`:href(route.view==='home'?'':route.view,y));});
async function loadSeason(force=false,{waitForFresh=force}={}){const id=++sequence,year=route.year;if(!force&&seasonCache.has(year)&&Date.now()-(seasonLoadedAt.get(year)??0)<300000){data=seasonCache.get(year);availabilityPromise=null;return renderSeasonRoute();}const retaining=force&&data?.season===year,previousAt=data?.fetchedAt,previousRevision=data?.resultRevision;if(!retaining)data=null;if(!retaining)$('#apiStatus').textContent='불러오는 중…';if(!retaining)for(const target of ['#nextRace','#topDrivers','#topTeams','#recentResult','#raceList','#fullStandings','#resultsContent','#raceDetail','#entityContent','#championshipChart'])busy(target,'시즌 데이터');if(!retaining){$('#resultMeeting').disabled=true;$('#standingsRound').textContent=year+' 시즌 standings 불러오는 중…';}try{const d=await api(`/api/season/${year}${waitForFresh?'?refresh=1':''}`);if(!d.errors.schedule){seasonCache.set(year,d);seasonLoadedAt.set(year,Date.now());}if(d.refreshing)setTimeout(()=>{if(id===sequence&&route.year===year&&!['race-center','replay'].includes(route.view))loadSeason(true);},5000);if(id!==sequence||route.year!==year)return;if(retaining&&d.errors.schedule&&data.schedule.length){updateSeasonStatus(d);return;}data=d;availabilityPromise=null;updateSeasonStatus(d);if(retaining&&previousAt===d.fetchedAt&&previousRevision===d.resultRevision){if(route.view==='home')renderNext();else if(route.view==='results')renderResults();}else renderSeasonRoute();}catch(e){if(id!==sequence)return;$('#apiStatus').textContent='시즌 데이터 연결 실패';for(const target of ['#nextRace','#topDrivers','#topTeams','#recentResult','#raceList','#fullStandings','#resultsContent','#raceDetail','#entityContent','#championshipChart'])$(target).innerHTML=failure('시즌 데이터를 가져오지 못했습니다. '+e.message);}}
function updateSeasonStatus(season) {
 const status = $('#apiStatus');
 status.textContent = Object.keys(season.errors).length ? '일부 데이터 연결 오류' : season.stale && season.season === currentYear ? '캐시된 데이터' : '';
 status.title = `${season.source} · ${date(Date.parse(season.fetchedAt))}`;
}
async function ensureReplay(){if(availabilityPromise)return availabilityPromise;const year=route.year;availabilityPromise=api(`/api/season/${year}/replays/`).catch(()=>{availabilityPromise=null;return null;});return availabilityPromise;}
async function renderRoute(){if(['race-center','replay'].includes(route.view)){$('#apiStatus').textContent='';try{await ensureRaceCenter();}catch(e){$('#liveMessage').textContent='Race Center 데이터를 가져오지 못했습니다: '+e.message;}return;}if(!data||data.season!==route.year)await loadSeason();else if(Date.now()-(seasonLoadedAt.get(route.year)??0)>=300000)await loadSeason(true);else renderSeasonRoute();}
function renderSeasonRoute(){if(!data)return;$('#resultMeeting').disabled=false;updateSeasonStatus(data);if(route.view==='home')renderHome();if(route.view==='schedule')renderSchedule();if(route.view==='standings')renderStandings();if(route.view==='results')renderResults();if(['drivers','teams'].includes(route.view))renderEntity();}
function sessionsHTML(m){const next=m.sessions.find(s=>s.start!==null&&s.start>Date.now());return m.sessions.map(s=>`<div class="weekend-session ${s===next?'next-session':''}"><strong>${esc(s.name)}</strong><time datetime="${s.start?new Date(s.start).toISOString():''}">${date(s.start)}</time><small>${s===next?'NEXT SESSION':s.start&&s.start<Date.now()?'Completed':'Upcoming'}</small></div>`).join('');}
function renderNext(){
 const next=data.schedule.find(m=>m.start!==null&&m.start>Date.now()),m=next??data.schedule.at(-1);
 if(data.errors.schedule){$('#nextRace').innerHTML=failure('일정 조회 실패');$('#weekendSchedule').replaceChildren();return;}
 if(!m){$('#nextRace').innerHTML=empty('No season calendar available');$('#weekendSchedule').replaceChildren();return;}
 const left=Math.max(0,(m.start??Date.now())-Date.now()),d=Math.floor(left/86400000),h=Math.floor(left/3600000)%24,min=Math.floor(left/60000)%60;
 const title=m.name.replace(/\sGrand Prix$/i,''),art=circuitArt[m.circuit.id];
 $('#nextRace').innerHTML=`<div class="gp-hero"><div class="gp-copy" style="--title-scale:${Math.min(1,10/title.length)}"><div class="race-round"><span class="signal-label">${next?'NEXT GRAND PRIX':'SEASON COMPLETE'}</span><span>ROUND ${String(m.round).padStart(2,'0')} / ${esc(m.country)}</span></div><h1 class="race-name"><span>${esc(title)}</span><span>Grand Prix</span></h1><div class="hero-location">${esc(m.circuit.name)}<span>${esc(m.locality??m.country)}</span></div></div><figure class="circuit-figure ${art?'':'no-circuit'}"><span class="hero-round" aria-hidden="true">${String(m.round).padStart(2,'0')}</span>${art?`<img class="circuit-art" src="/assets/circuits/${esc(m.circuit.id)}.svg" alt="${esc(m.circuit.name)} 실제 서킷 윤곽" width="600" height="440"><figcaption><span>CIRCUIT REFERENCE</span><span>${art.referenceYear} · OpenF1</span></figcaption>`:`<figcaption>${esc(m.country)} / ${esc(m.locality??'')}</figcaption>`}</figure></div><div class="race-departure"><div class="race-date"><span class="eyebrow">LIGHTS OUT</span><time datetime="${m.start?new Date(m.start).toISOString():''}">${date(m.start)}<span>${esc(zone)}</span></time></div>${next?`<div class="countdown" aria-label="Race 시작까지 ${d}일 ${h}시간 ${min}분"><div class="count-cell"><strong>${String(d).padStart(2,'0')}</strong><small>DAYS</small></div><span class="count-separator" aria-hidden="true">:</span><div class="count-cell"><strong>${String(h).padStart(2,'0')}</strong><small>HOURS</small></div><span class="count-separator" aria-hidden="true">:</span><div class="count-cell"><strong>${String(min).padStart(2,'0')}</strong><small>MINUTES</small></div></div>`:'<span class="muted">다음 시즌 일정 대기 중</span>'}</div>`;
 const session=m.sessions.find(s=>s.start!==null&&s.start>Date.now());
 $('#weekendSchedule').innerHTML=`<div class="next-session-copy"><span class="eyebrow">${session?'NEXT SESSION':'WEEKEND'}</span>${session?`<strong>${esc(session.name)}</strong><time datetime="${new Date(session.start).toISOString()}">${date(session.start)} · ${esc(zone)}</time>`:'<span class="muted">Completed</span>'}</div>${link(href('schedule'),'VIEW WEEKEND ↗','primary')}`;
}
function mini(rows,kind){return rows.slice(0,3).map(r=>`<div class="mini-row"><span class="pos">${fmt(r.position)}</span><i class="team-bar" style="--team:${r.team.color}"></i>${link(kind==='drivers'?driverURL(r.id):teamURL(r.id),kind==='drivers'?r.driver.name:r.team.name,'driver-name')}<span class="pts">${fmt(r.points)}<small>PTS</small></span></div>`).join('')||empty('아직 공개된 Championship 순위가 없습니다.');}
function podium(m){return`<div class="podium">${m.results.filter(x=>x.position>=1&&x.position<=3&&x.classification!=='DSQ').map(x=>`<div style="--team:${x.team.color}"><span>P${x.position}</span><div>${x.driver.id?link(driverURL(x.driver.id),x.driver.abbreviation??x.driver.name):esc(x.driver.abbreviation??x.driver.name)}<small>${esc(x.driver.name)} · ${esc(x.team.name)}</small></div><strong>${fmt(x.points)}<small>PTS</small></strong></div>`).join('')}</div>`;}
function renderHome(){
 renderNext();$('#topDrivers').innerHTML=data.errors.drivers?failure('Driver standings 조회 실패'):mini(data.standings.drivers,'drivers');$('#topTeams').innerHTML=data.errors.constructors?failure('Constructor standings 조회 실패'):mini(data.standings.constructors,'constructors');
 const recent=visibleRaces().at(-1);
 $('#recentResult').innerHTML=data.errors.race&&!recent?failure('최근 Race 결과 조회 실패'):recent?`<div class="recent-heading"><h3>${esc(recent.name)}</h3>${link(raceURL(recent),'Full results ↗','text-btn')}</div>${recent.resultStatus&&recent.resultStatus!=='PUBLISHED'?`<p class="result-publication">${esc(publication(recent))}</p>`:''}<div class="home-podium">${recent.results.filter(x=>x.position>=1&&x.position<=3&&x.classification!=='DSQ').map(x=>`<div style="--team:${x.team.color}"><span class="podium-position">${x.position}</span>${x.driver.id?link(driverURL(x.driver.id),x.driver.name,'podium-name'):esc(x.driver.name)}</div>`).join('')}</div>`:empty('아직 Race 결과가 없습니다.');
 pollHomeLive();
}
$('#homeLive').addEventListener('click',async()=>{await navigate('/race-center');$('#openLiveSession').click();});
async function pollHomeLive(){try{const info=await api('/api/live/session?auto=1');const available=info.mode==='live'&&info.availability==='LIVE SESSION AVAILABLE';$('#homeLiveState').textContent=available?'LIVE SESSION':info.availability==='NO ACTIVE SESSION'?'NO ACTIVE SESSION':'SESSION UNCONFIRMED';$('#homeLive').disabled=!available;$('#homeLivePanel').classList.toggle('hidden',!available);}catch{$('#homeLiveState').textContent='SESSION UNCONFIRMED';$('#homeLive').disabled=true;$('#homeLivePanel').classList.add('hidden');}}
const calendarDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const countryCodes = new Map(Object.entries({
 Australia: 'AU', China: 'CN', Japan: 'JP', Bahrain: 'BH', 'Saudi Arabia': 'SA',
 USA: 'US', 'United States': 'US', Canada: 'CA', Monaco: 'MC', Spain: 'ES',
 Austria: 'AT', UK: 'GB', 'United Kingdom': 'GB', Belgium: 'BE', Hungary: 'HU',
 Netherlands: 'NL', Italy: 'IT', Azerbaijan: 'AZ', Malaysia: 'MY', Singapore: 'SG',
 Mexico: 'MX', Brazil: 'BR', Qatar: 'QA', UAE: 'AE', 'United Arab Emirates': 'AE',
}));
const countryFlag = country => {
 const code = countryCodes.get(country);
 return code ? String.fromCodePoint(...Array.from(code, letter => letter.charCodeAt(0) + 127397)) : '';
};

function renderSchedule() {
 $('#calendarYear').textContent = data.season;
 $('#calendarZone').textContent = zone;
 if (data.errors.schedule) {
  $('#raceList').innerHTML = failure('일정을 불러오지 못했습니다.');
  return;
 }
 const now = Date.now();
 const completed = new Set(visibleRaces().map(race => race.round));
 const featured = data.schedule.find(meeting => weekendStatus(meeting, now, completed.has(meeting.round)) === 'THIS WEEKEND')
  ?? data.schedule.find(meeting => meeting.start > now);
 $('#raceList').innerHTML = data.schedule.map(meeting => {
  const active = meeting === featured;
  const status = weekendStatus(meeting, now, completed.has(meeting.round));
  const caption = active ? (status === 'THIS WEEKEND' ? '이번 주말' : '다음 경기') : '';
  const title = meeting.name.replace(/ Grand Prix(?= in |$)/i, '');
  const start = meeting.sessions.reduce((earliest, session) =>
   Number.isFinite(session.start) ? Math.min(earliest, session.start) : earliest, meeting.start ?? Infinity);
  const weekend = Number.isFinite(meeting.start)
   ? calendarDate.formatRange(start, meeting.start)
   : '날짜 미정';
  const flag = countryFlag(meeting.country);
  const id = meeting.circuit.id;
  const art = Object.hasOwn(circuitArt, id);
  return `<a class="calendar-event${active ? ' calendar-event-current' : ''}" data-route href="${esc(raceURL(meeting))}" aria-label="라운드 ${meeting.round} · ${esc(meeting.name)} · ${esc(weekend)}${caption ? ' · ' + caption : ''}">
    <span class="calendar-event-top">${flag ? `<span class="calendar-flag" aria-hidden="true">${flag}</span>` : ''}<span>${esc(weekend)}</span>${active ? `<span class="calendar-current-dot" title="${caption}" aria-hidden="true"></span>` : ''}</span>
    <span class="calendar-event-art" aria-hidden="true"><span class="calendar-round">${meeting.round}</span>${art ? `<span class="calendar-track"><span style="--track:url('/assets/circuits/${esc(id)}.svg')"></span></span>` : `<span class="calendar-circuit-name">${esc(meeting.circuit.name)}</span>`}</span>
    <strong>${esc(title)}</strong>
  </a>`;
 }).join('') || empty('시즌 일정이 없습니다.');
}

const delta=r=>r.change===null?'—':r.change>0?`↑${r.change}`:r.change<0?`↓${Math.abs(r.change)}`:'—';
function renderStandings(){const rows=data.standings[activeStanding];$('#standingsRound').textContent=`${route.year} · ROUND ${data.standings.round||'—'} 종료 · CHANGE는 직전 Round 종료 순위 대비`;document.querySelectorAll('[data-standing]').forEach(b=>{const on=b.dataset.standing===activeStanding;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});$('#fullStandings').innerHTML=data.errors[activeStanding]?failure('Standings 조회 실패'):rows.length?`<div class="table-wrap"><table class="domain-table"><caption class="sr-only">${route.year} ${activeStanding} standings</caption><thead><tr><th>POS</th><th>${activeStanding==='drivers'?'DRIVER / TEAM':'TEAM'}</th><th>POINTS</th><th>WINS</th><th>CHANGE</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="POS">${fmt(r.position)}</td><th scope="row" style="--team:${r.team.color}">${link(activeStanding==='drivers'?driverURL(r.id):teamURL(r.id),activeStanding==='drivers'?r.driver.name:r.team.name,'entity-link')}${activeStanding==='drivers'?`<small>${link(teamURL(r.team.id),r.team.name)}</small>`:''}</th><td data-label="POINTS" class="points-value">${fmt(r.points)}</td><td data-label="WINS">${fmt(r.wins)}</td><td data-label="CHANGE" title="직전 라운드 대비 순위 변화">${delta(r)}</td></tr>`).join('')}</tbody></table></div>`:empty('No published standings available');renderChart('#championshipChart',activeStanding,rows.slice(0,4).map(r=>r.id));}
for(const b of document.querySelectorAll('[data-standing]'))b.addEventListener('click',()=>{activeStanding=b.dataset.standing;if(data)renderStandings();});
async function renderChart(target,kind,ids){const year=route.year,holder=$(target);if(!holder)return;if(data.errors.race||data.errors.sprint){holder.innerHTML=failure('차트의 Race / Sprint 결과를 가져오지 못했습니다.');return;}holder.innerHTML='<div class="skeleton">실제 라운드 점수 차트 불러오는 중…</div>';chartModule??=import('./chart.js');const chart=await chartModule;if(year!==route.year||!document.contains(holder)||!data)return;const selectionKey=year+'/'+kind+'/'+target+(target==='#entityChart'?route.slug:'');chart.mountPointsChart(holder,data.progression,kind,chartSelection.get(selectionKey)??ids,{onSelectionChange:selected=>chartSelection.set(selectionKey,selected)});}
$('#resultMeeting').addEventListener('change',()=>{const m=data?.schedule.find(m=>m.round===Number($('#resultMeeting').value));if(m)navigate(raceURL(m));});for(const b of document.querySelectorAll('[data-result]'))b.addEventListener('click',()=>{resultKind=b.dataset.result;const m=selectedMeeting();if(m)navigate(`${raceURL(m)}?tab=${resultKind}`);});
function selectedMeeting(){if(route.slug)return data?.schedule.find(m=>m.slug===route.slug);const recent=data?.schedule.filter(m=>visibleRaces().some(r=>r.round===m.round)||m.start!==null&&Date.now()>=m.start+4*3600000).at(-1);return recent??data?.schedule.find(m=>m.round===data.races.at(-1)?.round)??data?.schedule[0];}
async function renderResults(){const m=selectedMeeting();if(!m){$('#resultMeeting').innerHTML='<option value="">No Grand Prix available</option>';$('#raceDetail').innerHTML=empty('No calendar data available');$('#resultsContent').innerHTML=empty();return;}resultKind=['race','sprint','qualifying'].includes(route.kind)?route.kind:'race';$('#resultMeeting').innerHTML=data.schedule.map(m=>`<option value="${m.round}">R${String(m.round).padStart(2,'0')} · ${esc(m.name)}${visibleRaces().some(r=>r.round===m.round)?' · 결과 있음':m.start!==null&&Date.now()>=m.start+4*3600000?' · 결과 대기':''}</option>`).join('');$('#resultMeeting').value=m.round;const id=++detailSequence;busy('#raceDetail','경기 정보');document.querySelectorAll('[data-result]').forEach(b=>{const active=b.dataset.result===resultKind;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});busy('#resultsContent',resultKind.toUpperCase());try{const d=await api(`/api/season/${route.year}/${m.round}/${resultKind}`);if(id!==detailSequence||route.view!=='results')return;renderRaceDetail(resultKind==='race'&&d.meeting?d.meeting:m,id);$('#resultsContent').innerHTML=d.meeting?.results.length?`<p class="result-publication" role="status">${esc(publication(d.meeting))}${d.meeting.resultUpdatedAt?' · '+date(d.meeting.resultUpdatedAt):''}</p>`+resultTable(d.meeting.results,resultKind):empty(resultKind==='sprint'?'Sprint 결과 없음 · Sprint가 없는 주말이거나 아직 게시되지 않았습니다.':resultKind==='race'&&m.start!==null&&Date.now()>=m.start+4*3600000?'경기 결과 게시를 기다리는 중입니다.':'아직 게시된 세션 결과가 없습니다.');}catch(e){if(id===detailSequence){renderRaceDetail(m,id);$('#resultsContent').innerHTML=failure(`${resultKind.toUpperCase()} 결과 조회 실패: ${e.message}`);}}}
$('#refreshResults').addEventListener('click',async()=>{const button=$('#refreshResults');button.disabled=true;button.textContent='결과 확인 중…';try{await loadSeason(true);}finally{button.disabled=false;button.textContent='결과 새로고침';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&data&&!['race-center','replay'].includes(route.view)&&Date.now()-(seasonLoadedAt.get(route.year)??0)>=300000)loadSeason(true);});
function resultTable(rows,kind){const q=kind==='qualifying';return`<div class="table-wrap"><table class="domain-table results-table"><caption class="sr-only">${kind} classification</caption><thead><tr>${(q?['POS','DRIVER / TEAM','Q1','Q2','Q3']:['POS','DRIVER / TEAM','TIME / GAP','GRID','POINTS']).map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr><td data-label="POS">${q?fmt(x.position):['DNF','DNS','DSQ','DNQ'].includes(x.classification)?x.classification:fmt(x.position)}</td><th scope="row" style="--team:${x.team.color}">${driverLink(x.driver,'entity-link')}<small>${teamLink(x.team)}</small></th>${q?['q1','q2','q3'].map(k=>`<td data-label="${k.toUpperCase()}">${esc(x[k]??'—')}</td>`).join(''):`<td data-label="TIME / GAP">${esc(x.classification==='CLASSIFIED'&&x.laps!==null&&x.laps<(rows.find(r=>r.position===1)?.laps??0)?`+${(rows.find(r=>r.position===1)?.laps??0)-x.laps} Lap(s)`:x.time??'—')}</td><td data-label="GRID">${x.grid===0?'PIT':fmt(x.grid)}</td><td data-label="POINTS" class="points-value">${fmt(x.points)}</td>`}</tr>`).join('')}</tbody></table></div>`;}
function renderRaceDetail(meeting, id) {
 const race = meeting.results ? meeting : visibleRaces().find(row => row.round === meeting.round);
 const fastest = race?.results.find(row => row.fastest?.rank === 1);
 const pole = race?.results.find(row => row.grid === 1);
 const winner = race?.results.find(row => row.position === 1);
 const heading = route.slug ? 'h1' : 'h2';
 const year = route.year;
 const round = meeting.round;
 const weekend = data.schedule.find(item => item.round === round) ?? meeting;
 $('#raceDetail').innerHTML = `
  <div class="race-detail-heading weekend-heading">
   <div>
    <div class="eyebrow">R${String(round).padStart(2, '0')} · ${esc(meeting.country)}</div>
    <${heading}>${esc(meeting.name)}</${heading}>
    <p class="muted">${esc(meeting.circuit.name)} · ${date(meeting.start)} · ${esc(zone)}</p>
   </div>
   <div id="detailReplay" aria-live="polite"></div>
  </div>
  <details class="weekend race-weekend-sessions"><summary>주말 세션 일정</summary><div class="weekend-detail">${sessionsHTML(weekend)}</div></details>
  ${race ? podium(race) + `
   <div class="race-facts">
    <div class="fact-fastest"><small>FASTEST LAP</small><strong>${esc(fastest?.driver.abbreviation ?? '—')} ${esc(fastest?.fastest.time ?? '—')}</strong>${fastest ? `<span>Lap ${fmt(fastest.fastest.lap)}</span>` : ''}</div>
    <div id="racePole"><small>GRID P1</small><strong>${esc(pole?.driver.abbreviation ?? '—')}</strong></div>
    <div><small>LAPS</small><strong>${fmt(winner?.laps)}</strong></div>
    <div><small>RACE TIME</small><strong>${esc(winner?.time ?? '—')}</strong></div>
   </div>
   <details class="weekend race-weekend-sessions"><summary>경기 날씨</summary><p id="raceWeatherSummary" class="muted"></p></details>
  ` : ''}
 `;
 const current = () => id === detailSequence && route.view === 'results' && route.year === year;
 const renderReplayAction = available => {
  if (!current()) return;
  const entry = available?.meetings.find(item => item.round === round);
  $('#detailReplay').innerHTML = entry?.sessionKey
   ? link(`/replay/${year}/${weekend.slug}?session=${entry.sessionKey}`, '▶ 리플레이', 'primary')
   : '';
 };
 ensureReplay().then(renderReplayAction);
 if (!race) return;
 api(`/api/season/${year}/${round}/qualifying`).then(payload => {
  if (!current() || payload.meeting?.resultStatus === 'PROVISIONAL') return;
  const first = payload.meeting?.results.find(row => row.position === 1);
  if (first) $('#racePole').innerHTML = `<small>POLE</small><strong>${esc(first.driver.abbreviation ?? first.driver.name)}</strong>`;
 }).catch(() => {});
 const weather = $('#raceWeatherSummary');
 weather.parentElement.addEventListener('toggle', async () => {
  if (!weather.parentElement.open || weather.textContent) return;
  weather.textContent = '불러오는 중…';
  try {
   const result = await api(`/api/season/${year}/${round}/facts`);
   weather.textContent = result.weather ? `기온 ${fmt(result.weather.air)}°C · 노면 ${fmt(result.weather.track)}°C` : '날씨 기록이 없습니다.';
  } catch {
   weather.textContent = '날씨 기록을 불러오지 못했습니다.';
  }
 });
}

function renderEntity(){const driver=route.view==='drivers',kind=driver?'drivers':'constructors',standing=data.standings[kind].find(r=>r.id===route.slug),entity=driver?(standing?.driver??data.progression.drivers.find(d=>d.id===route.slug)):(standing?.team??data.progression.constructors.find(t=>t.id===route.slug));if(!entity){$('#entityContent').innerHTML=empty('이 시즌에서 드라이버 또는 팀을 찾을 수 없습니다.');return;}const records=data.races.flatMap(m=>m.results.filter(x=>driver?x.driver.id===entity.id:x.team.id===entity.id).map(x=>({round:m.round,meeting:m,...x}))),podiums=records.filter(x=>x.position>=1&&x.position<=3&&x.classification==='CLASSIFIED').length,team=driver?(standing?.team??records.at(-1)?.team):entity;$('#entityContent').innerHTML=`<div class="page-intro"><div><div class="eyebrow">${route.year} SEASON · ${driver?'DRIVER':'CONSTRUCTOR'} PROFILE</div><h1 class="profile-name">${esc(entity.name)}</h1><p>${driver?'#'+fmt(entity.number)+' · '+esc(team?.name??'Team unavailable'):esc(entity.nationality??'')}</p></div>${link(href('standings'),'STANDINGS ↗','results-btn')}</div><div class="race-facts"><div><small>CHAMPIONSHIP</small><strong>P${fmt(standing?.position)}</strong></div><div><small>POINTS</small><strong>${fmt(standing?.points)}</strong></div><div><small>WINS</small><strong>${fmt(standing?.wins)}</strong></div><div><small>RACE PODIUMS</small><strong>${fmt(podiums)}</strong></div></div>${!driver?teamContributions(entity.id):''}<div class="section-head"><h2>SEASON RESULTS</h2><span class="muted">Race points · Sprint는 차트와 기여 점수에 포함</span></div><div class="season-panel">${records.length?`<div class="table-wrap"><table class="domain-table"><caption class="sr-only">Season race results</caption><thead><tr><th>ROUND</th><th>GRAND PRIX / DRIVER</th><th>GRID</th><th>FINISH</th><th>POINTS</th></tr></thead><tbody>${records.map(r=>`<tr><td data-label="ROUND">${r.round}</td><th scope="row">${link(raceURL(r.meeting),r.meeting.name)}${!driver?`<small>${link(driverURL(r.driver.id),r.driver.name)}</small>`:''}</th><td data-label="GRID">${r.grid===0?'PIT':fmt(r.grid)}</td><td data-label="FINISH">${r.classification==='CLASSIFIED'?fmt(r.position):esc(r.classification)}</td><td data-label="POINTS">${fmt(r.points)}</td></tr>`).join('')}</tbody></table></div>`:empty('No season race results available')}</div><div class="section-head"><h2>POINTS PROGRESSION</h2></div><div id="entityChart" class="season-panel points-panel"></div>`;renderChart('#entityChart',kind,[entity.id]);}
function teamContributions(id){const contribution=new Map();for(const m of [...data.races,...data.sprints])for(const r of m.results)if(r.team.id===id){const prior=contribution.get(r.driver.id)??{driver:r.driver,points:0};prior.points+=r.points??0;contribution.set(r.driver.id,prior);}return`<div class="team-contributions"><h3>DRIVER CONTRIBUTION <small>Race + Sprint · 이 팀에서 획득</small></h3>${[...contribution.values()].sort((a,b)=>b.points-a.points).map(r=>`<div>${link(driverURL(r.driver.id),r.driver.name)}<strong>${fmt(r.points)} PTS</strong></div>`).join('')||empty('No driver contributions available')}</div>`;}
async function ensureRaceCenter(){if(!replayModule){$('#liveMessage').textContent='Race Center 모듈 불러오는 중…';if(window.gridlineConfig?.debug&&new URLSearchParams(location.search).has('capture')){$('#devModes').checked=true;configureDev();}try{replayModule=await import('./replay.js');}catch(e){$('#liveMessage').innerHTML=failure('Race Center 모듈 로드 실패');return;}}replayModule.refreshView();if(route.view==='replay'){const m=await api('/api/replay/manifest');const record=m.replays.find(r=>r.season===route.year&&r.slug===route.slug&&(!route.sessionKey||r.sessionKey===route.sessionKey));if(record)await replayModule.openHistorical(record.sessionKey,route.year,route.lap);else $('#liveMessage').textContent='Replay unavailable for this Grand Prix';}}
function configureDev(){const select=$('#raceMode');if(window.gridlineConfig?.debug&&$('#devModes').checked){for(const[value,text]of [['simulated-live','SIMULATED LIVE · QA'],['capture-replay','CAPTURE REPLAY · QA']])if(!select.querySelector(`option[value="${value}"]`))select.add(new Option(text,value));}else{if(['simulated-live','capture-replay'].includes(select.value))select.value='replay';select.querySelectorAll('option[value="simulated-live"],option[value="capture-replay"]').forEach(e=>e.remove());}select.dispatchEvent(new Event('change'));}
$('#devModes').addEventListener('change',configureDev);
$('#searchOpen').addEventListener('click',()=>{$('#quickJump').showModal();$('#searchInput').focus();search();});$('#searchClose').addEventListener('click',()=>$('#quickJump').close());document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchOpen').click();}});$('#searchInput').addEventListener('input',search);let searchSeq=0;
async function search(){const seq=++searchSeq,q=$('#searchInput').value.trim().toLowerCase(),yearMatch=q.match(/\b(202[3-9])\b/),year=yearMatch?Number(yearMatch[1]):route.year;let d=data;if(year!==d?.season){$('#searchResults').innerHTML=empty('검색 시즌 데이터를 불러오는 중…');try{d=seasonCache.get(year)??await api(`/api/season/${year}`);seasonCache.set(year,d);seasonLoadedAt.set(year,Date.now());}catch{$('#searchResults').innerHTML=failure('검색 시즌 데이터를 가져오지 못했습니다.');return;}}if(seq!==searchSeq)return;const query=q.replace(/\b202[3-9]\b/,'').trim();const choices=[...d.schedule.map(m=>({name:`${m.name} · ${m.circuit.name}`,kind:`Grand Prix · ${year}`,url:raceURL(m)})),...d.standings.drivers.map(r=>({name:r.driver.name+' '+(r.driver.abbreviation??''),kind:`Driver · ${year}`,url:`/drivers/${year}/${r.id}`})),...d.standings.constructors.map(r=>({name:r.team.name,kind:`Team · ${year}`,url:`/teams/${year}/${r.id}`}))].filter(x=>!query||x.name.toLowerCase().includes(query)).slice(0,12);$('#searchResults').innerHTML=choices.map(x=>`<a data-route href="${x.url}"><strong>${esc(x.name)}</strong><small>${esc(x.kind)}</small></a>`).join('')||empty('검색 결과 없음');}
window.gridlineConfig=await api('/api/config').catch(()=>({debug:false}));$('.advanced-options').classList.toggle('hidden',!window.gridlineConfig.debug);updateNav();renderRoute();setInterval(()=>{$('#kst').textContent=zone+' '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());},1000);setInterval(()=>{if(route.view==='home'&&data){renderNext();pollHomeLive();}},30000);setInterval(()=>{if(!['race-center','replay'].includes(route.view)&&!refreshing){refreshing=true;loadSeason(true).finally(()=>refreshing=false);}},300000);

let resultPollTimer=null,resultPolling=false;
async function pollPublishedResults(){
 if(resultPolling)return;resultPolling=true;clearTimeout(resultPollTimer);let delay=60000;
 try{
  if(document.visibilityState!=='visible'||!data||route.year!==currentYear||['race-center','replay'].includes(route.view))return;
  const year=route.year,revision=await api(`/api/results/${year}/revision`);
  delay=Math.max(15000,Math.min(300000,revision.pollAfterMs??60000));
  if(route.year===year&&revision.revision&&revision.revision!==data.resultRevision)await loadSeason(true,{waitForFresh:false});
 }catch{ /* Keep the last displayed result during an optional update failure. */ }
 finally{resultPolling=false;resultPollTimer=setTimeout(pollPublishedResults,delay);}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pollPublishedResults();});
resultPollTimer=setTimeout(pollPublishedResults,1000);

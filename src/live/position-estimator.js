// Pure timing input only. Geometry comes from independent circuit metadata, never evaluated car positions.
export const ESTIMATOR_VERSION='mini-sector-endpoint-v1';
export const ESTIMATED_DEFAULT_ENABLED=false; // Blind-validation gate must pass before a default can change.
const list=v=>v&&typeof v==='object'?Object.keys(v).filter(k=>/^\d+$/.test(k)).sort((a,b)=>+a- +b).map(k=>v[k]):[];
const completed=new Set([2048,2049,2050,2051]); // Observed completion statuses; carry-over 2064 is ambiguous.
export function estimateTimingProgress(line,track){
 if(!line||line.InPit===true||line.PitOut===true||line.Retired===true||line.Stopped===true)return null;
 const segments=list(line.Sectors).flatMap(s=>list(s?.Segments));const indexes=track?.miniSectorsIndexes;
 if(!Array.isArray(indexes)||segments.length<3||indexes.length!==segments.length||!track?.points?.length)return null;
 // Stop at the first unconfirmed/reset segment. Never use last lap's later carry-over segments.
 let count=0;for(const segment of segments){if(!completed.has(segment?.Status))break;count++;}if(count===0)return null;
 const index=indexes[count-1];if(!Number.isInteger(index)||index<0||index>=track.points.length)return null;
 let total=0,covered=0;for(let i=1;i<track.points.length;i++){const d=Math.hypot(track.points[i][0]-track.points[i-1][0],track.points[i][1]-track.points[i-1][1]);total+=d;if(i<=index)covered+=d;}if(total<=0)return null;
 const progress=Math.min(.999999,Math.max(0,covered/total));return {trackProgress:progress,index,completedMiniSectors:count,totalMiniSectors:segments.length,method:ESTIMATOR_VERSION};
}
export function estimatedPoint(line,track,at){const p=estimateTimingProgress(line,track);if(!p)return null;const[x,y]=track.points[p.index];return {...p,at,x,y,interpolated:false,quality:'estimated'};}
export function applyPositionPriority(state,adapter,{allowEstimated=false,now=state.timestamp??Date.now()}={}){
 const exactAt=adapter?.topicAt.Position??null;for(const d of state.drivers){const exact=d.location;if(exact&&d.positionQuality!=='estimated'){d.positionQuality='exact';continue;}
  d.location=null;const at=adapter?.progressAt?.[d.number]??null;const line=adapter?.raw.TimingData?.Lines?.[d.number];const estimate=at!==null&&now-at<=15000?estimatedPoint(line,adapter?.track,at):null;d.estimatedLocation=estimate;d.trackProgress=estimate?.trackProgress??null;
  if(allowEstimated&&estimate){d.location=estimate;d.positionQuality='estimated';}else d.positionQuality='unavailable';}
 state.positionQuality=state.drivers.some(d=>d.positionQuality==='exact')?'exact':state.drivers.some(d=>d.positionQuality==='estimated')?'estimated':'unavailable';state.positionPolicy={estimatedEnabled:allowEstimated,defaultEnabled:ESTIMATED_DEFAULT_ENABLED,prototype:true,exactSourceTimestamp:exactAt};return state;
}

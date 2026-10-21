import {inflateRawSync} from 'node:zlib';
export const FREE_TOPICS=Object.freeze(['Heartbeat','DriverList','ExtrapolatedClock','RaceControlMessages','SessionInfo','SessionStatus','TeamRadio','TimingAppData','TimingStats','TrackStatus','WeatherData','SessionData','TimingData','LapCount']);
export const RESTRICTED_TOPICS=Object.freeze(['Position.z','CarData.z']);
const forbidden=new Set(['__proto__','prototype','constructor']);
export function mergePatch(base,patch,depth=0){
 if(depth>32)throw Error('Patch nesting limit');
 if(patch===null||typeof patch!=='object')return patch;
 if(Array.isArray(patch))return patch.map(v=>mergePatch(undefined,v,depth+1));
 const out=Array.isArray(base)?base.slice():{...(base&&typeof base==='object'?base:{})};
 for(const[k,v]of Object.entries(patch)){if(forbidden.has(k)||k==='_kf')continue;if(Array.isArray(out)&&(!/^\d+$/.test(k)||Number(k)>100000))throw Error('Invalid array patch index');out[k]=mergePatch(out[k],v,depth+1);}return out;
}
export function decodeTopic(topic,value){
 if(topic.endsWith('.z')){if(typeof value!=='string'||value.length>4*1024*1024)throw Error('Invalid compressed topic');const raw=inflateRawSync(Buffer.from(value,'base64'),{maxOutputLength:8*1024*1024});return {topic:topic.slice(0,-2),data:JSON.parse(raw.toString('utf8'))};}
 if(!value||typeof value!=='object')throw Error('Unexpected topic schema');return {topic,data:value};
}
export class FrameDecoder{
 buffer='';
 constructor({onUnknown=null}={}){this.onUnknown=onUnknown;}
 push(text){if(typeof text!=='string')throw Error('Text frame required');this.buffer+=text;if(this.buffer.length>8*1024*1024){this.buffer='';throw Error('Frame limit');}const packets=[];let i;while((i=this.buffer.indexOf('\x1e'))>=0){const part=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+1);if(part.trim()){try{packets.push(JSON.parse(part));}catch(error){if(!this.onUnknown)throw error;this.onUnknown({raw:part,reason:'Invalid JSON Hub packet',channel:null});}}}return packets;}
}
export const encodeFrame=value=>JSON.stringify(value)+'\x1e';
export function parseUtc(value){if(typeof value!=='string'||!value)return null;const v=/Z$|[+-]\d\d:\d\d$/.test(value)?value:value+'Z';const ms=Date.parse(v);return Number.isFinite(ms)?ms:null;}
export function numeric(v){if(v===null||v===undefined||v==='')return null;const n=typeof v==='number'?v:typeof v==='string'&&/^[+-]?\d+(\.\d+)?$/.test(v)?Number(v):NaN;return Number.isFinite(n)?n:null;}
export function lapSeconds(v){if(typeof v!=='string'||!/^\d+:\d\d\.\d+$/.test(v))return null;const[m,s]=v.split(':');const n=Number(m)*60+Number(s);return n>0?n:null;}

import {environment,debug,version} from './src/config.js';
import {deploymentSettings} from './src/deployment-config.js';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {getData,ProviderError,historicalTTL,isHistorical} from './src/provider.js';
import {listCaptures} from './src/capture/journal.js';
import {nextSession} from './src/live/session-discovery.js';
import {seasonData,weekendResults,replayAvailability,raceFacts} from './src/season-service.js';
import {RaceStreamService} from './src/live/service.js';
import {sessionCatalog,startReplay,replayStatus,getReplay,replayManifest} from './src/replay-loader.js';
const root=path.dirname(fileURLToPath(import.meta.url));const port=Number(process.env.PORT||3000);
const hosting=deploymentSettings(process.env,port);
const staticFiles=new Map([['/','index.html'],...['index.html','styles.css','app.js','replay.js','src/race-model.js','src/brand.js','src/season-model.js','src/router.js','chart.js'].map(f=>['/'+f,f])]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const openEndpoints=new Set(['meetings','sessions','drivers','position','location','intervals','laps','stints','pit','weather','race_control','team_radio','car_data','session_result']);
const limits=new Map();
const streams=new RaceStreamService();
async function readBody(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)throw new ProviderError('Request body too large',413);}try{const body=JSON.parse(text||'{}');if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid request body');return body}catch{throw new ProviderError('Invalid JSON body',400)}}
function send(req,res,status,data,headers={}){const body=Buffer.from(JSON.stringify(data));const gz=body.length>2048&&req.headers['accept-encoding']?.includes('gzip');res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Accept-Encoding',...(gz?{'content-encoding':'gzip'}:{}),...headers});res.end(gz?gzipSync(body):body);}
export async function handleRequest(req,res){
 try{
  if(!hosting.allowedHosts.has(req.headers.host))throw new ProviderError('Host not allowed',403);
  const u=new URL(req.url,'http://localhost');if(req.url.length>4096)throw new ProviderError('URL too long',414);
  if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(u.pathname==='/healthz')return send(req,res,200,{status:'ok',version});
  if(u.pathname.startsWith('/api/')){
   const ip=req.socket.remoteAddress;const now=Date.now();let bucket=limits.get(ip);if(!bucket||now-bucket.at>60000){bucket={at:now,count:0};limits.set(ip,bucket);}if(++bucket.count>180)return send(req,res,429,{error:'Local request limit exceeded'},{'retry-after':'60'});
   if(!['GET','POST'].includes(req.method))return send(req,res,405,{error:'Method not allowed'});
   if(req.method==='POST'&&req.headers.origin&&!hosting.allowedOrigins.has(req.headers.origin))return send(req,res,403,{error:'Origin not allowed'});
   if(u.pathname==='/api/config')return send(req,res,200,{environment,debug,version});
   if(u.pathname==='/api/replay/manifest')return send(req,res,200,await replayManifest());
   if(u.pathname==='/api/replay/sessions'){const year=Number(u.searchParams.get('year')||new Date().getFullYear());if(!Number.isInteger(year)||year<2023||year>new Date().getFullYear())throw new ProviderError('Invalid year',400);return send(req,res,200,await sessionCatalog(year));}
   const match=u.pathname.match(/^\/api\/replay\/(\d+)\/(load|status|data)$/);
   if(match){const key=Number(match[1]),action=match[2];if(!Number.isSafeInteger(key)||key<=0)throw new ProviderError('Invalid session key',400);if(action==='load'){if(!debug&&!await getReplay(key))throw new ProviderError('Replay unavailable',404);if(req.method!=='POST')throw new ProviderError('POST required',405);return send(req,res,202,await startReplay(key));}if(action==='status')return send(req,res,200,await replayStatus(key));const d=await getReplay(key);if(!d)return send(req,res,404,{error:'Session has not been imported'});return send(req,res,200,d);}
   const seasonRoute=u.pathname.match(/^\/api\/season\/(\d{4})(?:\/(replays|\d{1,2})\/(?:(race|sprint|qualifying|facts))?)?$/);
   if(seasonRoute){const year=Number(seasonRoute[1]),part=seasonRoute[2],kind=seasonRoute[3];if(part==='replays')return send(req,res,200,await replayAvailability(year));if(part)return send(req,res,200,kind==='facts'?await raceFacts(year,Number(part)):await weekendResults(year,Number(part),kind));return send(req,res,200,await seasonData(year));}
   if(u.pathname==='/api/system')return send(req,res,200,{app:'f1-live-companion',version});
   if(!debug&&(u.pathname.startsWith('/api/capture')||u.pathname==='/api/live/settings'||u.pathname==='/api/live/control'))throw new ProviderError('Developer tools are disabled',403);
   if(u.pathname==='/api/captures')return send(req,res,200,{captures:await listCaptures()});
   if(u.pathname==='/api/live/session'){if(hosting.liveEnabled&&!streams.mode&&u.searchParams.get('auto')!=='0'&&process.env.GRIDLINE_AUTO_LIVE!=='0')await streams.start('live');return send(req,res,200,{availability:streams.mode==='live'?streams.state?.health?.sessionAvailability||'SESSION UNCONFIRMED':'SESSION UNCONFIRMED',health:streams.state?.health??null,mode:streams.mode,session:streams.state?.session??null});}
   if(u.pathname==='/api/live/next-session')return send(req,res,200,await nextSession());
   if(u.pathname==='/api/capture/start'||u.pathname==='/api/capture/stop'){if(req.method!=='POST')throw new ProviderError('POST required',405);return send(req,res,200,u.pathname.endsWith('/start')?await streams.startCapture():await streams.stopCapture());}
   if(u.pathname==='/api/live/settings'){if(req.method!=='POST')throw new ProviderError('POST required',405);const body=await readBody(req);return send(req,res,200,streams.setEstimated(body.estimatedPosition===true));}
   if(u.pathname==='/api/live/status')return send(req,res,200,streams.info());
   if(u.pathname==='/api/live/events'){if(req.method!=='GET')throw new ProviderError('GET required',405);streams.subscribe(req,res);return;}
   if(u.pathname==='/api/live/start'){if(req.method!=='POST')throw new ProviderError('POST required',405);const body=await readBody(req);if(body.mode==='live'&&!hosting.liveEnabled)throw new ProviderError('Live source is disabled in this deployment',403);if(!debug&&body.mode!=='live')throw new ProviderError('Developer modes are disabled',403);try{return send(req,res,200,await streams.start(body.mode,body.mode==='capture-replay'?body.captureId:Number(body.sessionKey)))}catch(e){throw new ProviderError(e.message,400)}}
   if(u.pathname==='/api/live/control'){if(req.method!=='POST')throw new ProviderError('POST required',405);const body=await readBody(req);try{return send(req,res,200,streams.control(body.action,Number(body.value)))}catch(e){throw new ProviderError(e.message,400)}}
   const [, ,source,...parts]=u.pathname.split('/');const endpoint=parts.join('/');
   if(source==='openf1'&&!openEndpoints.has(endpoint)||source==='jolpica'&&!/^(current|\d{4})(\/\d{1,2})?(\/(driverstandings|constructorstandings|results|sprint|qualifying|drivers|constructors))?$/.test(endpoint)||!['openf1','jolpica'].includes(source))throw new ProviderError('Invalid API route',400);
   const params=Object.fromEntries(u.searchParams);let ttl=source==='jolpica'?300000:600000;
   if(source==='openf1'&&!['meetings','sessions'].includes(endpoint)){
    if(!/^\d+$/.test(params.session_key||''))throw new ProviderError('An explicit session_key is required',400);
    const env=await getData('openf1','sessions',{session_key:params.session_key},600000);if(!env.data[0]||!isHistorical(env.data[0]))throw new ProviderError('Live access requires authorization',403);ttl=historicalTTL;
   }
   const env=await getData(source,endpoint,params,ttl);return send(req,res,200,env.data,{'x-data-source':source,'x-data-updated':env.fetchedAt,'x-data-stale':String(env.stale),'x-cache':env.cache});
  }
  const route=/^\/(schedule|standings|results|race-center)(?:\/\d{4}\/[a-z0-9-]+)?\/?$/.test(u.pathname)||/^\/(replay|drivers|teams)\/\d{4}\/[a-z0-9_-]+\/?$/.test(u.pathname);
  const file=staticFiles.get(u.pathname)||(route?'index.html':null);if(!file){res.writeHead(404);return res.end('Not found');}
  const data=await fs.readFile(path.join(root,file));res.writeHead(200,{'content-type':mime[path.extname(file)],'cache-control':'no-cache','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src https://livetiming.formula1.com; object-src 'none'; frame-src 'none'; base-uri 'self'; frame-ancestors 'none'",'referrer-policy':'no-referrer'});res.end(data);
 }catch(err){send(req,res,err.status||502,{error:err instanceof ProviderError?err.message:'데이터를 불러오지 못했습니다. 다시 시도하세요.'});if(debug&&!(err instanceof ProviderError))console.error(err.message);}
}
const standalone=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
const server=standalone?http.createServer(handleRequest):null;
if(standalone)server.listen(port,hosting.bindHost,()=>console.log(`GRIDLINE: http://localhost:${port}`));

async function shutdown(){await streams.stopCapture().catch(()=>{});streams.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();}
if(standalone){process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);}

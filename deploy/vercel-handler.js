import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {waitUntil} from '@vercel/functions';
// Each Function instance gets a writable cache, seeded with verified historical assets.
// The long-running collector remains available in the original Node deployment.
const cache=path.join(os.tmpdir(),'gridline-cache-v4');
process.env.GRIDLINE_CACHE_DIR=cache;
process.env.NODE_ENV='production';
process.env.GRIDLINE_DEBUG='0';
process.env.GRIDLINE_REPLAY_LIBRARY='1';
process.env.GRIDLINE_AUTO_LIVE='0';
process.env.GRIDLINE_LIVE_ENABLED='1';
process.env.GRIDLINE_SHARED_LIVE='1';
let ready;
export default async function handler(req,res){
 ready??=(async()=>{
  await fs.cp(new URL('./seed/',import.meta.url),cache,{recursive:true,force:false,errorOnExist:false});
  return (await import('./server.js')).handleRequest;
 })().catch(error=>{ready=null;throw error;});
 try{
  const handle=await ready;
  const result=await handle(req,res);
  // Keep the existing stale-while-refresh season cache alive after sending a response.
  // Without waitUntil a serverless instance may freeze before the refresh finishes.
  const season=req.url.match(/^\/api\/season\/(\d{4})(?:[/?]|$)/);
  if(season&&res.statusCode<400){const {seasonData}=await import('./src/season-service.js');waitUntil(seasonData(Number(season[1]),{waitForFresh:true}).catch(()=>{}));}
  return result;
 }catch{
  res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({error:'Site initialization failed. Please retry.'}));
 }
}

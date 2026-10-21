import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request} from 'node:http';
import {deploymentSettings} from '../src/deployment-config.js';
test('hosting keeps loopback defaults and restricts hosted Host/Origin exactly',()=>{
 const local=deploymentSettings({},3000);assert.equal(local.bindHost,'127.0.0.1');assert.equal(local.liveEnabled,true);assert.ok(!local.allowedHosts.has('evil.example'));
 const hosted=deploymentSettings({HOST:'0.0.0.0',RENDER_EXTERNAL_HOSTNAME:'gridline-test.onrender.com',GRIDLINE_LIVE_ENABLED:'0'},10000);assert.equal(hosted.bindHost,'0.0.0.0');assert.ok(hosted.allowedHosts.has('gridline-test.onrender.com'));assert.ok(hosted.allowedOrigins.has('https://gridline-test.onrender.com'));assert.equal(hosted.liveEnabled,false);
 for(const value of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com?key=x'])assert.throws(()=>deploymentSettings({GRIDLINE_PUBLIC_URL:value}));
});
test('hosted server serves health/deep links and rejects foreign Host/Origin and disabled Live',async()=>{
 const port=31865,child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),NODE_ENV:'production',HOST:'127.0.0.1',RENDER_EXTERNAL_HOSTNAME:'gridline-test.onrender.com',GRIDLINE_LIVE_ENABLED:'0',GRIDLINE_AUTO_LIVE:'0',GRIDLINE_DEBUG:'0',GRIDLINE_OFFLINE:'1'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),15000);child.stdout.on('data',b=>{if(String(b).includes('http://')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
 const send=(url,host,options={})=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:url,method:options.method??'GET',headers:{Host:host,...options.headers}},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end(options.body);});
 assert.equal((await send('/healthz','gridline-test.onrender.com')).status,200);assert.equal((await send('/replay/2024/monaco?lap=65','gridline-test.onrender.com')).status,200);assert.equal((await send('/healthz','evil.example')).status,403);
 assert.equal((await send('/api/live/start','gridline-test.onrender.com',{method:'POST',headers:{Origin:'https://evil.example'},body:'{"mode":"live"}'})).status,403);
 const denied=await send('/api/live/start','gridline-test.onrender.com',{method:'POST',headers:{Origin:'https://gridline-test.onrender.com'},body:'{"mode":"live"}'});assert.equal(denied.status,403);assert.match(denied.body,/disabled/);
 assert.equal((await send('/api/captures','gridline-test.onrender.com')).status,403);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
});

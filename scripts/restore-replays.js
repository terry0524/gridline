import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=process.cwd(),manifest=JSON.parse(await fs.readFile(new URL('../deploy/replay-assets.json',import.meta.url)));
const base=new URL(manifest.baseURL);
if(base.protocol!=='https:'||base.hostname!=='github.com'||!base.pathname.startsWith('/terry0524/gridline/releases/download/'))throw Error('Invalid asset source');
const digest=b=>createHash('sha256').update(b).digest('hex');
for(const item of manifest.entries){
 if(!/^(replays\/2024\/(9472|9523|9574)-v4\.json\.gz|replays\/manifest-v1\.json|seasons\/202[46]-v1\.json)$/.test(item.file)||!/^[-a-zA-Z0-9.]+$/.test(item.asset)||!/^[a-f0-9]{64}$/.test(item.sha256)||item.bytes>16*1024*1024)throw Error('Invalid asset manifest');
 const file=path.join(root,'.cache',item.file);let previous;try{previous=await fs.readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous&&digest(previous)===item.sha256)continue;
 if(previous&&item.file.startsWith('seasons/')){const saved=JSON.parse(previous);if(saved.normalizationVersion!==1||String(saved.season)!==path.basename(item.file).slice(0,4))throw Error('Invalid existing season cache');continue;}
 if(previous&&item.file==='replays/manifest-v1.json'){const saved=JSON.parse(previous);if(saved.version!==1||saved.schemaVersion!==4||!Array.isArray(saved.replays))throw Error('Invalid existing replay manifest');continue;}
 // Preserve local source data. A changed snapshot must be reviewed, not overwritten by a bootstrap.
 if(previous)throw Error(`Existing cache differs from release: ${item.file}`);
 const response=await fetch(new URL(item.asset,base),{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`Replay asset HTTP ${response.status}`);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>item.bytes)throw Error('Oversized asset');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);if(bytes.length!==item.bytes||digest(bytes)!==item.sha256)throw Error('Replay asset integrity failure');
 await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,bytes);await fs.rename(tmp,file);console.log('Restored '+item.file);
}
console.log('Verified historical replay assets ready');

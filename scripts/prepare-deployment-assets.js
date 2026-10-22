import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=process.cwd(),cache=path.join(root,'.cache'),out=path.join(cache,'deployment-assets');
const manifest=JSON.parse(await fs.readFile(path.join(cache,'replays/manifest-v1.json')));
// The pinned bootstrap remains small; additional validated races live in the remote library.
const bootstrapKeys=new Set([9472,9523,9574]);
const records=manifest.replays.filter(r=>r.validation!=='INVALID'&&bootstrapKeys.has(r.sessionKey));
if(records.length!==bootstrapKeys.size)throw Error('Missing verified bootstrap replay');
await fs.mkdir(out,{recursive:true});const entries=[];
for(const r of records){
 const file=`replays/${r.season}/${r.sessionKey}-v${r.cacheVersion}.json.gz`,bytes=await fs.readFile(path.join(cache,file));
 if(createHash('sha256').update(bytes).digest('hex')!==r.sha256)throw Error('Cache integrity failure');
 const d=JSON.parse(gunzipSync(bytes));if(d.quality.locationCount!==r.locations||d.drivers.length!==r.drivers)throw Error('Replay validation failed');
 entries.push({file,asset:`${r.sessionKey}-v${r.cacheVersion}.json.gz`,sha256:r.sha256,bytes:bytes.length});await fs.writeFile(path.join(out,entries.at(-1).asset),bytes);
}
for(const year of [2024,2026]){const file=`seasons/${year}-v1.json`,bytes=await fs.readFile(path.join(cache,file));JSON.parse(bytes);const asset=`season-${year}-v1.json`;entries.push({file,asset,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});await fs.writeFile(path.join(out,asset),bytes);}
const bytes=Buffer.from(JSON.stringify({...manifest,replays:records},null,2));entries.push({file:'replays/manifest-v1.json',asset:'manifest-v1.json',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});await fs.writeFile(path.join(out,'manifest-v1.json'),bytes);
const info={version:1,baseURL:'https://github.com/terry0524/gridline/releases/download/replay-data-v4/',license:'CC-BY-NC-SA-4.0',sources:['https://openf1.org/','https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md'],entries};await fs.writeFile(path.join(root,'deploy/replay-assets.json'),JSON.stringify(info,null,2));console.log(`Prepared ${entries.length} verified deployment assets (no captures, credentials or raw upstream cache)`);

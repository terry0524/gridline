const extra='chart.js';
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
for(const root of ['src','src/live','src/capture','scripts','deploy'])for(const f of await fs.readdir(root)){if(!f.endsWith('.js'))continue;const r=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(1);}}

const check=spawnSync(process.execPath,['--check',extra],{encoding:'utf8'});if(check.status!==0){console.error(check.stderr);process.exit(1);}

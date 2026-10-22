import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{normalizeBase}=require('../watch/src/lib/sync.js');
const base=normalizeBase(process.argv[2]);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.writeFile(path.join(root,'watch/src/sync-config.js'),'module.exports='+JSON.stringify({baseUrl:base})+';\n');
console.log('Companion origin configured. Build the RPK with the same signing key.');

import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
if(!blocks.length) throw new Error('No script blocks found.');
for(const [i,code] of blocks.entries()) new vm.Script(code,{filename:`index-inline-${i}.js`});
console.log(`index.html validation passed (${blocks.length} script block${blocks.length===1?'':'s'}).`);

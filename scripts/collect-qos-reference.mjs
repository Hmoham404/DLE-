import {readFile,writeFile,mkdir} from 'node:fs/promises';

// Read-only snapshot of the data exposed to the source application's public client.
const directory='outputs/qos-trs-source';
const bundle=await readFile(`${directory}/index-Dku7Dcgm.js`,'utf8');
const url=bundle.match(/VITE_SUPABASE_URL:"([^"]+)"/)?.[1];
const key=bundle.match(/VITE_SUPABASE_PUBLISHABLE_KEY:"([^"]+)"/)?.[1];
if(!url||!key)throw new Error('Public client configuration not found.');
await mkdir(directory,{recursive:true});
const manifest={source:'https://qos-trs.vercel.app/',retrievedAt:new Date().toISOString(),access:'Public client; GET requests only',tables:{}};
for(const table of ['presses','articles','production_records']){
  const rows=[];
  for(let offset=0;;offset+=1000){
    const response=await fetch(`${url}/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=1000`,{headers:{apikey:key},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`${table}: HTTP ${response.status}`);
    const page=await response.json();
    if(!Array.isArray(page))throw new Error(`${table}: unexpected response`);
    rows.push(...page);
    if(page.length<1000)break;
  }
  await writeFile(`${directory}/${table}.json`,JSON.stringify(rows,null,2)+'\n');
  manifest.tables[table]={count:rows.length,fields:[...new Set(rows.flatMap(row=>Object.keys(row)))]};
  console.log(JSON.stringify({table,...manifest.tables[table]}));
}
await writeFile(`${directory}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');

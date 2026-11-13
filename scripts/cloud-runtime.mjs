import {build} from 'esbuild';
import nextEnv from '@next/env';
const {loadEnvConfig}=nextEnv;
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export async function cloudRuntime(){
 loadEnvConfig(process.cwd(),true,{info(){},error:console.error});
 await mkdir('.sites-runtime',{recursive:true});
 const output='.sites-runtime/cloud-store-'+process.pid+'.mjs';
 await build({stdin:{contents:"export * from './lib/cloud-store';export * from './lib/cloud-workspace';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:output,conditions:['react-server'],tsconfig:'tsconfig.json',plugins:[{name:'server-only-cli',setup(build){build.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'node-cli'}));build.onLoad({filter:/.*/,namespace:'node-cli'},()=>({contents:'',loader:'js'}));}}]});
 return import(pathToFileURL(process.cwd()+'/'+output));
}

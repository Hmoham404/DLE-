import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/cause-dictation.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/cause-dictation.mjs',tsconfig:'tsconfig.json'});
const {parseCauseDictation:parse}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/cause-dictation.mjs'));
const cases=[
 ['30 minutes panne','min','panne',30],
 ['panne machine 30 min','min','panne machine',30],
 ['trente minutes panne machine','min','panne machine',30],
 ['Panne de 30 minutes.','min','Panne',30],
 ['30 min de réglage','min','réglage',30],
 ['une heure trente minutes panne','min','panne',90],
 ['1h30 panne','min','panne',90],
 ['réglage 1,5 heures','min','réglage',90],
 ['quarante-cinq minutes réglage','min','réglage',45],
 ['quatre-vingt-dix minutes panne','min','panne',90],
 ['0 minutes panne','min','panne',0],
 ['20 pièces rayures','pcs','rayures',20],
 ['rayures vingt et une pièces','pcs','rayures',21],
 ['dix rebuts points noirs','pcs','points noirs',10],
 ['Panne B02','min','Panne B02',null],
 ['panne machine','min','panne machine',null],
 ['30 pièces rayures','min','30 pièces rayures',null],
 ['30 minutes panne','pcs','30 minutes panne',null],
 ['30 minutes panne et 10 minutes réglage','min','30 minutes panne et 10 minutes réglage',null],
 ['30 minutes panne ligne 2','min','panne ligne 2',30],
 ['','min','',null],
];
for(const [text,unit,cause,quantity] of cases){assert.deepEqual(parse(text,unit),{cause,quantity},text);console.log('PASS '+text);}
console.log(JSON.stringify({passed:cases.length}));

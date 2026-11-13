import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {authorize,failure} from '@/lib/server';
import {fiveSPlans} from '@/lib/five-s';

export const runtime='nodejs';
export async function GET(request:Request){
 try{
  await authorize();
  const params=new URL(request.url).searchParams,plan=params.get('plan'),format=params.get('format')||'image';
  if(!fiveSPlans.some(item=>item.id===plan)||!['image','pdf'].includes(format))throw new Error('Plan demandé invalide.');
  const extension=format==='pdf'?'pdf':'png';
  const bytes=await readFile(path.join(process.cwd(),'private','plans',plan+'.'+extension));
  return new Response(bytes as unknown as BodyInit,{headers:{'Content-Type':format==='pdf'?'application/pdf':'image/png','Cache-Control':'private, no-store','Content-Disposition':(format==='pdf'?'attachment':'inline')+'; filename="MYC_plan_'+plan+'.'+extension+'"','X-Content-Type-Options':'nosniff'}});
 }catch(error){return failure(error);}
}

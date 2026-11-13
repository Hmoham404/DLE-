import {authorize,checkOrigin,failure,loadState,putRecord} from '@/lib/server';
import {fiveSTagSchema} from '@/lib/five-s';

export async function POST(request:Request){
 try{
  checkOrigin(request);const auth=await authorize();
  const input=fiveSTagSchema.parse(await request.json());
  const state=await loadState(),current=state.fiveSTags?.find(tag=>tag.id===input.id);
  if(current&&!input.updated_at)throw new Error('Rechargez cette étiquette avant de la modifier.');
  if(current&&current.updated_at!==input.updated_at)throw new Error('Cette étiquette a été modifiée ailleurs. Rechargez-la avant de corriger.');
  if(input.machine_id){
   const machine=state.machines.find(item=>item.id===input.machine_id);
   if(!machine)throw new Error('La machine sélectionnée n’existe plus.');
   if(machine.department!==input.department)throw new Error('Choisissez le département de la machine sélectionnée.');
  }
  const now=new Date().toISOString();
  const value={...input,created_at:current?.created_at||now,closed_at:input.status==='Clôturée'?(current?.status==='Clôturée'?current.closed_at:now):null};
  delete value.updated_at;
  await putRecord('five_s_tag',input.id,value,auth.role,input.updated_at);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}

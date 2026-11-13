import {authorize,checkOrigin,failure,loadState,putRecord} from '@/lib/server';
import {fiveSAuditSchema,prepareFiveSAudit} from '@/lib/five-s-audits';

export async function POST(request:Request){
 try{
  checkOrigin(request);const auth=await authorize();
  const input=fiveSAuditSchema.parse(await request.json()),state=await loadState();
  const current=state.fiveSAudits?.find(audit=>audit.id===input.id),machine=state.machines.find(machine=>machine.id===input.machine_id);
  await putRecord('five_s_audit',input.id,prepareFiveSAudit(input,machine,current),auth.role,input.updated_at);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}

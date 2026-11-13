import {authorize,allJsonRecords,localMode,failure} from '@/lib/server';
import {today} from '@/lib/domain';
export async function GET(){
 try{
  await authorize();
  const records=await allJsonRecords();
  const payload={format:'myc-factory-json-v1',exportedAt:new Date().toISOString(),storage:localMode()?'local':'supabase',records};
  return new Response(JSON.stringify(payload,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="MYC_donnees_'+today()+'.json"','Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}

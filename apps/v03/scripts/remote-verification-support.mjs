import {adminConfiguration,managementHeaders,PROJECT_REF} from '../scripts/supabase-admin.mjs';
export const config=adminConfiguration(process.env);
export async function request(url,headers,method='GET',body){
 const r=await fetch(url,{headers,method,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error(`Remote HTTP ${r.status}; body withheld`);
 return r.status===204?null:r.json();
}
export const sql=query=>request(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,managementHeaders(config.pat),'POST',{query});
const tables=['v03_imports','v03_collaborations','v03_contents','v03_tasks','v03_sources','v03_constraints','v03_reviews'];
export async function inspect(){
 const project=await request(`https://api.supabase.com/v1/projects/${PROJECT_REF}`,managementHeaders(config.pat));
 if((project.id??project.ref)!==PROJECT_REF)throw new Error('Target mismatch');
 console.log('Target verified: '+PROJECT_REF);
 const rows=await sql("select tablename, rowsecurity from pg_tables where schemaname='public' and (tablename like 'v03_%' or tablename in ('inbox','schedules')) order by tablename");
 console.log('Schema inspection: '+JSON.stringify(rows));
 if(rows.some(r=>['inbox','schedules'].includes(r.tablename)))throw new Error('V02 tables detected; stop');
 return rows;
}

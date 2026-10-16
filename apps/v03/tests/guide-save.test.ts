import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {guidePayload,saveGuide} from '../src/integrations/guide';
import {AbortedSaveError} from '../src/integrations/save';
const file=new File(['x'],'qa.png',{type:'image/png'}),source={text:'followup',images:[{id:'image',name:file.name,size:1,type:file.type,file,url:'blob:qa'}]};
function mock(state='pending',abort=true){
 const remove=vi.fn(async()=>({error:null})),upload=vi.fn(async()=>({error:null}));
 const rpc=vi.fn(async(name:string)=>name==='v03_prepare_guide_import'?{data:{state:'pending'},error:null}:name==='v03_abort_import'?{data:abort,error:null}:{error:new Error('lost')});
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},rpc,storage:{from:()=>({remove,upload})},from:(table:string)=>({select:()=>({eq:()=>({single:async()=>state==='unknown'?{error:new Error('offline')}:{data:table==='v03_sources'?{id:'saved-source'}:{state},error:null}})})})} as unknown as SupabaseClient;
 return{client,rpc,remove,upload};
}
it('requires source and explicit confirmation, builds only append fields',()=>{expect(()=>guidePayload('cid',{text:' ',images:[]},true)).toThrow();expect(()=>guidePayload('cid',source,false)).toThrow();expect(Object.keys(guidePayload('cid',source,true))).toEqual(['mode','confirmed','collaboration_id','source']);});
it('recovers committed Source after response loss without deleting bytes',async()=>{const m=mock('committed');expect(await saveGuide(m.client,'same',guidePayload('cid',source,true),source)).toBe('saved-source');expect(m.remove).not.toHaveBeenCalled();expect(m.rpc.mock.calls.map(c=>c[0])).not.toContain('v03_abort_import');});
it('keeps files on unknown result',async()=>{const m=mock('unknown');await expect(saveGuide(m.client,'same',guidePayload('cid',source,true),source)).rejects.toThrow('같은 요청');expect(m.remove).not.toHaveBeenCalled();});
it('deletes only after atomic abort; abort race retains files',async()=>{const m=mock();await expect(saveGuide(m.client,'id',guidePayload('cid',source,true),source)).rejects.toBeInstanceOf(AbortedSaveError);expect(m.remove).toHaveBeenCalledWith(['owner/id/image']);const race=mock('pending',false);await expect(saveGuide(race.client,'id',guidePayload('cid',source,true),source)).rejects.toThrow('결과');expect(race.remove).not.toHaveBeenCalled();});
it('replays receipt without uploading again',async()=>{const m=mock();m.rpc.mockResolvedValueOnce({data:{state:'committed',source_id:'existing'} as never,error:null});expect(await saveGuide(m.client,'id',guidePayload('cid',source,true),source)).toBe('existing');expect(m.upload).not.toHaveBeenCalled();});

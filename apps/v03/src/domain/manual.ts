import type { Source } from './brief';
// Keep the domain usable by both the browser and Node verification scripts.
function validScheduleDate(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
 const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export type ManualItem = { id: string; value: string };
export type ManualForm = { title: string; platform: string; notes: string; draftDate: string; publishDate: string; tasks: ManualItem[]; constraints: ManualItem[] };
export const emptyManual = (): ManualForm => ({title:'',platform:'',notes:'',draftDate:'',publishDate:'',tasks:[],constraints:[]});
export function manualProblem(f: ManualForm) {
 if (!f.title.trim() || f.title.length>120) return '협찬 이름을 120자 이내로 입력해주세요.';
 if (f.platform.length>120 || f.notes.length>5000) return '플랫폼은 120자, 메모는 5,000자 이내로 입력해주세요.';
 if ([f.draftDate,f.publishDate].some(d=>d && !validScheduleDate(d))) return '연도를 포함한 유효한 날짜를 입력하거나 비워주세요.';
 if ([f.tasks,f.constraints].some(items=>items.length>30 || items.some(i=>!i.value.trim() || i.value.length>2000))) return '할 일·제작 조건은 각각 30개 이하, 항목당 1~2,000자로 입력해주세요.';
 return null;
}
export function buildManualPayload(f: ManualForm, source: Source, confirmed: boolean) {
 const problem=manualProblem(f);if(problem || !confirmed) throw new Error(problem ?? '저장 요약을 확인해주세요.');
 return {mode:'manual' as const,origin:'manual' as const,confirmed:true,
  collaboration:{title:f.title.trim(),notes:f.notes.trim()||null},content:{platform:f.platform.trim()||null},
  schedules:{draft_delivery:f.draftDate||null,publish:f.publishDate||null},
  tasks:f.tasks.map(i=>({id:i.id,value:i.value.trim()})),constraints:f.constraints.map(i=>({id:i.id,value:i.value.trim()})),
  source:{raw_text:source.text,images:source.images.map(({id,name,size,type})=>({id,name,size,type}))}};
}
export type ManualPayload=ReturnType<typeof buildManualPayload>;

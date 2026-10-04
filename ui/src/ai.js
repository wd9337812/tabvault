// Model output is untrusted; the background validates again before atomic application.
export function validateAiOps(ops,tasks){
 if(!Array.isArray(ops)||!ops.length||ops.length>200)throw new Error('aiFailed');
 const ids=new Set(tasks.map(task=>task.id));
 return ops.map(op=>{
  if(!Data.object(op)||!['add','update','done','del'].includes(op.op))throw new Error('aiFailed');
  if(op.op!=='add'&&!ids.has(op.id))throw new Error('aiFailed');
  if(op.op==='add'&&(typeof op.title!=='string'||!op.title.trim()))throw new Error('aiFailed');
  if(op.title!==undefined&&(typeof op.title!=='string'||!op.title.trim()))throw new Error('aiFailed');
  if(op.note!==undefined&&typeof op.note!=='string')throw new Error('aiFailed');
  if(op.due!==undefined)Data.date(op.due);if(op.tags!==undefined)Data.tags(op.tags);
  return Object.fromEntries(['op','id','title','due','tags','note'].filter(key=>Object.hasOwn(op,key)).map(key=>[key,op[key]]));
 });
}

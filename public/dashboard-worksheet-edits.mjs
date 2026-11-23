// A row has one outstanding write and its own optimistic revision. Drafts stay in
// memory until the server acknowledges the same values, including across a login.
export function createWorksheetEdits({write,read,accept,changed,canWrite,saved=()=>{}}) {
  const entries=new Map();
  const key=(project,id)=>project+'/'+id;
  const owns=entry=>entries.get(key(entry.project,entry.id))===entry;

  function remove(entry) {
    clearTimeout(entry.timer);
    entries.delete(key(entry.project,entry.id));
  }
  function settle(entry,row) {
    entry.revision=row.revision;
    for(const field of Object.keys(entry.values)) {
      if(entry.values[field]===row[field]) delete entry.values[field];
    }
    accept(entry.project,row);
  }
  async function latest(entry) {
    const row=await read(entry.project,entry.id);
    if(!owns(entry)) return;
    settle(entry,row);
    entry.reviewed=true;
    if(!Object.keys(entry.values).length) remove(entry);
  }
  async function save(entry) {
    clearTimeout(entry.timer);
    if(!owns(entry) || entry.busy || entry.error || !canWrite()) return;
    entry.busy=true;
    changed(entry.project,entry.id);
    try {
      const row=await write(entry.project,entry.id,{revision:entry.revision,...entry.values});
      if(!owns(entry)) return;
      settle(entry,row);
      if(!Object.keys(entry.values).length) {remove(entry);saved(entry.project);}
    } catch(error) {
      if(!owns(entry)) return;
      entry.error=error.message;
      entry.conflict=error.status===409;
      entry.reviewed=false;
      if(entry.conflict && canWrite()) {
        try {await latest(entry);} catch(readError) {entry.error=readError.message;}
      }
    } finally {
      entry.busy=false;
      changed(entry.project,entry.id);
    }
    if(owns(entry) && !entry.error && canWrite()) await save(entry);
  }
  return {
    get:(project,id)=>entries.get(key(project,id)),
    list:project=>[...entries.values()].filter(entry=>!project || entry.project===project),
    edit(project,row,field,value,delay=0) {
      let entry=entries.get(key(project,row.id));
      if(!entry) {
        if((row[field]??'')===value) return;
        entry={project,id:row.id,revision:row.revision,values:{},busy:false,error:'',conflict:false,reviewed:false};
        entries.set(key(project,row.id),entry);
      }
      entry.values[field]=value;
      clearTimeout(entry.timer);
      changed(project,row.id);
      if(delay) entry.timer=setTimeout(()=>save(entry),delay);
      else void save(entry);
    },
    async retry(project,id) {
      const entry=entries.get(key(project,id));
      if(!entry || entry.busy || !canWrite()) return;
      if(entry.conflict && !entry.reviewed) {
        entry.busy=true;
        try {await latest(entry);} catch(error){entry.error=error.message;}
        finally{entry.busy=false;changed(project,id);}
        return;
      }
      entry.error='';entry.conflict=false;
      await save(entry);
    },
    discard(project,id) {
      const entry=entries.get(key(project,id));
      if(!entry || entry.busy || (entry.conflict&&!entry.reviewed)) return;
      remove(entry);changed(project,id);
    },
    resume(project) {
      for(const entry of entries.values()) if(entry.project===project && !entry.error) void save(entry);
    },
    pause(clear=false) {
      for(const entry of entries.values()) clearTimeout(entry.timer);
      if(clear) entries.clear();
    }
  };
}

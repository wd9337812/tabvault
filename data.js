/* Validation and serialization shared by the extension's background and UI. */
const Data = (() => {
  const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
  const id = () => crypto.randomUUID();
  const object = x => x && typeof x === 'object' && !Array.isArray(x);
  const text = (x, max = 10000) => typeof x === 'string' ? x.slice(0, max) : '';
  const validId = x => typeof x === 'string' && /^[\w-]{1,120}$/.test(x);
  const http = x => { if (typeof x !== 'string' || x.length > 20000) return false; try { return ['http:', 'https:'].includes(new URL(x).protocol); } catch { return false; } };
  const date = x => {
    if (!x) return '';
    if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) fail('invalid', 'Invalid due date');
    const d = new Date(`${x}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== x) fail('invalid', 'Invalid due date');
    return x;
  };
  const tags = x => {
    if (x === undefined) return [];
    if (!Array.isArray(x) || x.some(t => typeof t !== 'string')) fail('invalid', 'Invalid tags');
    return [...new Set(x.map(t => t.trim().slice(0, 80)).filter(Boolean))].slice(0, 40);
  };
  function list(x) {
    if (!object(x) || !validId(x.id) || typeof x.name !== 'string' || !x.name.trim()) fail('invalid', 'Invalid list');
    return { id: x.id, name: x.name.trim().slice(0, 80), color: /^#[a-f\d]{6}$/i.test(x.color || '') ? x.color : '#6d5efc' };
  }
  function task(x) {
    if (!object(x) || !validId(x.id) || typeof x.title !== 'string' || !x.title.trim()) fail('invalid', 'Invalid task');
    if (x.url && !http(x.url)) fail('invalid', 'Only http/https URLs are supported');
    if (x.subtasks !== undefined && !Array.isArray(x.subtasks)) fail('invalid', 'Invalid subtasks');
    const subtasks = (x.subtasks || []).map(s => {
      if (!object(s) || !validId(s.id) || typeof s.title !== 'string' || !s.title.trim()) fail('invalid', 'Invalid subtask');
      return { id: s.id, title: s.title.trim().slice(0, 140), done: !!s.done };
    });
    return { id: x.id, title: x.title.trim().slice(0, 140), url: text(x.url, 20000), excerpt: text(x.excerpt, 320), note: text(x.note, 10000),
      listId: validId(x.listId) ? x.listId : 'inbox', tags: tags(x.tags), due: date(x.due), done: !!x.done,
      createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now(), completedAt: Number.isFinite(x.completedAt) ? x.completedAt : null, source: text(x.source, 40), subtasks };
  }
  function tab(x) {
    if (!object(x) || !http(x.url) || (x.title !== undefined && typeof x.title !== 'string')) fail('invalid', 'Invalid tab');
    const icon = x.fav || x.favIconUrl;
    const fav = http(icon) && new URL(icon).origin === new URL(x.url).origin ? icon : '';
    let group;
    if(x.group!==undefined){if(!object(x.group)||!validId(String(x.group.id))||typeof x.group.title!=='string'||!['grey','blue','red','yellow','green','pink','purple','cyan','orange'].includes(x.group.color))fail('invalid','Invalid tab group');group={id:String(x.group.id),title:text(x.group.title,200),color:x.group.color,collapsed:!!x.group.collapsed};}
    return { url: x.url, title: text(x.title, 1000) || x.url, fav, pinned: !!x.pinned, ...(group?{group}:{} ) };
  }
  function session(x) {
    if (!object(x) || !validId(x.id) || typeof x.name !== 'string' || !x.name.trim() || !Array.isArray(x.tabs) || !x.tabs.length) fail('invalid', 'Invalid session');
    if (!Number.isFinite(x.createdAt) || x.createdAt < 0) fail('invalid', 'Invalid session date');
    return { id: x.id, name: x.name.trim().slice(0, 200), createdAt: x.createdAt, auto: !!x.auto, tabs: x.tabs.map(tab), projectId:validId(x.projectId)?x.projectId:'',note:text(x.note,10000),tags:tags(x.tags),pinned:!!x.pinned, ...(Number.isInteger(x.windowId) ? { windowId: x.windowId } : {}) };
  }
  function project(x){const clean=list(x);return{...clean,note:text(x.note,2000)};}
  function records(input, normalize, strict = false) {
    if (input === undefined && !strict) return { values: [], invalid: false };
    if (!Array.isArray(input)) { if (strict) fail('invalid', 'Expected an array'); return { values: [], invalid: true }; }
    const values = [], seen = new Set(); let invalid = false;
    for (const item of input) {
      try { const clean = normalize(item); if (!seen.has(clean.id)) { seen.add(clean.id); values.push(clean); } else invalid = true; }
      catch(e) { if (strict) throw e; invalid = true; }
    }
    return { values, invalid };
  }
  function queue() { let tail = Promise.resolve(); return fn => { const next = tail.then(fn); tail = next.catch(() => {}); return next; }; }
  async function protect(raw, keys, backupKey, invalid) {
    if (!invalid) return;
    const old = await chrome.storage.local.get(backupKey);
    if (!old[backupKey]) await chrome.storage.local.set({ [backupKey]: { at: Date.now(), ...Object.fromEntries(keys.map(k => [k, raw[k] ?? null])) } });
  }
  return { fail, id, object, text, validId, http, date, tags, list, task, tab, session, project, records, queue, protect };
})();

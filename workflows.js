/* Comparisons and launch plans reference saved data; no webpage content is fetched. */
const VaultFlows = (() => {
  const key = (url, tracking = false) => {
    const value = new URL(url);
    if (tracking) for (const name of [...value.searchParams.keys()]) if (/^(utm_(source|medium|campaign|term|content)|fbclid|gclid|msclkid)$/i.test(name)) value.searchParams.delete(name);
    return value.href;
  };
  function plan(x) {
    const base = Data.list(x);
    if (!Array.isArray(x.windows) || !x.windows.length || x.windows.length > 20) Data.fail('invalid', 'flowInvalid');
    return { id: base.id, name: base.name, skipDuplicates: x.skipDuplicates !== false, preserveGroups: x.preserveGroups !== false,
      windows: x.windows.map(win => {
        if (!Data.object(win) || !Array.isArray(win.tabs) || !win.tabs.length) Data.fail('invalid', 'flowInvalid');
        return { name: Data.text(win.name, 80), tabs: win.tabs.map(Data.tab) };
      }) };
  }
  const load = (raw, strict = false) => Data.records(raw ?? [], plan, strict);
  // Auto snapshots are deliberately outside the undo record: new snapshots never get rolled back.
  const content = s => ({ sessions: s.sessions.filter(x => !x.auto), projects: s.projects, launches: s.launches });
  const signature = s => Data.fingerprint(content(s));
  async function diff(s, p) {
    const source = s.sessions.find(x => x.id === p.id); if (!source) Data.fail('missing', 'missingSession');
    let target, targetName;
    if (p.targetId) { const saved = s.sessions.find(x => x.id === p.targetId); if (!saved) Data.fail('missing', 'missingSession'); target = saved.tabs; targetName = saved.name; }
    else { if (!Number.isInteger(p.windowId)) Data.fail('invalid', 'invalidWindow'); target = await currentTabs(p.windowId); targetName = 'current'; }
    // Match URL occurrences, so a duplicate open tab does not mask a missing second occurrence.
    const remaining = target.map((tab, index) => ({ tab, index, used: false })), missing = [], common = [], changed = [];
    source.tabs.forEach((tab, index) => {
      const match = remaining.find(x => !x.used && key(x.tab.url) === key(tab.url));
      if (!match) missing.push({ index, tab });
      else { match.used = true; common.push({ index, tab }); if (JSON.stringify([tab.pinned, tab.group?.title, tab.group?.color, tab.group?.collapsed]) !== JSON.stringify([match.tab.pinned, match.tab.group?.title, match.tab.group?.color, match.tab.group?.collapsed])) changed.push({ index, before: tab, after: match.tab }); }
    });
    return { sourceId: source.id, sourceName: source.name, targetName, missing, common, changed, added: remaining.filter(x => !x.used).map(x => x.tab), revision: JSON.stringify(source) };
  }
  function duplicates(s, p) {
    if (!Array.isArray(p.ids) || p.ids.length < 2 || new Set(p.ids).size !== p.ids.length) Data.fail('invalid', 'invalidSelection');
    const selected = p.ids.map(id => s.sessions.find(x => x.id === id && !x.auto)); if (selected.some(x => !x)) Data.fail('missing', 'missingSession');
    const groups = new Map();
    for (const session of selected) session.tabs.forEach((tab, index) => {
      const url = key(tab.url, !!p.tracking); if (!groups.has(url)) groups.set(url, []);
      groups.get(url).push({ sessionId: session.id, sessionName: session.name, projectId: session.projectId, note: session.note, tags: session.tags, index, tab });
    });
    return { groups: [...groups].filter(([, rows]) => rows.length > 1).map(([url, rows]) => ({ url, rows })), revision: JSON.stringify(selected) };
  }
  async function handle(s, op, p) {
    if (op === 'DIFF_PREVIEW') return { ...await diff(s, p), changedData: false };
    if (op === 'DIFF_RESTORE') {
      if (s.plan !== 'pro') Data.fail('pro', 'diffPro');
      const result = await diff(s, p);
      if (p.revision !== result.revision) Data.fail('stale', 'flowStale');
      const allowed = new Set(result.missing.map(x => x.index));
      // Recompute immediately before restoring: tabs may have changed while the preview was open.
      if(!Array.isArray(p.indices)||!p.indices.length||new Set(p.indices).size!==p.indices.length||p.indices.some(i=>!Number.isInteger(i)||i<0||!s.sessions.find(x=>x.id===p.id).tabs[i]))Data.fail('invalid','invalidSelection');
      const indices = p.indices.filter(i => allowed.has(i));
      if (!indices.length) return { restored: 0, skipped: (p.indices || []).length };
      return restoreSession(s, { id: p.id, indices, here: true, windowId: p.windowId, preserveGroups: true, skipDuplicates: true, keepSession: true });
    }
    if (op === 'CLEANUP_PREVIEW') return { ...duplicates(s, p), changedData: false };
    if (op === 'CLEANUP_APPLY') {
      if (s.plan !== 'pro') Data.fail('pro', 'cleanupPro');
      const result = duplicates(s, p); if (result.revision !== p.revision) Data.fail('stale', 'flowStale');
      const remove = p.remove;
      if (!Array.isArray(remove) || !remove.length || new Set(remove.map(x => x.sessionId + ':' + x.index)).size !== remove.length) Data.fail('invalid', 'invalidSelection');
      const toRemove = new Set(remove.map(x => x.sessionId + ':' + x.index)), valid = new Set(result.groups.flatMap(g => g.rows.map(x => x.sessionId + ':' + x.index)));
      if ([...toRemove].some(x => !valid.has(x))) Data.fail('invalid', 'invalidSelection');
      for (const group of result.groups) if (group.rows.every(row => toRemove.has(row.sessionId + ':' + row.index))) Data.fail('invalid', 'keepOriginal');
      let removed = 0;
      for (const session of s.sessions.filter(x => p.ids.includes(x.id))) {
        const tabs = session.tabs.filter((_, index) => !toRemove.has(session.id + ':' + index));
        // An empty session would discard its notes and project context; retain one reference instead.
        if (!tabs.length) Data.fail('invalid', 'keepSessionTab');
        removed += session.tabs.length - tabs.length; session.tabs = tabs;
      }
      return { changedData: true, removed };
    }
    if (op === 'LAUNCH_DELETE') { s.launches = s.launches.filter(x => x.id !== p.id); return { changedData: true }; }
    if (op === 'LAUNCH_SAVE') {
      if (s.plan !== 'pro') Data.fail('pro', 'launchPro');
      const clean = plan({ ...p, id: p.id || Data.id() }), existing = s.launches.find(x => x.id === clean.id);
      if (existing) Object.assign(existing, clean); else s.launches.push(clean);
      return { changedData: true, record: clean };
    }
    if (op === 'LAUNCH_OPEN') {
      if (s.plan !== 'pro') Data.fail('pro', 'launchPro');
      const launch = s.launches.find(x => x.id === p.id); if (!launch) Data.fail('missing', 'flowMissing');
      if (!Array.isArray(p.windows) || p.windows.length!==1 || new Set(p.windows).size !== p.windows.length || p.windows.some(i => !Number.isInteger(i) || !launch.windows[i])) Data.fail('invalid', 'invalidSelection');
      const index = p.windows[0];
      // One window per request lets the user stop before the next batch, including after a partial failure.
      const fake = { id: '__launch__', name: launch.windows[index].name || launch.name, tabs: launch.windows[index].tabs, auto: false };
      const original = s.sessions; s.sessions = [fake, ...original];
      try { return { ...await restoreSession(s, { id: fake.id, preserveGroups: launch.preserveGroups, skipDuplicates: launch.skipDuplicates, keepSession: true }), changedData: false }; }
      finally { s.sessions = original; }
    }
    Data.fail('invalid', 'Unknown operation');
  }
  return { key, load, plan, content, signature, diff, duplicates, handle };
})();

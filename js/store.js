// Capa de datos. Dos implementaciones con la misma interfaz:
//  - demo: memoria + IndexedDB + BroadcastChannel (pestañas del mismo navegador)
//  - supabase: Postgres + Storage + Realtime
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
export const uuid = () => crypto.randomUUID();

// En demo cada pestaña es una persona distinta; con Supabase la identidad se conserva por dispositivo.
export const box = DEMO ? sessionStorage : localStorage;
export function myUid() {
  let u = box.getItem('pulso.uid');
  if (!u) { u = uuid(); box.setItem('pulso.uid', u); }
  return u;
}

const newCode = () => String(Math.floor(100000 + Math.random() * 900000));
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/* ------------------------------------------------------------------ demo */
function demoStore() {
  let db = { presentations: {}, items: {}, sessions: {}, players: {}, answers: {} };
  const bc = new BroadcastChannel('pulso-demo');
  const subs = new Set();
  const emit = (top) => subs.forEach((s) => s.top === top && s.fn());
  const sub = (top, fn) => { const s = { top, fn }; subs.add(s); return () => subs.delete(s); };

  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('pulso-demo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const ready = (async () => {
    try {
      const d = await idb();
      const got = await new Promise((res) => {
        const q = d.transaction('kv').objectStore('kv').get('db');
        q.onsuccess = () => res(q.result); q.onerror = () => res(null);
      });
      if (got) db = { ...db, ...got };
    } catch { /* sin IndexedDB: solo memoria */ }
    // Otra pestaña abierta puede tener cambios que aún no llegaron al disco.
    await new Promise((res) => { onFull = res; bc.postMessage({ hello: true }); setTimeout(res, 250); });
    onFull = null;
  })();
  let onFull = null;
  let pt;
  const persist = () => {
    clearTimeout(pt);
    pt = setTimeout(async () => {
      try { const d = await idb(); d.transaction('kv', 'readwrite').objectStore('kv').put(db, 'db'); } catch { /* */ }
    }, 250);
  };
  function mut(path, value, remote) {
    let o = db;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] ??= {};
    const k = path[path.length - 1];
    if (value === undefined || value === null) delete o[k]; else o[k] = value;
    if (!remote) { bc.postMessage({ path, value: value ?? null }); persist(); }
    emit(path[0]);
  }
  bc.onmessage = (e) => {
    if (e.data.hello) return bc.postMessage({ full: db });
    if (e.data.full) { if (onFull) { db = { ...db, ...e.data.full }; onFull(); } return; }
    mut(e.data.path, e.data.value, true);
  };

  const authCbs = new Set();
  const itemsOf = (pid) => Object.values(db.items).filter((i) => i.presentation_id === pid).sort((a, b) => a.pos - b.pos);

  return {
    mode: 'demo',
    ready,
    get admin() { return sessionStorage.getItem('pulso.admin'); },
    onAuth(fn) { authCbs.add(fn); return () => authCbs.delete(fn); },
    async signIn(email, pass) {
      if (pass !== 'demo') throw new Error('En modo demostración la contraseña es "demo".');
      sessionStorage.setItem('pulso.admin', email || 'demo'); authCbs.forEach((f) => f());
    },
    async signOut() { sessionStorage.removeItem('pulso.admin'); authCbs.forEach((f) => f()); },

    async listPresentations() {
      return clone(Object.values(db.presentations).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((p) => { const it = itemsOf(p.id); return { ...p, count: it.length, cover: it.find((i) => i.thumb)?.thumb || null }; }));
    },
    async getPresentation(id) { return clone(db.presentations[id]) || null; },
    async createPresentation(title) {
      const now = new Date().toISOString();
      const p = { id: uuid(), title, created_at: now, updated_at: now };
      mut(['presentations', p.id], p); return clone(p);
    },
    async updatePresentation(id, patch) {
      if (db.presentations[id]) mut(['presentations', id], { ...db.presentations[id], ...patch, updated_at: new Date().toISOString() });
    },
    async deletePresentation(id) {
      itemsOf(id).forEach((i) => mut(['items', i.id], undefined));
      mut(['presentations', id], undefined);
    },
    watchPresentation(id, cb) { return sub('presentations', () => cb(clone(db.presentations[id]) || null)); },

    async getItems(pid) { return clone(itemsOf(pid)); },
    watchItems(pid, cb) { return sub('items', () => cb(clone(itemsOf(pid)))); },
    async saveItem(item) { mut(['items', item.id], clone(item)); },
    async deleteItem(id) { mut(['items', id], undefined); },
    async uploadImage(_pid, blob) {
      return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    },

    async listSessions() {
      return clone(Object.values(db.sessions).filter((s) => !s.ended).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async createSession(pid, title, state) {
      let code = newCode(); while (db.sessions[code]) code = newCode();
      mut(['sessions', code], { code, presentation_id: pid, title, state, ended: false, created_at: new Date().toISOString() });
      return code;
    },
    async getSession(code) { return clone(db.sessions[code]) || null; },
    watchSession(code, cb) {
      let last = '';
      const fire = () => { const s = db.sessions[code]; if (!s) return; const j = JSON.stringify(s.state); if (j !== last) { last = j; cb(clone(s.state), clone(s)); } };
      queueMicrotask(fire);
      return sub('sessions', fire);
    },
    async setState(code, state) { const s = db.sessions[code]; if (s) mut(['sessions', code], { ...s, state: clone(state) }); },
    async endSession(code) { const s = db.sessions[code]; if (s) mut(['sessions', code], { ...s, ended: true }); },

    async join(code, name) { mut(['players', code, myUid()], { uid: myUid(), name, joined_at: new Date().toISOString() }); },
    async getPlayers(code) { return clone(Object.values(db.players[code] || {})); },
    async answer(code, itemId, rec) { mut(['answers', code, itemId, myUid()], { ...rec, item_id: itemId, uid: myUid() }); },
    async getAnswers(code, itemId) {
      const a = db.answers[code] || {};
      const list = itemId ? Object.values(a[itemId] || {}) : Object.values(a).flatMap((m) => Object.values(m));
      return clone(list);
    },
    async myAnswers(code) {
      const a = db.answers[code] || {}; const out = {};
      for (const iid in a) if (a[iid][myUid()]) out[iid] = clone(a[iid][myUid()]);
      return out;
    },
  };
}

/* -------------------------------------------------------------- supabase */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

function supaStore() {
  let sb, user = null;
  const authCbs = new Set();
  const ok = (r) => { if (r.error) throw r.error; return r.data; };
  const ready = (async () => {
    await loadScript('vendor/supabase.js');
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    user = (await sb.auth.getSession()).data.session?.user || null;
    sb.auth.onAuthStateChange((_e, s) => { user = s?.user || null; authCbs.forEach((f) => f()); });
  })();
  const ITEM_COLS = 'id,presentation_id,pos,type,data,thumb';

  return {
    mode: 'supabase',
    ready,
    get admin() { return user?.email || null; },
    onAuth(fn) { authCbs.add(fn); return () => authCbs.delete(fn); },
    async signIn(email, pass) {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error('Correo o contraseña incorrectos.');
    },
    async signOut() { await sb.auth.signOut(); },

    async listPresentations() {
      const ps = ok(await sb.from('presentations').select('*').order('updated_at', { ascending: false }));
      if (!ps.length) return [];
      const its = ok(await sb.from('items').select('presentation_id,pos,thumb').in('presentation_id', ps.map((p) => p.id)).order('pos'));
      return ps.map((p) => { const mine = its.filter((i) => i.presentation_id === p.id); return { ...p, count: mine.length, cover: mine.find((i) => i.thumb)?.thumb || null }; });
    },
    async getPresentation(id) { return ok(await sb.from('presentations').select('*').eq('id', id).maybeSingle()); },
    async createPresentation(title) { return ok(await sb.from('presentations').insert({ title }).select().single()); },
    async updatePresentation(id, patch) { ok(await sb.from('presentations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)); },
    async deletePresentation(id) {
      try {
        const files = ok(await sb.storage.from('slides').list(id, { limit: 1000 }));
        if (files.length) await sb.storage.from('slides').remove(files.map((f) => `${id}/${f.name}`));
      } catch { /* las imágenes huérfanas no impiden borrar */ }
      ok(await sb.from('presentations').delete().eq('id', id));
    },
    watchPresentation(id, cb) {
      const ch = sb.channel('p:' + id + ':' + uuid().slice(0, 6))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'presentations', filter: 'id=eq.' + id }, (p) => cb(p.new))
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    async getItems(pid, light) {
      return ok(await sb.from('items').select(light ? 'id,presentation_id,pos,type,data' : ITEM_COLS).eq('presentation_id', pid).order('pos'));
    },
    watchItems(pid, cb) {
      let t;
      const refetch = () => { clearTimeout(t); t = setTimeout(async () => { try { cb(await this.getItems(pid)); } catch { /* */ } }, 120); };
      const ch = sb.channel('i:' + pid + ':' + uuid().slice(0, 6))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: 'presentation_id=eq.' + pid }, refetch)
        .subscribe();
      const poll = setInterval(refetch, 20000);
      return () => { clearInterval(poll); clearTimeout(t); sb.removeChannel(ch); };
    },
    async saveItem(item) {
      const { id, presentation_id, pos, type, data, thumb } = item;
      ok(await sb.from('items').upsert({ id, presentation_id, pos, type, data, thumb: thumb || null, updated_at: new Date().toISOString() }));
    },
    async deleteItem(id) { ok(await sb.from('items').delete().eq('id', id)); },
    async uploadImage(pid, blob) {
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${pid}/${uuid()}.${ext}`;
      ok(await sb.storage.from('slides').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' }));
      return sb.storage.from('slides').getPublicUrl(path).data.publicUrl;
    },

    async listSessions() {
      const since = new Date(Date.now() - 24 * 3600e3).toISOString();
      return ok(await sb.from('sessions').select('*').eq('ended', false).gte('created_at', since).order('created_at', { ascending: false }));
    },
    async createSession(pid, title, state) {
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const { error } = await sb.from('sessions').insert({ code, presentation_id: pid, title, state });
        if (!error) return code;
        if (error.code !== '23505') throw error;
      }
      throw new Error('No se pudo generar un código de sala.');
    },
    async getSession(code) { return ok(await sb.from('sessions').select('*').eq('code', code).maybeSingle()); },
    // Realtime es la vía rápida; el sondeo cubre a quien quede fuera del cupo de conexiones o pierda un mensaje.
    watchSession(code, cb) {
      let last = '', rev = -1, live = false, stop = false, timer;
      const push = (state, row) => { if ((state.rev || 0) < rev) return; const j = JSON.stringify(state); if (j !== last) { last = j; rev = state.rev || 0; cb(state, row); } };
      const fetchNow = async () => { try { const row = await this.getSession(code); if (row && !stop) push(row.state, row); } catch { /* */ } };
      const loop = () => { if (stop) return; timer = setTimeout(async () => { await fetchNow(); loop(); }, live ? 8000 + Math.random() * 4000 : 2200 + Math.random() * 800); };
      const ch = sb.channel('s:' + code, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'state' }, ({ payload }) => push(payload))
        .subscribe((status) => { live = status === 'SUBSCRIBED'; });
      this._ch ??= {}; this._ch[code] = ch;
      fetchNow(); loop();
      const onVis = () => { if (!document.hidden) fetchNow(); };
      document.addEventListener('visibilitychange', onVis);
      return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); sb.removeChannel(ch); delete this._ch[code]; };
    },
    async setState(code, state) {
      const ch = this._ch?.[code];
      if (ch) ch.send({ type: 'broadcast', event: 'state', payload: state });
      ok(await sb.from('sessions').update({ state }).eq('code', code));
    },
    async endSession(code) { ok(await sb.from('sessions').update({ ended: true }).eq('code', code)); },

    async join(code, name) { ok(await sb.from('players').upsert({ session_code: code, uid: myUid(), name })); },
    async getPlayers(code) { return ok(await sb.from('players').select('uid,name,joined_at').eq('session_code', code).order('joined_at').limit(2000)); },
    async answer(code, itemId, rec) {
      ok(await sb.from('answers').upsert({ session_code: code, item_id: itemId, uid: myUid(), name: rec.name, value: rec.value, frac: rec.frac, pts: rec.pts }));
    },
    async getAnswers(code, itemId) {
      let q = sb.from('answers').select('item_id,uid,name,value,frac,pts').eq('session_code', code).limit(20000);
      if (itemId) q = q.eq('item_id', itemId);
      return ok(await q);
    },
    async myAnswers(code) {
      const rows = ok(await sb.from('answers').select('item_id,uid,name,value,frac,pts').eq('session_code', code).eq('uid', myUid()));
      return Object.fromEntries(rows.map((r) => [r.item_id, r]));
    },
  };
}

export const store = DEMO ? demoStore() : supaStore();

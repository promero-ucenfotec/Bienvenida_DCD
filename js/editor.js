// Editor de presentaciones. Cada cambio se guarda solo y se refleja en los demás administradores.
import { store, uuid } from './store.js';
import { h, put, icon, toast, sortable, confirmBox } from './ui.js';
import { TYPES, ACTIVITY_TYPES, editorForm, stage, player, problem, titleOf } from './activities.js';

const canvasBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
async function exportCanvas(src, w, hh) {
  const big = document.createElement('canvas'); big.width = w; big.height = hh;
  big.getContext('2d').drawImage(src, 0, 0, w, hh);
  let blob = await canvasBlob(big, 'image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(big, 'image/jpeg', 0.84);
  const th = document.createElement('canvas'); th.width = 320; th.height = Math.round(320 * hh / w);
  th.getContext('2d').drawImage(src, 0, 0, th.width, th.height);
  return { blob, thumb: th.toDataURL('image/jpeg', 0.6), w, h: hh };
}
const fit = (w, hh, max = 1600) => { const k = Math.min(1, max / w); return [Math.round(w * k), Math.round(hh * k)]; };

async function* pagesOf(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import('../vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(3, 1600 / base.width) });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      yield { total: doc.numPages, n, out: await exportCanvas(c, c.width, c.height) };
    }
  } else {
    const img = await createImageBitmap(file), [w, hh] = fit(img.width, img.height);
    yield { total: 1, n: 1, out: await exportCanvas(img, w, hh) };
  }
}

export async function editor(root, pid) {
  let pres = await store.getPresentation(pid).catch(() => null);
  if (!pres) { root.append(h('main.center-page', h('div.card.narrow', h('h2', 'No encontramos esta presentación'), h('a.btn.primary.block', { href: '#/admin' }, 'Volver a mis presentaciones')))); return; }
  let items = await store.getItems(pid), selId = items[0]?.id || null, view = 'screen';
  const pending = new Map();

  const status = h('span.save-state', 'Guardado');
  const setStatus = () => { status.textContent = pending.size ? 'Guardando…' : 'Guardado'; status.classList.toggle('busy', !!pending.size); };
  const flush = async (id) => {
    const it = items.find((i) => i.id === id); pending.delete(id);
    try { if (it) await store.saveItem(it); } catch { toast('No se pudo guardar. Revisá la conexión.', 'err'); }
    setStatus();
  };
  const touch = (it, now) => { clearTimeout(pending.get(it.id)); pending.set(it.id, setTimeout(() => flush(it.id), now ? 0 : 400)); setStatus(); };
  const sel = () => items.find((i) => i.id === selId);
  const sort = () => items.sort((a, b) => a.pos - b.pos);
  const posAfter = (id, n = 1) => {
    sort(); const i = items.findIndex((x) => x.id === id);
    const a = i < 0 ? (items.at(-1)?.pos || 0) : items[i].pos, b = i < 0 || i === items.length - 1 ? a + n + 1 : items[i + 1].pos;
    return [...Array(n)].map((_, k) => a + ((b - a) * (k + 1)) / (n + 1));
  };

  /* ---- estructura */
  const titleIn = h('input.title-in', { value: pres.title, 'aria-label': 'Título de la presentación', placeholder: 'Presentación sin título' });
  let tt; titleIn.addEventListener('input', () => { clearTimeout(tt); tt = setTimeout(() => store.updatePresentation(pid, { title: titleIn.value.trim() || 'Presentación sin título' }).catch(() => {}), 500); });
  const fileIn = h('input', { type: 'file', accept: '.pdf,application/pdf,image/*', multiple: true, hidden: true, onchange: (e) => { importFiles([...e.target.files]); e.target.value = ''; } });
  const film = h('div.film-list'), canvas = h('section.ed-canvas'), side = h('aside.ed-side');
  const menu = h('div.add-menu', { hidden: true }, ACTIVITY_TYPES.map((t) => h('button', { type: 'button', onclick: () => { menu.hidden = true; addActivity(t); } },
    h('span.add-ic', { class: 't-' + t }, icon(TYPES[t].icon, 20)), h('span', h('b', TYPES[t].label), h('small', TYPES[t].hint)))));
  const addBtn = h('button.btn.soft.block', { type: 'button', 'aria-haspopup': 'true', onclick: (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; } }, icon('plus', 18), 'Agregar actividad');
  const shell = h('div.editor',
    h('header.ed-top',
      h('a.icon-btn', { href: '#/admin', title: 'Mis presentaciones' }, icon('back')),
      titleIn, status,
      h('button.btn.ghost', { type: 'button', onclick: () => fileIn.click() }, icon('upload', 18), 'Subir PDF o imágenes'),
      h('button.btn.primary', { type: 'button', onclick: present }, icon('play', 16), 'Presentar')),
    h('nav.ed-film', film, h('div.film-add', menu, addBtn)),
    canvas, side, fileIn);
  root.append(shell);
  const closeMenu = () => { menu.hidden = true; };
  document.addEventListener('click', closeMenu);

  sortable(film, { onDrop: (keys) => {
    const moved = keys.find((k, i) => items[i]?.id !== k) && keys;
    if (!moved) return;
    keys.forEach((k, i) => { const it = items.find((x) => x.id === k); if (it && it.pos !== i + 1) { it.pos = i + 1; touch(it, true); } });
    sort(); drawFilm();
  } });

  function drawFilm() {
    put(film, ...items.map((it, i) => {
      const bad = problem(it);
      return h('div.film-item', { 'data-key': it.id, class: `${it.id === selId ? 'on' : ''} ${it.type === 'slide' ? '' : 'is-act'}`, tabindex: '0', role: 'button', 'aria-label': `${i + 1}. ${titleOf(it)}`,
        onclick: () => select(it.id), onkeydown: (e) => { if (e.key === 'Enter') select(it.id); if (e.key === 'Delete') remove(it); } },
        h('span.film-n', String(i + 1)),
        it.type === 'slide' ? h('span.film-thumb', it.thumb ? h('img', { src: it.thumb, alt: '', draggable: false }) : icon('image'))
          : h('span.film-thumb.act', { class: 't-' + it.type }, icon(TYPES[it.type].icon, 20), h('small', TYPES[it.type].label), h('em', it.data.q || '')),
        bad && h('span.film-warn', { title: bad }, '!'));
    }));
  }

  function drawCanvas() {
    const it = sel();
    if (!it) {
      put(canvas, h('div.drop-hero', { onclick: () => fileIn.click(), role: 'button', tabindex: '0' },
        h('div.drop-art', h('span.c0'), h('span.c1'), h('span.c2')),
        h('h2', 'Arrastrá aquí tu presentación en PDF'),
        h('p', 'En PowerPoint: Archivo → Guardar como → PDF. Cada página se convierte en una diapositiva.'),
        h('span.btn.primary', icon('upload', 18), 'Elegir archivo')));
      return;
    }
    const bad = problem(it);
    const tools = h('div.canvas-tools',
      h('span.canvas-kind', icon(TYPES[it.type].icon, 18), TYPES[it.type].label),
      it.type !== 'slide' && h('div.seg', { role: 'tablist' }, [['screen', 'Pantalla'], ['phone', 'Celular']].map(([v, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(view === v), onclick: () => { view = v; drawCanvas(); } }, l))),
      h('span.grow'),
      h('button.icon-btn', { title: 'Duplicar', onclick: () => duplicate(it) }, icon('copy', 18)),
      h('button.icon-btn', { title: 'Eliminar', onclick: () => remove(it) }, icon('trash', 18)));
    let frame;
    if (it.type === 'slide') frame = h('div.frame.slide', h('img', { src: it.data.src, alt: 'Diapositiva' }));
    else if (view === 'phone') frame = h('div.phone', h('div.play.mini', h('header.p-top', h('span.p-name', 'Participante'), h('span.p-score', h('b', '0'), ' pts')), h('div.p-body', h('h2.p-q', it.data.q), bad ? h('p.p-hint', bad) : player(it, { uid: 'vista', submit() {} }).el)));
    else frame = h('div.frame.dark', stage(it, { preview: true }));
    put(canvas, tools, h('div.canvas-area', frame), bad && h('p.canvas-warn', icon('x', 14), `${bad} para que esta actividad aparezca al presentar.`));
  }

  function drawSide() {
    const it = sel();
    // Si el formulario se reconstruye mientras alguien escribe, el cursor vuelve al mismo campo.
    const fields = () => [...side.querySelectorAll('input,textarea,select')];
    const at = fields().indexOf(document.activeElement), caret = at >= 0 ? document.activeElement.selectionStart : null;
    if (at >= 0) queueMicrotask(() => { const f = fields()[at]; if (!f) return; f.focus(); try { if (caret != null) f.setSelectionRange(caret, caret); } catch { /* */ } });
    if (!it) return put(side, h('div.side-empty', h('h3', 'Empezá por el contenido'), h('p', 'Subí un PDF o agregá una actividad. Después podés ordenar todo arrastrando en la columna izquierda.')));
    if (it.type === 'slide') return put(side, h('h3', 'Diapositiva'), h('p.muted', 'Las personas la ven en su dispositivo mientras está en pantalla. Arrastrala en la columna izquierda para cambiarla de lugar.'));
    put(side, h('h3', TYPES[it.type].label), editorForm(it, (structural) => { touch(it); drawCanvas(); drawFilm(); if (structural) drawSide(); }));
  }
  const drawAll = () => { drawFilm(); drawCanvas(); drawSide(); };
  function select(id) { selId = id; drawAll(); }

  /* ---- acciones */
  function addActivity(type) {
    const it = { id: uuid(), presentation_id: pid, pos: posAfter(selId)[0], type, data: TYPES[type].make(), thumb: null };
    items.push(it); sort(); touch(it, true); view = 'screen'; select(it.id);
    side.querySelector('textarea,input')?.focus();
  }
  function duplicate(src) {
    const it = { ...JSON.parse(JSON.stringify(src)), id: uuid(), pos: posAfter(src.id)[0] };
    items.push(it); sort(); touch(it, true); select(it.id);
  }
  async function remove(it) {
    if (!(await confirmBox('¿Eliminar este elemento?', it.type === 'slide' ? 'La diapositiva se quita de la presentación.' : 'La actividad y su configuración se pierden.'))) return;
    const i = items.indexOf(it); items.splice(i, 1); clearTimeout(pending.get(it.id)); pending.delete(it.id);
    store.deleteItem(it.id).catch(() => toast('No se pudo eliminar.', 'err'));
    select(items[Math.min(i, items.length - 1)]?.id || null);
  }
  async function importFiles(files) {
    const ppt = files.find((f) => /\.pptx?$/i.test(f.name));
    if (ppt) toast('Guardá el PowerPoint como PDF (Archivo → Guardar como) y subí ese archivo.', 'err');
    files = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || f.type.startsWith('image/'));
    if (!files.length) return;
    const note = toast('Preparando diapositivas…'); note.classList.add('sticky');
    let after = selId, added = 0;
    try {
      for (const f of files) for await (const { total, n, out } of pagesOf(f)) {
        note.textContent = `Subiendo diapositiva ${n} de ${total}…`;
        const src = await store.uploadImage(pid, out.blob);
        const it = { id: uuid(), presentation_id: pid, pos: posAfter(after)[0], type: 'slide', data: { src, w: out.w, h: out.h }, thumb: out.thumb };
        items.push(it); sort(); await store.saveItem(it); after = it.id; added++;
        if (!selId) selId = it.id;
        drawFilm(); if (added === 1) { drawCanvas(); drawSide(); }
      }
      toast(added === 1 ? 'Se agregó 1 diapositiva' : `Se agregaron ${added} diapositivas`, 'ok');
    } catch (e) { console.error(e); toast('No se pudo leer el archivo. Probá exportarlo de nuevo como PDF.', 'err'); }
    note.remove();
  }
  async function present() {
    const ready = items.filter((i) => !problem(i));
    if (!ready.length) return toast('Agregá al menos una diapositiva o una actividad completa.', 'err');
    await Promise.all([...pending.keys()].map((id) => { clearTimeout(pending.get(id)); return flush(id); }));
    try { const code = await store.createSession(pid, titleIn.value.trim() || pres.title, { phase: 'lobby', itemId: null, rev: 0 }); location.hash = '#/host/' + code; }
    catch { toast('No se pudo abrir la sala.', 'err'); }
  }

  /* ---- arrastrar archivos */
  const over = (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); shell.classList.add('dropping'); } };
  const leave = (e) => { if (!e.relatedTarget) shell.classList.remove('dropping'); };
  const drop = (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); shell.classList.remove('dropping'); importFiles([...e.dataTransfer.files]); };
  shell.addEventListener('dragover', over); shell.addEventListener('dragleave', leave); shell.addEventListener('drop', drop);

  /* ---- cambios de otros administradores */
  // Se conserva la identidad de cada objeto local para que el formulario abierto siga enlazado a él.
  function merge(remote) {
    let changed = false, selChanged = false;
    const next = remote.map((r) => {
      const mine = items.find((i) => i.id === r.id);
      if (!mine) { changed = true; return r; }
      if (pending.has(r.id) || JSON.stringify(mine) === JSON.stringify(r)) return mine;
      Object.assign(mine, r); changed = true; if (r.id === selId) selChanged = true;
      return mine;
    }).concat(items.filter((i) => pending.has(i.id) && !remote.some((r) => r.id === i.id)));
    if (next.length !== items.length) changed = true;
    items = next; sort();
    if (!changed) return;
    if (selId && !sel()) { selId = items[0]?.id || null; selChanged = true; }
    drawFilm(); drawCanvas(); if (selChanged) drawSide();
  }
  const unI = store.watchItems(pid, merge);
  const unP = store.watchPresentation(pid, (p) => { if (p && document.activeElement !== titleIn) { pres = p; titleIn.value = p.title; } });

  drawAll();
  return () => { unI(); unP(); document.removeEventListener('click', closeMenu); pending.forEach((t, id) => { clearTimeout(t); flush(id); }); };
}

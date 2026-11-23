// Vista del participante: sigue lo que marca quien presenta y puede repasar lo ya visto.
import { store, myUid, box } from './store.js';
import { h, put, icon, toast, fmt } from './ui.js';
import { TYPES, player, solution, problem } from './activities.js';

export async function play(root, code) {
  const name = box.getItem('pulso.name'), email = box.getItem('pulso.email');
  const session = await store.getSession(code).catch(() => null);
  if (!session) { root.append(h('main.center-page', h('div.card.narrow', h('h2', 'Esta sala no existe'), h('p.muted', 'Revisá el código con quien presenta.'), h('a.btn.primary.block', { href: '#/' }, 'Ingresar otro código')))); return; }
  if (!name || !email || box.getItem('pulso.in') !== code) { location.hash = '#/' + code; return; }

  const uid = myUid();
  let items = [], state = session.state, mine = {}, shown = '', current = null, tick, iv = state.iv, browse = null, seenT;
  const starts = {}, seenKey = 'pulso.seen.' + code;
  const seen = new Set(JSON.parse(box.getItem(seenKey) || '[]'));
  const loadItems = async () => { items = (await store.getItems(session.presentation_id, true)).filter((i) => !problem(i)); };
  await Promise.all([loadItems(), store.myAnswers(code).then((m) => { mine = m; }).catch(() => {}), store.join(code, name, email).catch(() => {})]);

  const scoreEl = h('b', '0'), body = h('div.p-body'), nav = h('nav.p-nav', { hidden: true, 'aria-label': 'Recorrido de la presentación' });
  root.append(h('div.play', h('header.p-top', h('span.p-name', name), h('span.p-score', scoreEl, ' pts')), body, nav));
  const total = () => Object.values(mine).reduce((s, r) => s + (r.pts || 0), 0);
  const liveIdx = () => items.findIndex((i) => i.id === state.itemId);

  // Avance: cada elemento visto se registra, con un retraso al azar para no saturar cuando todo el grupo cambia a la vez.
  function markSeen(id) {
    if (seen.has(id)) return; seen.add(id); box.setItem(seenKey, JSON.stringify([...seen]));
    clearTimeout(seenT); seenT = setTimeout(() => store.markSeen(code, [...seen]).catch(() => {}), 800 + Math.random() * 3200);
  }
  function elapsed(item) { return (Date.now() - (starts[item.id + ':' + state.startedAt] ?? Date.now())) / 1000; }
  function submit(item, value, frac) {
    const t = item.data.time || 0, speed = t ? 1 - 0.5 * Math.min(1, elapsed(item) / t) : 1;
    const rec = { name, value, frac, pts: frac == null ? 0 : Math.round(1000 * frac * speed) };
    if (mine[item.id] && TYPES[item.type].continuous && frac != null && (mine[item.id].frac || 0) >= frac) return;
    mine[item.id] = rec; scoreEl.textContent = fmt(total());
    store.answer(code, item.id, rec).catch(() => toast('No se pudo enviar. Revisá tu conexión.', 'err'));
    if (!TYPES[item.type].continuous) draw();
  }

  // Arma el PDF en el dispositivo con las diapositivas tal como quedaron en la presentación.
  async function downloadPdf(btn) {
    const slides = items.filter((i) => i.type === 'slide'), label = btn.lastChild;
    btn.disabled = true;
    try {
      if (!window.jspdf) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/jspdf.umd.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
      let doc;
      for (const [n, sl] of slides.entries()) {
        label.textContent = `Preparando ${n + 1} de ${slides.length}…`;
        const bmp = await createImageBitmap(await (await fetch(sl.data.src)).blob());
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0);
        const size = [c.width * 0.75, c.height * 0.75], dir = c.width >= c.height ? 'l' : 'p';
        if (!doc) doc = new window.jspdf.jsPDF({ unit: 'pt', format: size, orientation: dir, compress: true }); else doc.addPage(size, dir);
        doc.addImage(c.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, size[0], size[1]);
      }
      doc.save(`${(session.title || 'Presentación').replace(/[\\/:*?"<>|]/g, '').slice(0, 80)}.pdf`);
      toast('Se descargó la presentación', 'ok');
    } catch (e) { console.error(e); toast('No se pudo generar el PDF. Revisá tu conexión.', 'err'); }
    label.textContent = 'Descargar la presentación en PDF'; btn.disabled = false;
  }

  const wait = (title, text, ic) => h('div.p-wait', ic && h('div.p-badge', icon(ic, 34)), h('h2', title), text && h('p', text));
  function verdict(item, rec) {
    if (!TYPES[item.type].scored) return rec ? wait('¡Gracias por participar!', 'Los resultados están en la pantalla principal.', 'chart') : h('div.verdict.miss', h('h2', 'Sin respuesta'), h('p', 'No participaste en esta actividad.'));
    if (!rec) return h('div.verdict.miss', h('h2', 'Sin respuesta'), h('p', 'Esta vez no llegó tu respuesta.'));
    if (rec.frac >= 1) return h('div.verdict.good', h('div.p-badge', icon('check', 34)), h('h2', '¡Correcto!'), h('p.pts', `+${fmt(rec.pts)} puntos`));
    if (rec.frac > 0) return h('div.verdict.part', h('h2', `${Math.round(rec.frac * 100)} % de aciertos`), h('p.pts', `+${fmt(rec.pts)} puntos`));
    return h('div.verdict.bad', h('div.p-badge', icon('x', 34)), h('h2', 'Esta vez no'), h('p', 'La próxima es tuya.'));
  }
  const rankLine = () => { const r = state.board?.ranks?.[uid]; return r && h('div.p-rank', h('b', `${r[0]}.º`), h('span', `lugar entre ${Object.keys(state.board.ranks).length} · ${fmt(r[1])} puntos`)); };

  function drawNav() {
    const li = liveIdx(), running = ['slide', 'active', 'reveal', 'board'].includes(state.phase) && li >= 0;
    nav.hidden = !running || (li === 0 && !browse);
    if (nav.hidden) return;
    const bi = browse ? items.findIndex((i) => i.id === browse) : li;
    put(nav,
      h('button.icon-btn', { title: 'Anterior', disabled: bi <= 0, onclick: () => { browse = items[bi - 1].id; draw(); } }, icon('left')),
      h('span.p-nav-pos', `${bi + 1} de ${items.length}`),
      browse ? h('button.p-live', { onclick: () => { browse = null; draw(); } }, icon('live', 18), 'Volver al en vivo')
        : h('span.p-past', { style: { background: '#dff7ee', color: '#05573f' } }, 'En vivo'),
      h('button.icon-btn', { title: 'Siguiente', disabled: bi >= li, onclick: () => { browse = bi + 1 >= li ? null : items[bi + 1].id; draw(); } }, icon('right')));
  }

  function draw() {
    if (browse && (items.findIndex((i) => i.id === browse) < 0 || items.findIndex((i) => i.id === browse) >= liveIdx() || state.phase === 'end')) browse = null;
    const item = items.find((i) => i.id === state.itemId), rec = item && mine[item.id];
    const key = [browse, state.phase, state.itemId, state.startedAt, !!rec && !TYPES[item?.type]?.continuous, ['board', 'end', 'reveal'].includes(state.phase) ? state.rev : ''].join('|');
    drawNav();
    if (key === shown) return;
    // Si llega el cierre con una respuesta a medio hacer, se envía tal como está.
    if (current?.draft && current.item && !mine[current.item.id]) { const dr = current.draft(); if (dr) { const it = current.item; current = null; submit(it, dr.value, dr.frac); } }
    shown = key; current = null; clearInterval(tick);
    scoreEl.textContent = fmt(total());
    const set = (...kids) => { put(body, ...kids); body.scrollTop = 0; };

    if (browse) {
      const it = items.find((i) => i.id === browse);
      if (it.type === 'slide') return set(h('span.p-past', 'Repaso'), h('div.p-slide', h('img', { src: it.data.src, alt: 'Diapositiva' })));
      const sol = TYPES[it.type].scored && solution(it);
      return set(h('span.p-past', 'Repaso'), h('h2.p-q', it.data.q), verdict(it, mine[it.id]), sol && h('div.p-sol', h('p.eyebrow', 'Respuesta correcta'), sol));
    }
    if (state.phase === 'lobby') return set(wait(`¡Ya estás dentro, ${name.split(' ')[0]}!`, 'Mirá la pantalla principal. La presentación empieza en un momento.', 'check'));
    if (state.phase === 'board' || state.phase === 'end') {
      const r = state.board?.ranks?.[uid], end = state.phase === 'end';
      return set(h('div.p-wait.rank', !r && h('p.eyebrow', end ? 'Resultado final' : 'Clasificación'),
        r ? [h('p', end ? 'Terminaste en el lugar' : 'Vas en el lugar'), h('div.rank-n', String(r[0])), h('p', `con ${fmt(r[1])} puntos`)] : h('p', 'Todavía no tenés puntos en la tabla.'),
        end && h('p.muted', '¡Gracias por participar!'),
        end && items.some((i) => i.type === 'slide') && h('button.btn.primary.big.pdf-btn', { onclick: (e) => downloadPdf(e.currentTarget) }, icon('down', 18), 'Descargar la presentación en PDF')));
    }
    if (!item) return set(wait('Un momento', 'Quien presenta está preparando lo siguiente.', 'clock'));
    markSeen(item.id);
    if (item.type === 'slide') return set(h('div.p-slide', h('img', { src: item.data.src, alt: 'Diapositiva actual' })));

    const T = TYPES[item.type], head = h('h2.p-q', item.data.q);
    if (state.phase === 'reveal') {
      const sol = T.scored && solution(item);
      return set(head, verdict(item, rec), T.scored && rankLine(), sol && h('div.p-sol', h('p.eyebrow', 'Respuesta correcta'), sol));
    }
    // fase activa
    const k = item.id + ':' + state.startedAt;
    starts[k] ??= Math.min(Date.now(), Math.max(state.startedAt || 0, Date.now() - 4000));
    if (rec && !T.continuous) return set(head, wait('Respuesta enviada', 'Esperá a que quien presenta muestre los resultados.', 'check'));
    const t = item.data.time || 0, bar = t ? h('div.p-timer', h('i')) : null;
    const ui = player(item, { uid, rec, submit: (v, f) => submit(item, v, f) });
    current = { item, draft: ui.draft };
    set(bar, head, ui.el);
    if (t) {
      const step = () => {
        const left = Math.max(0, 1 - elapsed(item) / t);
        bar.firstChild.style.transform = `scaleX(${left})`; bar.classList.toggle('low', left < 0.25);
        if (left <= 0) {
          clearInterval(tick);
          const dr = current?.draft?.(); current = null;
          if (dr && !mine[item.id]) submit(item, dr.value, dr.frac);
          else if (!mine[item.id] || T.continuous) set(head, wait('Se acabó el tiempo', 'Mirá los resultados en la pantalla principal.', 'clock'));
        }
      };
      step(); tick = setInterval(step, 200);
    }
  }

  const un = store.watchSession(code, async (s) => {
    const prev = state; state = s;
    if (s.iv !== iv || (s.itemId && !items.some((i) => i.id === s.itemId))) { iv = s.iv; const snap = () => JSON.stringify(items.find((i) => i.id === s.itemId)); const was = snap(); await loadItems().catch(() => {}); if (snap() !== was) shown = ''; }
    // Una actividad nueva trae de vuelta al en vivo a quien estaba repasando.
    if (browse && s.itemId !== prev.itemId && items.find((i) => i.id === s.itemId)?.type !== 'slide') { browse = null; toast('Empezó una actividad nueva'); }
    draw();
  });
  draw();
  return () => { un(); clearInterval(tick); };
}

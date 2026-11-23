// Vista del participante: sigue lo que marca quien presenta.
import { store, myUid, box } from './store.js';
import { h, put, icon, toast, fmt } from './ui.js';
import { TYPES, player, solution, problem } from './activities.js';

export async function play(root, code) {
  const name = box.getItem('pulso.name');
  const session = await store.getSession(code).catch(() => null);
  if (!session) { root.append(h('main.center-page', h('div.card.narrow', h('h2', 'Esta sala no existe'), h('p.muted', 'Revisá el código con quien presenta.'), h('a.btn.primary.block', { href: '#/' }, 'Ingresar otro código')))); return; }
  if (!name || box.getItem('pulso.in') !== code) { location.hash = '#/' + code; return; }

  const uid = myUid();
  let items = [], state = session.state, mine = {}, shown = '', current = null, tick, iv = state.iv;
  const starts = {};
  const loadItems = async () => { items = (await store.getItems(session.presentation_id, true)).filter((i) => !problem(i)); };
  await Promise.all([loadItems(), store.myAnswers(code).then((m) => { mine = m; }).catch(() => {}), store.join(code, name).catch(() => {})]);

  const scoreEl = h('b', '0'), body = h('div.p-body');
  root.append(h('div.play', h('header.p-top', h('span.p-name', name), h('span.p-score', scoreEl, ' pts')), body));
  const total = () => Object.values(mine).reduce((s, r) => s + (r.pts || 0), 0);

  function elapsed(item) { return (Date.now() - (starts[item.id + ':' + state.startedAt] ?? Date.now())) / 1000; }
  function submit(item, value, frac) {
    const t = item.data.time || 0, speed = t ? 1 - 0.5 * Math.min(1, elapsed(item) / t) : 1;
    const rec = { name, value, frac, pts: frac == null ? 0 : Math.round(1000 * frac * speed) };
    if (mine[item.id] && TYPES[item.type].continuous && frac != null && (mine[item.id].frac || 0) >= frac) return;
    mine[item.id] = rec; scoreEl.textContent = fmt(total());
    store.answer(code, item.id, rec).catch(() => toast('No se pudo enviar. Revisá tu conexión.', 'err'));
    if (!TYPES[item.type].continuous) draw();
  }

  const wait = (title, text, ic) => h('div.p-wait', ic && h('div.p-badge', icon(ic, 34)), h('h2', title), text && h('p', text));

  function draw() {
    const item = items.find((i) => i.id === state.itemId), rec = item && mine[item.id];
    const key = [state.phase, state.itemId, state.startedAt, !!rec && !TYPES[item?.type]?.continuous, state.phase === 'board' || state.phase === 'end' ? state.rev : ''].join('|');
    if (key === shown) return;
    // Si llega el cierre con una respuesta a medio hacer, se envía tal como está.
    if (current?.draft && current.item && !mine[current.item.id]) { const dr = current.draft(); if (dr) { const it = current.item; current = null; submit(it, dr.value, dr.frac); } }
    shown = key; current = null; clearInterval(tick);
    scoreEl.textContent = fmt(total());
    const set = (...kids) => { put(body, ...kids); body.scrollTop = 0; };

    if (state.phase === 'lobby') return set(wait(`¡Ya estás dentro, ${name.split(' ')[0]}!`, 'Mirá la pantalla principal. La presentación empieza en un momento.', 'check'));
    if (state.phase === 'board' || state.phase === 'end') {
      const r = state.board?.ranks?.[uid], end = state.phase === 'end';
      return set(h('div.p-wait.rank', !r && h('p.eyebrow', end ? 'Resultado final' : 'Clasificación'),
        r ? [h('p', end ? 'Terminaste en el lugar' : 'Vas en el lugar'), h('div.rank-n', String(r[0])), h('p', `con ${fmt(r[1])} puntos`)] : h('p', 'Todavía no tenés puntos en la tabla.'),
        end && h('p.muted', '¡Gracias por participar!')));
    }
    if (!item) return set(wait('Un momento', 'Quien presenta está preparando lo siguiente.', 'clock'));
    if (item.type === 'slide') return set(h('div.p-slide', h('img', { src: item.data.src, alt: 'Diapositiva actual' })));

    const T = TYPES[item.type], head = h('h2.p-q', item.data.q);
    if (state.phase === 'reveal') {
      let verdict;
      if (!T.scored) verdict = wait('¡Gracias por participar!', 'Los resultados están en la pantalla principal.', 'chart');
      else if (!rec) verdict = h('div.verdict.miss', h('h2', 'Se acabó el tiempo'), h('p', 'Esta vez no llegó tu respuesta.'));
      else if (rec.frac >= 1) verdict = h('div.verdict.good', h('div.p-badge', icon('check', 34)), h('h2', '¡Correcto!'), h('p.pts', `+${fmt(rec.pts)} puntos`));
      else if (rec.frac > 0) verdict = h('div.verdict.part', h('h2', `${Math.round(rec.frac * 100)} % de aciertos`), h('p.pts', `+${fmt(rec.pts)} puntos`));
      else verdict = h('div.verdict.bad', h('div.p-badge', icon('x', 34)), h('h2', 'Esta vez no'), h('p', 'La próxima es tuya.'));
      const sol = T.scored && solution(item);
      return set(head, verdict, sol && h('div.p-sol', h('p.eyebrow', 'Respuesta correcta'), sol));
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
    state = s;
    if (s.iv !== iv || (s.itemId && !items.some((i) => i.id === s.itemId))) { iv = s.iv; const snap = () => JSON.stringify(items.find((i) => i.id === s.itemId)); const was = snap(); await loadItems().catch(() => {}); if (snap() !== was) shown = ''; }
    draw();
  });
  draw();
  return () => { un(); clearInterval(tick); };
}

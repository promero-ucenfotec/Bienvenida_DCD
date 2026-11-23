// Vista de quien presenta. Varios administradores pueden abrir la misma sala y controlarla a la vez.
import { store } from './store.js';
import { h, put, icon, toast, fmt, confirmBox } from './ui.js';
import { TYPES, stage, problem, titleOf } from './activities.js';
import { downloadResults } from './report.js';

const joinUrl = (code) => location.origin + location.pathname + '#/' + code;
const prettyCode = (c) => c.slice(0, 3) + ' ' + c.slice(3);
function qr(text) {
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return h('div.qr', { html: q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) });
}

export async function host(root, code) {
  const session = await store.getSession(code).catch(() => null);
  if (!session) { root.append(h('main.center-page', h('div.card.narrow', h('h2', 'Esta sala ya no existe'), h('a.btn.primary.block', { href: '#/admin' }, 'Volver a mis presentaciones')))); return; }
  const pid = session.presentation_id;
  let items = (await store.getItems(pid)).filter((i) => !problem(i));
  let state = session.state, players = [], answers = [], sig = '', barSig = '', ansEl, timerEl, drawer = false, busy = false;

  const stageEl = h('main.h-stage'), bar = h('footer.h-bar'), strip = h('aside.h-strip');
  const count = h('b', '0');
  const shell = h('div.host',
    h('header.h-top',
      h('a.brand.light', { href: '#/admin', title: 'Volver a mis presentaciones' }, h('span.brand-mark'), 'TeachDeck'),
      h('div.h-join', 'Entrá en ', h('b', (location.host + location.pathname).replace(/\/(index\.html)?$/, '')), ' con el código ', h('b.h-code', prettyCode(code))),
      h('div.h-people', icon('users', 18), count)),
    stageEl, strip, bar);
  root.append(shell);

  const idx = () => items.findIndex((i) => i.id === state.itemId);
  const cur = () => items[idx()];
  const go = (patch) => { state = { ...state, ...patch, rev: (state.rev || 0) + 1 }; sig = ''; draw(); store.setState(code, state).catch(() => toast('No se pudo sincronizar. Revisá la conexión.', 'err')); };
  const show = (i) => { const it = items[i]; if (!it) return; answers = []; go({ itemId: it.id, phase: it.type === 'slide' ? 'slide' : 'active', startedAt: Date.now(), board: null }); };

  async function board() {
    const all = await store.getAnswers(code).catch(() => []);
    const tot = new Map(players.map((p) => [p.uid, { name: p.name, pts: 0 }]));
    all.forEach((a) => { const e = tot.get(a.uid) || { name: a.name, pts: 0 }; e.pts += a.pts || 0; tot.set(a.uid, e); });
    const list = [...tot.entries()].sort((a, b) => b[1].pts - a[1].pts);
    const ranks = {}; list.forEach(([uid, e], i) => { ranks[uid] = [i + 1, e.pts]; });
    return { top: list.slice(0, 8).map(([, e]) => e), ranks };
  }
  const act = {
    next() {
      if (state.phase === 'lobby') return show(0);
      if (state.phase === 'board') return act.toggleBoard();
      if (state.phase === 'active' && TYPES[cur()?.type]?.scored) return act.reveal();
      if (idx() < items.length - 1) return show(idx() + 1);
      return act.end();
    },
    prev() { if (state.phase === 'board') return act.toggleBoard(); if (idx() > 0) show(idx() - 1); },
    // Al mostrar resultados se recalcula la tabla, así cada participante ve su lugar de inmediato.
    async reveal() { const id = state.itemId; const b = await board(); if (state.itemId === id && state.phase === 'active') go({ phase: 'reveal', board: b }); },
    async toggleBoard() {
      if (state.phase === 'board') return go({ phase: state.back || 'slide', board: null });
      const b = await board();
      go({ phase: 'board', board: b, back: state.phase === 'active' ? 'reveal' : state.phase });
    },
    async end() {
      if (state.phase === 'end') return;
      if (!(await confirmBox('¿Terminar la sesión?', 'Se muestra la clasificación final y la sala se cierra para todo el grupo.', 'Terminar'))) return;
      const b = await board(); go({ phase: 'end', board: b }); store.endSession(code).catch(() => {});
    },
  };

  function primaryLabel() {
    const it = cur();
    if (state.phase === 'lobby') return 'Empezar';
    if (state.phase === 'board') return 'Continuar';
    if (state.phase === 'active' && TYPES[it?.type]?.scored) return 'Mostrar resultados';
    return idx() < items.length - 1 ? 'Siguiente' : 'Terminar';
  }

  function drawBoard(end) {
    const top = state.board?.top || [], max = Math.max(1, top[0]?.pts || 0);
    if (!top.length) return h('div.act', h('h2.act-q', end ? 'Fin de la sesión' : 'Clasificación'), h('p.empty-live', 'Todavía no hay puntos registrados.'));
    return h('div.board', h('h2.act-q', end ? 'Clasificación final' : 'Clasificación'),
      h('ol.board-list', top.map((p, i) => h('li', { class: i < 3 ? 'top' + (i + 1) : '', style: { '--w': p.pts / max, '--d': `${(top.length - i) * 90}ms` } },
        h('span.b-rank', String(i + 1)), h('span.b-name', p.name), h('span.b-bar', h('i')), h('span.b-pts', fmt(p.pts))))));
  }

  function draw() {
    const it = cur(), i = idx(), ended = state.phase === 'end';
    count.textContent = String(players.length);
    const s = JSON.stringify([state.phase, state.itemId, state.rev, items.length, it && it.data, state.phase === 'lobby' ? players.map((p) => p.uid) : 0, answers.map((a) => [a.uid, a.pts, a.value])]);
    if (s !== sig) {
      sig = s;
      shell.dataset.phase = state.phase;
      if (state.phase === 'lobby') {
        put(stageEl, h('div.lobby',
          h('div.lobby-join', h('div', h('p.lobby-lead', 'Unite desde tu celular'), h('p.lobby-url', (location.host + location.pathname).replace(/\/(index\.html)?$/, '')), h('p.lobby-code', prettyCode(code))), qr(joinUrl(code))),
          h('div.lobby-people', players.length ? players.map((p) => h('span.person', p.name)) : h('p.empty-live', 'Esperando a que entren las primeras personas.'))));
      } else if (state.phase === 'board' || ended) put(stageEl, drawBoard(ended));
      else if (!it) put(stageEl, h('p.empty-live', 'Esta presentación no tiene contenido listo para mostrar.'));
      else if (it.type === 'slide') put(stageEl, h('img.h-slide', { src: it.data.src, alt: `Diapositiva ${i + 1}` }));
      else put(stageEl, stage(it, { phase: state.phase, answers }));

      strip.hidden = !drawer;
      put(strip, ...items.map((x, k) => h('button.strip-item', { class: x.id === state.itemId ? 'on' : '', onclick: () => { drawer = false; show(k); } },
        h('span.strip-n', String(k + 1)), x.thumb ? h('img', { src: x.thumb, alt: '' }) : h('span.strip-act', icon(TYPES[x.type].icon, 18), titleOf(x)))));
    }
    // barra de control: se reconstruye solo si cambia su estructura, para no perder clics
    const isAct = it && it.type !== 'slide' && (state.phase === 'active' || state.phase === 'reveal');
    const t = it?.data?.time || 0, left = t && state.phase === 'active' ? Math.max(0, Math.ceil(t - (Date.now() - state.startedAt) / 1000)) : null;
    const bs = [state.phase, i, items.length, drawer, isAct, left != null].join('|');
    if (bs !== barSig) {
      barSig = bs;
      ansEl = h('span.h-answers'); timerEl = h('span.h-timer');
      put(bar, 
        h('div.h-left',
          h('button.hbtn', { title: 'Anterior (←)', disabled: ended || state.phase === 'lobby' || (i <= 0 && state.phase !== 'board'), onclick: act.prev }, icon('left')),
          h('span.h-pos', state.phase === 'lobby' ? 'Sala de espera' : ended ? 'Sesión terminada' : `${i + 1} de ${items.length}`),
          isAct && ansEl, left != null && timerEl),
        h('div.h-right',
          h('button.hbtn.txt', { title: 'Lista de contenido', disabled: ended, 'aria-pressed': String(drawer), onclick: () => { drawer = !drawer; sig = ''; draw(); } }, icon('grid', 18), 'Contenido'),
          h('button.hbtn.txt', { title: 'Clasificación', disabled: ended || state.phase === 'lobby', 'aria-pressed': String(state.phase === 'board'), onclick: act.toggleBoard }, icon('trophy', 18), 'Clasificación'),
          h('button.hbtn.txt', { title: 'Descargar resultados en Excel', disabled: state.phase === 'lobby', onclick: () => downloadResults(code) }, icon('down', 18), 'Excel'),
          h('button.hbtn', { title: 'Pantalla completa (F)', onclick: fullscreen }, icon('expand', 18)),
          !ended && h('button.hbtn.txt', { title: 'Terminar la sesión', onclick: act.end }, icon('stop', 16), 'Terminar'),
          ended ? h('button.btn.primary.big', { onclick: () => downloadResults(code) }, icon('down', 18), 'Descargar resultados')
            : h('button.btn.primary.big', { disabled: state.phase === 'lobby' && !items.length, onclick: act.next }, primaryLabel(), icon('right', 18))));
    }
    if (isAct) put(ansEl, h('b', String(answers.length)), ` de ${players.length} respondieron`);
    if (left != null) { put(timerEl, icon('clock', 18), `${left} s`); timerEl.classList.toggle('low', left <= 5); }
  }
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen?.());

  async function poll() {
    if (busy || state.phase === 'end') return; busy = true;
    try {
      players = await store.getPlayers(code);
      const it = cur();
      if (it && it.type !== 'slide' && (state.phase === 'active' || state.phase === 'reveal')) answers = await store.getAnswers(code, it.id);
    } catch { /* se reintenta en la siguiente vuelta */ }
    busy = false;
    const it = cur(), t = it?.data?.time || 0;
    if (t && state.phase === 'active' && Date.now() - state.startedAt > t * 1000 + 1200) {
      if (TYPES[it.type].scored) act.reveal(); else draw();
    } else draw();
  }
  const timer = setInterval(poll, 1000); poll();

  const unS = store.watchSession(code, (s) => { if ((s.rev || 0) >= (state.rev || 0) && JSON.stringify(s) !== JSON.stringify(state)) { if (s.itemId !== state.itemId) answers = []; state = s; sig = ''; draw(); } });
  const unI = store.watchItems(pid, (list) => {
    items = list.filter((i) => !problem(i)); sig = ''; draw();
    state = { ...state, iv: Date.now() }; store.setState(code, state).catch(() => {});
  });
  const onKey = (e) => {
    if (e.target.closest('input,textarea,select,dialog')) return;
    if (e.key === ' ' && e.target.closest('button,a')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); act.next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); act.prev(); }
    else if (e.key.toLowerCase() === 'f') fullscreen();
  };
  window.addEventListener('keydown', onKey);
  draw();
  return () => { clearInterval(timer); unS(); unI(); window.removeEventListener('keydown', onKey); };
}

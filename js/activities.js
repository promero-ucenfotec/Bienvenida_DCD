// Tipos de actividad: datos iniciales, formulario de edición, vista de pantalla y vista de participante.
import { h, put, icon, shape, shuffled, seeded, norm, sortable } from './ui.js';

const pairsSeed = () => [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }];
export const TYPES = {
  slide: { label: 'Diapositiva', icon: 'image' },
  quiz: { label: 'Opción múltiple', hint: 'Pregunta con respuesta correcta y puntos por rapidez', icon: 'quiz', scored: true,
    make: () => ({ q: '', options: [{ t: '', ok: true }, { t: '', ok: false }, { t: '', ok: false }, { t: '', ok: false }], time: 20 }) },
  poll: { label: 'Encuesta', hint: 'Votación en vivo, sin respuesta correcta', icon: 'bars', live: true,
    make: () => ({ q: '', options: [{ t: '' }, { t: '' }, { t: '' }], time: 0 }) },
  open: { label: 'Respuesta abierta', hint: 'Nube de palabras o muro de ideas', icon: 'cloud', live: true, continuous: true,
    make: () => ({ q: '', mode: 'cloud', max: 3, time: 0 }) },
  match: { label: 'Asocie', hint: 'Arrastrar cada elemento junto a su pareja', icon: 'swap', scored: true,
    make: () => ({ q: 'Asociá cada concepto con su pareja', pairs: pairsSeed(), time: 60 }) },
  fill: { label: 'Completar la oración', hint: 'Espacios en blanco con banco de palabras', icon: 'text', scored: true,
    make: () => ({ q: 'Completá la oración', text: '', extra: '', time: 45 }) },
  order: { label: 'Formar la oración', hint: 'Ordenar las palabras revueltas', icon: 'grid', scored: true,
    make: () => ({ q: 'Ordená las palabras', sentence: '', time: 45 }) },
  pairs: { label: 'Parejas', hint: 'Juego de memoria con tarjetas', icon: 'cards', scored: true, continuous: true,
    make: () => ({ q: 'Encontrá las parejas', pairs: pairsSeed(), time: 90 }) },
  frog: { label: 'Rana saltarina', hint: 'Varias preguntas: la rana salta con cada acierto', icon: 'frog', scored: true, continuous: true,
    make: () => ({ q: 'Ayudá a la rana a cruzar el estanque', questions: [{ q: '', options: ['', '', ''], ok: 0 }, { q: '', options: ['', '', ''], ok: 0 }], time: 90 }) },
  soup: { label: 'Sopa de letras', hint: 'Encontrar las palabras escondidas', icon: 'search', scored: true, continuous: true,
    make: () => ({ q: 'Encontrá las palabras escondidas', words: '', time: 120 }) },
  letters: { label: 'Palabra secreta', hint: 'Ordenar las letras a partir de una pista', icon: 'letters', scored: true,
    make: () => ({ q: '', word: '', time: 30 }) },
};
export const ACTIVITY_TYPES = Object.keys(TYPES).filter((t) => t !== 'slide');

export const fillParts = (text) => String(text || '').split(/\[([^\]]+)\]/).map((s, i) => (i % 2 ? { blank: s.trim() } : { t: s })).filter((p) => p.blank || p.t);
export const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const goodPairs = (d) => (d.pairs || []).filter((p) => p.a?.trim() && p.b?.trim());
const goodOpts = (d) => (d.options || []).filter((o) => o.t?.trim());
const goodFrog = (d) => (d.questions || []).filter((x) => x.q?.trim() && (x.options || []).filter((o) => o?.trim()).length >= 2 && x.options[x.ok]?.trim());
export const soupWords = (d) => [...new Set(String(d.words || '').split(/[,;\n]/).map((w) => norm(w).toUpperCase().replace(/[^A-Z]/g, '')).filter((w) => w.length >= 3 && w.length <= 10))].slice(0, 8);
const letterList = (d) => [...String(d.word || '').trim().toUpperCase()].filter((c) => c.trim());

// Sopa de letras: la misma semilla produce siempre la misma cuadrícula, así la pantalla y los celulares coinciden.
export function makeGrid(wordList, seed) {
  const ws = [...wordList].sort((a, b) => b.length - a.length), size = Math.min(10, Math.max(8, (ws[0]?.length || 0) + 1));
  const r = seeded(seed), cells = Array(size * size).fill(''), placed = [], dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const w of ws) for (let t = 0; t < 400; t++) {
    const [dx, dy] = dirs[Math.floor(r() * dirs.length)], x = Math.floor(r() * size), y = Math.floor(r() * size);
    const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
    if (ex < 0 || ex >= size || ey < 0 || ey >= size) continue;
    const idx = [...w].map((_, k) => (y + dy * k) * size + x + dx * k);
    if (idx.some((i, k) => cells[i] && cells[i] !== w[k])) continue;
    idx.forEach((i, k) => { cells[i] = w[k]; }); placed.push({ w, idx }); break;
  }
  const abc = 'AEIOUAEIOSRNLDCTMPBGVHFJ';
  return { size, cells: cells.map((c) => c || abc[Math.floor(r() * abc.length)]), placed };
}
const FROG = '<svg viewBox="0 0 64 56" width="100%" height="100%"><ellipse cx="32" cy="36" rx="24" ry="17" fill="#35b85a"/><circle cx="20" cy="17" r="9.5" fill="#35b85a"/><circle cx="44" cy="17" r="9.5" fill="#35b85a"/><ellipse cx="32" cy="42" rx="14" ry="8" fill="#c9f5b4" opacity=".6"/><circle cx="20" cy="16" r="5.4" fill="#fff"/><circle cx="44" cy="16" r="5.4" fill="#fff"/><circle cx="21" cy="16" r="2.6" fill="#17143a"/><circle cx="45" cy="16" r="2.6" fill="#17143a"/><path d="M22 36c6 5 14 5 20 0" fill="none" stroke="#17143a" stroke-width="2.6" stroke-linecap="round"/></svg>';
const frog = () => h('span.frog', { 'aria-hidden': 'true', html: FROG });

// Devuelve lo que le falta a la actividad para poder presentarse, o null si está lista.
export function problem(item) {
  const d = item.data || {};
  switch (item.type) {
    case 'slide': return null;
    case 'quiz': if (!d.q?.trim()) return 'Falta la pregunta'; if (goodOpts(d).length < 2) return 'Agregá al menos dos opciones'; return goodOpts(d).some((o) => o.ok) ? null : 'Marcá la opción correcta';
    case 'poll': if (!d.q?.trim()) return 'Falta la pregunta'; return goodOpts(d).length < 2 ? 'Agregá al menos dos opciones' : null;
    case 'open': return d.q?.trim() ? null : 'Falta la pregunta';
    case 'match': case 'pairs': return goodPairs(d).length < 2 ? 'Completá al menos dos parejas' : null;
    case 'fill': return fillParts(d.text).some((p) => p.blank) ? null : 'Marcá al menos un espacio entre corchetes';
    case 'order': return words(d.sentence).length < 3 ? 'Escribí una oración de tres palabras o más' : null;
    case 'frog': return goodFrog(d).length ? null : 'Completá al menos una pregunta con sus opciones';
    case 'soup': return soupWords(d).length < 2 ? 'Escribí al menos dos palabras de 3 a 10 letras' : null;
    case 'letters': if (!d.q?.trim()) return 'Falta la pista'; return letterList(d).length < 3 || letterList(d).length > 14 ? 'Escribí una palabra de 3 a 14 letras' : null;
  }
  return null;
}
export const titleOf = (item) => (item.type === 'slide' ? 'Diapositiva' : item.data?.q?.trim() || TYPES[item.type].label);

/* ------------------------------------------------------------ formulario */
const TIMES = [[0, 'Sin límite'], [10, '10 segundos'], [20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto'], [90, '1 minuto y medio'], [120, '2 minutos'], [180, '3 minutos']];

export function editorForm(item, commit) {
  const d = item.data;
  const field = (label, input, hint) => h('label.field', h('span.lbl', label), input, hint && h('span.hint', hint));
  const inp = (obj, key, ph, big) => h(big ? 'textarea.inp' : 'input.inp', { value: obj[key] || '', placeholder: ph, rows: big ? 3 : null, oninput: (e) => { obj[key] = e.target.value; commit(); } });
  const sel = (obj, key, opts, num) => h('select.inp', { onchange: (e) => { obj[key] = num ? +e.target.value : e.target.value; commit(); } },
    opts.map(([v, l]) => h('option', { value: v, selected: obj[key] == v }, l)));
  const del = (arr, i, min) => h('button.icon-btn', { type: 'button', title: 'Quitar', disabled: arr.length <= min, onclick: () => { arr.splice(i, 1); commit(true); } }, icon('x', 16));
  const add = (label, fn) => h('button.btn.soft.small', { type: 'button', onclick: () => { fn(); commit(true); } }, icon('plus', 16), label);
  const out = [];

  if (item.type !== 'slide') out.push(field(item.type === 'letters' ? 'Pista' : item.type === 'quiz' || item.type === 'poll' || item.type === 'open' ? 'Pregunta' : 'Indicación', inp(d, 'q', 'Escribí aquí lo que verá el grupo', true)));

  if (item.type === 'quiz' || item.type === 'poll') {
    d.options ??= [];
    out.push(h('div.field', h('span.lbl', 'Opciones'),
      d.options.map((o, i) => h('div.opt-row',
        item.type === 'quiz'
          ? h('button.mark', { class: `c${i} ${o.ok ? 'on' : ''}`, type: 'button', title: o.ok ? 'Correcta' : 'Marcar como correcta', 'aria-pressed': String(!!o.ok), onclick: () => { o.ok = !o.ok; commit(true); } }, o.ok ? icon('check', 16) : shape(i, 14))
          : h('span.mark.static', { class: `c${i}` }, shape(i, 14)),
        inp(o, 't', `Opción ${i + 1}`), del(d.options, i, 2))),
      d.options.length < 6 && add('Agregar opción', () => d.options.push(item.type === 'quiz' ? { t: '', ok: false } : { t: '' })),
      item.type === 'quiz' && h('span.hint', 'Tocá la figura de color para marcar las correctas.')));
  }
  if (item.type === 'open') {
    out.push(field('Cómo se muestran las respuestas', sel(d, 'mode', [['cloud', 'Nube de palabras'], ['wall', 'Muro de ideas']])));
    out.push(field('Respuestas por persona', sel(d, 'max', [[1, 'Una'], [2, 'Dos'], [3, 'Tres'], [5, 'Cinco']], true)));
  }
  if (item.type === 'match' || item.type === 'pairs') {
    d.pairs ??= [];
    out.push(h('div.field', h('span.lbl', 'Parejas'),
      d.pairs.map((p, i) => h('div.pair-row', inp(p, 'a', 'Concepto'), h('span.pair-link', icon('link', 16)), inp(p, 'b', 'Pareja'), del(d.pairs, i, 2))),
      d.pairs.length < 8 && add('Agregar pareja', () => d.pairs.push({ a: '', b: '' }))));
  }
  if (item.type === 'fill') {
    out.push(field('Oración', inp(d, 'text', 'La [célula] es la unidad básica de la [vida].', true), 'Poné entre corchetes cada palabra que queda en blanco.'));
    out.push(field('Palabras distractoras', inp(d, 'extra', 'átomo, energía'), 'Opcionales, separadas por coma.'));
  }
  if (item.type === 'order') out.push(field('Oración correcta', inp(d, 'sentence', 'El aprendizaje activo mejora la retención', true), 'Cada persona la recibe con las palabras revueltas.'));
  if (item.type === 'frog') {
    d.questions ??= [];
    out.push(h('div.field', h('span.lbl', 'Preguntas del recorrido'),
      d.questions.map((x, n) => h('div.q-block', h('div.q-head', h('b', `Salto ${n + 1}`), del(d.questions, n, 1)),
        inp(x, 'q', 'Pregunta'),
        [0, 1, 2].map((i) => h('div.opt-row',
          h('button.mark.c3', { class: x.ok === i ? 'on' : '', type: 'button', title: x.ok === i ? 'Correcta' : 'Marcar como correcta', 'aria-pressed': String(x.ok === i), onclick: () => { x.ok = i; commit(true); } }, x.ok === i ? icon('check', 16) : h('span.dot')),
          inp(x.options, i, `Opción ${i + 1}`))))),
      d.questions.length < 10 && add('Agregar pregunta', () => d.questions.push({ q: '', options: ['', '', ''], ok: 0 })),
      h('span.hint', 'La rana tiene tres vidas: cada error le quita una.')));
  }
  if (item.type === 'soup') out.push(field('Palabras escondidas', inp(d, 'words', 'rúbrica, evidencia, criterio', true), 'Hasta ocho palabras de 3 a 10 letras, separadas por coma. Las tildes se quitan en la cuadrícula.'));
  if (item.type === 'letters') out.push(field('Palabra secreta', inp(d, 'word', 'RÚBRICA'), 'Cada persona recibe las letras revueltas.'));
  if (item.type !== 'slide') out.push(field('Tiempo para responder', sel(d, 'time', TIMES, true)));
  return h('div.form', out);
}

/* -------------------------------------------------------------- solución */
export function solution(item) {
  const d = item.data;
  switch (item.type) {
    case 'quiz': return h('div.sol', goodOpts(d).filter((o) => o.ok).map((o) => h('span.sol-chip', icon('check', 16), o.t)));
    case 'match': case 'pairs': return h('div.sol.sol-pairs', goodPairs(d).map((p) => h('div.sol-pair', h('span', p.a), h('i'), h('span', p.b))));
    case 'fill': return h('p.sol.sol-text', fillParts(d.text).map((p) => (p.blank ? h('b', p.blank) : p.t)));
    case 'order': return h('p.sol.sol-text', words(d.sentence).join(' '));
    case 'frog': return h('div.sol.sol-pairs', goodFrog(d).map((x) => h('div.sol-pair', h('span', x.q), h('i'), h('span', x.options[x.ok]))));
    case 'soup': return h('div.sol', soupWords(d).map((w) => h('span.sol-chip', w)));
    case 'letters': return h('div.sol', h('span.sol-chip.word', letterList(d).join('')));
  }
  return null;
}

/* ------------------------------------------------- pantalla del presentador */
export function stage(item, { phase = 'active', answers = [], preview = false } = {}) {
  const d = item.data, reveal = phase === 'reveal', n = answers.length;
  const q = h('h2.act-q', d.q?.trim() || h('span.muted', 'Escribí la pregunta en el panel derecho'));
  const body = [];

  if (item.type === 'quiz' || item.type === 'poll') {
    const opts = (d.options || []).map((o, i) => ({ ...o, i })).filter((o) => o.t?.trim() || preview);
    const counts = opts.map((o) => answers.filter((a) => (a.value || []).includes(o.i)).length);
    const max = Math.max(1, ...counts), showBars = reveal || (item.type === 'poll' && !preview && n > 0);
    body.push(h('div.tiles', { class: `n${opts.length} ${showBars ? 'bars' : ''}` }, opts.map((o, k) => h('div.tile', {
      class: `c${o.i} ${reveal && item.type === 'quiz' ? (o.ok ? 'ok' : 'no') : ''}`, style: { '--pct': showBars ? counts[k] / max : 0 } },
      h('span.tile-fill'), shape(o.i, 30), h('span.tile-t', o.t || `Opción ${o.i + 1}`),
      showBars && h('span.tile-n', String(counts[k])), reveal && o.ok && h('span.tile-ok', icon('check', 26))))));
  }
  if (item.type === 'open') {
    const all = answers.flatMap((a) => (a.value || []).map((t) => ({ t, name: a.name })));
    if (!all.length) body.push(h('p.empty-live', preview ? 'Aquí aparecen las respuestas del grupo.' : 'Las respuestas aparecen aquí conforme llegan.'));
    else if (d.mode === 'wall') body.push(h('div.wall', all.slice(-60).reverse().map((a, i) => h('div.note', { class: `c${i % 6}` }, a.t))));
    else {
      const m = new Map();
      all.forEach((a) => { const k = norm(a.t); const e = m.get(k) || { t: a.t.trim(), n: 0 }; e.n++; m.set(k, e); });
      const list = [...m.values()], top = Math.max(...list.map((e) => e.n));
      const ord = shuffled(list.length, item.id + list.length);
      body.push(h('div.cloud', ord.map((i) => { const e = list[i]; return h('span', { class: `w${i % 6}`, style: { fontSize: `${1.1 + 2.6 * (e.n / top) * Math.min(1, 10 / Math.sqrt(list.length * 6))}em`, opacity: 0.55 + 0.45 * (e.n / top) } }, e.t); })));
    }
  }
  if (item.type === 'match') {
    const ps = goodPairs(d), ord = shuffled(ps.length, item.id);
    if (reveal) body.push(solution(item));
    else body.push(h('div.match-show', h('div.col', ps.map((p) => h('div.chip.big', p.a))), h('div.col', ord.map((i) => h('div.chip.big.alt', ps[i].b)))));
  }
  if (item.type === 'fill') {
    const parts = fillParts(d.text);
    body.push(h('p.fill-show', parts.map((p) => (p.blank ? h('span.blank', { class: reveal ? 'done' : '' }, reveal ? p.blank : '') : p.t))));
    if (!reveal) body.push(h('div.chips', bank(d, item.id).map((w) => h('span.chip', w))));
  }
  if (item.type === 'order') {
    const ws = words(d.sentence);
    body.push(reveal ? solution(item) : h('div.chips.big', shuffled(ws.length, item.id).map((i) => h('span.chip.big', ws[i]))));
  }
  if (item.type === 'pairs') {
    const ps = goodPairs(d);
    body.push(reveal ? solution(item) : h('div.deck', [...Array(ps.length * 2)].map((_, i) => h('span.back', { class: `c${i % 6}` }))));
  }
  if (item.type === 'frog') {
    const qs = goodFrog(d);
    body.push(reveal ? solution(item) : h('div.pond-show', h('div.pond-row', qs.map((_, i) => h('span.pad', String(i + 1)))), h('div.pond-start', frog()),
      h('p', qs.length === 1 ? 'Un salto para cruzar' : `${qs.length} saltos para cruzar, tres vidas`)));
  }
  if (item.type === 'soup') {
    const g = makeGrid(soupWords(d), item.id), hit = new Map();
    if (reveal) g.placed.forEach((p, k) => p.idx.forEach((i) => hit.set(i, k)));
    body.push(h('div.soup-show', h('div.soup', { style: { '--n': g.size } }, g.cells.map((c, i) => h('span', { class: hit.has(i) ? `f f${hit.get(i) % 6}` : '' }, c))),
      h('div.soup-words', g.placed.map((p) => h('span.chip', p.w)))));
  }
  if (item.type === 'letters') {
    const ls = letterList(d);
    body.push(h('div.chips.big.tiles-l', (reveal ? ls.map((_, i) => i) : shuffled(ls.length, item.id)).map((i) => h('span.chip.big.letter', { class: reveal ? 'done' : '' }, ls[i]))));
  }
  if (reveal && TYPES[item.type].scored && item.type !== 'quiz') {
    const avg = n ? answers.reduce((s, a) => s + (a.frac || 0), 0) / n : 0, perfect = answers.filter((a) => a.frac >= 1).length;
    body.push(h('div.stats', h('div', h('b', `${Math.round(avg * 100)} %`), h('span', 'de aciertos en promedio')), h('div', h('b', String(perfect)), h('span', perfect === 1 ? 'respuesta perfecta' : 'respuestas perfectas'))));
  }
  return h('div.act', { class: 'act-' + item.type }, q, body);
}

function bank(d, seed) {
  const ws = [...fillParts(d.text).filter((p) => p.blank).map((p) => p.blank), ...String(d.extra || '').split(',').map((s) => s.trim()).filter(Boolean)];
  return shuffled(ws.length, seed).map((i) => ws[i]);
}

/* ------------------------------------------------------ vista del participante */
// ctx: { uid, rec, submit(value, frac) }. Devuelve { el, draft? } donde draft() entrega una respuesta a medio hacer.
export function player(item, ctx) {
  const d = item.data, seed = ctx.uid + item.id;
  const how = (text) => h('p.p-how', icon('tap', 20), h('span', text));
  const sendBtn = (onclick, label = 'Enviar respuesta') => h('button.btn.primary.block.send', { type: 'button', onclick }, label);

  if (item.type === 'quiz' || item.type === 'poll') {
    const opts = (d.options || []).map((o, i) => ({ ...o, i })).filter((o) => o.t?.trim());
    const right = opts.filter((o) => o.ok).map((o) => o.i), multi = item.type === 'quiz' && right.length > 1, picked = new Set();
    const grade = (v) => (item.type === 'poll' ? null : (v.length === right.length && v.every((i) => right.includes(i)) ? 1 : 0));
    const btns = opts.map((o) => h('button.ans', { class: `c${o.i}`, type: 'button', onclick: (e) => {
      if (!multi) return ctx.submit([o.i], grade([o.i]));
      picked.has(o.i) ? picked.delete(o.i) : picked.add(o.i); e.currentTarget.classList.toggle('on', picked.has(o.i)); send.disabled = !picked.size;
    } }, shape(o.i, 26), h('span', o.t)));
    const send = multi && sendBtn(() => ctx.submit([...picked], grade([...picked])));
    if (send) send.disabled = true;
    return { el: h('div.p-act', how(item.type === 'poll' ? 'Tocá la opción que elegís.' : multi ? 'Hay más de una correcta: tocá todas las que correspondan y después «Enviar respuesta».' : 'Tocá la respuesta correcta. Entre más rápido, más puntos.'), h('div.answers', { class: `n${opts.length}` }, btns), send) };
  }

  if (item.type === 'open') {
    const sent = [...(ctx.rec?.value || [])], max = d.max || 1, wall = d.mode === 'wall';
    const input = h(wall ? 'textarea.inp.big' : 'input.inp.big', { maxLength: wall ? 220 : 40, rows: wall ? 4 : null, placeholder: wall ? 'Escribí tu idea' : 'Una palabra o frase corta', enterKeyHint: 'send' });
    const list = h('div.chips');
    const draw = () => {
      put(list, ...sent.map((t) => h('span.chip.sent', icon('check', 14), t)));
      const left = max - sent.length;
      form.hidden = left <= 0; note.textContent = left <= 0 ? 'Listo, ya enviaste todas tus respuestas.' : sent.length ? (left === 1 ? 'Podés enviar una más.' : `Podés enviar ${left} más.`) : '';
    };
    const go = (e) => { e?.preventDefault(); const t = input.value.trim(); if (!t || sent.length >= max) return; sent.push(t); input.value = ''; ctx.submit([...sent], null); draw(); if (sent.length < max) input.focus(); };
    const form = h('form.open-form', { onsubmit: go }, how(wall ? 'Escribí tu idea y tocá «Enviar». Aparece en la pantalla principal.' : 'Escribí una palabra o frase corta y tocá «Enviar». Aparece en la pantalla principal.'), input, h('button.btn.primary.block', { type: 'submit' }, 'Enviar'));
    if (!wall) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e); });
    const note = h('p.p-hint');
    const el = h('div.p-act', form, note, list); draw();
    return { el };
  }

  if (item.type === 'match') {
    const ps = goodPairs(d), ord = shuffled(ps.length, seed);
    const grip = '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg>';
    const arrows = () => { [...right.children].forEach((c, k, all) => { c.querySelector('.m-up').disabled = k === 0; c.querySelector('.m-down').disabled = k === all.length - 1; }); };
    const step = (el, d) => { const o = d < 0 ? el.previousElementSibling : el.nextElementSibling; if (!o) return; right.insertBefore(d < 0 ? el : o, d < 0 ? o : el); touched = true; arrows(); };
    const right = h('div.m-col.m-drag', ord.map((i) => { const el = h('div.m-item', { 'data-key': String(i) }, h('span.grip', { html: grip }), h('span', ps[i].b),
      h('span.m-arrows', h('button.m-up', { type: 'button', 'aria-label': 'Subir', onclick: () => step(el, -1) }, icon('up')), h('button.m-down', { type: 'button', 'aria-label': 'Bajar', onclick: () => step(el, 1) }, icon('dn')))); return el; }));
    let touched = false;
    sortable(right, { onDrop: () => { touched = true; arrows(); } }); arrows();
    const read = () => { const v = [...right.children].map((c) => +c.dataset.key); return { value: v, frac: v.filter((x, i) => x === i).length / ps.length }; };
    return {
      el: h('div.p-act', how('Subí o bajá las tarjetas blancas con las flechas hasta que cada una quede al lado de su pareja. Las oscuras no se mueven.'),
        h('div.m-heads', h('span', 'Concepto'), h('span', 'Su pareja')),
        h('div.m-grid', h('div.m-col', ps.map((p) => h('div.m-item.fixed', h('span', p.a)))), right),
        sendBtn(() => { const r = read(); ctx.submit(r.value, r.frac); })),
      draft: () => (touched ? read() : null),
    };
  }

  if (item.type === 'fill' || item.type === 'order' || item.type === 'letters') {
    const isFill = item.type === 'fill', isL = item.type === 'letters';
    const parts = isFill ? fillParts(d.text) : [];
    const target = isFill ? parts.filter((p) => p.blank).map((p) => p.blank) : isL ? letterList(d) : words(d.sentence);
    const pool = isFill ? bank(d, seed) : shuffled(target.length, seed).map((i) => target[i]);
    const slots = Array(target.length).fill(null); // índice del banco colocado en cada espacio
    const read = () => { const v = slots.map((s) => (s == null ? '' : pool[s])); return { value: v, frac: v.filter((w, i) => norm(w) === norm(target[i])).length / target.length }; };
    const line = h(isFill ? 'p.fill-line' : 'div.order-line'), chips = h('div.chips.bank');
    const send = sendBtn(() => { const r = read(); ctx.submit(r.value, r.frac); });
    const draw = () => {
      const slotBtn = (k) => h('button.slot', { type: 'button', class: slots[k] != null ? 'full' : '', 'aria-label': slots[k] != null ? `Quitar ${pool[slots[k]]}` : 'Espacio vacío', onclick: () => { if (slots[k] == null) return; if (isFill) slots[k] = null; else { slots.splice(k, 1); slots.push(null); } draw(); } }, slots[k] != null ? pool[slots[k]] : '');
      if (isFill) { let k = 0; put(line, ...parts.map((p) => (p.blank ? slotBtn(k++) : p.t))); }
      else { const used = slots.filter((s) => s != null).length; put(line, ...slots.slice(0, used).map((_, k) => slotBtn(k)), !used && h('span.ghost-line', isL ? 'Tocá las letras en orden' : 'Tocá las palabras en orden')); }
      put(chips, ...pool.map((w, i) => h('button.chip.pick', { type: 'button', disabled: slots.includes(i), onclick: () => { const k = slots.indexOf(null); if (k < 0) return; slots[k] = i; draw(); } }, w)));
      send.disabled = slots.includes(null);
    };
    draw();
    if (isL) { line.classList.add('letters'); chips.classList.add('letters'); }
    const tip = isFill ? 'Tocá una palabra para colocarla en el primer espacio vacío. Si te equivocás, tocá el espacio para quitarla.' : isL ? 'Tocá las letras en orden para formar la palabra. Tocá una letra ya colocada para devolverla.' : 'Tocá las palabras en el orden correcto. Tocá una palabra ya colocada para devolverla.';
    return { el: h('div.p-act', how(tip), line, chips, send), draft: () => (slots.some((s) => s != null) ? read() : null) };
  }

  if (item.type === 'pairs') {
    const ps = goodPairs(d);
    if (ctx.rec?.frac >= 1) return { el: h('div.p-act', h('p.p-hint', 'Ya encontraste todas las parejas.')) };
    const cards = ps.flatMap((p, i) => [{ k: i, t: p.a }, { k: i, t: p.b }]), ord = shuffled(cards.length, seed);
    let open = [], found = 0, tries = 0, lock = false;
    const info = h('p.p-hint', `0 de ${ps.length} parejas`);
    const els = ord.map((ci) => {
      const c = cards[ci];
      const el = h('button.card', { type: 'button', onclick: () => {
        if (lock || el.classList.contains('up')) return;
        el.classList.add('up'); open.push({ c, el });
        if (open.length < 2) return;
        tries++; const [x, y] = open; open = [];
        if (x.c.k === y.c.k) {
          found++; x.el.classList.add('hit'); y.el.classList.add('hit'); info.textContent = `${found} de ${ps.length} parejas`;
          ctx.submit({ found, tries }, found / ps.length);
        } else { lock = true; setTimeout(() => { x.el.classList.remove('up'); y.el.classList.remove('up'); lock = false; }, 800); }
      } }, h('span.card-in', h('span.card-back'), h('span.card-face', c.t)));
      return el;
    });
    return { el: h('div.p-act', how('Tocá dos tarjetas para voltearlas. Si forman pareja quedan descubiertas; si no, se vuelven a tapar.'), info, h('div.cards', { class: `n${cards.length}` }, els)) };
  }
  if (item.type === 'frog') {
    const qs = goodFrog(d), n = qs.length;
    if (ctx.rec) return { el: h('div.p-act', h('div.pond.done', frog(), h('h3', `${ctx.rec.value?.ok ?? 0} de ${n} saltos correctos`), h('p', 'Ya completaste este recorrido.'))) };
    let i = 0, ok = 0, lives = 3, lock = false;
    const el = h('div.p-act');
    const finish = () => { if (!ok) ctx.submit({ ok: 0, n }, 0); put(el, h('div.pond.done', frog(), h('h3', ok === n ? '¡La rana cruzó el estanque!' : `${ok} de ${n} saltos correctos`), h('p', lives ? 'Mirá la pantalla principal para ver los resultados.' : 'Se acabaron las vidas.'))); };
    const draw = () => {
      if (i >= n || lives <= 0) return finish();
      const x = qs[i], opts = x.options.map((t, k) => ({ t, k })).filter((o) => o.t?.trim()), ord = shuffled(opts.length, seed + i);
      const me = frog();
      const pads = ord.map((oi) => { const o = opts[oi]; const pad = h('button.pad', { type: 'button', onclick: () => {
        if (lock) return; lock = true;
        if (o.k === x.ok) {
          const a = me.getBoundingClientRect(), b = pad.getBoundingClientRect();
          me.style.setProperty('--dx', `${b.left + b.width / 2 - a.left - a.width / 2}px`); me.style.setProperty('--dy', `${b.top + b.height / 2 - a.top - a.height / 2}px`);
          me.classList.add('hop'); pad.classList.add('good'); ok++; ctx.submit({ ok, n }, ok / n);
        } else { pad.classList.add('sink'); me.classList.add('oops'); lives--; }
        setTimeout(() => { i++; lock = false; draw(); }, 750);
      } }, h('span', o.t)); return pad; });
      put(el, h('div.pond',
        h('div.pond-top', h('span.pond-steps', qs.map((_, k) => h('i', { class: k < i ? 'on' : k === i ? 'now' : '' }))), h('span.pond-lives', { 'aria-label': `${lives} vidas` }, [0, 1, 2].map((k) => h('i', { class: k < lives ? 'on' : '' })))),
        h('p.pond-q', x.q), i === 0 && h('p.pond-tip', 'Tocá la hoja con la respuesta correcta'), h('div.pond-pads', pads), h('div.pond-home', me)));
    };
    draw();
    return { el };
  }

  if (item.type === 'soup') {
    const g = makeGrid(soupWords(d), item.id), n = g.placed.length, found = new Set(ctx.rec?.value?.found || []);
    const cellEls = g.cells.map((c, i) => h('span', { 'data-i': String(i) }, c));
    const grid = h('div.soup.play-soup', { style: { '--n': g.size } }, cellEls), list = h('div.chips'), info = h('p.p-hint');
    const paint = () => {
      cellEls.forEach((c) => { c.className = ''; });
      g.placed.forEach((p, k) => { if (found.has(p.w)) p.idx.forEach((i) => cellEls[i].classList.add('f', `f${k % 6}`)); });
      put(list, g.placed.map((p) => h('span.chip', { class: found.has(p.w) ? 'sent' : '' }, found.has(p.w) && icon('check', 14), p.w)));
      info.textContent = found.size === n ? '¡Encontraste todas!' : 'Deslizá el dedo sobre cada palabra, o tocá su primera y su última letra.';
    };
    const line = (a, b) => {
      const ax = a % g.size, ay = Math.floor(a / g.size), bx = b % g.size, by = Math.floor(b / g.size), dx = bx - ax, dy = by - ay;
      if (dx && dy && Math.abs(dx) !== Math.abs(dy)) return null;
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      return [...Array(len + 1)].map((_, k) => (ay + Math.sign(dy) * k) * g.size + ax + Math.sign(dx) * k);
    };
    const check = (cells) => {
      const key = cells.join(), rev = [...cells].reverse().join();
      const hit = g.placed.find((p) => !found.has(p.w) && (p.idx.join() === key || p.idx.join() === rev));
      if (hit) { found.add(hit.w); ctx.submit({ found: [...found] }, found.size / n); }
      paint();
    };
    const at = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-i]'); return t && grid.contains(t) ? +t.dataset.i : null; };
    let start = null, tap = null, moved = false;
    const mark = (cells) => { cellEls.forEach((c) => c.classList.remove('sel')); (cells || []).forEach((i) => cellEls[i].classList.add('sel')); };
    grid.addEventListener('pointerdown', (e) => { const i = at(e); if (i == null) return; e.preventDefault(); start = i; moved = false; try { grid.setPointerCapture(e.pointerId); } catch { /* */ } if (tap == null) mark([i]); });
    grid.addEventListener('pointermove', (e) => { if (start == null) return; const i = at(e); if (i == null || i === start) return; moved = true; tap = null; mark(line(start, i) || [start]); });
    grid.addEventListener('pointerup', (e) => {
      if (start == null) return; const end = at(e), s0 = start; start = null;
      if (moved && end != null && end !== s0) { const c = line(s0, end); mark(); return c ? check(c) : paint(); }
      if (tap != null && tap !== s0) { const c = line(tap, s0); tap = null; mark(); return c ? check(c) : paint(); }
      tap = s0; mark([s0]);
    });
    grid.addEventListener('pointercancel', () => { start = null; mark(); });
    paint();
    return { el: h('div.p-act', info, grid, list) };
  }
  return { el: h('div') };
}

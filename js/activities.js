// Tipos de actividad: datos iniciales, formulario de edición, vista de pantalla y vista de participante.
import { h, put, icon, shape, shuffled, norm, sortable } from './ui.js';

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
};
export const ACTIVITY_TYPES = Object.keys(TYPES).filter((t) => t !== 'slide');

export const fillParts = (text) => String(text || '').split(/\[([^\]]+)\]/).map((s, i) => (i % 2 ? { blank: s.trim() } : { t: s })).filter((p) => p.blank || p.t);
export const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const goodPairs = (d) => (d.pairs || []).filter((p) => p.a?.trim() && p.b?.trim());
const goodOpts = (d) => (d.options || []).filter((o) => o.t?.trim());

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

  if (item.type !== 'slide') out.push(field(item.type === 'quiz' || item.type === 'poll' || item.type === 'open' ? 'Pregunta' : 'Indicación', inp(d, 'q', 'Escribí aquí lo que verá el grupo', true)));

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
    return { el: h('div.p-act', multi && h('p.p-hint', 'Hay más de una correcta. Marcá todas y enviá.'), h('div.answers', { class: `n${opts.length}` }, btns), send) };
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
    const form = h('form.open-form', { onsubmit: go }, input, h('button.btn.primary.block', { type: 'submit' }, 'Enviar'));
    if (!wall) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e); });
    const note = h('p.p-hint');
    const el = h('div.p-act', form, note, list); draw();
    return { el };
  }

  if (item.type === 'match') {
    const ps = goodPairs(d), ord = shuffled(ps.length, seed);
    const right = h('div.m-col.m-drag', ord.map((i) => h('div.m-item', { 'data-key': String(i) }, h('span.grip', { html: '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg>' }), h('span', ps[i].b))));
    let touched = false;
    sortable(right, { onDrop: () => { touched = true; } });
    const read = () => { const v = [...right.children].map((c) => +c.dataset.key); return { value: v, frac: v.filter((x, i) => x === i).length / ps.length }; };
    return {
      el: h('div.p-act', h('p.p-hint', 'Arrastrá las tarjetas de la derecha hasta dejarlas frente a su pareja.'),
        h('div.m-grid', h('div.m-col', ps.map((p) => h('div.m-item.fixed', h('span', p.a)))), right),
        sendBtn(() => { const r = read(); ctx.submit(r.value, r.frac); })),
      draft: () => (touched ? read() : null),
    };
  }

  if (item.type === 'fill' || item.type === 'order') {
    const isFill = item.type === 'fill';
    const parts = isFill ? fillParts(d.text) : [];
    const target = isFill ? parts.filter((p) => p.blank).map((p) => p.blank) : words(d.sentence);
    const pool = isFill ? bank(d, seed) : shuffled(target.length, seed).map((i) => target[i]);
    const slots = Array(target.length).fill(null); // índice del banco colocado en cada espacio
    const read = () => { const v = slots.map((s) => (s == null ? '' : pool[s])); return { value: v, frac: v.filter((w, i) => norm(w) === norm(target[i])).length / target.length }; };
    const line = h(isFill ? 'p.fill-line' : 'div.order-line'), chips = h('div.chips.bank');
    const send = sendBtn(() => { const r = read(); ctx.submit(r.value, r.frac); });
    const draw = () => {
      const slotBtn = (k) => h('button.slot', { type: 'button', class: slots[k] != null ? 'full' : '', 'aria-label': slots[k] != null ? `Quitar ${pool[slots[k]]}` : 'Espacio vacío', onclick: () => { if (slots[k] == null) return; if (isFill) slots[k] = null; else { slots.splice(k, 1); slots.push(null); } draw(); } }, slots[k] != null ? pool[slots[k]] : '');
      if (isFill) { let k = 0; put(line, ...parts.map((p) => (p.blank ? slotBtn(k++) : p.t))); }
      else { const used = slots.filter((s) => s != null).length; put(line, ...slots.slice(0, used).map((_, k) => slotBtn(k)), !used && h('span.ghost-line', 'Tocá las palabras en orden')); }
      put(chips, ...pool.map((w, i) => h('button.chip.pick', { type: 'button', disabled: slots.includes(i), onclick: () => { const k = slots.indexOf(null); if (k < 0) return; slots[k] = i; draw(); } }, w)));
      send.disabled = slots.includes(null);
    };
    draw();
    return { el: h('div.p-act', line, chips, send), draft: () => (slots.some((s) => s != null) ? read() : null) };
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
    return { el: h('div.p-act', info, h('div.cards', { class: `n${cards.length}` }, els)) };
  }
  return { el: h('div') };
}

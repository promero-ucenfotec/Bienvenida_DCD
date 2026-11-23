// Utilidades de interfaz: creación de nodos, iconos, avisos y arrastre.
export function h(spec, props, ...kids) {
  const [tag, ...cls] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const p in v) p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]); }
    else if (k === 'value') el.value = v;
    else if (k === 'class') el.className += ' ' + v;
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

const P = {
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  play: 'M7 4.5v15l12-7.5z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  back: 'M19 12H5M11 6l-6 6 6 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 17v3h16v-3',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.8M15.5 3.2a3.5 3.5 0 0 1 0 6.6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  out: 'M15 4h4v16h-4M10 8l4 4-4 4M14 12H4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  stop: 'M6 6h12v12H6z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.2 4.2 0 0 1-.5 8.5z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  text: 'M5 6h14M5 12h9M5 18h14M17 12h2',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  cards: 'M4 6h9v13H4zM13 8l6-1.5 2.5 11L15 19',
  quiz: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM14 16.5l2 2 4-4',
  bars: 'M4 20h16M7 20v-6M12 20V7M17 20v-9',
};
export function icon(name, size = 20) {
  const filled = name === 'play' || name === 'stop';
  return h('span.ic', { 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name]}"/></svg>` });
}

// Figuras de las opciones: cada color lleva su forma para no depender solo del color.
const SHAPES = [
  '<path d="M12 3.5 21.5 20h-19z"/>',
  '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
  '<circle cx="12" cy="12" r="9"/>',
  '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  '<path d="M7 3.5h10l5 8.5-5 8.5H7L2 12z"/>',
];
export const shape = (i, size = 22) => h('span.shape', { 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">${SHAPES[i % 6]}</svg>` });

let toastBox;
export function toast(msg, kind = '') {
  toastBox ??= document.body.appendChild(h('div.toasts', { role: 'status', 'aria-live': 'polite' }));
  const t = h('div.toast', { class: kind }, msg);
  toastBox.append(t);
  setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 300); }, kind === 'err' ? 5000 : 2600);
  return t;
}

export function confirmBox(title, body, okLabel = 'Eliminar') {
  return new Promise((res) => {
    const close = (v) => { dlg.close(); dlg.remove(); res(v); };
    const dlg = h('dialog.dialog', { oncancel: () => close(false) },
      h('h3', title), h('p', body),
      h('div.row.end', h('button.btn.ghost', { onclick: () => close(false) }, 'Cancelar'), h('button.btn.danger', { onclick: () => close(true) }, okLabel)));
    document.body.append(dlg); dlg.showModal();
  });
}

// Barajado estable: la misma semilla da siempre el mismo orden.
export function seeded(seed) {
  let a = 2166136261;
  for (const c of String(seed)) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(n, seed) {
  const r = seeded(seed), idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

// Lista reordenable con mouse o dedo. onDrop recibe el orden final de los data-key.
export function sortable(list, { handle, onDrop } = {}) {
  list.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('[data-key]');
    if (!item || item.parentNode !== list || e.button > 0) return;
    if (handle && !e.target.closest(handle)) return;
    if (!handle && e.target.closest('button,input,textarea,select')) return;
    const sx = e.clientX, sy = e.clientY;
    let moving = false, ox = 0, oy = 0;
    const place = (ev) => {
      item.style.transform = '';
      const r = item.getBoundingClientRect();
      item.style.transform = `translate(${ev.clientX - ox - r.left}px,${ev.clientY - oy - r.top}px)`;
    };
    const move = (ev) => {
      if (!moving) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        moving = true; const r = item.getBoundingClientRect(); ox = sx - r.left; oy = sy - r.top;
        item.classList.add('dragging'); list.classList.add('sorting');
        try { item.setPointerCapture(e.pointerId); } catch { /* */ }
      }
      ev.preventDefault();
      item.style.pointerEvents = 'none';
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-key]');
      item.style.pointerEvents = '';
      if (over && over !== item && over.parentNode === list) {
        const kids = [...list.children];
        list.insertBefore(item, kids.indexOf(over) > kids.indexOf(item) ? over.nextSibling : over);
      }
      place(ev);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!moving) return;
      item.classList.remove('dragging'); list.classList.remove('sorting'); item.style.transform = '';
      const kill = (c) => { c.stopPropagation(); c.preventDefault(); };
      item.addEventListener('click', kill, true);
      setTimeout(() => item.removeEventListener('click', kill, true), 60);
      onDrop?.([...list.children].filter((c) => c.dataset.key).map((c) => c.dataset.key));
    };
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
}

export const fmt = (n) => Math.round(n).toLocaleString('es-CR').replace(/,/g, ' ');
export const norm = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Reemplaza el contenido de un nodo ignorando valores vacíos.
export function put(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter((c) => c != null && c !== false)); return el; }
Object.assign(P, {
  down: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  letters: 'M3 18l4-12 4 12M4.5 14h5M14 10h6l-6 8h6',
  frog: 'M4 13c0-2.5 1.2-4 2.5-4.6M20 13c0-2.5-1.2-4-2.5-4.6M4 13c0 4 3.5 6 8 6s8-2 8-6M6 9a2.5 2.5 0 1 1 5 0M13 9a2.5 2.5 0 1 1 5 0M9 14.5c2 1 4 1 6 0',
  live: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4M7.5 16.5a6.4 6.4 0 0 1 0-9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 19.4a10.5 10.5 0 0 1 0-14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8',
});

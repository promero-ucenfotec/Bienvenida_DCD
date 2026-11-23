// Portada para participantes, ingreso de administradores y biblioteca de presentaciones.
import { store, DEMO, KEEP_DAYS, box, uuid } from './store.js';
import { EMAIL_DOMAIN } from './config.js';
import { downloadResults } from './report.js';
import { h, put, icon, toast, confirmBox, askText, shape } from './ui.js';

const brand = (cls = '') => h('a.brand', { href: '#/', class: cls }, h('span.brand-mark'), 'Pulso');

export function home(root, preset = '') {
  const code = h('input.inp.code-in', { inputMode: 'numeric', autocomplete: 'off', maxLength: 7, placeholder: '000 000', value: preset ? preset.slice(0, 3) + ' ' + preset.slice(3) : '', 'aria-label': 'Código de la sala',
    oninput: (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; } });
  const name = h('input.inp.big', { autocomplete: 'name', maxLength: 60, placeholder: 'Nombre y apellido', value: box.getItem('pulso.name') || '', 'aria-label': 'Tu nombre completo' });
  const email = h('input.inp.big', { type: 'email', inputMode: 'email', autocomplete: 'email', autocapitalize: 'off', maxLength: 120, placeholder: 'usuario@' + EMAIL_DOMAIN, value: box.getItem('pulso.email') || '', 'aria-label': 'Tu correo institucional' });
  const err = h('p.form-err', { role: 'alert' });
  const btn = h('button.btn.primary.block.big', { type: 'submit' }, 'Entrar a la sala');
  const form = h('form.join-form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    const c = code.value.replace(/\D/g, ''), n = name.value.trim().replace(/\s+/g, ' ');
    if (c.length !== 6) { err.textContent = 'El código tiene seis dígitos.'; return code.focus(); }
    if (n.length < 3 || !n.includes(' ')) { err.textContent = 'Escribí tu nombre y apellido.'; return name.focus(); }
    const m = email.value.trim().toLowerCase();
    if (!new RegExp('^[a-z0-9._%+-]+@' + EMAIL_DOMAIN.replace(/\./g, '\\.') + '$').test(m)) { err.textContent = `Usá tu correo institucional, el que termina en @${EMAIL_DOMAIN}.`; return email.focus(); }
    btn.disabled = true;
    try {
      const s = await store.getSession(c);
      if (!s) throw new Error('No hay ninguna sala con ese código.');
      if (s.ended) throw new Error('Esa sesión ya terminó.');
      await store.join(c, n, m);
      box.setItem('pulso.name', n); box.setItem('pulso.email', m); box.setItem('pulso.in', c); location.hash = '#/play/' + c;
    } catch (x) { err.textContent = x.message?.includes('sala') || x.message?.includes('sesión') ? x.message : 'No se pudo entrar. Revisá tu conexión.'; btn.disabled = false; }
  } },
    h('h1', 'Entrá a la sala'),
    h('label.field', h('span.lbl', 'Código'), code),
    h('label.field', h('span.lbl', 'Nombre completo'), name),
    h('label.field', h('span.lbl', 'Correo institucional'), email),
    err, btn);
  root.append(h('main.home',
    h('section.home-art', { 'aria-hidden': 'true' }, brand('light'),
      h('div.art-tiles', [0, 1, 2, 3].map((i) => h('span.art-tile', { class: 'c' + i }, shape(i, 56)))),
      h('p.art-line', 'Presentaciones que el grupo responde en vivo.')),
    h('section.home-form', form, h('a.admin-link', { href: '#/admin' }, 'Soy quien presenta'))));
  (preset ? name : code).focus();
}

export function login(root, done) {
  const email = h('input.inp', { type: 'email', autocomplete: 'username', placeholder: 'correo@ucenfotec.ac.cr', required: true });
  const pass = h('input.inp', { type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña', required: true });
  const err = h('p.form-err', { role: 'alert' });
  root.append(h('main.center-page', h('form.card.narrow', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await store.signIn(email.value.trim(), pass.value); done(); } catch (x) { err.textContent = x.message; }
  } }, brand(), h('h2', 'Ingreso de administradores'),
    DEMO && h('p.demo-note', 'Modo demostración: usá cualquier correo y la contraseña ', h('b', 'demo'), '.'),
    h('label.field', h('span.lbl', 'Correo'), email), h('label.field', h('span.lbl', 'Contraseña'), pass), err,
    h('button.btn.primary.block', { type: 'submit' }, 'Ingresar'), h('a.admin-link', { href: '#/' }, 'Vengo a participar'))));
  email.focus();
}

export async function library(root) {
  const area = h('div.lib-area'), live = h('section.lib-live');
  const fail = (msg) => () => toast(msg, 'err');
  const newPres = async (projectId = null) => { try { const p = await store.createPresentation('Presentación sin título', projectId); location.hash = '#/edit/' + p.id; } catch { toast('No se pudo crear la presentación.', 'err'); } };
  root.append(h('div.library',
    h('header.lib-top', brand(), h('span.grow'), h('span.muted.lib-user', store.admin), h('button.btn.ghost', { onclick: async () => { await store.signOut(); location.hash = '#/'; } }, icon('out', 18), 'Salir')),
    h('main.lib-main',
      DEMO && h('p.demo-note.wide', h('b', 'Modo demostración. '), 'Todo se guarda solo en este navegador y las salas funcionan entre pestañas. Para conectar al grupo desde sus dispositivos, completá los datos de Supabase en js/config.js.'),
      live,
      h('div.lib-head', h('h1', 'Presentaciones'),
        h('div.row', h('button.btn.ghost', { onclick: async () => { const name = await askText('Nuevo proyecto', 'Nombre del proyecto', '', 'Crear proyecto'); if (name) { await store.createProject(name).catch(fail('No se pudo crear el proyecto.')); load(); } } }, icon('folder', 18), 'Nuevo proyecto'),
          h('button.btn.primary', { onclick: () => newPres() }, icon('plus', 18), 'Nueva presentación'))),
      area)));

  async function open(p) {
    try { const code = await store.createSession(p.id, p.title, { phase: 'lobby', itemId: null, rev: 0 }); location.hash = '#/host/' + code; } catch { toast('No se pudo abrir la sala.', 'err'); }
  }
  async function copyPres(p, projectId, title) {
    const np = await store.createPresentation(title, projectId), items = await store.getItems(p.id);
    await Promise.all(items.map((it) => store.saveItem({ ...it, id: uuid(), presentation_id: np.id })));
  }
  const busy = async (msg, fn, done) => { const n = toast(msg); n.classList.add('sticky'); try { await fn(); toast(done, 'ok'); } catch (e) { console.error(e); toast('No se pudo completar la copia.', 'err'); } n.remove(); load(); };

  const card = (p, projects) => h('article.lib-card',
    h('a.lib-cover', { href: '#/edit/' + p.id, 'aria-label': `Editar ${p.title}` }, p.cover ? h('img', { src: p.cover, alt: '' }) : h('span.lib-blank', [0, 1, 2].map((i) => h('i', { class: 'c' + i })))),
    h('div.lib-info', h('h3', p.title), h('p.muted', p.count === 1 ? '1 elemento' : `${p.count} elementos`)),
    h('div.lib-actions',
      h('a.btn.soft.small', { href: '#/edit/' + p.id }, 'Editar'),
      h('button.btn.primary.small', { disabled: !p.count, onclick: () => open(p) }, icon('play', 12), 'Presentar'),
      h('span.grow'),
      h('button.icon-btn', { title: 'Duplicar presentación', onclick: () => busy('Duplicando presentación…', () => copyPres(p, p.project_id || null, `${p.title} (copia)`), 'Presentación duplicada') }, icon('copy', 18)),
      h('button.icon-btn', { title: 'Eliminar presentación', onclick: async () => { if (await confirmBox(`¿Eliminar «${p.title}»?`, 'Se borran sus diapositivas y actividades. No se puede deshacer.')) { await store.deletePresentation(p.id).catch(fail('No se pudo eliminar.')); load(); } } }, icon('trash', 18))),
    projects.length > 0 && h('select.lib-move', { 'aria-label': 'Mover a otro proyecto', onchange: async (e) => { const v = e.target.value; if (!v) return; await store.updatePresentation(p.id, { project_id: v === '-' ? null : v }).catch(fail('No se pudo mover.')); load(); } },
      h('option', { value: '' }, 'Mover a…'), projects.filter((x) => x.id !== p.project_id).map((x) => h('option', { value: x.id }, x.name)), p.project_id && h('option', { value: '-' }, 'Sin proyecto')));

  async function load() {
    await store.purgeOld().catch(() => {});
    const left = (s) => { const d = Math.ceil(KEEP_DAYS - (Date.now() - new Date(s.created_at)) / 864e5); return d <= 1 ? 'Se borra hoy' : `Se borra en ${d} días`; };
    const [list, sessions, projects] = await Promise.all([store.listPresentations(), store.listSessions(), store.listProjects()]);
    live.hidden = !sessions.length;
    put(live, h('h2', 'Salas y registros'), h('p.live-note', `Los datos de participación se borran solos a los ${KEEP_DAYS} días de abierta la sala. Descargá el Excel antes si necesitás conservarlos; las presentaciones no se tocan.`), h('div.live-list', sessions.map((s) => h('div.live-row', { class: s.ended ? 'closed' : '' },
      h('span.live-dot'), h('b.live-code', s.code.slice(0, 3) + ' ' + s.code.slice(3)), h('span.live-title', s.title || 'Sin título'),
      h('span.live-date', left(s)),
      !s.ended && h('a.btn.soft.small', { href: '#/host/' + s.code }, 'Entrar a presentar'),
      h('button.btn.ghost.small', { onclick: () => downloadResults(s.code) }, icon('down', 16), 'Descargar resultados'),
      !s.ended && h('button.btn.ghost.small', { onclick: async () => { await store.endSession(s.code).catch(() => {}); load(); } }, 'Cerrar sala')))));

    const known = new Set(projects.map((x) => x.id)), loose = list.filter((p) => !known.has(p.project_id));
    const grid = (items, empty) => h('div.lib-grid', items.length ? items.map((p) => card(p, projects)) : h('p.proj-empty', empty));
    const sections = projects.map((pr) => {
      const mine = list.filter((p) => p.project_id === pr.id);
      return h('section.proj',
        h('header.proj-head', h('span.proj-ic', icon('folder', 20)), h('h2', pr.name), h('span.muted', mine.length === 1 ? '1 presentación' : `${mine.length} presentaciones`), h('span.grow'),
          h('button.btn.soft.small', { onclick: () => newPres(pr.id) }, icon('plus', 16), 'Nueva presentación'),
          h('button.icon-btn', { title: 'Cambiar el nombre', onclick: async () => { const name = await askText('Nombre del proyecto', 'Nombre', pr.name); if (name && name !== pr.name) { await store.renameProject(pr.id, name).catch(fail('No se pudo cambiar el nombre.')); load(); } } }, icon('edit', 18)),
          h('button.icon-btn', { title: 'Duplicar proyecto', onclick: async () => {
            const name = await askText('Duplicar proyecto', 'Nombre de la copia', `${pr.name} (copia)`, 'Duplicar'); if (!name) return;
            busy('Duplicando proyecto…', async () => { const np = await store.createProject(name); for (const p of mine) await copyPres(p, np.id, p.title); }, 'Proyecto duplicado');
          } }, icon('copy', 18)),
          h('button.icon-btn', { title: 'Eliminar proyecto', onclick: async () => { if (await confirmBox(`¿Eliminar el proyecto «${pr.name}»?`, mine.length ? 'Sus presentaciones no se borran: quedan en «Sin proyecto».' : 'El proyecto está vacío.')) { await store.deleteProject(pr.id).catch(fail('No se pudo eliminar.')); load(); } } }, icon('trash', 18))),
        grid(mine, 'Este proyecto todavía no tiene presentaciones.'));
    });
    if (!projects.length && !list.length) return put(area, h('div.lib-empty', h('h2', 'Todavía no hay presentaciones'), h('p', 'Creá un proyecto para agrupar las presentaciones de un mismo evento, o empezá directamente con una presentación.')));
    put(area, sections, loose.length > 0 && h('section.proj', projects.length > 0 && h('header.proj-head', h('h2', 'Sin proyecto'), h('span.muted', loose.length === 1 ? '1 presentación' : `${loose.length} presentaciones`)), grid(loose, '')));
  }
  await load().catch(() => toast('No se pudo cargar la biblioteca.', 'err'));
}

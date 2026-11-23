import { store } from './store.js';
import { home, login, library } from './admin.js';

const app = document.getElementById('app');
let cleanup = null, turn = 0;

async function route() {
  const mine = ++turn;
  try { cleanup?.(); } catch { /* */ }
  cleanup = null; app.replaceChildren();
  try { await store.ready; } catch { app.textContent = 'No se pudo conectar con el servicio. Recargá la página.'; return; }
  if (mine !== turn) return;
  const [, a = '', b = ''] = location.hash.split('/');
  document.body.dataset.view = a || 'home';
  let fn;
  if (!a) fn = () => home(app);
  else if (/^\d{6}$/.test(a)) fn = () => home(app, a);
  else if (a === 'play') fn = async () => (await import('./play.js')).play(app, b);
  else if (['admin', 'edit', 'host'].includes(a)) {
    if (!store.admin) fn = () => login(app, route);
    else if (a === 'admin') fn = () => library(app);
    else if (a === 'edit') fn = async () => (await import('./editor.js')).editor(app, b);
    else fn = async () => (await import('./host.js')).host(app, b);
  } else fn = () => home(app);
  const c = await fn();
  if (mine === turn) cleanup = c || null; else c?.();
}
window.addEventListener('hashchange', route);
route();

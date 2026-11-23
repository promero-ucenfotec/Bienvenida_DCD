// Registro de resultados de una sala, descargable en Excel.
import { store } from './store.js';
import { toast } from './ui.js';
import { TYPES, problem, titleOf } from './activities.js';

const loadXlsx = () => window.XLSX ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.mini.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });

export async function summary(code) {
  const session = await store.getSession(code);
  const items = (await store.getItems(session.presentation_id, true)).filter((i) => !problem(i));
  const [players, answers] = await Promise.all([store.getPlayers(code), store.getAnswers(code)]);
  const acts = items.filter((i) => i.type !== 'slide'), scored = acts.filter((i) => TYPES[i.type].scored);
  const ids = new Set(items.map((i) => i.id)), by = new Map();
  answers.forEach((a) => { if (!by.has(a.uid)) by.set(a.uid, {}); by.get(a.uid)[a.item_id] = a; });
  const rows = players.map((p) => {
    const mine = by.get(p.uid) || {};
    const seen = new Set([...(p.seen || []), ...Object.keys(mine)].filter((id) => ids.has(id)));
    return {
      p, mine,
      pts: Object.values(mine).reduce((s, a) => s + (a.pts || 0), 0),
      grade: scored.length ? Math.round(100 * scored.reduce((s, i) => s + (mine[i.id]?.frac || 0), 0) / scored.length) : null,
      answered: acts.filter((i) => mine[i.id]).length,
      progress: items.length ? Math.round(100 * seen.size / items.length) : 0,
    };
  }).sort((a, b) => b.pts - a.pts || a.p.name.localeCompare(b.p.name));
  return { session, items, acts, rows };
}

export async function downloadResults(code) {
  const note = toast('Preparando el archivo…');
  try {
    const [{ session, acts, rows }] = await Promise.all([summary(code), loadXlsx()]);
    const X = window.XLSX;
    const main = [['Lugar', 'Nombre', 'Correo', 'Puntos', 'Nota (0 a 100)', 'Actividades respondidas', 'Total de actividades', 'Avance en la presentación (%)'],
      ...rows.map((r, i) => [i + 1, r.p.name, r.p.email || '', r.pts, r.grade ?? '', r.answered, acts.length, r.progress])];
    const detail = [['Nombre', 'Correo', ...acts.map((a, i) => `${i + 1}. ${titleOf(a)} (${TYPES[a.type].label})`)],
      ...rows.map((r) => [r.p.name, r.p.email || '', ...acts.map((a) => { const m = r.mine[a.id]; return !m ? '' : TYPES[a.type].scored ? m.pts : Array.isArray(m.value) && a.type === 'open' ? m.value.join(' | ') : 'Participó'; })])];
    const wb = X.utils.book_new();
    const s1 = X.utils.aoa_to_sheet(main); s1['!cols'] = [{ wch: 7 }, { wch: 32 }, { wch: 34 }, { wch: 9 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }];
    const s2 = X.utils.aoa_to_sheet(detail); s2['!cols'] = [{ wch: 32 }, { wch: 34 }, ...acts.map(() => ({ wch: 26 }))];
    X.utils.book_append_sheet(wb, s1, 'Resultados'); X.utils.book_append_sheet(wb, s2, 'Detalle por actividad');
    const day = new Date(session.created_at).toISOString().slice(0, 10);
    X.writeFile(wb, `TeachDeck ${(session.title || 'sesión').replace(/[\\/:*?"<>|]/g, '').slice(0, 60)} ${day}.xlsx`);
    toast(rows.length === 1 ? 'Se descargó el registro de 1 participante' : `Se descargó el registro de ${rows.length} participantes`, 'ok');
  } catch (e) { console.error(e); toast('No se pudo generar el archivo.', 'err'); }
  note.remove();
}

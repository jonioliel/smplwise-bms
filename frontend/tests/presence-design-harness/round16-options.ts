// ROUND4-LEFTOVERS-2390 (owner design round 16, NOT a shipped design): three compact directions for the home card "נוכחות במבנה", drawn
// INSIDE the real home band of this harness (the real clock and alarm cards, the real card shell, header and tokens of every skin and
// scheme) so the owner judges them beside their neighbours. `pdOption16(option)` runs after `pdMountHome`: it hides the shipped card's
// body (option "current" leaves it as it is) and draws the option from the same snapshot. Invented data only; nothing here is imported
// by the app. The capture spec is tests/evidence-presence-round16.spec.ts; the page for the owner is
// private/design-system-2026-10-27/round16-presence/.
import type { BuildingSnapshot } from '../../src/api/building-presence';

type Opt = 'current' | 'a' | 'b' | 'c';
type Room = Omit<NonNullable<BuildingSnapshot['rooms']>[number], 'name'> & { name: string };

const CSS = `
  .o16 { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
  .o16 .lamp { inline-size: 8px; block-size: 8px; border-radius: 50%; flex: none; background: var(--sw-unknown); }
  .o16[data-tone='ok'] .lamp { background: var(--sw-success); box-shadow: 0 0 0 3px var(--sw-success-soft); }
  .o16[data-tone='unknown'] .lamp { background: transparent; box-shadow: inset 0 0 0 1.5px var(--sw-unknown); }
  .o16 bdi { unicode-bidi: isolate; }
  .o16 .ell { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* A - the count in the clock's voice, the active names as one line of text, a hairline rail with one tick a room */
  .o16a .row { display: flex; align-items: center; gap: 14px; min-inline-size: 0; }
  .o16a .n { display: flex; align-items: baseline; flex: none; direction: ltr; unicode-bidi: isolate; line-height: 0.9; }
  .o16a .n b { font-size: var(--o16-n, 44px); font-weight: var(--sw-fw-medium); letter-spacing: -0.04em; color: var(--sw-heading); }
  .o16a[data-tone='clear'] .n b, .o16a[data-tone='unknown'] .n b { color: var(--sw-text-3); font-weight: 300; }
  .o16a .n span { font-size: var(--sw-fs-lg); font-weight: 300; color: var(--sw-text-3); margin-inline-start: 3px; }
  .o16a .t { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; gap: 3px; }
  .o16a .w { display: flex; align-items: center; gap: 7px; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); white-space: nowrap; }
  .o16a .names { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .o16 .names i { font-style: normal; color: var(--sw-text-3); padding-inline: 5px; }
  .o16a .rail { display: flex; gap: 3px; block-size: 4px; min-inline-size: 0; }
  .o16a .rail i { flex: 1; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
  .o16a .rail i.on { background: var(--sw-success); }
  .o16a .rail i.unk { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
  .o16a .rail.agg { display: block; background: var(--sw-surface-3); border-radius: var(--sw-r-pill); overflow: hidden; }
  .o16a .rail.agg b { display: block; block-size: 100%; inline-size: var(--p); background: var(--sw-success); border-radius: var(--sw-r-pill); }
  .o16a .fl { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  .o16a .fl b { font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); }

  /* B - the building as a small lattice: a line a floor, a cell a room, the active names of that floor after the cells */
  .o16b .top { display: flex; align-items: center; gap: 8px; min-inline-size: 0; font-size: var(--sw-fs-md); color: var(--sw-text-2); }
  .o16b .top b { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.015em; color: var(--sw-heading); }
  .o16b .fls { display: grid; gap: 5px; min-inline-size: 0; }
  .o16b .f { display: grid; grid-template-columns: 56px auto minmax(0, 1fr); align-items: center; gap: 10px; min-inline-size: 0; font-size: var(--sw-fs-xs); }
  .o16b .fn { color: var(--sw-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .o16b .cells { display: flex; gap: 3px; direction: ltr; }
  .o16b .cells i { inline-size: 10px; block-size: 10px; border-radius: 3px; background: var(--sw-surface-3); }
  .o16b .cells i.on { background: var(--sw-success); }
  .o16b .cells i.unk { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
  .o16b .cells em { font-style: normal; color: var(--sw-text-3); font-size: var(--sw-fs-2xs); margin-inline-start: 3px; direction: ltr; }
  .o16b .who { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .o16b .more { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }

  /* C - no card of its own: one quiet line at the foot of the alarm card (the building's state, where the alarm already is; the alarm
     card's body is centred with room under it, so the row keeps its height) */
  .o16c { display: flex; align-items: center; gap: 8px; min-inline-size: 0; margin-block-start: 2px; padding-block-start: 8px; border-block-start: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .o16c b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); white-space: nowrap; }
  .o16c[data-tone='ok'] b { color: var(--sw-success-text); }
  .o16c a { margin-inline-start: auto; flex: none; color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); text-decoration: none; font-size: var(--sw-fs-xs); }
`;

const hmFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' });
const hm = (iso: string | null | undefined) => (iso ? hmFmt.format(new Date(iso)) : '');

function el(tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k) e.append(k);
  return e;
}
const bdi = (t: string) => el('bdi', {}, t);

interface View { rooms: Room[]; active: Room[]; tone: 'ok' | 'clear' | 'unknown'; last: Room | null; total: number; floors: { name: string; rooms: Room[] }[] }

function view(snap: BuildingSnapshot): View {
  const rooms: Room[] = (snap.rooms ?? []).map((r) => ({ ...r, name: r.name ?? 'חדר' }));
  const active = rooms.filter((r) => r.status === 'occupied');
  const tone = snap.status === 'unknown' ? 'unknown' : active.length ? 'ok' : 'clear';
  const cleared = rooms.filter((r) => r.status === 'clear' && r.empty_since).sort((a, b) => String(b.empty_since).localeCompare(String(a.empty_since)));
  const fmap = new Map<string, Room[]>();
  for (const r of rooms) {
    const k = r.floor ?? 'המבנה';
    fmap.set(k, [...(fmap.get(k) ?? []), r]);
  }
  return { rooms, active, tone, last: cleared[0] ?? null, total: rooms.length, floors: [...fmap].map(([name, rs]) => ({ name, rooms: rs })) };
}

const NUM = new Intl.NumberFormat('he-IL');
const names = (rs: Room[], cap: number) => {
  const box = el('div', { class: 'names ell' });
  rs.slice(0, cap).forEach((r, i) => {
    if (i) box.append(el('i', { 'aria-hidden': 'true' }, '·'));
    box.append(bdi(r.name));
  });
  if (rs.length > cap) box.append(el('i', {}, ''), `+${NUM.format(rs.length - cap)}`);
  return box;
};

function optionA(v: View, size: string): HTMLElement {
  const root = el('div', { class: 'o16 o16a', 'data-tone': v.tone, 'data-o16': 'a', style: `--o16-n:${size === 's' ? 36 : size === 'l' ? 52 : 44}px` });
  const n = el('div', { class: 'n' }, el('b', {}, v.tone === 'unknown' ? '–' : NUM.format(v.active.length)), el('span', {}, `/${NUM.format(v.total)}`));
  const word = v.tone === 'ok' ? (v.active.length === 1 ? 'חדר פעיל' : 'חדרים פעילים') : v.tone === 'clear' ? 'המבנה ריק' : 'אין מידע מהחיישנים';
  const sub = v.tone === 'ok'
    ? names(v.active, 8)
    : v.tone === 'clear' && v.last
      ? el('div', { class: 'names ell' }, bdi(v.last.name), el('i', {}, '·'), `ריק מ־${hm(v.last.empty_since)}`)
      : el('div', { class: 'names ell' }, 'החדרים יופיעו כשהחיישנים ידווחו');
  root.append(el('div', { class: 'row', title: v.active.map((r) => r.name).join(', ') }, n, el('div', { class: 't' }, el('div', { class: 'w' }, el('span', { class: 'lamp', 'aria-hidden': 'true' }), word), size === 's' && v.tone !== 'ok' ? null : sub)));
  if (size !== 's') {
    let rail: HTMLElement;
    if (v.total > 40) {
      rail = el('div', { class: 'rail agg', 'aria-hidden': 'true', style: `--p:${v.total ? Math.round((v.active.length / v.total) * 100) : 0}%` }, el('b'));
    } else {
      rail = el('div', { class: 'rail', 'aria-hidden': 'true' });
      const order = [...v.active, ...v.rooms.filter((r) => r.status === 'unknown'), ...v.rooms.filter((r) => r.status === 'clear')];
      for (const r of order) rail.append(el('i', { class: r.status === 'occupied' ? 'on' : r.status === 'unknown' ? 'unk' : '', title: r.name }));
    }
    root.append(rail);
  }
  if (size === 'l') {
    const fl = el('div', { class: 'fl ell' });
    v.floors.slice(0, 5).forEach((f, i) => {
      if (i) fl.append('  ·  ');
      fl.append(bdi(f.name), ' ', el('b', {}, `${NUM.format(f.rooms.filter((r) => r.status === 'occupied').length)}/${NUM.format(f.rooms.length)}`));
    });
    if (v.floors.length > 5) fl.append(`  ·  +${NUM.format(v.floors.length - 5)} קומות`);
    root.append(fl);
  }
  return root;
}

function optionB(v: View, size: string): HTMLElement {
  const root = el('div', { class: 'o16 o16b', 'data-tone': v.tone, 'data-o16': 'b' });
  const top = el('div', { class: 'top' }, el('span', { class: 'lamp', 'aria-hidden': 'true' }));
  if (v.tone === 'ok') top.append(el('b', {}, NUM.format(v.active.length)), el('span', { class: 'ell' }, `${v.active.length === 1 ? 'חדר פעיל' : 'חדרים פעילים'} מתוך ${NUM.format(v.total)}`));
  else if (v.tone === 'clear') top.append(el('b', {}, 'ריק'), el('span', { class: 'ell' }, ...(v.last ? [bdi(v.last.name), ` התרוקן ב־${hm(v.last.empty_since)}`] : [])));
  else top.append(el('b', {}, 'אין מידע'), el('span', { class: 'ell' }, 'החיישנים לא דיווחו'));
  root.append(top);
  // the phone's stack gives the card the alarm card's height: two floor lines there
  const cap = size === 's' ? 0 : size === 'l' ? 4 : window.innerWidth < 700 ? 2 : 3;
  if (cap) {
    const fls = el('div', { class: 'fls' });
    const shown = v.floors.length > cap ? cap - 1 : cap;
    for (const f of v.floors.slice(0, shown)) {
      const cells = el('span', { class: 'cells', 'aria-hidden': 'true' });
      const order = [...f.rooms.filter((r) => r.status === 'occupied'), ...f.rooms.filter((r) => r.status === 'unknown'), ...f.rooms.filter((r) => r.status === 'clear')];
      for (const r of order.slice(0, 8)) cells.append(el('i', { class: r.status === 'occupied' ? 'on' : r.status === 'unknown' ? 'unk' : '', title: r.name }));
      if (order.length > 8) cells.append(el('em', {}, `+${NUM.format(order.length - 8)}`));
      const act = f.rooms.filter((r) => r.status === 'occupied');
      const who = el('span', { class: 'who ell' }, ...act.slice(0, 3).flatMap((r, i) => (i ? [', ', bdi(r.name)] : [bdi(r.name)])), act.length > 3 ? ` +${NUM.format(act.length - 3)}` : '');
      fls.append(el('div', { class: 'f' }, el('bdi', { class: 'fn' }, f.name), cells, who));
    }
    if (v.floors.length > shown) fls.append(el('div', { class: 'more' }, `+${NUM.format(v.floors.length - shown)} קומות נוספות`));
    root.append(fls);
  }
  return root;
}

function optionC(v: View): HTMLElement {
  const word = v.tone === 'ok' ? `${NUM.format(v.active.length)} ${v.active.length === 1 ? 'חדר פעיל' : 'חדרים פעילים'}` : v.tone === 'clear' ? 'המבנה ריק' : 'אין מידע נוכחות';
  const rest = v.tone === 'ok' ? names(v.active, 4) : v.tone === 'clear' && v.last ? el('span', { class: 'ell' }, bdi(v.last.name), ` · ריק מ־${hm(v.last.empty_since)}`) : null;
  if (rest) rest.classList.add('ell');
  return el('div', { class: 'o16c', 'data-tone': v.tone, 'data-o16': 'c' }, el('span', { class: 'lamp', 'aria-hidden': 'true' }), el('b', {}, word), rest, el('a', { href: '#/explore' }, 'במפה'));
}

(window as unknown as Record<string, unknown>).pdOption16 = async (opt: Opt) => {
  const band = document.querySelector('home-widgets') as (HTMLElement & { presence: BuildingSnapshot | null; updateComplete: Promise<unknown> }) | null;
  const sr = band?.shadowRoot;
  if (!band || !sr || opt === 'current') return;
  await band.updateComplete;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  sr.adoptedStyleSheets = [...sr.adoptedStyleSheets, sheet];
  const card = sr.querySelector('.wg-pres') as HTMLElement | null;
  if (!card || !band.presence) return;
  const v = view(band.presence);
  const size = card.getAttribute('data-size') ?? 'm';
  if (opt === 'c') {
    card.style.display = 'none';
    const alarm = sr.querySelector('.wg-alarm') as HTMLElement | null;
    const line = optionC(v);
    // the lamp's tone rules read data-tone on an .o16 wrapper; the line sits on the card's floor, across its width
    alarm?.append(el('div', { class: 'o16', 'data-tone': v.tone, style: 'gap:0;position:absolute;inset-inline:18px;inset-block-end:12px' }, line));
    return;
  }
  for (const k of [...card.children].slice(1) as HTMLElement[]) k.style.display = 'none'; // keep the real header (title, "במפה")
  card.append(opt === 'a' ? optionA(v, size) : optionB(v, size));
};

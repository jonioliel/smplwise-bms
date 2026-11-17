// HOME-V3-P2-2431: "יומן" - the family's day and the shared rooms (mockup v3 `S.calendar`, sheets `calNew` / `bookNew`). The calendar
// module's own routes only: GET /calendar/calendars, /calendar/occurrences, /calendar/rooms/day, /me/calendar, POST /calendar/events and
// /calendar/events/{id}/cancel|withdraw - every one checks its own permission (calendar.view / calendar.book and the calendar's role).
// A wall panel locked to its room shows the day (owner decision round 27 q12 "ב") and may ADD an event to the family calendar (owner
// answer 11.11, HOME-V3-FOLLOWUP-B-2431: POST /home/wall/events) - no room booking, no cancel. Lists page; nothing scrolls.
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { wallEvent } from './home-fb-api';
import { cancelEvent, createEvent, listCalendars, myCalendar, occurrences, roomsDay, type Calendar, type Occurrence, type RoomDay } from './home-p2-api';
import { errText, has, iso, localInstant, plural, stepper, thisWeekDays, timeOf, warmFamily, weekDays, whenText, ymd, seen, offScreen } from './home-p2-ui';

interface Draft { title: string; day: string; from: number; to: number; cal: string; room: string }
const st: {
  cals: Calendar[]; occ: Occurrence[]; rooms: RoomDay[]; mine: Occurrence[]; pending: { event_id: string; title: string; start: string; end: string; calendar_id: string }[];
  day: string | null; tab: 'day' | 'book'; at: number; loading: boolean; error: string; draft: Draft; busy: boolean;
} = { cals: [], occ: [], rooms: [], mine: [], pending: [], day: null, tab: 'day', at: 0, loading: false, error: '', draft: { title: '', day: '', from: 1080, to: 1140, cal: '', room: '' }, busy: false };

const family = () => st.cals.filter((c) => c.type !== 'room' && c.type !== 'maintenance' && !c.archived);
const bookable = (c: Calendar) => !!c.my_role && ['book', 'edit', 'manage'].includes(c.my_role);
const roomCals = () => st.cals.filter((c) => c.type === 'room' && !c.archived);

function load(h: HomeHost, force = false) {
  if (!has('calendar') || st.loading || (!force && st.at && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  const now = new Date();
  // HOME-R32-ANSWERS-2438: from the week's first day (the "השבוע" strip) to a week from today (the "הימים הקרובים" strip) - both strips
  // and the switch between them need no second request
  const today0 = localInstant(ymd(now), 0);
  const from = localInstant(thisWeekDays(now)[0][2], 0);
  const to = new Date(today0.getTime() + 7 * 86_400_000);
  void (async () => {
    try {
      st.cals = (await listCalendars()).calendars;
      const fam = family().map((c) => c.id);
      const [o, r, m] = await Promise.all([
        fam.length ? occurrences(iso(from), iso(to), fam) : Promise.resolve({ occurrences: [] as Occurrence[] }),
        has('booking') && roomCals().length ? roomsDay(ymd(now)).catch(() => ({ rooms: [] as RoomDay[] })) : Promise.resolve({ rooms: [] as RoomDay[] }),
        has('booking') && roomCals().length ? myCalendar(iso(now), iso(new Date(now.getTime() + 30 * 86_400_000))).catch(() => ({ occurrences: [] as Occurrence[], pending: [] })) : Promise.resolve({ occurrences: [] as Occurrence[], pending: [] }),
      ]);
      st.occ = o.occurrences.filter((x) => x.state !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start));
      st.rooms = r.rooms;
      const roomIds = new Set(roomCals().map((c) => c.id));
      st.mine = m.occurrences.filter((x) => roomIds.has(x.calendar_id) && x.state !== 'cancelled');
      st.pending = m.pending.filter((x) => roomIds.has(x.calendar_id) && !st.mine.some((y) => y.event_id === x.event_id));
      st.error = '';
      st.at = Date.now();
    } catch (e) {
      st.error = errText(e);
    } finally {
      st.loading = false;
      h.requestUpdate();
    }
  })();
}

/** HOME-R32-ANSWERS-2438 (owner round 32 Q-HOME-2 a): the strip is seven days from today unless the person chose "השבוע" (kept in their
 * own layout, like the other display choices). */
const weekMode = (h: HomeHost): 'next' | 'week' => (h.myLayout().cal_week === 'week' ? 'week' : 'next');
const stripDays = (h: HomeHost) => (weekMode(h) === 'week' ? thisWeekDays(h.now) : weekDays(h.now));

const calName = (id: string) => st.cals.find((c) => c.id === id)?.name ?? '';
const dayOf = (o: Occurrence) => ymd(new Date(o.start));

/** "free now" / "free until 18:00" / "busy until 21:00" of a shared room today. */
function roomFree(r: RoomDay, now: Date): string {
  const t = now.getTime();
  const open = r.open.length ? r.open : [];
  if (!open.length) return 'סגור היום';
  const cur = r.entries.find((e) => Date.parse(e.start) <= t && Date.parse(e.end) > t);
  if (cur) return `תפוס עד ${timeOf(cur.end)}`;
  const next = r.entries.filter((e) => Date.parse(e.start) > t).sort((a, b) => a.start.localeCompare(b.start))[0];
  return next ? `פנוי היום עד ${timeOf(next.start)}` : 'פנוי עכשיו';
}

registerMoreTile({
  id: 'calendar', order: 55, href: 'calendar', label: 'יומן', icon: 'cal',
  visible: (h) => seen(h) && has('calendar'),
  warm: (h) => load(h),
  line: (h) => {
    const now = h.now.getTime();
    const e = st.occ.find((x) => Date.parse(x.start) > now);
    if (!e) return { text: 'אין אירועים קרובים' };
    const title = e.title ?? 'אירוע';
    // HOME-V3-AUDITFIX-2437 (audit item 4): a long title does not fit the wall chip - the chip says only the hour, the title keeps it all
    const chip = title.length > 14 ? html`הבא ב-<span class="num">${timeOf(e.start)}</span>` : undefined;
    return { text: html`<span class="num">${timeOf(e.start)}</span> ${title}`, chip, title: `${timeOf(e.start)} ${title}` };
  },
});

function ovlOpen(h: HomeHost, kind: string, extra: Record<string, unknown> = {}) {
  h.ovl = { type: 'ext', mod: 'p2cal', kind, ...extra } as ExtOvl;
}

registerScreen((h: HomeHost) => ({
  id: 'p2cal',
  names: ['calendar'],
  enter: (_n, arg) => { warmFamily(h); if (arg === 'book' || arg === 'day') st.tab = arg; load(h, true); },
  render(_name, arg) {
    if (!has('calendar')) return offScreen(h, 'יומן');
    if (!st.at && !st.loading && !st.error) load(h); // a deep link: the feature map arrived after enter()
    const locked = h.kioskLocked();
    const tabs: [string, string][] = [['day', 'היומן שלנו'], ...(has('booking') && roomCals().length && !locked ? [['book', 'חדרים משותפים'] as [string, string]] : [])];
    if (arg === 'book' || arg === 'day') st.tab = arg as 'day' | 'book';
    if (!tabs.some((t) => t[0] === st.tab)) st.tab = 'day';
    const sg = tabs.length > 1 ? h.seg('p2CalTab', tabs, st.tab, 'תצוגה') : nothing;
    if (st.error && !st.at) return html`${h.head('יומן', '')}${h.empty('x', 'לא הצלחנו לטעון את היומן', st.error)}`;
    if (st.tab === 'book') return book(h, sg);
    const days = stripDays(h);
    const today = ymd(h.now);
    const day = st.day && days.some((d) => d[2] === st.day) ? st.day : today;
    const wk = weekMode(h);
    const wkSeg = h.seg('p2CalWeek', [['week', 'השבוע'], ['next', 'הימים הקרובים']], wk, 'ימים בפס');
    const list = st.occ.filter((o) => dayOf(o) === day);
    const pg = paged(list, h.phone ? 4 : 6, h.pg('cal'));
    const canNew = family().some(bookable); // HOME-V3-FOLLOWUP-B-2431: a wall panel too (its own route below)
    const d0 = days.find((d) => d[2] === day)!;
    return html`${h.headT(day === today ? 'היום ביומן' : `יום ${d0[0]}, ${d0[1]} בחודש`, list.length ? plural(list.length, 'אירוע אחד', 'אירועים') : 'יום פנוי', html`${sg}${wkSeg}`,
      html`${h.pager('cal', pg.pages)}${canNew ? html`<button class="hbtn strong" data-act="p2CalNew">${hi('plus')}<span class="bt">אירוע חדש</span></button>` : nothing}`)}
      <div class="week" role="group" aria-label="ימי השבוע">${days.map(([l, n, s]) => {
        const k = st.occ.filter((o) => dayOf(o) === s).length;
        return html`<button class="wd" data-act="p2CalDay" data-v=${s} aria-pressed=${String(s === day)} data-today=${s === today ? '1' : nothing} data-past=${s < today ? '1' : nothing} aria-label=${`יום ${l}, ${n}, ${k} אירועים`}><span class="wdl">${l}</span><b class="num">${n}</b><span class="wk">${k ? html`<i></i>${k > 1 ? html`<i></i>` : nothing}${k > 2 ? html`<i></i>` : nothing}` : nothing}</span></button>`;
      })}</div>
      <div class="card-grid calg">${pg.items.length ? pg.items.map((e) => html`<div class="tile cev"><span class="ct"><b class="num">${e.all_day ? 'כל היום' : timeOf(e.start)}</b>${e.all_day ? nothing : html`<span class="muted num">${timeOf(e.end)}</span>`}</span><span class="at"><b class="clamp2">${e.title ?? 'תפוס'}</b><span class="muted clamp1">${[e.organizer?.name, calName(e.calendar_id)].filter(Boolean).join(' · ')}</span></span></div>`)
        : h.empty('cal', st.loading ? 'טוענים…' : 'אין אירועים ביום הזה', canNew ? 'אפשר להוסיף אירוע בכפתור "אירוע חדש".' : '')}</div>`;
  },
  ovl(o: ExtOvl) {
    const dr = st.draft;
    const x = html`<button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button>`;
    const days = weekDays(h.now);
    const bk = o.kind === 'bookNew';
    const room = bk ? st.rooms.find((r) => r.calendar_id === dr.room) : undefined;
    const cals = family().filter(bookable);
    const dayRow = html`<div class="setrow flat"><span class="sname">יום</span><div class="week mini">${days.map(([l, n, s]) => html`<button class="wd" data-act="p2CalPick" data-k="day" data-v=${s} aria-pressed=${String(dr.day === s)}><span class="wdl">${l}</span><b class="num">${n}</b></button>`)}</div></div>`;
    const timeRow = html`<div class="setrow flat"><span class="sname">משעה</span>${stepper('p2CalStp', 'from', dr.from, 'משעה')}<span class="sname mid-l">עד שעה</span>${stepper('p2CalStp', 'to', dr.to, 'עד שעה')}</div>`;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label=${bk ? 'הזמנת חדר' : 'אירוע חדש'} data-sheet=${bk ? 'bookNew' : 'calNew'}>
      <header class="menu-h">${hi(bk ? 'door' : 'cal')}<span class="mh-t"><b class="clamp1">${bk ? 'הזמנת ' + (room?.name ?? '') : 'אירוע חדש'}</b><span class="muted clamp1">${bk ? (room ? roomFree(room, h.now) : '') : 'יופיע ביומן של כל המשפחה'}</span></span>${x}</header>
      ${bk ? nothing : html`<label class="fld"><span>מה</span><input class="inp" .value=${dr.title} maxlength="120" placeholder="למשל: ארוחת ערב" enterkeyhint="done" @input=${(e: Event) => { dr.title = (e.target as HTMLInputElement).value; }}></label>`}
      ${dayRow}${timeRow}
      ${!bk && cals.length > 1 ? html`<div class="setrow flat"><span class="sname">יומן</span>${h.seg('p2CalCal', cals.slice(0, 3).map((c) => [c.id, c.name] as [string, string]), dr.cal, 'יומן')}</div>` : nothing}
      <div class="dlg-acts"><button class="hbtn strong" data-act="p2CalSave" ?disabled=${st.busy}>${bk ? 'שלח בקשה' : 'שמור'}</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
  },
  acts: {
    p2CalTab: (el) => { st.tab = el.dataset.v as 'day' | 'book'; h.page = { ...h.page, cal: 0 }; h.go('calendar/' + st.tab); },
    p2CalWeek: (el) => { h.saveMyLayout({ cal_week: el.dataset.v === 'week' ? 'week' : 'next' }); h.page = { ...h.page, cal: 0 }; },
    p2CalDay: (el) => { st.day = el.dataset.v ?? null; h.page = { ...h.page, cal: 0 }; h.requestUpdate(); },
    p2CalNew: () => {
      const cals = family().filter(bookable);
      if (!cals.length) return;
      const start = Math.min(22 * 60, Math.ceil((h.now.getHours() * 60 + h.now.getMinutes() + 30) / 30) * 30);
      st.draft = { title: '', day: st.day ?? ymd(h.now), from: start, to: start + 60, cal: cals[0].id, room: '' };
      ovlOpen(h, 'calNew');
    },
    p2BookNew: (el) => {
      st.draft = { title: '', day: ymd(h.now), from: 16 * 60, to: 18 * 60, cal: '', room: el.dataset.id ?? '' };
      ovlOpen(h, 'bookNew');
    },
    p2CalPick: (el) => { (st.draft as unknown as Record<string, string>)[el.dataset.k ?? ''] = el.dataset.v ?? ''; h.requestUpdate(); },
    p2CalCal: (el) => { st.draft.cal = el.dataset.v ?? ''; h.requestUpdate(); },
    p2CalStp: (el) => {
      const d = st.draft;
      const step = 30 * Number(el.dataset.d);
      if (el.dataset.k === 'from') {
        const len = d.to - d.from;
        d.from = Math.max(0, Math.min(23 * 60 + 30, d.from + step));
        d.to = Math.min(24 * 60, d.from + len);
      } else d.to = Math.max(d.from + 30, Math.min(24 * 60, d.to + step));
      h.requestUpdate();
    },
    p2CalSave: () => {
      const d = st.draft;
      const bk = (h.ovl as ExtOvl | null)?.kind === 'bookNew';
      const title = bk ? `הזמנה: ${st.rooms.find((r) => r.calendar_id === d.room)?.name ?? ''}`.slice(0, 120) : d.title.trim();
      if (!title) return h.toast('כתבו מה האירוע.');
      st.busy = true;
      h.requestUpdate();
      const start = iso(localInstant(d.day, d.from));
      const end = iso(localInstant(d.day, d.to));
      // HOME-V3-FOLLOWUP-B-2431: a wall panel's one calendar write is its own route (the module's routes are refused to it)
      void (h.kioskLocked() && !bk ? wallEvent({ calendar_id: d.cal || undefined, title, start, end }) : createEvent({ calendar_id: bk ? d.room : d.cal, kind: bk ? 'booking' : 'event', title, start, end }))
        .then((r) => {
          h.ovl = null;
          h.toast(bk ? (r.state === 'pending' ? 'הבקשה נשלחה. נודיע כשתאושר.' : 'החדר הוזמן') : 'האירוע נוסף ליומן');
          st.day = d.day;
          load(h, true);
        })
        .catch((e) => h.toast(errText(e)))
        .finally(() => { st.busy = false; h.requestUpdate(); });
    },
    p2BookDel: (el) => {
      const id = el.dataset.id ?? '';
      const m = st.mine.find((x) => x.event_id === id);
      const p = st.pending.find((x) => x.event_id === id);
      const name = calName(m?.calendar_id ?? p?.calendar_id ?? '');
      const when = whenText(m?.start ?? p?.start, h.now);
      h.ovl = {
        type: 'ask', title: `לבטל את ההזמנה של ${name}?`, text: when, yes: 'כן, בטל',
        run: () => void cancelEvent(id, m ? m.state : 'pending', m?.revision).then(() => { h.toast('ההזמנה בוטלה'); load(h, true); }).catch((e) => h.toast(errText(e))),
      };
    },
  },
}));

function book(h: HomeHost, sg: unknown) {
  const pr = paged(st.rooms, h.phone ? 2 : 4, h.pg('bkR'));
  const mine = [
    ...st.mine.map((m) => ({ id: m.event_id, cal: m.calendar_id, start: m.start, end: m.end, state: m.state })),
    ...st.pending.map((p) => ({ id: p.event_id, cal: p.calendar_id, start: p.start, end: p.end, state: 'pending' })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const pm = paged(mine, h.phone ? 2 : 3, h.pg('bkM'));
  return html`${h.headT('חדרים משותפים', 'מזמינים חדר לשעות שנוח לכם', sg)}
    <div class="doors-body bk"><section class="door-list" aria-label="חדרים">${pr.items.length ? pr.items.map((r) => html`<div class="tile arow"><span class="ai">${hi('door')}</span><span class="at"><b class="clamp1">${r.name}</b><span class="muted clamp1">${roomFree(r, h.now)}</span></span><button class="hbtn" data-act="p2BookNew" data-id=${r.calendar_id}>הזמן</button></div>`)
      : h.empty('door', st.loading ? 'טוענים…' : 'אין חדרים להזמנה', 'כשיוגדרו חדרים משותפים, אפשר יהיה להזמין אותם מכאן.')}${h.pager('bkR', pr.pages)}</section>
      <section class="tile pane" aria-label="ההזמנות שלי"><div class="bar"><h2>ההזמנות שלי</h2>${h.pager('bkM', pm.pages)}</div>${pm.items.length ? pm.items.map((m) => html`<div class="vrow bkm"><span class="at"><b class="clamp1">${calName(m.cal)}</b><span class="muted clamp1">${whenText(m.start, h.now)} עד ${timeOf(m.end)}</span><span class="dst" data-tone=${m.state === 'pending' ? 'warn' : 'ok'}><i class="dot"></i><span class="clamp1">${m.state === 'pending' ? 'מחכה לאישור' : 'מאושר'}</span></span></span><button class="rb" data-act="p2BookDel" data-id=${m.id} aria-label="בטל את ההזמנה">${hi('del')}</button></div>`)
        : html`<p class="muted pb-none">עוד לא הזמנתם חדר.</p>`}</section></div>`;
}


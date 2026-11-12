// HOME-V3-P1-2430: the intercom screen of the home interface (mockup v3 `S.intercom`): the call history, guests with a temporary door
// code, and who can come in (view only). Existing routes only:
//   calls   GET /intercom/calls (access.read; rows of stations the person may not read are left out by the server)
//   guests  GET/POST /access/visitors, DELETE /access/visitors/{id}, POST .../verify/send + .../verify/check - the visitor invitation
//           engine, OFF by default (`access.visitors`). Shown only to a person the home administrator marked (`guests`) who holds
//           `access.visitor.invite`; the server checks both again. The door code is NEVER shown here: the engine sends it to the guest's
//           phone after the host confirmed the guest's number (the mockup's "show code" sheet became that confirmation - see the change doc)
//   people  GET /intercom/people (access.people.read; names, validity and doors only - never phones, cards or codes)
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { relTime } from './home-api';
import { registerMoreTile } from './more-registry';
import { ApiError, del, describeError, get, post } from '../api/client';
import { getCallLog, type CallLogRow } from '../api/intercom-calls';
import { canAnywhere } from '../api/session';
import { commandId } from '../api/request-id';
import { callResult, guestState } from './home-v3-words';

interface Visitor {
  id: string; state: string | null; confirmed: boolean; valid_from: string | null; valid_until: string | null; end_reason?: string | null;
  doors: { station_id: string; name: string; relays: number[] }[]; visitor: { name: string | null; number: string | null }; own: boolean;
}
interface GuestDoor { station_id: string; relay: number; name: string; station_name: string }
interface Person { id: string; display_name: string; active: boolean; valid_from: string | null; valid_until: string | null; stations: { station_id: string; enabled: boolean; doors: number[] }[] }
interface Draft { name: string; phone: string; door: string; day: 'today' | 'tom'; from: number; to: number; busy: boolean; error: string }

const st = {
  tab: 'calls' as 'calls' | 'guests' | 'people',
  calls: [] as CallLogRow[], callsLoaded: false,
  guests: [] as Visitor[], doors: [] as GuestDoor[], guestsOn: false, guestsLoaded: false,
  people: [] as Person[], peopleLoaded: false, peopleError: '',
  draft: null as Draft | null, verifyCode: '', verifyError: '', verifySent: false,
};

// HOME-V3-FOLLOWUP-A-2431 (owner answer 1): the intercom is its own category of the per-person list (was: under "doors")
const intercomOk = (h: HomeHost) => h.d.modules.has('intercom') && canAnywhere('access.read');
const guestsOk = (h: HomeHost) => !!h.pol()?.guests && canAnywhere('access.visitor.invite');
const peopleOk = () => canAnywhere('access.people.read');
const today = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }) === new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
const missedToday = () => st.calls.filter((c) => c.outcome === 'missed' && today(c.rang_at)).length;
const hh = (n: number) => String((n + 24) % 24).padStart(2, '0') + ':00';
const dm = (iso: string | null) => (iso ? new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) : '');

async function loadCalls(h: HomeHost) {
  try {
    st.calls = (await getCallLog(null, 40)).calls;
  } catch {
    st.calls = [];
  }
  st.callsLoaded = true;
  h.requestUpdate();
}

async function loadGuests(h: HomeHost) {
  if (!guestsOk(h)) { st.guestsOn = false; st.guestsLoaded = true; return; }
  try {
    const [v, d] = await Promise.all([get<{ visitors: Visitor[] }>('access/visitors?mine=true'), get<{ doors: GuestDoor[] }>('home/guest-doors')]);
    st.guests = v.visitors.filter((g) => g.own);
    st.doors = d.doors;
    st.guestsOn = true;
  } catch {
    st.guestsOn = false; // 404 = the visitor invitations are off for this installation, or the person is not marked
  }
  st.guestsLoaded = true;
  h.requestUpdate();
}

async function loadPeople(h: HomeHost) {
  if (!peopleOk()) return;
  try {
    st.people = (await get<{ people: { records?: Person[] } | null }>('intercom/people?limit=100&sort=name')).people?.records ?? [];
    st.peopleError = '';
  } catch {
    st.people = [];
    st.peopleError = 'הרשימה לא זמינה כרגע.';
  }
  st.peopleLoaded = true;
  h.requestUpdate();
}

function tabs(): [string, string][] {
  return [['calls', 'שיחות'], ...(st.guestsOn ? [['guests', 'אורחים'] as [string, string]] : []), ...(peopleOk() ? [['people', 'מי נכנס'] as [string, string]] : [])];
}

function window_(d: Draft): { from: string; until: string } {
  const base = new Date();
  const local = (hour: number) => {
    const day = new Date(base.getTime() + (d.day === 'tom' ? 86_400_000 : 0));
    const ymd = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    // the installation's zone: Israel. A fixed-offset guess, corrected by reading the offset back at that instant (DST safe)
    const guess = Date.parse(`${ymd}T${String(hour % 24).padStart(2, '0')}:00:00Z`);
    const off = (t: number) => {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t));
      const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
      return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - t;
    };
    let t = guess - off(guess);
    t = guess - off(t);
    return new Date(t + (hour >= 24 ? 86_400_000 : 0));
  };
  const from = local(d.from);
  let until = local(d.to <= d.from ? d.to + 24 : d.to);
  if (until.getTime() <= Date.now()) until = new Date(Date.now() + 3_600_000);
  const iso = (x: Date) => x.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { from: iso(from.getTime() < Date.now() && d.day === 'today' ? new Date() : from), until: iso(until) };
}

registerMoreTile({
  id: 'intercom',
  order: 30,
  href: 'intercom',
  label: 'אינטרקום',
  icon: 'phone',
  visible: (h) => intercomOk(h),
  warm: (h) => void loadCalls(h),
  line: () => {
    const m = missedToday();
    if (!st.callsLoaded) return { text: 'שיחות ואורחים' };
    return m ? { text: m === 1 ? 'שיחה אחת לא נענתה' : `${m} שיחות לא נענו`, tone: 'warn', badge: m } : { text: 'אין שיחות שלא נענו' };
  },
});

registerScreen((h: HomeHost) => {
  const ovl = (kind: string, extra: Record<string, unknown> = {}): ExtOvl => ({ type: 'ext', mod: 'intercom', kind, ...extra });
  const setDraft = (patch: Partial<Draft>) => { if (st.draft) { st.draft = { ...st.draft, ...patch }; h.requestUpdate(); } };
  return {
    id: 'intercom',
    names: ['intercom'],
    enter(_n, arg) {
      if (arg === 'guests' || arg === 'people' || arg === 'calls') st.tab = arg;
      void loadCalls(h);
      void loadGuests(h);
      if (peopleOk()) void loadPeople(h);
    },
    acts: {
      icTab(el) {
        st.tab = (el.dataset.v as typeof st.tab) ?? 'calls';
        history.replaceState(null, '', '#/home/intercom/' + st.tab);
        h.requestUpdate();
      },
      icTalk() {
        h.a_talk();
      },
      guestNew() {
        st.draft = { name: '', phone: '', door: st.doors[0] ? `${st.doors[0].station_id}#${st.doors[0].relay}` : '', day: 'today', from: Math.min(23, new Date().getHours() + 1), to: Math.min(23, new Date().getHours() + 4), busy: false, error: '' };
        h.ovl = ovl('guestNew');
      },
      guestDoor(el) { setDraft({ door: el.dataset.v ?? '' }); },
      guestDay(el) { setDraft({ day: el.dataset.v === 'tom' ? 'tom' : 'today' }); },
      guestStep(el) {
        const d = st.draft;
        if (!d) return;
        const k = el.dataset.k === 'to' ? 'to' : 'from';
        setDraft({ [k]: Math.max(0, Math.min(23, d[k] + +(el.dataset.d ?? 0))) } as Partial<Draft>);
      },
      guestSave() {
        const d = st.draft;
        if (!d || d.busy) return;
        const name = d.name.trim();
        const phone = d.phone.replace(/[^\d+]/g, '');
        if (!name) return setDraft({ error: 'כתבו את שם האורח.' });
        if (phone.replace(/\D/g, '').length < 9) return setDraft({ error: 'כתבו את מספר הטלפון של האורח. אליו יישלח הקוד.' });
        const [sid, relay] = d.door.split('#');
        if (!sid) return setDraft({ error: 'בחרו דלת.' });
        const w = window_(d);
        setDraft({ busy: true, error: '' });
        void post<{ visitor: Visitor }>('access/visitors', { visitor_name: name, phone, doors: { [sid]: [+relay] }, valid_from: w.from, valid_until: w.until, purpose: 'guest', client_request_id: commandId() })
          .then((r) => {
            st.draft = null;
            st.guests = [r.visitor, ...st.guests.filter((g) => g.id !== r.visitor.id)];
            h.page = { ...h.page, gst: 0 };
            st.verifyCode = ''; st.verifyError = ''; st.verifySent = false;
            h.ovl = ovl('guestShow', { id: r.visitor.id });
          })
          .catch((err) => setDraft({ busy: false, error: err instanceof ApiError && err.status === 403 ? 'אין הרשאה להזמין אורח לדלת הזו.' : describeError(err) }));
      },
      guestShow(el) {
        st.verifyCode = ''; st.verifyError = ''; st.verifySent = false;
        h.ovl = ovl('guestShow', { id: el.dataset.id });
      },
      guestVerifySend(el) {
        void post(`access/visitors/${encodeURIComponent(el.dataset.id ?? '')}/verify/send`)
          .then(() => { st.verifySent = true; st.verifyError = ''; h.requestUpdate(); })
          .catch((err) => { st.verifyError = describeError(err); h.requestUpdate(); });
      },
      guestVerifyCheck(el) {
        const id = el.dataset.id ?? '';
        if (!st.verifyCode.trim()) return;
        void post<{ visitor: Visitor }>(`access/visitors/${encodeURIComponent(id)}/verify/check`, { code: st.verifyCode.trim() })
          .then((r) => { st.guests = st.guests.map((g) => (g.id === id ? r.visitor : g)); h.ovl = null; h.toast('המספר אומת. הקוד יישלח לטלפון של האורח בזמן שבחרתם.'); })
          .catch(() => { st.verifyError = 'הקוד לא נכון. בקשו מהאורח לבדוק שוב.'; h.requestUpdate(); });
      },
      guestDelAsk(el) {
        const g = st.guests.find((x) => x.id === el.dataset.id);
        if (!g) return;
        h.ovl = { type: 'ask', title: `לבטל את ההזמנה של ${g.visitor.name ?? 'האורח'}?`, text: 'הקוד יפסיק לעבוד מיד.', yes: 'כן, בטל', run: () => {
          void del(`access/visitors/${encodeURIComponent(g.id)}`).then(() => { void loadGuests(h); h.toast('ההזמנה בוטלה. הקוד כבר לא פותח את הדלת.'); }).catch((err) => h.toast(describeError(err)));
        } };
      },
    },
    ovl(o) {
      const x = html`<button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button>`;
      const scrim = html`<div class="hscrim" data-act="close"></div>`;
      if (o.kind === 'guestNew' && st.draft) {
        const d = st.draft;
        const step = (k: 'from' | 'to', label: string) => html`<span class="stp" role="group" aria-label=${label}><button class="rb" data-act="guestStep" data-k=${k} data-d="-1" aria-label=${label + ': פחות'}>${hi('minus')}</button><b class="num">${hh(d[k])}</b><button class="rb" data-act="guestStep" data-k=${k} data-d="1" aria-label=${label + ': יותר'}>${hi('plus')}</button></span>`;
        return html`${scrim}<section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="הזמנת אורח" data-home-guest-new><header class="menu-h">${hi('guest')}<span class="mh-t"><b>הזמנת אורח</b><span class="muted">האורח יקבל לטלפון קוד זמני לדלת</span></span>${x}</header>
          <div class="fld2"><label class="fld"><span>שם האורח</span><input class="inp" .value=${d.name} placeholder="למשל: דנה" enterkeyhint="next" maxlength="40" @input=${(e: Event) => { d.name = (e.target as HTMLInputElement).value; }}></label>
          <label class="fld"><span>הטלפון של האורח</span><input class="inp num" type="tel" dir="ltr" inputmode="tel" autocomplete="off" .value=${d.phone} placeholder="05X-XXXXXXX" enterkeyhint="done" maxlength="20" @input=${(e: Event) => { d.phone = (e.target as HTMLInputElement).value; }}></label></div>
          <div class="setrow flat"><span class="sname">איזו דלת</span><div class="chipset tight">${st.doors.slice(0, 3).map((g) => { const v = `${g.station_id}#${g.relay}`; return html`<button class="chip2" data-act="guestDoor" data-v=${v} aria-pressed=${String(d.door === v)}><span class="clamp1">${g.name}</span></button>`; })}</div></div>
          <div class="setrow flat"><span class="sname">מתי</span>${h.seg('guestDay', [['today', 'היום'], ['tom', 'מחר']], d.day, 'מתי')}</div>
          <div class="setrow flat"><span class="sname">משעה</span>${step('from', 'משעה')}<span class="sname mid-l">עד שעה</span>${step('to', 'עד שעה')}</div>
          ${d.error ? html`<p class="muted" data-tone="danger" style="color:var(--ct)" role="alert">${d.error}</p>` : nothing}
          <div class="dlg-acts"><button class="hbtn strong" data-act="guestSave" ?disabled=${d.busy || !st.doors.length}>צור הזמנה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
      }
      if (o.kind === 'guestShow') {
        const g = st.guests.find((k) => k.id === o.id);
        if (!g) return nothing;
        const s = guestState(g);
        const doors = g.doors.map((x) => x.name).join(', ');
        const needVerify = s.live && g.state !== 'requested' && !g.confirmed;
        return html`${scrim}<section class="sheet dialog v3 center" role="dialog" aria-modal="true" aria-label="ההזמנה של האורח" data-home-guest-show><span class="dlg-ic">${hi('key')}</span><h2 class="clamp2">ההזמנה של ${g.visitor.name ?? 'האורח'}</h2>
          <span class="dst" data-tone=${s.tone}><i class="dot"></i><span class="clamp1">${s.text}</span></span><p class="muted clamp2">${doors} · <span class="num">${dm(g.valid_from)}</span> עד <span class="num">${dm(g.valid_until)}</span></p>
          ${needVerify ? html`<p class="muted">לפני שהקוד נשלח, מאמתים את הטלפון של האורח: שולחים לו קוד אימות, והוא מקריא לכם אותו.</p>
            ${st.verifySent ? html`<label class="fld"><span>הקוד שהאורח קיבל</span><input class="inp num" dir="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="8" .value=${st.verifyCode} @input=${(e: Event) => { st.verifyCode = (e.target as HTMLInputElement).value.replace(/\D/g, ''); }}></label>` : nothing}
            ${st.verifyError ? html`<p class="muted" data-tone="danger" style="color:var(--ct)" role="alert">${st.verifyError}</p>` : nothing}
            <div class="dlg-acts">${st.verifySent ? html`<button class="hbtn strong" data-act="guestVerifyCheck" data-id=${g.id}>אישור</button>` : html`<button class="hbtn strong" data-act="guestVerifySend" data-id=${g.id}>${hi('phone')}שלח לאורח קוד אימות</button>`}<button class="hbtn" data-act="close">סגור</button></div>`
          : html`<p class="muted">${s.live ? 'הקוד לדלת נשלח לטלפון של האורח. רק הוא רואה אותו.' : 'ההזמנה הסתיימה.'}</p><div class="dlg-acts"><button class="hbtn" data-act="close">סגור</button></div>`}</section>`;
      }
      return nothing;
    },
    render(_n, _arg) {
      if (!intercomOk(h)) return html`${h.head('אינטרקום', '')}${h.empty('lock', 'המסך הזה לא זמין', 'מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.')}`;
      const ts = tabs();
      // a deep link to a tab that is not offered (yet: the guests load after the first paint) shows the calls, without forgetting the tab
      const tab = ts.some(([v]) => v === st.tab) ? st.tab : 'calls';
      const sg = ts.length > 1 ? h.seg('icTab', ts, tab, 'תצוגה') : nothing;
      if (tab === 'guests') {
        const live = st.guests.filter((g) => guestState(g).live);
        const pg = paged(live, h.phone ? 3 : 4, h.pg('gst'));
        return html`${h.headT('אורחים', live.length ? 'קוד זמני לדלת, לשעות שתבחרו' : 'נותנים לאורח קוד זמני לדלת', sg, html`${h.pager('gst', pg.pages)}<button class="hbtn strong" data-act="guestNew" ?disabled=${!st.doors.length}>${hi('guest')}<span class="bt">הזמן אורח</span></button>`)}
          <div class="alert-list">${pg.items.length ? pg.items.map((g) => { const s = guestState(g); return html`<div class="tile arow grow" data-guest=${g.id}><span class="ai" data-tone=${s.tone} style="background:var(--cs);color:var(--ct)">${hi('key')}</span><span class="at"><b class="clamp1">${g.visitor.name ?? 'אורח'}</b><span class="muted clamp2 gw">${g.doors.map((x) => x.name).join(', ')} · <span class="num">${dm(g.valid_from)}</span></span><span class="dst" data-tone=${s.tone}><i class="dot"></i><span class="clamp1">${s.text}</span></span></span><span class="row-acts"><button class="hbtn" data-act="guestShow" data-id=${g.id}>${hi('key')}<span class="bt">פרטים</span></button><button class="rb" data-act="guestDelAsk" data-id=${g.id} aria-label=${'בטל את ההזמנה של ' + (g.visitor.name ?? 'האורח')}>${hi('del')}</button></span></div>`; })
            : h.empty('guest', st.doors.length ? 'אין אורחים מוזמנים' : 'אין דלת שאפשר להזמין אליה', st.doors.length ? 'מזמינים אורח, בוחרים דלת ושעות, והוא מקבל קוד זמני לטלפון.' : 'מנהל הבית צריך לאפשר לך להזמין אורחים לדלת.')}</div>`;
      }
      if (tab === 'people') {
        const pg = paged(st.people, h.phone ? 4 : 6, h.pg('ppl'));
        const until = (p: Person) => (!p.active ? 'לא פעיל' : p.valid_until ? `עד ${new Date(p.valid_until).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' })}` : 'קבוע');
        const doors = (p: Person) => { const n = p.stations.filter((s) => s.enabled).reduce((a, s) => a + Math.max(1, s.doors.length), 0); return n === 0 ? 'אין דלתות' : n === 1 ? 'דלת אחת' : `${n} דלתות`; };
        return html`${h.headT('מי יכול להיכנס', 'בני הבית ואיזו דלת כל אחד יכול לפתוח', sg, h.pager('ppl', pg.pages))}
          <div class="card-grid pplg">${!st.peopleLoaded ? html`<div class="empty loading" aria-busy="true">${hi('people')}<h2>טוענים…</h2></div>` : pg.items.length ? pg.items.map((p) => html`<div class=${'tile prow' + (p.active ? '' : ' away')}><span class="av">${(p.display_name || '?').slice(0, 1)}</span><span class="at"><b class="clamp1">${p.display_name}</b><span class="muted clamp1">${until(p)}</span></span><span class="pk"><span class="muted">נכנס ב</span><b class="clamp2">${doors(p)}</b></span></div>`) : h.empty('people', st.peopleError ? 'הרשימה לא זמינה' : 'עוד אין אנשים ברשימה', st.peopleError || 'מנהל הבית מוסיף אנשים וקודים בממשק המלא.')}</div><p class="foot-note">${hi('lock')}הוספת אנשים, קודים ותגים נעשית על ידי מנהל הבית, בממשק המלא.</p>`;
      }
      const pg = paged(st.calls, h.phone ? 4 : 8, h.pg('calls'));
      const miss = st.calls.filter((c) => c.outcome === 'missed').length;
      return html`${h.headT('אינטרקום', !st.callsLoaded ? '' : !st.calls.length ? 'עוד לא היו שיחות' : miss ? (miss === 1 ? 'שיחה אחת לא נענתה' : `${miss} שיחות לא נענו`) : 'כל השיחות נענו', sg, html`${h.pager('calls', pg.pages)}${h.talkTo ? html`<button class="hbtn" data-act="icTalk">${hi('phone')}<span class="bt">דבר עם הכניסה</span></button>` : nothing}`)}
        <div class="card-grid callg">${pg.items.length ? pg.items.map((v) => { const r = callResult(v); return html`<div class="tile crow" data-call=${v.id}><span class="vp vp-ic">${hi('bell')}</span><span class="at"><b class="clamp1">צלצול</b><span class="muted clamp1">${v.station_name} · <span class="num-r">${relTime(v.rang_at)}</span></span><span class="dst" data-tone=${r.tone}><i class="dot"></i><span class="clamp1">${r.text}</span></span></span></div>`; })
          : h.empty('phone', 'עוד לא היו שיחות', 'כשמישהו יצלצל בדלת, השיחה תופיע כאן.')}</div>`;
    },
  };
});

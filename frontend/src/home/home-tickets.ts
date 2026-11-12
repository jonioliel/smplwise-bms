// HOME-V3-P2-2431: "פניות שירות" (mockup v3 `S.tickets`, sheets `tkNew` / `ticket`). Owner decision (round 27 q8): a resident sees only
// the tickets they OPENED (GET /home/tickets). A new ticket is the tickets module's own create (POST /home/tickets -> the module's
// create_ticket); a note is its own add_note. Shown only while the tickets module is on - when it is off there is no ticket action
// anywhere (the routes answer 404 and nothing here is drawn). Three steps: received, in progress, done. Pages.
// HOME-V3-FOLLOWUP-B-2431 (owner answers 11.11): the new-ticket sheet attaches up to three photos (the mockup's "צרף תמונה"), sent right
// after the ticket is opened (POST /home/tickets/{id}/photos); an open ticket keeps "add note" only.
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { myTickets, newTicket, rid, ticketNote, type Ticket, type TicketCat } from './home-p2-api';
import { errText, has, plural, warmFamily, whenText, seen, offScreen } from './home-p2-ui';
import { PHOTOS_MAX, PHOTO_TYPES, photoProblem, ticketPhoto } from './home-fb-api';

const STEPS = ['התקבלה', 'בטיפול', 'טופלה'];
const st: {
  items: Ticket[]; cats: TicketCat[]; canCreate: boolean; tab: 'open' | 'all'; at: number; loading: boolean; error: string;
  draft: { cat: number; where: string; text: string; note: string; crid: string }; busy: boolean; photos: { file: File; url: string }[];
} = { items: [], cats: [], canCreate: false, tab: 'open', at: 0, loading: false, error: '', draft: { cat: -1, where: '', text: '', note: '', crid: '' }, busy: false, photos: [] };

/** HOME-V3-FOLLOWUP-B-2431: the photos picked in the new-ticket sheet (object URLs for the small previews, released when dropped). */
function dropPhotos(i?: number) {
  const gone = i === undefined ? st.photos : st.photos.slice(i, i + 1);
  for (const p of gone) URL.revokeObjectURL(p.url);
  st.photos = i === undefined ? [] : st.photos.filter((_, k) => k !== i);
}

function pickPhotos(h: HomeHost, input: HTMLInputElement) {
  for (const f of Array.from(input.files ?? [])) {
    const why = photoProblem(f, st.photos.length);
    if (why) { h.toast(why); break; }
    st.photos = [...st.photos, { file: f, url: URL.createObjectURL(f) }];
  }
  input.value = '';
  h.requestUpdate();
}

async function sendPhotos(id: string): Promise<number> {
  let failed = 0;
  for (const p of st.photos) {
    try { await ticketPhoto(id, p.file, p.file.name || 'photo.jpg'); } catch { failed += 1; }
  }
  return failed;
}

function load(h: HomeHost, force = false) {
  if (!has('tickets') || st.loading || (!force && st.at && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  void myTickets('all').then((r) => { st.items = r.items; st.cats = r.categories; st.canCreate = r.can_create; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

const open = () => st.items.filter((t) => t.step < 2);
const word = (t: Ticket) => (t.status === 'cancelled' ? 'בוטלה' : STEPS[t.step]);
const tone = (t: Ticket) => (t.step === 2 ? 'ok' : t.step === 1 ? 'info' : 'neutral');
const steps = (t: Ticket) => html`<span class="steps" aria-label=${'מצב: ' + word(t)}>${STEPS.map((_, i) => html`<i class=${i <= t.step ? 'on' : ''}></i>`)}</span>`;
const noteOf = (t: Ticket) => (t.step === 2 ? 'הפנייה טופלה.' : t.eta_at ? `מטפל יגיע ב${whenText(t.eta_at)}` : t.step === 1 ? 'מישהו כבר מטפל בפנייה.' : 'הפנייה התקבלה. נעדכן כשמישהו יתחיל לטפל.');

/** Opens the new-ticket sheet (also from other screens, e.g. a leak). */
export function openNewTicket(h: HomeHost, where = '') {
  st.draft = { cat: -1, where, text: '', note: '', crid: rid() };
  dropPhotos();
  h.ovl = { type: 'ext', mod: 'p2tickets', kind: 'new' } as ExtOvl;
}

registerMoreTile({
  id: 'tickets', order: 65, href: 'tickets', label: 'פניות שירות', icon: 'wrench',
  visible: (h) => seen(h) && has('tickets'),
  warm: (h) => load(h),
  line: () => { const n = open().length; return { text: n ? plural(n, 'פנייה אחת פתוחה', 'פניות פתוחות') : 'אין פניות פתוחות' }; },
});

registerScreen((h: HomeHost) => ({
  id: 'p2tickets',
  names: ['tickets'],
  enter: () => { warmFamily(h); load(h, true); },
  render() {
    if (!has('tickets')) return offScreen(h, 'פניות שירות');
    if (!st.at && !st.loading && !st.error) load(h); // a deep link: the feature map arrived after enter()
    if (st.error && !st.at) return html`${h.head('פניות שירות', '')}${h.empty('x', 'לא הצלחנו לטעון את הפניות', st.error)}`;
    const n = open().length;
    const list = st.tab === 'open' ? open() : st.items;
    const pg = paged(list, h.phone ? 3 : 4, h.pg('tk'));
    const canNew = st.canCreate && !h.kioskLocked();
    return html`${h.headT('פניות שירות', n ? plural(n, 'פנייה אחת פתוחה', 'פניות פתוחות') : 'אין פניות פתוחות', h.seg('p2TkTab', [['open', 'פתוחות'], ['all', 'הכל']], st.tab, 'סינון'),
      html`${h.pager('tk', pg.pages)}${canNew ? html`<button class="hbtn strong" data-act="p2TkNew">${hi('plus')}<span class="bt">פנייה חדשה</span></button>` : nothing}`)}
      <div class="alert-list">${pg.items.length ? pg.items.map((t) => html`<button class="tile arow tkrow" data-act="p2Ticket" data-id=${t.id}><span class="ai" data-tone=${tone(t)}>${hi('wrench')}</span><span class="at"><b class="clamp1">${t.title}</b><span class="muted clamp1">${[t.place_text, 'נפתחה ' + whenText(t.created_at, h.now)].filter(Boolean).join(' · ')}</span></span><span class="tks">${steps(t)}<span class="muted">${word(t)}</span></span></button>`)
        : h.empty('wrench', st.loading ? 'טוענים…' : st.tab === 'open' ? 'אין פניות פתוחות' : 'עוד לא פתחתם פנייה', canNew ? 'משהו לא עובד? פותחים פנייה בכפתור "פנייה חדשה" ועוקבים אחריה מכאן.' : '')}</div>`;
  },
  ovl(o: ExtOvl) {
    const x = html`<button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button>`;
    const dr = st.draft;
    if (o.kind === 'new') {
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="פנייה חדשה" data-sheet="tkNew"><header class="menu-h">${hi('wrench')}<span class="mh-t"><b>פנייה חדשה</b><span class="muted">מה לא עובד?</span></span>${x}</header>
        ${st.cats.length > 1 ? html`<div class="chipset" role="radiogroup" aria-label="נושא">${st.cats.slice(0, 8).map((c, i) => html`<button class="chip2" role="radio" data-act="p2TkCat" data-v=${String(i)} aria-checked=${String(dr.cat === i)} aria-pressed=${String(dr.cat === i)}><span class="clamp1">${c.name}</span></button>`)}</div>` : nothing}
        <label class="fld"><span>איפה</span><input class="inp" .value=${dr.where} maxlength="200" placeholder="למשל: מטבח" enterkeyhint="next" @input=${(e: Event) => { dr.where = (e.target as HTMLInputElement).value; }}></label>
        <label class="fld"><span>מה קרה</span><textarea class="inp" rows="2" maxlength="4000" placeholder="כמה מילים שיעזרו למי שמטפל" .value=${dr.text} @input=${(e: Event) => { dr.text = (e.target as HTMLTextAreaElement).value; }}></textarea></label>
        ${st.photos.length ? html`<div class="tkph" role="list" aria-label="תמונות מצורפות">${st.photos.map((p, i) => html`<span class="ph" role="listitem"><img src=${p.url} alt=${`תמונה ${i + 1}`}><button class="rb" data-act="p2TkPhDel" data-v=${String(i)} aria-label=${`הסר את תמונה ${i + 1}`}>${hi('x')}</button></span>`)}<span class="muted">${st.photos.length === 1 ? 'תמונה אחת תצורף' : `${st.photos.length} תמונות יצורפו`}</span></div>` : nothing}
        <div class="dlg-acts three"><label class="hbtn tkpick" aria-disabled=${String(st.photos.length >= PHOTOS_MAX || st.busy)}>${hi('photo')}<span class="bt">צרף תמונה</span><input type="file" accept=${PHOTO_TYPES.join(',')} multiple ?disabled=${st.photos.length >= PHOTOS_MAX || st.busy} @change=${(e: Event) => pickPhotos(h, e.target as HTMLInputElement)}></label><button class="hbtn strong" data-act="p2TkSend" ?disabled=${st.busy}>שלח פנייה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
    }
    const t = st.items.find((k) => k.id === o.id);
    if (!t) return nothing;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label=${t.title} data-sheet="ticket"><header class="menu-h"><span class="mh-t"><span class="muted clamp1">${[t.category?.name ?? t.department, t.place_text].filter(Boolean).join(' · ')}</span><b class="clamp2">${t.title}</b></span>${x}</header>
      <div class="steps big">${STEPS.map((s, i) => html`<span class=${'sp' + (i <= t.step ? ' on' : '')}><i>${i <= t.step ? hi('check') : nothing}</i>${s}</span>`)}</div><p class="tk-note clamp3">${hi('bell')}${noteOf(t)}</p><span class="muted">נפתחה ${whenText(t.created_at, h.now)}</span>
      ${o.kind === 'note' ? html`<label class="fld"><span>הערה למטפל</span><textarea class="inp" rows="2" maxlength="4000" .value=${dr.note} @input=${(e: Event) => { dr.note = (e.target as HTMLTextAreaElement).value; }}></textarea></label>
        <div class="dlg-acts"><button class="hbtn strong" data-act="p2TkNoteSend" data-id=${t.id} ?disabled=${st.busy}>שלח הערה</button><button class="hbtn" data-act="close">ביטול</button></div>`
        : html`<div class="dlg-acts">${t.step < 2 ? html`<button class="hbtn" data-act="p2TkNote" data-id=${t.id}>${hi('edit')}הוסף הערה</button>` : nothing}<button class="hbtn" data-act="close">סגור</button></div>`}</section>`;
  },
  acts: {
    p2TkTab: (el) => { st.tab = el.dataset.v as 'open' | 'all'; h.page = { ...h.page, tk: 0 }; h.requestUpdate(); },
    p2TkNew: () => openNewTicket(h, h.ctx()?.name ?? ''),
    p2TkCat: (el) => { st.draft.cat = Number(el.dataset.v); h.requestUpdate(); },
    p2TkPhDel: (el) => { dropPhotos(Number(el.dataset.v)); h.requestUpdate(); },
    p2Ticket: (el) => { h.ovl = { type: 'ext', mod: 'p2tickets', kind: 'open', id: el.dataset.id ?? '' } as ExtOvl; },
    p2TkNote: (el) => { st.draft.note = ''; h.ovl = { type: 'ext', mod: 'p2tickets', kind: 'note', id: el.dataset.id ?? '' } as ExtOvl; },
    p2TkSend: () => {
      const d = st.draft;
      const c = st.cats.length === 1 ? st.cats[0] : st.cats[d.cat];
      if (!c) return h.toast('בחרו נושא לפנייה.');
      const text = d.text.trim();
      const title = (text ? text.split('\n')[0] : `תקלה: ${c.name}`).slice(0, 120);
      st.busy = true;
      h.requestUpdate();
      void newTicket({ department_id: c.department_id, category_id: c.category_id, title, where: d.where.trim(), text, client_request_id: d.crid })
        .then(async (r) => {
          const n = st.photos.length;
          const failed = n && r?.id ? await sendPhotos(r.id) : 0;
          dropPhotos();
          h.ovl = null; st.tab = 'open'; h.page = { ...h.page, tk: 0 };
          h.toast(failed ? (failed === n ? 'הפנייה נשלחה, אבל התמונה לא צורפה.' : 'הפנייה נשלחה, אבל חלק מהתמונות לא צורפו.') : n ? 'הפנייה נשלחה עם התמונות' : 'הפנייה נשלחה');
          load(h, true); if (!location.hash.endsWith('/tickets')) h.go('tickets');
        })
        .catch((e) => h.toast(errText(e)))
        .finally(() => { st.busy = false; h.requestUpdate(); });
    },
    p2TkNoteSend: (el) => {
      const text = st.draft.note.trim();
      if (!text) return h.toast('כתבו את ההערה.');
      st.busy = true;
      void ticketNote(el.dataset.id ?? '', text).then(() => { h.ovl = null; h.toast('ההערה נשלחה למטפל'); load(h, true); })
        .catch((e) => h.toast(errText(e)))
        .finally(() => { st.busy = false; h.requestUpdate(); });
    },
  },
}));

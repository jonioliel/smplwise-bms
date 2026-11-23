// HOME-FAVORITES-2500 (owner 22.11): the scenes of the home interface, its pieces outside sw-home.ts.
// Q79 "חלון הצעה שצריך לאשר, עם הקוד הרגיל": after a leaving or a night scene ran, a dialog offers to lock the doors that are still
// unlocked and then to arm the alarm. Nothing happens without the person's "כן"; arming then goes through the alarm's own code rule,
// exactly as on the alarm screen (the code pad when the panel asks for a code, never a code kept or guessed), and a lock is the usual
// lock command. The person can turn the suggestion off ("הגדרות › סצנות"; layout key `scene_suggest`, on when absent).
// Q75 "מי שמחזיק הרשאת ניהול סצנות": a scene is edited from the home interface by whoever holds scene.manage for it (the server's
// `can.edit`, a floor-scoped home manager included - home-api.ts no longer asks for installation scope): rename, keep what is on now,
// move to the trash. The server checks every write (routers/automations.py: scene.manage + the scope of each member).
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { loadScenes, type HDoor, type HScene } from './home-api';
import { lockDoor } from './home-actions';
import { ARM_WORD } from './home-v3-words';
import { sw } from './home-p2-ui';
import { rid } from './home-p2-api';
import { armNeedsCode, sceneSuggestions, type Suggestion } from './home-favgrid';
import { CODE_ERROR_LABEL, panelAction, type AlarmPanel } from '../api/alarm';
import { httpAutomations, type ItemDetail, type SceneDraft } from '../api/automations';
import { ApiError, describeError } from '../api/client';
import { canAnywhere } from '../api/session';
import { tr } from '../i18n/msg/home';

type Next = Suggestion<AlarmPanel, HDoor>;
const nx: { list: Next[] } = { list: [] };

const suggestOn = (h: HomeHost): boolean => h.favApi.layout().scene_suggest !== false;

/** sw-home's a_scene, once the scene ran: opens the suggestion when there is one and nothing else is open. */
export async function afterScene(h: HomeHost, s: HScene): Promise<void> {
  if (!suggestOn(h) || (s.icon !== 'leave' && s.icon !== 'night')) return;
  const alarm = h.d.modules.has('security') && canAnywhere('alarm.view') && canAnywhere('alarm.arm');
  if (alarm && !h.panels.length) await h.loadPanels();
  const list = sceneSuggestions(s.icon, alarm ? h.panels : [], h.visRooms().flatMap((r) => r.doors));
  if (!list.length || h.ovl) return;
  nx.list = list;
  h.ovl = { type: 'ext', mod: 'scene2500', kind: 'next' } as ExtOvl;
}

function arm(h: HomeHost, p: AlarmPanel, mode: string, code?: string) {
  h.ovl = null;
  void panelAction(p.entity_id, mode as never, { confirmed: true, code })
    .then(() => { h.toast(tr('האזעקה נדרכת')); window.setTimeout(() => void h.loadPanels(), 1500); })
    .catch((err) => h.toast(err instanceof ApiError && CODE_ERROR_LABEL[err.code] ? CODE_ERROR_LABEL[err.code] : describeError(err)));
}

/** The next offer, or the dialog closes. */
function step(h: HomeHost) {
  nx.list = nx.list.slice(1);
  h.ovl = nx.list.length ? ({ type: 'ext', mod: 'scene2500', kind: 'next' } as ExtOvl) : null;
}

// ---------------------------------------------------------------- Q75: the scene sheet

const ed: { id: string; d: ItemDetail | null; name: string; now: boolean; busy: boolean; err: string; confirm: boolean; del: boolean } = { id: '', d: null, name: '', now: false, busy: false, err: '', confirm: false, del: false };

/** The scene's edit button on "הגדרות › סצנות" (only with the server's `can.edit`, which needs scene.manage). */
export function sceneEditBtn(h: HomeHost, s: HScene) {
  if (!s.canEdit || h.kioskLocked()) return nothing;
  return html`<button class="hbtn" data-act="scEdit" data-id=${s.id} data-scene-edit=${s.id}>${hi('edit')}<span class="bt">${tr('עריכה')}</span></button>`;
}

/** The personal switch of the suggestion, on "הגדרות › סצנות". */
export function sceneSuggestRow(h: HomeHost) {
  const on = suggestOn(h);
  return html`<div class="tile setrow" data-scene-suggest-set><span class="sname"><b>${tr('הצעה אחרי סצנה')}</b><span class="muted clamp2">${tr('אחרי יציאה או לילה: לנעול דלתות או לדרוך אזעקה, רק באישור שלך ועם הקוד הרגיל')}</span></span>${sw(on, 'scSuggest', tr('הצעה אחרי סצנה'))}</div>`;
}

function reload(h: HomeHost) {
  return loadScenes().then((scenes) => { h.data = { ...h.d, scenes }; });
}

function fail(h: HomeHost, err: unknown) {
  ed.busy = false;
  if (err instanceof ApiError && err.code === 'confirmation_required') ed.confirm = true;
  else ed.err = describeError(err);
  h.requestUpdate();
}

registerScreen((h: HomeHost) => ({
  id: 'scene2500',
  names: [],
  render: () => nothing,
  ovl(o: ExtOvl) {
    if (o.kind === 'next') {
      const n = nx.list[0];
      if (!n) return nothing;
      if (n.kind === 'lock') {
        const names = n.doors.map((d) => d.name).join(', ');
        return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="${tr('לנעול דלתות?')}" data-scene-next="lock"><span class="dlg-ic">${hi('lock')}</span><h2 class="clamp2">${n.doors.length === 1 ? tr('לנעול את {name}?', { name: n.doors[0].name }) : tr('לנעול דלתות?')}</h2><p class="muted clamp2">${n.doors.length === 1 ? tr('הדלת עדיין לא נעולה.') : tr('עדיין לא נעולות: {names}.', { names })}</p><div class="dlg-acts"><button class="hbtn strong" data-act="scNextYes">${tr('כן, נעל')}</button><button class="hbtn" data-act="close">${tr('לא עכשיו')}</button></div></section>`;
      }
      const code = armNeedsCode(n.panel);
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="${tr('לדרוך אזעקה?')}" data-scene-next="arm"><span class="dlg-ic">${hi('shield')}</span><h2 class="clamp2">${tr('לדרוך אזעקה?')}</h2><p class="muted clamp2">${ARM_WORD[n.mode]} · ${n.panel.name}${code ? tr('. הדריכה תבקש את הקוד שלך.') : ''}</p><div class="dlg-acts"><button class="hbtn strong" data-act="scNextYes">${tr('כן, דרוך')}</button><button class="hbtn" data-act="close">${tr('לא עכשיו')}</button></div></section>`;
    }
    const d = ed.d;
    const draft = d?.draft as SceneDraft | undefined;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="${tr('עריכת סצנה')}" data-sheet="sceneEdit"><header class="menu-h">${hi('scenes')}<span class="mh-t"><b>${tr('עריכת סצנה')}</b><span class="muted clamp1">${draft ? tr('{n} דברים בסצנה', { n: draft.members.length }) : tr('טוענים…')}</span></span><button class="rb" data-act="close" aria-label="${tr('סגור')}">${hi('x')}</button></header>
      ${ed.del ? html`<p class="clamp2">${tr('להעביר את הסצנה לסל? אפשר לשחזר אותה משם בממשק המלא.')}</p><div class="dlg-acts"><button class="hbtn strong" data-act="scDelYes" ?disabled=${ed.busy}>${tr('כן, לסל')}</button><button class="hbtn" data-act="scDelNo">${tr('ביטול')}</button></div>`
        : html`<label class="fld"><span>${tr('שם הסצנה')}</span><input class="inp" .value=${ed.name} maxlength="80" enterkeyhint="done" ?disabled=${!d} @input=${(e: Event) => { ed.name = (e.target as HTMLInputElement).value; }}></label>
      <div class="setrow flat"><span class="sname"><b>${tr('לשמור את המצב של עכשיו')}</b><span class="muted clamp2">${tr('הדברים שבסצנה יישמרו כמו שהם דולקים, פתוחים ומכוונים עכשיו')}</span></span>${sw(ed.now, 'scEditNow', tr('לשמור את המצב של עכשיו'), {}, !d)}</div>
      ${ed.err ? html`<p class="muted" role="alert" data-tone="danger">${ed.err}</p>` : ed.confirm ? html`<p class="muted" role="alert">${tr('השינוי נוגע בדברים רגישים. לאשר ולשמור?')}</p>` : nothing}
      <div class="dlg-acts"><button class="hbtn strong" data-act="scEditSave" ?disabled=${!d || ed.busy}>${ed.confirm ? tr('כן, שמור') : tr('שמור')}</button><button class="hbtn" data-act="scDelAsk" ?disabled=${!d || ed.busy}>${hi('del')}<span class="bt">${tr('לסל')}</span></button><button class="hbtn" data-act="close">${tr('ביטול')}</button></div>`}</section>`;
  },
  acts: {
    scNextYes: () => {
      const n = nx.list[0];
      if (!n) { h.ovl = null; return; }
      if (n.kind === 'lock') {
        for (const d of n.doors) void lockDoor(d).then((o) => { if (!o.ok) h.toast(o.note || tr('הדלת לא ננעלה.')); });
        h.toast(n.doors.length === 1 ? tr('{name} ננעלת', { name: n.doors[0].name }) : tr('הדלתות ננעלות'));
        step(h);
        return;
      }
      nx.list = [];
      if (armNeedsCode(n.panel)) { h.ovl = { type: 'code', title: `${ARM_WORD[n.mode]}: ${n.panel.name}`, code: '', error: '', run: (c: string) => arm(h, n.panel, n.mode, c) }; return; }
      arm(h, n.panel, n.mode);
    },
    scSuggest: () => { h.saveMyLayout({ scene_suggest: !suggestOn(h) }); },
    scEdit: (el) => {
      Object.assign(ed, { id: el.dataset.id ?? '', d: null, name: '', now: false, busy: false, err: '', confirm: false, del: false });
      h.ovl = { type: 'ext', mod: 'scene2500', kind: 'edit' } as ExtOvl;
      void httpAutomations.get('scene', ed.id).then((d) => { ed.d = d; ed.name = (d.draft as SceneDraft).name; h.requestUpdate(); }).catch((err) => fail(h, err));
    },
    scEditNow: () => { ed.now = !ed.now; h.requestUpdate(); },
    scEditSave: () => {
      const d = ed.d;
      if (!d) return;
      const name = ed.name.trim();
      if (!name) { ed.err = tr('תנו לסצנה שם.'); h.requestUpdate(); return; }
      const old = d.draft as SceneDraft;
      ed.busy = true;
      ed.err = '';
      h.requestUpdate();
      const members = ed.now ? httpAutomations.capture({ entity_ids: old.members.map((m) => m.entity_id) }).then((c) => c.members) : Promise.resolve(old.members);
      void members
        .then((m) => httpAutomations.replace('scene', ed.id, { draft: { ...old, name, members: m }, base_revision: d.revision, confirm: ed.confirm || undefined, client_request_id: rid() }))
        .then(() => { h.ovl = null; h.toast(tr('הסצנה "{name}" נשמרה', { name })); return reload(h); })
        .catch((err) => fail(h, err));
    },
    scDelAsk: () => { ed.del = true; h.requestUpdate(); },
    scDelNo: () => { ed.del = false; h.requestUpdate(); },
    scDelYes: () => {
      const d = ed.d;
      if (!d) return;
      ed.busy = true;
      h.requestUpdate();
      // the sheet's own question was the confirmation the server asks for on every delete
      void httpAutomations.remove('scene', ed.id, { base_revision: d.revision, confirm: true, client_request_id: rid() })
        .then(() => { h.ovl = null; h.toast(tr('הסצנה הועברה לסל')); return reload(h); })
        .catch((err) => { ed.del = false; fail(h, err); });
    },
  },
}));

// HOME-V3-P1-2430: the alarm screen of the home interface ("אזעקה", mockup v3 `S.security`; the screen existed since 2.42.0 and is now
// drawn as the mockup). Arming stays one tap plus one confirmation sheet (owner); disarming asks for the code the panel needs. The
// personal alarm code is changed here ("הקוד האישי שלי"): the current code first (or, for a first code, the panel's code - the
// existing rule of PUT /alarm/me/pin), then the new one twice. Existing routes only: GET /alarm/panels, POST /alarm/panels/{id}/actions,
// GET /alarm/me, PUT /alarm/me/pin. Codes are never kept beyond the sheet.
import { uiLocale } from '../i18n/locale';
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { ApiError, describeError } from '../api/client';
import { CODE_ERROR_LABEL, alarmMe, panelAction, setMyPin, zoneState, type AlarmAction, type AlarmPanel } from '../api/alarm';
import { canAnywhere } from '../api/session';
import { ARM_WORD, alarmLook, alarmWord } from './home-v3-words';
import { tr } from '../i18n/msg/home';
import { followAlarmAction } from './home-alarm-follow';

type PinMode = 'cur' | 'panel' | 'new1' | 'new2';
const st = { panel: '', pin: { set: false, known: false }, pollT: 0 };
/** SCREENS-FIX-A-2520 (SCR-06): while the alarm screen is open the panels are read again on this beat too (a push re-reads them at
 * once; this covers a push socket that is down). */
const ALARM_POLL_MS = 15_000;

const alarmOk = (h: HomeHost) => h.d.modules.has('security') && canAnywhere('alarm.view');
const panelOf = (h: HomeHost): AlarmPanel | undefined => h.panels.find((p) => p.entity_id === st.panel) ?? h.panels[0];

const PIN_TEXT: Record<PinMode, [string, string]> = {
  cur: [tr('הקוד האישי הנוכחי'), tr('הקישו את הקוד שלכם היום')],
  panel: [tr('קוד הלוח'), tr('לקוד אישי ראשון: הקישו את הקוד של לוח האזעקה')],
  new1: [tr('קוד אישי חדש'), tr('בחרו קוד של 4 עד 8 ספרות')],
  new2: [tr('שוב, לאישור'), tr('הקישו את הקוד החדש פעם נוספת')],
};

function send(h: HomeHost, p: AlarmPanel, action: AlarmAction, code?: string) {
  h.ovl = null;
  void panelAction(p.entity_id, action, { confirmed: true, code })
    .then((rec) => followAlarmAction(h, rec, action)) // SCR-06: "sent" until the panel confirms; confirmed / failed / unknown honestly
    .catch((err) => h.toast(err instanceof ApiError && CODE_ERROR_LABEL[err.code] ? CODE_ERROR_LABEL[err.code] : describeError(err)));
}

registerMoreTile({
  id: 'alarm',
  order: 40,
  href: 'security',
  label: tr('אזעקה'),
  icon: 'shield',
  visible: (h) => alarmOk(h) && (h.panels.length > 0 || h.panelsRead === 'error'), // SCR-06: a failed read shows "unavailable", not nothing
  warm: (h) => { if (alarmOk(h) && !h.panels.length) void h.loadPanels(); },
  line: (h) => {
    const p = panelOf(h);
    const w = alarmWord(p?.state ?? null, p?.available ?? false);
    return { text: w.text, tone: w.tone === 'neutral' ? undefined : w.tone };
  },
});

registerScreen((h: HomeHost) => {
  const pinOvl = (mode: PinMode, extra: Record<string, unknown> = {}): ExtOvl => ({ type: 'ext', mod: 'alarm', kind: 'pin', mode, v: '', ...extra });
  return {
    id: 'alarm',
    names: ['security'],
    enter() {
      if (alarmOk(h)) void h.loadPanels();
      window.clearInterval(st.pollT);
      st.pollT = alarmOk(h) ? window.setInterval(() => { if (!document.hidden) void h.loadPanels(); }, ALARM_POLL_MS) : 0;
      if (canAnywhere('alarm.arm') || canAnywhere('alarm.disarm')) void alarmMe().then((m) => { st.pin = { set: m.pin_set, known: true }; h.requestUpdate(); }).catch(() => undefined);
    },
    leave() {
      window.clearInterval(st.pollT);
      st.pollT = 0;
    },
    acts: {
      almPanel(el) { st.panel = el.dataset.v ?? ''; h.requestUpdate(); },
      almArm(el) {
        const p = panelOf(h);
        const action = (el.dataset.v ?? 'arm_away') as AlarmAction;
        if (!p) return;
        const prompt = p.code.arm;
        if (prompt === 'unverifiable' || prompt === 'pin_missing') return h.toast(prompt === 'pin_missing' ? tr('צריך קוד אישי לאזעקה. בחרו "הקוד האישי שלי".') : tr('אי אפשר לאמת קוד לפעולה הזו מכאן.'));
        if (prompt === 'pin' || prompt === 'panel') { h.ovl = { type: 'code', title: ARM_WORD[action] ?? tr('דריכה'), code: '', error: '', run: (c: string) => send(h, p, action, c) }; return; }
        const open = p.ready.open.length;
        h.ovl = { type: 'ask', title: action === 'arm_home' ? tr('לדרוך למצב "בבית"?') : action === 'arm_night' ? tr('לדרוך ללילה?') : tr('לדרוך את האזעקה?'),
          text: open ? tr('{v1}. הם לא יהיו מוגנים.', { v1: open === 1 ? tr('פתח אחד עדיין פתוח') : open + tr(' פתחים עדיין פתוחים') }) : action === 'arm_away' ? tr('יש לכם זמן לצאת מהבית.') : tr('הגלאים בתוך הבית לא יופעלו.'),
          yes: tr('כן, דרוך'), run: () => send(h, p, action) };
      },
      almDisarm() {
        const p = panelOf(h);
        if (!p) return;
        const prompt = p.code.disarm;
        if (prompt === 'unverifiable' || prompt === 'pin_missing') return h.toast(prompt === 'pin_missing' ? tr('צריך קוד אישי לאזעקה. בחרו "הקוד האישי שלי".') : tr('אי אפשר לאמת קוד לפעולה הזו מכאן.'));
        if (prompt === 'pin' || prompt === 'panel') { h.ovl = { type: 'code', title: tr('נטרול האזעקה'), code: '', error: '', run: (c: string) => send(h, p, 'disarm', c) }; return; }
        h.ovl = { type: 'ask', title: tr('לנטרל את האזעקה?'), text: p.name, yes: tr('כן, נטרל'), run: () => send(h, p, 'disarm') };
      },
      almPin() {
        h.ovl = pinOvl(st.pin.set ? 'cur' : 'panel');
      },
      pinKey(el) {
        const o = h.ovl as ExtOvl | null;
        if (!o || o.kind !== 'pin') return;
        const k = el.dataset.k ?? '';
        const v = String(o.v ?? '');
        h.ovl = { ...o, err: '', v: k === 'del' ? v.slice(0, -1) : v.length < 8 ? v + k : v };
      },
      pinGo() {
        const o = h.ovl as ExtOvl | null;
        if (!o || o.kind !== 'pin') return;
        const v = String(o.v ?? '');
        const mode = o.mode as PinMode;
        if (v.length < 4) return;
        if (mode === 'cur') { h.ovl = pinOvl('new1', { cur: v }); return; }
        if (mode === 'panel') { h.ovl = pinOvl('new1', { panel: v }); return; }
        if (mode === 'new1') { h.ovl = pinOvl('new2', { cur: o.cur, panel: o.panel, first: v }); return; }
        if (v !== o.first) { h.ovl = pinOvl('new1', { cur: o.cur, panel: o.panel, err: tr('הקודים לא זהים. נסו שוב.') }); return; }
        void setMyPin(v, o.cur as string | undefined, o.panel as string | undefined)
          .then(() => { st.pin = { set: true, known: true }; h.ovl = null; h.toast(tr('הקוד האישי הוחלף')); })
          .catch((err) => { h.ovl = pinOvl(st.pin.set ? 'cur' : 'panel', { err: err instanceof ApiError && CODE_ERROR_LABEL[err.code] ? CODE_ERROR_LABEL[err.code] : describeError(err) }); });
      },
    },
    ovl(o) {
      if (o.kind !== 'pin') return nothing;
      const mode = o.mode as PinMode;
      const [title, hint] = PIN_TEXT[mode];
      const len = String(o.v ?? '').length;
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog v3 center pinsheet" role="dialog" aria-modal="true" aria-label=${title} data-home-pin=${mode}><h2>${title}</h2><p class="muted">${o.err ? html`<span data-tone="danger" style="color:var(--ct)" role="alert">${o.err}</span>` : hint}</p>
        <div class="pin" aria-live="polite">${Array.from({ length: Math.max(4, len) }, (_, i) => html`<i class=${i < len ? 'on' : ''}></i>`)}</div>
        <div class="keys" dir="ltr">${keys.map((k) => k === 'go' ? html`<button class="rb play" data-act="pinGo" ?disabled=${len < 4} aria-label="${tr('אישור')}">${hi('check')}</button>` : k === 'del' ? html`<button class="rb" data-act="pinKey" data-k="del" aria-label="${tr('מחק')}">${hi('back')}</button>` : html`<button class="rb num" data-act="pinKey" data-k=${k}>${k}</button>`)}</div>
        <button class="hbtn quiet" data-act="close">${tr('ביטול')}</button></section>`;
    },
    render() {
      const p = panelOf(h);
      // SCR-06: a read that failed is "unavailable" and a read on its way is "loading" - never "no alarm system"
      if (alarmOk(h) && !p && h.panelsRead === 'error') return html`${h.head(tr('אזעקה'), '')}${h.empty('shield', tr('מצב האזעקה לא זמין כרגע'), tr('לא הצלחנו לקרוא את מצב האזעקה. ננסה שוב בעוד רגע.'))}`;
      if (alarmOk(h) && !p && h.panelsRead === 'none') return html`${h.head(tr('אזעקה'), '')}${h.empty('shield', tr('קוראים את מצב האזעקה…'), '')}`;
      if (!alarmOk(h) || !p) return html`${h.head(tr('אזעקה'), '')}${h.empty('shield', tr('אין מערכת אזעקה מחוברת'), tr('כשתחובר מערכת אזעקה, אפשר יהיה לדרוך ולנטרל אותה מכאן.'))}`;
      const w = alarmWord(p.state, p.available);
      // HONEST-STATES-2540 (SCR-09): only a state the screen knows decides the buttons; an unknown state offers none (all disabled)
      const look = alarmLook(p.state, p.available);
      const armed = look === 'armed' || look === 'triggered';
      const unknown = look === 'unknown';
      const open = p.ready.open;
      const zones = p.zones.slice().sort((a, b) => Number(!a.open) - Number(!b.open));
      const pg = paged(zones, h.phone ? 3 : 5, h.pg('alz'));
      const modes = (['arm_away', 'arm_home', 'arm_night'] as const).filter((m) => p.arm_modes.includes(m));
      const line = h.panelsRead === 'error' ? tr('אין קשר כרגע. מוצג המצב האחרון שנקרא.') : !p.available ? tr('המערכת לא זמינה כרגע.') : unknown ? tr('מצב המערכת לא ידוע כרגע.') : armed ? (p.code.disarm === 'pin' ? tr('לנטרול צריך את הקוד האישי שלך.') : tr('לנטרול לחצו על נטרול.')) : open.length ? tr('{v1}. כדאי לסגור לפני דריכה.', { v1: open.length === 1 ? tr('פתח אחד פתוח') : open.length + tr(' פתחים פתוחים') }) : tr('כל הפתחים סגורים.');
      const pinBtn = st.pin.known && (canAnywhere('alarm.arm') || canAnywhere('alarm.disarm')) ? html`<button class="hbtn" data-act="almPin" data-home-pin-change>${hi('key')}<span class="bt">${tr('הקוד האישי שלי')}</span></button>` : nothing;
      const pick = h.panels.length > 1 ? h.seg('almPanel', h.panels.slice(0, 4).map((x) => [x.entity_id, x.name] as [string, string]), p.entity_id, tr('מערכת')) : nothing;
      return html`${h.head(tr('אזעקה'), p.last_changed ? tr('{name} · השתנתה {v1}', { name: p.name, v1: new Date(p.last_changed).toLocaleString(uiLocale(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) }) : p.name, html`${pick}${pinBtn}`)}
        <div class="clim-body alm"><section class="tile pane alm-main" data-tone=${w.tone} aria-label=${p.name} data-home-alarm=${p.state ?? ''} data-home-alarm-read=${h.panelsRead}><span class="alm-ic">${hi('shield')}</span><b class="alm-w">${w.text}</b><span class="muted">${line}</span>
          <div class="alm-acts">${armed ? html`<button class="hbtn strong xl" data-act="almDisarm" ?disabled=${!p.can.disarm || !p.available}>${hi('unlock')}${tr('נטרול')}</button>` : modes.map((m, i) => html`<button class=${'hbtn xl' + (i === 0 ? ' strong' : '')} data-act="almArm" data-v=${m} ?disabled=${!p.can.arm || !p.available || unknown}>${hi(m === 'arm_home' ? 'home' : m === 'arm_night' ? 'night' : 'lock')}${ARM_WORD[m]}</button>`)}</div></section>
          <section class="tile pane" aria-label="${tr('פתחים')}"><div class="bar"><h2>${tr('דלתות, חלונות וגלאים')}</h2>${h.pager('alz', pg.pages)}</div>${pg.items.length ? pg.items.map((z) => { const s = zoneState(z); const tone = s.tone === 'ok' ? 'ok' : s.tone === 'fault' ? 'danger' : s.tone === 'bypassed' ? 'neutral' : 'warn'; return html`<div class="sysr"><b class="clamp1" dir="auto">${z.name}</b><span class="dst" data-tone=${tone}><i class="dot"></i><span class="clamp1">${s.label}</span></span></div>`; }) : h.empty('shield', tr('אין גלאים להצגה'), tr('כשהאזעקה תדווח על דלתות, חלונות או גלאים, הם יופיעו כאן.'))}</section></div>`; // HOME-V3-AUDITFIX-2437 (audit item 26)
    },
  };
});

// HOME-V3-GAPS-2436 (owner, round 29 answer 7): the personal alarm code also on "ההתראות שלי" (mockup v3 `S.notif`), the same sheet
// and the same rule as the alarm screen's "הקוד האישי שלי" (its `almPin` action).
const pinOk = (h: HomeHost) => alarmOk(h) && h.panels.length > 0 && (canAnywhere('alarm.arm') || canAnywhere('alarm.disarm'));

/** Loads what the row needs (the panels, whether the person has a code); each piece once. */
export function warmAlarmPin(h: HomeHost): void {
  if (!alarmOk(h)) return;
  if (!h.panels.length) void h.loadPanels();
  if (!st.pin.known && (canAnywhere('alarm.arm') || canAnywhere('alarm.disarm'))) void alarmMe().then((m) => { st.pin = { set: m.pin_set, known: true }; h.requestUpdate(); }).catch(() => undefined);
}

/** The row on "ההתראות שלי": nothing when there is no alarm, no permission to arm or disarm, or the code state is not known yet. */
export function alarmPinRow(h: HomeHost) {
  if (!pinOk(h) || !st.pin.known) return nothing;
  return html`<div class="tile setrow" data-gap-pin><span class="sname"><b>${tr('הקוד האישי שלי לאזעקה')}</b><span class="muted clamp1">${st.pin.set ? tr('רק את או אתה יודעים אותו') : tr('עוד אין לך קוד אישי')}</span></span><button class="hbtn" data-act="almPin">${st.pin.set ? tr('החלף קוד') : tr('קבע קוד')}</button></div>`;
}

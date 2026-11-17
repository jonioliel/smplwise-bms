// HOME-V3-P2-2431: "ההתראות שלי" and "לא להפריע בלילה" (mockup v3 `S.notif`): what reaches the person's own phones, per kind, and the
// person's own night window (GET / PUT /home/notify). Muting reaches every one of the person's own phones; a safety notification is
// never muted. During the night window only the alarm, the doors and anything critical come through. Each person chooses for themself.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { registerMoreTile } from './more-registry';
import { getNotify, putNotify, type NotifyMe } from './home-p2-api';
import { errText, has, stepper, sw, warmFamily, seen } from './home-p2-ui';
import { alarmPinRow, warmAlarmPin } from './home-alarm'; // HOME-V3-GAPS-2436: the personal alarm code here too
import { tr } from '../i18n/msg/home';

const st: { me: NotifyMe | null; at: number; loading: boolean; error: string; busy: boolean } = { me: null, at: 0, loading: false, error: '', busy: false };
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const toHm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function load(h: HomeHost, force = false) {
  if (st.loading || (!force && st.at && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  void getNotify().then((m) => { st.me = m; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

function save(h: HomeHost, body: Parameters<typeof putNotify>[0], ok: string) {
  st.busy = true;
  void putNotify(body).then((m) => { st.me = m; h.toast(ok); }).catch((e) => { h.toast(errText(e)); load(h, true); })
    .finally(() => { st.busy = false; h.requestUpdate(); });
}

registerMoreTile({
  id: 'notif', order: 90, href: 'notif', label: tr('ההתראות שלי'), icon: 'bell',
  visible: (h) => seen(h) && has('notif'),
  warm: (h) => load(h),
  line: () => ({ text: st.me?.dnd.enabled ? tr('מצב "לא להפריע" פועל') : tr('מה מגיע אליי לטלפון') }),
});

/** The kinds a person may switch here: the notice board and tickets only while their module is on. */
const shown = (m: NotifyMe) => m.categories.filter((c) => !c.critical && (c.id !== 'building' || has('notices')) && (c.id !== 'tickets' || has('tickets')));

registerScreen((h: HomeHost) => ({
  id: 'p2notif',
  names: ['notif'],
  enter: () => { warmFamily(h); load(h, true); warmAlarmPin(h); },
  render() {
    const m = st.me;
    if (!m) return html`${h.head(tr('ההתראות שלי'), '')}${st.error ? h.empty('x', tr('לא הצלחנו לטעון'), st.error) : h.empty('bell', tr('טוענים…'), '')}`;
    const cats = shown(m).slice(0, h.phone ? 6 : 8);
    const noPhone = m.phones === 0;
    const d = m.dnd;
    return html`${h.head(tr('ההתראות שלי'), noPhone ? tr('עוד אין טלפון מחובר. כשתחברו את האפליקציה, תוכלו לבחור כאן מה יגיע אליו.') : tr('מה מגיע אליי לטלפון. כל אחד בבית בוחר לעצמו.'))}
      <div class="nf-body"><section class="set-list two nf-list" aria-label="${tr('סוגי התראות')}">${cats.map((c) => html`<div class="tile setrow"><span class="sname">${c.name}${c.partly ? html`<span class="muted clamp1">${tr('רק בחלק מהטלפונים')}</span>` : nothing}</span>${sw(c.on, 'p2NfTog', c.name, { id: c.id }, noPhone || st.busy)}</div>`)}</section>
        <section class="set-list two" aria-label="${tr('לא להפריע')}"><div class="tile setrow"><span class="sname"><b>${tr('לא להפריע בלילה')}</b><span class="muted clamp1">${tr('בין')} <span class="num">${d.start}</span> ${tr('ל-')}<span class="num">${d.end}</span> ${tr('רק אזעקה ודלת מגיעות')}</span></span>${sw(d.enabled, 'p2Dnd', tr('לא להפריע בלילה'), {}, st.busy)}</div>
          ${d.enabled ? (h.phone
            // HOME-V3-GAPS-2436: on a phone the two hours did not fit one row (the end hour was cut off): one row each
            ? html`<div class="tile setrow"><span class="sname">${tr('משעה')}</span>${stepper('p2DndStp', 'start', toMin(d.start), tr('משעה'))}</div><div class="tile setrow"><span class="sname">${tr('עד שעה')}</span>${stepper('p2DndStp', 'end', toMin(d.end), tr('עד שעה'))}</div>`
            : html`<div class="tile setrow"><span class="sname">${tr('משעה')}</span>${stepper('p2DndStp', 'start', toMin(d.start), tr('משעה'))}<span class="sname mid-l">${tr('עד שעה')}</span>${stepper('p2DndStp', 'end', toMin(d.end), tr('עד שעה'))}</div>`) : nothing}${alarmPinRow(h)}</section></div>`;
  },
  acts: {
    p2NfTog: (el) => {
      const m = st.me;
      if (!m) return;
      const c = m.categories.find((x) => x.id === el.dataset.id);
      if (!c || c.critical) return;
      c.on = !c.on;
      c.partly = false;
      h.requestUpdate();
      save(h, { muted: m.categories.filter((x) => !x.on).map((x) => x.id) }, c.on ? tr('{name}: יגיע לטלפון', { name: c.name }) : tr('{name}: לא יגיע לטלפון', { name: c.name }));
    },
    p2Dnd: () => {
      const m = st.me;
      if (!m) return;
      m.dnd.enabled = !m.dnd.enabled;
      h.requestUpdate();
      save(h, { dnd: { enabled: m.dnd.enabled } }, m.dnd.enabled ? tr('מצב "לא להפריע" בלילה פועל') : tr('מצב "לא להפריע" כבוי'));
    },
    p2DndStp: (el) => {
      const m = st.me;
      if (!m) return;
      const k = el.dataset.k as 'start' | 'end';
      const other = k === 'start' ? m.dnd.end : m.dnd.start;
      let v = (toMin(m.dnd[k]) + 30 * Number(el.dataset.d) + 1440) % 1440;
      if (toHm(v) === other) v = (v + 30 * Number(el.dataset.d) + 1440) % 1440;
      m.dnd[k] = toHm(v);
      h.requestUpdate();
      save(h, { dnd: { start: m.dnd.start, end: m.dnd.end } }, tr('השעות נשמרו'));
    },
  },
}));

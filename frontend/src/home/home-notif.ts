// HOME-V3-P2-2431: "ההתראות שלי" and "לא להפריע בלילה" (mockup v3 `S.notif`): what reaches the person's own phones, per kind, and the
// person's own night window (GET / PUT /home/notify). Muting reaches every one of the person's own phones; a safety notification is
// never muted. During the night window only the alarm, the doors and anything critical come through. Each person chooses for themself.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { registerMoreTile } from './more-registry';
import { getNotify, putNotify, type NotifyMe } from './home-p2-api';
import { errText, has, stepper, sw, warmFamily } from './home-p2-ui';

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
  id: 'notif', order: 90, href: 'notif', label: 'ההתראות שלי', icon: 'bell',
  visible: () => has('notif'),
  warm: (h) => load(h),
  line: () => ({ text: st.me?.dnd.enabled ? 'מצב "לא להפריע" פועל' : 'מה מגיע אליי לטלפון' }),
});

/** The kinds a person may switch here: the notice board and tickets only while their module is on. */
const shown = (m: NotifyMe) => m.categories.filter((c) => !c.critical && (c.id !== 'building' || has('notices')) && (c.id !== 'tickets' || has('tickets')));

registerScreen((h: HomeHost) => ({
  id: 'p2notif',
  names: ['notif'],
  enter: () => { warmFamily(h); load(h, true); },
  render() {
    const m = st.me;
    if (!m) return html`${h.head('ההתראות שלי', '')}${st.error ? h.empty('x', 'לא הצלחנו לטעון', st.error) : h.empty('bell', 'טוענים…', '')}`;
    const cats = shown(m).slice(0, h.phone ? 6 : 8);
    const noPhone = m.phones === 0;
    const d = m.dnd;
    return html`${h.head('ההתראות שלי', noPhone ? 'עוד אין טלפון מחובר. כשתחברו את האפליקציה, תוכלו לבחור כאן מה יגיע אליו.' : 'מה מגיע אליי לטלפון. כל אחד בבית בוחר לעצמו.')}
      <div class="nf-body"><section class="set-list two nf-list" aria-label="סוגי התראות">${cats.map((c) => html`<div class="tile setrow"><span class="sname">${c.name}${c.partly ? html`<span class="muted clamp1">רק בחלק מהטלפונים</span>` : nothing}</span>${sw(c.on, 'p2NfTog', c.name, { id: c.id }, noPhone || st.busy)}</div>`)}</section>
        <section class="set-list two" aria-label="לא להפריע"><div class="tile setrow"><span class="sname"><b>לא להפריע בלילה</b><span class="muted clamp1">בין <span class="num">${d.start}</span> ל-<span class="num">${d.end}</span> רק אזעקה ודלת מגיעות</span></span>${sw(d.enabled, 'p2Dnd', 'לא להפריע בלילה', {}, st.busy)}</div>
          ${d.enabled ? html`<div class="tile setrow"><span class="sname">משעה</span>${stepper('p2DndStp', 'start', toMin(d.start), 'משעה')}<span class="sname mid-l">עד שעה</span>${stepper('p2DndStp', 'end', toMin(d.end), 'עד שעה')}</div>` : nothing}</section></div>`;
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
      save(h, { muted: m.categories.filter((x) => !x.on).map((x) => x.id) }, c.on ? `${c.name}: יגיע לטלפון` : `${c.name}: לא יגיע לטלפון`);
    },
    p2Dnd: () => {
      const m = st.me;
      if (!m) return;
      m.dnd.enabled = !m.dnd.enabled;
      h.requestUpdate();
      save(h, { dnd: { enabled: m.dnd.enabled } }, m.dnd.enabled ? 'מצב "לא להפריע" בלילה פועל' : 'מצב "לא להפריע" כבוי');
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
      save(h, { dnd: { start: m.dnd.start, end: m.dnd.end } }, 'השעות נשמרו');
    },
  },
}));

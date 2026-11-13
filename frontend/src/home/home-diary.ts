// HOME-V3-P1-2430: the home diary ("יומן הבית", mockup v3 `S.events`): what happened at home in simple words - movement and people at
// the cameras, doors, the doorbell - newest first, paged, with "watch the recording" where the person may play it. Existing routes only:
// GET /events (read-only for a home-only person) and GET /intercom/calls. Technical events (system, storage, coverage) stay in the full
// interface; rules, review and search are not offered here.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { relTime } from './home-api';
import { registerMoreTile } from './more-registry';
import { listEvents } from '../api/events';
import { getCallLog } from '../api/intercom-calls';
import { canAnywhere } from '../api/session';
import { diaryWord } from './home-v3-words';
import { playbackHref } from './home-recordings';
import { alarmChangeText, alarmLogOk, getAlarmLog } from './home-gaps-alarm'; // HOME-V3-GAPS-2436: the "אזעקה" filter

interface Row { id: string; at: string; text: string; icon: string; kind: 'cam' | 'door' | 'alarm'; cam: string | null; panel?: string }

const st: { rows: Row[]; tab: 'all' | 'cam' | 'door' | 'alarm'; loaded: boolean; loading: boolean; error: string; at: number; alarm: boolean } = { rows: [], tab: 'all', alarm: false, loaded: false, loading: false, error: '', at: 0 };

// HOME-V3-FOLLOWUP-A-2431 (owner answer 1): the house log is its own category of the per-person list
export const diaryOk = (h: HomeHost) => h.d.modules.has('log') && (canAnywhere('events.read') || (h.d.modules.has('doors') && canAnywhere('access.read')));

async function load(h: HomeHost, force = false) {
  if (st.loading || (!force && st.loaded && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const to = new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const [evs, calls, alarm] = await Promise.all([
    canAnywhere('events.read') ? listEvents({ from, to, limit: 200 }).then((r) => r.events).catch(() => null) : Promise.resolve([]),
    h.d.modules.has('doors') && canAnywhere('access.read') ? getCallLog(null, 40).then((p) => p.calls).catch(() => []) : Promise.resolve([]),
    alarmLogOk(h) ? getAlarmLog().then((r) => r.items).catch(() => []) : Promise.resolve([]),
  ]);
  const rows: Row[] = [];
  for (const e of evs ?? []) {
    const w = diaryWord(e.type, e.camera_name ?? null);
    if (w) rows.push({ id: 'e' + e.id, at: e.occurred_at, text: w.text, icon: w.icon, kind: w.kind, cam: e.camera_id });
  }
  for (const c of calls) rows.push({ id: 'c' + c.id, at: c.rang_at, text: `צלצול ב${c.station_name || 'כניסה'}`, icon: 'bell', kind: 'door', cam: null });
  for (const a of alarm) rows.push({ id: 'a' + a.panel + a.at, at: a.at, text: alarmChangeText(a), icon: 'shield', kind: 'alarm', cam: null, panel: a.panel });
  st.alarm = alarm.length > 0;
  rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  st.rows = rows;
  st.error = evs === null && !calls.length ? 'לא הצלחנו לטעון את היומן. נסו שוב בעוד רגע.' : '';
  st.loaded = true;
  st.loading = false;
  st.at = Date.now();
  h.requestUpdate();
}

const todayCount = () => {
  const d = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  return st.rows.filter((r) => new Date(r.at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }) === d).length;
};

registerMoreTile({
  id: 'events',
  order: 20,
  href: 'events',
  label: 'יומן הבית',
  icon: 'list',
  visible: (h) => diaryOk(h),
  warm: (h) => void load(h),
  line: () => {
    if (!st.loaded) return { text: 'מה קרה בבית' };
    const n = todayCount();
    return { text: n === 0 ? 'שקט היום' : n === 1 ? 'אירוע אחד היום' : `${n} אירועים היום` };
  },
});

registerScreen((h: HomeHost) => ({
  id: 'diary',
  names: ['events'],
  enter() {
    void load(h, true);
  },
  acts: {
    evTab(el) {
      st.tab = (el.dataset.v as typeof st.tab) ?? 'all';
      h.page = { ...h.page, ev: 0 };
      h.requestUpdate();
    },
    evWatch(el) {
      h.go(playbackHref(el.dataset.cam ?? '', new Date(Date.parse(el.dataset.at ?? '') - 5000)));
    },
  },
  render() {
    if (!diaryOk(h)) return html`${h.head('יומן הבית', '')}${h.empty('lock', 'המסך הזה לא זמין', 'מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.')}`;
    const list = st.rows.filter((r) => st.tab === 'all' || r.kind === st.tab);
    const pg = paged(list, h.phone ? 5 : 8, h.pg('ev'));
    const n = todayCount();
    const watch = h.recOk();
    // HOME-V3-GAPS-2436: "אזעקה" (mockup) when the person may view an alarm and the alarm category is on
    const showAlarm = alarmLogOk(h) && (st.alarm || h.panels.length > 0);
    if (!showAlarm && st.tab === 'alarm') st.tab = 'all';
    const tabs = h.seg('evTab', [['all', 'הכל'], ['door', 'דלתות'], ['cam', 'מצלמות'], ...(showAlarm ? [['alarm', 'אזעקה'] as [string, string]] : [])], st.tab, 'סינון');
    const panelName = (id?: string) => (h.panels.length > 1 ? h.panels.find((p) => p.entity_id === id)?.name ?? '' : '');
    const sub = !st.loaded ? '' : n ? (n === 1 ? 'אירוע אחד היום' : `${n} אירועים היום`) : 'לא קרה שום דבר מיוחד היום';
    return html`${h.headT('יומן הבית', sub, tabs, h.pager('ev', pg.pages))}
      <div class="card-grid evg">${!st.loaded ? html`<div class="empty loading" aria-busy="true">${hi('list')}<h2>טוענים…</h2></div>` : st.error ? h.empty('list', 'היומן לא זמין כרגע', st.error) : pg.items.length ? pg.items.map((e) => html`<div class="tile evrow" data-diary=${e.kind}><span class="ai">${hi(e.icon)}</span><span class="at"><b class="clamp2">${e.text}</b><span class="muted num-r">${relTime(e.at)}${e.kind === 'alarm' && panelName(e.panel) ? ' · ' + panelName(e.panel) : ''}</span></span>${e.cam && watch ? html`<button class="rb" data-act="evWatch" data-cam=${e.cam} data-at=${e.at} aria-label="צפה בהקלטה">${hi('play')}</button>` : nothing}</div>`) : h.empty('list', 'אין אירועים להצגה', 'כשמשהו יקרה בבית, דלת שנפתחה או תנועה במצלמה, הוא יופיע כאן.')}</div>`;
  },
}));

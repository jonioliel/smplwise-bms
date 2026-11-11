// HOME-V3-P2-2431: "תזמונים" (mockup v3 `S.schedules`, sheet `schNew`). Owner decision (round 27 q10): a family member can run, pause
// and create a schedule of a SCENE - never of a single device. GET /home/schedules lists only the schedules whose every action runs
// one scene; POST /home/schedules creates one (the schedules module's own create, with its permission and checks); enable / disable /
// run are the module's own operations. A person without schedule.manage sees the list read-only. Pages, never scrolls.
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { httpAutomations, type Item } from '../api/automations';
import { ApiError } from '../api/client';
import { newSceneSchedule, rid, sceneScheduleOp, sceneSchedules, type SceneSchedule } from './home-p2-api';
import { DAY_KEY, DAY_LETTER, canManageSchedules, errText, has, plural, stepper, sw, warmFamily } from './home-p2-ui';

interface Scene { entity: string; name: string }
const st: { items: SceneSchedule[]; scenes: Scene[]; canCreate: boolean; at: number; loading: boolean; error: string; busy: boolean; draft: { scene: string; at: number; days: number[]; crid: string } } =
  { items: [], scenes: [], canCreate: false, at: 0, loading: false, error: '', busy: false, draft: { scene: '', at: 420, days: [0, 1, 2, 3, 4], crid: '' } };

function load(h: HomeHost, force = false) {
  if (!has('schedules') || st.loading || (!force && st.at && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  void Promise.all([
    sceneSchedules(),
    httpAutomations.list({ kind: 'scene', limit: 200 } as never).then((r) => r.items.filter((s: Item) => !s.hidden && s.entity_id && s.can.run).map((s: Item) => ({ entity: s.entity_id as string, name: s.name }))).catch(() => [] as Scene[]),
  ]).then(([r, scenes]) => { st.items = r.items; st.canCreate = r.can_create; st.scenes = scenes; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

const sceneName = (e: string) => st.scenes.find((s) => s.entity === e)?.name ?? e.replace(/^scene\./, '');

/** "כל יום, 23:30" / "א׳, ג׳, ה׳, 06:45" / "בשקיעה" */
function whenOf(s: SceneSchedule): string {
  const d = s.days as { kind?: string; days?: string[] | null } | null;
  const days = d?.kind === 'daily' || !d?.days?.length ? 'כל יום' : d.days.length === 7 ? 'כל יום' : d.days.map((k) => DAY_LETTER[DAY_KEY.indexOf(k)] ?? '').filter(Boolean).join(', ');
  const t = s.slots[0]?.start;
  const at = !t ? '' : t.kind === 'fixed' ? t.time ?? '' : t.event === 'sunset' ? 'בשקיעה' : t.event === 'sunrise' ? 'בזריחה' : '';
  return [days, at].filter(Boolean).join(', ');
}

registerMoreTile({
  id: 'schedules', order: 80, href: 'schedules', label: 'תזמונים', icon: 'clock',
  visible: () => has('schedules'),
  warm: (h) => load(h),
  line: () => { const n = st.items.filter((s) => s.enabled).length; return { text: !st.items.length ? 'עוד אין תזמונים' : plural(n, 'תזמון אחד פעיל', 'תזמונים פעילים') }; },
});

/** Opens the new-schedule sheet (also from the scenes screen). */
export function openNewSchedule(h: HomeHost) {
  load(h);
  st.draft = { scene: st.scenes[0]?.entity ?? '', at: 420, days: [0, 1, 2, 3, 4], crid: rid() };
  h.ovl = { type: 'ext', mod: 'p2sched', kind: 'new' } as ExtOvl;
}

function op(h: HomeHost, s: SceneSchedule, what: 'enable' | 'disable' | 'run', confirm = false) {
  void sceneScheduleOp(s.id, what, confirm).then(() => {
    h.toast(what === 'run' ? `${s.name}: הופעל עכשיו` : what === 'enable' ? `${s.name}: פועל` : `${s.name}: מושהה`);
    load(h, true);
  }).catch((e) => {
    if (e instanceof ApiError && what === 'run' && /confirm/.test(e.code)) {
      h.ovl = { type: 'ask', title: `להפעיל עכשיו את ${s.name}?`, text: 'התזמון יפעיל את הסצנה מיד.', yes: 'כן, הפעל', run: () => op(h, s, 'run', true) };
      return;
    }
    if (what !== 'run') s.enabled = what === 'disable';
    h.toast(errText(e));
    h.requestUpdate();
  });
}

registerScreen((h: HomeHost) => ({
  id: 'p2sched',
  names: ['schedules'],
  enter: () => { warmFamily(h); load(h, true); },
  render() {
    if (!has('schedules')) return html`${h.head('תזמונים', '')}${h.empty('lock', 'המסך הזה לא זמין', 'מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.')}`;
    if (st.error && !st.at) return html`${h.head('תזמונים', '')}${h.empty('x', 'לא הצלחנו לטעון את התזמונים', st.error)}`;
    const can = st.canCreate && canManageSchedules() && !h.kioskLocked();
    const n = st.items.filter((s) => s.enabled).length;
    const pg = paged(st.items, h.phone ? 4 : 8, h.pg('sch'));
    return html`${h.head('תזמונים', !st.items.length ? 'סצנות שקורות מעצמן, בשעה קבועה' : plural(n, 'תזמון אחד פעיל', 'תזמונים פעילים'),
      html`${h.pager('sch', pg.pages)}${can && st.scenes.length ? html`<button class="hbtn strong" data-act="p2SchNew">${hi('plus')}<span class="bt">תזמון חדש</span></button>` : nothing}`)}
      <div class="card-grid schg">${pg.items.length ? pg.items.map((s) => html`<div class=${'tile srow' + (s.enabled ? '' : ' offr')}><span class="ai">${hi('scenes')}</span><span class="at"><b class="clamp1">${s.name}</b><span class="muted clamp1 num-r">${whenOf(s)}</span><span class="muted clamp1 what">מפעיל את סצנת ${sceneName(s.scene)}</span></span>
        <span class="row-acts">${can ? html`<button class="rb" data-act="p2SchRun" data-id=${s.id} aria-label=${'הפעל עכשיו: ' + s.name}>${hi('play')}</button>` : nothing}${sw(s.enabled, 'p2SchTog', s.name, { id: s.id }, !can)}</span></div>`)
        : h.empty('clock', st.loading ? 'טוענים…' : 'עוד אין תזמונים', can ? 'למשל: להפעיל את סצנת הבוקר כל יום ב-06:45.' : 'מנהל הבית יכול להגדיר תזמונים של סצנות.')}</div>`;
  },
  ovl() {
    const dr = st.draft;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="תזמון חדש" data-sheet="schNew"><header class="menu-h">${hi('clock')}<span class="mh-t"><b>תזמון חדש</b><span class="muted">סצנה שתופעל מעצמה</span></span><button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button></header>
      <div class="setrow flat"><span class="sname">מה להפעיל</span><div class="chipset tight">${st.scenes.slice(0, 6).map((s) => html`<button class="chip2" data-act="p2SchScene" data-v=${s.entity} aria-pressed=${String(dr.scene === s.entity)}><span class="clamp1">${s.name}</span></button>`)}</div></div>
      <div class="setrow flat"><span class="sname">בשעה</span>${stepper('p2SchStp', 'at', dr.at, 'שעה')}</div>
      <div class="setrow flat"><span class="sname">באילו ימים</span><div class="week mini">${DAY_LETTER.map((l, i) => html`<button class="wd" data-act="p2SchDay" data-v=${String(i)} aria-pressed=${String(dr.days.includes(i))}><b>${l}</b></button>`)}</div></div>
      <div class="dlg-acts"><button class="hbtn strong" data-act="p2SchSave" ?disabled=${st.busy || !dr.scene || !dr.days.length}>שמור</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
  },
  acts: {
    p2SchNew: () => openNewSchedule(h),
    p2SchScene: (el) => { st.draft.scene = el.dataset.v ?? ''; h.requestUpdate(); },
    p2SchStp: (el) => { st.draft.at = (st.draft.at + 15 * Number(el.dataset.d) + 1440) % 1440; h.requestUpdate(); },
    p2SchDay: (el) => {
      const i = Number(el.dataset.v);
      const d = st.draft.days;
      st.draft.days = d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort();
      h.requestUpdate();
    },
    p2SchSave: () => {
      const d = st.draft;
      const at = `${String(Math.floor(d.at / 60)).padStart(2, '0')}:${String(d.at % 60).padStart(2, '0')}`;
      st.busy = true;
      h.requestUpdate();
      void newSceneSchedule({ name: sceneName(d.scene), scene: d.scene, at, days: d.days.map((i) => DAY_KEY[i]), client_request_id: d.crid })
        .then(() => { h.ovl = null; h.page = { ...h.page, sch: 0 }; h.toast('התזמון נשמר'); load(h, true); })
        .catch((e) => h.toast(errText(e)))
        .finally(() => { st.busy = false; h.requestUpdate(); });
    },
    p2SchTog: (el) => {
      const s = st.items.find((x) => x.id === el.dataset.id);
      if (!s) return;
      s.enabled = !s.enabled;
      h.requestUpdate();
      op(h, s, s.enabled ? 'enable' : 'disable');
    },
    p2SchRun: (el) => { const s = st.items.find((x) => x.id === el.dataset.id); if (s) op(h, s, 'run'); },
  },
}));

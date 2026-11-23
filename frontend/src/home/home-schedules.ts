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
import { DAY_KEY, DAY_LETTER, canManageSchedules, errText, has, plural, stepper, sw, warmFamily, seen, offScreen } from './home-p2-ui';
import { tr } from '../i18n/msg/home';

/** `areas`: the scene's areas (MULTI-BUILDING-HOME-2500, Q67: a schedule shows under every building its scene serves) */
interface Scene { entity: string; name: string; areas: string[] }
const st: { items: SceneSchedule[]; scenes: Scene[]; canCreate: boolean; at: number; loading: boolean; error: string; busy: boolean; draft: { scene: string; at: number; days: number[]; crid: string } } =
  { items: [], scenes: [], canCreate: false, at: 0, loading: false, error: '', busy: false, draft: { scene: '', at: 420, days: [0, 1, 2, 3, 4], crid: '' } };

function load(h: HomeHost, force = false) {
  if (!has('schedules') || st.loading || (!force && st.at && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  void Promise.all([
    sceneSchedules(),
    httpAutomations.list({ kind: 'scene', limit: 200 } as never).then((r) => r.items.filter((s: Item) => !s.hidden && s.entity_id && s.can.run).map((s: Item) => ({ entity: s.entity_id as string, name: s.name, areas: s.areas.map((a) => a.id) }))).catch(() => [] as Scene[]),
  ]).then(([r, scenes]) => { st.items = r.items; st.canCreate = r.can_create; st.scenes = scenes; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

const sceneName = (e: string) => st.scenes.find((s) => s.entity === e)?.name ?? e.replace(/^scene\./, '');

/** "כל יום, 23:30" / "א׳, ג׳, ה׳, 06:45" / "בשקיעה" */
function whenOf(s: SceneSchedule): string {
  const d = s.days as { kind?: string; days?: string[] | null } | null;
  const days = d?.kind === 'daily' || !d?.days?.length ? tr('כל יום') : d.days.length === 7 ? tr('כל יום') : d.days.map((k) => DAY_LETTER[DAY_KEY.indexOf(k)] ?? '').filter(Boolean).join(', ');
  const t = s.slots[0]?.start;
  const at = !t ? '' : t.kind === 'fixed' ? t.time ?? '' : t.event === 'sunset' ? tr('בשקיעה') : t.event === 'sunrise' ? tr('בזריחה') : '';
  return [days, at].filter(Boolean).join(', ');
}

registerMoreTile({
  id: 'schedules', order: 80, href: 'schedules', label: tr('תזמונים'), icon: 'clock',
  visible: (h) => seen(h) && has('schedules'),
  warm: (h) => load(h),
  line: () => { const n = st.items.filter((s) => s.enabled).length; return { text: !st.items.length ? tr('עוד אין תזמונים') : plural(n, tr('תזמון אחד פעיל'), tr('תזמונים פעילים')) }; },
});

/** Opens the new-schedule sheet (also from the scenes screen). */
function openNewSchedule(h: HomeHost) {
  load(h);
  st.draft = { scene: st.scenes[0]?.entity ?? '', at: 420, days: [0, 1, 2, 3, 4], crid: rid() };
  h.ovl = { type: 'ext', mod: 'p2sched', kind: 'new' } as ExtOvl;
}

function op(h: HomeHost, s: SceneSchedule, what: 'enable' | 'disable' | 'run', confirm = false) {
  void sceneScheduleOp(s.id, what, confirm).then(() => {
    h.toast(what === 'run' ? tr('{name}: הופעל עכשיו', { name: s.name }) : what === 'enable' ? tr('{name}: פועל', { name: s.name }) : tr('{name}: מושהה', { name: s.name }));
    load(h, true);
  }).catch((e) => {
    if (e instanceof ApiError && what === 'run' && /confirm/.test(e.code)) {
      h.ovl = { type: 'ask', title: tr('להפעיל עכשיו את {name}?', { name: s.name }), text: tr('התזמון יפעיל את הסצנה מיד.'), yes: tr('כן, הפעל'), run: () => op(h, s, 'run', true) };
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
    if (!has('schedules')) return offScreen(h, tr('תזמונים'));
    if (!st.at && !st.loading && !st.error) load(h); // a deep link: the feature map arrived after enter()
    if (st.error && !st.at) return html`${h.head(tr('תזמונים'), '')}${h.empty('x', tr('לא הצלחנו לטעון את התזמונים'), st.error)}`;
    const can = st.canCreate && canManageSchedules() && !h.kioskLocked();
    // MULTI-BUILDING-HOME-2500 (Q67): on a multi-building site, the schedules whose scene serves the chosen building (a scene serving two
    // buildings shows in each, with "גם ב...")
    const notes = new Map<string, string>();
    const items = st.items.filter((s) => {
      const b = h.bldOf(st.scenes.find((x) => x.entity === s.scene)?.areas ?? []);
      if (b.note) notes.set(s.id, b.note);
      return b.show;
    });
    const n = items.filter((s) => s.enabled).length;
    const pg = paged(items, h.phone ? 4 : 8, h.pg('sch'));
    return html`${h.head(tr('תזמונים'), !items.length ? tr('סצנות שקורות מעצמן, בשעה קבועה') : plural(n, tr('תזמון אחד פעיל'), tr('תזמונים פעילים')),
      html`${h.pager('sch', pg.pages)}${can && st.scenes.length ? html`<button class="hbtn strong" data-act="p2SchNew">${hi('plus')}<span class="bt">${tr('תזמון חדש')}</span></button>` : nothing}`)}
      <div class="card-grid schg">${pg.items.length ? pg.items.map((s) => html`<div class=${'tile srow' + (s.enabled ? '' : ' offr')}><span class="ai">${hi('scenes')}</span><span class="at"><b class="clamp1">${s.name}</b><span class="muted clamp1 num-r">${whenOf(s)}</span><span class="muted clamp1 what">${tr('מפעיל את סצנת')} ${sceneName(s.scene)}${notes.has(s.id) ? html` <span data-also>· ${notes.get(s.id)}</span>` : nothing}</span></span>
        <span class="row-acts">${can ? html`<button class="rb" data-act="p2SchRun" data-id=${s.id} aria-label=${tr('הפעל עכשיו: ') + s.name}>${hi('play')}</button>` : nothing}${sw(s.enabled, 'p2SchTog', s.name, { id: s.id }, !can)}</span></div>`)
        : h.empty('clock', st.loading ? tr('טוענים…') : tr('עוד אין תזמונים'), can ? tr('למשל: להפעיל את סצנת הבוקר כל יום ב-06:45.') : tr('מנהל הבית יכול להגדיר תזמונים של סצנות.'))}</div>`;
  },
  ovl() {
    const dr = st.draft;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="${tr('תזמון חדש')}" data-sheet="schNew"><header class="menu-h">${hi('clock')}<span class="mh-t"><b>${tr('תזמון חדש')}</b><span class="muted">${tr('סצנה שתופעל מעצמה')}</span></span><button class="rb" data-act="close" aria-label="${tr('סגור')}">${hi('x')}</button></header>
      <div class="setrow flat"><span class="sname">${tr('מה להפעיל')}</span><div class="chipset tight">${st.scenes.slice(0, 6).map((s) => html`<button class="chip2" data-act="p2SchScene" data-v=${s.entity} aria-pressed=${String(dr.scene === s.entity)}><span class="clamp1">${s.name}</span></button>`)}</div></div>
      <div class="setrow flat"><span class="sname">${tr('בשעה')}</span>${stepper('p2SchStp', 'at', dr.at, tr('שעה'))}</div>
      <div class="setrow flat"><span class="sname">${tr('באילו ימים')}</span><div class="week mini">${DAY_LETTER.map((l, i) => html`<button class="wd" data-act="p2SchDay" data-v=${String(i)} aria-pressed=${String(dr.days.includes(i))}><b>${l}</b></button>`)}</div></div>
      <div class="dlg-acts"><button class="hbtn strong" data-act="p2SchSave" ?disabled=${st.busy || !dr.scene || !dr.days.length}>${tr('שמור')}</button><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
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
        .then(() => { h.ovl = null; h.page = { ...h.page, sch: 0 }; h.toast(tr('התזמון נשמר')); load(h, true); })
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

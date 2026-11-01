import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-field';
import '../components/sw-dialog';
import '../components/sw-drawer';
import '../components/sw-state-panel';
import './wall-photo-sets';
import { describeError } from '../api/client';
import { loadTree } from '../api/catalog';
import { listCameras } from '../api/maps';
import {
  WALL_STATUS_LABEL,
  createWallProfile,
  listPhotoSets,
  listWallProfiles,
  patchWallProfile,
  removeWallProfile,
  wallCandidates,
  type PhotoSet,
  type WallConfig,
  type WallProfile,
  type WallWindow,
} from '../api/wall';
import { MAX_PER_PAGE } from '../wall/wall-logic';
import { FOLLOW_PLAN, type WallPlanSetting } from '../map/wall-plan-mode';
import { RUNG_HE } from '../map/quality-ladder';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsLadderStyles } from '../styles/settings';
import { dateInputLang } from '../api/day-format';

type CamLite = { id: string; name: string };
type FloorLite = { id: string; name: string };
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const STRIP_CHIPS: { id: string; label: string }[] = [
  { id: 'clock', label: 'שעון' },
  { id: 'date', label: 'תאריך' },
  { id: 'health', label: 'מצב המערכת' },
];
const ALERT_CATEGORIES: { id: string; label: string }[] = [
  { id: 'safety', label: 'בטיחות' },
  { id: 'alerts', label: 'התראות חוקים' },
  { id: 'doors', label: 'דלתות' },
  { id: 'device_faults', label: 'תקלות התקנים' },
  { id: 'security', label: 'אבטחה' },
];
const POLL_MS = 15_000;

/** CR-030 section 8: הגדרות › מסכי קיר. A list of wall users (a table on desktop, cards on a phone), an add dialog that
 * picks an existing user, and a drawer with the user's wall configuration. The drawer also holds the alert tile
 * filter and the picture-frame settings (WDX); the photo sets are managed in `sw-wall-photo-sets`. */
@customElement('system-wall')
export class SystemWall extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private profiles: WallProfile[] | null = null;
  @state() private max = 20;
  @state() private error = '';
  @state() private busy = false;
  @state() private adding = false;
  @state() private candidates: { id: string; username: string; display_name: string }[] = [];
  @state() private pick = '';
  @state() private addTitle = '';
  @state() private addFloor = '';
  @state() private floors: FloorLite[] = [];
  @state() private cameras: CamLite[] = [];
  @state() private editing: WallProfile | null = null;
  @state() private draft: { title: string; enabled: boolean; remote: boolean; config: WallConfig } | null = null;
  @state() private removing: WallProfile | null = null;
  @state() private photoSets: PhotoSet[] = [];
  @state() private managingPhotos = false;
  @state() private query = '';
  private poll = 0;

  static styles = [
    settingsLadderStyles,
    css`
      /* LOOK-POLISH-2331: the settings ladder (page > card > well) on the wall users page - the list sits in a card, the drawer's
         sections are headed groups, every toggle chip is a real keyboard control with its full name, and the hover stays with a
         pointer that hovers. Tokens only. */
      .toolbar { display: flex; gap: var(--sw-s-2) var(--sw-s-3); align-items: center; flex-wrap: wrap; margin-block-end: var(--sw-s-3); }
      .toolbar .grow { flex: 1; }
      .count { display: inline-flex; align-items: center; gap: 6px; min-block-size: 28px; padding: 2px 12px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); font-variant-numeric: tabular-nums; }
      .count.full { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
      .msg { display: inline-flex; align-items: center; gap: 6px; min-block-size: 28px; padding: 2px 12px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); max-inline-size: 100%; overflow-wrap: anywhere; }
      .msg.err { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
      .msg sw-icon { flex: none; }
      /* the list: a card with a quiet header row; the row is the unit (hover wash), the name leads */
      table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-base); }
      th { text-align: start; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); padding: 12px 16px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
      td { padding: 12px 16px; border-block-start: 1px solid var(--sw-border); vertical-align: middle; }
      tbody tr:first-child td { border-block-start: 0; }
      tbody tr { transition: background var(--sw-t-hover) var(--sw-ease-color); }
      @media (hover: hover) and (pointer: fine) { tbody tr:hover { background: var(--sw-hover-wash); } }
      .who { min-inline-size: 0; }
      .who b { display: block; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); overflow-wrap: anywhere; }
      .who span, .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .who span { direction: ltr; unicode-bidi: isolate; }
      .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .seen { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
      .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .cards { display: none; gap: var(--sw-s-3); }
      .card { display: grid; gap: var(--sw-s-2); }
      .card .row { display: flex; justify-content: space-between; gap: var(--sw-s-2); align-items: center; min-inline-size: 0; }
      .card .acts { justify-content: flex-start; padding-block-start: var(--sw-s-2); border-block-start: 1px solid var(--sw-border); }
      @media (max-width: 720px) { .table-card { display: none; } .cards { display: grid; } }
      /* the drawer: headed groups divided by a hairline; a setting line wraps its control under the label on a narrow drawer */
      .sec { display: grid; gap: var(--sw-s-2); padding-block: var(--sw-s-4); border-block-start: 1px solid var(--sw-border); }
      .sec:first-child { padding-block-start: 0; border-block-start: 0; }
      .sec h3 { margin: 0 0 2px; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); letter-spacing: -0.005em; }
      .line { display: flex; justify-content: space-between; gap: var(--sw-s-2) var(--sw-s-3); align-items: center; flex-wrap: wrap; min-block-size: 40px; }
      .line > span:first-child { flex: 1 1 160px; min-inline-size: 0; color: var(--sw-text); }
      .line sw-field { flex: 0 1 220px; min-inline-size: 160px; }
      .sub { font-weight: var(--sw-fw-semibold); color: var(--sw-text); padding-block-start: var(--sw-s-1); }
      .cams { display: grid; gap: 4px; }
      .cam { display: grid; grid-template-columns: auto auto 1fr auto; gap: var(--sw-s-2); align-items: center; min-block-size: 40px; padding: 2px 10px; border-radius: var(--sw-r-sm); background: var(--sw-well, var(--sw-surface-2)); }
      .cam.on { background: var(--sw-accent-soft); }
      .cam input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); }
      .cam .ord { min-inline-size: 22px; text-align: center; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold); color: var(--sw-accent-text); font-variant-numeric: tabular-nums; }
      .cam label { min-inline-size: 0; overflow-wrap: anywhere; cursor: pointer; }
      .cam .acts { gap: 2px; }
      .win { display: flex; gap: var(--sw-s-2); align-items: center; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--sw-r-sm); background: var(--sw-well, var(--sw-surface-2)); }
      .win sw-field { inline-size: 120px; }
      /* a toggle chip: the checkbox stays in the tab order (visually hidden), the chip carries its focus ring and its full name */
      .days, .chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .days label, .chips label { position: relative; display: inline-flex; align-items: center; justify-content: center; min-block-size: 36px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease); }
      .days label { inline-size: 36px; }
      .chips label { padding: 0 14px; }
      .days input, .chips input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
      .days label:has(input:checked), .chips label:has(input:checked) { background: var(--sw-accent-soft); color: var(--sw-accent-text); box-shadow: inset 0 0 0 1px var(--sw-accent); }
      .days label:has(input:focus-visible), .chips label:has(input:focus-visible) { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
      .days label:active, .chips label:active { transform: scale(var(--sw-press-scale)); }
      @media (hover: hover) and (pointer: fine) { .days label:hover:not(:has(input:checked)), .chips label:hover:not(:has(input:checked)) { background: var(--sw-hover-wash); color: var(--sw-text); } }
      @media (prefers-reduced-motion: reduce) { .days label, .chips label, tbody tr { transition-duration: 0ms; } }
      .warn { display: flex; align-items: center; gap: 6px; color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
      .confirm { margin: 0; line-height: 1.5; }
      input[type='text'], input[type='time'], input[type='search'] { font: inherit; color: inherit; background: transparent; border: 0; outline: 0; inline-size: 100%; }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    this.poll = window.setInterval(() => {
      if (!this.editing && !this.adding) void this.load(true);
    }, POLL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.poll);
  }

  private async load(quiet = false): Promise<void> {
    try {
      const r = await listWallProfiles();
      this.profiles = r.profiles;
      this.max = r.max_profiles;
      this.error = '';
    } catch (e) {
      if (!quiet || !this.profiles) this.error = describeError(e);
    }
  }

  private async openAdd(): Promise<void> {
    this.adding = true;
    this.pick = '';
    this.addTitle = '';
    this.addFloor = '';
    try {
      const [c, tree] = await Promise.all([wallCandidates(), loadTree()]);
      this.candidates = c.users;
      this.floors = tree.sites.flatMap((s) => ((s as unknown as { buildings?: { floors?: FloorLite[] }[] }).buildings ?? []).flatMap((b) => b.floors ?? []));
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async submitAdd(): Promise<void> {
    if (!this.pick || !this.addTitle.trim()) return;
    this.busy = true;
    try {
      const p = await createWallProfile({ user_id: this.pick, title: this.addTitle.trim(), floor_id: this.addFloor || null });
      this.adding = false;
      await this.load(true);
      await this.openDrawer(p);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async openDrawer(p: WallProfile): Promise<void> {
    if (!this.cameras.length) {
      try {
        this.cameras = (await listCameras()).cameras.map((c) => ({ id: c.id, name: c.alias || c.name }));
      } catch (e) {
        this.error = describeError(e);
      }
    }
    void this.loadPhotoSets();
    this.editing = p;
    const config = structuredClone(p.config);
    config.plan = { ...FOLLOW_PLAN, ...(config.plan ?? {}) }; // an answer from before the plan block reads as follow
    this.draft = { title: p.title, enabled: p.enabled, remote: p.remote_allowed, config };
  }

  private async loadPhotoSets(): Promise<void> {
    try {
      this.photoSets = (await listPhotoSets()).sets;
    } catch {
      this.photoSets = [];
    }
  }

  private async save(): Promise<void> {
    if (!this.editing || !this.draft) return;
    this.busy = true;
    try {
      await patchWallProfile(this.editing.user_id, { title: this.draft.title.trim() || this.editing.title, enabled: this.draft.enabled, remote_allowed: this.draft.remote, config: this.draft.config as unknown as Record<string, unknown> });
      this.editing = null;
      this.draft = null;
      await this.load(true);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async toggleEnabled(p: WallProfile): Promise<void> {
    try {
      await patchWallProfile(p.user_id, { enabled: !p.enabled });
      await this.load(true);
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async doRemove(): Promise<void> {
    if (!this.removing) return;
    this.busy = true;
    try {
      await removeWallProfile(this.removing.user_id);
      this.removing = null;
      await this.load(true);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  // ---- list
  private rel(iso: string | null): string {
    if (!iso) return '—';
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'הרגע';
    if (mins < 60) return `לפני ${mins} דק׳`;
    if (mins < 1440) return `לפני ${Math.round(mins / 60)} שע׳`;
    return `לפני ${Math.round(mins / 1440)} ימים`;
  }

  private statusBadge(p: WallProfile) {
    const kind = p.status === 'connected' ? 'live' : p.status === 'disabled' ? 'offline' : 'stale';
    const label = p.status === 'connected' && p.connections > 1 ? `${WALL_STATUS_LABEL.connected} · ${p.connections}` : WALL_STATUS_LABEL[p.status];
    return html`<sw-badge kind=${kind} label=${label}></sw-badge>`;
  }

  private cams(p: WallProfile): string {
    const names = p.camera_names;
    if (!names.length) return p.config.scope === 'floor' ? 'כל הקומה' : '0';
    return `${names.length} · ${names.slice(0, 2).join(', ')}`;
  }

  private actions(p: WallProfile) {
    return html`<span class="acts">
      <sw-button size="sm" icon="edit" data-wall-edit=${p.user_id} @click=${() => void this.openDrawer(p)}>עריכה</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-toggle=${p.user_id} @click=${() => void this.toggleEnabled(p)}>${p.enabled ? 'השבתה' : 'הפעלה'}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-wall-remove=${p.user_id} @click=${() => (this.removing = p)}>הסרה</sw-button>
    </span>`;
  }

  private seen(p: WallProfile) {
    return html`<span class="seen"><span class="num">${this.rel(p.last_seen_at)}</span>${p.last_channel === 'remote' ? html`<sw-badge kind="neutral" label="מרחוק"></sw-badge>` : nothing}</span>`;
  }

  private renderList() {
    const rows = this.profiles ?? [];
    if (!rows.length) {
      // LOOK-POLISH-2331: the empty state carries the first step itself (the toolbar button stays for the full list)
      // (the state panel is its own hero card since R5-SYSTEM-297: no sw-card around it, or the card would sit in a card)
      return html`<sw-state-panel data-wall-empty icon="grid" state="empty" heading="אין מסכי קיר" hint="משתמש מסך קיר הוא משתמש רגיל שמתחבר מטאבלט קבוע ורואה רק את המצלמות שנבחרו."
        actionLabel=${this.max > 0 ? 'הוספת משתמש מסך' : ''} @action=${() => void this.openAdd()}></sw-state-panel>`;
    }
    const overload = (p: WallProfile) => (p.config.cameras.length > MAX_PER_PAGE ? html`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס</div>` : nothing);
    return html`<sw-card flush class="table-card"><table data-wall-table>
        <thead><tr><th scope="col">משתמש</th><th scope="col">מצב</th><th scope="col">נראה לאחרונה</th><th scope="col">מצלמות</th><th scope="col">התראות</th><th scope="col"><span class="sr">פעולות</span></th></tr></thead>
        <tbody>${rows.map(
          (p) => html`<tr data-wall-row=${p.user_id}>
            <td class="who"><b>${p.title}</b><span>${p.username}</span></td>
            <td>${this.statusBadge(p)}</td>
            <td>${this.seen(p)}</td>
            <td><span class="num">${this.cams(p)}</span>${overload(p)}</td>
            <td>${p.config.alerts.enabled ? 'פעילות' : html`<span class="muted">כבויות</span>`}</td>
            <td>${this.actions(p)}</td>
          </tr>`,
        )}</tbody>
      </table></sw-card>
      <div class="cards">${rows.map(
        (p) => html`<sw-card class="card" data-wall-card=${p.user_id}>
          <div class="row"><span class="who"><b>${p.title}</b><span>${p.username}</span></span>${this.statusBadge(p)}</div>
          <div class="row"><span class="muted">${this.seen(p)}</span><span class="muted num">מצלמות: ${this.cams(p)}</span></div>
          ${overload(p)}
          ${this.actions(p)}
        </sw-card>`,
      )}</div>`;
  }

  // ---- add dialog
  private renderAdd() {
    if (!this.adding) return nothing;
    const q = this.query.trim().toLowerCase();
    const users = this.candidates.filter((u) => !q || `${u.display_name} ${u.username}`.toLowerCase().includes(q));
    return html`<sw-dialog open heading="הוספת משתמש מסך" data-wall-add @close=${() => (this.adding = false)}>
      <div class="sec">
        ${this.candidates.length
          ? html`<sw-field label="משתמש"><input type="search" placeholder="חיפוש" aria-label="חיפוש משתמש" .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} /></sw-field>
              <sw-field label="בחירת משתמש"><select data-wall-pick size="5" aria-label="משתמש" @change=${(e: Event) => (this.pick = (e.target as HTMLSelectElement).value)}>${users.map((u) => html`<option value=${u.id} ?selected=${u.id === this.pick}>${u.display_name} (${u.username})</option>`)}</select></sw-field>`
          : html`<p class="muted">אין משתמשים פנויים. משתמש נוצר בתשתית המערכת.</p>`}
        <sw-field label="כותרת המסך"><input type="text" maxlength="40" data-wall-title aria-label="כותרת" .value=${this.addTitle} @input=${(e: Event) => (this.addTitle = (e.target as HTMLInputElement).value)} /></sw-field>
        <sw-field label="מקום"><select data-wall-floor aria-label="מקום" @change=${(e: Event) => (this.addFloor = (e.target as HTMLSelectElement).value)}><option value="">מצלמות נבחרות בלבד</option>${this.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.addFloor}>כל הקומה: ${f.name}</option>`)}</select></sw-field>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.adding = false)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-add-submit ?disabled=${this.busy || !this.pick || !this.addTitle.trim()} @click=${() => void this.submitAdd()}>הוספה</sw-button>
    </sw-dialog>`;
  }

  // ---- drawer
  private cfg(): WallConfig {
    return this.draft!.config;
  }

  private moveCam(id: string, d: -1 | 1): void {
    const list = [...this.cfg().cameras];
    const i = list.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.cfg().cameras = list;
    this.requestUpdate();
  }

  private toggleCam(id: string, on: boolean): void {
    const c = this.cfg();
    c.cameras = on ? [...c.cameras.filter((x) => x !== id), id].slice(0, 12) : c.cameras.filter((x) => x !== id);
    this.requestUpdate();
  }

  private renderWindows() {
    const w = this.cfg().schedule.windows;
    const set = (i: number, patch: Partial<WallWindow>) => {
      this.cfg().schedule.windows = w.map((x, k) => (k === i ? { ...x, ...patch } : x));
      this.requestUpdate();
    };
    return html`${w.map(
      (x, i) => html`<div class="win" data-wall-window=${i}>
        <span class="days" role="group" aria-label="ימים">${DAYS.map((d, n) => html`<label><input type="checkbox" aria-label=${`יום ${d}`} .checked=${x.days.includes(n)} @change=${(e: Event) => set(i, { days: (e.target as HTMLInputElement).checked ? [...x.days, n].sort() : x.days.filter((v) => v !== n) })} /><span aria-hidden="true">${d}</span></label>`)}</span>
        <sw-field><input type="time" lang=${dateInputLang()} aria-label="משעה" .value=${x.from} @change=${(e: Event) => set(i, { from: (e.target as HTMLInputElement).value })} /></sw-field>
        <sw-field><input type="time" lang=${dateInputLang()} aria-label="עד שעה" .value=${x.to} @change=${(e: Event) => set(i, { to: (e.target as HTMLInputElement).value })} /></sw-field>
        <sw-button size="sm" variant="ghost" icon="trash" iconOnly label="הסרת חלון הערות" @click=${() => { this.cfg().schedule.windows = w.filter((_, k) => k !== i); this.requestUpdate(); }}></sw-button>
      </div>`,
    )}
    <span><sw-button size="sm" icon="plus" data-wall-add-window @click=${() => { this.cfg().schedule.windows = [...w, { days: [0, 1, 2, 3, 4], from: '07:00', to: '20:00' }]; this.requestUpdate(); }}>הוספת חלון ערות</sw-button></span>`;
  }

  private renderDrawer() {
    const p = this.editing;
    const d = this.draft;
    if (!p || !d) return nothing;
    const c = d.config;
    const sel = (label: string, value: string | number, opts: [string | number, string][], on: (v: string) => void, attr = '') =>
      html`<div class="line"><span>${label}</span><sw-field><select aria-label=${label} data-wall-field=${attr} @change=${(e: Event) => { on((e.target as HTMLSelectElement).value); this.requestUpdate(); }}>${opts.map(([v, l]) => html`<option value=${String(v)} ?selected=${String(v) === String(value)}>${l}</option>`)}</select></sw-field></div>`;
    const tog = (label: string, checked: boolean, on: (v: boolean) => void, attr = '') =>
      html`<div class="line"><span>${label}</span><sw-toggle label=${label} labelHidden .checked=${checked} data-wall-field=${attr} @change=${(e: CustomEvent<{ checked: boolean }>) => { on(e.detail.checked); this.requestUpdate(); }}></sw-toggle></div>`;
    // CR-029 S5-B: the map band of a portrait wall and how it draws the plan; each dial can follow the browser's pin / the installation
    const plan: WallPlanSetting = c.plan ?? (c.plan = { ...FOLLOW_PLAN });
    const FOLLOW_HE = 'כמו בהגדרות המערכת';
    const mapSection = html`<div class="sec" data-wall-section="map"><h3>מפה</h3>
        ${tog('להציג מפה (במסך לאורך)', c.show_map, (v) => (c.show_map = v), 'show-map')}
        ${c.show_map && !p.floor_id ? html`<div class="warn" data-wall-map-nofloor>למסך הזה אין קומה, ולכן המפה לא תוצג</div>` : nothing}
        ${c.show_map
          ? html`${sel('תצוגת התוכנית', plan.mode, [['follow', FOLLOW_HE], ['live', 'תלת־ממד חי'], ['stills', 'תמונות מוכנות']], (v) => (plan.mode = v as WallPlanSetting['mode']), 'plan-mode')}
              ${sel('איכות התלת־ממד', plan.quality, [['follow', FOLLOW_HE], ['auto', RUNG_HE.auto], ['realistic', RUNG_HE.realistic], ['lite', RUNG_HE.lite], ['full', RUNG_HE.full], ['schematic', RUNG_HE.schematic]], (v) => (plan.quality = v as WallPlanSetting['quality']), 'plan-quality')}
              ${sel('מעבר לתמונה מוכנה בלי מגע ובלי שינוי', plan.idle_s, [['follow', FOLLOW_HE], [0, 'לעולם לא'], [10, '10 שנ׳'], [30, '30 שנ׳'], [120, '2 דקות'], [600, '10 דקות']], (v) => (plan.idle_s = v === 'follow' ? 'follow' : (Number(v) as WallPlanSetting['idle_s'])), 'plan-idle')}`
          : nothing}
      </div>`;
    return html`<sw-drawer open modal heading=${p.title} subheading=${p.username} data-wall-drawer @close=${() => { this.editing = null; this.draft = null; }}>
      <div class="sec"><h3>משתמש</h3>
        <sw-field label="כותרת"><input type="text" maxlength="40" aria-label="כותרת" data-wall-field="title" .value=${d.title} @input=${(e: Event) => { d.title = (e.target as HTMLInputElement).value; }} /></sw-field>
        ${tog('פעיל', d.enabled, (v) => (d.enabled = v), 'enabled')}
        ${tog('גישה מרחוק', d.remote, (v) => (d.remote = v), 'remote')}
        <div class="muted">תפקיד: קיוסק (מפה ווידאו חי בלבד)</div>
      </div>
      <div class="sec"><h3>מצלמות ופריסה</h3>
        <div class="muted">${c.cameras.length ? `נבחרו ${c.cameras.length} מצלמות (עד 12); המספר הוא הסדר במסך` : 'לא נבחרו מצלמות'}</div>
        <div class="cams">${this.cameras.map((cam) => {
          const on = c.cameras.includes(cam.id);
          const i = c.cameras.indexOf(cam.id);
          const id = `wc-${cam.id}`;
          return html`<div class=${on ? 'cam on' : 'cam'} data-wall-cam=${cam.id}>
            <input type="checkbox" id=${id} aria-label=${cam.name} .checked=${on} @change=${(e: Event) => this.toggleCam(cam.id, (e.target as HTMLInputElement).checked)} />
            <span class="ord" aria-hidden="true">${on ? i + 1 : ''}</span>
            <label for=${id}>${cam.name}</label>
            <span class="acts">${on ? html`<sw-button size="sm" variant="ghost" icon="arrowUp" iconOnly label=${`הקדמה: ${cam.name}`} ?disabled=${i === 0} @click=${() => this.moveCam(cam.id, -1)}></sw-button><sw-button size="sm" variant="ghost" icon="arrowDown" iconOnly label=${`דחייה: ${cam.name}`} ?disabled=${i === c.cameras.length - 1} @click=${() => this.moveCam(cam.id, 1)}></sw-button>` : nothing}</span>
          </div>`;
        })}</div>
        ${c.cameras.length > MAX_PER_PAGE ? html`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס</div>` : nothing}
        ${sel('פריסה', c.layout, [['auto', 'אוטומטית'], ['tablet-landscape', 'טאבלט לרוחב'], ['tablet-portrait', 'טאבלט לאורך'], ['single', 'מצלמה אחת']], (v) => (c.layout = v as WallConfig['layout']), 'layout')}
        ${sel('דפדוף', c.rotate_s, [[0, 'אוטומטי'], [15, '15 שנ׳'], [30, '30 שנ׳'], [60, 'דקה'], [120, '2 דקות']], (v) => (c.rotate_s = Number(v) as WallConfig['rotate_s']), 'rotate')}
        ${sel('ערכה', c.theme, [['dark', 'כהה'], ['light', 'בהירה'], ['follow', 'כמו המערכת']], (v) => (c.theme = v as WallConfig['theme']), 'theme')}
        <div class="line"><span>שורת מצב</span><span class="chips" role="group" aria-label="שורת מצב">${STRIP_CHIPS.map((s) => html`<label><input type="checkbox" data-wall-strip=${s.id} .checked=${c.strip.includes(s.id)} @change=${(e: Event) => { c.strip = (e.target as HTMLInputElement).checked ? [...c.strip, s.id] : c.strip.filter((x) => x !== s.id); this.requestUpdate(); }} /><span>${s.label}</span></label>`)}</span></div>
        <sw-field label="ישויות בשורת המצב (עד 8, מופרדות בפסיק)"><input type="text" dir="ltr" data-wall-field="entities" .value=${c.state_entities.join(', ')} @change=${(e: Event) => { c.state_entities = (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8); this.requestUpdate(); }} /></sw-field>
      </div>
      ${mapSection}
      <div class="sec" data-wall-section="alerts"><h3>התראות במסך</h3>
        ${tog('להציג התראות', c.alerts.enabled, (v) => (c.alerts.enabled = v), 'alerts-enabled')}
        <div class="sub">קטגוריות</div>
        <span class="chips" role="group" aria-label="קטגוריות">${ALERT_CATEGORIES.map((k) => html`<label><input type="checkbox" data-wall-alert-cat=${k.id} .checked=${c.alerts.categories.includes(k.id)} @change=${(e: Event) => { c.alerts.categories = (e.target as HTMLInputElement).checked ? [...c.alerts.categories, k.id] : c.alerts.categories.filter((x) => x !== k.id); this.requestUpdate(); }} /><span>${k.label}</span></label>`)}</span>
        ${c.alerts.categories.length ? nothing : html`<div class="muted" data-wall-no-cat>לא נבחרה קטגוריה</div>`}
        ${sel('חומרה מינימלית', c.alerts.min_severity, [['info', 'מידע ומעלה'], ['alert', 'התראה ומעלה'], ['critical', 'קריטי בלבד']], (v) => (c.alerts.min_severity = v), 'alerts-min')}
        ${sel('התראה מתקפלת לשורת המצב אחרי', c.alerts.takeover_timeout_s, [[60, 'דקה'], [120, '2 דקות'], [300, '5 דקות'], [600, '10 דקות']], (v) => (c.alerts.takeover_timeout_s = Number(v)), 'alerts-timeout')}
        ${tog('אישור התראה מהמסך (לחיצה ארוכה)', c.alerts.ack_allowed, (v) => (c.alerts.ack_allowed = v), 'alerts-ack')}
        ${sel('להעיר מסך ישן בהתראה מחומרה', c.schedule.wake_on_alert_severity, [['critical', 'קריטית'], ['alert', 'התראה ומעלה']], (v) => (c.schedule.wake_on_alert_severity = v), 'alerts-wake')}
      </div>
      <div class="sec" data-wall-section="frame"><h3>מסגרת תמונות</h3>
        ${tog('מסגרת תמונות כשהמסך במנוחה', c.frame.enabled, (v) => (c.frame.enabled = v), 'frame-enabled')}
        ${sel('תיקיית תמונות', c.frame.folder ?? '', [['', 'ללא'], ...this.photoSets.map((x): [string, string] => [x.id, `${x.name} (${x.count})`])], (v) => (c.frame.folder = v || null), 'frame-folder')}
        ${c.frame.enabled && !c.frame.folder ? html`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>בחרו תיקייה כדי להפעיל את המסגרת</div>` : nothing}
        <span><sw-button size="sm" icon="image" data-wall-photos-open @click=${() => (this.managingPhotos = true)}>ניהול התמונות</sw-button></span>
        ${sel('מופיעה אחרי', c.frame.idle_min, [[5, '5 דק׳'], [10, '10 דק׳'], [30, '30 דק׳'], [60, 'שעה']], (v) => (c.frame.idle_min = Number(v)), 'frame-idle')}
        ${sel('החלפת תמונה כל', c.frame.interval_s, [[15, '15 שנ׳'], [30, '30 שנ׳'], [60, 'דקה'], [300, '5 דק׳']], (v) => (c.frame.interval_s = Number(v)), 'frame-interval')}
        ${sel('התאמה', c.frame.fit, [['contain', 'כל התמונה'], ['cover', 'מילוי המסך']], (v) => (c.frame.fit = v), 'frame-fit')}
        ${tog('שעון ותאריך', c.frame.clock, (v) => (c.frame.clock = v), 'frame-clock')}
        ${tog('תנועה איטית בתמונה', c.frame.motion === 'slow', (v) => (c.frame.motion = v ? 'slow' : 'none'), 'frame-motion')}
      </div>
      <div class="sec"><h3>שעות והגנה על המסך</h3>
        ${tog('הזזת פיקסלים', c.burn_in.shift, (v) => (c.burn_in.shift = v), 'shift')}
        ${sel('עמעום אחרי', c.burn_in.dim_after_min, [[0, 'לעולם לא'], [10, '10 דק׳'], [30, '30 דק׳'], [60, 'שעה']], (v) => (c.burn_in.dim_after_min = Number(v)), 'dim')}
        ${sel('ערבוב סדר כל', c.burn_in.shuffle_h, [[0, 'כבוי'], [1, 'שעה'], [6, '6 שעות']], (v) => (c.burn_in.shuffle_h = Number(v)), 'shuffle')}
        ${sel('וידאו תקוע - להציג כבוי אחרי', c.offline.show_last_frame_s, [[30, '30 שנ׳'], [60, 'דקה'], [120, '2 דקות']], (v) => (c.offline.show_last_frame_s = Number(v)), 'offline')}
        ${tog('נוגעים במסך מעירים אותו', c.schedule.wake_on_touch, (v) => (c.schedule.wake_on_touch = v), 'wake')}
        <div class="sub">חלונות ערות <span class="muted">(בלי חלון = תמיד פעיל)</span></div>${this.renderWindows()}
      </div>
      <sw-button slot="footer" variant="ghost" @click=${() => { this.editing = null; this.draft = null; }}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-save ?disabled=${this.busy} @click=${() => void this.save()}>שמירה</sw-button>
    </sw-drawer>`;
  }

  private renderRemove() {
    const p = this.removing;
    if (!p) return nothing;
    return html`<sw-dialog open heading="להסיר את מסך הקיר?" data-wall-remove-dialog @close=${() => (this.removing = null)}>
      <p class="confirm">הגישה של המשתמש ${p.username} תוסר והמסך יחזור למסך הכניסה.</p>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.removing = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="danger" data-wall-remove-confirm ?disabled=${this.busy} @click=${() => void this.doRemove()}>הסרה</sw-button>
    </sw-dialog>`;
  }

  protected render() {
    if (this.error && !this.profiles) {
      return html`<sw-page crumbs="הגדרות" heading="מסכי קיר"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    }
    const n = this.profiles?.length ?? 0;
    const full = n >= this.max;
    return html`<sw-page crumbs="הגדרות" heading="מסכי קיר">
      <div class="toolbar">
        <sw-button variant="primary" icon="plus" data-wall-add-open ?disabled=${full} @click=${() => void this.openAdd()}>הוספת משתמש מסך</sw-button>
        <sw-button icon="image" data-wall-photos-manage @click=${() => (this.managingPhotos = true)}>תמונות למסכי קיר</sw-button>
        <span class="grow"></span>
        ${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
        <span class=${full ? 'count full' : 'count'} data-wall-count title=${full ? 'הגעתם למספר המסכים המרבי' : ''}>${n} / ${this.max} מסכים</span>
      </div>
      ${this.profiles ? this.renderList() : html`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.renderAdd()}${this.renderDrawer()}${this.renderRemove()}
      <sw-wall-photo-sets ?open=${this.managingPhotos} @close=${() => (this.managingPhotos = false)} @sets-changed=${() => void this.loadPhotoSets()}></sw-wall-photo-sets>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wall': SystemWall;
  }
}

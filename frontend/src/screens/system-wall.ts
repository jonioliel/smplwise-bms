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
import { describeError } from '../api/client';
import { loadTree } from '../api/catalog';
import { listCameras } from '../api/maps';
import {
  WALL_STATUS_LABEL,
  createWallProfile,
  listWallProfiles,
  patchWallProfile,
  removeWallProfile,
  wallCandidates,
  type WallConfig,
  type WallProfile,
  type WallWindow,
} from '../api/wall';
import { MAX_PER_PAGE } from '../wall/wall-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type CamLite = { id: string; name: string };
type FloorLite = { id: string; name: string };
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const STRIP_CHIPS: { id: string; label: string }[] = [
  { id: 'clock', label: 'שעון' },
  { id: 'date', label: 'תאריך' },
  { id: 'health', label: 'מצב המערכת' },
];
const POLL_MS = 15_000;

/** CR-030 section 8: הגדרות › מסכי קיר. A list of wall users (a table on desktop, cards on a phone), an add dialog that
 * picks an existing user, and a drawer with the user's wall configuration. Alert tiles and the picture frame (WDX) are
 * stored by the server but not offered here yet. */
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
  @state() private query = '';
  private poll = 0;

  static styles = [
    css`
      .toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-block-end: 12px; }
      .toolbar .count { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
      table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
      th { text-align: start; color: var(--sw-text-3); font-weight: var(--sw-fw-medium, 500); padding: 8px 10px; }
      td { padding: 10px; border-block-start: 1px solid var(--sw-border); vertical-align: middle; }
      .who b { display: block; }
      .who span, .muted { color: var(--sw-text-3); direction: ltr; unicode-bidi: isolate; font-size: var(--sw-fs-xs); }
      .acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
      .cards { display: none; gap: 10px; }
      .card { padding: 12px; display: grid; gap: 8px; }
      .card .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
      @media (max-width: 720px) { table { display: none; } .cards { display: grid; } }
      .sec { display: grid; gap: 10px; margin-block-end: 18px; }
      .sec h3 { margin: 0; font-size: var(--sw-fs-md); }
      .line { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
      .cam { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 4px 0; }
      .win { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 6px 0; }
      .days { display: flex; gap: 4px; }
      .days label { display: inline-flex; align-items: center; justify-content: center; inline-size: 30px; block-size: 30px; border-radius: 50%; background: var(--sw-surface-3); cursor: pointer; font-size: var(--sw-fs-xs); }
      .days input { display: none; }
      .days input:checked + span { color: var(--sw-accent-text); font-weight: 700; }
      .days label:has(input:checked) { background: var(--sw-accent-soft); }
      .warn { color: var(--sw-stale-text); font-size: var(--sw-fs-xs); }
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
    this.editing = p;
    this.draft = { title: p.title, enabled: p.enabled, remote: p.remote_allowed, config: structuredClone(p.config) };
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
      <sw-button size="sm" data-wall-edit=${p.user_id} @click=${() => void this.openDrawer(p)}>עריכה</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-toggle=${p.user_id} @click=${() => void this.toggleEnabled(p)}>${p.enabled ? 'השבתה' : 'הפעלה'}</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-remove=${p.user_id} @click=${() => (this.removing = p)}>הסרה</sw-button>
    </span>`;
  }

  private renderList() {
    const rows = this.profiles ?? [];
    if (!rows.length) {
      return html`<sw-card data-wall-empty><sw-state-panel state="empty" heading="אין מסכי קיר" hint="משתמש מסך קיר הוא משתמש רגיל שמתחבר מטאבלט קבוע ורואה רק את המצלמות שנבחרו."></sw-state-panel></sw-card>`;
    }
    return html`<table data-wall-table>
        <thead><tr><th>משתמש</th><th>מצב</th><th>נראה לאחרונה</th><th>מצלמות</th><th>התראות</th><th></th></tr></thead>
        <tbody>${rows.map(
          (p) => html`<tr data-wall-row=${p.user_id}>
            <td class="who"><b>${p.title}</b><span>${p.username}</span></td>
            <td>${this.statusBadge(p)}</td>
            <td>${this.rel(p.last_seen_at)}${p.last_channel === 'remote' ? html` <sw-badge kind="neutral" label="מרחוק"></sw-badge>` : nothing}</td>
            <td>${this.cams(p)}${p.config.cameras.length > MAX_PER_PAGE ? html`<div class="warn">מעל ${MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס</div>` : nothing}</td>
            <td>${p.config.alerts.enabled ? 'פעילות' : 'כבויות'}</td>
            <td>${this.actions(p)}</td>
          </tr>`,
        )}</tbody>
      </table>
      <div class="cards">${rows.map(
        (p) => html`<sw-card class="card" data-wall-card=${p.user_id}>
          <div class="row"><span class="who"><b>${p.title}</b><span>${p.username}</span></span>${this.statusBadge(p)}</div>
          <div class="row"><span class="muted">${this.rel(p.last_seen_at)}</span><span>${this.cams(p)}</span></div>
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
        <span class="days">${DAYS.map((d, n) => html`<label><input type="checkbox" .checked=${x.days.includes(n)} @change=${(e: Event) => set(i, { days: (e.target as HTMLInputElement).checked ? [...x.days, n].sort() : x.days.filter((v) => v !== n) })} /><span>${d}</span></label>`)}</span>
        <sw-field><input type="time" aria-label="משעה" .value=${x.from} @change=${(e: Event) => set(i, { from: (e.target as HTMLInputElement).value })} /></sw-field>
        <sw-field><input type="time" aria-label="עד שעה" .value=${x.to} @change=${(e: Event) => set(i, { to: (e.target as HTMLInputElement).value })} /></sw-field>
        <sw-button size="sm" variant="ghost" @click=${() => { this.cfg().schedule.windows = w.filter((_, k) => k !== i); this.requestUpdate(); }}>הסרה</sw-button>
      </div>`,
    )}
    <sw-button size="sm" data-wall-add-window @click=${() => { this.cfg().schedule.windows = [...w, { days: [0, 1, 2, 3, 4], from: '07:00', to: '20:00' }]; this.requestUpdate(); }}>הוספת חלון ערות</sw-button>`;
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
    return html`<sw-drawer open modal heading=${p.title} subheading=${p.username} data-wall-drawer @close=${() => { this.editing = null; this.draft = null; }}>
      <div class="sec"><h3>משתמש</h3>
        <sw-field label="כותרת"><input type="text" maxlength="40" aria-label="כותרת" data-wall-field="title" .value=${d.title} @input=${(e: Event) => { d.title = (e.target as HTMLInputElement).value; }} /></sw-field>
        ${tog('פעיל', d.enabled, (v) => (d.enabled = v), 'enabled')}
        ${tog('גישה מרחוק', d.remote, (v) => (d.remote = v), 'remote')}
        <div class="muted">תפקיד: קיוסק (מפה ווידאו חי בלבד)</div>
      </div>
      <div class="sec"><h3>מצלמות ופריסה</h3>
        ${this.cameras.map((cam) => {
          const on = c.cameras.includes(cam.id);
          const i = c.cameras.indexOf(cam.id);
          return html`<div class="cam" data-wall-cam=${cam.id}>
            <input type="checkbox" aria-label=${cam.name} .checked=${on} @change=${(e: Event) => this.toggleCam(cam.id, (e.target as HTMLInputElement).checked)} />
            <span>${cam.name}</span>
            <span class="acts">${on ? html`<sw-button size="sm" variant="ghost" aria-label="הקדמה" ?disabled=${i === 0} @click=${() => this.moveCam(cam.id, -1)}>▲</sw-button><sw-button size="sm" variant="ghost" aria-label="דחייה" ?disabled=${i === c.cameras.length - 1} @click=${() => this.moveCam(cam.id, 1)}>▼</sw-button>` : nothing}</span>
          </div>`;
        })}
        ${c.cameras.length > MAX_PER_PAGE ? html`<div class="warn">מעל ${MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס</div>` : nothing}
        ${sel('פריסה', c.layout, [['auto', 'אוטומטית'], ['tablet-landscape', 'טאבלט לרוחב'], ['tablet-portrait', 'טאבלט לאורך'], ['single', 'מצלמה אחת']], (v) => (c.layout = v as WallConfig['layout']), 'layout')}
        ${sel('דפדוף', c.rotate_s, [[0, 'אוטומטי'], [15, '15 שנ׳'], [30, '30 שנ׳'], [60, 'דקה'], [120, '2 דקות']], (v) => (c.rotate_s = Number(v) as WallConfig['rotate_s']), 'rotate')}
        ${sel('ערכה', c.theme, [['dark', 'כהה'], ['light', 'בהירה'], ['follow', 'כמו המערכת']], (v) => (c.theme = v as WallConfig['theme']), 'theme')}
        <div class="line"><span>שורת מצב</span><span class="days">${STRIP_CHIPS.map((s) => html`<label title=${s.label}><input type="checkbox" .checked=${c.strip.includes(s.id)} @change=${(e: Event) => { c.strip = (e.target as HTMLInputElement).checked ? [...c.strip, s.id] : c.strip.filter((x) => x !== s.id); this.requestUpdate(); }} /><span>${s.label.slice(0, 2)}</span></label>`)}</span></div>
        <sw-field label="ישויות בשורת המצב (עד 8, מופרדות בפסיק)"><input type="text" dir="ltr" data-wall-field="entities" .value=${c.state_entities.join(', ')} @change=${(e: Event) => { c.state_entities = (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8); this.requestUpdate(); }} /></sw-field>
      </div>
      <div class="sec"><h3>שעות והגנה על המסך</h3>
        ${tog('הזזת פיקסלים', c.burn_in.shift, (v) => (c.burn_in.shift = v), 'shift')}
        ${sel('עמעום אחרי', c.burn_in.dim_after_min, [[0, 'לעולם לא'], [10, '10 דק׳'], [30, '30 דק׳'], [60, 'שעה']], (v) => (c.burn_in.dim_after_min = Number(v)), 'dim')}
        ${sel('ערבוב סדר כל', c.burn_in.shuffle_h, [[0, 'כבוי'], [1, 'שעה'], [6, '6 שעות']], (v) => (c.burn_in.shuffle_h = Number(v)), 'shuffle')}
        ${sel('וידאו תקוע - להציג כבוי אחרי', c.offline.show_last_frame_s, [[30, '30 שנ׳'], [60, 'דקה'], [120, '2 דקות']], (v) => (c.offline.show_last_frame_s = Number(v)), 'offline')}
        ${tog('נוגעים במסך מעירים אותו', c.schedule.wake_on_touch, (v) => (c.schedule.wake_on_touch = v), 'wake')}
        <div>חלונות ערות (בלי חלון = תמיד פעיל)</div>${this.renderWindows()}
      </div>
      <sw-button slot="footer" variant="ghost" @click=${() => { this.editing = null; this.draft = null; }}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-save ?disabled=${this.busy} @click=${() => void this.save()}>שמירה</sw-button>
    </sw-drawer>`;
  }

  private renderRemove() {
    const p = this.removing;
    if (!p) return nothing;
    return html`<sw-dialog open heading="להסיר את מסך הקיר?" data-wall-remove-dialog @close=${() => (this.removing = null)}>
      <p style="margin:0">הגישה של המשתמש ${p.username} תוסר והמסך יחזור למסך הכניסה.</p>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.removing = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="danger" data-wall-remove-confirm ?disabled=${this.busy} @click=${() => void this.doRemove()}>הסרה</sw-button>
    </sw-dialog>`;
  }

  protected render() {
    if (this.error && !this.profiles) {
      return html`<sw-page heading="מסכי קיר"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    }
    const n = this.profiles?.length ?? 0;
    return html`<sw-page heading="מסכי קיר">
      <div class="toolbar">
        <sw-button variant="primary" icon="plus" data-wall-add-open ?disabled=${n >= this.max} @click=${() => void this.openAdd()}>הוספת משתמש מסך</sw-button>
        <span class="count" data-wall-count>${n} מסכים</span>
        ${this.error ? html`<span class="warn" role="alert">${this.error}</span>` : nothing}
      </div>
      ${this.profiles ? this.renderList() : html`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.renderAdd()}${this.renderDrawer()}${this.renderRemove()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wall': SystemWall;
  }
}

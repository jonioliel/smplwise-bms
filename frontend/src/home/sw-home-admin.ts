// HOME-SIMPLE-2420: user management > "ממשק ביתי" - for each person: which interface opens, whether they may switch, home only
// (also enforced by the server), the wall-panel lock with its room, and which rooms / categories the home interface shows. Plus the
// wall panels' exit code and the starting favourites (the administrator's own favourites, copied for everyone who never edited theirs).
// rbac.assign (the role assigner's own permission); every change is audited by the server. Never touches the home system's users.
// HOME-SIMPLE-2421: three sub-tabs - people, the installation settings (default interface of new people, wall-panel exit, room
// wallpaper) and the switch classification (light / not a light / protected: the system suggests by name, the administrator approves;
// many at once, filtered by suggestion / class / room). The classification needs system.configure (its stores are Settings').
import { P3_MODULE_LABEL } from './home-p3-logic'; // HOME-V3-P3-2432
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api, apiUrl, describeError, get, post, put } from '../api/client';
import { GALLERY, galleryCss } from './home-wall';
import { getHomePrefs, getOverview, type HomeModule, type Interface, type Overview } from './home-api';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-view-switch';
import '../components/sw-tabs';
import '../components/sw-state-panel';

interface PolicyRow {
  user_id: string; username: string; display_name: string; source: string; system_admin: boolean;
  default_interface: Interface; may_switch: boolean; home_only: boolean; kiosk: boolean; kiosk_area_id: string | null;
  rooms: string[] | null; modules: HomeModule[] | null; configured: boolean; admin: boolean;
  /** HOME-V3-P1-2430: may invite a guest from the home interface; can_invite = holds the visitor-invite permission somewhere */
  guests?: boolean; can_invite?: boolean;
}
type SwitchClass = 'light' | 'not_light' | 'protected';
interface SwitchRow {
  entity_id: string; name: string; area_id: string | null; area_name: string | null; floor_name: string | null; state: string | null; available: boolean;
  class: SwitchClass; suggest: SwitchClass | null; suggest_reason: string | null; locked: string | null;
}
interface InstallSettings { default_mode: 'full_all' | 'home_regular' | 'choose'; kiosk_exit: 'code' | 'none'; wallpaper: 'none' | 'gallery' | 'gallery_image' }
const CLASS_LABEL: Record<SwitchClass, string> = { light: 'תאורה', not_light: 'לא תאורה', protected: 'מוגן' };
const LOCKED_LABEL: Record<string, string> = { alarm_managed: 'נשלט ממסך האזעקה', media_managed: 'נשלט ממסך המולטימדיה', doors_layer: 'בשכבת הדלתות' };
const PAGE = 20;

interface Policies { users: PolicyRow[]; modules: HomeModule[]; seed: Record<string, unknown[]>; kiosk_code_set: boolean }

const MODULE_LABEL: Record<HomeModule, string> = {
  lights: 'תאורה', climate: 'אקלים', shades: 'תריסים', doors: 'דלתות ואינטרקום', cameras: 'מצלמות', energy: 'חשמל', alerts: 'התראות', scenes: 'סצנות', security: 'אבטחה',
  ...P3_MODULE_LABEL, // HOME-V3-P3-2432
  presence: 'מי בבית', calendar: 'יומן וחדרים משותפים', notices: 'לוח הודעות', tickets: 'פניות שירות', schedules: 'תזמונים', // HOME-V3-P2-2431
};

@customElement('sw-home-admin')
export class SwHomeAdmin extends LitElement {
  static styles = css`
    /* HOME-V3-P1-2430: a room's wallpaper for everyone */
    .walls { display: flex; flex-wrap: wrap; gap: 8px; margin-block-start: 10px; }
    .wopt { display: grid; gap: 4px; justify-items: center; inline-size: 88px; padding: 6px; border: 1px solid var(--sw-border); border-radius: 10px; background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: 13px; cursor: pointer; min-block-size: 44px; }
    .wopt[aria-pressed="true"] { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
    .wpv { inline-size: 72px; block-size: 44px; border-radius: 6px; background: var(--sw-surface-2); }
    .up { display: inline-flex; align-items: center; min-block-size: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--sw-border); cursor: pointer; }

    :host { display: block; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: var(--sw-gap-lg, 20px); align-items: start; }
    @media (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg, 12px); padding: 12px; min-inline-size: 0; }
    .users { display: grid; gap: 2px; padding: 6px; }
    .u { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 44px; padding: 0 10px; border: 0; border-radius: var(--sw-r-md, 8px); background: none; color: var(--sw-text); font: inherit; text-align: start; cursor: pointer; }
    .u[aria-current='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .u b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .chip { font-size: var(--sw-fs-xs, 12px); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .chip.home { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    h3 { margin: 0 0 4px; font-size: var(--sw-fs-lg, 16px); color: var(--sw-heading); }
    .srow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding-block: 10px; border-block-start: 1px solid var(--sw-border); }
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-sm, 13px); }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border-block-start: 1px solid var(--sw-border); padding-block-start: 10px; }
    @media (max-width: 600px) { .cols { grid-template-columns: 1fr; } }
    .chk { display: flex; align-items: center; gap: 8px; min-block-size: 32px; font-size: var(--sw-fs-sm, 13px); }
    .chk input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    select, input[type='password'] { font: inherit; min-block-size: 36px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md, 8px); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; }
    .msg { margin-block: 8px; font-size: var(--sw-fs-sm, 13px); } .msg.err { color: var(--sw-danger); } .msg.ok { color: var(--sw-success); }
    .extra { display: grid; gap: 10px; margin-block-start: 16px; }
    .inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .subtabs { margin-block-end: 16px; }
    .opts { display: grid; gap: 6px; }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: var(--sw-r-md, 8px); cursor: pointer; }
    .opt:hover { background: var(--sw-surface-2); }
    .opt input { margin-block-start: 3px; accent-color: var(--sw-accent); inline-size: 16px; block-size: 16px; }
    .opt b { display: block; font-weight: 600; }
    .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-block-end: 10px; }
    .bulk { position: sticky; inset-block-start: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; margin-block-end: 8px;
      border-radius: var(--sw-r-md, 8px); background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .bulk[hidden] { display: none; }
    .bulk .count { font-weight: 600; margin-inline-end: auto; }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm, 13px); }
    th, td { text-align: start; padding: 8px 6px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; }
    th { color: var(--sw-text-3); font-weight: 600; font-size: var(--sw-fs-xs, 12px); }
    td.c { inline-size: 32px; }
    td input, th input { inline-size: 16px; block-size: 16px; accent-color: var(--sw-accent); }
    tr[aria-selected='true'] td { background: var(--sw-surface-2); }
    .cls { font-size: var(--sw-fs-xs, 12px); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .cls.light { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .cls.protected { background: var(--sw-surface-3, var(--sw-surface-2)); color: var(--sw-heading); font-weight: 600; }
    .sug { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .sug .why { color: var(--sw-text-3); font-size: var(--sw-fs-xs, 12px); }
    .pager { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-block-start: 8px; color: var(--sw-text-3); font-size: var(--sw-fs-sm, 13px); }
  `;

  @state() private data: Policies | null = null;
  @state() private rooms: Overview['rooms'] = [];
  @state() private sel = '';
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private code = '';
  @state() private sub: 'users' | 'install' | 'switches' = 'users';
  @state() private inst: InstallSettings | null = null;
  @state() private sw: SwitchRow[] | null = null;
  @state() private swError = '';
  @state() private swSel = new Set<string>();
  @state() private swFilter: 'all' | 'suggested' | SwitchClass = 'all';
  @state() private swArea = '';
  @state() private swPage = 0;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const [p, ov, st] = await Promise.all([get<Policies>('home/policies'), getOverview().catch(() => null), get<{ settings: InstallSettings }>('home/settings').catch(() => null)]);
      this.data = p;
      this.inst = st?.settings ?? null;
      this.rooms = ov?.rooms ?? [];
      if (!this.sel && p.users[0]) this.sel = p.users[0].user_id;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async save(u: PolicyRow, body: Record<string, unknown>) {
    this.busy = true;
    this.message = '';
    try {
      await put(`home/policies/${encodeURIComponent(u.user_id)}`, body);
      await this.load();
      this.message = 'נשמר.';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveCode() {
    try {
      const r = await put<{ kiosk_code_set: boolean }>('home/kiosk-code', { code: this.code || null });
      this.code = '';
      this.message = r.kiosk_code_set ? 'קוד היציאה של מסכי הקיר נשמר.' : 'קוד היציאה נמחק.';
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async seedFromMine() {
    try {
      const mine = await getHomePrefs();
      await put('home/seed', { seed: mine.favourites });
      this.message = 'המועדפים שלך נשמרו כמועדפי ההתחלה של כולם.';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async loadSwitches() {
    try {
      this.sw = (await get<{ switches: SwitchRow[] }>('home/switches')).switches;
      this.swError = '';
    } catch (err) {
      this.swError = describeError(err);
    }
  }

  private async saveInstall(patch: Partial<InstallSettings>) {
    this.message = '';
    try {
      this.inst = (await put<{ settings: InstallSettings }>('home/settings', patch)).settings;
      this.message = 'נשמר. משתמשים קיימים לא הושפעו.';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private swVisible(): SwitchRow[] {
    return (this.sw ?? []).filter((r) => (this.swFilter === 'all' ? true : this.swFilter === 'suggested' ? !!r.suggest : r.class === this.swFilter) && (!this.swArea || (r.area_id ?? '') === this.swArea));
  }

  private async mark(mark: SwitchClass, ids: string[]) {
    if (!ids.length) return;
    this.busy = true;
    this.message = '';
    try {
      const r = await post<{ changed: number; refused: number }>('home/switches', { entity_ids: ids, mark });
      this.message = `סומנו ${r.changed} כ"${CLASS_LABEL[mark]}".${r.refused ? ` ${r.refused} לא שונו (נשלטים ממסך אחר).` : ''}`;
      this.swSel = new Set();
      await this.loadSwitches();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async approveSelected() {
    const rows = (this.sw ?? []).filter((r) => this.swSel.has(r.entity_id) && r.suggest);
    for (const c of ['light', 'protected', 'not_light'] as SwitchClass[]) {
      const ids = rows.filter((r) => r.suggest === c).map((r) => r.entity_id);
      if (ids.length) await this.mark(c, ids);
    }
  }

  private installPane() {
    const i = this.inst;
    if (!i) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const opt = <K extends keyof InstallSettings>(k: K, v: InstallSettings[K], title: string, note: string) => html`<label class="opt"><input type="radio" name=${k} .checked=${i[k] === v} data-install=${`${k}:${v}`} @change=${() => this.saveInstall({ [k]: v } as Partial<InstallSettings>)}><span><b>${title}</b><span class="note">${note}</span></span></label>`;
    return html`<div class="grid">
      <section class="card" aria-label="ממשק למשתמשים חדשים"><h3>ממשק למשתמשים חדשים</h3><p class="note">חל רק על מי שעוד לא הוגדר. משתמשים קיימים נשארים עם מה שיש להם.</p><div class="opts">
        ${opt('default_mode', 'full_all', 'ממשק מלא לכולם', 'ברירת המחדל. כל אחד יכול לעבור לממשק הביתי מהתפריט האישי.')}
        ${opt('default_mode', 'home_regular', 'ביתי למשתמשים רגילים, מלא למנהלים', 'מנהל = מנהל מערכת או מי שרשאי להגדיר את המערכת.')}
        ${opt('default_mode', 'choose', 'בחירה בכניסה הראשונה', 'בכניסה הראשונה מוצג מסך בחירה בין שני הממשקים, והבחירה נשמרת.')}
      </div></section>
      <section class="card" aria-label="מסכי קיר ורקע"><h3>מסכי קיר</h3><div class="opts">
        ${opt('kiosk_exit', 'code', 'נעול, יציאה בקוד מנהל', 'ברירת המחדל. לחיצה ארוכה על השעון מבקשת את הקוד.')}
        ${opt('kiosk_exit', 'none', 'נעול לממשק הביתי ולחדר שלו, בלי יציאה', 'אין תפריט אישי ואין דרך לצאת מהמסך עצמו. משנים רק מכאן.')}
      </div>
      <h3 style="margin-block-start:16px">רקע לחדרים</h3><div class="opts">
        ${opt('wallpaper', 'none', 'בלי רקע', 'ברירת המחדל: מסך נקי.')}
        ${opt('wallpaper', 'gallery', 'גלריה מוכנה', 'כל משתמש בוחר רקע מעומעם לכל חדר מתוך גלריה מובנית.')}
        ${opt('wallpaper', 'gallery_image', 'גלריה ותמונה אישית', 'בנוסף אפשר להעלות תמונה לחדר (JPEG או PNG, עד 2 MB). התמונה נשמרת בשרת ונראית רק למי שהעלה אותה.')}
      </div></section>${this.roomWallPane()}</div>`;
  }

  // ---------------------------------------------------------------- HOME-V3-P1-2430: a room's wallpaper for everyone (owner decision 16b)

  @state() private walls: Record<string, string> | null = null;
  @state() private wallRoom = '';
  @state() private wallStamp = 0;

  private wallsLoading = false;

  private async loadWalls() {
    if (this.wallsLoading) return;
    this.wallsLoading = true;
    try {
      this.walls = (await get<{ walls: Record<string, string> }>('home/room-wallpapers')).walls;
    } catch {
      this.walls = {};
    }
    this.wallsLoading = false;
  }

  private async setWall(room: string, value: string) {
    this.busy = true;
    try {
      this.walls = (await put<{ walls: Record<string, string> }>(`home/room-wallpapers/${encodeURIComponent(room)}`, { value })).walls;
      this.message = 'הרקע נשמר';
    } catch (err) {
      this.message = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async uploadWall(room: string, e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type) || f.size > 2_000_000) { this.message = 'אפשר להעלות JPEG או PNG עד 2 MB.'; return; }
    const form = new FormData();
    form.append('file', f);
    try {
      this.walls = (await api<{ walls: Record<string, string> }>(`home/room-wallpapers/${encodeURIComponent(room)}/image`, { method: 'PUT', body: form })).walls;
      this.wallStamp = Date.now();
      this.message = 'התמונה נשמרה כרקע לכולם';
    } catch (err) {
      this.message = describeError(err);
    }
  }

  private roomWallPane() {
    const mode = this.inst?.wallpaper ?? 'none';
    if (mode === 'none') return nothing;
    if (this.walls == null) { void this.loadWalls(); return html`<section class="card"><sw-state-panel state="loading"></sw-state-panel></section>`; }
    const room = this.wallRoom || this.rooms[0]?.id || '';
    const cur = this.walls[room] ?? '';
    const opts: [string, string, string][] = [['', 'בלי רקע', ''], ...GALLERY.map((g) => ['g:' + g.id, g.name, galleryCss(g.id)] as [string, string, string])];
    return html`<section class="card" aria-label="רקע לחדר לכולם" data-home-room-walls><h3>רקע לחדר לכולם</h3><p class="note">למשל למסכי קיר. רקע שאדם בחר לעצמו גובר על זה, חוץ ממסך קיר: שם הרקע שנבחר כאן תמיד מוצג.</p>
      <div class="inline"><select aria-label="חדר" @change=${(e: Event) => { this.wallRoom = (e.target as HTMLSelectElement).value; }}>${this.rooms.map((r) => html`<option value=${r.id} ?selected=${r.id === room}>${r.name}${this.walls![r.id] ? ' ·' : ''}</option>`)}</select>
      ${mode === 'gallery_image' && room ? html`<label class="up"><input type="file" accept="image/jpeg,image/png" hidden data-home-room-wall-upload @change=${(e: Event) => this.uploadWall(room, e)}><span>${cur === 'img' ? 'החלפת התמונה' : 'תמונה לחדר'}</span></label>` : nothing}</div>
      <div class="walls">${opts.map(([id, name, bg]) => html`<button class="wopt" aria-pressed=${String(id === cur)} data-home-room-wall=${id || 'none'} ?disabled=${this.busy || !room} @click=${() => this.setWall(room, id)}><span class="wpv" style=${bg ? `background:${bg}` : nothing}></span>${name}</button>`)}${cur === 'img' ? html`<button class="wopt" aria-pressed="true"><span class="wpv" style=${`background:url("${apiUrl('home/room-wallpapers/' + encodeURIComponent(room) + '/image')}?v=${this.wallStamp}") center / cover`}></span>תמונה</button>` : nothing}</div></section>`;
  }

  private switchesPane() {
    if (this.swError) return html`<sw-state-panel state="error" hint=${this.swError} actionLabel="נסה שוב" @action=${() => this.loadSwitches()}></sw-state-panel>`;
    if (!this.sw) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const vis = this.swVisible();
    const pages = Math.max(1, Math.ceil(vis.length / PAGE));
    const pg = Math.min(this.swPage, pages - 1);
    const rows = vis.slice(pg * PAGE, pg * PAGE + PAGE);
    const areas = [...new Map(this.sw.filter((r) => r.area_id).map((r) => [r.area_id!, r.area_name ?? r.area_id!])).entries()];
    const sel = this.swSel;
    const allVis = vis.length > 0 && vis.every((r) => sel.has(r.entity_id));
    const suggested = this.sw.filter((r) => r.suggest).length;
    const setSel = (next: Set<string>) => { this.swSel = next; };
    const toggle = (id: string, on: boolean) => { const n = new Set(sel); if (on) n.add(id); else n.delete(id); setSel(n); };
    const selSuggested = [...sel].filter((id) => this.sw!.find((r) => r.entity_id === id)?.suggest).length;
    return html`<section class="card" aria-label="סיווג מפסקים" data-home-switches>
      <h3>סיווג מפסקים</h3>
      <p class="note">תאורה נכבית ב"כיבוי החדר" וב"כיבוי הכל". "לא תאורה" (דוד, מקרר, משאבה...) לא נכבה בכיבוי כללי. "מוגן" גם מבקש אישור לפני כיבוי ידני ולא נכלל בשום פעולה קבוצתית. המערכת מציעה לפי השם, ואתם מאשרים.</p>
      <div class="filters">
        <sw-tabs segmented group-label="סינון" data-sw-filter .items=${[{ id: 'all', label: 'הכל', count: this.sw.length }, { id: 'suggested', label: 'הצעות', count: suggested }, { id: 'light', label: 'תאורה' }, { id: 'not_light', label: 'לא תאורה' }, { id: 'protected', label: 'מוגן' }]} .active=${this.swFilter} @change=${(e: CustomEvent<{ id: string }>) => { this.swFilter = e.detail.id as typeof this.swFilter; this.swPage = 0; }}></sw-tabs>
        <select aria-label="חדר" data-sw-area @change=${(e: Event) => { this.swArea = (e.target as HTMLSelectElement).value; this.swPage = 0; }}><option value="">כל החדרים</option>${areas.map(([id, name]) => html`<option value=${id} ?selected=${this.swArea === id}>${name}</option>`)}</select>
      </div>
      <div class="bulk" ?hidden=${!sel.size} role="toolbar" aria-label="פעולה על המסומנים" data-sw-bulk>
        <span class="count">${sel.size} מסומנים</span>
        ${selSuggested ? html`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-sw-approve @click=${() => this.approveSelected()}>אישור ההצעות (${selSuggested})</sw-button>` : nothing}
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="light" @click=${() => this.mark('light', [...sel])}>תאורה</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="not_light" @click=${() => this.mark('not_light', [...sel])}>לא תאורה</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="protected" @click=${() => this.mark('protected', [...sel])}>מוגן</sw-button>
        <sw-button size="sm" variant="ghost" @click=${() => setSel(new Set())}>ניקוי</sw-button>
      </div>
      ${vis.length ? html`<table>
        <thead><tr><th class="c"><input type="checkbox" aria-label="סמן את כל המוצגים" data-sw-all .checked=${allVis} @change=${(e: Event) => { const on = (e.target as HTMLInputElement).checked; const n = new Set(sel); for (const r of vis) { if (on) n.add(r.entity_id); else n.delete(r.entity_id); } setSel(n); }}></th><th>שם</th><th>חדר</th><th>עכשיו</th><th>הצעה</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr data-sw-row=${r.entity_id} aria-selected=${String(sel.has(r.entity_id))}>
          <td class="c"><input type="checkbox" aria-label=${'סמן ' + r.name} .checked=${sel.has(r.entity_id)} @change=${(e: Event) => toggle(r.entity_id, (e.target as HTMLInputElement).checked)}></td>
          <td><b>${r.name}</b>${r.locked ? html`<div class="note">${LOCKED_LABEL[r.locked] ?? ''}</div>` : nothing}</td>
          <td>${r.area_name ?? html`<span class="note">בלי חדר</span>`}</td>
          <td><span class="cls ${r.class}">${CLASS_LABEL[r.class]}</span></td>
          <td>${r.suggest ? html`<span class="sug"><sw-button size="sm" ?disabled=${this.busy} data-sw-accept=${r.entity_id} @click=${() => this.mark(r.suggest!, [r.entity_id])}>${CLASS_LABEL[r.suggest]}</sw-button><span class="why">${r.suggest_reason ?? ''}</span></span>` : html`<span class="note">—</span>`}</td>
        </tr>`)}</tbody></table>
        ${pages > 1 ? html`<div class="pager"><sw-button size="sm" variant="ghost" ?disabled=${pg === 0} @click=${() => { this.swPage = pg - 1; }}>הקודם</sw-button><span>${pg + 1} מתוך ${pages}</span><sw-button size="sm" variant="ghost" ?disabled=${pg >= pages - 1} @click=${() => { this.swPage = pg + 1; }}>הבא</sw-button></div>` : nothing}`
        : html`<p class="note">אין מפסקים שמתאימים לסינון.</p>`}
    </section>`;
  }

  render() {
    if (this.error && !this.data) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.data) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const u = this.data.users.find((x) => x.user_id === this.sel) ?? this.data.users[0];
    const tabs = html`<div class="subtabs"><sw-tabs variant="underline-compact" group-label="ממשק ביתי" data-home-subtabs .items=${[{ id: 'users', label: 'משתמשים' }, { id: 'install', label: 'הגדרות התקנה' }, { id: 'switches', label: 'סיווג מפסקים' }]} .active=${this.sub}
      @change=${(e: CustomEvent<{ id: string }>) => { this.sub = e.detail.id as typeof this.sub; this.message = ''; this.error = ''; if (this.sub === 'switches' && !this.sw) void this.loadSwitches(); }}></sw-tabs></div>`;
    const msgs = html`${this.message ? html`<p class="msg ok" role="status">${this.message}</p>` : nothing}${this.error ? html`<p class="msg err" role="alert">${this.error}</p>` : nothing}`;
    if (this.sub === 'install') return html`${tabs}${msgs}${this.installPane()}`;
    if (this.sub === 'switches') return html`${tabs}${msgs}${this.switchesPane()}`;
    return html`${tabs}
      ${msgs}
      <div class="grid">
        <section class="card" aria-label="משתמשים"><div class="users">${this.data.users.map((x) => html`<button class="u" data-home-user=${x.user_id} aria-current=${String(x.user_id === u?.user_id)} @click=${() => { this.sel = x.user_id; this.message = ''; }}><b>${x.display_name}</b><span class="chip ${x.default_interface === 'home' ? 'home' : ''}">${x.kiosk ? 'מסך קיר' : x.home_only ? 'ביתי בלבד' : x.default_interface === 'home' ? 'ביתי' : 'מלא'}</span><span class="note">${x.home_only || !x.may_switch ? 'נעול' : 'מחליף'}</span></button>`)}</div></section>
        ${u ? this.detail(u) : nothing}
      </div>
      <section class="card extra">
        <h3>מסכי קיר ומועדפי התחלה</h3>
        <div class="srow"><div><b>קוד יציאה ממסך קיר</b><div class="note">${this.data.kiosk_code_set ? 'מוגדר. לחיצה ארוכה על השעון במסך הקיר מבקשת אותו.' : 'לא מוגדר: מסך קיר לא ייפתח בלי קוד.'}</div></div>
          <div class="inline"><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="4 עד 8 ספרות" aria-label="קוד יציאה" .value=${this.code} @input=${(e: Event) => { this.code = (e.target as HTMLInputElement).value.replace(/\D/g, ''); }}><sw-button size="sm" @click=${() => this.saveCode()}>${this.code ? 'שמירה' : 'מחיקת הקוד'}</sw-button></div></div>
        <div class="srow"><div><b>מועדפי התחלה</b><div class="note">מי שעוד לא סידר מועדפים בחדר רואה את אלה. משתמשים יכולים לשנות לעצמם.</div></div><sw-button size="sm" data-home-seed @click=${() => this.seedFromMine()}>העתק את המועדפים שלי</sw-button></div>
      </section>`;
  }

  private detail(u: PolicyRow) {
    const rooms = this.rooms;
    const roomOn = (id: string) => u.rooms == null || u.rooms.includes(id);
    const modOn = (m: HomeModule) => u.modules == null || u.modules.includes(m);
    const toggleList = (cur: string[] | null, all: string[], id: string, on: boolean) => {
      const base = cur ?? all;
      const next = on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
      return next.length === all.length ? null : next;
    };
    return html`<section class="card" aria-label=${u.display_name} data-home-detail>
      <h3>${u.display_name}</h3>
      <div class="srow"><div><b>ממשק ברירת מחדל</b><div class="note">הממשק שנפתח בכניסה</div></div>
        <sw-view-switch label="ממשק ברירת מחדל" .options=${[{ id: 'home', label: 'ביתי' }, { id: 'full', label: 'מלא' }]} value=${u.home_only ? 'home' : u.default_interface} ?disabled=${u.home_only} @change=${(e: CustomEvent<string>) => this.save(u, { default_interface: e.detail })}></sw-view-switch></div>
      <div class="srow"><div><b>רשאי להחליף ממשק</b><div class="note">מציג את הבחירה בתפריט האישי</div></div><sw-toggle label="רשאי להחליף ממשק" labelHidden ?checked=${u.may_switch} ?disabled=${u.home_only || this.busy} @change=${(e: CustomEvent<{ checked: boolean }>) => this.save(u, { may_switch: e.detail.checked })}></sw-toggle></div>
      <div class="srow"><div><b>ממשק ביתי בלבד</b><div class="note">${u.system_admin ? 'מנהל מערכת תמיד רשאי לממשק המלא.' : 'לא יכול לפתוח את הממשק המלא. השרת מסרב גם לבקשות שלו לאזורים של הממשק המלא.'}</div></div><sw-toggle label="ממשק ביתי בלבד" labelHidden ?checked=${u.home_only} ?disabled=${u.system_admin || this.busy} @change=${(e: CustomEvent<{ checked: boolean }>) => this.save(u, { home_only: e.detail.checked, ...(e.detail.checked ? {} : { kiosk: false }) })}></sw-toggle></div>
      <div class="srow"><div><b>מצב מסך קיר</b><div class="note">נשאר תמיד בממשק הביתי ובחדר שלו, בלי תפריט אישי. יוצאים עם קוד המנהל.</div></div>
        <div class="inline">${u.kiosk || rooms.length ? html`<select aria-label="החדר של מסך הקיר" ?disabled=${u.system_admin} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) void this.save(u, { kiosk: true, kiosk_area_id: v }); }}><option value="">${u.kiosk ? 'חדר' : 'בחרו חדר'}</option>${rooms.map((r) => html`<option value=${r.id} ?selected=${u.kiosk_area_id === r.id}>${r.name}</option>`)}</select>` : nothing}<sw-toggle label="מצב מסך קיר" labelHidden ?checked=${u.kiosk} ?disabled=${u.system_admin || this.busy || (!u.kiosk && !u.kiosk_area_id)} @change=${(e: CustomEvent<{ checked: boolean }>) => this.save(u, { kiosk: e.detail.checked, kiosk_area_id: u.kiosk_area_id })}></sw-toggle></div></div>
      <div class="srow"><div><b>רשאי להזמין אורחים</b><div class="note">${u.can_invite ? 'מופיע בממשק הביתי תחת אינטרקום: אורח מקבל קוד זמני לדלת. דורש שהזמנת מבקרים מופעלת בהתקנה.' : 'הסימון לבדו לא מספיק: צריך גם הרשאה להזמנת מבקרים (משתמשים והרשאות), והזמנת מבקרים מופעלת בהתקנה.'}</div></div><sw-toggle label="רשאי להזמין אורחים" labelHidden data-home-guests ?checked=${!!u.guests} ?disabled=${this.busy} @change=${(e: CustomEvent<{ checked: boolean }>) => this.save(u, { guests: e.detail.checked })}></sw-toggle></div>
      <div class="cols">
        <div><b>מה מופיע בממשק הביתי</b>${this.data!.modules.map((m) => html`<label class="chk"><input type="checkbox" .checked=${modOn(m)} @change=${(e: Event) => { const next = toggleList(u.modules, this.data!.modules, m, (e.target as HTMLInputElement).checked); void this.save(u, next == null ? { all_modules: true } : { modules: next }); }}><span>${MODULE_LABEL[m]}</span></label>`)}</div>
        <div><b>חדרים שהמשתמש רואה</b>${rooms.length ? rooms.map((r) => html`<label class="chk"><input type="checkbox" .checked=${roomOn(r.id)} @change=${(e: Event) => { const next = toggleList(u.rooms, rooms.map((x) => x.id), r.id, (e.target as HTMLInputElement).checked); void this.save(u, next == null ? { all_rooms: true } : { rooms: next }); }}><span>${r.name}</span></label>`) : html`<p class="note">עוד אין חדרים.</p>`}</div>
      </div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-home-admin': SwHomeAdmin;
  }
}

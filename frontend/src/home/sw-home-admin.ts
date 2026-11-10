// HOME-SIMPLE-2420: user management > "ממשק ביתי" - for each person: which interface opens, whether they may switch, home only
// (also enforced by the server), the wall-panel lock with its room, and which rooms / categories the home interface shows. Plus the
// wall panels' exit code and the starting favourites (the administrator's own favourites, copied for everyone who never edited theirs).
// rbac.assign (the role assigner's own permission); every change is audited by the server. Never touches the home system's users.
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { describeError, get, put } from '../api/client';
import { getHomePrefs, getOverview, type HomeModule, type Interface, type Overview } from './home-api';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-view-switch';
import '../components/sw-state-panel';

interface PolicyRow {
  user_id: string; username: string; display_name: string; source: string; system_admin: boolean;
  default_interface: Interface; may_switch: boolean; home_only: boolean; kiosk: boolean; kiosk_area_id: string | null;
  rooms: string[] | null; modules: HomeModule[] | null; configured: boolean; admin: boolean;
}
interface Policies { users: PolicyRow[]; modules: HomeModule[]; seed: Record<string, unknown[]>; kiosk_code_set: boolean }

const MODULE_LABEL: Record<HomeModule, string> = {
  lights: 'תאורה', climate: 'אקלים', shades: 'תריסים', doors: 'דלתות ואינטרקום', cameras: 'מצלמות', energy: 'חשמל', alerts: 'התראות', scenes: 'סצנות', security: 'אבטחה',
};

@customElement('sw-home-admin')
export class SwHomeAdmin extends LitElement {
  static styles = css`
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
  `;

  @state() private data: Policies | null = null;
  @state() private rooms: Overview['rooms'] = [];
  @state() private sel = '';
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private code = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const [p, ov] = await Promise.all([get<Policies>('home/policies'), getOverview().catch(() => null)]);
      this.data = p;
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

  render() {
    if (this.error && !this.data) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.data) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const u = this.data.users.find((x) => x.user_id === this.sel) ?? this.data.users[0];
    return html`
      ${this.message ? html`<p class="msg ok" role="status">${this.message}</p>` : nothing}${this.error ? html`<p class="msg err" role="alert">${this.error}</p>` : nothing}
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

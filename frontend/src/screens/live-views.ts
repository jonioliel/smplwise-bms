import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-toggle';
import '../components/sw-icon';
import '../components/sw-scene';
import { demoScene, demoWall } from '../fixtures/catalog';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-chip';
import '../components/sw-state-panel';
import { isApi, session } from '../api/session';
import { listCameras } from '../api/maps';
import { snapshotUrl } from '../api/media';
import { describeError } from '../api/client';
import { createView, deleteView, kioskHref, listViews, updateView, wallHref, type SavedView, type ViewBody } from '../api/views';
import type { Camera } from '../api/types';

const EMPTY: ViewBody = { name: '', cameras: [], cols: 2, rows: 2, shared: false, kiosk: false };

const VIEWS = [
  { name: 'כל המצלמות', layout: 9, scope: 'משותפת', mobile: '4 · משני', owner: 'יוני', kiosk: true },
  { name: 'חוץ', layout: 4, scope: 'משותפת', mobile: '2 · משני', owner: 'יוני', kiosk: false },
  { name: 'פנים', layout: 6, scope: 'משותפת', mobile: 'ללא', owner: 'יוסי', kiosk: false },
  { name: 'לילה', layout: 4, scope: 'אישית', mobile: '4 · משני', owner: 'דנה', kiosk: false },
];

/** SC09 — saved views manager (legacy layout manager; templates 1/2/4/6/9/12/16/custom). */
@customElement('live-views')
export class LiveViews extends LitElement {
  @state() private views: SavedView[] | null = null;
  @state() private cams: Camera[] = [];
  @state() private canShare = false;
  @state() private canManageAll = false;
  @state() private editing: (ViewBody & { id?: string }) | null = null;
  @state() private confirmDelete: SavedView | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private formError = '';

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    try {
      const [v, c] = await Promise.all([listViews(), listCameras()]);
      this.views = v.views;
      this.canShare = v.can_share;
      this.canManageAll = v.can_manage_all;
      this.cams = c.cameras.filter((x) => x.enabled && x.can_view_live !== false);
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.views = this.views ?? [];
    }
  }

  private canEdit(v: SavedView): boolean {
    return this.canManageAll || v.owner_user_id === session.me?.user.id;
  }

  private open(v?: SavedView) {
    this.formError = '';
    this.editing = v ? { id: v.id, name: v.name, cameras: [...v.cameras], cols: v.cols, rows: v.rows, shared: v.shared, kiosk: v.kiosk } : { ...EMPTY, cameras: [] };
  }

  private toggleCamera(id: string) {
    if (!this.editing) return;
    const has = this.editing.cameras.includes(id);
    if (!has && this.editing.cameras.length >= 16) return;
    this.editing = { ...this.editing, cameras: has ? this.editing.cameras.filter((c) => c !== id) : [...this.editing.cameras, id] };
  }

  private async save() {
    const e = this.editing;
    if (!e) return;
    if (!e.name.trim()) {
      this.formError = 'לתצוגה צריך שם.';
      return;
    }
    if (!e.cameras.length) {
      this.formError = 'בחר לפחות מצלמה אחת.';
      return;
    }
    this.busy = true;
    try {
      const body: ViewBody = { name: e.name.trim(), cameras: e.cameras, cols: e.cols, rows: e.rows, shared: e.shared, kiosk: e.kiosk };
      if (e.id) await updateView(e.id, body);
      else await createView(body);
      this.editing = null;
      await this.load();
    } catch (err) {
      this.formError = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async removeView() {
    const v = this.confirmDelete;
    if (!v) return;
    this.busy = true;
    try {
      await deleteView(v.id);
      this.confirmDelete = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderEditor() {
    const e = this.editing!;
    return html`<sw-dialog open heading=${e.id ? 'עריכת תצוגה' : 'תצוגה חדשה'} subheading="שם, מצלמות ופריסה · תצוגה משותפת נראית לכל המשתמשים" data-view-dialog @close=${() => (this.editing = null)}>
      <div class="form">
        <sw-field label="שם"><input data-view-name .value=${e.name} maxlength="60" @input=${(ev: Event) => (this.editing = { ...e, name: (ev.target as HTMLInputElement).value })} /></sw-field>
        <div class="lbl">מצלמות (${e.cameras.length} מתוך ${this.cams.length})</div>
        <div class="chips" data-view-cameras>
          ${this.cams.map((c) => html`<sw-chip ?selected=${e.cameras.includes(c.id)} data-view-camera=${c.id} dot=${c.status === 'online' ? '#22c55e' : '#ef4444'} @click=${() => this.toggleCamera(c.id)}>${c.name}</sw-chip>`)}
        </div>
        <div class="two">
          <sw-field label="עמודות"><select data-view-cols .value=${String(e.cols)} @change=${(ev: Event) => (this.editing = { ...e, cols: Number((ev.target as HTMLSelectElement).value) })}>${[1, 2, 3, 4].map((n) => html`<option value=${n} ?selected=${n === e.cols}>${n}</option>`)}</select></sw-field>
          <sw-field label="שורות"><select data-view-rows .value=${String(e.rows)} @change=${(ev: Event) => (this.editing = { ...e, rows: Number((ev.target as HTMLSelectElement).value) })}>${[1, 2, 3, 4].map((n) => html`<option value=${n} ?selected=${n === e.rows}>${n}</option>`)}</select></sw-field>
        </div>
        <div class="toggles">
          <sw-toggle ?checked=${e.shared} ?disabled=${!this.canShare} label=${this.canShare ? 'משותפת לכל המשתמשים' : 'משותפת (דורש הרשאת ניהול משתמשים)'} data-view-shared @change=${(ev: CustomEvent<{ checked: boolean }>) => (this.editing = { ...e, shared: ev.detail.checked })}></sw-toggle>
          <sw-toggle ?checked=${e.kiosk} label="מיועדת לקיוסק (מסך קיר)" data-view-kiosk @change=${(ev: CustomEvent<{ checked: boolean }>) => (this.editing = { ...e, kiosk: ev.detail.checked })}></sw-toggle>
        </div>
        <div class="note">הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג ${e.cols}×${e.rows} מצלמות בעמוד ומדפדף בין העמודים.</div>
        ${this.formError ? html`<div class="err" data-view-error>${this.formError}</div>` : nothing}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${() => (this.editing = null)}>ביטול</sw-button>
        <sw-button variant="primary" icon="check" data-view-save ?disabled=${this.busy} @click=${() => this.save()}>${e.id ? 'שמור' : 'צור תצוגה'}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderApi() {
    const views = this.views;
    return html`
      <sw-page heading="תצוגות שמורות" subheading="קבוצות מצלמות עם פריסה — אישיות או משותפות — לפתיחה בקיר החי או בקיוסק">
        <sw-button slot="actions" variant="primary" icon="plus" data-view-new @click=${() => this.open()}>תצוגה חדשה</sw-button>
        ${this.error ? html`<sw-state-panel state="error" heading="התצוגות לא נטענו" hint=${this.error}></sw-state-panel>` : nothing}
        ${views === null
          ? html`<sw-state-panel state="loading" heading="טוען תצוגות…"></sw-state-panel>`
          : views.length
            ? html`<div class="grid" data-views>
                ${views.map(
                  (v) => html`<sw-card data-view=${v.id}>
                    <div class="thumb" style=${`grid-template-columns:repeat(${Math.min(2, Math.max(1, v.cameras.length))}, 1fr)`}>
                      ${v.cameras.slice(0, 4).map((id) => html`<img src=${snapshotUrl(id)} alt="" loading="lazy" @error=${(ev: Event) => ((ev.target as HTMLImageElement).style.visibility = 'hidden')} />`)}
                      ${!v.cameras.length ? html`<div class="empty">אין מצלמות שמותר לך לראות בתצוגה זו</div>` : nothing}
                    </div>
                    <div class="head"><b>${v.name}</b><sw-badge kind=${v.shared ? 'live' : 'neutral'} label=${v.shared ? 'משותפת' : 'אישית'}></sw-badge>${v.kiosk ? html`<sw-badge kind="neutral" label="קיוסק"></sw-badge>` : nothing}</div>
                    <dl>
                      <dt>מצלמות</dt><dd>${v.camera_names.join(' · ') || '—'}${v.hidden_cameras ? html` <span class="muted">(+${v.hidden_cameras} ללא הרשאה)</span>` : nothing}</dd>
                      <dt>פריסה</dt><dd class="ltr">${v.cols}×${v.rows}</dd>
                      <dt>בעלים</dt><dd>${v.owner_username ?? '—'}</dd>
                    </dl>
                    <div class="foot">
                      <a href=${wallHref(v)}><sw-button size="sm" variant="primary" icon="play" data-view-open ?disabled=${!v.cameras.length}>פתח</sw-button></a>
                      <a href=${kioskHref(v)} target="_blank" rel="noopener"><sw-button size="sm" icon="layers" data-view-kiosk-open ?disabled=${!v.cameras.length}>קיוסק</sw-button></a>
                      <span class="grow"></span>
                      ${this.canEdit(v) ? html`<sw-button size="sm" variant="ghost" icon="edit" data-view-edit @click=${() => this.open(v)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-view-delete @click=${() => (this.confirmDelete = v)}>מחיקה</sw-button>` : nothing}
                    </div>
                  </sw-card>`,
                )}
              </div>`
            : html`<sw-state-panel state="empty" heading="אין עדיין תצוגות שמורות" hint="צור תצוגה: שם, מצלמות ופריסה. תצוגה משותפת נראית לכל המשתמשים; קיוסק פותח אותה במסך קיר בלי פקדים."></sw-state-panel>`}
        ${this.editing ? this.renderEditor() : nothing}
        ${this.confirmDelete
          ? html`<sw-dialog open heading="מחיקת תצוגה" subheading=${this.confirmDelete.name} @close=${() => (this.confirmDelete = null)}>
              <p>התצוגה תוסר מהרשימה. המצלמות וההקלטות אינן מושפעות.</p>
              <div slot="footer"><sw-button variant="ghost" @click=${() => (this.confirmDelete = null)}>ביטול</sw-button><sw-button variant="danger" icon="trash" data-view-delete-confirm ?disabled=${this.busy} @click=${() => this.removeView()}>מחק</sw-button></div>
            </sw-dialog>`
          : nothing}
      </sw-page>
    `;
  }

  static styles = css`
    .thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      border-radius: 3px;
      background: #1e293b;
      display: block;
    }
    .thumb .empty {
      grid-column: 1 / -1;
      color: #cbd5e1;
      font-size: var(--sw-fs-xs);
      display: grid;
      place-items: center;
      text-align: center;
      padding: 8px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-block-end: 6px;
    }
    .head b {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grow {
      flex: 1;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: min(560px, 80vw);
    }
    .form .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .toggles {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    .thumb {
      display: grid;
      gap: 3px;
      background: #0f172a;
      border-radius: 8px;
      padding: 4px;
      aspect-ratio: 16 / 9;
      margin-block-end: 10px;
      overflow: hidden;
    }
    .thumb sw-scene {
      border-radius: 3px;
      inline-size: 100%;
      block-size: 100%;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      margin: 0;
      font-size: var(--sw-fs-xs);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .foot {
      display: flex;
      gap: 6px;
      margin-block-start: 10px;
      align-items: center;
    }
  `;

  render() {
    if (isApi()) return this.renderApi();
    return html`
      <sw-page heading="תצוגות שמורות" subheading="תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תצוגה חדשה</sw-button>
        <div class="grid">
          ${VIEWS.map((v) => {
            const cols = Math.ceil(Math.sqrt(v.layout));
            return html`<sw-card heading=${v.name}>
              <sw-badge slot="actions" kind="neutral" label=${v.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${cols},1fr)">${demoWall.filter((c) => c.state === 'live').slice(0, v.layout).map((c) => html`<sw-scene kind=${demoScene[c.id] ?? 'lobby'}></sw-scene>`)}</div>
              <dl>
                <dt>פריסה</dt><dd>${v.layout} אריחים</dd>
                <dt>מובייל</dt><dd>${v.mobile}</dd>
                <dt>בעלים</dt><dd>${v.owner}</dd>
              </dl>
              <div class="foot">
                <a href="#/live/wall"><sw-button size="sm" icon="play">פתח</sw-button></a>
                <sw-button size="sm" variant="ghost">עריכה</sw-button>
                <sw-toggle ?checked=${v.kiosk} label="קיוסק"></sw-toggle>
              </div>
            </sw-card>`;
          })}
        </div>
      </sw-page>
    `;
  }
}

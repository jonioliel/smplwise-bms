import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import '../components/sw-scene';
import '../components/sw-field';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { navigate } from '../router';
import { createBuilding, createSite, deleteBuilding, deleteImage, deleteSite, imageSrc, loadTree, updateBuilding, updateSite, uploadImage, type CatalogTree } from '../api/catalog';
import { describeError } from '../api/client';
import type { Building, Site } from '../api/types';

const SITE_SCENE = ['house', 'building', 'warehouse'] as const;

/** SC02 — sites & buildings (board 1 screen 2) on real catalogue data; create sites and buildings. */
@customElement('explore-sites')
export class ExploreSites extends LitElement {
  @state() private tab = 'all';
  @state() private tree: CatalogTree | null = null;
  @state() private dialog: { kind: 'site' } | { kind: 'building'; site: Site } | { kind: 'edit-site'; site: Site } | { kind: 'edit-building'; building: Building; site: Site } | { kind: 'delete-site'; site: Site } | { kind: 'delete-building'; building: Building; site: Site } | null = null;
  @state() private notice = '';
  @state() private formName = '';
  @state() private formAddress = '';
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 14px;
    }
    .pic {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .pic .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 9.5px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px 12px;
    }
    .info b {
      display: block;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .info small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .add {
      display: grid;
      place-items: center;
      min-block-size: 200px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      text-align: center;
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
      font-size: var(--sw-fs-sm);
      background: transparent;
      font-family: inherit;
    }
    .add:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .add .ic {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .add small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .blist {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .brow {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }
    .brow sw-scene {
      inline-size: 64px;
      block-size: 44px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .brow b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .brow small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .brow sw-icon {
      margin-inline-start: auto;
      color: var(--sw-text-3);
    }
    .menu {
      display: inline-flex;
      gap: 2px;
      align-items: center;
    }
    .brow .menu {
      margin-inline-start: auto;
    }
    .brow .menu + sw-icon {
      margin-inline-start: 0;
    }
    img.photo {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    img.photo.small {
      inline-size: 64px;
      block-size: 44px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .map {
      min-block-size: 360px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.reload();
  }

  private async reload() {
    try {
      this.tree = await loadTree();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private open(d: typeof this.dialog) {
    this.formName = d && d.kind === 'edit-site' ? d.site.name : d && d.kind === 'edit-building' ? d.building.name : '';
    this.formAddress = d && d.kind === 'edit-site' ? d.site.address : '';
    this.error = '';
    this.dialog = d;
  }

  /** R1: photo upload for a site or a building (PNG / JPG; the server re-encodes and bounds it). */
  private pickImage(kind: 'site' | 'building', id: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      this.busy = true;
      try {
        await uploadImage(kind, id, f);
        this.notice = 'התמונה נשמרה.';
        await this.reload();
      } catch (err) {
        this.notice = describeError(err);
      } finally {
        this.busy = false;
      }
    });
    input.click();
  }

  private async removeImage(kind: 'site' | 'building', id: string) {
    this.busy = true;
    try {
      await deleteImage(kind, id);
      await this.reload();
    } catch (err) {
      this.notice = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderMenu(kind: 'site' | 'building', s: Site, b?: Building) {
    const hasImage = b ? !!b.image_url : !!s.image_url;
    const id = b ? b.id : s.id;
    const stop = (e: Event) => e.stopPropagation();
    return html`<span class="menu" @click=${stop}>
      ${!b ? html`<sw-button variant="ghost" size="sm" icon="plus" data-add-building=${s.id} @click=${() => this.open({ kind: 'building', site: s })}>מבנה</sw-button>` : nothing}
      <sw-button variant="ghost" size="sm" iconOnly icon="edit" label="עריכה" data-edit=${id} @click=${() => this.open(b ? { kind: 'edit-building', building: b, site: s } : { kind: 'edit-site', site: s })}></sw-button>
      <sw-button variant="ghost" size="sm" iconOnly icon="camera" label=${hasImage ? 'החלף תמונה' : 'תמונה'} ?disabled=${this.busy} data-image=${id} @click=${() => this.pickImage(kind, id)}></sw-button>
      ${hasImage ? html`<sw-button variant="ghost" size="sm" iconOnly icon="close" label="הסר תמונה" ?disabled=${this.busy} @click=${() => this.removeImage(kind, id)}></sw-button>` : nothing}
      <sw-button variant="ghost" size="sm" iconOnly icon="trash" label="מחיקה" data-delete=${id} @click=${() => this.open(b ? { kind: 'delete-building', building: b, site: s } : { kind: 'delete-site', site: s })}></sw-button>
    </span>`;
  }

  private async submit() {
    const d = this.dialog;
    if (!d) return;
    this.busy = true;
    this.error = '';
    try {
      if (d.kind === 'site') {
        const site = await createSite({ name: this.formName.trim(), address: this.formAddress.trim() });
        this.dialog = null;
        await this.reload();
        this.open({ kind: 'building', site });
      } else if (d.kind === 'building') {
        const b = await createBuilding(d.site.id, { name: this.formName.trim() });
        this.dialog = null;
        navigate(`/explore/buildings/${b.id}/floors`);
      } else if (d.kind === 'edit-site') {
        await updateSite(d.site.id, { name: this.formName.trim(), address: this.formAddress.trim() });
        this.dialog = null;
        await this.reload();
      } else if (d.kind === 'edit-building') {
        await updateBuilding(d.building.id, { name: this.formName.trim() });
        this.dialog = null;
        await this.reload();
      } else if (d.kind === 'delete-site') {
        await deleteSite(d.site.id);
        this.dialog = null;
        await this.reload();
      } else if (d.kind === 'delete-building') {
        await deleteBuilding(d.building.id);
        this.dialog = null;
        await this.reload();
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private openSite(s: Site) {
    const first = s.buildings?.[0];
    if (first) navigate(`/explore/buildings/${first.id}/floors`);
    else this.open({ kind: 'building', site: s });
  }

  private renderSites(tree: CatalogTree) {
    return html`<div class="grid">
      ${tree.sites.map((s, i) => {
        const buildings = s.buildings ?? [];
        const cams = buildings.reduce((n, b) => n + (b.floors ?? []).reduce((m, f) => m + f.camera_count, 0), 0);
        return html`<sw-card flush interactive data-site-card=${s.id} @click=${() => this.openSite(s)}>
          <div class="pic">${s.image_url ? html`<img class="photo" src=${imageSrc(s.image_url)} alt="" />` : html`<sw-scene kind=${SITE_SCENE[i % 3]}></sw-scene>${tree.source === 'demo' ? html`<span class="demo">דמו</span>` : html`<span class="demo">איור</span>`}`}</div>
          <div class="info">
            <div><b>${s.name}</b><small>${buildings.length} ${buildings.length === 1 ? 'מבנה' : 'מבנים'} · ${cams} מצלמות${s.address ? ` · ${s.address}` : ''}</small></div>
            ${tree.source === 'api' ? this.renderMenu('site', s) : nothing}
            <sw-button variant="ghost" size="sm" iconOnly icon="plus" label="מבנה חדש" @click=${(e: Event) => { e.stopPropagation(); this.open({ kind: 'building', site: s }); }}></sw-button>
          </div>
        </sw-card>`;
      })}
      ${tree.canCreateSite
        ? html`<button class="add" @click=${() => this.open({ kind: 'site' })}><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>הוספת אתר חדש</strong><small>יצירת מיקום חדש כדי להתחיל</small></div></button>`
        : nothing}
    </div>`;
  }

  private renderBuildings(tree: CatalogTree) {
    const rows = tree.sites.flatMap((s) => (s.buildings ?? []).map((b) => ({ s, b })));
    return html`<div class="blist">
      ${rows.map(
        ({ s, b }, i) => html`<sw-card class="brow" data-building-card=${b.id} @click=${() => navigate(`/explore/buildings/${b.id}/floors`)}>
          ${b.image_url ? html`<img class="photo small" src=${imageSrc(b.image_url)} alt="" />` : html`<sw-scene kind=${i % 2 ? 'house' : 'building'}></sw-scene>`}
          <div><b>${b.name}</b><small>${s.name} · ${(b.floors ?? []).length} קומות · ${(b.floors ?? []).reduce((n, f) => n + f.camera_count, 0)} מצלמות</small></div>
          ${tree.source === 'api' ? this.renderMenu('building', s, b) : nothing}
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`,
      )}
      ${rows.length ? nothing : html`<div class="map" style="min-block-size:120px">אין מבנים עדיין.</div>`}
    </div>`;
  }

  render() {
    const tree = this.tree;
    if (!tree) return html`<sw-page heading="אתרים ומבנים"><sw-state-panel state=${this.error ? 'error' : 'loading'} hint=${this.error}></sw-state-panel></sw-page>`;
    const d = this.dialog;
    return html`
      <sw-page heading="אתרים ומבנים" subheading=${`ניהול המיקומים והמבנים שלך${tree.source === 'demo' ? ' · נתוני הדגמה' : ''}`}>
        ${tree.canCreateSite ? html`<sw-button slot="actions" variant="primary" icon="plus" @click=${() => this.open({ kind: 'site' })}>אתר חדש</sw-button>` : nothing}
        <sw-tabs .items=${[{ id: 'all', label: 'כל האתרים', count: tree.sites.length }, { id: 'buildings', label: 'מבנים', count: tree.sites.reduce((n, s) => n + (s.buildings?.length ?? 0), 0) }, { id: 'map', label: 'מפה' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${tree.sites.length === 0 && this.tab === 'all'
          ? html`<sw-state-panel state="empty" heading="עוד אין אתרים" hint="התחל ביצירת האתר הראשון; אחר כך מבנה, קומות ותוכניות.">${tree.canCreateSite ? html`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${() => this.open({ kind: 'site' })}>אתר חדש</sw-button></div>` : nothing}</sw-state-panel>`
          : this.tab === 'all' ? this.renderSites(tree) : this.tab === 'buildings' ? this.renderBuildings(tree) : html`<div class="map">מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta</div>`}
        ${this.notice ? html`<div class="err" data-sites-notice style="margin-block:8px">${this.notice}</div>` : nothing}
        ${d && (d.kind === 'delete-site' || d.kind === 'delete-building')
          ? (() => {
              const children = d.kind === 'delete-site' ? (d.site.buildings ?? []).length : (d.building.floors ?? []).length;
              const name = d.kind === 'delete-site' ? d.site.name : d.building.name;
              return html`<sw-dialog open heading=${d.kind === 'delete-site' ? 'מחיקת אתר' : 'מחיקת מבנה'} subheading=${name} data-delete-dialog @close=${() => (this.dialog = null)}>
                ${children
                  ? html`<div class="err">${d.kind === 'delete-site' ? `לאתר יש ${children} מבנים` : `למבנה יש ${children} קומות`}. מחק אותם קודם; מחיקה לא מוחקת מצלמות, רק את המיקום בקטלוג.</div>`
                  : html`<div>המיקום יוסר מהקטלוג (מחיקה רכה, נרשמת באודיט). מצלמות והקלטות אינן מושפעות.</div>`}
                ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
                <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
                <sw-button slot="footer" variant="danger" ?disabled=${!!children || this.busy} data-delete-confirm @click=${() => this.submit()}>מחק</sw-button>
              </sw-dialog>`;
            })()
          : d
            ? html`<sw-dialog open heading=${d.kind === 'site' ? 'אתר חדש' : d.kind === 'building' ? 'מבנה חדש' : d.kind === 'edit-site' ? 'עריכת אתר' : 'עריכת מבנה'} subheading=${d.kind === 'building' ? d.site.name : d.kind === 'site' ? 'שם, כתובת ואזור זמן ברירת מחדל Asia/Jerusalem' : d.kind === 'edit-building' ? d.site.name : d.site.address || ''} data-edit-dialog @close=${() => (this.dialog = null)}>
                <sw-field label="שם"><input data-form-name .value=${this.formName} @input=${(e: Event) => (this.formName = (e.target as HTMLInputElement).value)} placeholder=${d.kind === 'site' || d.kind === 'edit-site' ? 'למשל: משרדי החברה' : 'למשל: מבנה ראשי'} /></sw-field>
                ${d.kind === 'site' || d.kind === 'edit-site' ? html`<sw-field label="כתובת (אופציונלי)"><input data-form-address .value=${this.formAddress} @input=${(e: Event) => (this.formAddress = (e.target as HTMLInputElement).value)} /></sw-field>` : nothing}
                ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
                ${tree.source === 'demo' ? html`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>` : nothing}
                <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
                <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim() || this.busy || tree.source === 'demo'} data-form-submit @click=${() => this.submit()}>${d.kind === 'site' ? 'צור אתר' : d.kind === 'building' ? 'צור מבנה' : 'שמור'}</sw-button>
              </sw-dialog>`
            : nothing}
      </sw-page>
    `;
  }
}

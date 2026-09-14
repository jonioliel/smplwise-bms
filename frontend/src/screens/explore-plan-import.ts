import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-steps';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { navigate } from '../router';
import { createVersion, listAssets, publishVersion, uploadAsset } from '../api/maps';
import { findFloor, loadTree, type CatalogTree } from '../api/catalog';
import { describeError, resourceUrl } from '../api/client';
import { isApi } from '../api/session';
import type { PlanAsset, PlanVersion } from '../api/types';

const STEPS = ['קובץ', 'עמוד', 'חיתוך וסיבוב', 'שם והערות', 'שמירה ופרסום'];

/**
 * SC05 — plan import (board 2 screen 13): file → page → crop/rotate → name → draft → publish.
 * The original stays untouched on the server; every step here only describes a derived version.
 */
@customElement('explore-plan-import')
export class ExplorePlanImport extends LitElement {
  @property() floorId = '';
  @state() private step = 0;
  @state() private tree: CatalogTree | null = null;
  @state() private assets: PlanAsset[] = [];
  @state() private asset: PlanAsset | null = null;
  @state() private page = 1;
  @state() private rotation = 0;
  @state() private crop = { x: 0, y: 0, w: 1, h: 1 };
  @state() private notes = '';
  @state() private version: PlanVersion | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private dragOver = false;

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stage {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 14px;
      min-block-size: 360px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .drop {
      flex: 1;
      min-block-size: 300px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    .drop.over,
    .drop:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .drop .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .drop small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 4px;
    }
    input[type='file'] {
      display: none;
    }
    .pages {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .pg {
      border: 1.5px solid var(--sw-border);
      border-radius: 8px;
      padding: 6px;
      background: var(--sw-surface);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pg.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pg img {
      inline-size: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: #f3f5f9;
      border-radius: 4px;
      display: block;
      margin-block-end: 4px;
    }
    .preview {
      position: relative;
      flex: 1;
      min-block-size: 320px;
      background: #f3f5f9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    .preview img {
      max-inline-size: 100%;
      max-block-size: 420px;
      transition: transform var(--sw-t-med) var(--sw-ease);
    }
    .preview .cropbox {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      box-shadow: 0 0 0 9999px rgba(17, 24, 39, 0.28);
      pointer-events: none;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .assets button {
      display: flex;
      justify-content: space-between;
      inline-size: 100%;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
      margin-block-end: 4px;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.init();
  }

  private async init() {
    try {
      this.tree = await loadTree();
      if (isApi() && this.floorId) this.assets = (await listAssets(this.floorId)).assets;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private get floor() {
    return this.tree && this.floorId ? findFloor(this.tree, this.floorId) : null;
  }

  private async onFile(file: File | undefined) {
    if (!file || !this.floorId) return;
    this.busy = true;
    this.error = '';
    try {
      this.asset = await uploadAsset(this.floorId, file);
      this.page = 1;
      this.rotation = 0;
      this.crop = { x: 0, y: 0, w: 1, h: 1 };
      this.version = null;
      this.step = this.asset.page_count > 1 ? 1 : 2;
      this.assets = [this.asset, ...this.assets.filter((a) => a.id !== this.asset!.id)];
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async save() {
    if (!this.asset || !this.floorId) return;
    this.busy = true;
    this.error = '';
    try {
      const full = this.crop.x === 0 && this.crop.y === 0 && this.crop.w === 1 && this.crop.h === 1;
      this.version = await createVersion(this.floorId, { asset_id: this.asset.id, page: this.page, rotation: this.rotation, crop: full ? null : this.crop, notes: this.notes });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async publish() {
    if (!this.version) return;
    this.busy = true;
    this.error = '';
    try {
      this.version = await publishVersion(this.version.id);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setCrop(key: 'x' | 'y' | 'w' | 'h', pct: number) {
    const v = Math.max(0, Math.min(100, pct)) / 100;
    const c = { ...this.crop, [key]: v };
    if (c.x + c.w > 1) c.w = 1 - c.x;
    if (c.y + c.h > 1) c.h = 1 - c.y;
    if (c.w <= 0.02) c.w = 0.02;
    if (c.h <= 0.02) c.h = 0.02;
    this.crop = c;
  }

  private previewUrl() {
    const p = this.asset?.pages.find((x) => x.page === this.page) ?? this.asset?.pages[0];
    return p ? resourceUrl(p.preview_url) : '';
  }

  private renderStep() {
    const a = this.asset;
    switch (this.step) {
      case 0:
        return html`
          <label class="drop ${this.dragOver ? 'over' : ''}" @dragover=${(e: DragEvent) => { e.preventDefault(); this.dragOver = true; }} @dragleave=${() => (this.dragOver = false)} @drop=${(e: DragEvent) => { e.preventDefault(); this.dragOver = false; void this.onFile(e.dataTransfer?.files[0]); }}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" @change=${(e: Event) => void this.onFile((e.target as HTMLInputElement).files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy ? 'מעלה…' : 'גרור לכאן PDF או תמונה של התוכנית, או לחץ לבחירה'}</strong>
              <small>PDF עד 20 עמודים, PNG / JPG · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי</small>
            </div>
          </label>
          ${this.assets.length
            ? html`<div class="assets"><div class="note" style="margin-block-end:4px">קבצים שכבר הועלו לקומה זו:</div>${this.assets.map((x) => html`<button @click=${() => { this.asset = x; this.page = 1; this.step = x.page_count > 1 ? 1 : 2; }}><span>${x.original_name}</span><span class="ltr">${x.page_count} עמ׳ · ${(x.bytes / 1024 / 1024).toFixed(1)} MB</span></button>`)}</div>`
            : nothing}`;
      case 1:
        return html`<div class="note">בחר את העמוד שמכיל את התוכנית של הקומה.</div>
          <div class="pages">${a?.pages.map((p) => html`<button class="pg ${p.page === this.page ? 'on' : ''}" @click=${() => (this.page = p.page)}><img src=${resourceUrl(p.preview_url)} alt=${`עמוד ${p.page}`} loading="lazy" />עמוד ${p.page}</button>`)}</div>`;
      case 2: {
        const rot = this.rotation;
        const c = this.crop;
        const box = rot % 180 === 0 ? c : { x: c.x, y: c.y, w: c.w, h: c.h };
        return html`
          <div class="preview">
            <img src=${this.previewUrl()} alt="תצוגה מקדימה" style="transform: rotate(${rot}deg)" />
            <div class="cropbox" style="left:${box.x * 100}%;top:${box.y * 100}%;width:${box.w * 100}%;height:${box.h * 100}%"></div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${() => (this.rotation = (this.rotation + 90) % 360)}>סובב 90°</sw-button>
            <sw-badge kind="neutral" label=${`סיבוב ${this.rotation}°`}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" @click=${() => (this.crop = { x: 0, y: 0, w: 1, h: 1 })}>אפס חיתוך</sw-button>
            <span class="note">החיתוך באחוזים מהתמונה (אחרי סיבוב): שמאל, עליון, רוחב, גובה.</span>
          </div>
          <div class="two">
            <sw-field label="שמאל %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(c.x * 100))} @change=${(e: Event) => this.setCrop('x', Number((e.target as HTMLInputElement).value))} /></sw-field>
            <sw-field label="עליון %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(c.y * 100))} @change=${(e: Event) => this.setCrop('y', Number((e.target as HTMLInputElement).value))} /></sw-field>
            <sw-field label="רוחב %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(c.w * 100))} @change=${(e: Event) => this.setCrop('w', Number((e.target as HTMLInputElement).value))} /></sw-field>
            <sw-field label="גובה %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(c.h * 100))} @change=${(e: Event) => this.setCrop('h', Number((e.target as HTMLInputElement).value))} /></sw-field>
          </div>`;
      }
      case 3:
        return html`
          <sw-field label="קומה"><input .value=${this.floor?.floor.name ?? ''} disabled /></sw-field>
          <sw-field label="הערות לגרסה (אופציונלי)" hint="למשל: תוכנית מעודכנת אחרי שיפוץ 2026"><input .value=${this.notes} @input=${(e: Event) => (this.notes = (e.target as HTMLInputElement).value)} /></sw-field>
          <div class="note">קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.</div>`;
      default:
        return html`
          ${this.version
            ? html`<div class="ok">✓ הגרסה נשמרה (${this.version.width_px}×${this.version.height_px} px) · ${this.version.status === 'published' ? 'פורסמה — היא הרקע של הקומה' : 'טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא'}</div>
                <div class="preview" style="min-block-size:220px"><img src=${resourceUrl(this.version.image_url)} alt="רקע התוכנית" /></div>`
            : html`<div class="note">סיכום: ${a?.original_name} · עמוד ${this.page} · סיבוב ${this.rotation}° · חיתוך ${Math.round(this.crop.w * 100)}%×${Math.round(this.crop.h * 100)}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.</div>`}
          <div class="row">
            ${!this.version ? html`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.save()}>שמור כטיוטה</sw-button>` : nothing}
            ${this.version && this.version.status === 'draft' ? html`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.publish()}>פרסום</sw-button>` : nothing}
            ${this.version ? html`<sw-button icon="map" @click=${() => navigate(`/explore/floors/${this.floorId}`)}>פתח במפה</sw-button><sw-button variant="ghost" icon="edit" @click=${() => navigate(`/explore/floors/${this.floorId}/edit`)}>הצב מצלמות</sw-button>` : nothing}
          </div>`;
    }
  }

  private renderDemo() {
    return html`<sw-card><sw-state-panel state="empty" heading="ייבוא תוכנית עובד מול השרת" hint="בתצוגת ההדגמה אין שרת מחובר. בהתקנה ב־Home Assistant המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה."></sw-state-panel></sw-card>`;
  }

  render() {
    const f = this.floor;
    const canNext = this.step === 0 ? !!this.asset : this.step === 1 ? !!this.asset : true;
    return html`
      <sw-page heading=${f ? `ייבוא תוכנית ל${f.floor.name}` : 'ייבוא תוכנית'} subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת" crumbs=${f ? `אתרים | ${f.site.name} | ${f.building.name} | ${f.floor.name}` : 'אתרים'}>
        ${!isApi()
          ? this.renderDemo()
          : !this.floorId || (this.tree && !f)
            ? html`<sw-state-panel state="empty" heading="בחר קומה" hint="ייבוא תוכנית מתחיל מדף הקומות."><div style="margin-block-start:10px"><sw-button variant="primary" @click=${() => navigate('/explore/sites')}>לאתרים</sw-button></div></sw-state-panel>`
            : html`
                <sw-card><sw-steps .steps=${STEPS} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error ? html`<div class="err">${this.error}</div>` : nothing}</div>
                  <div class="side">
                    <sw-card heading="קובץ">
                      ${this.asset
                        ? html`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split('/')[1].toUpperCase()} · ${(this.asset.bytes / 1024 / 1024).toFixed(1)} MB · ${this.asset.page_count} עמ׳`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0, 16)}…</div>`
                        : html`<div class="note">עדיין לא נבחר קובץ.</div>`}
                    </sw-card>
                    <sw-card heading="בטיחות">
                      <div class="note">הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step === 0 || this.busy} @click=${() => (this.step = Math.max(0, this.step - 1))}>הקודם</sw-button>
                      ${this.step < STEPS.length - 1 ? html`<sw-button variant="primary" ?disabled=${!canNext || this.busy} @click=${() => (this.step = Math.min(STEPS.length - 1, this.step + 1))}>הבא</sw-button>` : nothing}
                    </div>
                  </div>
                </div>`}
      </sw-page>
    `;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-field';
import { describeError } from '../api/client';
import {
  createPhotoSet,
  deletePhotoSet,
  deleteSetPhoto,
  listPhotoSets,
  listSetPhotos,
  photoPreviewUrl,
  uploadSetPhoto,
  type PhotoSet,
} from '../api/wall';

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** CR-030 section 6.2: "תמונות למסכי קיר" - the product's own photo sets (upload only; no URL, no library path, no camera
 * material). The server re-encodes every upload to a 1920-px JPEG rendition, which also removes EXIF. */
@customElement('sw-wall-photo-sets')
export class SwWallPhotoSets extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @state() private sets: PhotoSet[] = [];
  @state() private limits = { max_files: 200, max_bytes: 8 * 1024 * 1024 };
  @state() private current = '';
  @state() private photos: { id: string; w: number; h: number }[] = [];
  @state() private name = '';
  @state() private busy = false;
  @state() private progress = '';
  @state() private error = '';
  @state() private confirmDelete = false;

  static styles = css`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-block: 10px; }
    .ph { position: relative; aspect-ratio: 4 / 3; border-radius: var(--sw-r-sm, 8px); overflow: hidden; background: var(--sw-surface-3); }
    .ph img { inline-size: 100%; block-size: 100%; object-fit: cover; }
    .ph button { position: absolute; inset-block-start: 4px; inset-inline-end: 4px; border: 0; border-radius: 50%; inline-size: 26px; block-size: 26px; background: rgba(0, 0, 0, 0.6); color: #fff; cursor: pointer; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block: 8px; }
    .sets { display: flex; gap: 6px; flex-wrap: wrap; }
    .set { border: 1px solid var(--sw-border); border-radius: var(--sw-r-pill, 999px); padding: 4px 12px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .set[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; }
    .muted { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .warn { color: var(--sw-danger-text, #b3261e); font-size: var(--sw-fs-sm); }
    input[type='text'] { font: inherit; color: inherit; background: transparent; border: 0; outline: 0; inline-size: 100%; }
  `;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      const r = await listPhotoSets();
      this.sets = r.sets;
      this.limits = r.limits;
      if (!this.sets.some((s) => s.id === this.current)) this.current = this.sets[0]?.id ?? '';
      await this.loadPhotos();
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async loadPhotos(): Promise<void> {
    this.photos = this.current ? (await listSetPhotos(this.current)).photos : [];
  }

  private async create(): Promise<void> {
    if (!this.name.trim()) return;
    this.busy = true;
    try {
      const s = await createPhotoSet(this.name.trim());
      this.name = '';
      this.current = s.id;
      await this.refresh();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async upload(files: FileList | null): Promise<void> {
    if (!files || !this.current) return;
    this.busy = true;
    this.error = '';
    const list = [...files];
    let done = 0;
    const problems: string[] = [];
    for (const f of list) {
      this.progress = `מעלה ${++done} מתוך ${list.length}`;
      if (!OK_TYPES.includes(f.type)) {
        problems.push(`${f.name}: רק JPEG, PNG או WebP`);
        continue;
      }
      if (f.size > this.limits.max_bytes) {
        problems.push(`${f.name}: גדול מ-8MB`);
        continue;
      }
      try {
        await uploadSetPhoto(this.current, f);
      } catch (e) {
        problems.push(`${f.name}: ${describeError(e)}`);
      }
    }
    this.progress = '';
    this.error = problems.slice(0, 3).join(' · ');
    this.busy = false;
    await this.refresh();
  }

  private async removePhoto(id: string): Promise<void> {
    try {
      await deleteSetPhoto(this.current, id);
      await this.refresh();
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async removeSet(): Promise<void> {
    this.busy = true;
    try {
      await deletePhotoSet(this.current);
      this.confirmDelete = false;
      this.current = '';
      await this.refresh();
      this.dispatchEvent(new CustomEvent('sets-changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.open) return nothing;
    const cur = this.sets.find((s) => s.id === this.current);
    return html`<sw-dialog open heading="תמונות למסכי קיר" data-wall-photos-dialog @close=${() => this.close()}>
      <div class="sets" data-wall-photo-sets>${this.sets.map((s) => html`<button class="set" aria-pressed=${s.id === this.current} data-wall-set=${s.id} @click=${() => { this.current = s.id; this.confirmDelete = false; void this.loadPhotos(); }}>${s.name} · ${s.count}</button>`)}</div>
      <div class="row"><sw-field label="תיקייה חדשה"><input type="text" maxlength="40" aria-label="שם תיקייה חדשה" data-wall-new-set .value=${this.name} @input=${(e: Event) => (this.name = (e.target as HTMLInputElement).value)} /></sw-field>
        <sw-button size="sm" data-wall-create-set ?disabled=${this.busy || !this.name.trim()} @click=${() => void this.create()}>הוספה</sw-button></div>
      ${cur
        ? html`<div class="row"><b>${cur.name}</b><span class="muted">${cur.count} מתוך ${this.limits.max_files}${cur.used_by.length ? ` · בשימוש: ${cur.used_by.join(', ')}` : ''}</span></div>
          <div class="row"><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="העלאת תמונות" data-wall-upload ?disabled=${this.busy} @change=${(e: Event) => { const el = e.target as HTMLInputElement; void this.upload(el.files).then(() => (el.value = '')); }} />
            ${this.progress ? html`<span class="muted" data-wall-progress>${this.progress}</span>` : nothing}</div>
          <div class="muted">JPEG, PNG או WebP · עד 8MB לתמונה · התמונות נשמרות בשרת בלבד (בגודל מסך), בלי נתוני מיקום</div>
          <div class="grid" data-wall-photo-grid>${this.photos.map((p) => html`<div class="ph" data-wall-photo=${p.id}><img loading="lazy" alt="" src=${photoPreviewUrl(cur.id, p.id)} /><button aria-label="מחיקת תמונה" data-wall-photo-del=${p.id} @click=${() => void this.removePhoto(p.id)}>×</button></div>`)}</div>
          ${this.confirmDelete
            ? html`<div class="row"><span class="warn">למחוק את התיקייה וכל התמונות שבה?${cur.used_by.length ? ' מסגרת התמונות במסכים שמשתמשים בה תכבה.' : ''}</span><sw-button size="sm" variant="danger" data-wall-set-delete-confirm ?disabled=${this.busy} @click=${() => void this.removeSet()}>מחיקה</sw-button><sw-button size="sm" variant="ghost" @click=${() => (this.confirmDelete = false)}>ביטול</sw-button></div>`
            : html`<sw-button size="sm" variant="ghost" data-wall-set-delete @click=${() => (this.confirmDelete = true)}>מחיקת התיקייה</sw-button>`}`
        : html`<p class="muted" data-wall-photos-empty>אין תיקיות עדיין. הוסיפו תיקייה והעלו אליה תמונות.</p>`}
      ${this.error ? html`<div class="warn" role="alert" data-wall-photos-error>${this.error}</div>` : nothing}
      <sw-button slot="footer" variant="primary" @click=${() => this.close()}>סגירה</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-wall-photo-sets': SwWallPhotoSets;
  }
}

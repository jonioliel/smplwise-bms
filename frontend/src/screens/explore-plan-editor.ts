import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../map/sw-plan-canvas';
import type { PlanMarker, MarkerSelectDetail } from '../map/sw-plan-canvas';
import type { IconName } from '../components/sw-icon';
import { navigate } from '../router';
import { cameraState, createAnchor, deleteAnchor, loadMap, publishVersion, updateAnchor, type MapBundle } from '../api/maps';
import { ApiError, describeError } from '../api/client';
import type { Anchor, Camera } from '../api/types';

const TOOLS: { id: string; icon: IconName; label: string; ready: boolean }[] = [
  { id: 'select', icon: 'target', label: 'בחירה', ready: true },
  { id: 'camera', icon: 'camera', label: 'הוספת מצלמה', ready: true },
  { id: 'entity', icon: 'light', label: 'הוספת ישות', ready: false },
  { id: 'area', icon: 'map', label: 'ציור אזור', ready: false },
  { id: 'label', icon: 'list', label: 'תווית', ready: false },
  { id: 'scale', icon: 'fit', label: 'קנה מידה', ready: false },
];

/**
 * SC06 — floor plan editor (board 2 screen 13): drag pins on the published (or draft) background,
 * numeric X/Y/rotation/FOV, add cameras from the registry, delete, undo/redo, save with optimistic
 * revisions (409 → reload, nothing is overwritten silently), publish a draft plan.
 */
@customElement('explore-plan-editor')
export class ExplorePlanEditor extends LitElement {
  @property() floorId = '';
  @state() private bundle: MapBundle | null = null;
  @state() private anchors: Anchor[] = [];
  @state() private dirty = new Set<string>();
  @state() private undo: Anchor[][] = [];
  @state() private redo: Anchor[][] = [];
  @state() private selectedId: string | null = null;
  @state() private tool = 'select';
  @state() private busy = false;
  @state() private error = '';
  @state() private info = '';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 290px;
      gap: 12px;
      min-block-size: 560px;
      flex: 1;
    }
    .tools {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 6px;
      box-shadow: var(--sw-shadow-1);
      align-self: start;
    }
    .tools button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 2px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: 9.5px;
      cursor: pointer;
    }
    .tools button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .tools button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .canvaswrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar .grow {
      flex: 1;
    }
    .autosave {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .autosave i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .autosave.dirty i {
      background: var(--sw-stale);
    }
    .canvas {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      position: relative;
      min-block-size: 480px;
      flex: 1;
      box-shadow: var(--sw-shadow-1);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .camlist {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 220px;
      overflow: auto;
    }
    .camlist button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .camlist button:hover {
      background: var(--sw-accent-soft);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 56px minmax(0, 1fr);
      }
      .props {
        grid-column: 1 / -1;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.error = '';
    try {
      const b = await loadMap(this.floorId || 'f0', true);
      this.bundle = b;
      this.anchors = b.anchors.map((a) => ({ ...a, position: { ...a.position } }));
      this.dirty = new Set();
      this.undo = [];
      this.redo = [];
      if (this.selectedId && !this.anchors.some((a) => a.id === this.selectedId)) this.selectedId = null;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private get markers(): PlanMarker[] {
    return this.anchors.map((a) => ({
      id: a.id,
      kind: a.resource_type === 'camera' ? 'camera' : a.layer_id === 'doors' ? 'lock' : a.layer_id === 'lights' ? 'light' : 'binary_sensor',
      label: a.camera?.name ?? a.label ?? a.resource_id,
      x: a.position.x,
      y: a.position.y,
      rotation: a.rotation_degrees,
      fov: a.field_of_view_degrees ?? undefined,
      state: a.resource_type === 'camera' ? (this.bundle?.source === 'demo' ? 'live' : cameraState(a)) : 'neutral',
    }));
  }

  private snapshot() {
    this.undo = [...this.undo.slice(-30), this.anchors.map((a) => ({ ...a, position: { ...a.position } }))];
    this.redo = [];
  }

  private apply(id: string, patch: Partial<Anchor> & { position?: { x: number; y: number } }) {
    this.snapshot();
    this.anchors = this.anchors.map((a) => (a.id === id ? { ...a, ...patch, position: patch.position ?? a.position } : a));
    this.dirty = new Set(this.dirty).add(id);
  }

  private doUndo() {
    const prev = this.undo[this.undo.length - 1];
    if (!prev) return;
    this.redo = [...this.redo, this.anchors];
    this.undo = this.undo.slice(0, -1);
    this.anchors = prev;
    this.dirty = new Set(this.anchors.map((a) => a.id));
  }

  private doRedo() {
    const next = this.redo[this.redo.length - 1];
    if (!next) return;
    this.undo = [...this.undo, this.anchors];
    this.redo = this.redo.slice(0, -1);
    this.anchors = next;
    this.dirty = new Set(this.anchors.map((a) => a.id));
  }

  private async save(): Promise<boolean> {
    if (!this.bundle || this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: השינויים נשמרים רק במסך זה.';
      this.dirty = new Set();
      return true;
    }
    this.busy = true;
    this.error = '';
    let conflict = false;
    try {
      for (const id of this.dirty) {
        const a = this.anchors.find((x) => x.id === id);
        if (!a) continue;
        try {
          const saved = await updateAnchor(id, { revision: a.revision, x: a.position.x, y: a.position.y, rotation_degrees: a.rotation_degrees, field_of_view_degrees: a.field_of_view_degrees, label: a.label });
          this.anchors = this.anchors.map((x) => (x.id === id ? { ...x, revision: saved.revision } : x));
        } catch (err) {
          if (err instanceof ApiError && err.code === 'stale_revision') conflict = true;
          else throw err;
        }
      }
      if (conflict) {
        this.error = 'חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.';
        await this.load();
        return false;
      }
      this.dirty = new Set();
      this.info = 'נשמר';
      setTimeout(() => (this.info = ''), 2000);
      return true;
    } catch (err) {
      this.error = describeError(err);
      return false;
    } finally {
      this.busy = false;
    }
  }

  private async addCamera(cam: Camera) {
    if (!this.bundle) return;
    if (this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: הוספה עובדת מול השרת.';
      return;
    }
    if (this.dirty.size && !(await this.save())) return;
    this.busy = true;
    this.error = '';
    try {
      const a = await createAnchor(this.bundle.floorId, { resource_type: 'camera', resource_id: cam.id, x: 0.5, y: 0.5, rotation_degrees: 0, field_of_view_degrees: 70 });
      await this.load();
      this.selectedId = a.id;
      this.tool = 'select';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async removeSelected() {
    const a = this.anchors.find((x) => x.id === this.selectedId);
    if (!a || !this.bundle) return;
    if (this.bundle.source === 'demo') {
      this.snapshot();
      this.anchors = this.anchors.filter((x) => x.id !== a.id);
      this.selectedId = null;
      return;
    }
    if (!window.confirm(`להסיר את "${a.camera?.name ?? a.resource_id}" מהמפה? (המצלמה עצמה נשארת רשומה)`)) return;
    this.busy = true;
    try {
      await deleteAnchor(a.id);
      this.selectedId = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async publish() {
    if (!this.bundle?.planVersionId || this.bundle.source === 'demo') return;
    if (this.dirty.size && !(await this.save())) return;
    this.busy = true;
    try {
      await publishVersion(this.bundle.planVersionId);
      await this.load();
      this.info = 'התוכנית פורסמה';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const b = this.bundle;
    if (this.error && !b) return html`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    if (!b) return html`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const sel = this.anchors.find((a) => a.id === this.selectedId);
    const anchoredIds = new Set(this.anchors.map((a) => a.resource_id));
    const available = b.cameras.filter((c) => !anchoredIds.has(c.id));
    const dirty = this.dirty.size;
    return html`
      <sw-page heading="עורך תוכנית קומה" subheading=${`${b.buildingName} · ${b.floorName} · ${b.planStatus === 'draft' ? 'טיוטה' : b.planStatus === 'published' ? 'תוכנית מפורסמת' : 'אין תוכנית'}${b.source === 'demo' ? ' · נתוני הדגמה' : ''}`} crumbs=${`אתרים | ${b.siteName} | ${b.buildingName} | ${b.floorName}`} wide>
        <sw-button slot="actions" variant="ghost" iconOnly icon="history" label="בטל" ?disabled=${!this.undo.length} @click=${() => this.doUndo()}></sw-button>
        <sw-button slot="actions" variant="ghost" iconOnly icon="refresh" label="בצע שוב" ?disabled=${!this.redo.length} @click=${() => this.doRedo()}></sw-button>
        <sw-button slot="actions" ?disabled=${!dirty || this.busy} @click=${() => this.save()}>${dirty ? `שמירה (${dirty})` : 'שמור'}</sw-button>
        ${b.planStatus === 'draft' && b.permissions.publish ? html`<sw-button slot="actions" variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.publish()}>פרסום</sw-button>` : html`<sw-button slot="actions" variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${b.floorId}`)}>למפה</sw-button>`}
        ${b.planStatus === 'none'
          ? html`<sw-state-panel state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>העלאת תוכנית</sw-button></div></sw-state-panel>`
          : html`<div class="layout">
              <div class="tools">${TOOLS.map((t) => html`<button class=${t.id === this.tool ? 'on' : ''} ?disabled=${!t.ready} title=${t.ready ? t.label : `${t.label} · בקרוב`} @click=${() => (this.tool = t.id)}><sw-icon .name=${t.icon} size=${18}></sw-icon>${t.label}</button>`)}</div>
              <div class="canvaswrap">
                <div class="bar">
                  <span class="autosave ${dirty ? 'dirty' : ''}"><i></i>${dirty ? `${dirty} שינויים לא שמורים` : 'הכל שמור'}</span>
                  ${this.info ? html`<span style="color:#15803d">${this.info}</span>` : nothing}
                  ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
                  <span class="grow"></span>
                  ${b.needsAlignment ? html`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>` : nothing}
                  <sw-badge kind="unknown" label="קנה מידה: לא מכויל"></sw-badge>
                  <span>גרור סיכה כדי להזיז · לחיצה בוחרת</span>
                </div>
                <div class="canvas">
                  <sw-plan-canvas editable alwaysLabel .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                    @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => (this.selectedId = e.detail.id)}
                    @marker-move=${(e: CustomEvent<{ id: string; x: number; y: number }>) => { this.apply(e.detail.id, { position: { x: +e.detail.x.toFixed(4), y: +e.detail.y.toFixed(4) } }); this.selectedId = e.detail.id; }}></sw-plan-canvas>
                </div>
              </div>
              <div class="props">
                ${this.tool === 'camera'
                  ? html`<sw-card heading="הוספת מצלמה" subheading="מצלמות רשומות שעדיין לא הוצבו על הקומה">
                      ${available.length
                        ? html`<div class="camlist">${available.map((c) => html`<button @click=${() => this.addCamera(c)}><span>${c.name}</span><span class="ltr">ch ${c.channel} · ${c.status}</span></button>`)}</div>`
                        : html`<div class="note">${b.cameras.length ? 'כל המצלמות הרשומות כבר מוצבות על הקומה.' : 'אין מצלמות רשומות. סנכרן מה־NVR במסך "בריאות מצלמות" או רשום ידנית.'}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${() => navigate('/system/devices')}>למצלמות</sw-button></div>`}
                    </sw-card>`
                  : nothing}
                <sw-card heading=${sel ? sel.camera?.name ?? sel.label ?? sel.resource_id : 'מאפיינים'}>
                  ${sel
                    ? html`
                        <div class="two">
                          <sw-field label="X (0–1)"><input type="number" step="0.001" min="0" max="1" data-ltr .value=${sel.position.x.toFixed(3)} @change=${(e: Event) => this.apply(sel.id, { position: { x: Math.min(1, Math.max(0, Number((e.target as HTMLInputElement).value))), y: sel.position.y } })} /></sw-field>
                          <sw-field label="Y (0–1)"><input type="number" step="0.001" min="0" max="1" data-ltr .value=${sel.position.y.toFixed(3)} @change=${(e: Event) => this.apply(sel.id, { position: { x: sel.position.x, y: Math.min(1, Math.max(0, Number((e.target as HTMLInputElement).value))) } })} /></sw-field>
                          <sw-field label="כיוון (°)"><input type="number" step="5" min="0" max="359" data-ltr .value=${String(Math.round(sel.rotation_degrees))} @change=${(e: Event) => this.apply(sel.id, { rotation_degrees: ((Number((e.target as HTMLInputElement).value) % 360) + 360) % 360 })} /></sw-field>
                          <sw-field label="זווית ראייה (°)"><input type="number" step="5" min="10" max="180" data-ltr .value=${String(Math.round(sel.field_of_view_degrees ?? 70))} @change=${(e: Event) => this.apply(sel.id, { field_of_view_degrees: Math.min(360, Math.max(1, Number((e.target as HTMLInputElement).value))) })} /></sw-field>
                        </div>
                        <sw-field label="תווית (אופציונלי)"><input .value=${sel.label ?? ''} @change=${(e: Event) => this.apply(sel.id, { label: (e.target as HTMLInputElement).value || null })} /></sw-field>
                        <div class="note">revision ${sel.revision} · ${sel.resource_type === 'camera' ? `ערוץ ${sel.camera?.channel ?? '?'}` : sel.resource_id}</div>
                        <div style="display:flex;gap:8px;margin-block-start:6px"><sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${() => this.removeSelected()}>הסר מהמפה</sw-button></div>`
                    : html`<div class="note">בחר סיכה במפה, או הוסף מצלמה מסרגל הכלים. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.</div>`}
                </sw-card>
                <sw-card heading="גרסת תוכנית">
                  <div class="note">${b.planStatus === 'draft' ? 'טיוטה: צופים עדיין רואים את הגרסה הקודמת (אם קיימת). פרסום יוצר PlanVersion מאושרת ונרשם באודיט.' : 'גרסה מפורסמת. תוכנית חדשה מועלית דרך "ייבוא תוכנית"; העוגנים נשמרים ומסומנים לבדיקה אם הגאומטריה השתנתה.'}</div>
                  <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>ייבוא תוכנית</sw-button></div>
                </sw-card>
              </div>
            </div>`}
      </sw-page>
    `;
  }
}

/**
 * Plan Studio side panel of the plan editor (T084): the structure tool - draw mode, wall defaults, the selected wall /
 * opening / label, validation issues, copy from another version, exports. Pure render functions: the editor owns the
 * state and passes callbacks; its shadow root provides the shared classes (.row, .two, .note, .btns, .err).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { CopyCandidate, GeometryIssue } from '../api/geometry';
import { COLOR_TOKENS, OBJECT_SHAPES, SYMBOL_IDS, effectiveScale, lengthPx, perimeterM, polygonAreaM2, type GeometryDoc, type GeomGroup, type GeomSize, type ObjectShape, type GeomLabel, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Pt, type Swing, type WallKind } from '../map/geometry';
import type { CatalogItem, CatalogLibrary, ParamSpec } from '../api/plan-catalog';
import { searchItems } from '../api/plan-catalog';
import type { SaveState } from '../map/studio-controller';
import { cornerRemovable, kindDefaults, openingRange, type WallDefaults } from '../map/studio-ops';

export type StudioMode = 'select' | 'wall' | 'door' | 'window' | 'passage' | 'label';
export type GeomKind = 'wall' | 'opening' | 'label' | 'object' | 'connector' | 'group';
export interface GeomSel {
  id: string;
  kind: GeomKind;
  /** A selected corner of the selected wall (select mode): the arrow keys move it. */
  vertex?: number;
}

/** The second help line of the opening modes: an existing opening is taken, not doubled (owner report on 0.1.82). */
const OPENING_DRAG_HINT = 'גרירת פתח קיים מזיזה אותו לאורך הקיר; חצים להזזה עדינה (Shift = צעד גדול)';

export const STUDIO_MODES: { id: StudioMode; label: string; hint: string; drag?: string }[] = [
  { id: 'select', label: 'בחירה', hint: 'לחץ על קיר, פתח או תווית כדי לערוך. גרור פתח לאורך הקיר, תווית למקומה ופינה של קיר נבחר; החצים מזיזים בעדינות פתח, תווית או פינה שנבחרו (Shift = צעד גדול).' },
  { id: 'wall', label: 'קיר', hint: 'לחץ נקודה אחר נקודה. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, לחיצה על הנקודה הראשונה סוגרת מתאר, Shift מבטל הצמדה לזוויות, Backspace מוחק נקודה.' },
  { id: 'door', label: 'דלת', hint: 'לחץ על קיר כדי להציב דלת. כיוון הפתיחה והציר נקבעים כאן בפאנל.', drag: OPENING_DRAG_HINT },
  { id: 'window', label: 'חלון', hint: 'לחץ על קיר כדי להציב חלון.', drag: OPENING_DRAG_HINT },
  { id: 'passage', label: 'מעבר', hint: 'פתח בלי דלת בקיר.', drag: OPENING_DRAG_HINT },
  { id: 'label', label: 'תווית', hint: 'לחץ במקום התווית ואז הקלד את הטקסט כאן בפאנל.', drag: 'גרירת תווית קיימת מזיזה אותה; חצים להזזה עדינה (Shift = צעד גדול)' },
];

const WALL_KIND_LABEL: Record<WallKind, string> = { exterior: 'חיצוני', interior: 'פנימי', partition: 'מחיצה', railing: 'מעקה', low: 'קיר נמוך' };
const OPENING_KIND_LABEL: Record<OpeningKind, string> = { door: 'דלת', window: 'חלון', passage: 'מעבר' };
const SWING_LABEL: Record<Swing, string> = { right: 'לצד ימין של הקיר', left: 'לצד שמאל של הקיר', double: 'כנף כפולה', sliding: 'הזזה', none: 'ללא כנף' };
const HINGE_LABEL: Record<Hinge, string> = { start: 'בצד תחילת הקיר', end: 'בצד סוף הקיר' };
const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'טיוטת המבנה',
  pending: 'שינויים ממתינים לשמירה…',
  saving: 'שומר…',
  saved: 'הטיוטה נשמרה · הצופים יראו אותה אחרי פרסום',
  error: 'השמירה נכשלה',
};

/** Hebrew names of the document's collections (publish previews). */
export const COLL_LABEL: Record<string, string> = {
  walls: 'קירות',
  openings: 'פתחים',
  labels: 'תוויות',
  levels: 'מפלסים',
  rooms: 'חדרים',
  objects: 'עצמים',
  circuits: 'מעגלי תאורה',
  connectors: 'מחברים',
  groups: 'קבוצות',
};

/** Metres for display: "≈" when the plan is not calibrated (design section 6). Owner decision 2026-09-23: the setting
 * `plan.estimates` = false hides metres until the plan is calibrated (`show` = false). */
export function fmtMetres(m: number, estimated: boolean, show = true): string {
  if (estimated && !show) return 'לא מכויל';
  return `${estimated ? '≈' : ''}${m < 10 ? m.toFixed(2) : m.toFixed(1)} מ׳`;
}

/** A count with its noun: the singular phrase for one ("קיר אחד"), otherwise the number and the plural ("3 קירות"). */
export function countLabel(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

export function fmtScale(scaleMPerPx: number): string {
  return `1 מ׳ = ${(1 / scaleMPerPx).toFixed(1)} פיקסלים בתוכנית`;
}

export function fmtArea(m2: number, estimated: boolean, show = true): string {
  if (estimated && !show) return 'לא מכויל';
  return `${estimated ? '≈' : ''}${m2 < 100 ? m2.toFixed(1) : m2.toFixed(0)} מ״ר`;
}

export interface StudioView {
  doc: GeometryDoc;
  W: number;
  H: number;
  mode: StudioMode;
  wallDefaults: WallDefaults;
  sel: GeomSel | null;
  saveState: SaveState;
  saveError: string;
  /** The last save was refused as stale: only a reload helps (a retry would overwrite the other editor). */
  conflict: boolean;
  issues: GeometryIssue[];
  copyCandidates: CopyCandidate[];
  exportSvg: string;
  exportPng: string;
  busy: boolean;
  /** Setting `plan.estimates`: show estimated metres ("≈") before calibration, or hide them. */
  showEstimates: boolean;
}

export interface StudioActions {
  setMode(mode: StudioMode): void;
  setWallDefaults(d: WallDefaults): void;
  patchWall(id: string, patch: Partial<GeomWall>): void;
  patchOpening(id: string, patch: Partial<GeomOpening>): void;
  patchLabel(id: string, patch: Partial<GeomLabel>): void;
  remove(id: string): void;
  focus(id: string): void;
  copyFrom(versionId: string): void;
  exportJson(): void;
  reload(): void;
  calibrate(): void;
  retry(): void;
}

const numberOf = (e: Event): number => parseFloat((e.target as HTMLInputElement).value);

export function renderStudioPanel(v: StudioView, a: StudioActions): TemplateResult {
  const { scale, estimated } = effectiveScale(v.doc);
  const errors = v.issues.filter((i) => i.severity === 'error');
  const warnings = v.issues.filter((i) => i.severity === 'warning');
  const mode = STUDIO_MODES.find((m) => m.id === v.mode) ?? STUDIO_MODES[0];
  const empty = !v.doc.walls.length && !v.doc.openings.length && !v.doc.labels.length;
  return html`<sw-card heading="מבנה" subheading=${SAVE_LABEL[v.saveState]} data-studio-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label="כלי ציור">
      ${STUDIO_MODES.map((m) => html`<button class=${m.id === v.mode ? 'on' : ''} data-studio-mode=${m.id} aria-pressed=${m.id === v.mode} @click=${() => a.setMode(m.id)}>${m.label}</button>`)}
    </div>
    <div class="note">${mode.hint}</div>
    ${mode.drag ? html`<div class="note" data-studio-drag-hint>${mode.drag}</div>` : nothing}
    ${v.mode === 'wall' ? renderWallDefaults(v.wallDefaults, a) : nothing}
    <div class="row"><span class="lbl">קנה מידה<span class="muted" data-studio-scale>${estimated ? (v.showEstimates ? 'לא מכויל: מידות משוערות (≈)' : 'לא מכויל: מידות מוסתרות עד הכיול') : fmtScale(scale)}</span></span><sw-button size="sm" icon="scale" data-studio-calibrate @click=${() => a.calibrate()}>${estimated ? 'כיול' : 'כיול מחדש'}</sw-button></div>
    <div class="note" data-studio-counts>${countLabel(v.doc.walls.length, 'קיר אחד', 'קירות')} · ${countLabel(v.doc.openings.length, 'פתח אחד', 'פתחים')} · ${countLabel(v.doc.labels.length, 'תווית אחת', 'תוויות')}</div>
    ${v.sel ? renderSelection(v, v.sel, a, scale, estimated) : nothing}
    ${errors.length || warnings.length ? renderIssues(errors, warnings, a) : nothing}
    ${empty && v.copyCandidates.length ? renderCopy(v.copyCandidates, a, v.busy) : nothing}
    <div class="exports" role="group" aria-label="ייצוא המבנה">
      <a class="btnlink" data-export-svg href=${v.exportSvg} download>SVG</a>
      <a class="btnlink" data-export-png href=${v.exportPng} download>PNG</a>
      <button class="btnlink" data-export-json @click=${() => a.exportJson()}>JSON</button>
      <span class="note">ייצוא הטיוטה כפי שהיא</span>
    </div>
    ${v.saveState === 'error'
      ? html`<div class="err">${v.saveError} ${v.conflict
          ? html`<button class="linkbtn" data-studio-reload @click=${() => a.reload()}>טען מחדש</button>`
          : html`<button class="linkbtn" data-studio-retry @click=${() => a.retry()}>נסה שוב</button>`}</div>`
      : nothing}
  </sw-card>`;
}

function renderWallDefaults(d: WallDefaults, a: StudioActions) {
  return html`<div class="two">
    <sw-field label="עובי קיר (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr data-wall-thickness .value=${String(d.thickness_m)}
      @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.setWallDefaults({ ...d, thickness_m: x }); }} /></sw-field>
    <sw-field label="סוג קיר"><select aria-label="סוג קיר" data-wall-kind @change=${(e: Event) => a.setWallDefaults({ ...d, kind: (e.target as HTMLSelectElement).value as WallKind })}>
      ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${d.kind === k}>${WALL_KIND_LABEL[k]}</option>`)}
    </select></sw-field>
  </div>`;
}

function renderSelection(v: StudioView, sel: GeomSel, a: StudioActions, scale: number, estimated: boolean) {
  if (sel.kind === 'wall') {
    const w = v.doc.walls.find((x) => x.id === sel.id);
    return w ? renderWall(w, v, a, scale, estimated) : nothing;
  }
  if (sel.kind === 'opening') {
    const o = v.doc.openings.find((x) => x.id === sel.id);
    return o ? renderOpening(o, v, a, scale, estimated) : nothing;
  }
  const l = v.doc.labels.find((x) => x.id === sel.id);
  return l ? renderLabel(l, a) : nothing;
}

function renderWall(w: GeomWall, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  const len = lengthPx(w.polyline, v.W, v.H) * scale;
  const openings = v.doc.openings.filter((o) => o.wall_id === w.id).length;
  return html`<div class="sel" data-selected-wall=${w.id}>
    <div class="selhead"><strong>קיר ${WALL_KIND_LABEL[w.kind]}</strong><span class="muted">${fmtMetres(len, estimated, v.showEstimates)} · ${countLabel(openings, 'פתח אחד', 'פתחים')}</span></div>
    <div class="two">
      <sw-field label="עובי (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr .value=${String(w.thickness_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.patchWall(w.id, { thickness_m: x }); }} /></sw-field>
      <sw-field label="סוג"><select aria-label="סוג קיר" @change=${(e: Event) => a.patchWall(w.id, { kind: (e.target as HTMLSelectElement).value as WallKind })}>
        ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${w.kind === k}>${WALL_KIND_LABEL[k]}</option>`)}
      </select></sw-field>
    </div>
    <sw-field label="גובה (מ׳, ריק = עד התקרה)"><input type="number" min="0.1" max="50" step="0.1" data-ltr .value=${w.height_m === null ? '' : String(w.height_m)}
      @change=${(e: Event) => { const raw = (e.target as HTMLInputElement).value.trim(); const x = parseFloat(raw); if (!raw) a.patchWall(w.id, { height_m: null }); else if (x > 0 && x <= 50) a.patchWall(w.id, { height_m: x }); }} /></sw-field>
    ${v.mode === 'select' && v.sel?.vertex !== undefined
      ? html`<div class="note" data-selected-vertex=${v.sel.vertex}>פינה ${v.sel.vertex + 1} נבחרה: החצים מזיזים אותה (Shift = צעד גדול); ${cornerRemovable(w.polyline) ? 'Delete מוחק את הפינה.' : 'Delete מוחק את כל הקיר, כי בלי הפינה לא נשאר קיר.'}</div>`
      : nothing}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(w.id)}>מחק קיר</sw-button><span class="note">הפתחים שבקיר נמחקים איתו</span></div>
  </div>`;
}

/** Where the opening sits on its wall, typed exactly: metres from the wall's start to the opening's centre on a calibrated
 * plan, a percentage of the wall before calibration. Kept inside the wall (the validator's opening_outside_wall). The
 * value follows every move - a drag (the panel is given the drag's preview), the arrow keys, undo. */
function renderPlacement(o: GeomOpening, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  const w = v.doc.walls.find((x) => x.id === o.wall_id);
  const lengthM = w ? lengthPx(w.polyline, v.W, v.H) * scale : 0;
  if (!(lengthM > 0)) return nothing;
  const [lo, hi] = openingRange(o.width_m, lengthM);
  // metres: two decimals; the percentage: one
  const fmt = (t: number) => (estimated ? (t * 100).toFixed(1) : (t * lengthM).toFixed(2));
  const set = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const x = parseFloat(input.value);
    const t = Number.isFinite(x) ? Math.min(hi, Math.max(lo, estimated ? x / 100 : x / lengthM)) : o.t;
    if (t !== o.t) a.patchOpening(o.id, { t });
    input.value = fmt(t); // shows the kept value also when the clamp left the position as it was
  };
  // The arrow keys work in screen directions: the opening follows the arrow along its wall (owner ruling on 0.1.83).
  const keys = 'חצים מזיזים את הפתח לכיוון החץ לאורך הקיר.';
  return estimated
    ? html`<sw-field label="מיקום על הקיר (%)" hint=${`מרכז הפתח: 0 = תחילת הקיר, 100 = סופו. ${keys}`}><input type="number" min="0" max="100" step="0.1" data-ltr data-opening-percent
        aria-label="מיקום על הקיר (%)" .value=${fmt(o.t)} @change=${set} /></sw-field>`
    : html`<sw-field label="מרחק מתחילת הקיר (מ׳)" hint=${`עד מרכז הפתח; אורך הקיר ${lengthM.toFixed(2)} מ׳. ${keys}`}><input type="number" min=${(lo * lengthM).toFixed(2)} max=${(hi * lengthM).toFixed(2)} step="0.01"
        data-ltr data-opening-distance aria-label="מרחק מתחילת הקיר (מ׳)" .value=${fmt(o.t)} @change=${set} /></sw-field>`;
}

function renderOpening(o: GeomOpening, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  return html`<div class="sel" data-selected-opening=${o.id}>
    <div class="selhead"><strong>${OPENING_KIND_LABEL[o.kind]}</strong><span class="muted">${o.width_m.toFixed(2)} מ׳ רוחב${o.anchor_ref ? ' · מקושר לישות' : ''}</span></div>
    <div class="two">
      <sw-field label="סוג"><select aria-label="סוג פתח" @change=${(e: Event) => a.patchOpening(o.id, kindDefaults((e.target as HTMLSelectElement).value as OpeningKind))}>
        ${(Object.keys(OPENING_KIND_LABEL) as OpeningKind[]).map((k) => html`<option value=${k} ?selected=${o.kind === k}>${OPENING_KIND_LABEL[k]}</option>`)}
      </select></sw-field>
      <sw-field label="רוחב (מ׳)"><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(o.width_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 10) a.patchOpening(o.id, { width_m: x }); }} /></sw-field>
    </div>
    ${renderPlacement(o, v, a, scale, estimated)}
    <div class="two">
      <sw-field label="גובה (מ׳)"><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(o.height_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 10) a.patchOpening(o.id, { height_m: x }); }} /></sw-field>
      ${o.kind === 'window'
        ? html`<sw-field label="גובה אדן (מ׳)"><input type="number" min="0" max="10" step="0.05" data-ltr .value=${String(o.sill_m)}
            @change=${(e: Event) => { const x = numberOf(e); if (x >= 0 && x <= 10) a.patchOpening(o.id, { sill_m: x }); }} /></sw-field>`
        : nothing}
    </div>
    ${o.kind === 'door'
      ? html`<div class="two">
          <sw-field label="כיוון פתיחה"><select aria-label="כיוון פתיחה" @change=${(e: Event) => a.patchOpening(o.id, { swing: (e.target as HTMLSelectElement).value as Swing })}>
            ${(Object.keys(SWING_LABEL) as Swing[]).map((k) => html`<option value=${k} ?selected=${o.swing === k}>${SWING_LABEL[k]}</option>`)}
          </select></sw-field>
          <sw-field label="ציר"><select aria-label="ציר" @change=${(e: Event) => a.patchOpening(o.id, { hinge: (e.target as HTMLSelectElement).value as Hinge })}>
            ${(Object.keys(HINGE_LABEL) as Hinge[]).map((k) => html`<option value=${k} ?selected=${o.hinge === k}>${HINGE_LABEL[k]}</option>`)}
          </select></sw-field>
        </div>`
      : nothing}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>מחק ${OPENING_KIND_LABEL[o.kind]}</sw-button></div>
  </div>`;
}

function renderLabel(l: GeomLabel, a: StudioActions) {
  return html`<div class="sel" data-selected-label=${l.id}>
    <sw-field label="טקסט"><input type="text" maxlength="80" data-label-text .value=${l.text}
      @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patchLabel(l.id, { text: x }); }} /></sw-field>
    <sw-field label="גודל"><input type="number" min="6" max="200" step="1" data-ltr .value=${String(l.size)}
      @change=${(e: Event) => { const x = numberOf(e); if (x >= 6 && x <= 200) a.patchLabel(l.id, { size: x }); }} /></sw-field>
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(l.id)}>מחק תווית</sw-button></div>
  </div>`;
}

function renderIssues(errors: GeometryIssue[], warnings: GeometryIssue[], a: StudioActions) {
  return html`<div class="issues" data-studio-issues>
    <div class="ilbl">${errors.length ? `${errors.length} שגיאות חוסמות פרסום` : 'אין שגיאות חוסמות'}${warnings.length ? ` · ${warnings.length} אזהרות` : ''}</div>
    ${[...errors, ...warnings].slice(0, 20).map((i) => html`<button class="issue ${i.severity}" data-issue=${i.code} data-issue-id=${i.id ?? ''} ?disabled=${!i.id} @click=${() => { if (i.id) a.focus(i.id); }}>${i.message}</button>`)}
  </div>`;
}

function renderCopy(cands: CopyCandidate[], a: StudioActions, busy: boolean) {
  return html`<div class="copy" data-copy-candidates>
    <div class="ilbl">להתחיל ממבנה קיים?</div>
    ${cands.map((c) => html`<button class="issue" data-copy-from=${c.version_id} ?disabled=${busy} @click=${() => a.copyFrom(c.version_id)}>
      <span>העתק ${countLabel(c.walls, 'קיר אחד', 'קירות')} ו${c.openings === 1 ? '' : '־'}${countLabel(c.openings, 'פתח אחד', 'פתחים')} מגרסה ${c.status === 'published' ? 'מפורסמת' : c.status === 'draft' ? 'בטיוטה' : 'מהארכיון'}</span>
      <span class="muted">${c.same_drawing ? 'אותו שרטוט' : 'שרטוט אחר: המיקומים לא מיושרים, בדוק אותם'}</span>
    </button>`)}
  </div>`;
}

export interface CalibView {
  a: Pt | null;
  b: Pt | null;
  metres: string;
  /** Distance between the two points in plan pixels (null until both are set). */
  pixels: number | null;
  scale: number;
  estimated: boolean;
  showEstimates: boolean;
  result: string;
  warning: string;
  busy: boolean;
}

export function renderCalibPanel(v: CalibView, onMetres: (value: string) => void, onSave: () => void, onReset: () => void): TemplateResult {
  const metres = parseFloat(v.metres);
  // The server refuses a pair closer than 5 plan pixels and a distance over 1000 m.
  const tooClose = v.pixels !== null && v.pixels < 5;
  const ready = !!v.a && !!v.b && v.pixels !== null && v.pixels >= 5 && metres > 0 && metres <= 1000 && !v.busy;
  const notCalibrated = v.showEstimates ? 'התוכנית לא מכוילת: מידות מוצגות כמשוערות (≈)' : 'התוכנית לא מכוילת: מידות מוסתרות עד הכיול (הגדרות)';
  return html`<sw-card heading="כיול קנה מידה" subheading=${v.estimated ? notCalibrated : `מכויל · ${fmtScale(v.scale)}`} data-calib-panel>
    <ol class="steps">
      <li class=${v.a ? 'done' : ''}>לחץ על נקודה שהמרחק ממנה ידוע, למשל פינת קיר</li>
      <li class=${v.b ? 'done' : ''}>לחץ על הנקודה השנייה</li>
      <li>הקלד את המרחק האמיתי ביניהן</li>
    </ol>
    <sw-field label="מרחק (מ׳)"><input type="number" min="0.01" max="1000" step="0.01" data-ltr data-calib-metres .value=${v.metres} ?disabled=${!v.b}
      @input=${(e: Event) => onMetres((e.target as HTMLInputElement).value)} /></sw-field>
    ${v.pixels !== null
      ? html`<div class=${tooClose ? 'note err' : 'note'}>${v.pixels.toFixed(0)} פיקסלים בתוכנית${tooClose ? ' · הנקודות קרובות מדי' : metres > 0 ? ` · 1 מ׳ = ${(v.pixels / metres).toFixed(1)} פיקסלים` : ''}</div>`
      : nothing}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-calib-save ?disabled=${!ready} @click=${onSave}>שמור כיול</sw-button>
      <sw-button variant="ghost" size="sm" data-calib-reset @click=${onReset}>נקה נקודות</sw-button>
    </div>
    ${v.result ? html`<div class="note" data-calib-result>${v.result}</div>` : nothing}
    ${v.warning ? html`<div class="err" data-calib-warning>${v.warning}</div>` : nothing}
    <div class="note">המיקומים על המפה לא זזים, רק המטרים משתנים. הכיול נכנס לטיוטת המבנה והצופים רואים אותו אחרי פרסום.</div>
  </sw-card>`;
}

export function renderMeasurePanel(pts: Pt[], W: number, H: number, scale: number, estimated: boolean, show: boolean, onClear: () => void): TemplateResult {
  const total = pts.length > 1 ? lengthPx(pts, W, H) * scale : 0;
  const sub = estimated ? (show ? 'לא מכויל: הערכים משוערים (≈)' : 'לא מכויל: המידות מוסתרות עד הכיול (הגדרות)') : 'לפי הכיול של גרסת התוכנית';
  return html`<sw-card heading="מדידה" subheading=${sub} data-measure-panel>
    <div class="note">לחץ נקודות על התוכנית. Shift מבטל הצמדה לזוויות, Esc מנקה.</div>
    <div class="measure-val" data-measure-distance>${pts.length > 1 ? fmtMetres(total, estimated, show) : '—'}</div>
    ${pts.length >= 3
      ? html`<div class="note">שטח המצולע <span class="measure-val" data-measure-area>${fmtArea(polygonAreaM2(pts, W, H, scale), estimated, show)}</span> · היקף ${fmtMetres(perimeterM(pts, W, H, scale), estimated, show)}</div>`
      : nothing}
    <div class="btns"><sw-button variant="ghost" size="sm" data-measure-clear ?disabled=${!pts.length} @click=${onClear}>נקה</sw-button></div>
  </sw-card>`;
}

// ---------------------------------------------------------------- the library and the object inspector (T085)

export interface LibraryView {
  lib: CatalogLibrary;
  q: string;
  /** null = every category; 'recent' and 'favorites' are the two special shelves. */
  category: string | null;
  recent: string[];
  favorites: string[];
  placing: CatalogItem | null;
  saveState: SaveState;
  phone: boolean;
  exportHref: string;
  canManage: boolean;
}

export interface LibraryActions {
  setQuery(q: string): void;
  setCategory(id: string | null): void;
  pick(item: CatalogItem): void;
  toggleFavorite(id: string): void;
  importFile(file: File): void;
  cancelPlacing(): void;
}

/** The library list shows this many rows; a longer result says so and asks for a search or a category. */
const LIB_ROWS = 60;
/** The last search of the whole library or of a category (the pool is then the library's own item list): renders that
 * change nothing in the library, the query or the category reuse it. The recent and favourite shelves are short. */
let libMemo: { pool: CatalogItem[]; q: string; category: string | null; found: CatalogItem[] } | null = null;

function libSearch(pool: CatalogItem[], q: string, category: string | null): CatalogItem[] {
  if (libMemo && libMemo.pool === pool && libMemo.q === q && libMemo.category === category) return libMemo.found;
  const found = searchItems(pool, q, category);
  libMemo = { pool, q, category, found };
  return found;
}

export function renderLibraryPanel(v: LibraryView, a: LibraryActions): TemplateResult {
  const special = v.category === 'recent' || v.category === 'favorites';
  const pool = v.category === 'recent' ? v.recent.map((id) => v.lib.items.find((i) => i.id === id)).filter((i): i is CatalogItem => !!i)
    : v.category === 'favorites' ? v.lib.items.filter((i) => v.favorites.includes(i.id)) : v.lib.items;
  const found = libSearch(pool, v.q, special ? null : v.category);
  const items = found.slice(0, LIB_ROWS);
  return html`<sw-card heading="ספריית עצמים" subheading=${v.placing ? `לחץ על התוכנית כדי להציב: ${v.placing.names.he} · Esc לביטול` : `${v.lib.items.length} פריטים · חיפוש בעברית ובאנגלית`} data-library-panel data-studio-save=${v.saveState}>
    <sw-field><input type="search" data-lib-search placeholder="חיפוש: כיסא, מטף, bleachers…" .value=${v.q} @input=${(e: Event) => a.setQuery((e.target as HTMLInputElement).value)} /></sw-field>
    <div class="modes" role="group" aria-label="קטגוריות">
      <button class=${v.category === null ? 'on' : ''} data-lib-cat="all" @click=${() => a.setCategory(null)}>הכול</button>
      <button class=${v.category === 'recent' ? 'on' : ''} data-lib-cat="recent" @click=${() => a.setCategory('recent')}>לאחרונה</button>
      <button class=${v.category === 'favorites' ? 'on' : ''} data-lib-cat="favorites" @click=${() => a.setCategory('favorites')}>מועדפים</button>
      ${v.lib.categories.map((c) => html`<button class=${v.category === c.id ? 'on' : ''} data-lib-cat=${c.id} @click=${() => a.setCategory(c.id)}>${c.he}</button>`)}
    </div>
    ${v.placing ? html`<div class="btns"><sw-button size="sm" variant="ghost" data-lib-cancel @click=${() => a.cancelPlacing()}>סיים הצבה</sw-button></div>` : nothing}
    <div class="list libl">
      ${items.length ? items.map((i) => html`<div class="libitem ${v.placing?.id === i.id ? 'on' : ''}" data-lib-item=${i.id} role="button" tabindex="0" draggable="true" title=${`${i.names.he} · ${i.size.w_m}×${i.size.d_m}×${i.size.h_m} מ׳`}
          @dragstart=${(e: DragEvent) => e.dataTransfer?.setData('text/x-sw-item', i.id)} @click=${() => a.pick(i)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && a.pick(i)}>
          <span class="nm">${i.names.he}${i.custom ? html` <span class="muted">מותאם</span>` : nothing}</span>
          <span class="muted ltr">${i.size.w_m}×${i.size.d_m} m</span>
          <button class="fav ${v.favorites.includes(i.id) ? 'on' : ''}" data-lib-fav=${i.id} aria-label="מועדף" @click=${(e: Event) => { e.stopPropagation(); a.toggleFavorite(i.id); }}>★</button>
        </div>`) : html`<div class="note">${v.category === 'recent' ? 'עדיין לא הוצבו פריטים בדפדפן הזה.' : v.category === 'favorites' ? 'סמן ★ ליד פריט כדי לשמור אותו כאן.' : 'לא נמצאו פריטים.'}</div>`}
    </div>
    ${found.length > LIB_ROWS ? html`<div class="note" data-lib-more>מוצגים ${LIB_ROWS} · חפש או בחר קטגוריה</div>` : nothing}
    ${v.phone ? html`<div class="note">בטלפון: הצבה והזזה של עצם בודד; מערכים וציור קירות בדסקטופ.</div>` : nothing}
    ${v.canManage ? html`<div class="exports" role="group" aria-label="הספרייה המותאמת">
      <a class="btnlink" data-lib-export href=${v.exportHref} download>ייצוא הספרייה המותאמת</a>
      <label class="btnlink">ייבוא<input type="file" accept="application/json,.json" data-lib-import hidden @change=${(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) a.importFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>
    </div>` : nothing}
  </sw-card>`;
}

export interface ObjectView {
  o: GeomObject;
  item: CatalogItem | undefined;
  levels: GeomLevel[];
  doc: GeometryDoc;
  estimated: boolean;
  showEstimates: boolean;
  anchorName: string | null;
  phone: boolean;
  canManage: boolean;
  /** The Hebrew name of an item's category (the editor passes the library's list). */
  lib_category(item: CatalogItem): string;
}

export interface ObjectActions {
  patch(id: string, patch: Partial<GeomObject>): void;
  unbind(id: string): void;
  remove(id: string): void;
  /** Optional: a caller without them gets no array / custom item / select group control in the inspector. */
  array?: (id: string) => void;
  custom?: (id: string) => void;
  selectGroup?: (groupId: string) => void;
}

function paramField(o: GeomObject, name: string, spec: ParamSpec, levels: GeomLevel[], a: ObjectActions) {
  const value = o.params[name];
  if (spec.type === 'level') {
    return html`<sw-field label=${spec.he}><select data-object-param=${name} @change=${(e: Event) => a.patch(o.id, { params: { ...o.params, [name]: (e.target as HTMLSelectElement).value || null } })}>
      <option value="" ?selected=${!value}>ללא</option>${levels.filter((l) => l.id !== o.level_id).map((l) => html`<option value=${l.id} ?selected=${value === l.id}>${l.name} (${l.elevation_m} מ׳)</option>`)}</select></sw-field>`;
  }
  const step = spec.type === 'int' ? 1 : 0.1;
  return html`<sw-field label=${spec.he}><input type="number" data-ltr data-object-param=${name} min=${String(spec.min ?? '')} max=${String(spec.max ?? '')} step=${String(step)} .value=${value === null || value === undefined ? '' : String(value)}
    @change=${(e: Event) => { const x = spec.type === 'int' ? parseInt((e.target as HTMLInputElement).value, 10) : parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(x) && (spec.min === undefined || x >= spec.min) && (spec.max === undefined || x <= spec.max)) a.patch(o.id, { params: { ...o.params, [name]: x } }); }} /></sw-field>`;
}

export function renderObjectInspector(v: ObjectView, a: ObjectActions): TemplateResult {
  const o = v.o;
  const name = v.item?.names.he ?? o.item_id;
  const group = o.group_id ? v.doc.groups.find((g) => g.id === o.group_id) : undefined;
  // one hook per field (data-object-w / -d / -h): lit has no binding for an attribute's name, so each is a boolean attribute
  const size = (key: 'w_m' | 'd_m' | 'h_m', label: string) => html`<sw-field label=${label}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-object-w=${key === 'w_m'} ?data-object-d=${key === 'd_m'} ?data-object-h=${key === 'h_m'} .value=${String(o.size[key])}
      @change=${(e: Event) => { const x = numberOf(e); if (x >= 0.05 && x <= 100) a.patch(o.id, { size: { ...o.size, [key]: x } }); }} /></sw-field>`;
  return html`<sw-card heading=${name} subheading=${v.item ? `${v.lib_category(v.item)}${v.item.custom ? ' · פריט מותאם' : ''}` : 'הפריט לא קיים בספרייה: העצם מצויר כתיבה'} data-selected-object=${o.id}>
    <sw-field label="שם על המפה (אופציונלי)"><input type="text" maxlength="80" data-object-label .value=${o.label ?? ''} @change=${(e: Event) => a.patch(o.id, { label: (e.target as HTMLInputElement).value.trim() || null })} /></sw-field>
    ${o.anchor_ref
      ? html`<div class="note" data-object-bound>הגוף של ${v.anchorName ?? o.anchor_ref.resource_id}: המיקום, המצב וההרשאות מהעוגן. <button class="linkbtn" data-object-unbind @click=${() => a.unbind(o.id)}>נתק מהישות</button></div>`
      : nothing}
    <div class="two">
      <sw-field label="מפלס"><select data-item-level @change=${(e: Event) => a.patch(o.id, { level_id: (e.target as HTMLSelectElement).value })}>${v.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === o.level_id}>${l.name}</option>`)}</select></sw-field>
      <sw-field label="סיבוב (°)"><input type="number" min="0" max="359" step="1" data-ltr data-object-rotation .value=${String(Math.round(o.rotation_deg))} ?disabled=${!!o.anchor_ref}
        @change=${(e: Event) => { const x = numberOf(e); if (Number.isFinite(x)) a.patch(o.id, { rotation_deg: ((Math.round(x) % 360) + 360) % 360 }); }} /></sw-field>
    </div>
    <div class="three">${size('w_m', 'רוחב (מ׳)')}${size('d_m', 'עומק (מ׳)')}${size('h_m', 'גובה (מ׳)')}</div>
    <sw-field label="גובה מהרצפה (מ׳)"><input type="number" min="-50" max="500" step="0.05" data-ltr data-object-z .value=${String(o.z_m)} @change=${(e: Event) => { const x = numberOf(e); if (x >= -50 && x <= 500) a.patch(o.id, { z_m: x }); }} /></sw-field>
    ${v.item ? Object.entries(v.item.params_schema).map(([k, spec]) => paramField(o, k, spec, v.levels, a)) : nothing}
    ${group ? html`<div class="note" data-object-group>חלק ממערך של ${group.member_ids.length}${a.selectGroup ? html` · <button class="linkbtn" data-select-group @click=${() => a.selectGroup?.(group.id)}>בחר את המערך</button>` : nothing}</div>` : nothing}
    <div class="note">${v.estimated ? (v.showEstimates ? 'המידות במטרים משוערות (≈) עד הכיול' : 'לא מכויל: המידות מוצגות כערכי הפריט') : 'המידות במטרים לפי הכיול'} · חצים = הזזה עדינה (Shift = גדולה) · Alt+גרירה = שכפול · Delete = מחיקה</div>
    <div class="btns">
      ${a.array ? html`<sw-button size="sm" icon="grid" data-object-array ?disabled=${v.phone || !!o.anchor_ref} title=${v.phone ? 'מערכים בדסקטופ בלבד' : 'שורות × עמודות מהעצם הזה'} @click=${() => a.array?.(o.id)}>מערך</sw-button>` : nothing}
      ${v.canManage && a.custom ? html`<sw-button size="sm" icon="plus" data-object-custom @click=${() => a.custom?.(o.id)}>צור פריט מזה</sw-button>` : nothing}
      <sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>מחק</sw-button>
    </div>
  </sw-card>`;
}

// ---------------------------------------------------------------- groups, arrays and custom items (T085)

export interface GroupActions {
  select(objectId: string): void;
  askDelete(groupId: string): void;
}

export function renderGroupInspector(g: GeomGroup, item: CatalogItem | undefined, a: GroupActions): TemplateResult {
  const p = g.params as { rows?: number; cols?: number; spacing_x_m?: number; spacing_y_m?: number };
  return html`<sw-card heading=${g.kind === 'array' ? `מערך של ${g.member_ids.length}` : `קבוצה של ${g.member_ids.length}`} subheading=${item ? item.names.he : ''} data-selected-group=${g.id}>
    ${g.kind === 'array' && p.rows ? html`<div class="note">${p.rows} שורות × ${p.cols} עמודות · רווח ${p.spacing_x_m} × ${p.spacing_y_m} מ׳</div>` : nothing}
    <div class="note">גרירת אחד העצמים מזיזה את כל המערך · Delete מוחק (ושואל אם למחוק גם את העצמים)</div>
    <div class="btns">
      ${g.member_ids[0] ? html`<sw-button size="sm" variant="ghost" data-group-first @click=${() => a.select(g.member_ids[0])}>בחר עצם אחד</sw-button>` : nothing}
      <sw-button size="sm" variant="danger" icon="trash" data-group-delete @click=${() => a.askDelete(g.id)}>מחק מערך</sw-button>
    </div>
  </sw-card>`;
}

export interface ArrayDialogView {
  item: CatalogItem | undefined;
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  directionDeg: number;
  max: number;
}

export function renderArrayDialog(v: ArrayDialogView, onChange: (patch: Partial<ArrayDialogView>) => void, onCreate: () => void, onCancel: () => void): TemplateResult {
  const total = Math.floor(v.rows) * Math.floor(v.cols);
  const ok = total >= 2 && total <= v.max && v.spacingX > 0 && v.spacingY > 0;
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  return html`<sw-dialog open heading="מערך" subheading=${`שורות × עמודות של ${v.item?.names.he ?? 'העצם'}; העצם שנבחר הוא הראשון`} data-array-dialog @close=${onCancel}>
    <div class="two">
      <sw-field label="שורות"><input type="number" min="1" max="60" step="1" data-ltr data-array-rows .value=${String(v.rows)} @input=${(e: Event) => onChange({ rows: num(e) || 1 })} /></sw-field>
      <sw-field label="עמודות"><input type="number" min="1" max="60" step="1" data-ltr data-array-cols .value=${String(v.cols)} @input=${(e: Event) => onChange({ cols: num(e) || 1 })} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="רווח בין עמודות (מ׳)"><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sx .value=${String(v.spacingX)} @input=${(e: Event) => onChange({ spacingX: num(e) })} /></sw-field>
      <sw-field label="רווח בין שורות (מ׳)"><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sy .value=${String(v.spacingY)} @input=${(e: Event) => onChange({ spacingY: num(e) })} /></sw-field>
    </div>
    <sw-field label="כיוון (°)" hint="0 = העמודות ימינה והשורות למטה; 90 = מסובב"><input type="number" min="0" max="359" step="1" data-ltr data-array-dir .value=${String(v.directionDeg)} @input=${(e: Event) => onChange({ directionDeg: num(e) || 0 })} /></sw-field>
    <div class="note" data-array-total>${total} עצמים${total > v.max ? ` · יותר מ־${v.max} במערך אחד` : ''}</div>
    <sw-button slot="footer" variant="ghost" data-array-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-array-create ?disabled=${!ok} @click=${onCreate}>צור מערך</sw-button>
  </sw-dialog>`;
}

export function renderGroupDeleteDialog(count: number, onAll: () => void, onKeep: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading="מחיקת מערך" subheading=${`המערך מכיל ${count} עצמים`} data-group-delete-dialog @close=${onCancel}>
    <div class="note">למחוק גם את העצמים, או להשאיר אותם על המפה כעצמים בודדים?</div>
    <sw-button slot="footer" variant="ghost" data-group-delete-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" data-group-delete-keep @click=${onKeep}>השאר את העצמים</sw-button>
    <sw-button slot="footer" variant="danger" icon="trash" data-group-delete-all @click=${onAll}>מחק הכול</sw-button>
  </sw-dialog>`;
}

export interface CustomItemView {
  nameHe: string;
  nameEn: string;
  category: string;
  shape: ObjectShape;
  icon: string;
  color: string;
  size: GeomSize;
  basedOn: string | null;
  busy: boolean;
  error: string;
}

export function renderCustomItemDialog(v: CustomItemView, lib: CatalogLibrary, onChange: (patch: Partial<CustomItemView>) => void, onCreate: () => void, onCancel: () => void): TemplateResult {
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  // one hook per field (data-custom-w / -d / -h): lit has no binding for an attribute's name, so each is a boolean attribute
  const sizeField = (key: keyof GeomSize, label: string) => html`<sw-field label=${label}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-custom-w=${key === 'w_m'} ?data-custom-d=${key === 'd_m'} ?data-custom-h=${key === 'h_m'} .value=${String(v.size[key])}
      @input=${(e: Event) => { const x = num(e); if (x >= 0.05 && x <= 100) onChange({ size: { ...v.size, [key]: x } }); }} /></sw-field>`;
  return html`<sw-dialog open heading="פריט מותאם" subheading=${v.basedOn ? `מבוסס על ${lib.items.find((i) => i.id === v.basedOn)?.names.he ?? v.basedOn}: הפריט החדש נשמר בספרייה של המתקן` : 'פריט חדש בספרייה של המתקן'} data-custom-dialog @close=${onCancel}>
    ${v.error ? html`<div class="err">${v.error}</div>` : nothing}
    <div class="two">
      <sw-field label="שם (עברית)"><input type="text" maxlength="80" data-custom-name .value=${v.nameHe} @input=${(e: Event) => onChange({ nameHe: (e.target as HTMLInputElement).value })} /></sw-field>
      <sw-field label="שם (אנגלית, לחיפוש)"><input type="text" maxlength="80" data-ltr data-custom-name-en .value=${v.nameEn} @input=${(e: Event) => onChange({ nameEn: (e.target as HTMLInputElement).value })} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="קטגוריה"><select data-custom-category @change=${(e: Event) => onChange({ category: (e.target as HTMLSelectElement).value })}>${lib.categories.map((c) => html`<option value=${c.id} ?selected=${c.id === v.category}>${c.he}</option>`)}</select></sw-field>
      <sw-field label="צורה"><select data-custom-shape @change=${(e: Event) => onChange({ shape: (e.target as HTMLSelectElement).value as ObjectShape })}>${OBJECT_SHAPES.map((s) => html`<option value=${s} ?selected=${s === v.shape}>${s}</option>`)}</select></sw-field>
    </div>
    <div class="two">
      <sw-field label="סמל"><select data-custom-icon @change=${(e: Event) => onChange({ icon: (e.target as HTMLSelectElement).value })}>${SYMBOL_IDS.map((s) => html`<option value=${s} ?selected=${s === v.icon}>${s}</option>`)}</select></sw-field>
      <sw-field label="צבע"><select data-custom-color @change=${(e: Event) => onChange({ color: (e.target as HTMLSelectElement).value })}>${COLOR_TOKENS.map((c) => html`<option value=${c} ?selected=${c === v.color}>${c}</option>`)}</select></sw-field>
    </div>
    <div class="three">${sizeField('w_m', 'רוחב (מ׳)')}${sizeField('d_m', 'עומק (מ׳)')}${sizeField('h_m', 'גובה (מ׳)')}</div>
    <div class="note">הגובה מהרצפה, הפרמטרים וסוגי הישויות נלקחים מהפריט שעליו הוא מבוסס.</div>
    <sw-button slot="footer" variant="ghost" data-custom-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-custom-create ?disabled=${v.busy || !v.nameHe.trim()} @click=${onCreate}>${v.busy ? 'שומר…' : 'צור פריט'}</sw-button>
  </sw-dialog>`;
}

export const studioPanelStyles = css`
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-block-end: 8px;
  }
  .modes button,
  .btnlink {
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: var(--sw-r-pill);
    padding: 4px 10px;
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    text-decoration: none;
  }
  .modes button.on {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: #fff;
  }
  .modes button:focus-visible,
  .btnlink:focus-visible,
  .issue:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  .sel {
    border-block-start: 1px solid var(--sw-border);
    margin-block-start: 10px;
    padding-block-start: 10px;
    display: grid;
    gap: 8px;
  }
  .selhead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .selhead .muted,
  .issue .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .issues,
  .copy {
    display: grid;
    gap: 4px;
    margin-block-start: 10px;
  }
  .ilbl {
    font-weight: 600;
    font-size: var(--sw-fs-sm);
  }
  .issue {
    text-align: start;
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: 8px;
    padding: 6px 8px;
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    display: grid;
    gap: 2px;
  }
  .issue.error {
    border-color: var(--sw-danger);
  }
  .issue.warning {
    border-color: var(--sw-warning);
  }
  .issue:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .exports {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-block-start: 10px;
  }
  .linkbtn {
    border: 0;
    background: none;
    color: var(--sw-accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
  .steps {
    margin: 0 0 8px;
    padding-inline-start: 18px;
    display: grid;
    gap: 2px;
    font-size: var(--sw-fs-sm);
  }
  .steps li.done {
    color: var(--sw-text-2);
    text-decoration: line-through;
  }
  .measure-val {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .three {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .libl {
    max-block-size: 320px;
  }
  .libitem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--sw-border);
    border-radius: 8px;
    background: var(--sw-surface);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .libitem:hover,
  .libitem.on {
    background: var(--sw-accent-soft);
    border-color: var(--sw-accent);
  }
  .libitem .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .libitem .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .libitem .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .libitem .fav {
    border: 0;
    background: none;
    color: var(--sw-text-3);
    font: inherit;
    cursor: pointer;
    padding: 0 2px;
  }
  .libitem .fav.on {
    color: var(--sw-warning);
  }
`;

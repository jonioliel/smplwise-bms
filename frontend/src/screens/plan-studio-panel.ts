/**
 * Plan Studio side panel of the plan editor (T084): the structure tool - draw mode, wall defaults, the selected wall /
 * opening / label, validation issues, copy from another version, exports. Pure render functions: the editor owns the
 * state and passes callbacks; its shadow root provides the shared classes (.row, .two, .note, .btns, .err).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { CopyCandidate, GeometryIssue } from '../api/geometry';
import { effectiveScale, lengthPx, perimeterM, polygonAreaM2, type GeometryDoc, type GeomLabel, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Pt, type Swing, type WallKind } from '../map/geometry';
import type { SaveState } from '../map/studio-controller';
import { kindDefaults, openingRange, type WallDefaults } from '../map/studio-ops';

export type StudioMode = 'select' | 'wall' | 'door' | 'window' | 'passage' | 'label';
export type GeomKind = 'wall' | 'opening' | 'label';
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
    ${v.mode === 'select' && v.sel?.vertex !== undefined ? html`<div class="note" data-selected-vertex=${v.sel.vertex}>פינה ${v.sel.vertex + 1} נבחרה: החצים מזיזים אותה (Shift = צעד גדול)</div>` : nothing}
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
  // The arrow-key convention (a wall can run in any direction): towards the wall's end or its start.
  const keys = 'חץ ימינה או למעלה: לכיוון סוף הקיר; שמאלה או למטה: לכיוון תחילתו.';
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
`;

/**
 * Plan Studio side panel of the plan editor (T084): the structure tool - draw mode, wall defaults, the selected wall /
 * opening / label, validation issues, copy from another version, exports. Pure render functions: the editor owns the
 * state and passes callbacks; its shadow root provides the shared classes (.row, .two, .note, .btns, .err).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { CalibrationHint, CopyCandidate, GeometryIssue } from '../api/geometry';
import { OUTSIDE_MAIN_HE, isOutsideMain, outsideMainSummary, type CandidateSet, type CandKind, type CandState, objectsSummary } from '../map/candidates';
import { connectorTargets, currentTarget, isTwinCopy, otherFloorOf, type LinkTargetFloor } from '../map/connector-targets';
import { COLOR_TOKENS, FLOOR_HEIGHT_RANGE, floorHeight, LANDING_RANGE, MAX_STAIR_STEPS, OBJECT_SHAPES, STAIR_WIDTH_RANGE, SYMBOL_IDS, circuitToken, connectorLabel, effectiveScale, hasStairModel, stairCaption, type StairShape, lengthPx, perimeterM, polygonAreaM2, type ConnectorKind, type GeometryDoc, type GeomCircuit, type GeomConnector, type GeomGroup, type GeomSize, type ObjectShape, type GeomLabel, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Pt, type Swing, type WallKind } from '../map/geometry';
import type { CatalogItem, CatalogLibrary, ParamSpec } from '../api/plan-catalog';
import type { HaEntity } from '../api/ha';
import { searchItems } from '../api/plan-catalog';
import type { SaveState } from '../map/studio-controller';
import { TAG_MAX_COUNT, TAG_MAX_LEN, cornerRemovable, kindDefaults, normalizeTag, openingRange, withTag, withoutTag, type AlignMode, type WallDefaults } from '../map/studio-ops';
import { symbolOf } from '../map/plan-symbols';

export type StudioMode = 'select' | 'wall' | 'door' | 'markdoor' | 'window' | 'passage' | 'label';
export type GeomKind = 'wall' | 'opening' | 'label' | 'object' | 'connector' | 'group';
export interface GeomSel {
  id: string;
  kind: GeomKind;
  /** A selected corner of the selected wall (select mode): the arrow keys move it. */
  vertex?: number;
}

/** The second help line of the opening modes: an existing opening is taken, not doubled (owner report on 0.1.82). */
const OPENING_DRAG_HINT = 'גרירת פתח קיים מזיזה אותו לאורך הקיר; חצים להזזה עדינה (Shift = צעד גדול)';

/** The select mode's help (hotfix 0.1.87): a wall moves as a whole by its body, but only once it is selected, so a first
 * press never moves anything. The select tool shows the same line. */
export const SELECT_HINT = 'לחץ על קיר, פתח, תווית או עצם כדי לבחור. קיר זז רק אחרי שנבחר: גרירת גוף הקיר הנבחר מזיזה את כולו, גרירת פינה שלו משנה את צורתו. פתח נגרר לאורך הקיר, תווית ועצם למקומם; החצים מזיזים בעדינות את מה שנבחר (Shift = צעד גדול) · Esc מבטל את הבחירה. במסך מגע כל פריט זז רק אחרי שנבחר, כך שהזזת המפה באצבע לא מזיזה פריטים.';

/** The "סמן דלת" tool (T087): a click on a door symbol in the plan proposes the door from the drawing. */
export const MARK_DOOR_HINT = 'לחץ על סמל דלת בתוכנית (או על הקיר במקום הדלת): תוצג הצעה מקווקוות - רוחב, ציר וכיוון פתיחה לפי הסמל. Enter או לחיצה על ההצעה מאשרים, לחיצה על סמל הבא מאשרת ומציעה את הבאה, Esc מבטל.';
export const MARK_DOOR_TIP = 'סמן דלת (D): לחיצה על סמל דלת בשרטוט מציעה את הדלת לפי הסמל';

export const STUDIO_MODES: { id: StudioMode; label: string; hint: string; drag?: string; tip?: string }[] = [
  { id: 'select', label: 'בחירה', hint: SELECT_HINT },
  { id: 'wall', label: 'קיר', hint: 'לחץ נקודה אחר נקודה. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, לחיצה על הנקודה הראשונה סוגרת מתאר, Shift מבטל הצמדה לזוויות, Backspace מוחק נקודה.' },
  { id: 'door', label: 'דלת', hint: 'לחץ על קיר כדי להציב דלת. כיוון הפתיחה והציר נקבעים כאן בפאנל.', drag: OPENING_DRAG_HINT },
  { id: 'markdoor', label: 'סמן דלת', hint: MARK_DOOR_HINT, tip: MARK_DOOR_TIP },
  { id: 'window', label: 'חלון', hint: 'לחץ על קיר כדי להציב חלון.', drag: OPENING_DRAG_HINT },
  { id: 'passage', label: 'מעבר', hint: 'פתח בלי דלת בקיר.', drag: OPENING_DRAG_HINT },
  { id: 'label', label: 'תווית', hint: 'לחץ במקום התווית ואז הקלד את הטקסט כאן בפאנל.', drag: 'גרירת תווית קיימת מזיזה אותה; חצים להזזה עדינה (Shift = צעד גדול)' },
];

const WALL_KIND_LABEL: Record<WallKind, string> = { exterior: 'חיצוני', interior: 'פנימי', partition: 'מחיצה', railing: 'מעקה', low: 'קיר נמוך' };
const OPENING_KIND_LABEL: Record<OpeningKind, string> = { door: 'דלת', window: 'חלון', passage: 'מעבר' };
const SWING_LABEL: Record<Swing, string> = { right: 'לצד ימין של הקיר', left: 'לצד שמאל של הקיר', double: 'כנף כפולה', sliding: 'הזזה', none: 'ללא כנף' };
const HINGE_LABEL: Record<Hinge, string> = { start: 'בצד תחילת הקיר', end: 'בצד סוף הקיר' };
/** A double or sliding door has no hinge jamb to pick: the same field chooses the side of the wall it opens to. */
const SIDE_LABEL: Record<Hinge, string> = { start: 'לצד שמאל של הקיר', end: 'לצד ימין של הקיר' };
const sideSwing = (s: Swing | undefined): boolean => s === 'double' || s === 'sliding';
export const SAVE_LABEL: Record<SaveState, string> = {
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

/** Walls and openings a detector or an import produced (keyed on `source`, never on the id prefix: an accepted id that
 * collided with the draft is re-issued as a plain id). */
function autoCount(doc: GeometryDoc): number {
  return doc.walls.filter((w) => w.source !== 'manual').length + doc.openings.filter((o) => o.source !== 'manual').length;
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
  levels: GeomLevel[];
  /** The select tool (0.1.87): the selected item's inspector only - no drawing modes, lists, copy or exports. */
  compact?: boolean;
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
  setLevel(id: string, levelId: string): void;
}

const numberOf = (e: Event): number => parseFloat((e.target as HTMLInputElement).value);

export function renderStudioPanel(v: StudioView, a: StudioActions): TemplateResult {
  const { scale, estimated } = effectiveScale(v.doc);
  const errors = v.issues.filter((i) => i.severity === 'error');
  const warnings = v.issues.filter((i) => i.severity === 'warning');
  const mode = STUDIO_MODES.find((m) => m.id === v.mode) ?? STUDIO_MODES[0];
  const empty = !v.doc.walls.length && !v.doc.openings.length && !v.doc.labels.length;
  if (v.compact) {
    return html`<sw-card heading="מבנה" subheading=${SAVE_LABEL[v.saveState]} data-studio-panel data-studio-compact data-studio-save=${v.saveState}>
      <div class="note" data-select-geom-hint>${SELECT_HINT}</div>
      ${v.sel ? renderSelection(v, v.sel, a, scale, estimated) : nothing}
      ${v.saveState === 'error'
        ? html`<div class="err">${v.saveError} ${v.conflict
            ? html`<button class="linkbtn" data-studio-reload @click=${() => a.reload()}>טען מחדש</button>`
            : html`<button class="linkbtn" data-studio-retry @click=${() => a.retry()}>נסה שוב</button>`}</div>`
        : nothing}
    </sw-card>`;
  }
  return html`<sw-card heading="מבנה" subheading=${SAVE_LABEL[v.saveState]} data-studio-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label="כלי ציור">
      ${STUDIO_MODES.map((m) => html`<button class=${m.id === v.mode ? 'on' : ''} data-studio-mode=${m.id} aria-pressed=${m.id === v.mode} title=${m.tip ?? nothing} aria-keyshortcuts=${m.id === 'markdoor' ? 'D' : nothing} @click=${() => a.setMode(m.id)}>${m.label}</button>`)}
    </div>
    <div class="note">${mode.hint}</div>
    ${mode.drag ? html`<div class="note" data-studio-drag-hint>${mode.drag}</div>` : nothing}
    ${v.mode === 'wall' ? renderWallDefaults(v.wallDefaults, a) : nothing}
    <div class="row"><span class="lbl">קנה מידה<span class="muted" data-studio-scale>${v.doc.dimensions.calibration?.status === 'estimated' ? `≈ ${fmtScale(scale)} (הערכה, לא מדוד)` : estimated ? (v.showEstimates ? 'לא מכויל: מידות משוערות (≈)' : 'לא מכויל: מידות מוסתרות עד הכיול') : fmtScale(scale)}</span></span><sw-button size="sm" icon="scale" data-studio-calibrate @click=${() => a.calibrate()}>${estimated ? 'כיול' : 'כיול מחדש'}</sw-button></div>
    <div class="note" data-studio-counts>${countLabel(v.doc.walls.length, 'קיר אחד', 'קירות')} · ${countLabel(v.doc.openings.length, 'פתח אחד', 'פתחים')} · ${countLabel(v.doc.labels.length, 'תווית אחת', 'תוויות')}${autoCount(v.doc) ? html` · <span data-studio-auto-count>${autoCount(v.doc)} אוטומטיים / מיובאים</span>` : nothing}</div>
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

/** The level an item sits on (only shown when the floor has more than one). */
function levelSelect(levels: GeomLevel[], current: string, onPick: (levelId: string) => void) {
  if (levels.length < 2) return nothing;
  return html`<sw-field label="מפלס"><select data-item-level @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value)}>${levels.map((l) => html`<option value=${l.id} ?selected=${l.id === current}>${l.name} (${l.elevation_m} מ׳)</option>`)}</select></sw-field>`;
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
  return l ? renderLabel(l, v, a) : nothing;
}

function renderWall(w: GeomWall, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  const len = lengthPx(w.polyline, v.W, v.H) * scale;
  const openings = v.doc.openings.filter((o) => o.wall_id === w.id).length;
  return html`<div class="sel" data-selected-wall=${w.id}>
    <div class="selhead"><strong>קיר ${WALL_KIND_LABEL[w.kind]}</strong><span class="muted">${fmtMetres(len, estimated, v.showEstimates)} · ${countLabel(openings, 'פתח אחד', 'פתחים')}</span></div>
    ${renderSourceBadge(w)}
    ${w.external_ids?.origin === 'door_tool' ? html`<div class="note" data-wall-door-tool>קטע קיר שנוסף עם דלת בכלי "סמן דלת": בדוק את עוביו ואת החיבור לקירות הסמוכים.</div>` : nothing}
    <div class="two">
      <sw-field label="עובי (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr .value=${String(w.thickness_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.patchWall(w.id, { thickness_m: x }); }} /></sw-field>
      <sw-field label="סוג"><select aria-label="סוג קיר" @change=${(e: Event) => a.patchWall(w.id, { kind: (e.target as HTMLSelectElement).value as WallKind })}>
        ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${w.kind === k}>${WALL_KIND_LABEL[k]}</option>`)}
      </select></sw-field>
    </div>
    <sw-field label="גובה (מ׳, ריק = עד התקרה)"><input type="number" min="0.1" max="50" step="0.1" data-ltr .value=${w.height_m === null ? '' : String(w.height_m)}
      @change=${(e: Event) => { const raw = (e.target as HTMLInputElement).value.trim(); const x = parseFloat(raw); if (!raw) a.patchWall(w.id, { height_m: null }); else if (x > 0 && x <= 50) a.patchWall(w.id, { height_m: x }); }} /></sw-field>
    ${levelSelect(v.levels, w.level_id, (lv) => a.setLevel(w.id, lv))}
    ${renderItemTags(w.tags, (tags) => a.patchWall(w.id, { tags }))}
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
    ${renderSourceBadge(o)}
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
          <sw-field label=${sideSwing(o.swing) ? 'צד הפתיחה' : 'ציר'}><select aria-label=${sideSwing(o.swing) ? 'צד הפתיחה' : 'ציר'} data-opening-hinge @change=${(e: Event) => a.patchOpening(o.id, { hinge: (e.target as HTMLSelectElement).value as Hinge })}>
            ${(Object.keys(HINGE_LABEL) as Hinge[]).map((k) => html`<option value=${k} ?selected=${o.hinge === k}>${(sideSwing(o.swing) ? SIDE_LABEL : HINGE_LABEL)[k]}</option>`)}
          </select></sw-field>
        </div>`
      : nothing}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>מחק ${OPENING_KIND_LABEL[o.kind]}</sw-button></div>
  </div>`;
}

function renderLabel(l: GeomLabel, v: StudioView, a: StudioActions) {
  return html`<div class="sel" data-selected-label=${l.id}>
    <sw-field label="טקסט"><input type="text" maxlength="80" data-label-text .value=${l.text}
      @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patchLabel(l.id, { text: x }); }} /></sw-field>
    <sw-field label="גודל"><input type="number" min="6" max="200" step="1" data-ltr .value=${String(l.size)}
      @change=${(e: Event) => { const x = numberOf(e); if (x >= 6 && x <= 200) a.patchLabel(l.id, { size: x }); }} /></sw-field>
    ${levelSelect(v.levels, l.level_id, (lv) => a.setLevel(l.id, lv))}
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
  /** K88: pairs already taken for this calibration (the save sends them all; the server averages by length). */
  pairs?: { metres: number; pixels: number }[];
}

export function renderCalibPanel(v: CalibView, onMetres: (value: string) => void, onSave: () => void, onReset: () => void, onAddPair?: () => void, onDropPair?: (index: number) => void): TemplateResult {
  const metres = parseFloat(v.metres);
  // The server refuses a pair closer than 5 plan pixels and a distance over 1000 m.
  const tooClose = v.pixels !== null && v.pixels < 5;
  const pairs = v.pairs ?? [];
  const currentOk = !!v.a && !!v.b && v.pixels !== null && v.pixels >= 5 && metres > 0 && metres <= 1000;
  const ready = (currentOk || pairs.length > 0) && !v.busy;
  const canAdd = currentOk && pairs.length < 3 && !v.busy && !!onAddPair;
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
    ${pairs.length
      ? html`<div class="note" data-calib-pairs>זוגות שנמדדו: ${pairs.map((p, i) => html`<span class="pair" data-calib-pair=${i}>${p.metres} מ׳ / ${p.pixels.toFixed(0)} px${onDropPair ? html` <button type="button" class="x" aria-label="הסר זוג" data-calib-drop=${i} @click=${() => onDropPair(i)}>×</button>` : nothing}</span>`)}</div>`
      : nothing}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-calib-save ?disabled=${!ready} @click=${onSave}>שמור כיול${pairs.length ? ` (${pairs.length + (currentOk ? 1 : 0)} זוגות)` : ''}</sw-button>
      ${onAddPair ? html`<sw-button size="sm" icon="plus" data-calib-add ?disabled=${!canAdd} title="עד ארבעה זוגות; הממוצע משוקלל לפי האורך ומוצגת הסטייה" @click=${onAddPair}>זוג נוסף</sw-button>` : nothing}
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

// ---------------------------------------------------------------- detection (phase 3, T086)

export interface DetectOpts {
  walls: boolean;
  openings: boolean;
  /** 0.3 (light) .. 1.0 (strong) morphology, the server's strength. */
  strength: number;
  replaceAuto: boolean;
  /** The hollow-wall pass (T087, walls drawn as two thin lines): on unless false; the request's `hollow_walls`. */
  hollow?: boolean;
  /** Detector 1.4 (T086 tuning), each on unless false: the request's `section_lines`, `join_gaps`, `steps_regions`, `columns`. */
  sectionLines?: boolean;
  joinGaps?: boolean;
  stepsRegions?: boolean;
  columns?: boolean;
}

/** The detect panel's rule checkboxes after the hollow walls (detector 1.4): option key, data attribute, label. */
export const DETECT_RULES: readonly { key: 'sectionLines' | 'joinGaps' | 'stepsRegions' | 'columns'; attr: string; label: string }[] = [
  { key: 'sectionLines', attr: 'section', label: 'קווי חתך החוצים את המבנה אינם קירות' },
  { key: 'joinGaps', attr: 'join', label: 'רווח קטן מ־30 ס״מ בלי סימון - קיר אחד' },
  { key: 'stepsRegions', attr: 'steps', label: 'הצע טריבונה משורות מקבילות' },
  { key: 'columns', attr: 'columns', label: 'הצע עמודים וקו מעטפת ביניהם' },
];
export interface DetectRunState {
  busy: boolean;
  startedAt: number;
  /** Seconds since the request went out (the elapsed counter), or of the last run. */
  elapsed: number;
  error: string;
  /** The last run hit the server's time limit (504 detect_timeout): the panel offers a lighter retry. */
  timedOut: boolean;
  /** The server's time limit in seconds, once a timeout told it (details.timeout_s); null until then. */
  limitS: number | null;
}
/** A refused accept (T086 API review): the ids the server named are marked in the list, a structural refusal lists its issues. */
export interface DetectAcceptError {
  code: string;
  message: string;
  ids: string[];
  issues: { id: string | null; message: string }[];
  /** 409 stale_revision: the draft changed elsewhere; the candidates stay while the draft reloads. */
  stale: boolean;
}
export interface DetectCandidatesView {
  source: 'detect' | 'dxf';
  set: CandidateSet;
  states: Record<string, CandState>;
  sel: string | null;
  hint: CalibrationHint | null;
  /** Unlocked items of the candidates' source in the live draft (what a replace would remove). */
  existingAuto: { walls: number; openings: number; objects?: number };
  elapsedMs: number | null;
  /** DXF only: room polygons offered to the zones layer (never part of the structure accept). */
  rooms: number;
}
/** The replace step before an accept that removes earlier automatic items. */
export interface DetectReplaceAsk {
  /** What the replace removes from the live draft (merge_candidates' rule: the accepted sources, unlocked). */
  existing: { walls: number; openings: number; objects: number };
  /** Openings of another source (manual) sitting on unlocked walls of the candidates' source: they go with their wall. */
  manualOnAuto: number;
}
export interface DetectView {
  opts: DetectOpts;
  run: DetectRunState;
  cands: DetectCandidatesView | null;
  acceptedCount: number;
  /** The object candidates (DXF blocks; detected tribunes and columns) go with the accept together: no per-object toggle,
   * the candidates layer draws them dashed and faded while left out. */
  objectsOn: boolean;
  hintApplied: boolean;
  /** The door-width estimate may be offered: the document's calibration is not measured. */
  canEstimate: boolean;
  busy: boolean;
  /** A phone: candidates can be accepted, not edited. */
  narrow: boolean;
  /** The document's effective scale is an estimate (no calibration, or the door-width one): metres carry "≈". */
  estimated: boolean;
  showEstimates: boolean;
  scale: number;
  /** Automatic items already in the draft (the "replace" checkbox names the count before a run). */
  autoInDraft: number;
  ask: DetectReplaceAsk | null;
  acceptError: DetectAcceptError | null;
}
export interface DetectActions {
  setOpts(o: DetectOpts): void;
  run(): void;
  retryLighter(): void;
  acceptAll(): void;
  acceptAbove(min: number): void;
  acceptKinds(kinds: CandKind[]): void;
  rejectAll(): void;
  toggle(id: string): void;
  focus(id: string): void;
  setObjects(on: boolean): void;
  confirm(): void;
  confirmReplace(): void;
  cancelReplace(): void;
  reload(): void;
  discard(): void;
  applyHint(): void;
  importRooms(): void;
}

export const CAND_KIND_LABEL: Record<CandKind, string> = { wall: 'קיר', door: 'דלת', window: 'חלון', passage: 'מעבר' };
const CAND_KIND_ONLY: Record<CandKind, string> = { wall: 'רק קירות', door: 'רק דלתות', window: 'רק חלונות', passage: 'רק מעברים' };
const SOURCE_BADGE: Record<string, string> = { auto: 'זוהה אוטומטית', imported: 'יובא מ־DXF' };
/** The candidate list shows this many rows; the map shows them all. */
const CAND_ROWS = 300;
/** The lighter strength a timed-out run is offered to retry with. */
export const lighterStrength = (s: number): number => Math.max(0.3, Math.round((s - 0.2) * 100) / 100);

/** The badge of a wall or opening that a detector or an import produced (phase 3): source and confidence. */
export function renderSourceBadge(item: { source: string; confidence: number }): TemplateResult | typeof nothing {
  if (item.source === 'manual') return nothing;
  return html`<span class="badge" data-auto-badge=${item.source}>${SOURCE_BADGE[item.source] ?? item.source} · ביטחון ${item.confidence.toFixed(2)}</span>`;
}

function candKind(set: CandidateSet, id: string): CandKind {
  if (set.walls.some((w) => w.id === id)) return 'wall';
  return set.openings.find((o) => o.id === id)?.kind ?? 'wall';
}

function candScore(set: CandidateSet, id: string): number {
  return set.walls.find((w) => w.id === id)?.confidence ?? set.openings.find((o) => o.id === id)?.confidence ?? 0;
}

/** The size that matters of a candidate, in metres of the document's effective scale ("≈" while it is an estimate). */
function candSize(v: DetectView, set: CandidateSet, id: string): string {
  const w = set.walls.find((x) => x.id === id);
  if (w) return `עובי ${fmtMetres(w.thickness_m, v.estimated, v.showEstimates)}`;
  const o = set.openings.find((x) => x.id === id);
  return o ? `רוחב ${fmtMetres(o.width_m, v.estimated, v.showEstimates)}` : '';
}

export function renderDetectPanel(v: DetectView, a: DetectActions): TemplateResult {
  const c = v.cands;
  const o = v.opts;
  return html`<sw-card heading="זיהוי אוטומטי" subheading="קירות, דלתות וחלונות מהתוכנית · עיבוד מקומי, ללא AI וללא שליחה החוצה" data-detect-panel data-detect-state=${v.run.busy ? 'running' : c ? 'candidates' : 'idle'} aria-busy=${v.run.busy || v.busy ? 'true' : 'false'}>
    ${c
      ? renderCandidates(v, c, a)
      : html`<div class="note">הזיהוי מציע מועמדים בשכבה נפרדת (כחול מקווקו). דבר לא נשמר עד "אשר", ודבר לא מתפרסם בלי פרסום.</div>
          <div class="chks">
            <label class="chk"><input type="checkbox" data-detect-walls .checked=${o.walls} @change=${(e: Event) => { const on = (e.target as HTMLInputElement).checked; a.setOpts({ ...o, walls: on, openings: on && o.openings }); }} /> קירות</label>
            <label class="chk"><input type="checkbox" data-detect-openings .checked=${o.openings} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, openings: (e.target as HTMLInputElement).checked })} /> פתחים (דלתות, חלונות, מעברים)</label>
            <label class="chk"><input type="checkbox" data-detect-hollow .checked=${o.hollow !== false} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, hollow: (e.target as HTMLInputElement).checked })} /> קירות חלולים (חיצוניים דקים)</label>
            ${DETECT_RULES.map((rule) => html`<label class="chk"><input type="checkbox" data-detect-rule=${rule.attr} .checked=${o[rule.key] !== false} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, [rule.key]: (e.target as HTMLInputElement).checked })} /> ${rule.label}</label>`)}
          </div>
          <sw-field label=${`עוצמת ניקוי: ${o.strength.toFixed(2)} (קל ← חזק)`}><input type="range" min="0.3" max="1" step="0.05" data-detect-strength .value=${String(o.strength)}
            @input=${(e: Event) => a.setOpts({ ...o, strength: parseFloat((e.target as HTMLInputElement).value) })} /></sw-field>
          ${v.autoInDraft ? html`<label class="chk"><input type="checkbox" data-detect-replace .checked=${o.replaceAuto} @change=${(e: Event) => a.setOpts({ ...o, replaceAuto: (e.target as HTMLInputElement).checked })} /> החלף אוטומטיים קודמים (${v.autoInDraft} בטיוטה)</label>` : nothing}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="sparkle" data-detect-run aria-busy=${v.run.busy ? 'true' : 'false'} ?disabled=${v.run.busy || !o.walls || v.busy} @click=${() => a.run()}>${v.run.busy ? html`מזהה… <span data-detect-elapsed>${v.run.elapsed}</span> שנ׳` : 'זהה אוטומטית'}</sw-button>
            ${v.run.busy ? html`<span class="note">הזיהוי רץ בשרת${v.run.limitS ? ` (עד ${v.run.limitS} שניות)` : ''}; הכפתור ייפתח כשיסיים.</span>` : nothing}
          </div>
          ${v.run.error
            ? html`<div class="err" role="alert" data-detect-error=${v.run.timedOut ? 'detect_timeout' : 'failed'}>${v.run.error}</div>
                ${v.run.timedOut && o.strength > 0.3
                  ? html`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-retry ?disabled=${v.run.busy || v.busy} @click=${() => a.retryLighter()}>נסה שוב בעוצמה ${lighterStrength(o.strength).toFixed(2)}</sw-button></div>`
                  : nothing}`
            : nothing}`}
  </sw-card>`;
}

function renderCandidates(v: DetectView, c: DetectCandidatesView, a: DetectActions): TemplateResult {
  const set = c.set;
  const ids = [...set.walls.map((w) => w.id), ...set.openings.map((x) => x.id)];
  const kinds: CandKind[] = ['wall', 'door', 'window', 'passage'];
  const present = kinds.filter((k) => (k === 'wall' ? set.walls.length > 0 : set.openings.some((x) => x.kind === k)));
  const sel = c.sel && ids.includes(c.sel) ? { id: c.sel, kind: candKind(set, c.sel), score: candScore(set, c.sel) } : null;
  const err = v.acceptError;
  const bad = new Set(err?.ids ?? []);
  const existing = c.existingAuto.walls + c.existingAuto.openings + (c.existingAuto.objects ?? 0);
  const earlier = c.source === 'dxf' ? 'מיובאים' : 'אוטומטיים';
  const origin = c.source === 'dxf' ? ' · מיובאים מ־DXF' : c.elapsedMs !== null ? ` · זוהו ב־${(c.elapsedMs / 1000).toFixed(1)} שנ׳` : '';
  return html`<div class="note" data-detect-summary>${countLabel(set.walls.length, 'קיר אחד', 'קירות')} · ${countLabel(set.openings.length, 'פתח אחד', 'פתחים')}${set.objects.length ? ` · ${countLabel(set.objects.length, 'עצם אחד', 'עצמים')}` : ''} · <span data-detect-accepted>${v.acceptedCount}</span> מסומנים לאישור${origin}</div>
    ${outsideMainSummary(set) ? html`<div class="note warn" data-detect-outside-main>${outsideMainSummary(set)}</div>` : nothing}
    ${!ids.length ? html`<div class="note" data-detect-empty>לא נמצאו קירות. נסה עוצמת ניקוי אחרת, או צייר בכלי "מבנה".</div>` : nothing}
    ${c.hint && v.estimated && v.canEstimate && !v.hintApplied
      ? html`<div class="hint" data-calib-hint>
          <div>התוכנית לא מכוילת. לפי רוחב דלת אופייני (0.9 מ׳, ${countLabel(c.hint.doors, 'דלת אחת', 'דלתות')}): <strong>${fmtScale(c.hint.scale_m_per_px)}</strong> — משוער.</div>
          <div class="btns"><sw-button size="sm" icon="scale" data-calib-hint-apply ?disabled=${v.busy} @click=${() => a.applyHint()}>השתמש בהערכה</sw-button><span class="note">מומלץ לפני האישור: המידות במטרים של המועמדים יחושבו לפי ההערכה, ויוצגו עם ≈ עד כיול בשתי נקודות</span></div>
        </div>`
      : v.hintApplied
        ? html`<div class="note" data-calib-hint-applied>קנה מידה משוער נשמר (≈ ${fmtScale(v.scale)}); כיול בשתי נקודות יחליף אותו</div>`
        : nothing}
    <div class="modes" role="group" aria-label="קבלת מועמדים">
      <button data-detect-accept-all ?disabled=${v.busy} @click=${() => a.acceptAll()}>קבל הכול</button>
      <button data-detect-accept-conf ?disabled=${v.busy} @click=${() => a.acceptAbove(0.8)}>קבל מעל 0.8</button>
      ${present.map((k) => html`<button data-detect-accept-kind=${k} ?disabled=${v.busy} @click=${() => a.acceptKinds([k])}>${CAND_KIND_ONLY[k]}</button>`)}
      <button data-detect-reject-all ?disabled=${v.busy} @click=${() => a.rejectAll()}>דחה הכול</button>
    </div>
    <div class="note">${v.narrow ? html`<span data-detect-phone-note>בטלפון אפשר לקבל או לדחות מועמדים; תיקון קצוות של קיר מועמד זמין במסך רחב.</span>` : 'לחיצה על מועמד במפה או על התיבה ברשימה מקבלת / דוחה אותו; גרירת קצה של הקיר המסומן מתקנת אותו לפני האישור.'}</div>
    <div class="dlist" data-cand-list>
      ${ids.slice(0, CAND_ROWS).map((id) => {
        const k = candKind(set, id);
        const state = c.states[id] ?? 'accepted';
        return html`<div class="dcand ${state} ${id === c.sel ? 'on' : ''} ${bad.has(id) ? 'bad' : ''}" data-cand-row=${id} data-cand-state=${state} ?data-cand-bad=${bad.has(id)}>
          <input type="checkbox" aria-label=${`קבל ${CAND_KIND_LABEL[k]}`} .checked=${state === 'accepted'} ?disabled=${v.busy} @change=${() => a.toggle(id)} />
          <button class="linkbtn" aria-label=${`${CAND_KIND_LABEL[k]} ${candScore(set, id).toFixed(2)}${isOutsideMain(set, id) ? ` ${OUTSIDE_MAIN_HE}` : ''}`} @click=${() => a.focus(id)}>${CAND_KIND_LABEL[k]}</button>
          ${isOutsideMain(set, id) ? html`<span class="outside" data-cand-outside-main>${OUTSIDE_MAIN_HE}</span>` : nothing}
          <span class="muted ltr" aria-hidden="true">${candScore(set, id).toFixed(2)}</span>
        </div>`;
      })}
      ${ids.length > CAND_ROWS ? html`<div class="note">מוצגים ${CAND_ROWS} הראשונים ברשימה; במפה מוצגים כולם.</div>` : nothing}
    </div>
    ${sel ? html`<div class="note" data-cand-selected=${sel.id}>${CAND_KIND_LABEL[sel.kind]} נבחר${isOutsideMain(set, sel.id) ? ` · ${OUTSIDE_MAIN_HE}` : ''} · ביטחון ${sel.score.toFixed(2)} · ${candSize(v, set, sel.id)} · ${(c.states[sel.id] ?? 'accepted') === 'accepted' ? 'יאושר' : 'נדחה'}</div>` : nothing}
    ${set.objects.length ? html`<label class="chk"><input type="checkbox" data-detect-objects .checked=${v.objectsOn} @change=${(e: Event) => a.setObjects((e.target as HTMLInputElement).checked)} /> כולל ${objectsSummary(set, c.source)}</label>` : nothing}
    ${existing ? html`<label class="chk"><input type="checkbox" data-detect-replace .checked=${v.opts.replaceAuto} @change=${(e: Event) => a.setOpts({ ...v.opts, replaceAuto: (e.target as HTMLInputElement).checked })} /> החלף ${earlier} קודמים (${existing} בטיוטה)</label>` : nothing}
    ${c.rooms ? html`<div class="btns"><sw-button size="sm" icon="map" data-detect-rooms ?disabled=${v.busy} @click=${() => a.importRooms()}>ייבא ${countLabel(c.rooms, 'חדר אחד', 'חדרים')} כאזורים</sw-button><span class="note">החדרים נשמרים כאזורים, לא כחלק מהמבנה</span></div>` : nothing}
    ${err
      ? html`<div class="err" role="alert" data-detect-accept-error=${err.code}>${err.message}</div>
          ${err.issues.length
            ? html`<div class="issues" data-detect-issues>${err.issues.slice(0, 20).map((i) => html`<button class="issue error" ?disabled=${!i.id || !ids.includes(i.id)} @click=${() => { if (i.id) a.focus(i.id); }}>${i.message}</button>`)}</div>`
            : nothing}
          ${err.stale ? html`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-reload ?disabled=${v.busy} @click=${() => a.reload()}>טען את הטיוטה מחדש</sw-button><span class="note">המועמדים נשארים; אחרי הטעינה אשר שוב</span></div>` : nothing}`
      : nothing}
    ${v.ask
      ? html`<div class="hint" data-detect-replace-confirm>
          <div><strong>להחליף את ה${earlier} הקודמים?</strong></div>
          <div data-detect-replace-counts>יוסרו מהטיוטה ${countLabel(v.ask.existing.walls, 'קיר אחד', 'קירות')} ו־${countLabel(v.ask.existing.openings, 'פתח אחד', 'פתחים')}${v.ask.existing.objects ? ` ו־${countLabel(v.ask.existing.objects, 'עצם אחד', 'עצמים')}` : ''} ${earlier} שנוספו קודם (פריטים נעולים נשארים).</div>
          ${v.ask.manualOnAuto
            ? html`<div class="err" data-detect-replace-manual>${countLabel(v.ask.manualOnAuto, 'פתח ידני אחד', 'פתחים ידניים')} על קירות אלה ${v.ask.manualOnAuto === 1 ? 'יוסר' : 'יוסרו'} איתם.</div>`
            : html`<div class="note">פתח ידני שיושב על קיר שיוסר — יוסר איתו.</div>`}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="check" data-detect-replace-go ?disabled=${v.busy} @click=${() => a.confirmReplace()}>החלף ואשר ${v.acceptedCount}</sw-button>
            <sw-button variant="ghost" size="sm" data-detect-replace-cancel ?disabled=${v.busy} @click=${() => a.cancelReplace()}>חזור</sw-button>
          </div>
        </div>`
      : html`<div class="btns">
          <sw-button variant="primary" size="sm" icon="check" data-detect-confirm ?disabled=${v.busy || !v.acceptedCount} @click=${() => a.confirm()}>אשר ${v.acceptedCount}</sw-button>
          <sw-button variant="ghost" size="sm" data-detect-discard ?disabled=${v.busy} @click=${() => a.discard()}>בטל</sw-button>
        </div>`}
    <div class="note">האישור מוסיף לטיוטת המבנה בלבד (Ctrl+Z מבטל); הצופים יראו את התוצאה אחרי פרסום.</div>`;
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
  /** A copy beside the object, selected and ready to drag (also Ctrl+D and Alt+drag). */
  duplicate?: (id: string) => void;
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
    ${renderItemTags(o.tags, (tags) => a.patch(o.id, { tags }))}
    ${group ? html`<div class="note" data-object-group>חלק ממערך של ${group.member_ids.length}${a.selectGroup ? html` · <button class="linkbtn" data-select-group @click=${() => a.selectGroup?.(group.id)}>בחר את המערך</button>` : nothing}</div>` : nothing}
    <div class="note">${v.estimated ? (v.showEstimates ? 'המידות במטרים משוערות (≈) עד הכיול' : 'לא מכויל: המידות מוצגות כערכי הפריט') : 'המידות במטרים לפי הכיול'} · חצים = הזזה עדינה (Shift = גדולה) · Alt+גרירה = שכפול · Delete = מחיקה</div>
    <div class="btns">
      ${a.duplicate ? html`<sw-button size="sm" icon="layers" data-object-duplicate title="עותק ליד העצם, נבחר ומוכן לגרירה (גם Ctrl+D, או Alt+גרירה של העצם)" @click=${() => a.duplicate?.(o.id)}>שכפל</sw-button>` : nothing}
      ${a.array ? html`<sw-button size="sm" icon="grid" data-object-array ?disabled=${v.phone || !!o.anchor_ref || !!o.group_id} title=${v.phone ? 'מערכים בדסקטופ בלבד' : o.group_id ? 'העצם כבר במערך' : 'שורות × עמודות מהעצם הזה'} @click=${() => a.array?.(o.id)}>מערך</sw-button>` : nothing}
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

// ---------------------------------------------------------------- multi-selection (T085)

/** How several items are picked in the editor's select tool (owner report 2026-09-26). */
export const MULTI_HINT = 'Shift+לחיצה מוסיפה קיר, עצם או אזור לבחירה או מוציאה אותו ממנה; גרירת מלבן מרקע ריק בוחרת את מה שנמצא בתוכו במלואו; Ctrl+A בוחר את כל מה שמוצג במפלס; Esc מנקה. הזזת התוכנית: רווח + גרירה, או גרירה בכפתור האמצעי; גלגלת לזום.';

// ---------------------------------------------------------------- keyboard shortcuts help (T085, owner request 2026-09-27)

export interface ShortcutEntry {
  keys: string;
  desc: string;
}
export interface ShortcutGroup {
  title: string;
  items: ShortcutEntry[];
}

/** Every shortcut the plan editor's keyboard handler and canvas actually implement (verified against
 * `explore-plan-editor.ts`'s `handleKey` / `handleMultiKey` / `handleStudioKey` / `nudgeGeom` and `sw-plan-canvas.ts`'s
 * pan and drag handlers) - a pure data structure so the help dialog and a future test can both read it. Keep this in
 * sync by hand: nothing here is generated from the handler. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'בחירה',
    items: [
      { keys: 'Shift+לחיצה', desc: 'מוסיף פריט לבחירה או מוציא אותו ממנה' },
      { keys: 'גרירת מלבן מרקע ריק', desc: 'בוחרת את כל מה שבתוכה במלואו' },
      { keys: 'Ctrl+A', desc: 'בוחר את כל מה שמוצג במפלס הנוכחי' },
      { keys: 'Esc', desc: 'מנקה את הבחירה, או סוגר את הפעולה הפתוחה' },
    ],
  },
  {
    title: 'עריכה',
    items: [
      { keys: 'Delete / Backspace', desc: 'מוחק את מה שנבחר' },
      { keys: 'Ctrl+D', desc: 'משכפל את מה שנבחר' },
      { keys: 'Alt+גרירה', desc: 'גורר עותק, במקום להזיז את המקור' },
      { keys: 'חצים', desc: 'מזיזים את הנבחר צעד קטן; Shift+חץ = צעד גדול' },
      { keys: 'Ctrl+Z / Ctrl+Y', desc: 'ביטול וחזרה על הפעולה האחרונה' },
      { keys: 'Ctrl+S', desc: 'שמירה' },
    ],
  },
  {
    title: 'תצוגה וניווט',
    items: [
      { keys: 'רווח+גרירה, או גרירה בכפתור האמצעי', desc: 'מזיז את התוכנית (פאן)' },
      { keys: 'כפתור היד בסרגל העליון', desc: 'מצב הזזה קבוע: כל גרירה מזיזה את התוכנית, עד לחיצה חוזרת עליו או Esc' },
      { keys: 'גלגלת העכבר', desc: 'זום פנימה והחוצה סביב הסמן' },
    ],
  },
  {
    title: 'כלים ספציפיים',
    items: [
      { keys: 'ציור קיר (מבנה)', desc: 'Enter מסיים את הקיר; Backspace/Delete מוחק את הנקודה האחרונה' },
      { keys: 'D', desc: 'סמן דלת (כלי המבנה): לחיצה על סמל דלת מציעה אותה; Enter מאשר, Esc מבטל את ההצעה' },
      { keys: 'ציור אזור', desc: 'לחיצה מוסיפה פינה; Enter מסיים משלוש פינות; Esc מבטל' },
      { keys: 'מפלסים ומחברים', desc: 'Esc מבטל את נקודת ההתחלה שנבחרה למחבר' },
      { keys: 'מדידה / כיול', desc: 'Esc מנקה את הנקודות שנבחרו עד כה' },
      { keys: 'זיהוי אוטומטי', desc: 'Delete/Backspace מסיר מועמד נבחר; Esc סוגר וחוזר לכלי הבחירה' },
      { keys: 'מעגלי תאורה', desc: 'Esc מבטל את סוג הגוף הממתין להצבה, ואז סוגר את מצב חברי המעגל' },
    ],
  },
];

export function renderShortcutsDialog(onClose: () => void): TemplateResult {
  return html`<sw-dialog open heading="קיצורי מקלדת" subheading="כל הקיצורים הפעילים כרגע בעורך התוכנית" data-shortcuts-dialog @close=${onClose}>
    <div class="shortcuts">
      ${SHORTCUT_GROUPS.map(
        (g) => html`<div class="shortcuts-group" data-shortcuts-group=${g.title}>
          <h4>${g.title}</h4>
          ${g.items.map((it) => html`<div class="shortcuts-row" data-shortcuts-row><kbd>${it.keys}</kbd><span>${it.desc}</span></div>`)}
        </div>`
      )}
    </div>
    <sw-button slot="footer" variant="primary" data-shortcuts-close @click=${onClose}>סגור</sw-button>
  </sw-dialog>`;
}

// ---------------------------------------------------------------- tags (T085)

/** One chip of a tags editor: the tag, and in the bulk panel how many of the selected items carry it. */
export interface TagChip {
  tag: string;
  count?: number;
}

/** The tags editor (owner request 2026-09-26: free-text tags for marking and later selection). One pattern everywhere -
 * the wall, object and zone inspectors and the multi-selection panel: the tags as chips, a click on a chip removes that
 * tag (in the bulk panel: from every selected item that has it), and a text box whose Enter or "הוסף" button adds one (in
 * the bulk panel: to every selected item). `full`: the one item already has TAG_MAX_COUNT tags. */
export function renderTagsField(v: { chips: TagChip[]; bulk?: boolean; full?: boolean; disabled?: boolean }, onAdd: (tag: string) => void, onRemove: (tag: string) => void): TemplateResult {
  const add = (input: HTMLInputElement | null | undefined) => {
    const t = input ? normalizeTag(input.value) : null;
    if (!input || !t) return;
    onAdd(t);
    input.value = '';
  };
  const off = !!(v.full || v.disabled);
  const hint = v.bulk
    ? 'לחיצה על תגית מסירה אותה מכל הנבחרים שיש להם אותה (המספר: כמה מהם); תגית חדשה נוספת לכולם'
    : v.full
      ? `הגעת למקסימום של ${TAG_MAX_COUNT} תגיות; לחיצה על תגית מסירה אותה`
      : `לסימון ולבחירה מהירה (בחירה לפי תגית ליד המפלסים) · לחיצה על תגית מסירה אותה · עד ${TAG_MAX_COUNT} תגיות של ${TAG_MAX_LEN} תווים`;
  return html`<sw-field label=${v.bulk ? 'תגיות בבחירה' : 'תגיות'} hint=${hint}><div class="tagsfield" data-tags-field>
    ${v.chips.length
      ? html`<div class="tagchips" data-tag-chips>${v.chips.map((c) => html`<sw-chip icon="close" data-tag=${c.tag} data-tag-count=${v.bulk && c.count !== undefined ? String(c.count) : nothing} .count=${v.bulk ? c.count : undefined}
          title=${v.bulk ? `הסר את "${c.tag}" מכל הנבחרים` : `הסר את התגית "${c.tag}"`} @click=${() => { if (!v.disabled) onRemove(c.tag); }}>${c.tag}</sw-chip>`)}</div>`
      : html`<div class="note" data-tag-none>${v.bulk ? 'לאף פריט בבחירה אין תגיות' : 'אין תגיות'}</div>`}
    <div class="tagadd">
      <input type="text" maxlength=${String(TAG_MAX_LEN)} data-tag-input aria-label=${v.bulk ? 'תגית להוספה לכל הנבחרים' : 'תגית חדשה'} placeholder="תגית חדשה, למשל: מטבח" ?disabled=${off}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(e.target as HTMLInputElement); } }} />
      <sw-button size="sm" icon="plus" data-tag-add ?disabled=${off} @click=${(e: Event) => add((e.currentTarget as HTMLElement).parentElement?.querySelector('input'))}>${v.bulk ? 'הוסף לכולם' : 'הוסף'}</sw-button>
    </div>
  </div></sw-field>`;
}

/** The tags editor of one wall or object: `set` receives the whole new list (withTag / withoutTag), never an unchanged one. */
function renderItemTags(tags: string[] | undefined, set: (tags: string[]) => void): TemplateResult {
  const change = (next: string[]) => {
    if (next !== tags && !(tags === undefined && !next.length)) set(next);
  };
  return renderTagsField({ chips: (tags ?? []).map((tag) => ({ tag })), full: (tags?.length ?? 0) >= TAG_MAX_COUNT }, (t) => change(withTag(tags, t)), (t) => change(withoutTag(tags, t)));
}

/** Select by tag (T085): a small picker beside the level chips over the canvas - the tags of what the level filter shows,
 * each with how many walls, objects and zones carry it there; picking one selects them all in the select tool. */
export function renderTagPicker(tags: TagChip[], onPick: (tag: string) => void): TemplateResult {
  return html`<select class="tagpick" data-tag-select aria-label="בחירה לפי תגית" title="בוחר את כל הקירות, העצמים והאזורים עם התגית, במפלס המוצג"
    @change=${(e: Event) => { const s = e.target as HTMLSelectElement; const t = s.value; s.value = ''; if (t) onPick(t); }}>
    <option value="" selected>בחירה לפי תגית…</option>${tags.map((t) => html`<option value=${t.tag}>${t.tag} (${t.count})</option>`)}
  </select>`;
}

export interface MultiView {
  walls: number;
  objects: number;
  zones: number;
  /** A zone request is in flight: no second bulk action until it ends. */
  busy: boolean;
  /** The structure draft's autosave, as every other selection panel shows it. */
  saveState: SaveState;
  /** The tags any selected item carries, with how many carry each (T085). */
  tags: TagChip[];
  /** The floor's levels: the "move to level" picker shows with two or more. */
  levels: GeomLevel[];
  /** The floor's lighting circuits: "add to circuit" shows only when `lights` > 0. */
  circuits: GeomCircuit[];
  /** How many selected objects may join a circuit (studio-ops circuitEligible: a light, or an unknown library item). */
  lights: number;
  /** What the last bulk tag / level / circuit / align action did, until the selection changes. */
  note: string;
  /** How many selected objects align and distribute move (T085): objects that are not the body of an anchor. The actions
   * show from two (distribute from three); walls and zones of the selection stay where they are. */
  alignable: number;
}
export interface MultiActions {
  duplicate(): void;
  remove(): void;
  clear(): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  setLevel(levelId: string): void;
  joinCircuit(circuitId: string): void;
  align(mode: AlignMode): void;
  distribute(axis: 'x' | 'y'): void;
}

/** The six align actions and the two distribute actions of the bulk panel (T085), with their labels. Left and right are
 * the plan's own directions (map geometry is never mirrored by RTL). */
const ALIGN_ACTIONS: readonly { mode: AlignMode; label: string; title: string }[] = [
  { mode: 'left', label: 'יישור לשמאל', title: 'הקצוות השמאליים של העצמים על הקצה השמאלי של הבחירה' },
  { mode: 'right', label: 'יישור לימין', title: 'הקצוות הימניים של העצמים על הקצה הימני של הבחירה' },
  { mode: 'top', label: 'יישור למעלה', title: 'הקצוות העליונים של העצמים על הקצה העליון של הבחירה' },
  { mode: 'bottom', label: 'יישור למטה', title: 'הקצוות התחתונים של העצמים על הקצה התחתון של הבחירה' },
  { mode: 'center-y', label: 'מרכזים בקו אופקי', title: 'מרכזי העצמים על קו אופקי אחד, באמצע הבחירה (למשל שורת מנורות)' },
  { mode: 'center-x', label: 'מרכזים בקו אנכי', title: 'מרכזי העצמים על קו אנכי אחד, באמצע הבחירה' },
];

/** The align / distribute block of the bulk panel: from two objects that can move; distribute from three. */
function renderAlignActions(v: MultiView, a: MultiActions): TemplateResult {
  if (v.alignable < 2) return html``;
  const others = v.walls + v.zones;
  const hint = `ביחס למסגרת של ${v.alignable} העצמים שנבחרו · צעד ביטול אחד${others ? ' · קירות ואזורים שבבחירה לא זזים' : ''}`;
  return html`<sw-field label="יישור ופיזור העצמים" hint=${hint}><div class="alignbtns" data-multi-align>
    ${ALIGN_ACTIONS.map((x) => html`<sw-button size="sm" variant="ghost" data-align=${x.mode} title=${x.title} ?disabled=${v.busy} @click=${() => a.align(x.mode)}>${x.label}</sw-button>`)}
    <sw-button size="sm" variant="ghost" data-distribute="x" ?disabled=${v.busy || v.alignable < 3} title=${v.alignable < 3 ? 'פיזור צריך לפחות שלושה עצמים' : 'רווחים שווים בין העצמים לרוחב; הקיצוניים נשארים במקומם'} @click=${() => a.distribute('x')}>פיזור שווה לרוחב</sw-button>
    <sw-button size="sm" variant="ghost" data-distribute="y" ?disabled=${v.busy || v.alignable < 3} title=${v.alignable < 3 ? 'פיזור צריך לפחות שלושה עצמים' : 'רווחים שווים בין העצמים לגובה; הקיצוניים נשארים במקומם'} @click=${() => a.distribute('y')}>פיזור שווה לגובה</sw-button>
  </div></sw-field>`;
}

/** The grid options of the layers tool (T085): the switch and the spacing. The spacing is in metres on the plan's scale -
 * before calibration on the estimated one, marked "≈" as every estimated distance of the editor, or, when the setting
 * `plan.estimates` hides estimated metres, named by size only. */
export interface GridOptionsView {
  on: boolean;
  stepM: number;
  steps: readonly number[];
  estimated: boolean;
  showEstimates: boolean;
}
const GRID_SIZE_WORDS = ['צפוף מאוד', 'צפוף', 'בינוני', 'מרווח', 'רחב', 'רחב מאוד'];
export function renderGridOptions(v: GridOptionsView, onToggle: (on: boolean) => void, onStep: (m: number) => void): TemplateResult {
  const words = v.estimated && !v.showEstimates;
  const label = (m: number, i: number) => (words ? GRID_SIZE_WORDS[i] ?? fmtMetres(m, false) : fmtMetres(m, v.estimated));
  const hint = v.estimated ? 'לפי קנה מידה משוער עד שהתוכנית תכויל' : 'לפי קנה המידה המכויל של התוכנית';
  return html`<div class="gridopts" data-grid-options>
    <label><input type="checkbox" data-grid-toggle .checked=${v.on} @change=${(e: Event) => onToggle((e.target as HTMLInputElement).checked)} /> רשת עזר</label>
    <div class="note">גרירה והצבה של עצם נצמדות לצמתי הרשת; Ctrl בזמן הגרירה - בלי הצמדה.</div>
    <sw-field label="מרווח הרשת" hint=${hint}>
      <select data-grid-step ?disabled=${!v.on} @change=${(e: Event) => onStep(Number((e.target as HTMLSelectElement).value))}>
        ${v.steps.map((m, i) => html`<option value=${String(m)} ?selected=${m === v.stepM}>${label(m, i)}</option>`)}
      </select>
    </sw-field>
    <div class="note">בזמן גרירה של עצם מופיעים קווי יישור כשקצה או מרכז שלו מתיישר עם עצם אחר, והעצם נצמד אליהם.</div>
  </div>`;
}

/** The select tool with two or more walls, objects and zones selected: what is selected and the actions on all of them. */
export function renderMultiSelection(v: MultiView, a: MultiActions): TemplateResult {
  const total = v.walls + v.objects + v.zones;
  const parts = [v.walls ? countLabel(v.walls, 'קיר אחד', 'קירות') : '', v.objects ? countLabel(v.objects, 'עצם אחד', 'עצמים') : '', v.zones ? countLabel(v.zones, 'אזור אחד', 'אזורים') : ''].filter(Boolean).join(' · ');
  return html`<sw-card heading=${`${total} פריטים נבחרו`} subheading=${`${parts} · ${SAVE_LABEL[v.saveState]}`} data-multi-panel data-multi-count=${total} data-studio-save=${v.saveState}>
    <div class="note">גרירת אחד מהם מזיזה את כולם יחד · Delete מוחק את כולם · Ctrl+D משכפל את העצמים שבבחירה</div>
    ${v.zones ? html`<div class="note" data-multi-zones-note>הזזה, מחיקה, תגיות ומפלס של אזורים נשמרים מיד ואינם חלק מהביטול (Ctrl+Z); קירות ועצמים חוזרים בצעד ביטול אחד</div>` : nothing}
    ${v.note ? html`<div class="note multinote" data-multi-note role="status">${v.note}</div>` : nothing}
    ${renderAlignActions(v, a)}
    ${renderTagsField({ chips: v.tags, bulk: true, disabled: v.busy }, (t) => a.addTag(t), (t) => a.removeTag(t))}
    ${v.levels.length > 1
      ? html`<sw-field label="העבר את כל הבחירה למפלס" hint="קירות ועצמים בצעד ביטול אחד; הפתחים עוברים עם הקיר שלהם">
          <select data-multi-level ?disabled=${v.busy} @change=${(e: Event) => { const s = e.target as HTMLSelectElement; const lv = s.value; s.value = ''; if (lv) a.setLevel(lv); }}>
            <option value="" selected>בחר מפלס…</option>${v.levels.map((l) => html`<option value=${l.id}>${l.name} (${l.elevation_m} מ׳)</option>`)}
          </select></sw-field>`
      : nothing}
    ${v.lights
      ? html`<sw-field label="הוסף למעגל תאורה" hint=${v.lights === total ? 'כל הנבחרים הם גופי תאורה' : `רק ${countLabel(v.lights, 'גוף התאורה שבבחירה מצטרף', 'גופי התאורה שבבחירה מצטרפים')}; קירות, אזורים ועצמים אחרים לא`}>
          ${v.circuits.length
            ? html`<div class="tagchips" data-multi-circuits>${v.circuits.map((k) => html`<sw-chip dot=${circuitVar(k.color_token)} data-multi-circuit=${k.id} title=${`הוסף את גופי התאורה שבבחירה למעגל ${k.name}`} @click=${() => { if (!v.busy) a.joinCircuit(k.id); }}>${k.name}</sw-chip>`)}</div>`
            : html`<div class="note" data-multi-no-circuits>אין עדיין מעגלים בקומה; צור מעגל בכלי "מעגלי תאורה".</div>`}
        </sw-field>`
      : nothing}
    <div class="btns">
      ${v.objects ? html`<sw-button size="sm" icon="layers" data-multi-duplicate ?disabled=${v.busy} title="עותק של כל העצמים שנבחרו, כגוש אחד ליד הבחירה (גם Ctrl+D)" @click=${() => a.duplicate()}>${v.objects === 1 ? 'שכפל את העצם' : `שכפל ${v.objects} עצמים`}</sw-button>` : nothing}
      <sw-button size="sm" variant="danger" icon="trash" data-multi-delete ?disabled=${v.busy} @click=${() => a.remove()}>מחק הכל</sw-button>
      <sw-button size="sm" variant="ghost" data-multi-clear @click=${() => a.clear()}>נקה בחירה</sw-button>
    </div>
    <div class="note" data-multi-hint>${MULTI_HINT}</div>
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
  /** Why the array could not be made (shown inside the dialog, not in the bar behind it). */
  error: string;
}

export function renderArrayDialog(v: ArrayDialogView, onChange: (patch: Partial<ArrayDialogView>) => void, onCreate: () => void, onCancel: () => void): TemplateResult {
  const total = Math.floor(v.rows) * Math.floor(v.cols);
  const ok = total >= 2 && total <= v.max && v.spacingX > 0 && v.spacingY > 0;
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  return html`<sw-dialog open heading="מערך" subheading=${`שורות × עמודות של ${v.item?.names.he ?? 'העצם'}; העצם שנבחר הוא הראשון`} data-array-dialog @close=${onCancel}>
    ${v.error ? html`<div class="err" data-array-error>${v.error}</div>` : nothing}
    <div class="two">
      <sw-field label="שורות"><input type="number" min="1" max="60" step="1" data-ltr data-array-rows .value=${String(v.rows)} @input=${(e: Event) => onChange({ rows: Math.max(1, num(e) || 1) })} /></sw-field>
      <sw-field label="עמודות"><input type="number" min="1" max="60" step="1" data-ltr data-array-cols .value=${String(v.cols)} @input=${(e: Event) => onChange({ cols: Math.max(1, num(e) || 1) })} /></sw-field>
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
  const sizeOk = (x: number) => x >= 0.05 && x <= 100; // NaN (an empty field) fails too
  const badSize = !(sizeOk(v.size.w_m) && sizeOk(v.size.d_m) && sizeOk(v.size.h_m));
  // one hook per field (data-custom-w / -d / -h): lit has no binding for an attribute's name, so each is a boolean attribute.
  // Every value is kept, also out of range: the field is marked and "צור פריט" waits until it is fixed (never dropped silently).
  const sizeField = (key: keyof GeomSize, label: string) => html`<sw-field label=${label}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-custom-w=${key === 'w_m'} ?data-custom-d=${key === 'd_m'} ?data-custom-h=${key === 'h_m'}
      aria-invalid=${sizeOk(v.size[key]) ? 'false' : 'true'} style=${sizeOk(v.size[key]) ? '' : 'border-color: var(--sw-danger)'} .value=${Number.isFinite(v.size[key]) ? String(v.size[key]) : ''}
      @input=${(e: Event) => onChange({ size: { ...v.size, [key]: num(e) } })} /></sw-field>`;
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
    ${badSize ? html`<div class="err" data-custom-size-error>כל מידה בין 0.05 ל־100 מ׳</div>` : nothing}
    <div class="note">הגובה מהרצפה, הפרמטרים וסוגי הישויות נלקחים מהפריט שעליו הוא מבוסס.</div>
    <sw-button slot="footer" variant="ghost" data-custom-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-custom-create ?disabled=${v.busy || !v.nameHe.trim() || badSize} @click=${onCreate}>${v.busy ? 'שומר…' : 'צור פריט'}</sw-button>
  </sw-dialog>`;
}

// ---------------------------------------------------------------- levels (T085)

/** The chips over the canvas: all levels, or one. `onAdd` (editors) adds the "+ מפלס" chip; `onEdit` (editors) puts
 * a small pencil beside each level's chip that opens the level's own dialog (rename, heights, default, delete). The
 * pencil is a sibling of the chip, not inside it: sw-chip is itself a button. */
export function renderLevelChips(levels: GeomLevel[], current: string | null, onPick: (id: string | null) => void, onAdd?: () => void, onEdit?: (id: string) => void): TemplateResult {
  if (levels.length < 2 && !onAdd) return html``;
  const chip = (l: GeomLevel) => html`<sw-chip data-level-chip=${l.id} ?selected=${current === l.id} @click=${() => onPick(l.id)}>${l.name} · ${l.elevation_m >= 0 ? '+' : '−'}${Math.abs(l.elevation_m).toFixed(1)} מ׳</sw-chip>`;
  return html`<div class="levelchips" role="group" aria-label="מפלסים" data-level-chips>
    <sw-chip data-level-chip="all" ?selected=${current === null} @click=${() => onPick(null)}>כל המפלסים</sw-chip>
    ${[...levels].sort((a, b) => b.elevation_m - a.elevation_m).map((l) => onEdit
      ? html`<span class="levelchip">${chip(l)}<sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${`עריכת המפלס ${l.name}`} data-level-edit=${l.id} @click=${() => onEdit(l.id)}></sw-button></span>`
      : chip(l))}
    ${onAdd ? html`<sw-chip data-level-add icon="plus" @click=${onAdd}>מפלס</sw-chip>` : nothing}
  </div>`;
}

/** The level dialog: a new level (`id` null) or an existing one (`id` set: edit mode, with delete). */
export interface LevelDialogView {
  /** null = a new level; otherwise the level being edited. */
  id: string | null;
  name: string;
  elevation: number;
  ceiling: number;
  /** Edit mode: the level is the floor's default now (it keeps that; another level is made the default instead). */
  isDefault: boolean;
  /** Edit mode, a level that is not the default: make it the default on save (the others lose it). */
  makeDefault: boolean;
  error: string;
}

export interface LevelDialogActions {
  change(patch: Partial<LevelDialogView>): void;
  /** Create (a new level) or save (edit mode). */
  submit(): void;
  cancel(): void;
  /** Edit mode only. */
  remove(): void;
}

export function renderLevelDialog(v: LevelDialogView, a: LevelDialogActions): TemplateResult {
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  const ok = v.name.trim().length > 0 && v.elevation >= -50 && v.elevation <= 500 && v.ceiling > 0 && v.ceiling <= 50;
  const editing = v.id !== null;
  return html`<sw-dialog open heading=${editing ? 'עריכת מפלס' : 'מפלס חדש'} subheading="גובה הרצפה יחסית למפלס הראשי (0), וגובה התקרה מעליה" data-level-dialog data-level-editing=${v.id ?? nothing} @close=${a.cancel}>
    ${v.error ? html`<div class="err" data-level-error>${v.error}</div>` : nothing}
    <sw-field label="שם"><input type="text" maxlength="60" data-level-name placeholder="למשל: אולם תחתון" .value=${v.name} @input=${(e: Event) => a.change({ name: (e.target as HTMLInputElement).value })} /></sw-field>
    <div class="two">
      <sw-field label="גובה רצפה (מ׳)" hint="שלילי = מתחת למפלס הראשי"><input type="number" min="-50" max="500" step="0.1" data-ltr data-level-elevation .value=${String(v.elevation)} @input=${(e: Event) => a.change({ elevation: num(e) })} /></sw-field>
      <sw-field label="גובה תקרה (מ׳)"><input type="number" min="0.1" max="50" step="0.1" data-ltr data-level-ceiling .value=${String(v.ceiling)} @input=${(e: Event) => a.change({ ceiling: num(e) })} /></sw-field>
    </div>
    ${editing && v.isDefault ? html`<div class="note" data-level-is-default>זה המפלס הראשי: פריטים חדשים מוצבים בו כשאין סינון מפלס.</div>` : nothing}
    ${editing && !v.isDefault ? html`<label class="chk"><input type="checkbox" data-level-make-default .checked=${v.makeDefault} @change=${(e: Event) => a.change({ makeDefault: (e.target as HTMLInputElement).checked })} /> הפוך למפלס הראשי</label>` : nothing}
    ${editing ? html`<sw-button slot="footer" variant="danger" icon="trash" data-level-delete @click=${a.remove}>מחק מפלס</sw-button>` : nothing}
    <sw-button slot="footer" variant="ghost" data-level-cancel @click=${a.cancel}>ביטול</sw-button>
    ${editing
      ? html`<sw-button slot="footer" variant="primary" icon="check" data-level-save ?disabled=${!ok} @click=${a.submit}>שמור</sw-button>`
      : html`<sw-button slot="footer" variant="primary" icon="check" data-level-create ?disabled=${!ok} @click=${a.submit}>הוסף מפלס</sw-button>`}
  </sw-dialog>`;
}

// ---------------------------------------------------------------- connectors (T085)

export const CONNECTOR_LABEL: Record<ConnectorKind, string> = { stairs: 'מדרגות', ramp: 'רמפה', tribune: 'טריבונה', elevator: 'מעלית', ladder: 'סולם' };

export interface ConnectorView {
  doc: GeometryDoc;
  mode: ConnectorKind | null;
  start: Pt | null;
  sel: GeomConnector | undefined;
  saveState: SaveState;
  /** The other floors of the building with their levels (GET link-targets): the "מחבר אל" picker. */
  linkTargets: LinkTargetFloor[];
  linkBusy: boolean;
  /** The shape the stairs tool draws next (T085). */
  stairShape: StairShape;
  phone: boolean;
}

export interface ConnectorActions {
  setMode(kind: ConnectorKind | null): void;
  select(id: string): void;
  patch(id: string, patch: Partial<GeomConnector>): void;
  remove(id: string): void;
  /** A value of the "מחבר אל" picker (connector-targets.targetValue): a level here, or a floor and its level. */
  setTarget(id: string, value: string): void;
  setStairShape(shape: StairShape): void;
  /** The stairs model changed (shape, turn, steps, width, landing): the editor regenerates the walking line. */
  patchStair(id: string, patch: Partial<Pick<GeomConnector, 'shape' | 'turn' | 'flights' | 'width_m' | 'landing_depth_m'>>): void;
  rotate(id: string): void;
  /** The floor's height, floor to floor (owner 2026-09-29): what stairs to another floor rise through. */
  setFloorHeight(m: number): void;
  /** "אישור מיקום" of a twin whose place is to be checked or chosen. */
  confirmPlacement(id: string): void;
}

/** A connector end's level name for the connector list and inspector. Callers show a cross-floor link themselves
 * (floor_ids set) before asking for level_to, so a null here is a target not chosen yet - never "another floor" (a
 * freshly drawn connector starts that way, T085 review 2026-09-26). */
function connectorLevelName(levels: GeomLevel[], id: string | null): string {
  return id ? levels.find((l) => l.id === id)?.name ?? id : 'לא נבחר';
}

/** Where a connector leads, in words: "קומה 1 · גלריה" for another floor, the level's name here, or "לא נבחר". */
export function connectorTargetName(levels: GeomLevel[], c: Pick<GeomConnector, 'floor_ids' | 'far' | 'level_to'>): string {
  if (c.floor_ids.length) {
    const far = c.far;
    if (far?.missing) return 'קומה שנמחקה';
    if (!far?.floor_name) return 'קומה אחרת';
    return far.level_name ? `${far.floor_name} · ${far.level_name}` : far.floor_name;
  }
  return connectorLevelName(levels, c.level_to);
}

/** A connector the server derived from an object (a tribune, id `cx-<object>`): it follows its object; nobody edits
 * or deletes it by hand - the object is edited instead. */
export function connectorDerived(c: Pick<GeomConnector, 'object_id' | 'source'>): boolean {
  return !!c.object_id || c.source === 'auto';
}

const STAIR_DRAW_HINT: Record<StairShape, [string, string]> = {
  straight: ['לחץ על תחילת המדרגות', 'לחץ על סוף המדרגות'],
  l: ['לחץ על תחילת המהלך הראשון', 'לחץ על סוף המהלך הראשון (הכיוון והאורך)'],
  u: ['לחץ על תחילת המהלך הראשון', 'לחץ על סוף המהלך הראשון (הכיוון והאורך)'],
};

export function renderConnectorPanel(v: ConnectorView, a: ConnectorActions): TemplateResult {
  const levels = v.doc.levels;
  const levelName = (id: string | null) => connectorLevelName(levels, id);
  const sel = v.sel;
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  const hint = v.mode === 'stairs' ? STAIR_DRAW_HINT[v.stairShape][v.start ? 1 : 0] : v.mode ? (v.start ? `לחץ על הנקודה השנייה של ${CONNECTOR_LABEL[v.mode]}` : `לחץ על הנקודה הראשונה של ${CONNECTOR_LABEL[v.mode]}`) : '';
  return html`<sw-card heading="מפלסים ומחברים" subheading=${v.mode ? `${hint}${v.start ? ' · Esc לביטול' : ''}` : 'מדרגות, רמפה, מעלית וסולם בין מפלסים ובין קומות'} data-connector-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label="סוג מחבר">
      ${(['stairs', 'ramp', 'elevator', 'ladder'] as ConnectorKind[]).map((k) => html`<button class=${v.mode === k ? 'on' : ''} data-conn-mode=${k} aria-pressed=${v.mode === k} @click=${() => a.setMode(v.mode === k ? null : k)}>${CONNECTOR_LABEL[k]}</button>`)}
    </div>
    ${v.mode === 'stairs'
      ? html`<div class="modes" role="group" aria-label="צורת המדרגות" data-stair-draw-shapes>
          ${STAIR_SHAPES.map((s) => html`<button class=${v.stairShape === s ? 'on' : ''} data-stair-draw-shape=${s} aria-pressed=${v.stairShape === s} @click=${() => a.setStairShape(s)}>${STAIR_SHAPE_TEXT[s]}</button>`)}
        </div>`
      : nothing}
    <sw-field label="גובה קומה (רצפה עד רצפה, מ׳)" hint="כמה עולות מדרגות לקומה שמעל; ברירת מחדל 3"><input type="number" min=${FLOOR_HEIGHT_RANGE[0]} max=${FLOOR_HEIGHT_RANGE[1]} step="0.05" data-ltr data-floor-height .value=${String(floorHeight(v.doc))}
      @change=${(e: Event) => { const x = num(e); if (x >= FLOOR_HEIGHT_RANGE[0] && x <= FLOOR_HEIGHT_RANGE[1]) a.setFloorHeight(Math.round(x * 100) / 100); }} /></sw-field>
    <div class="note">שתי לחיצות על התוכנית מציירות מחבר (הצמדה לפינות קירות); במדרגות L ו־U הלחיצה השנייה קובעת את הכיוון ואת אורך המהלך הראשון, והפודסט והמהלך השני נוצרים לבד. מדרגות ומעלית מהספרייה מונחות כאן כמחבר. טריבונה היא עצם מהספרייה: המחבר שלה נוצר לבד כשמגדירים לאיזה מפלס היא יורדת.</div>
    ${v.doc.connectors.length
      ? html`<div class="list">${v.doc.connectors.map((c) => html`<button class=${sel?.id === c.id ? 'on' : ''} data-conn-row=${c.id} @click=${() => a.select(c.id)}>
          <span>${CONNECTOR_LABEL[c.kind] ?? c.kind}${connectorDerived(c) ? ' (מעצם)' : ''}</span><span class="note" style="margin:0">${levelName(c.level_from)} ← ${connectorTargetName(levels, c)}</span>
        </button>`)}</div>`
      : html`<div class="note">עדיין אין מחברים בקומה.</div>`}
    ${sel ? renderConnectorInspector(sel, v, a, levelName, num) : nothing}
  </sw-card>`;
}

/** The select tool (0.1.87): the selected connector's inspector in a card of its own, without the connector modes. */
export function renderConnectorSelection(v: ConnectorView & { sel: GeomConnector }, a: ConnectorActions): TemplateResult {
  const levelName = (id: string | null) => connectorLevelName(v.doc.levels, id);
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  return html`<sw-card heading="מחבר" subheading=${SAVE_LABEL[v.saveState]} data-connector-panel data-studio-save=${v.saveState}>${renderConnectorInspector(v.sel, v, a, levelName, num)}</sw-card>`;
}

const STAIR_SHAPES: StairShape[] = ['straight', 'l', 'u'];
const STAIR_SHAPE_TEXT: Record<StairShape, string> = { straight: 'ישר', l: 'L (פנייה 90°)', u: 'U (חצי סיבוב)' };

/** The stairs model of a stair connector (T085): shape, turn side, steps per flight, a mid landing on a straight run,
 * landing depth, the 90-degree turn. Every change regenerates the walking line from its start (the editor's
 * rebuildStair), so the drawing follows at once. */
function renderStairModel(c: GeomConnector, a: ConnectorActions, num: (e: Event) => number) {
  const shape: StairShape = c.shape === 'l' || c.shape === 'u' ? c.shape : 'straight';
  const model = hasStairModel(c);
  const flights = c.flights?.length ? c.flights : [{ steps: 16 }];
  const two = flights.length > 1;
  const steps = (i: number) => (e: Event) => {
    const n = Math.round(num(e));
    if (!(n >= 1 && n <= MAX_STAIR_STEPS)) return;
    a.patchStair(c.id, { flights: flights.map((f, k) => (k === i ? { steps: n } : f)) });
  };
  return html`<div class="stairs" data-stair-model=${model ? shape : 'none'}>
    <div class="modes" role="group" aria-label="צורת המדרגות">
      ${STAIR_SHAPES.map((s) => html`<button class=${model && shape === s ? 'on' : ''} data-stair-shape=${s} aria-pressed=${model && shape === s} @click=${() => a.patchStair(c.id, { shape: s })}>${STAIR_SHAPE_TEXT[s]}</button>`)}
    </div>
    ${model
      ? html`<div class="two">
          ${flights.map((f, i) => html`<sw-field label=${two ? `מדרגות במהלך ${i + 1}` : 'מדרגות'}><input type="number" min="1" max=${MAX_STAIR_STEPS} step="1" data-ltr data-stair-steps=${i} .value=${String(f.steps)} @change=${steps(i)} /></sw-field>`)}
        </div>
        <div class="two">
          ${shape !== 'straight'
            ? html`<sw-field label="פנייה"><select data-stair-turn @change=${(e: Event) => a.patchStair(c.id, { turn: (e.target as HTMLSelectElement).value as 'left' | 'right' })}>
                <option value="right" ?selected=${c.turn !== 'left'}>ימינה</option><option value="left" ?selected=${c.turn === 'left'}>שמאלה</option></select></sw-field>`
            : html`<label class="chk"><input type="checkbox" data-stair-mid .checked=${two} @change=${(e: Event) => {
                const on = (e.target as HTMLInputElement).checked;
                const total = flights.reduce((n, f) => n + f.steps, 0);
                a.patchStair(c.id, { flights: on ? [{ steps: Math.max(1, Math.ceil(total / 2)) }, { steps: Math.max(1, Math.floor(total / 2)) }] : [{ steps: Math.min(MAX_STAIR_STEPS, total) }] });
              }} /> פודסט באמצע</label>`}
          ${two || shape !== 'straight'
            ? html`<sw-field label="עומק הפודסט (מ׳)"><input type="number" min=${LANDING_RANGE[0]} max=${LANDING_RANGE[1]} step="0.1" data-ltr data-stair-landing .value=${String(c.landing_depth_m ?? c.width_m)}
                @change=${(e: Event) => { const x = num(e); if (x >= LANDING_RANGE[0] && x <= LANDING_RANGE[1]) a.patchStair(c.id, { landing_depth_m: x }); }} /></sw-field>`
            : nothing}
        </div>
        <div class="note" data-stair-caption-note>${stairCaption({ flights, shape }) || '—'} · גרירת פינה משנה את המסלול; שינוי כאן מסדר אותו מחדש מנקודת ההתחלה.</div>`
      : html`<div class="note">בחר צורה כדי לצייר מהלכים, מדרגות ופודסט.</div>`}
    <div class="btns"><sw-button size="sm" variant="ghost" data-conn-rotate @click=${() => a.rotate(c.id)}>סובב 90°</sw-button></div>
  </div>`;
}

function renderConnectorInspector(c: GeomConnector, v: ConnectorView, a: ConnectorActions, levelName: (id: string | null) => string, num: (e: Event) => number) {
  const derived = connectorDerived(c);
  const cross = c.floor_ids.length > 0;
  const twinCopy = isTwinCopy(v.doc, c);
  const other = otherFloorOf(v.doc, c);
  const all = connectorTargets(v.doc, c, v.linkTargets);
  // a twin moves its link only from the floor it was linked from: here only the levels of its own other floor (review B1)
  const groups = twinCopy ? { ...all, floors: all.floors.filter((f) => f.floorId === other) } : all;
  const current = currentTarget(v.doc, c);
  const stairs = c.kind === 'stairs' && !derived;
  const minWidth = stairs && hasStairModel(c) ? STAIR_WIDTH_RANGE[0] : 0.05;
  const maxWidth = stairs && hasStairModel(c) ? STAIR_WIDTH_RANGE[1] : 100;
  const target = connectorTargetName(v.doc.levels, c);
  return html`<div class="sel" data-selected-connector=${c.id}>
    <div class="selhead"><strong>${CONNECTOR_LABEL[c.kind] ?? c.kind}</strong><span class="muted" data-conn-head-label>${connectorLabelOf(v.doc, c)}</span></div>
    ${derived ? html`<div class="note" data-conn-derived>נגזר מעצם (${c.object_id ?? ''}): המיקום, הרוחב והמפלסים מגיעים מהעצם; ערוך אותו בספריית העצמים.</div>` : nothing}
    <div class="two">
      <sw-field label="סוג"><select data-conn-kind ?disabled=${derived} @change=${(e: Event) => a.patch(c.id, { kind: (e.target as HTMLSelectElement).value as ConnectorKind })}>${(['stairs', 'ramp', 'elevator', 'ladder', 'tribune'] as ConnectorKind[]).map((k) => html`<option value=${k} ?selected=${k === c.kind}>${CONNECTOR_LABEL[k]}</option>`)}</select></sw-field>
      <sw-field label="רוחב (מ׳)"><input type="number" min=${minWidth} max=${maxWidth} step="0.1" data-ltr data-conn-width ?disabled=${derived} .value=${String(c.width_m)}
        @change=${(e: Event) => { const x = num(e); if (!(x >= minWidth && x <= maxWidth)) return; if (stairs && hasStairModel(c)) a.patchStair(c.id, { width_m: x }); else a.patch(c.id, { width_m: x }); }} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="ממפלס"><select data-conn-from ?disabled=${derived} @change=${(e: Event) => a.patch(c.id, { level_from: (e.target as HTMLSelectElement).value })}>${v.doc.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === c.level_from}>${l.name}</option>`)}</select></sw-field>
      <sw-field label="מחבר אל"><select data-conn-target aria-label="מחבר אל: מפלס בקומה הזו או מפלס בקומה אחרת" ?disabled=${derived || v.linkBusy} @change=${(e: Event) => { const val = (e.target as HTMLSelectElement).value; if (val) a.setTarget(c.id, val); }}>
        <option value="" ?selected=${!current}>${cross ? `${target} · בחר מפלס` : 'בחר מפלס או קומה'}</option>
        ${groups.here.length ? html`<optgroup label="בקומה הזו">${groups.here.map((o) => html`<option value=${o.value} ?selected=${o.value === current}>${o.label}</option>`)}</optgroup>` : nothing}
        ${derived ? nothing : groups.floors.map((f) => html`<optgroup label=${f.name}>${f.options.map((o) => html`<option value=${o.value} ?selected=${o.value === current}>${o.label}</option>`)}</optgroup>`)}
      </select></sw-field>
    </div>
    ${v.linkBusy ? html`<div class="note" data-conn-linking>מקשר לקומה השנייה…</div>` : nothing}
    ${twinCopy ? html`<div class="note" data-conn-twin-origin>אלה מדרגות שקושרו מקומה אחרת: כדי לקשר אותן לקומה שלישית, קשר מחדש מהקומה המקורית.</div>` : nothing}
    ${cross && !derived
      ? html`<div class="note" data-conn-twin-note>מקושר אל ${target}: אותו מחבר מופיע בטיוטה של שתי הקומות. הזזה כאן לא מזיזה את המדרגות בקומה השנייה, ולהפך.</div>`
      : nothing}
    ${c.needs_placement ? html`<div class="note warn" data-conn-placement>מקם את המדרגות בקומה הזו: הן נוצרו במרכז התוכנית כי לשתי הקומות אין מסגרת משותפת. גרור אותן למקומן.</div>` : nothing}
    ${!c.needs_placement && c.check_placement ? html`<div class="note warn" data-conn-check-placement>ודא את המיקום: צורת המדרגות עודכנה מהקומה השנייה והמסלול נבנה מחדש מנקודת ההתחלה שלהן כאן.</div>` : nothing}
    ${c.needs_placement || c.check_placement ? html`<div class="btns"><sw-button size="sm" data-conn-confirm-place @click=${() => a.confirmPlacement(c.id)}>אישור מיקום</sw-button></div>` : nothing}
    ${stairs ? renderStairModel(c, a, num) : nothing}
    <sw-field label="תווית (אופציונלי; ריק = הפרש הגובה או הקומה)"><input type="text" maxlength="80" data-conn-label ?disabled=${derived} .value=${c.label ?? ''} @change=${(e: Event) => a.patch(c.id, { label: (e.target as HTMLInputElement).value.trim() || null })} /></sw-field>
    <div class="note" data-conn-route>${levelName(c.level_from)} ← ${target}${derived ? '' : ' · גרירת פינה מזיזה פינה, גרירת המחבר הנבחר מזיזה את כולו'}</div>
    ${!derived ? html`<div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(c.id)}>מחק מחבר</sw-button></div>` : nothing}
  </div>`;
}

/** "למחוק גם בקומה השנייה?" (T085): deleting a connector linked to another floor asks whether its twin goes too; the
 * default (the primary button) deletes both. */
export function renderTwinDeleteDialog(target: string, canBoth: boolean, onBoth: () => void, onHere: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading="מחיקת מחבר בין קומות" subheading=${`המחבר מקושר אל ${target}`} data-twin-delete-dialog @close=${onCancel}>
    ${canBoth
      ? html`<div class="note">למחוק גם בקומה השנייה?</div><div class="note warn" data-twin-delete-immediate>המחיקה בקומה השנייה מיידית: Ctrl+Z מחזיר את המדרגות רק כאן.</div>`
      : html`<div class="note" data-twin-delete-noperm>אין לך הרשאת עריכה בקומה השנייה: המדרגות יימחקו רק כאן, והתאום שם יסומן כמקושר לשום מקום.</div>`}
    <sw-button slot="footer" variant="ghost" data-twin-delete-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant=${canBoth ? 'secondary' : 'danger'} data-twin-delete-here @click=${onHere}>רק בקומה הזו</sw-button>
    ${canBoth ? html`<sw-button slot="footer" variant="danger" icon="trash" data-twin-delete-both autofocus @click=${onBoth}>מחק בשתי הקומות</sw-button>` : nothing}
  </sw-dialog>`;
}

/** Changing where linked stairs lead removes the twin on the other floor at once (review B1, L2): asked first. */
export function renderLinkConfirmDialog(kind: 'unlink' | 'relink', target: string, onOk: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading=${kind === 'relink' ? 'קישור לקומה אחרת' : 'ביטול הקישור בין הקומות'} subheading=${`המדרגות מקושרות עכשיו אל ${target}`} data-link-confirm-dialog=${kind} @close=${onCancel}>
    <div class="note">${kind === 'relink' ? 'הקישור לקומה חדשה ימחק את המדרגות מהקומה הנוכחית שלהן שם.' : 'המדרגות יובילו למפלס בקומה הזו, והתאום בקומה השנייה יימחק.'}</div>
    <div class="note warn">המחיקה בקומה השנייה מיידית ואינה מתבטלת ב־Ctrl+Z.</div>
    <sw-button slot="footer" variant="ghost" data-link-confirm-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="danger" data-link-confirm-ok @click=${onOk}>${kind === 'relink' ? 'קשר ומחק שם' : 'בטל קישור ומחק שם'}</sw-button>
  </sw-dialog>`;
}

function connectorLabelOf(doc: GeometryDoc, c: GeomConnector): string {
  return connectorLabel(new Map(doc.levels.map((l) => [l.id, l])), c);
}

// ---------------------------------------------------------------- circuits (T085)

export interface CircuitView {
  doc: GeometryDoc;
  sel: GeomCircuit | undefined;
  membersMode: boolean;
  power: (k: GeomCircuit) => number;
  creating: { name: string; q: string; results: HaEntity[]; entity: HaEntity | null; color: string; busy: boolean } | null;
  saveState: SaveState;
  colors: readonly string[];
  /** The library's light items: the lamp types members mode can drop straight into the circuit (empty until it loads). */
  lamps: CatalogItem[];
  /** The lamp type the next click on the plan places into the selected circuit (members mode only). */
  placing: CatalogItem | null;
}

export interface CircuitActions {
  select(id: string | null): void;
  startNew(): void;
  cancelNew(): void;
  setNew(patch: Partial<NonNullable<CircuitView['creating']>>): void;
  create(): void;
  patch(id: string, patch: Partial<GeomCircuit>): void;
  toggleMembers(): void;
  remove(id: string): void;
  /** Arm a lamp type for placement into the selected circuit, or disarm (null). */
  armLamp(item: CatalogItem | null): void;
}

/** Members mode (owner report 2026-09-26: "add lamps" placed nothing on a click on the map): both of its interactions. */
export const CIRCUIT_MEMBERS_HINT = 'לחץ על מנורה קיימת כדי להוסיף או להסיר אותה מהמעגל, או בחר סוג מנורה למטה ולחץ על התוכנית כדי להציב מנורה חדשה שכבר מחוברת למעגל';

/** The hint while a lamp type is armed: the next click on the plan places it, already on the circuit. */
export const circuitPlacingHint = (item: CatalogItem): string => `לחץ על התוכנית כדי להציב ${item.names.he} ישירות במעגל · Esc לביטול`;

/** The circuit colour as a CSS variable: a document string reaches the inline style only through the whitelist. */
const circuitVar = (token: string): string => `var(--sw-${circuitToken(token) ?? 'circuit-1'})`;

export function renderCircuitPanel(v: CircuitView, a: CircuitActions): TemplateResult {
  const c = v.creating;
  const sel = v.sel;
  return html`<sw-card heading="מעגלי תאורה" subheading=${v.membersMode ? (v.placing ? circuitPlacingHint(v.placing) : CIRCUIT_MEMBERS_HINT) : 'כמה מנורות על ישות מפסק אחת'} data-circuit-panel data-studio-save=${v.saveState}>
    ${v.doc.circuits.length
      ? html`<div class="list">${v.doc.circuits.map((k) => html`<button class=${sel?.id === k.id ? 'on' : ''} data-circuit-row=${k.id} style=${`border-inline-start: 4px solid ${circuitVar(k.color_token)}`} @click=${() => a.select(sel?.id === k.id ? null : k.id)}>
          <span>${k.name}</span><span class="note ltr" style="margin:0">${k.member_ids.length} · ${v.power(k)} W · ${k.switch_entity_id}</span>
        </button>`)}</div>`
      : html`<div class="note">עדיין אין מעגלים בקומה.</div>`}
    ${c
      ? html`<div class="sel" data-circuit-new-form>
          <sw-field label="שם המעגל"><input type="text" maxlength="80" data-circuit-name placeholder="למשל: אולם צפון" .value=${c.name} @input=${(e: Event) => a.setNew({ name: (e.target as HTMLInputElement).value })} /></sw-field>
          <sw-field label="ישות המפסק (switch / light)"><input type="search" data-ltr data-circuit-switch-q placeholder="חיפוש בקטלוג" .value=${c.q} @input=${(e: Event) => a.setNew({ q: (e.target as HTMLInputElement).value })} /></sw-field>
          <div class="list">${c.results.slice(0, 20).map((e) => html`<button class=${c.entity?.entity_id === e.entity_id ? 'on' : ''} data-circuit-switch=${e.entity_id} @click=${() => a.setNew({ entity: e })}><span>${e.name || e.original_name || e.entity_id}</span><span class="ltr">${e.entity_id}</span></button>`)}</div>
          <sw-field label="צבע"><select data-circuit-color @change=${(e: Event) => a.setNew({ color: (e.target as HTMLSelectElement).value })}>${v.colors.map((col, i) => html`<option value=${col} ?selected=${col === c.color}>מעגל ${i + 1}</option>`)}</select></sw-field>
          <div class="btns"><sw-button variant="primary" size="sm" icon="check" data-circuit-create ?disabled=${c.busy || !c.name.trim() || !c.entity} @click=${() => a.create()}>צור מעגל</sw-button><sw-button variant="ghost" size="sm" data-circuit-cancel @click=${() => a.cancelNew()}>ביטול</sw-button></div>
        </div>`
      : html`<div class="btns"><sw-button size="sm" icon="plus" data-circuit-new @click=${() => a.startNew()}>מעגל חדש</sw-button></div>`}
    ${sel && !c ? renderCircuitInspector(sel, v, a) : nothing}
  </sw-card>`;
}

function renderCircuitInspector(k: GeomCircuit, v: CircuitView, a: CircuitActions) {
  return html`<div class="sel" data-selected-circuit=${k.id} style=${`--kc: ${circuitVar(k.color_token)}`}>
    <div class="selhead"><strong>${k.name}</strong><span class="muted ltr">${k.switch_entity_id}</span></div>
    <div class="note"><span data-circuit-count>${countLabel(k.member_ids.length, 'מנורה אחת', 'מנורות')}</span> · <span data-circuit-power>${v.power(k)} W</span></div>
    <div class="two">
      <sw-field label="שם"><input type="text" maxlength="80" data-circuit-rename .value=${k.name} @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patch(k.id, { name: x }); }} /></sw-field>
      <sw-field label="צבע"><select @change=${(e: Event) => a.patch(k.id, { color_token: (e.target as HTMLSelectElement).value })}>${v.colors.map((col, i) => html`<option value=${col} ?selected=${col === k.color_token}>מעגל ${i + 1}</option>`)}</select></sw-field>
    </div>
    <div class="btns">
      <sw-button size="sm" variant=${v.membersMode ? 'primary' : 'ghost'} icon="light" data-circuit-members aria-pressed=${v.membersMode} @click=${() => a.toggleMembers()}>${v.membersMode ? 'סיים בחירת מנורות' : 'הוסף / הסר מנורות'}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-circuit-delete @click=${() => a.remove(k.id)}>מחק מעגל</sw-button>
    </div>
    ${v.membersMode && v.lamps.length ? html`<div class="note">מנורה חדשה: בחר סוג ולחץ על התוכנית (לחיצה נוספת על הסוג מבטלת)</div>
      <div class="modes lamps" role="group" aria-label="סוג מנורה להצבה במעגל" data-circuit-lamps>${v.lamps.map((i) => {
        const on = v.placing?.id === i.id;
        return html`<button class=${on ? 'on' : ''} data-circuit-lamp=${i.id} aria-pressed=${on} title=${`${i.names.he} · ${i.size.w_m}×${i.size.d_m} מ׳`} @click=${() => a.armLamp(on ? null : i)}><svg viewBox="0 0 24 24" aria-hidden="true">${symbolOf(i.icon)}</svg><span>${i.names.he}</span></button>`;
      })}</div>` : nothing}
    <div class="note">המצב החי של המנורות נגזר מהמפסק; ההפעלה מהמפה החיה היא פעולת ההתקן הקיימת, באותן הרשאות.</div>
  </div>`;
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
  .lamps button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .lamps svg {
    width: 14px;
    height: 14px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
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
  .levelchips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .tagchips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-block-end: 6px;
  }
  .tagadd {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .tagadd input {
    flex: 1;
    min-inline-size: 0;
  }
  .tagpick {
    font: inherit;
    font-size: var(--sw-fs-sm);
    min-block-size: 28px;
    max-inline-size: 180px;
    padding-inline: 6px;
    border: 1px solid var(--sw-border-strong);
    border-radius: 8px;
    background: var(--sw-surface);
    color: var(--sw-text);
  }
  .multinote {
    color: var(--sw-text);
    font-weight: var(--sw-fw-medium);
  }
  .alignbtns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .gridopts {
    display: grid;
    gap: 6px;
    margin-block-start: 10px;
    padding-block-start: 10px;
    border-block-start: 1px solid var(--sw-border);
  }
  .gridopts label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-sm);
  }
  .levelchip {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }
  .badge {
    display: inline-block;
    border: 1px solid var(--sw-map-candidate);
    color: var(--sw-accent-text);
    border-radius: var(--sw-r-pill);
    padding: 1px 8px;
    font-size: var(--sw-fs-sm);
    inline-size: fit-content;
  }
  .chks {
    display: grid;
    gap: 4px;
    margin-block-end: 6px;
  }
  .hint {
    border: 1px dashed var(--sw-map-candidate);
    border-radius: 8px;
    padding: 8px;
    margin-block: 8px;
    display: grid;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .hint .btns {
    margin-block-start: 0;
    align-items: center;
  }
  .dlist {
    display: grid;
    max-block-size: 240px;
    overflow: auto;
    margin-block: 6px;
  }
  .dcand {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 6px;
    align-items: center;
    padding: 3px 4px;
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
  }
  /* T087 review: a wall candidate outside the main structure - dark text on the warning tint (the warning colour alone
     is too light for text on white) */
  .dcand .outside,
  .note.warn {
    color: var(--sw-text);
    background: var(--sw-warning-soft);
    border-inline-start: 3px solid var(--sw-warning);
    padding-inline: 4px;
    font-weight: 600;
  }
  .dcand .linkbtn {
    text-align: start;
  }
  .dcand .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .dcand .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .dcand.rejected {
    opacity: 0.55;
  }
  .dcand.on {
    outline: 2px solid var(--sw-map-candidate);
    outline-offset: -2px;
    border-radius: 6px;
  }
  .dcand.bad {
    background: var(--sw-danger-soft);
  }

  /* K88: the calibration pairs already taken */
  [data-calib-pairs] .pair {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-inline-end: 8px;
    padding: 1px 6px;
    border: 1px solid var(--sw-border);
    border-radius: 999px;
    direction: ltr;
  }
  [data-calib-pairs] .pair .x {
    border: 0;
    background: transparent;
    color: var(--sw-text-3);
    cursor: pointer;
    font: inherit;
    line-height: 1;
  }
`;

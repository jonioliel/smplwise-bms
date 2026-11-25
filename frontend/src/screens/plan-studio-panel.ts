/**
 * Plan Studio side panel of the plan editor (T084): the structure tool - draw mode, wall defaults, the selected wall /
 * opening / label, validation issues, copy from another version, exports. Pure render functions: the editor owns the
 * state and passes callbacks; its shadow root provides the shared classes (.row, .two, .note, .btns, .err).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { toggled } from '../components/toggle-value'; // not sw-toggle: Node unit specs import this module (RELEASE-2480-TRAIN)
import type { CalibrationHint, CopyCandidate, GeometryIssue, IfcImportReport } from '../api/geometry';
import { OUTSIDE_MAIN_HE, isOutsideMain, outsideMainSummary, type CandidateSet, type CandKind, type CandSource, type CandState, objectsSummary } from '../map/candidates';
import { connectorTargets, currentTarget, isTwinCopy, otherFloorOf, type LinkTargetFloor } from '../map/connector-targets';
import { COLOR_TOKENS, FLOOR_HEIGHT_RANGE, floorHeight, LANDING_RANGE, MAX_STAIR_STEPS, OBJECT_SHAPES, STAIR_WIDTH_RANGE, SYMBOL_IDS, circuitToken, connectorLabel, effectiveScale, hasStairModel, stairCaption, type StairShape, lengthPx, perimeterM, wallLengthPx, wallOutlineAreaM2, polygonAreaM2, type ConnectorKind, type GeometryDoc, type GeomCircuit, type GeomConnector, type GeomGroup, type GeomSize, type ObjectShape, type GeomLabel, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Pt, type Swing, type WallKind } from '../map/geometry';
import type { CatalogItem, CatalogLibrary, ParamSpec } from '../api/plan-catalog';
import type { HaEntity } from '../api/ha';
import { searchItems } from '../api/plan-catalog';
import type { SaveState } from '../map/studio-controller';
import { TAG_MAX_COUNT, TAG_MAX_LEN, cornerRemovable, kindDefaults, normalizeTag, openingRange, withTag, withoutTag, type AlignMode, type WallDefaults } from '../map/studio-ops';
import { symbolOf } from '../map/plan-symbols';
import { pkgT } from '../i18n/plan-package';
import { ifcSkippedLines, ifcSummary, ifcT } from '../i18n/plan-ifc';
import { curveT } from '../i18n/plan-curves';
import { cornerRoundable, curvePointAt, curvePoints, maxCornerRadiusM, minRadiusM, segmentRadiusM } from '../map/curve-ops';
import { glassT, operationLabel, tintLabel } from '../i18n/plan-glass';
import { renderMaterialField, type MaterialHost } from './plan-studio6-panel';
import type { ResolvedMaterials, VisualStyle } from '../map/material-resolve';
import { AUTO_MAX_M, AUTO_MIN_M, GLASS_THICKNESS_M, GLAZING_DEFAULTS, GLAZED_HEIGHT_RANGE, MULLION_RANGE, OPERATIONS, PANEL_WIDTH_RANGE, SILL_RANGE, TINTS, applyAutoDivide, glazingOf, panelCount, patchGlazing, patchOperable, toGlassPatch, toSolidPatch, toggleOperable, type Glazing, type GlassTint, type PanelOperation } from '../map/glass-wall';
import { tr } from '../i18n/msg/plan-studio';

/** The structure tool's modes. 'curved' draws a wall through points (curve-fit.ts), 'glass' a glass wall (straight or
 * through points, GlassDraw.curved); 'curve' bends segments of an existing wall (no chip: the wall inspector and C). */
export type StudioMode = 'select' | 'wall' | 'curved' | 'glass' | 'door' | 'markdoor' | 'window' | 'passage' | 'label' | 'curve';
/** The modes that draw a new wall (desktop only). */
export const DRAW_MODES: readonly StudioMode[] = ['wall', 'curved', 'glass'];
export type GeomKind = 'wall' | 'opening' | 'label' | 'object' | 'connector' | 'group';
export interface GeomSel {
  id: string;
  kind: GeomKind;
  /** A selected corner of the selected wall (select mode): the arrow keys move it. */
  vertex?: number;
  /** Curve mode: the selected segment of the selected wall (its radius is set in the panel). */
  segment?: number;
}

/** The second help line of the opening modes: an existing opening is taken, not doubled (owner report on 0.1.82). */
const OPENING_DRAG_HINT = tr('גרירת פתח קיים מזיזה אותו לאורך הקיר; חצים להזזה עדינה (Shift = צעד גדול)');

/** The select mode's help (hotfix 0.1.87): a wall moves as a whole by its body, but only once it is selected, so a first
 * press never moves anything. The select tool shows the same line. */
const SELECT_HINT = tr('לחץ על קיר, פתח, תווית או עצם כדי לבחור. קיר זז רק אחרי שנבחר: גרירת גוף הקיר הנבחר מזיזה את כולו, גרירת פינה שלו משנה את צורתו. פתח נגרר לאורך הקיר, תווית ועצם למקומם; החצים מזיזים בעדינות את מה שנבחר (Shift = צעד גדול) · Esc מבטל את הבחירה. במסך מגע כל פריט זז רק אחרי שנבחר, כך שהזזת המפה באצבע לא מזיזה פריטים.');

/** The "סמן דלת" tool (T087): a click on a door symbol in the plan proposes the door from the drawing. */
const MARK_DOOR_HINT = tr('לחץ על סמל דלת בתוכנית (או על הקיר במקום הדלת): תוצג הצעה מקווקוות - רוחב, ציר וכיוון פתיחה לפי הסמל. Enter או לחיצה על ההצעה מאשרים, לחיצה על סמל הבא מאשרת ומציעה את הבאה, Esc מבטל.');
const MARK_DOOR_TIP = tr('סמן דלת (D): לחיצה על סמל דלת בשרטוט מציעה את הדלת לפי הסמל');

/** The chips of the structure tool (WALLP, owner request 2026-10-08): the three wall tools first - straight, curved
 * through points, glass - then the openings and the label. The bend mode has no chip (`chip: false`): it is reached from
 * the selected wall's inspector or the C key, and shows a "done" button while it is on. `aria` is the chip's accessible
 * name when it says more than the label (the glass wall is also found as "קיר מסך"). */
export const STUDIO_MODES: { id: StudioMode; label: string; hint: string; drag?: string; tip?: string; key?: string; aria?: string; chip?: false }[] = [
  { id: 'select', label: tr('בחירה'), hint: SELECT_HINT },
  { id: 'wall', label: tr('קיר'), hint: tr('לחץ נקודה אחר נקודה. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, לחיצה על הנקודה הראשונה סוגרת מתאר, Shift מבטל הצמדה לזוויות, Backspace מוחק נקודה.') },
  { id: 'curved', label: curveT('modeCurved'), hint: curveT('hintCurved'), tip: curveT('tipCurved'), key: 'R' },
  { id: 'glass', label: glassT('tool'), hint: glassT('toolHint'), tip: glassT('toolTip'), key: 'G', aria: `${glassT('tool')} (${glassT('alias')})` },
  { id: 'door', label: tr('דלת'), hint: tr('לחץ על קיר כדי להציב דלת. כיוון הפתיחה והציר נקבעים כאן בפאנל.'), drag: OPENING_DRAG_HINT },
  { id: 'markdoor', label: tr('סמן דלת'), hint: MARK_DOOR_HINT, tip: MARK_DOOR_TIP, key: 'D' },
  { id: 'window', label: tr('חלון'), hint: tr('לחץ על קיר כדי להציב חלון.'), drag: OPENING_DRAG_HINT },
  { id: 'passage', label: tr('מעבר'), hint: tr('פתח בלי דלת בקיר.'), drag: OPENING_DRAG_HINT },
  { id: 'label', label: tr('תווית'), hint: tr('לחץ במקום התווית ואז הקלד את הטקסט כאן בפאנל.'), drag: tr('גרירת תווית קיימת מזיזה אותה; חצים להזזה עדינה (Shift = צעד גדול)') },
  { id: 'curve', label: curveT('modeCurve'), hint: curveT('hintCurve'), tip: curveT('tipCurve'), key: 'C', chip: false },
];

/** The glass wall tool's drawing settings (kept for the session like the wall defaults): straight or through points,
 * the frame depth and the nominal panel width; the rest of the glazing takes its defaults (GLAZING_DEFAULTS). */
export interface GlassDraw {
  curved: boolean;
  thickness_m: number;
  panel_width_m: number;
}
export const GLASS_DRAW_DEFAULTS: GlassDraw = { curved: false, thickness_m: GLASS_THICKNESS_M, panel_width_m: GLAZING_DEFAULTS.panel_width_m };

const WALL_KIND_LABEL: Record<WallKind, string> = { exterior: tr('חיצוני'), interior: tr('פנימי'), partition: tr('מחיצה'), railing: tr('מעקה'), low: tr('קיר נמוך'), glass: tr('קיר זכוכית') };
/** The kind's name in the kind choice; the glass wall's follows the page language (i18n/plan-glass). */
const kindLabel = (k: WallKind): string => (k === 'glass' ? glassT('kind') : WALL_KIND_LABEL[k]);
/** The solid kind a window wall converts back to with one click. */
const SOLID_FALLBACK: Exclude<WallKind, 'glass'> = 'exterior';
/** The patch a kind choice makes: to glass and back through glass-wall's conversions (the glazing and the frame depth
 * follow); between solid kinds only the kind. */
export function kindPatch(w: GeomWall, k: WallKind): Partial<GeomWall> {
  if (k === w.kind) return {};
  if (k === 'glass') return toGlassPatch(w);
  return w.kind === 'glass' ? toSolidPatch(k) : { kind: k };
}
const OPENING_KIND_LABEL: Record<OpeningKind, string> = { door: tr('דלת'), window: tr('חלון'), passage: tr('מעבר') };
const SWING_LABEL: Record<Swing, string> = { right: tr('לצד ימין של הקיר'), left: tr('לצד שמאל של הקיר'), double: tr('כנף כפולה'), sliding: tr('הזזה'), none: tr('ללא כנף') };
const HINGE_LABEL: Record<Hinge, string> = { start: tr('בצד תחילת הקיר'), end: tr('בצד סוף הקיר') };
/** A double or sliding door has no hinge jamb to pick: the same field chooses the side of the wall it opens to. */
const SIDE_LABEL: Record<Hinge, string> = { start: tr('לצד שמאל של הקיר'), end: tr('לצד ימין של הקיר') };
const sideSwing = (s: Swing | undefined): boolean => s === 'double' || s === 'sliding';
export const SAVE_LABEL: Record<SaveState, string> = {
  idle: tr('טיוטת המבנה'),
  pending: tr('שינויים ממתינים לשמירה…'),
  saving: tr('שומר…'),
  saved: tr('הטיוטה נשמרה · הצופים יראו אותה אחרי פרסום'),
  error: tr('השמירה נכשלה'),
};

/** Hebrew names of the document's collections (publish previews). */
export const COLL_LABEL: Record<string, string> = {
  walls: tr('קירות'),
  openings: tr('פתחים'),
  labels: tr('תוויות'),
  levels: tr('מפלסים'),
  rooms: tr('חדרים'),
  objects: tr('עצמים'),
  circuits: tr('מעגלי תאורה'),
  connectors: tr('מחברים'),
  groups: tr('קבוצות'),
};

/** Metres for display: "≈" when the plan is not calibrated (design section 6). Owner decision 2026-09-23: the setting
 * `plan.estimates` = false hides metres until the plan is calibrated (`show` = false). */
export function fmtMetres(m: number, estimated: boolean, show = true): string {
  if (estimated && !show) return tr('לא מכויל');
  return tr('{v}{v2} מ׳', { v: estimated ? '≈' : '', v2: m < 10 ? m.toFixed(2) : m.toFixed(1) });
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
  return tr('1 מ׳ = {v} פיקסלים בתוכנית', { v: (1 / scaleMPerPx).toFixed(1) });
}

export function fmtArea(m2: number, estimated: boolean, show = true): string {
  if (estimated && !show) return tr('לא מכויל');
  return tr('{v}{v2} מ״ר', { v: estimated ? '≈' : '', v2: m2 < 100 ? m2.toFixed(1) : m2.toFixed(0) });
}

interface StudioView {
  doc: GeometryDoc;
  W: number;
  H: number;
  mode: StudioMode;
  wallDefaults: WallDefaults;
  /** The glass wall tool's settings. */
  glassDraw?: GlassDraw;
  sel: GeomSel | null;
  saveState: SaveState;
  saveError: string;
  /** The last save was refused as stale: only a reload helps (a retry would overwrite the other editor). */
  conflict: boolean;
  issues: GeometryIssue[];
  copyCandidates: CopyCandidate[];
  exportSvg: string;
  exportPng: string;
  exportDxf: string;
  /** CR-037: the draft as IFC4 (the route refuses an uncalibrated plan). */
  exportIfc: string;
  busy: boolean;
  /** Setting `plan.estimates`: show estimated metres ("≈") before calibration, or hide them. */
  showEstimates: boolean;
  levels: GeomLevel[];
  /** The select tool (0.1.87): the selected item's inspector only - no drawing modes, lists, copy or exports. */
  compact?: boolean;
  /** A phone: a window wall's glazing is shown, edited on a desktop (as arrays and wall drawing). */
  phone?: boolean;
  /** The entities an operable glass panel can be bound to (the floor's entity anchors that report open / closed). */
  entityChoices?: { id: string; name: string }[];
  /** CR-029 ST7 UI: the resolved materials (the defaults the material field names) and the swatches' preview style. */
  materials?: ResolvedMaterials;
  materialStyle?: VisualStyle;
}

interface StudioActions {
  setMode(mode: StudioMode): void;
  setWallDefaults(d: WallDefaults): void;
  setGlassDraw?(d: GlassDraw): void;
  /** A wall drawn through points: a new point on its curve, the selected point removed (k = its clicked-point index). */
  addCurvePoint?(id: string): void;
  removeCurvePoint?(id: string, k: number): void;
  patchWall(id: string, patch: Partial<GeomWall>): void;
  patchOpening(id: string, patch: Partial<GeomOpening>): void;
  patchLabel(id: string, patch: Partial<GeomLabel>): void;
  remove(id: string): void;
  focus(id: string): void;
  copyFrom(versionId: string): void;
  exportJson(): void;
  /** T088: save the signed plan package of the draft; pick a package to import (a dry run first). `withDxf` (PLN2): the
   * package also carries the DXF with the plan picture beside it. */
  exportPackage(withDxf?: boolean): void;
  importPackage(file: File): void;
  /** CR-037: an IFC file's candidates into the detect tool (nothing stored until the accept). */
  importIfc(file: File): void;
  reload(): void;
  calibrate(): void;
  retry(): void;
  setLevel(id: string, levelId: string): void;
  /** Curve mode: a segment's radius in metres (null = straight), a corner rounded with a radius in metres. */
  setSegmentRadius?(id: string, seg: number, radiusM: number | null): void;
  roundCorner?(id: string, index: number, radiusM: number): void;
  /** A short message in the editor's info line (a bulk layout that found nothing to do). */
  say?(text: string): void;
  /** CR-029 ST7 UI: a wall's material (null = back to the default by kind) and the swatches' preview style. */
  setMaterial?(coll: 'walls' | 'openings', id: string, materialId: string | null): void;
  setMaterialStyle?(style: VisualStyle): void;
}

const numberOf = (e: Event): number => parseFloat((e.target as HTMLInputElement).value);

export function renderStudioPanel(v: StudioView, a: StudioActions): TemplateResult {
  const { scale, estimated } = effectiveScale(v.doc);
  const errors = v.issues.filter((i) => i.severity === 'error');
  const warnings = v.issues.filter((i) => i.severity === 'warning');
  const mode = STUDIO_MODES.find((m) => m.id === v.mode) ?? STUDIO_MODES[0];
  const empty = !v.doc.walls.length && !v.doc.openings.length && !v.doc.labels.length;
  if (v.compact) {
    return html`<sw-card heading=${tr('מבנה')} subheading=${SAVE_LABEL[v.saveState]} data-studio-panel data-studio-compact data-studio-save=${v.saveState}>
      <div class="note" data-select-geom-hint>${SELECT_HINT}</div>
      ${v.sel ? renderSelection(v, v.sel, a, scale, estimated) : nothing}
      ${v.saveState === 'error'
        ? html`<div class="err">${v.saveError} ${v.conflict
            ? html`<button class="linkbtn" data-studio-reload @click=${() => a.reload()}>${tr('טען מחדש')}</button>`
            : html`<button class="linkbtn" data-studio-retry @click=${() => a.retry()}>${tr('נסה שוב')}</button>`}</div>`
        : nothing}
    </sw-card>`;
  }
  return html`<sw-card heading=${tr('מבנה')} subheading=${SAVE_LABEL[v.saveState]} data-studio-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label=${tr('כלי ציור')}>
      ${STUDIO_MODES.filter((m) => m.chip !== false).map((m) => html`<button class=${m.id === v.mode ? 'on' : ''} data-studio-mode=${m.id} aria-pressed=${m.id === v.mode} title=${m.tip ?? nothing} aria-label=${m.aria ?? nothing} aria-keyshortcuts=${m.key ?? nothing} @click=${() => a.setMode(m.id)}>${m.label}</button>`)}
    </div>
    <div class="note">${v.mode === 'glass' && v.glassDraw?.curved ? glassT('toolHintCurved') : mode.hint}</div>
    ${mode.drag ? html`<div class="note" data-studio-drag-hint>${mode.drag}</div>` : nothing}
    ${v.mode === 'curve' ? html`<div class="btns"><sw-button size="sm" variant="ghost" data-bend-done @click=${() => a.setMode('select')}>${curveT('bendDone')}</sw-button></div>` : nothing}
    ${v.mode === 'wall' || v.mode === 'curved' ? renderWallDefaults(v.wallDefaults, a) : nothing}
    ${v.mode === 'glass' ? renderGlassDraw(v.glassDraw ?? GLASS_DRAW_DEFAULTS, a) : nothing}
    <div class="row"><span class="lbl">${tr('קנה מידה')}<span class="muted" data-studio-scale>${v.doc.dimensions.calibration?.status === 'estimated' ? tr('≈ {fmtScale} (הערכה, לא מדוד)', { fmtScale: fmtScale(scale) }) : estimated ? (v.showEstimates ? tr('לא מכויל: מידות משוערות (≈)') : tr('לא מכויל: מידות מוסתרות עד הכיול')) : fmtScale(scale)}</span></span><sw-button size="sm" icon="scale" data-studio-calibrate @click=${() => a.calibrate()}>${estimated ? tr('כיול') : tr('כיול מחדש')}</sw-button></div>
    <div class="note" data-studio-counts>${countLabel(v.doc.walls.length, tr('קיר אחד'), tr('קירות'))} · ${countLabel(v.doc.openings.length, tr('פתח אחד'), tr('פתחים'))} · ${countLabel(v.doc.labels.length, tr('תווית אחת'), tr('תוויות'))}${autoCount(v.doc) ? html` · <span data-studio-auto-count>${tr('{autoCount} אוטומטיים / מיובאים', { autoCount: autoCount(v.doc) })}</span>` : nothing}</div>
    ${v.sel ? renderSelection(v, v.sel, a, scale, estimated) : nothing}
    ${errors.length || warnings.length ? renderIssues(errors, warnings, a) : nothing}
    ${empty && v.copyCandidates.length ? renderCopy(v.copyCandidates, a, v.busy) : nothing}
    <div class="exports" role="group" aria-label=${tr('ייצוא המבנה')}>
      <a class="btnlink" data-export-svg href=${v.exportSvg} download>SVG</a>
      <a class="btnlink" data-export-png href=${v.exportPng} download>PNG</a>
      <a class="btnlink" data-export-dxf href=${v.exportDxf} download>${pkgT('dxf')}</a>
      <button class="btnlink" data-export-dxf-package ?disabled=${v.busy} @click=${() => a.exportPackage(true)}>${pkgT('dxfPicture')}</button>
      <button class="btnlink" data-export-json @click=${() => a.exportJson()}>JSON</button>
      <button class="btnlink" data-export-package ?disabled=${v.busy} @click=${() => a.exportPackage()}>${pkgT('exportPackage')}</button>
      <label class="btnlink" data-import-package-label>${pkgT('importPackage')}<input type="file" accept=".zip,application/zip" data-import-package hidden ?disabled=${v.busy}
        @change=${(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) a.importPackage(f); (e.target as HTMLInputElement).value = ''; }} /></label>
      <a class="btnlink" data-export-ifc href=${v.exportIfc} download>${ifcT('ifc')}</a>
      <label class="btnlink" data-import-ifc-label>${ifcT('importIfc')}<input type="file" accept=".ifc,application/x-step,model/ifc" data-import-ifc hidden ?disabled=${v.busy}
        @change=${(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) a.importIfc(f); (e.target as HTMLInputElement).value = ''; }} /></label>
      <span class="note">${tr('ייצוא הטיוטה כפי שהיא')}</span>
    </div>
    ${v.saveState === 'error'
      ? html`<div class="err">${v.saveError} ${v.conflict
          ? html`<button class="linkbtn" data-studio-reload @click=${() => a.reload()}>${tr('טען מחדש')}</button>`
          : html`<button class="linkbtn" data-studio-retry @click=${() => a.retry()}>${tr('נסה שוב')}</button>`}</div>`
      : nothing}
  </sw-card>`;
}

function renderWallDefaults(d: WallDefaults, a: StudioActions) {
  return html`<div class="two">
    <sw-field label=${tr('עובי קיר (מ׳)')}><input type="number" min="0.01" max="3" step="0.01" data-ltr data-wall-thickness .value=${String(d.thickness_m)}
      @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.setWallDefaults({ ...d, thickness_m: x }); }} /></sw-field>
    <sw-field label=${tr('סוג קיר')}><select aria-label=${tr('סוג קיר')} data-wall-kind @change=${(e: Event) => a.setWallDefaults({ ...d, kind: (e.target as HTMLSelectElement).value as WallKind })}>
      ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${d.kind === k}>${kindLabel(k)}</option>`)}
    </select></sw-field>
  </div>`;
}

/** The glass wall tool's settings: straight or curved (through points), the frame depth and the panel width. */
function renderGlassDraw(g: GlassDraw, a: StudioActions) {
  const set = (patch: Partial<GlassDraw>) => a.setGlassDraw?.({ ...g, ...patch });
  return html`<div class="modes" role="group" aria-label=${glassT('shape')} data-glass-shape>
      <button class=${g.curved ? '' : 'on'} data-glass-shape-straight aria-pressed=${!g.curved} @click=${() => set({ curved: false })}>${glassT('shapeStraight')}</button>
      <button class=${g.curved ? 'on' : ''} data-glass-shape-curved aria-pressed=${g.curved} @click=${() => set({ curved: true })}>${glassT('shapeCurved')}</button>
    </div>
    <div class="two">
      <sw-field label=${glassT('panelWidth')}><input type="number" data-ltr data-glass-draw-width min=${PANEL_WIDTH_RANGE[0]} max=${PANEL_WIDTH_RANGE[1]} step="0.05" .value=${String(g.panel_width_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x >= PANEL_WIDTH_RANGE[0] && x <= PANEL_WIDTH_RANGE[1]) set({ panel_width_m: x }); }} /></sw-field>
      <sw-field label=${glassT('frameDepth')}><input type="number" data-ltr data-glass-draw-depth min="0.01" max="3" step="0.01" .value=${String(g.thickness_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) set({ thickness_m: x }); }} /></sw-field>
    </div>`;
}

/** The level an item sits on (only shown when the floor has more than one). */
function levelSelect(levels: GeomLevel[], current: string, onPick: (levelId: string) => void) {
  if (levels.length < 2) return nothing;
  return html`<sw-field label=${tr('מפלס')}><select data-item-level @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value)}>${levels.map((l) => html`<option value=${l.id} ?selected=${l.id === current}>${tr('{name} ({elevation_m} מ׳)', { name: l.name, elevation_m: l.elevation_m })}</option>`)}</select></sw-field>`;
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
  const len = wallLengthPx(w, v.W, v.H) * scale;
  const openings = v.doc.openings.filter((o) => o.wall_id === w.id).length;
  const area = wallOutlineAreaM2(w, v.W, v.H, scale); // a closed outline (round rooms included): the floor area it encloses
  const points = curvePoints(w); // a wall drawn through points: its clicked points are its handles
  return html`<div class="sel" data-selected-wall=${w.id}>
    <div class="selhead"><strong>${w.kind === 'glass' ? kindLabel(w.kind) : tr('קיר {v}', { v: WALL_KIND_LABEL[w.kind] })}</strong><span class="muted">${fmtMetres(len, estimated, v.showEstimates)} · ${countLabel(openings, tr('פתח אחד'), tr('פתחים'))}${area !== null ? html` · ${curveT('area')} <span data-wall-area>${fmtArea(area, estimated, v.showEstimates)}</span>` : nothing}</span></div>
    ${renderSourceBadge(w)}
    ${w.external_ids?.origin === 'door_tool' ? html`<div class="note" data-wall-door-tool>${tr('קטע קיר שנוסף עם דלת בכלי "סמן דלת": בדוק את עוביו ואת החיבור לקירות הסמוכים.')}</div>` : nothing}
    <div class="two">
      <sw-field label=${tr('עובי (מ׳)')}><input type="number" min="0.01" max="3" step="0.01" data-ltr .value=${String(w.thickness_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.patchWall(w.id, { thickness_m: x }); }} /></sw-field>
      <sw-field label=${tr('סוג')}><select aria-label=${tr('סוג קיר')} data-selected-wall-kind ?disabled=${!!v.phone && w.kind === 'glass'} @change=${(e: Event) => a.patchWall(w.id, kindPatch(w, (e.target as HTMLSelectElement).value as WallKind))}>
        ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${w.kind === k} ?disabled=${!!v.phone && k === 'glass' && w.kind !== 'glass'}>${kindLabel(k)}</option>`)}
      </select></sw-field>
    </div>
    ${w.kind === 'glass' ? renderGlazing(w, v, a, len) : nothing}
    ${a.setMaterial && v.materials && w.kind !== 'glass'
      ? renderMaterialField({ key: `walls:${w.id}`, label: tr('חומר הקיר'), host: 'wall' as MaterialHost, value: w.material_id ?? null, defaultId: v.materials.walls[w.id] ?? 'plaster_white', style: v.materialStyle ?? 'light' }, { pick: (id) => a.setMaterial!('walls', w.id, id), setStyle: (s) => a.setMaterialStyle?.(s) })
      : nothing}
    <sw-field label=${tr('גובה (מ׳, ריק = עד התקרה)')}><input type="number" min="0.1" max="50" step="0.1" data-ltr .value=${w.height_m === null ? '' : String(w.height_m)}
      @change=${(e: Event) => { const raw = (e.target as HTMLInputElement).value.trim(); const x = parseFloat(raw); if (!raw) a.patchWall(w.id, { height_m: null }); else if (x > 0 && x <= 50) a.patchWall(w.id, { height_m: x }); }} /></sw-field>
    ${levelSelect(v.levels, w.level_id, (lv) => a.setLevel(w.id, lv))}
    ${renderItemTags(w.tags, (tags) => a.patchWall(w.id, { tags }))}
    ${v.mode === 'curve' ? renderCurve(w, v, a, scale) : nothing}
    ${points ? renderCurvePoints(w, points.length, v, a) : nothing}
    ${v.mode === 'select' && v.sel?.vertex !== undefined && !points
      ? html`<div class="note" data-selected-vertex=${v.sel.vertex}>${tr('פינה {v} נבחרה: החצים מזיזים אותה (Shift = צעד גדול); {v2}', { v: v.sel.vertex + 1, v2: cornerRemovable(w.polyline) ? tr('Delete מוחק את הפינה.') : tr('Delete מוחק את כל הקיר, כי בלי הפינה לא נשאר קיר.') })}</div>`
      : nothing}
    ${!v.phone && !v.compact && v.mode === 'select' ? html`<div class="btns"><sw-button size="sm" variant="ghost" data-wall-bend title=${curveT('tipCurve')} @click=${() => a.setMode('curve')}>${curveT('bendOpen')}</sw-button></div>` : nothing}
    <div class="btns">${w.kind === 'glass'
        ? html`<sw-button size="sm" variant="ghost" data-wall-to-solid ?disabled=${!!v.phone} title=${v.phone ? glassT('desktopOnly') : nothing} @click=${() => a.patchWall(w.id, kindPatch(w, SOLID_FALLBACK))}>${glassT('toSolid')}</sw-button>`
        : html`<sw-button size="sm" variant="ghost" data-wall-to-glass ?disabled=${!!v.phone} title=${v.phone ? glassT('desktopOnly') : nothing} @click=${() => a.patchWall(w.id, kindPatch(w, 'glass'))}>${glassT('toGlass')}</sw-button>`}</div>
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(w.id)}>${tr('מחק קיר')}</sw-button><span class="note">${tr('הפתחים שבקיר נמחקים איתו')}</span></div>
  </div>`;
}

/** A wall drawn through points (WALLP): how many points it has, a new point (on the longest span of the curve) and the
 * selected point removed; dragging a point on the plan re-fits the curve. Desktop only, like all wall drawing. */
function renderCurvePoints(w: GeomWall, count: number, v: StudioView, a: StudioActions) {
  const k = v.sel?.id === w.id && v.sel.vertex !== undefined ? curvePointAt(w, v.sel.vertex) : -1;
  return html`<div class="curvepts" data-curve-points=${count}>
    <div class="note">${curveT('pointsWall')} · ${count} ${curveT('points')}${k >= 0 ? html` · <span data-curve-point-selected=${k}>${curveT('pointHandle')} ${k + 1}</span>` : nothing}</div>
    ${v.phone
      ? nothing
      : html`<div class="btns"><sw-button size="sm" variant="ghost" data-curve-add @click=${() => a.addCurvePoint?.(w.id)}>${curveT('addPoint')}</sw-button>${k >= 0
          ? html`<sw-button size="sm" variant="ghost" data-curve-remove @click=${() => a.removeCurvePoint?.(w.id, k)}>${curveT('removePoint')}</sw-button>`
          : nothing}</div>
        <div class="note">${curveT('pointsNote')}</div>`}
  </div>`;
}

/** Curve mode (owner request 2026-10-08): the selected segment's radius (metres; empty = straight) with a straighten
 * button, or the selected corner's rounding radius. Management of the studio only: nothing reaches the operator maps. */
function renderCurve(w: GeomWall, v: StudioView, a: StudioActions, scale: number) {
  const seg = v.sel?.id === w.id ? v.sel.segment : undefined;
  const corner = v.sel?.id === w.id ? v.sel.vertex : undefined;
  if (seg !== undefined && seg < w.polyline.length - 1) {
    const r = segmentRadiusM(w, seg, v.W, v.H, scale);
    const min = minRadiusM(w, seg, v.W, v.H, scale);
    const set = (e: Event) => {
      const input = e.target as HTMLInputElement;
      const raw = input.value.trim();
      const x = parseFloat(raw);
      if (!raw) a.setSegmentRadius?.(w.id, seg, null);
      else if (x > 0) a.setSegmentRadius?.(w.id, seg, x);
      // the field shows the stored radius again: a refused value does not linger (an accepted one re-renders the new one)
      input.value = r === null ? '' : r.toFixed(2);
    };
    return html`<div class="two" data-curve-segment=${seg}>
      <sw-field label=${`${curveT('segment')} ${seg + 1} · ${curveT('radius')}`}><input type="number" min=${min.toFixed(2)} step="0.05" data-ltr data-segment-radius
        placeholder=${curveT('straight')} .value=${r === null ? '' : r.toFixed(2)} @change=${set} /></sw-field>
      <div class="btns"><sw-button size="sm" variant="ghost" data-segment-straighten ?disabled=${r === null} @click=${() => a.setSegmentRadius?.(w.id, seg, null)}>${curveT('straighten')}</sw-button></div>
    </div>`;
  }
  if (corner !== undefined && cornerRoundable(w, corner, v.W, v.H)) {
    const max = maxCornerRadiusM(w, corner, v.W, v.H, scale);
    const typed = Math.min(0.5, max);
    return html`<div class="two" data-curve-corner=${corner}>
      <sw-field label=${`${curveT('roundCorner')} ${corner + 1} · ${curveT('radius')}`}><input type="number" min="0.01" max=${max.toFixed(2)} step="0.05" data-ltr data-corner-radius
        .value=${typed.toFixed(2)} /></sw-field>
      <div class="btns"><sw-button size="sm" data-corner-apply @click=${(e: Event) => { const inp = (e.currentTarget as HTMLElement).closest('[data-curve-corner]')?.querySelector('input'); const x = parseFloat(inp?.value ?? String(typed)); if (x > 0) a.roundCorner?.(w.id, corner, x); }}>${curveT('apply')}</sw-button></div>
    </div>`;
  }
  return nothing;
}

/** The bulk layout's range (the inputs beside "חלוקה שווה"): panel state that is not part of the document, kept for the
 * session like the editor's other tool settings. */
const glazingUi: { range: [number, number] } = { range: [AUTO_MIN_M, AUTO_MAX_M] };

/** The glazing of a selected window wall (management, the studio panel only): the panel layout (nominal width or a
 * fixed count, bulk equal division within min / max), the mullion, sill and glazed height, the tint, and the panels that
 * open with their operation and bound entity. Each change is one patchWall - one undo step. On a phone it is shown, not
 * edited. */
function renderGlazing(w: GeomWall, v: StudioView, a: StudioActions, lengthM: number) {
  const g = glazingOf(w);
  const n = panelCount(lengthM, g);
  const ro = !!v.phone;
  const set = (patch: Partial<Glazing>) => a.patchWall(w.id, { glazing: patchGlazing(w, patch, lengthM) });
  const num = (e: Event, [lo, hi]: readonly [number, number], apply: (x: number) => void) => {
    const x = numberOf(e);
    if (Number.isFinite(x) && x >= lo && x <= hi) apply(x);
  };
  const optional = (e: Event, range: readonly [number, number], apply: (x: number | null) => void) => {
    if (!(e.target as HTMLInputElement).value.trim()) apply(null);
    else num(e, range, apply);
  };
  const operable = new Set(g.operable.map((o) => o.panel));
  const choices = (current: string | null) => {
    const list = v.entityChoices ?? [];
    return current && !list.some((c) => c.id === current) ? [...list, { id: current, name: current }] : list;
  };
  const auto = () => {
    const [lo, hi] = glazingUi.range;
    const next = applyAutoDivide(w, lengthM, Math.min(lo, hi), Math.max(lo, hi));
    if (next) a.patchWall(w.id, { glazing: next });
    else a.say?.(glassT('autoNone')); // nothing fits: the document is unchanged, a short message says so
  };
  return html`<div class="glazing" data-glazing-inspector=${w.id} data-glazing-panels=${n}>
    <div class="selhead"><strong>${glassT('glazing')}</strong><span class="muted" data-glazing-summary>${tr('{n} {glassT} · {v} מ׳', { n, glassT: glassT('panels'), v: (lengthM / n).toFixed(2) })}</span></div>
    <div class="two">
      <sw-field label=${glassT('panelWidth')}><input type="number" data-ltr data-glazing-width min=${PANEL_WIDTH_RANGE[0]} max=${PANEL_WIDTH_RANGE[1]} step="0.05" ?disabled=${ro} .value=${String(g.panel_width_m)}
        @change=${(e: Event) => num(e, PANEL_WIDTH_RANGE, (x) => set({ panel_width_m: x, panel_count: null }))} /></sw-field>
      <sw-field label=${glassT('panelCount')}><input type="number" data-ltr data-glazing-count min="1" max="200" step="1" ?disabled=${ro} placeholder=${glassT('panelCountAuto')} .value=${g.panel_count === null ? '' : String(g.panel_count)}
        @change=${(e: Event) => optional(e, [1, 200], (x) => set({ panel_count: x === null ? null : Math.round(x) }))} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${glassT('autoMin')}><input type="number" data-ltr data-glazing-auto-min min="0.2" max="6" step="0.05" ?disabled=${ro} .value=${String(glazingUi.range[0])}
        @change=${(e: Event) => num(e, PANEL_WIDTH_RANGE, (x) => (glazingUi.range = [x, glazingUi.range[1]]))} /></sw-field>
      <sw-field label=${glassT('autoMax')}><input type="number" data-ltr data-glazing-auto-max min="0.2" max="6" step="0.05" ?disabled=${ro} .value=${String(glazingUi.range[1])}
        @change=${(e: Event) => num(e, PANEL_WIDTH_RANGE, (x) => (glazingUi.range = [glazingUi.range[0], x]))} /></sw-field>
    </div>
    <div class="btns"><sw-button size="sm" data-glazing-auto ?disabled=${ro} title=${ro ? glassT('desktopOnly') : nothing} @click=${auto}>${glassT('autoDivide')}</sw-button></div>
    <div class="two">
      <sw-field label=${glassT('mullion')}><input type="number" data-ltr data-glazing-mullion min=${MULLION_RANGE[0]} max=${MULLION_RANGE[1]} step="0.01" ?disabled=${ro} .value=${String(g.mullion_m)}
        @change=${(e: Event) => num(e, MULLION_RANGE, (x) => set({ mullion_m: x }))} /></sw-field>
      <sw-field label=${glassT('sill')}><input type="number" data-ltr data-glazing-sill min=${SILL_RANGE[0]} max=${SILL_RANGE[1]} step="0.05" ?disabled=${ro} .value=${String(g.sill_m)}
        @change=${(e: Event) => num(e, SILL_RANGE, (x) => set({ sill_m: x }))} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${glassT('glazedHeight')}><input type="number" data-ltr data-glazing-height min=${GLAZED_HEIGHT_RANGE[0]} max=${GLAZED_HEIGHT_RANGE[1]} step="0.05" ?disabled=${ro} placeholder=${glassT('glazedHeightAuto')} .value=${g.glazed_height_m === null ? '' : String(g.glazed_height_m)}
        @change=${(e: Event) => optional(e, GLAZED_HEIGHT_RANGE, (x) => set({ glazed_height_m: x }))} /></sw-field>
      <sw-field label=${glassT('tint')}><select data-glazing-tint ?disabled=${ro} @change=${(e: Event) => set({ tint: (e.target as HTMLSelectElement).value as GlassTint })}>
        ${TINTS.map((t) => html`<option value=${t} ?selected=${g.tint === t}>${tintLabel(t)}</option>`)}</select></sw-field>
    </div>
    <sw-field label=${glassT('operable')}><div class="panelchips" role="group" aria-label=${glassT('operable')} data-glazing-chips>
      ${Array.from({ length: n }, (_, i) => html`<button type="button" class=${operable.has(i) ? 'on' : ''} data-glazing-panel=${i} aria-pressed=${operable.has(i) ? 'true' : 'false'} ?disabled=${ro}
        aria-label=${`${glassT('panel')} ${i + 1}`} @click=${() => a.patchWall(w.id, { glazing: toggleOperable(g, i) })}>${i + 1}</button>`)}
    </div></sw-field>
    ${g.operable.map((o) => html`<div class="two" data-operable-row=${o.panel}>
      <sw-field label=${`${glassT('panel')} ${o.panel + 1} · ${glassT('operation')}`}><select data-operable-operation ?disabled=${ro}
        @change=${(e: Event) => a.patchWall(w.id, { glazing: patchOperable(g, o.panel, { operation: (e.target as HTMLSelectElement).value as PanelOperation }) })}>
        ${OPERATIONS.map((op) => html`<option value=${op} ?selected=${o.operation === op}>${operationLabel(op)}</option>`)}</select></sw-field>
      <sw-field label=${glassT('entity')}><select data-operable-entity ?disabled=${ro}
        @change=${(e: Event) => { const id = (e.target as HTMLSelectElement).value; a.patchWall(w.id, { glazing: patchOperable(g, o.panel, { anchor_ref: id ? { resource_type: 'ha_entity', resource_id: id } : null }) }); }}>
        <option value="" ?selected=${!o.anchor_ref}>${glassT('noEntity')}</option>
        ${choices(o.anchor_ref?.resource_id ?? null).map((c) => html`<option value=${c.id} ?selected=${o.anchor_ref?.resource_id === c.id}>${c.name}</option>`)}
      </select></sw-field>
    </div>`)}
  </div>`;
}

/** Where the opening sits on its wall, typed exactly: metres from the wall's start to the opening's centre on a calibrated
 * plan, a percentage of the wall before calibration. Kept inside the wall (the validator's opening_outside_wall). The
 * value follows every move - a drag (the panel is given the drag's preview), the arrow keys, undo. */
function renderPlacement(o: GeomOpening, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  const w = v.doc.walls.find((x) => x.id === o.wall_id);
  const lengthM = w ? wallLengthPx(w, v.W, v.H) * scale : 0;
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
  const keys = tr('חצים מזיזים את הפתח לכיוון החץ לאורך הקיר.');
  return estimated
    ? html`<sw-field label=${tr('מיקום על הקיר (%)')} hint=${tr('מרכז הפתח: 0 = תחילת הקיר, 100 = סופו. {keys}', { keys })}><input type="number" min="0" max="100" step="0.1" data-ltr data-opening-percent
        aria-label=${tr('מיקום על הקיר (%)')} .value=${fmt(o.t)} @change=${set} /></sw-field>`
    : html`<sw-field label=${tr('מרחק מתחילת הקיר (מ׳)')} hint=${tr('עד מרכז הפתח; אורך הקיר {lengthM} מ׳. {keys}', { lengthM: lengthM.toFixed(2), keys })}><input type="number" min=${(lo * lengthM).toFixed(2)} max=${(hi * lengthM).toFixed(2)} step="0.01"
        data-ltr data-opening-distance aria-label=${tr('מרחק מתחילת הקיר (מ׳)')} .value=${fmt(o.t)} @change=${set} /></sw-field>`;
}

function renderOpening(o: GeomOpening, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  return html`<div class="sel" data-selected-opening=${o.id}>
    <div class="selhead"><strong>${OPENING_KIND_LABEL[o.kind]}</strong><span class="muted">${tr('{width_m} מ׳ רוחב{v}', { width_m: o.width_m.toFixed(2), v: o.anchor_ref ? tr(' · מקושר לישות') : '' })}</span></div>
    ${renderSourceBadge(o)}
    <div class="two">
      <sw-field label=${tr('סוג')}><select aria-label=${tr('סוג פתח')} @change=${(e: Event) => a.patchOpening(o.id, kindDefaults((e.target as HTMLSelectElement).value as OpeningKind))}>
        ${(Object.keys(OPENING_KIND_LABEL) as OpeningKind[]).map((k) => html`<option value=${k} ?selected=${o.kind === k}>${OPENING_KIND_LABEL[k]}</option>`)}
      </select></sw-field>
      <sw-field label=${tr('רוחב (מ׳)')}><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(o.width_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 10) a.patchOpening(o.id, { width_m: x }); }} /></sw-field>
    </div>
    ${renderPlacement(o, v, a, scale, estimated)}
    <div class="two">
      <sw-field label=${tr('גובה (מ׳)')}><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(o.height_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 10) a.patchOpening(o.id, { height_m: x }); }} /></sw-field>
      ${o.kind === 'window'
        ? html`<sw-field label=${tr('גובה אדן (מ׳)')}><input type="number" min="0" max="10" step="0.05" data-ltr .value=${String(o.sill_m)}
            @change=${(e: Event) => { const x = numberOf(e); if (x >= 0 && x <= 10) a.patchOpening(o.id, { sill_m: x }); }} /></sw-field>`
        : nothing}
    </div>
    ${o.kind === 'door'
      ? html`<div class="two">
          <sw-field label=${tr('כיוון פתיחה')}><select aria-label=${tr('כיוון פתיחה')} @change=${(e: Event) => a.patchOpening(o.id, { swing: (e.target as HTMLSelectElement).value as Swing })}>
            ${(Object.keys(SWING_LABEL) as Swing[]).map((k) => html`<option value=${k} ?selected=${o.swing === k}>${SWING_LABEL[k]}</option>`)}
          </select></sw-field>
          <sw-field label=${sideSwing(o.swing) ? tr('צד הפתיחה') : tr('ציר')}><select aria-label=${sideSwing(o.swing) ? tr('צד הפתיחה') : tr('ציר')} data-opening-hinge @change=${(e: Event) => a.patchOpening(o.id, { hinge: (e.target as HTMLSelectElement).value as Hinge })}>
            ${(Object.keys(HINGE_LABEL) as Hinge[]).map((k) => html`<option value=${k} ?selected=${o.hinge === k}>${(sideSwing(o.swing) ? SIDE_LABEL : HINGE_LABEL)[k]}</option>`)}
          </select></sw-field>
        </div>`
      : nothing}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>${tr('מחק {v}', { v: OPENING_KIND_LABEL[o.kind] })}</sw-button></div>
  </div>`;
}

function renderLabel(l: GeomLabel, v: StudioView, a: StudioActions) {
  return html`<div class="sel" data-selected-label=${l.id}>
    <sw-field label=${tr('טקסט')}><input type="text" maxlength="80" data-label-text .value=${l.text}
      @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patchLabel(l.id, { text: x }); }} /></sw-field>
    <sw-field label=${tr('גודל')}><input type="number" min="6" max="200" step="1" data-ltr .value=${String(l.size)}
      @change=${(e: Event) => { const x = numberOf(e); if (x >= 6 && x <= 200) a.patchLabel(l.id, { size: x }); }} /></sw-field>
    ${levelSelect(v.levels, l.level_id, (lv) => a.setLevel(l.id, lv))}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(l.id)}>${tr('מחק תווית')}</sw-button></div>
  </div>`;
}

function renderIssues(errors: GeometryIssue[], warnings: GeometryIssue[], a: StudioActions) {
  return html`<div class="issues" data-studio-issues>
    <div class="ilbl">${errors.length ? tr('{errorsCount} שגיאות חוסמות פרסום', { errorsCount: errors.length }) : tr('אין שגיאות חוסמות')}${warnings.length ? tr(' · {warningsCount} אזהרות', { warningsCount: warnings.length }) : ''}</div>
    ${[...errors, ...warnings].slice(0, 20).map((i) => html`<button class="issue ${i.severity}" data-issue=${i.code} data-issue-id=${i.id ?? ''} ?disabled=${!i.id} @click=${() => { if (i.id) a.focus(i.id); }}>${i.message}</button>`)}
  </div>`;
}

function renderCopy(cands: CopyCandidate[], a: StudioActions, busy: boolean) {
  return html`<div class="copy" data-copy-candidates>
    <div class="ilbl">${tr('להתחיל ממבנה קיים?')}</div>
    ${cands.map((c) => html`<button class="issue" data-copy-from=${c.version_id} ?disabled=${busy} @click=${() => a.copyFrom(c.version_id)}>
      <span>${tr('העתק {countLabel} ו{v}{countLabel2} מגרסה {v2}', { countLabel: countLabel(c.walls, tr('קיר אחד'), tr('קירות')), v: c.openings === 1 ? '' : '־', countLabel2: countLabel(c.openings, tr('פתח אחד'), tr('פתחים')), v2: c.status === 'published' ? tr('מפורסמת') : c.status === 'draft' ? tr('בטיוטה') : tr('מהארכיון') })}</span>
      <span class="muted">${c.same_drawing ? tr('אותו שרטוט') : tr('שרטוט אחר: המיקומים לא מיושרים, בדוק אותם')}</span>
    </button>`)}
  </div>`;
}

interface CalibView {
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
  const notCalibrated = v.showEstimates ? tr('התוכנית לא מכוילת: מידות מוצגות כמשוערות (≈)') : tr('התוכנית לא מכוילת: מידות מוסתרות עד הכיול (הגדרות)');
  return html`<sw-card heading=${tr('כיול קנה מידה')} subheading=${v.estimated ? notCalibrated : tr('מכויל · {fmtScale}', { fmtScale: fmtScale(v.scale) })} data-calib-panel>
    <ol class="steps">
      <li class=${v.a ? 'done' : ''}>${tr('לחץ על נקודה שהמרחק ממנה ידוע, למשל פינת קיר')}</li>
      <li class=${v.b ? 'done' : ''}>${tr('לחץ על הנקודה השנייה')}</li>
      <li>${tr('הקלד את המרחק האמיתי ביניהן')}</li>
    </ol>
    <sw-field label=${tr('מרחק (מ׳)')}><input type="number" min="0.01" max="1000" step="0.01" data-ltr data-calib-metres .value=${v.metres} ?disabled=${!v.b}
      @input=${(e: Event) => onMetres((e.target as HTMLInputElement).value)} /></sw-field>
    ${v.pixels !== null
      ? html`<div class=${tooClose ? 'note err' : 'note'}>${tr('{pixels} פיקסלים בתוכנית{v}', { pixels: v.pixels.toFixed(0), v: tooClose ? tr(' · הנקודות קרובות מדי') : metres > 0 ? tr(' · 1 מ׳ = {v} פיקסלים', { v: (v.pixels / metres).toFixed(1) }) : '' })}</div>`
      : nothing}
    ${pairs.length
      ? html`<div class="note" data-calib-pairs>${tr('זוגות שנמדדו:')} ${pairs.map((p, i) => html`<span class="pair" data-calib-pair=${i}>${tr('{metres} מ׳ / {pixels} px', { metres: p.metres, pixels: p.pixels.toFixed(0) })}${onDropPair ? html` <button type="button" class="x" aria-label=${tr('הסר זוג')} data-calib-drop=${i} @click=${() => onDropPair(i)}>×</button>` : nothing}</span>`)}</div>`
      : nothing}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-calib-save ?disabled=${!ready} @click=${onSave}>${tr('שמור כיול{v}', { v: pairs.length ? tr(' ({v} זוגות)', { v: pairs.length + (currentOk ? 1 : 0) }) : '' })}</sw-button>
      ${onAddPair ? html`<sw-button size="sm" icon="plus" data-calib-add ?disabled=${!canAdd} title=${tr('עד ארבעה זוגות; הממוצע משוקלל לפי האורך ומוצגת הסטייה')} @click=${onAddPair}>${tr('זוג נוסף')}</sw-button>` : nothing}
      <sw-button variant="ghost" size="sm" data-calib-reset @click=${onReset}>${tr('נקה נקודות')}</sw-button>
    </div>
    ${v.result ? html`<div class="note" data-calib-result>${v.result}</div>` : nothing}
    ${v.warning ? html`<div class="err" data-calib-warning>${v.warning}</div>` : nothing}
    <div class="note">${tr('המיקומים על המפה לא זזים, רק המטרים משתנים. הכיול נכנס לטיוטת המבנה והצופים רואים אותו אחרי פרסום.')}</div>
  </sw-card>`;
}

export function renderMeasurePanel(pts: Pt[], W: number, H: number, scale: number, estimated: boolean, show: boolean, onClear: () => void): TemplateResult {
  const total = pts.length > 1 ? lengthPx(pts, W, H) * scale : 0;
  const sub = estimated ? (show ? tr('לא מכויל: הערכים משוערים (≈)') : tr('לא מכויל: המידות מוסתרות עד הכיול (הגדרות)')) : tr('לפי הכיול של גרסת התוכנית');
  return html`<sw-card heading=${tr('מדידה')} subheading=${sub} data-measure-panel>
    <div class="note">${tr('לחץ נקודות על התוכנית. Shift מבטל הצמדה לזוויות, Esc מנקה.')}</div>
    <div class="measure-val" data-measure-distance>${pts.length > 1 ? fmtMetres(total, estimated, show) : '—'}</div>
    ${pts.length >= 3
      ? html`<div class="note">${tr('שטח המצולע')} <span class="measure-val" data-measure-area>${fmtArea(polygonAreaM2(pts, W, H, scale), estimated, show)}</span> ${tr('· היקף {fmtMetres}', { fmtMetres: fmtMetres(perimeterM(pts, W, H, scale), estimated, show) })}</div>`
      : nothing}
    <div class="btns"><sw-button variant="ghost" size="sm" data-measure-clear ?disabled=${!pts.length} @click=${onClear}>${tr('נקה')}</sw-button></div>
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
const DETECT_RULES: readonly { key: 'sectionLines' | 'joinGaps' | 'stepsRegions' | 'columns'; attr: string; label: string }[] = [
  { key: 'sectionLines', attr: 'section', label: tr('קווי חתך החוצים את המבנה אינם קירות') },
  { key: 'joinGaps', attr: 'join', label: tr('רווח קטן מ־30 ס״מ בלי סימון - קיר אחד') },
  { key: 'stepsRegions', attr: 'steps', label: tr('הצע טריבונה משורות מקבילות') },
  { key: 'columns', attr: 'columns', label: tr('הצע עמודים וקו מעטפת ביניהם') },
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
interface DetectCandidatesView {
  source: CandSource;
  set: CandidateSet;
  states: Record<string, CandState>;
  sel: string | null;
  hint: CalibrationHint | null;
  /** Unlocked items of the candidates' source in the live draft (what a replace would remove). */
  existingAuto: { walls: number; openings: number; objects?: number };
  elapsedMs: number | null;
  /** DXF / IFC: room polygons offered to the zones layer (never part of the structure accept). */
  rooms: number;
  /** IFC only (CR-037): the import report - what was read, what was skipped and why. */
  ifc?: IfcImportReport | null;
}
/** The replace step before an accept that removes earlier automatic items. */
export interface DetectReplaceAsk {
  /** What the replace removes from the live draft (merge_candidates' rule: the accepted sources, unlocked). */
  existing: { walls: number; openings: number; objects: number };
  /** Openings of another source (manual) sitting on unlocked walls of the candidates' source: they go with their wall. */
  manualOnAuto: number;
}
interface DetectView {
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
  /** PLAN3D-R32-ANSWERS-2438 (owner Q-MAP-9 a): unlocked automatic walls, openings and objects the editor can take away at once, and
   * whether the "remove them" confirmation is open. */
  autoRemovable?: number;
  removeAutoAsk?: boolean;
  ask: DetectReplaceAsk | null;
  acceptError: DetectAcceptError | null;
}
interface DetectActions {
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
  /** PLAN3D-R32-ANSWERS-2438: ask / confirm / cancel removing every automatic item from the draft (one undoable edit). */
  removeAuto?(step: 'ask' | 'confirm' | 'cancel'): void;
}

const CAND_KIND_LABEL: Record<CandKind, string> = { wall: tr('קיר'), door: tr('דלת'), window: tr('חלון'), passage: tr('מעבר') };
const CAND_KIND_ONLY: Record<CandKind, string> = { wall: tr('רק קירות'), door: tr('רק דלתות'), window: tr('רק חלונות'), passage: tr('רק מעברים') };
const SOURCE_BADGE: Record<string, string> = { auto: tr('זוהה אוטומטית'), imported: tr('יובא מ־DXF') };
/** The candidate list shows this many rows; the map shows them all. */
const CAND_ROWS = 300;
/** The lighter strength a timed-out run is offered to retry with. */
export const lighterStrength = (s: number): number => Math.max(0.3, Math.round((s - 0.2) * 100) / 100);

/** The badge of a wall or opening that a detector or an import produced (phase 3): source and confidence. */
function renderSourceBadge(item: { source: string; confidence: number }): TemplateResult | typeof nothing {
  if (item.source === 'manual') return nothing;
  return html`<span class="badge" data-auto-badge=${item.source}>${tr('{v} · ביטחון {confidence}', { v: SOURCE_BADGE[item.source] ?? item.source, confidence: item.confidence.toFixed(2) })}</span>`;
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
  if (w) return tr('עובי {fmtMetres}', { fmtMetres: fmtMetres(w.thickness_m, v.estimated, v.showEstimates) });
  const o = set.openings.find((x) => x.id === id);
  return o ? tr('רוחב {fmtMetres}', { fmtMetres: fmtMetres(o.width_m, v.estimated, v.showEstimates) }) : '';
}

export function renderDetectPanel(v: DetectView, a: DetectActions): TemplateResult {
  const c = v.cands;
  const o = v.opts;
  return html`<sw-card heading=${tr('זיהוי אוטומטי')} subheading=${tr('קירות, דלתות וחלונות מהתוכנית · עיבוד מקומי, ללא AI וללא שליחה החוצה')} data-detect-panel data-detect-state=${v.run.busy ? 'running' : c ? 'candidates' : 'idle'} aria-busy=${v.run.busy || v.busy ? 'true' : 'false'}>
    ${c
      ? renderCandidates(v, c, a)
      : html`<div class="note">${tr('הזיהוי מציע מועמדים בשכבה נפרדת (כחול מקווקו). דבר לא נשמר עד "אשר", ודבר לא מתפרסם בלי פרסום.')}</div>
          <div class="chks">
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('קירות')} data-detect-walls .checked=${o.walls} @change=${(e: Event) => { const on = toggled(e); a.setOpts({ ...o, walls: on, openings: on && o.openings }); }}></sw-toggle> ${tr('קירות')}</label>
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('פתחים (דלתות, חלונות, מעברים)')} data-detect-openings .checked=${o.openings} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, openings: toggled(e) })}></sw-toggle> ${tr('פתחים (דלתות, חלונות, מעברים)')}</label>
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('קירות חלולים (חיצוניים דקים)')} data-detect-hollow .checked=${o.hollow !== false} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, hollow: toggled(e) })}></sw-toggle> ${tr('קירות חלולים (חיצוניים דקים)')}</label>
            ${DETECT_RULES.map((rule) => html`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${rule.label} data-detect-rule=${rule.attr} .checked=${o[rule.key] !== false} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, [rule.key]: toggled(e) })}></sw-toggle> ${rule.label}</label>`)}
          </div>
          <sw-field label=${tr('עוצמת ניקוי: {strength} (קל ← חזק)', { strength: o.strength.toFixed(2) })}><input type="range" min="0.3" max="1" step="0.05" data-detect-strength .value=${String(o.strength)}
            @input=${(e: Event) => a.setOpts({ ...o, strength: parseFloat((e.target as HTMLInputElement).value) })} /></sw-field>
          ${v.autoInDraft ? html`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('החלף אוטומטיים קודמים')} data-detect-replace .checked=${o.replaceAuto} @change=${(e: Event) => a.setOpts({ ...o, replaceAuto: toggled(e) })}></sw-toggle> ${tr('החלף אוטומטיים קודמים ({autoInDraft} בטיוטה)', { autoInDraft: v.autoInDraft })}</label>` : nothing}
          ${v.autoRemovable && a.removeAuto ? renderRemoveAuto(v, a) : nothing}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="sparkle" data-detect-run aria-busy=${v.run.busy ? 'true' : 'false'} ?disabled=${v.run.busy || !o.walls || v.busy} @click=${() => a.run()}>${v.run.busy ? html`${tr('מזהה…')} <span data-detect-elapsed>${v.run.elapsed}</span> ${tr('שנ׳')}` : tr('זהה אוטומטית')}</sw-button>
            ${v.run.busy ? html`<span class="note">${tr('הזיהוי רץ בשרת{v}; הכפתור ייפתח כשיסיים.', { v: v.run.limitS ? tr(' (עד {limitS} שניות)', { limitS: v.run.limitS }) : '' })}</span>` : nothing}
          </div>
          ${v.run.error
            ? html`<div class="err" role="alert" data-detect-error=${v.run.timedOut ? 'detect_timeout' : 'failed'}>${v.run.error}</div>
                ${v.run.timedOut && o.strength > 0.3
                  ? html`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-retry ?disabled=${v.run.busy || v.busy} @click=${() => a.retryLighter()}>${tr('נסה שוב בעוצמה {v}', { v: lighterStrength(o.strength).toFixed(2) })}</sw-button></div>`
                  : nothing}`
            : nothing}`}
  </sw-card>`;
}

/** PLAN3D-R32-ANSWERS-2438 (owner Q-MAP-9 a): take every automatic item out of the draft - a confirmation first (it is one undoable
 * edit; manual, imported and locked items stay). */
function renderRemoveAuto(v: DetectView, a: DetectActions): TemplateResult {
  const n = v.autoRemovable ?? 0;
  return v.removeAutoAsk
    ? html`<div class="note" role="alert" data-detect-remove-auto-ask>${tr('להסיר מהטיוטה {n} פריטים שזוהו אוטומטית? פריטים שצוירו ביד, יובאו או ננעלו נשארים. אפשר להחזיר בביטול שינוי (Ctrl+Z).', { n })}</div>
        <div class="btns">
          <sw-button variant="danger" size="sm" icon="trash" data-detect-remove-auto-confirm ?disabled=${v.busy || v.run.busy} @click=${() => a.removeAuto?.('confirm')}>${tr('הסר {n} פריטים', { n })}</sw-button>
          <sw-button variant="ghost" size="sm" data-detect-remove-auto-cancel @click=${() => a.removeAuto?.('cancel')}>${tr('ביטול')}</sw-button>
        </div>`
    : html`<div class="btns"><sw-button variant="ghost" size="sm" icon="trash" data-detect-remove-auto ?disabled=${v.busy || v.run.busy} @click=${() => a.removeAuto?.('ask')}>${tr('הסר את כל מה שזוהה אוטומטית ({n})', { n })}</sw-button></div>`;
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
  const earlier = c.source !== 'detect' ? tr('מיובאים') : tr('אוטומטיים');
  const origin = c.source === 'dxf' ? tr(' · מיובאים מ־DXF') : c.source === 'ifc' ? ` · ${ifcT('origin')}` : c.elapsedMs !== null ? tr(' · זוהו ב־{v} שנ׳', { v: (c.elapsedMs / 1000).toFixed(1) }) : '';
  return html`<div class="note" data-detect-summary>${countLabel(set.walls.length, tr('קיר אחד'), tr('קירות'))} · ${countLabel(set.openings.length, tr('פתח אחד'), tr('פתחים'))}${set.objects.length ? ` · ${countLabel(set.objects.length, tr('עצם אחד'), tr('עצמים'))}` : ''} · <span data-detect-accepted>${v.acceptedCount}</span> ${tr('מסומנים לאישור{origin}', { origin })}</div>
    ${outsideMainSummary(set) ? html`<div class="note warn" data-detect-outside-main>${outsideMainSummary(set)}</div>` : nothing}
    ${c.ifc ? html`<div class="note" data-ifc-summary>${ifcSummary(c.ifc)}</div>
      ${c.ifc.skipped_total ? html`<ul class="note ifc-skipped" data-ifc-skipped>${ifcSkippedLines(c.ifc).map((line) => html`<li>${line}</li>`)}</ul>` : nothing}` : nothing}
    ${!ids.length ? html`<div class="note" data-detect-empty>${tr('לא נמצאו קירות. נסה עוצמת ניקוי אחרת, או צייר בכלי "מבנה".')}</div>` : nothing}
    ${c.hint && v.estimated && v.canEstimate && !v.hintApplied
      ? html`<div class="hint" data-calib-hint>
          <div>${tr('התוכנית לא מכוילת. לפי רוחב דלת אופייני (0.9 מ׳, {countLabel}):', { countLabel: countLabel(c.hint.doors, tr('דלת אחת'), tr('דלתות')) })} <strong>${fmtScale(c.hint.scale_m_per_px)}</strong> ${tr('— משוער.')}</div>
          <div class="btns"><sw-button size="sm" icon="scale" data-calib-hint-apply ?disabled=${v.busy} @click=${() => a.applyHint()}>${tr('השתמש בהערכה')}</sw-button><span class="note">${tr('מומלץ לפני האישור: המידות במטרים של המועמדים יחושבו לפי ההערכה, ויוצגו עם ≈ עד כיול בשתי נקודות')}</span></div>
        </div>`
      : v.hintApplied
        ? html`<div class="note" data-calib-hint-applied>${tr('קנה מידה משוער נשמר (≈ {fmtScale}); כיול בשתי נקודות יחליף אותו', { fmtScale: fmtScale(v.scale) })}</div>`
        : nothing}
    <div class="modes" role="group" aria-label=${tr('קבלת מועמדים')}>
      <button data-detect-accept-all ?disabled=${v.busy} @click=${() => a.acceptAll()}>${tr('קבל הכול')}</button>
      <button data-detect-accept-conf ?disabled=${v.busy} @click=${() => a.acceptAbove(0.8)}>${tr('קבל מעל 0.8')}</button>
      ${present.map((k) => html`<button data-detect-accept-kind=${k} ?disabled=${v.busy} @click=${() => a.acceptKinds([k])}>${CAND_KIND_ONLY[k]}</button>`)}
      <button data-detect-reject-all ?disabled=${v.busy} @click=${() => a.rejectAll()}>${tr('דחה הכול')}</button>
    </div>
    <div class="note">${v.narrow ? html`<span data-detect-phone-note>${tr('בטלפון אפשר לקבל או לדחות מועמדים; תיקון קצוות של קיר מועמד זמין במסך רחב.')}</span>` : tr('לחיצה על מועמד במפה או על התיבה ברשימה מקבלת / דוחה אותו; גרירת קצה של הקיר המסומן מתקנת אותו לפני האישור.')}</div>
    <div class="dlist" data-cand-list>
      ${ids.slice(0, CAND_ROWS).map((id) => {
        const k = candKind(set, id);
        const state = c.states[id] ?? 'accepted';
        return html`<div class="dcand ${state} ${id === c.sel ? 'on' : ''} ${bad.has(id) ? 'bad' : ''}" data-cand-row=${id} data-cand-state=${state} ?data-cand-bad=${bad.has(id)}>
          <input type="checkbox" aria-label=${tr('קבל {v}', { v: CAND_KIND_LABEL[k] })} .checked=${state === 'accepted'} ?disabled=${v.busy} @change=${() => a.toggle(id)} />
          <button class="linkbtn" aria-label=${`${CAND_KIND_LABEL[k]} ${candScore(set, id).toFixed(2)}${isOutsideMain(set, id) ? ` ${OUTSIDE_MAIN_HE}` : ''}`} @click=${() => a.focus(id)}>${CAND_KIND_LABEL[k]}</button>
          ${isOutsideMain(set, id) ? html`<span class="outside" data-cand-outside-main>${OUTSIDE_MAIN_HE}</span>` : nothing}
          <span class="muted ltr" aria-hidden="true">${candScore(set, id).toFixed(2)}</span>
        </div>`;
      })}
      ${ids.length > CAND_ROWS ? html`<div class="note">${tr('מוצגים {CAND_ROWS} הראשונים ברשימה; במפה מוצגים כולם.', { CAND_ROWS })}</div>` : nothing}
    </div>
    ${sel ? html`<div class="note" data-cand-selected=${sel.id}>${tr('{v} נבחר{v2} · ביטחון {score} · {candSize} · {v3}', { v: CAND_KIND_LABEL[sel.kind], v2: isOutsideMain(set, sel.id) ? ` · ${OUTSIDE_MAIN_HE}` : '', score: sel.score.toFixed(2), candSize: candSize(v, set, sel.id), v3: (c.states[sel.id] ?? 'accepted') === 'accepted' ? tr('יאושר') : tr('נדחה') })}</div>` : nothing}
    ${set.objects.length ? html`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('כולל {objectsSummary}', { objectsSummary: objectsSummary(set, c.source) })} data-detect-objects .checked=${v.objectsOn} @change=${(e: Event) => a.setObjects(toggled(e))}></sw-toggle> ${tr('כולל {objectsSummary}', { objectsSummary: objectsSummary(set, c.source) })}</label>` : nothing}
    ${existing ? html`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('החלף {earlier} קודמים', { earlier })} data-detect-replace .checked=${v.opts.replaceAuto} @change=${(e: Event) => a.setOpts({ ...v.opts, replaceAuto: toggled(e) })}></sw-toggle> ${tr('החלף {earlier} קודמים ({existing} בטיוטה)', { earlier, existing })}</label>` : nothing}
    ${c.rooms ? html`<div class="btns"><sw-button size="sm" icon="map" data-detect-rooms ?disabled=${v.busy} @click=${() => a.importRooms()}>${tr('ייבא {countLabel} כאזורים', { countLabel: countLabel(c.rooms, tr('חדר אחד'), tr('חדרים')) })}</sw-button><span class="note">${tr('החדרים נשמרים כאזורים, לא כחלק מהמבנה')}</span></div>` : nothing}
    ${err
      ? html`<div class="err" role="alert" data-detect-accept-error=${err.code}>${err.message}</div>
          ${err.issues.length
            ? html`<div class="issues" data-detect-issues>${err.issues.slice(0, 20).map((i) => html`<button class="issue error" ?disabled=${!i.id || !ids.includes(i.id)} @click=${() => { if (i.id) a.focus(i.id); }}>${i.message}</button>`)}</div>`
            : nothing}
          ${err.stale ? html`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-reload ?disabled=${v.busy} @click=${() => a.reload()}>${tr('טען את הטיוטה מחדש')}</sw-button><span class="note">${tr('המועמדים נשארים; אחרי הטעינה אשר שוב')}</span></div>` : nothing}`
      : nothing}
    ${v.ask
      ? html`<div class="hint" data-detect-replace-confirm>
          <div><strong>${tr('להחליף את ה{earlier} הקודמים?', { earlier })}</strong></div>
          <div data-detect-replace-counts>${tr('יוסרו מהטיוטה {countLabel} ו־{countLabel2}{v} {earlier} שנוספו קודם (פריטים נעולים נשארים).', { countLabel: countLabel(v.ask.existing.walls, tr('קיר אחד'), tr('קירות')), countLabel2: countLabel(v.ask.existing.openings, tr('פתח אחד'), tr('פתחים')), v: v.ask.existing.objects ? tr(' ו־{countLabel}', { countLabel: countLabel(v.ask.existing.objects, tr('עצם אחד'), tr('עצמים')) }) : '', earlier })}</div>
          ${v.ask.manualOnAuto
            ? html`<div class="err" data-detect-replace-manual>${tr('{countLabel} על קירות אלה {v} איתם.', { countLabel: countLabel(v.ask.manualOnAuto, tr('פתח ידני אחד'), tr('פתחים ידניים')), v: v.ask.manualOnAuto === 1 ? tr('יוסר') : tr('יוסרו') })}</div>`
            : html`<div class="note">${tr('פתח ידני שיושב על קיר שיוסר — יוסר איתו.')}</div>`}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="check" data-detect-replace-go ?disabled=${v.busy} @click=${() => a.confirmReplace()}>${tr('החלף ואשר {acceptedCount}', { acceptedCount: v.acceptedCount })}</sw-button>
            <sw-button variant="ghost" size="sm" data-detect-replace-cancel ?disabled=${v.busy} @click=${() => a.cancelReplace()}>${tr('חזור')}</sw-button>
          </div>
        </div>`
      : html`<div class="btns">
          <sw-button variant="primary" size="sm" icon="check" data-detect-confirm ?disabled=${v.busy || !v.acceptedCount} @click=${() => a.confirm()}>${tr('אשר {acceptedCount}', { acceptedCount: v.acceptedCount })}</sw-button>
          <sw-button variant="ghost" size="sm" data-detect-discard ?disabled=${v.busy} @click=${() => a.discard()}>${tr('בטל')}</sw-button>
        </div>`}
    <div class="note">${tr('האישור מוסיף לטיוטת המבנה בלבד (Ctrl+Z מבטל); הצופים יראו את התוצאה אחרי פרסום.')}</div>`;
}

// ---------------------------------------------------------------- the library and the object inspector (T085)

interface LibraryView {
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

interface LibraryActions {
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
  return html`<sw-card heading=${tr('ספריית עצמים')} subheading=${v.placing ? tr('לחץ על התוכנית כדי להציב: {he} · Esc לביטול', { he: v.placing.names.he }) : tr('{itemsCount} פריטים · חיפוש בעברית ובאנגלית', { itemsCount: v.lib.items.length })} data-library-panel data-studio-save=${v.saveState}>
    <sw-field><input type="search" data-lib-search placeholder=${tr('חיפוש: כיסא, מטף, bleachers…')} .value=${v.q} @input=${(e: Event) => a.setQuery((e.target as HTMLInputElement).value)} /></sw-field>
    <div class="modes" role="group" aria-label=${tr('קטגוריות')}>
      <button class=${v.category === null ? 'on' : ''} data-lib-cat="all" @click=${() => a.setCategory(null)}>${tr('הכול')}</button>
      <button class=${v.category === 'recent' ? 'on' : ''} data-lib-cat="recent" @click=${() => a.setCategory('recent')}>${tr('לאחרונה')}</button>
      <button class=${v.category === 'favorites' ? 'on' : ''} data-lib-cat="favorites" @click=${() => a.setCategory('favorites')}>${tr('מועדפים')}</button>
      ${v.lib.categories.map((c) => html`<button class=${v.category === c.id ? 'on' : ''} data-lib-cat=${c.id} @click=${() => a.setCategory(c.id)}>${c.he}</button>`)}
    </div>
    ${v.placing ? html`<div class="btns"><sw-button size="sm" variant="ghost" data-lib-cancel @click=${() => a.cancelPlacing()}>${tr('סיים הצבה')}</sw-button></div>` : nothing}
    <div class="list libl">
      ${items.length ? items.map((i) => html`<div class="libitem ${v.placing?.id === i.id ? 'on' : ''}" data-lib-item=${i.id} role="button" tabindex="0" draggable="true" title=${tr('{he} · {w_m}×{d_m}×{h_m} מ׳', { he: i.names.he, w_m: i.size.w_m, d_m: i.size.d_m, h_m: i.size.h_m })}
          @dragstart=${(e: DragEvent) => e.dataTransfer?.setData('text/x-sw-item', i.id)} @click=${() => a.pick(i)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && a.pick(i)}>
          <span class="nm">${i.names.he}${i.custom ? html` <span class="muted">${tr('מותאם')}</span>` : nothing}</span>
          <span class="muted ltr">${i.size.w_m}×${i.size.d_m} m</span>
          <button class="fav ${v.favorites.includes(i.id) ? 'on' : ''}" data-lib-fav=${i.id} aria-label=${tr('מועדף')} aria-pressed=${v.favorites.includes(i.id) ? 'true' : 'false'} @click=${(e: Event) => { e.stopPropagation(); a.toggleFavorite(i.id); }}><sw-icon name="star" size=${14}></sw-icon></button>
        </div>`) : html`<div class="note">${v.category === 'recent' ? tr('עדיין לא הוצבו פריטים בדפדפן הזה.') : v.category === 'favorites' ? tr('סמן את הכוכב ליד פריט כדי לשמור אותו כאן.') : tr('לא נמצאו פריטים.')}</div>`}
    </div>
    ${found.length > LIB_ROWS ? html`<div class="note" data-lib-more>${tr('מוצגים {LIB_ROWS} · חפש או בחר קטגוריה', { LIB_ROWS })}</div>` : nothing}
    ${v.phone ? html`<div class="note">${tr('בטלפון: הצבה והזזה של עצם בודד; מערכים וציור קירות בדסקטופ.')}</div>` : nothing}
    ${v.canManage ? html`<div class="exports" role="group" aria-label=${tr('הספרייה המותאמת')}>
      <a class="btnlink" data-lib-export href=${v.exportHref} download>${tr('ייצוא הספרייה המותאמת')}</a>
      <label class="btnlink">${tr('ייבוא')}<input type="file" accept="application/json,.json" data-lib-import hidden @change=${(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) a.importFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>
    </div>` : nothing}
  </sw-card>`;
}

interface ObjectView {
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
  /** CR-029 ST7 UI: the material the resolver gives the object without an own one, and the swatches' preview style. */
  materialDefault?: string;
  materialStyle?: VisualStyle;
}

interface ObjectActions {
  patch(id: string, patch: Partial<GeomObject>): void;
  unbind(id: string): void;
  remove(id: string): void;
  /** Optional: a caller without them gets no array / custom item / select group control in the inspector. */
  array?: (id: string) => void;
  custom?: (id: string) => void;
  /** A copy beside the object, selected and ready to drag (also Ctrl+D and Alt+drag). */
  duplicate?: (id: string) => void;
  selectGroup?: (groupId: string) => void;
  /** CR-029 ST7 UI: the object's material (null = the catalog item's / the role's default). */
  setMaterial?: (id: string, materialId: string | null) => void;
  setMaterialStyle?: (style: VisualStyle) => void;
}

function paramField(o: GeomObject, name: string, spec: ParamSpec, levels: GeomLevel[], a: ObjectActions) {
  const value = o.params[name];
  if (spec.type === 'level') {
    return html`<sw-field label=${spec.he}><select data-object-param=${name} @change=${(e: Event) => a.patch(o.id, { params: { ...o.params, [name]: (e.target as HTMLSelectElement).value || null } })}>
      <option value="" ?selected=${!value}>${tr('ללא')}</option>${levels.filter((l) => l.id !== o.level_id).map((l) => html`<option value=${l.id} ?selected=${value === l.id}>${tr('{name} ({elevation_m} מ׳)', { name: l.name, elevation_m: l.elevation_m })}</option>`)}</select></sw-field>`;
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
  return html`<sw-card heading=${name} subheading=${v.item ? `${v.lib_category(v.item)}${v.item.custom ? tr(' · פריט מותאם') : ''}` : tr('הפריט לא קיים בספרייה: העצם מצויר כתיבה')} data-selected-object=${o.id}>
    <sw-field label=${tr('שם על המפה (אופציונלי)')}><input type="text" maxlength="80" data-object-label .value=${o.label ?? ''} @change=${(e: Event) => a.patch(o.id, { label: (e.target as HTMLInputElement).value.trim() || null })} /></sw-field>
    ${o.anchor_ref
      ? html`<div class="note" data-object-bound>${tr('הגוף של {v}: המיקום, המצב וההרשאות מהעוגן.', { v: v.anchorName ?? o.anchor_ref.resource_id })} <button class="linkbtn" data-object-unbind @click=${() => a.unbind(o.id)}>${tr('נתק מהישות')}</button></div>`
      : nothing}
    <div class="two">
      <sw-field label=${tr('מפלס')}><select data-item-level @change=${(e: Event) => a.patch(o.id, { level_id: (e.target as HTMLSelectElement).value })}>${v.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === o.level_id}>${l.name}</option>`)}</select></sw-field>
      <sw-field label=${tr('סיבוב (°)')}><input type="number" min="0" max="359" step="1" data-ltr data-object-rotation .value=${String(Math.round(o.rotation_deg))} ?disabled=${!!o.anchor_ref}
        @change=${(e: Event) => { const x = numberOf(e); if (Number.isFinite(x)) a.patch(o.id, { rotation_deg: ((Math.round(x) % 360) + 360) % 360 }); }} /></sw-field>
    </div>
    <div class="three">${size('w_m', tr('רוחב (מ׳)'))}${size('d_m', tr('עומק (מ׳)'))}${size('h_m', tr('גובה (מ׳)'))}</div>
    <sw-field label=${tr('גובה מהרצפה (מ׳)')}><input type="number" min="-50" max="500" step="0.05" data-ltr data-object-z .value=${String(o.z_m)} @change=${(e: Event) => { const x = numberOf(e); if (x >= -50 && x <= 500) a.patch(o.id, { z_m: x }); }} /></sw-field>
    ${v.item ? Object.entries(v.item.params_schema).map(([k, spec]) => paramField(o, k, spec, v.levels, a)) : nothing}
    ${a.setMaterial && v.materialDefault
      ? renderMaterialField({ key: `objects:${o.id}`, label: tr('חומר'), host: 'object', value: o.material_id ?? null, defaultId: v.materialDefault, style: v.materialStyle ?? 'light' }, { pick: (id) => a.setMaterial!(o.id, id), setStyle: (s) => a.setMaterialStyle?.(s) })
      : nothing}
    ${renderItemTags(o.tags, (tags) => a.patch(o.id, { tags }))}
    ${group ? html`<div class="note" data-object-group>${tr('חלק ממערך של {member_idsCount}', { member_idsCount: group.member_ids.length })}${a.selectGroup ? html` · <button class="linkbtn" data-select-group @click=${() => a.selectGroup?.(group.id)}>${tr('בחר את המערך')}</button>` : nothing}</div>` : nothing}
    <div class="note">${tr('{v} · חצים = הזזה עדינה (Shift = גדולה) · Alt+גרירה = שכפול · Delete = מחיקה', { v: v.estimated ? (v.showEstimates ? tr('המידות במטרים משוערות (≈) עד הכיול') : tr('לא מכויל: המידות מוצגות כערכי הפריט')) : tr('המידות במטרים לפי הכיול') })}</div>
    <div class="btns">
      ${a.duplicate ? html`<sw-button size="sm" icon="layers" data-object-duplicate title=${tr('עותק ליד העצם, נבחר ומוכן לגרירה (גם Ctrl+D, או Alt+גרירה של העצם)')} @click=${() => a.duplicate?.(o.id)}>${tr('שכפל')}</sw-button>` : nothing}
      ${a.array ? html`<sw-button size="sm" icon="grid" data-object-array ?disabled=${v.phone || !!o.anchor_ref || !!o.group_id} title=${v.phone ? tr('מערכים בדסקטופ בלבד') : o.group_id ? tr('העצם כבר במערך') : tr('שורות × עמודות מהעצם הזה')} @click=${() => a.array?.(o.id)}>${tr('מערך')}</sw-button>` : nothing}
      ${v.canManage && a.custom ? html`<sw-button size="sm" icon="plus" data-object-custom @click=${() => a.custom?.(o.id)}>${tr('צור פריט מזה')}</sw-button>` : nothing}
      <sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>${tr('מחק')}</sw-button>
    </div>
  </sw-card>`;
}

// ---------------------------------------------------------------- groups, arrays and custom items (T085)

interface GroupActions {
  select(objectId: string): void;
  askDelete(groupId: string): void;
}

export function renderGroupInspector(g: GeomGroup, item: CatalogItem | undefined, a: GroupActions): TemplateResult {
  const p = g.params as { rows?: number; cols?: number; spacing_x_m?: number; spacing_y_m?: number };
  return html`<sw-card heading=${g.kind === 'array' ? tr('מערך של {member_idsCount}', { member_idsCount: g.member_ids.length }) : tr('קבוצה של {member_idsCount}', { member_idsCount: g.member_ids.length })} subheading=${item ? item.names.he : ''} data-selected-group=${g.id}>
    ${g.kind === 'array' && p.rows ? html`<div class="note">${tr('{rows} שורות ×', { rows: p.rows })} ${p.cols} ${tr('עמודות · רווח')} ${p.spacing_x_m} × ${p.spacing_y_m} ${tr('מ׳')}</div>` : nothing}
    <div class="note">${tr('גרירת אחד העצמים מזיזה את כל המערך · Delete מוחק (ושואל אם למחוק גם את העצמים)')}</div>
    <div class="btns">
      ${g.member_ids[0] ? html`<sw-button size="sm" variant="ghost" data-group-first @click=${() => a.select(g.member_ids[0])}>${tr('בחר עצם אחד')}</sw-button>` : nothing}
      <sw-button size="sm" variant="danger" icon="trash" data-group-delete @click=${() => a.askDelete(g.id)}>${tr('מחק מערך')}</sw-button>
    </div>
  </sw-card>`;
}

// ---------------------------------------------------------------- multi-selection (T085)

/** How several items are picked in the editor's select tool (owner report 2026-09-26). */
export const MULTI_HINT = tr('Shift+לחיצה מוסיפה קיר, עצם או אזור לבחירה או מוציאה אותו ממנה; גרירת מלבן מרקע ריק בוחרת את מה שנמצא בתוכו במלואו; Ctrl+A בוחר את כל מה שמוצג במפלס; Esc מנקה. הזזת התוכנית: רווח + גרירה, או גרירה בכפתור האמצעי; גלגלת לזום.');

// ---------------------------------------------------------------- keyboard shortcuts help (T085, owner request 2026-09-27)

interface ShortcutEntry {
  keys: string;
  desc: string;
}
interface ShortcutGroup {
  title: string;
  items: ShortcutEntry[];
}

/** Every shortcut the plan editor's keyboard handler and canvas actually implement (verified against
 * `explore-plan-editor.ts`'s `handleKey` / `handleMultiKey` / `handleStudioKey` / `nudgeGeom` and `sw-plan-canvas.ts`'s
 * pan and drag handlers) - a pure data structure so the help dialog and a future test can both read it. Keep this in
 * sync by hand: nothing here is generated from the handler. */
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: tr('בחירה'),
    items: [
      { keys: tr('Shift+לחיצה'), desc: tr('מוסיף פריט לבחירה או מוציא אותו ממנה') },
      { keys: tr('גרירת מלבן מרקע ריק'), desc: tr('בוחרת את כל מה שבתוכה במלואו') },
      { keys: 'Ctrl+A', desc: tr('בוחר את כל מה שמוצג במפלס הנוכחי') },
      { keys: 'Esc', desc: tr('מנקה את הבחירה, או סוגר את הפעולה הפתוחה') },
    ],
  },
  {
    title: tr('עריכה'),
    items: [
      { keys: 'Delete / Backspace', desc: tr('מוחק את מה שנבחר') },
      { keys: 'Ctrl+D', desc: tr('משכפל את מה שנבחר') },
      { keys: tr('Alt+גרירה'), desc: tr('גורר עותק, במקום להזיז את המקור') },
      { keys: tr('חצים'), desc: tr('מזיזים את הנבחר צעד קטן; Shift+חץ = צעד גדול') },
      { keys: 'Ctrl+Z / Ctrl+Y', desc: tr('ביטול וחזרה על הפעולה האחרונה') },
      { keys: 'Ctrl+S', desc: tr('שמירה') },
    ],
  },
  {
    title: tr('תצוגה וניווט'),
    items: [
      { keys: tr('רווח+גרירה, או גרירה בכפתור האמצעי'), desc: tr('מזיז את התוכנית (פאן)') },
      { keys: tr('כפתור היד בסרגל העליון'), desc: tr('מצב הזזה קבוע: כל גרירה מזיזה את התוכנית, עד לחיצה חוזרת עליו או Esc') },
      { keys: tr('גלגלת העכבר'), desc: tr('זום פנימה והחוצה סביב הסמן') },
    ],
  },
  {
    title: tr('כלים ספציפיים'),
    items: [
      { keys: tr('ציור קיר (מבנה)'), desc: tr('Enter מסיים את הקיר; Backspace/Delete מוחק את הנקודה האחרונה') },
      { keys: 'D', desc: tr('סמן דלת (כלי המבנה): לחיצה על סמל דלת מציעה אותה; Enter מאשר, Esc מבטל את ההצעה') },
      { keys: 'R', desc: curveT('tipCurved') },
      { keys: 'G', desc: glassT('toolTip') },
      { keys: 'C', desc: curveT('tipCurve') },
      { keys: tr('ציור אזור'), desc: tr('לחיצה מוסיפה פינה; Enter מסיים משלוש פינות; Esc מבטל') },
      { keys: tr('מפלסים ומחברים'), desc: tr('Esc מבטל את נקודת ההתחלה שנבחרה למחבר') },
      { keys: tr('מדידה / כיול'), desc: tr('Esc מנקה את הנקודות שנבחרו עד כה') },
      { keys: tr('זיהוי אוטומטי'), desc: tr('Delete/Backspace מסיר מועמד נבחר; Esc סוגר וחוזר לכלי הבחירה') },
      { keys: tr('מעגלי תאורה'), desc: tr('Esc מבטל את סוג הגוף הממתין להצבה, ואז סוגר את מצב חברי המעגל') },
    ],
  },
];

export function renderShortcutsDialog(onClose: () => void): TemplateResult {
  return html`<sw-dialog open heading=${tr('קיצורי מקלדת')} subheading=${tr('כל הקיצורים הפעילים כרגע בעורך התוכנית')} data-shortcuts-dialog @close=${onClose}>
    <div class="shortcuts">
      ${SHORTCUT_GROUPS.map(
        (g) => html`<div class="shortcuts-group" data-shortcuts-group=${g.title}>
          <h4>${g.title}</h4>
          ${g.items.map((it) => html`<div class="shortcuts-row" data-shortcuts-row><kbd>${it.keys}</kbd><span>${it.desc}</span></div>`)}
        </div>`
      )}
    </div>
    <sw-button slot="footer" variant="primary" data-shortcuts-close @click=${onClose}>${tr('סגור')}</sw-button>
  </sw-dialog>`;
}

// ---------------------------------------------------------------- tags (T085)

/** One chip of a tags editor: the tag, and in the bulk panel how many of the selected items carry it. */
interface TagChip {
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
    ? tr('לחיצה על תגית מסירה אותה מכל הנבחרים שיש להם אותה (המספר: כמה מהם); תגית חדשה נוספת לכולם')
    : v.full
      ? tr('הגעת למקסימום של {TAG_MAX_COUNT} תגיות; לחיצה על תגית מסירה אותה', { TAG_MAX_COUNT })
      : tr('לסימון ולבחירה מהירה (בחירה לפי תגית ליד המפלסים) · לחיצה על תגית מסירה אותה · עד {TAG_MAX_COUNT} תגיות של {TAG_MAX_LEN} תווים', { TAG_MAX_COUNT, TAG_MAX_LEN });
  return html`<sw-field label=${v.bulk ? tr('תגיות בבחירה') : tr('תגיות')} hint=${hint}><div class="tagsfield" data-tags-field>
    ${v.chips.length
      ? html`<div class="tagchips" data-tag-chips>${v.chips.map((c) => html`<sw-chip icon="close" data-tag=${c.tag} data-tag-count=${v.bulk && c.count !== undefined ? String(c.count) : nothing} .count=${v.bulk ? c.count : undefined}
          title=${v.bulk ? tr('הסר את "{tag}" מכל הנבחרים', { tag: c.tag }) : tr('הסר את התגית "{tag}"', { tag: c.tag })} @click=${() => { if (!v.disabled) onRemove(c.tag); }}>${c.tag}</sw-chip>`)}</div>`
      : html`<div class="note" data-tag-none>${v.bulk ? tr('לאף פריט בבחירה אין תגיות') : tr('אין תגיות')}</div>`}
    <div class="tagadd">
      <input type="text" maxlength=${String(TAG_MAX_LEN)} data-tag-input aria-label=${v.bulk ? tr('תגית להוספה לכל הנבחרים') : tr('תגית חדשה')} placeholder=${tr('תגית חדשה, למשל: מטבח')} ?disabled=${off}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(e.target as HTMLInputElement); } }} />
      <sw-button size="sm" icon="plus" data-tag-add ?disabled=${off} @click=${(e: Event) => add((e.currentTarget as HTMLElement).parentElement?.querySelector('input'))}>${v.bulk ? tr('הוסף לכולם') : tr('הוסף')}</sw-button>
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
  return html`<select class="tagpick" data-tag-select aria-label=${tr('בחירה לפי תגית')} title=${tr('בוחר את כל הקירות, העצמים והאזורים עם התגית, במפלס המוצג')}
    @change=${(e: Event) => { const s = e.target as HTMLSelectElement; const t = s.value; s.value = ''; if (t) onPick(t); }}>
    <option value="" selected>${tr('בחירה לפי תגית…')}</option>${tags.map((t) => html`<option value=${t.tag}>${t.tag} (${t.count})</option>`)}
  </select>`;
}

interface MultiView {
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
interface MultiActions {
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
  { mode: 'left', label: tr('יישור לשמאל'), title: tr('הקצוות השמאליים של העצמים על הקצה השמאלי של הבחירה') },
  { mode: 'right', label: tr('יישור לימין'), title: tr('הקצוות הימניים של העצמים על הקצה הימני של הבחירה') },
  { mode: 'top', label: tr('יישור למעלה'), title: tr('הקצוות העליונים של העצמים על הקצה העליון של הבחירה') },
  { mode: 'bottom', label: tr('יישור למטה'), title: tr('הקצוות התחתונים של העצמים על הקצה התחתון של הבחירה') },
  { mode: 'center-y', label: tr('מרכזים בקו אופקי'), title: tr('מרכזי העצמים על קו אופקי אחד, באמצע הבחירה (למשל שורת מנורות)') },
  { mode: 'center-x', label: tr('מרכזים בקו אנכי'), title: tr('מרכזי העצמים על קו אנכי אחד, באמצע הבחירה') },
];

/** The align / distribute block of the bulk panel: from two objects that can move; distribute from three. */
function renderAlignActions(v: MultiView, a: MultiActions): TemplateResult {
  if (v.alignable < 2) return html``;
  const others = v.walls + v.zones;
  const hint = tr('ביחס למסגרת של {alignable} העצמים שנבחרו · צעד ביטול אחד{v}', { alignable: v.alignable, v: others ? tr(' · קירות ואזורים שבבחירה לא זזים') : '' });
  return html`<sw-field label=${tr('יישור ופיזור העצמים')} hint=${hint}><div class="alignbtns" data-multi-align>
    ${ALIGN_ACTIONS.map((x) => html`<sw-button size="sm" variant="ghost" data-align=${x.mode} title=${x.title} ?disabled=${v.busy} @click=${() => a.align(x.mode)}>${x.label}</sw-button>`)}
    <sw-button size="sm" variant="ghost" data-distribute="x" ?disabled=${v.busy || v.alignable < 3} title=${v.alignable < 3 ? tr('פיזור צריך לפחות שלושה עצמים') : tr('רווחים שווים בין העצמים לרוחב; הקיצוניים נשארים במקומם')} @click=${() => a.distribute('x')}>${tr('פיזור שווה לרוחב')}</sw-button>
    <sw-button size="sm" variant="ghost" data-distribute="y" ?disabled=${v.busy || v.alignable < 3} title=${v.alignable < 3 ? tr('פיזור צריך לפחות שלושה עצמים') : tr('רווחים שווים בין העצמים לגובה; הקיצוניים נשארים במקומם')} @click=${() => a.distribute('y')}>${tr('פיזור שווה לגובה')}</sw-button>
  </div></sw-field>`;
}

/** The grid options of the layers tool (T085): the switch and the spacing. The spacing is in metres on the plan's scale -
 * before calibration on the estimated one, marked "≈" as every estimated distance of the editor, or, when the setting
 * `plan.estimates` hides estimated metres, named by size only. */
interface GridOptionsView {
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
  const hint = v.estimated ? tr('לפי קנה מידה משוער עד שהתוכנית תכויל') : tr('לפי קנה המידה המכויל של התוכנית');
  return html`<div class="gridopts" data-grid-options>
    <label><sw-toggle size="sm" labelHidden in-label label=${tr('רשת עזר')} data-grid-toggle .checked=${v.on} @change=${(e: Event) => onToggle(toggled(e))}></sw-toggle> ${tr('רשת עזר')}</label>
    <div class="note">${tr('גרירה והצבה של עצם נצמדות לצמתי הרשת; Ctrl בזמן הגרירה - בלי הצמדה.')}</div>
    <sw-field label=${tr('מרווח הרשת')} hint=${hint}>
      <select data-grid-step ?disabled=${!v.on} @change=${(e: Event) => onStep(Number((e.target as HTMLSelectElement).value))}>
        ${v.steps.map((m, i) => html`<option value=${String(m)} ?selected=${m === v.stepM}>${label(m, i)}</option>`)}
      </select>
    </sw-field>
    <div class="note">${tr('בזמן גרירה של עצם מופיעים קווי יישור כשקצה או מרכז שלו מתיישר עם עצם אחר, והעצם נצמד אליהם.')}</div>
  </div>`;
}

/** The select tool with two or more walls, objects and zones selected: what is selected and the actions on all of them. */
export function renderMultiSelection(v: MultiView, a: MultiActions): TemplateResult {
  const total = v.walls + v.objects + v.zones;
  const parts = [v.walls ? countLabel(v.walls, tr('קיר אחד'), tr('קירות')) : '', v.objects ? countLabel(v.objects, tr('עצם אחד'), tr('עצמים')) : '', v.zones ? countLabel(v.zones, tr('אזור אחד'), tr('אזורים')) : ''].filter(Boolean).join(' · ');
  return html`<sw-card heading=${tr('{total} פריטים נבחרו', { total })} subheading=${`${parts} · ${SAVE_LABEL[v.saveState]}`} data-multi-panel data-multi-count=${total} data-studio-save=${v.saveState}>
    <div class="note">${tr('גרירת אחד מהם מזיזה את כולם יחד · Delete מוחק את כולם · Ctrl+D משכפל את העצמים שבבחירה')}</div>
    ${v.zones ? html`<div class="note" data-multi-zones-note>${tr('הזזה, מחיקה, תגיות ומפלס של אזורים נשמרים מיד ואינם חלק מהביטול (Ctrl+Z); קירות ועצמים חוזרים בצעד ביטול אחד')}</div>` : nothing}
    ${v.note ? html`<div class="note multinote" data-multi-note role="status">${v.note}</div>` : nothing}
    ${renderAlignActions(v, a)}
    ${renderTagsField({ chips: v.tags, bulk: true, disabled: v.busy }, (t) => a.addTag(t), (t) => a.removeTag(t))}
    ${v.levels.length > 1
      ? html`<sw-field label=${tr('העבר את כל הבחירה למפלס')} hint=${tr('קירות ועצמים בצעד ביטול אחד; הפתחים עוברים עם הקיר שלהם')}>
          <select data-multi-level ?disabled=${v.busy} @change=${(e: Event) => { const s = e.target as HTMLSelectElement; const lv = s.value; s.value = ''; if (lv) a.setLevel(lv); }}>
            <option value="" selected>${tr('בחר מפלס…')}</option>${v.levels.map((l) => html`<option value=${l.id}>${tr('{name} ({elevation_m} מ׳)', { name: l.name, elevation_m: l.elevation_m })}</option>`)}
          </select></sw-field>`
      : nothing}
    ${v.lights
      ? html`<sw-field label=${tr('הוסף למעגל תאורה')} hint=${v.lights === total ? tr('כל הנבחרים הם גופי תאורה') : tr('רק {countLabel}; קירות, אזורים ועצמים אחרים לא', { countLabel: countLabel(v.lights, tr('גוף התאורה שבבחירה מצטרף'), tr('גופי התאורה שבבחירה מצטרפים')) })}>
          ${v.circuits.length
            ? html`<div class="tagchips" data-multi-circuits>${v.circuits.map((k) => html`<sw-chip dot=${circuitVar(k.color_token)} data-multi-circuit=${k.id} title=${tr('הוסף את גופי התאורה שבבחירה למעגל {name}', { name: k.name })} @click=${() => { if (!v.busy) a.joinCircuit(k.id); }}>${k.name}</sw-chip>`)}</div>`
            : html`<div class="note" data-multi-no-circuits>${tr('אין עדיין מעגלים בקומה; צור מעגל בכלי "מעגלי תאורה".')}</div>`}
        </sw-field>`
      : nothing}
    <div class="btns">
      ${v.objects ? html`<sw-button size="sm" icon="layers" data-multi-duplicate ?disabled=${v.busy} title=${tr('עותק של כל העצמים שנבחרו, כגוש אחד ליד הבחירה (גם Ctrl+D)')} @click=${() => a.duplicate()}>${v.objects === 1 ? tr('שכפל את העצם') : tr('שכפל {objects} עצמים', { objects: v.objects })}</sw-button>` : nothing}
      <sw-button size="sm" variant="danger" icon="trash" data-multi-delete ?disabled=${v.busy} @click=${() => a.remove()}>${tr('מחק הכל')}</sw-button>
      <sw-button size="sm" variant="ghost" data-multi-clear @click=${() => a.clear()}>${tr('נקה בחירה')}</sw-button>
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
  return html`<sw-dialog open heading=${tr('מערך')} subheading=${tr('שורות × עמודות של {v}; העצם שנבחר הוא הראשון', { v: v.item?.names.he ?? tr('העצם') })} data-array-dialog @close=${onCancel}>
    ${v.error ? html`<div class="err" data-array-error>${v.error}</div>` : nothing}
    <div class="two">
      <sw-field label=${tr('שורות')}><input type="number" min="1" max="60" step="1" data-ltr data-array-rows .value=${String(v.rows)} @input=${(e: Event) => onChange({ rows: Math.max(1, num(e) || 1) })} /></sw-field>
      <sw-field label=${tr('עמודות')}><input type="number" min="1" max="60" step="1" data-ltr data-array-cols .value=${String(v.cols)} @input=${(e: Event) => onChange({ cols: Math.max(1, num(e) || 1) })} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${tr('רווח בין עמודות (מ׳)')}><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sx .value=${String(v.spacingX)} @input=${(e: Event) => onChange({ spacingX: num(e) })} /></sw-field>
      <sw-field label=${tr('רווח בין שורות (מ׳)')}><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sy .value=${String(v.spacingY)} @input=${(e: Event) => onChange({ spacingY: num(e) })} /></sw-field>
    </div>
    <sw-field label=${tr('כיוון (°)')} hint=${tr('0 = העמודות ימינה והשורות למטה; 90 = מסובב')}><input type="number" min="0" max="359" step="1" data-ltr data-array-dir .value=${String(v.directionDeg)} @input=${(e: Event) => onChange({ directionDeg: num(e) || 0 })} /></sw-field>
    <div class="note" data-array-total>${tr('{total} עצמים{v}', { total, v: total > v.max ? tr(' · יותר מ־{max} במערך אחד', { max: v.max }) : '' })}</div>
    <sw-button slot="footer" variant="ghost" data-array-cancel @click=${onCancel}>${tr('ביטול')}</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-array-create ?disabled=${!ok} @click=${onCreate}>${tr('צור מערך')}</sw-button>
  </sw-dialog>`;
}

export function renderGroupDeleteDialog(count: number, onAll: () => void, onKeep: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading=${tr('מחיקת מערך')} subheading=${tr('המערך מכיל {count} עצמים', { count })} data-group-delete-dialog @close=${onCancel}>
    <div class="note">${tr('למחוק גם את העצמים, או להשאיר אותם על המפה כעצמים בודדים?')}</div>
    <sw-button slot="footer" variant="ghost" data-group-delete-cancel @click=${onCancel}>${tr('ביטול')}</sw-button>
    <sw-button slot="footer" data-group-delete-keep @click=${onKeep}>${tr('השאר את העצמים')}</sw-button>
    <sw-button slot="footer" variant="danger" icon="trash" data-group-delete-all @click=${onAll}>${tr('מחק הכול')}</sw-button>
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
  return html`<sw-dialog open heading=${tr('פריט מותאם')} subheading=${v.basedOn ? tr('מבוסס על {v}: הפריט החדש נשמר בספרייה של המתקן', { v: lib.items.find((i) => i.id === v.basedOn)?.names.he ?? v.basedOn }) : tr('פריט חדש בספרייה של המתקן')} data-custom-dialog @close=${onCancel}>
    ${v.error ? html`<div class="err">${v.error}</div>` : nothing}
    <div class="two">
      <sw-field label=${tr('שם (עברית)')}><input type="text" maxlength="80" data-custom-name .value=${v.nameHe} @input=${(e: Event) => onChange({ nameHe: (e.target as HTMLInputElement).value })} /></sw-field>
      <sw-field label=${tr('שם (אנגלית, לחיפוש)')}><input type="text" maxlength="80" data-ltr data-custom-name-en .value=${v.nameEn} @input=${(e: Event) => onChange({ nameEn: (e.target as HTMLInputElement).value })} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${tr('קטגוריה')}><select data-custom-category @change=${(e: Event) => onChange({ category: (e.target as HTMLSelectElement).value })}>${lib.categories.map((c) => html`<option value=${c.id} ?selected=${c.id === v.category}>${c.he}</option>`)}</select></sw-field>
      <sw-field label=${tr('צורה')}><select data-custom-shape @change=${(e: Event) => onChange({ shape: (e.target as HTMLSelectElement).value as ObjectShape })}>${OBJECT_SHAPES.map((s) => html`<option value=${s} ?selected=${s === v.shape}>${s}</option>`)}</select></sw-field>
    </div>
    <div class="two">
      <sw-field label=${tr('סמל')}><select data-custom-icon @change=${(e: Event) => onChange({ icon: (e.target as HTMLSelectElement).value })}>${SYMBOL_IDS.map((s) => html`<option value=${s} ?selected=${s === v.icon}>${s}</option>`)}</select></sw-field>
      <sw-field label=${tr('צבע')}><select data-custom-color @change=${(e: Event) => onChange({ color: (e.target as HTMLSelectElement).value })}>${COLOR_TOKENS.map((c) => html`<option value=${c} ?selected=${c === v.color}>${c}</option>`)}</select></sw-field>
    </div>
    <div class="three">${sizeField('w_m', tr('רוחב (מ׳)'))}${sizeField('d_m', tr('עומק (מ׳)'))}${sizeField('h_m', tr('גובה (מ׳)'))}</div>
    ${badSize ? html`<div class="err" data-custom-size-error>${tr('כל מידה בין 0.05 ל־100 מ׳')}</div>` : nothing}
    <div class="note">${tr('הגובה מהרצפה, הפרמטרים וסוגי הישויות נלקחים מהפריט שעליו הוא מבוסס.')}</div>
    <sw-button slot="footer" variant="ghost" data-custom-cancel @click=${onCancel}>${tr('ביטול')}</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-custom-create ?disabled=${v.busy || !v.nameHe.trim() || badSize} @click=${onCreate}>${v.busy ? tr('שומר…') : tr('צור פריט')}</sw-button>
  </sw-dialog>`;
}

// ---------------------------------------------------------------- levels (T085)

/** The chips over the canvas: all levels, or one. `onAdd` (editors) adds the "+ מפלס" chip; `onEdit` (editors) puts
 * a small pencil beside each level's chip that opens the level's own dialog (rename, heights, default, delete). The
 * pencil is a sibling of the chip, not inside it: sw-chip is itself a button. */
export function renderLevelChips(levels: GeomLevel[], current: string | null, onPick: (id: string | null) => void, onAdd?: () => void, onEdit?: (id: string) => void): TemplateResult {
  if (levels.length < 2 && !onAdd) return html``;
  const chip = (l: GeomLevel) => html`<sw-chip data-level-chip=${l.id} ?selected=${current === l.id} @click=${() => onPick(l.id)}>${tr('{name} · {v}{v2} מ׳', { name: l.name, v: l.elevation_m >= 0 ? '+' : '−', v2: Math.abs(l.elevation_m).toFixed(1) })}</sw-chip>`;
  return html`<div class="levelchips" role="group" aria-label=${tr('מפלסים')} data-level-chips>
    <sw-chip data-level-chip="all" ?selected=${current === null} @click=${() => onPick(null)}>${tr('כל המפלסים')}</sw-chip>
    ${[...levels].sort((a, b) => b.elevation_m - a.elevation_m).map((l) => onEdit
      ? html`<span class="levelchip">${chip(l)}<sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${tr('עריכת המפלס {name}', { name: l.name })} data-level-edit=${l.id} @click=${() => onEdit(l.id)}></sw-button></span>`
      : chip(l))}
    ${onAdd ? html`<sw-chip data-level-add icon="plus" @click=${onAdd}>${tr('מפלס')}</sw-chip>` : nothing}
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

interface LevelDialogActions {
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
  return html`<sw-dialog open heading=${editing ? tr('עריכת מפלס') : tr('מפלס חדש')} subheading=${tr('גובה הרצפה יחסית למפלס הראשי (0), וגובה התקרה מעליה')} data-level-dialog data-level-editing=${v.id ?? nothing} @close=${a.cancel}>
    ${v.error ? html`<div class="err" data-level-error>${v.error}</div>` : nothing}
    <sw-field label=${tr('שם')}><input type="text" maxlength="60" data-level-name placeholder=${tr('למשל: אולם תחתון')} .value=${v.name} @input=${(e: Event) => a.change({ name: (e.target as HTMLInputElement).value })} /></sw-field>
    <div class="two">
      <sw-field label=${tr('גובה רצפה (מ׳)')} hint=${tr('שלילי = מתחת למפלס הראשי')}><input type="number" min="-50" max="500" step="0.1" data-ltr data-level-elevation .value=${String(v.elevation)} @input=${(e: Event) => a.change({ elevation: num(e) })} /></sw-field>
      <sw-field label=${tr('גובה תקרה (מ׳)')}><input type="number" min="0.1" max="50" step="0.1" data-ltr data-level-ceiling .value=${String(v.ceiling)} @input=${(e: Event) => a.change({ ceiling: num(e) })} /></sw-field>
    </div>
    ${editing && v.isDefault ? html`<div class="note" data-level-is-default>${tr('זה המפלס הראשי: פריטים חדשים מוצבים בו כשאין סינון מפלס.')}</div>` : nothing}
    ${editing && !v.isDefault ? html`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('הפוך למפלס הראשי')} data-level-make-default .checked=${v.makeDefault} @change=${(e: Event) => a.change({ makeDefault: toggled(e) })}></sw-toggle> ${tr('הפוך למפלס הראשי')}</label>` : nothing}
    ${editing ? html`<sw-button slot="footer" variant="danger" icon="trash" data-level-delete @click=${a.remove}>${tr('מחק מפלס')}</sw-button>` : nothing}
    <sw-button slot="footer" variant="ghost" data-level-cancel @click=${a.cancel}>${tr('ביטול')}</sw-button>
    ${editing
      ? html`<sw-button slot="footer" variant="primary" icon="check" data-level-save ?disabled=${!ok} @click=${a.submit}>${tr('שמור')}</sw-button>`
      : html`<sw-button slot="footer" variant="primary" icon="check" data-level-create ?disabled=${!ok} @click=${a.submit}>${tr('הוסף מפלס')}</sw-button>`}
  </sw-dialog>`;
}

// ---------------------------------------------------------------- connectors (T085)

export const CONNECTOR_LABEL: Record<ConnectorKind, string> = { stairs: tr('מדרגות'), ramp: tr('רמפה'), tribune: tr('טריבונה'), elevator: tr('מעלית'), ladder: tr('סולם') };

interface ConnectorView {
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

interface ConnectorActions {
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
  return id ? levels.find((l) => l.id === id)?.name ?? id : tr('לא נבחר');
}

/** Where a connector leads, in words: "קומה 1 · גלריה" for another floor, the level's name here, or "לא נבחר". */
export function connectorTargetName(levels: GeomLevel[], c: Pick<GeomConnector, 'floor_ids' | 'far' | 'level_to'>): string {
  if (c.floor_ids.length) {
    const far = c.far;
    if (far?.missing) return tr('קומה שנמחקה');
    if (!far?.floor_name) return tr('קומה אחרת');
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
  straight: [tr('לחץ על תחילת המדרגות'), tr('לחץ על סוף המדרגות')],
  l: [tr('לחץ על תחילת המהלך הראשון'), tr('לחץ על סוף המהלך הראשון (הכיוון והאורך)')],
  u: [tr('לחץ על תחילת המהלך הראשון'), tr('לחץ על סוף המהלך הראשון (הכיוון והאורך)')],
};

export function renderConnectorPanel(v: ConnectorView, a: ConnectorActions): TemplateResult {
  const levels = v.doc.levels;
  const levelName = (id: string | null) => connectorLevelName(levels, id);
  const sel = v.sel;
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  const hint = v.mode === 'stairs' ? STAIR_DRAW_HINT[v.stairShape][v.start ? 1 : 0] : v.mode ? (v.start ? tr('לחץ על הנקודה השנייה של {v}', { v: CONNECTOR_LABEL[v.mode] }) : tr('לחץ על הנקודה הראשונה של {v}', { v: CONNECTOR_LABEL[v.mode] })) : '';
  return html`<sw-card heading=${tr('מפלסים ומחברים')} subheading=${v.mode ? `${hint}${v.start ? tr(' · Esc לביטול') : ''}` : tr('מדרגות, רמפה, מעלית וסולם בין מפלסים ובין קומות')} data-connector-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label=${tr('סוג מחבר')}>
      ${(['stairs', 'ramp', 'elevator', 'ladder'] as ConnectorKind[]).map((k) => html`<button class=${v.mode === k ? 'on' : ''} data-conn-mode=${k} aria-pressed=${v.mode === k} @click=${() => a.setMode(v.mode === k ? null : k)}>${CONNECTOR_LABEL[k]}</button>`)}
    </div>
    ${v.mode === 'stairs'
      ? html`<div class="modes" role="group" aria-label=${tr('צורת המדרגות')} data-stair-draw-shapes>
          ${STAIR_SHAPES.map((s) => html`<button class=${v.stairShape === s ? 'on' : ''} data-stair-draw-shape=${s} aria-pressed=${v.stairShape === s} @click=${() => a.setStairShape(s)}>${STAIR_SHAPE_TEXT[s]}</button>`)}
        </div>`
      : nothing}
    <sw-field label=${tr('גובה קומה (רצפה עד רצפה, מ׳)')} hint=${tr('כמה עולות מדרגות לקומה שמעל; ברירת מחדל 3')}><input type="number" min=${FLOOR_HEIGHT_RANGE[0]} max=${FLOOR_HEIGHT_RANGE[1]} step="0.05" data-ltr data-floor-height .value=${String(floorHeight(v.doc))}
      @change=${(e: Event) => { const x = num(e); if (x >= FLOOR_HEIGHT_RANGE[0] && x <= FLOOR_HEIGHT_RANGE[1]) a.setFloorHeight(Math.round(x * 100) / 100); }} /></sw-field>
    <div class="note">${tr('שתי לחיצות על התוכנית מציירות מחבר (הצמדה לפינות קירות); במדרגות L ו־U הלחיצה השנייה קובעת את הכיוון ואת אורך המהלך הראשון, והפודסט והמהלך השני נוצרים לבד. מדרגות ומעלית מהספרייה מונחות כאן כמחבר. טריבונה היא עצם מהספרייה: המחבר שלה נוצר לבד כשמגדירים לאיזה מפלס היא יורדת.')}</div>
    ${v.doc.connectors.length
      ? html`<div class="list">${v.doc.connectors.map((c) => html`<button class=${sel?.id === c.id ? 'on' : ''} data-conn-row=${c.id} @click=${() => a.select(c.id)}>
          <span>${CONNECTOR_LABEL[c.kind] ?? c.kind}${connectorDerived(c) ? tr(' (מעצם)') : ''}</span><span class="note" style="margin:0">${levelName(c.level_from)} ← ${connectorTargetName(levels, c)}</span>
        </button>`)}</div>`
      : html`<div class="note">${tr('עדיין אין מחברים בקומה.')}</div>`}
    ${sel ? renderConnectorInspector(sel, v, a, levelName, num) : nothing}
  </sw-card>`;
}

/** The select tool (0.1.87): the selected connector's inspector in a card of its own, without the connector modes. */
export function renderConnectorSelection(v: ConnectorView & { sel: GeomConnector }, a: ConnectorActions): TemplateResult {
  const levelName = (id: string | null) => connectorLevelName(v.doc.levels, id);
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  return html`<sw-card heading=${tr('מחבר')} subheading=${SAVE_LABEL[v.saveState]} data-connector-panel data-studio-save=${v.saveState}>${renderConnectorInspector(v.sel, v, a, levelName, num)}</sw-card>`;
}

const STAIR_SHAPES: StairShape[] = ['straight', 'l', 'u'];
const STAIR_SHAPE_TEXT: Record<StairShape, string> = { straight: tr('ישר'), l: tr('L (פנייה 90°)'), u: tr('U (חצי סיבוב)') };

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
    <div class="modes" role="group" aria-label=${tr('צורת המדרגות')}>
      ${STAIR_SHAPES.map((s) => html`<button class=${model && shape === s ? 'on' : ''} data-stair-shape=${s} aria-pressed=${model && shape === s} @click=${() => a.patchStair(c.id, { shape: s })}>${STAIR_SHAPE_TEXT[s]}</button>`)}
    </div>
    ${model
      ? html`<div class="two">
          ${flights.map((f, i) => html`<sw-field label=${two ? tr('מדרגות במהלך {v}', { v: i + 1 }) : tr('מדרגות')}><input type="number" min="1" max=${MAX_STAIR_STEPS} step="1" data-ltr data-stair-steps=${i} .value=${String(f.steps)} @change=${steps(i)} /></sw-field>`)}
        </div>
        <div class="two">
          ${shape !== 'straight'
            ? html`<sw-field label=${tr('פנייה')}><select data-stair-turn @change=${(e: Event) => a.patchStair(c.id, { turn: (e.target as HTMLSelectElement).value as 'left' | 'right' })}>
                <option value="right" ?selected=${c.turn !== 'left'}>${tr('ימינה')}</option><option value="left" ?selected=${c.turn === 'left'}>${tr('שמאלה')}</option></select></sw-field>`
            : html`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${tr('פודסט באמצע')} data-stair-mid .checked=${two} @change=${(e: Event) => {
                const on = toggled(e);
                const total = flights.reduce((n, f) => n + f.steps, 0);
                a.patchStair(c.id, { flights: on ? [{ steps: Math.max(1, Math.ceil(total / 2)) }, { steps: Math.max(1, Math.floor(total / 2)) }] : [{ steps: Math.min(MAX_STAIR_STEPS, total) }] });
              }}></sw-toggle> ${tr('פודסט באמצע')}</label>`}
          ${two || shape !== 'straight'
            ? html`<sw-field label=${tr('עומק הפודסט (מ׳)')}><input type="number" min=${LANDING_RANGE[0]} max=${LANDING_RANGE[1]} step="0.1" data-ltr data-stair-landing .value=${String(c.landing_depth_m ?? c.width_m)}
                @change=${(e: Event) => { const x = num(e); if (x >= LANDING_RANGE[0] && x <= LANDING_RANGE[1]) a.patchStair(c.id, { landing_depth_m: x }); }} /></sw-field>`
            : nothing}
        </div>
        <div class="note" data-stair-caption-note>${tr('{v} · גרירת פינה משנה את המסלול; שינוי כאן מסדר אותו מחדש מנקודת ההתחלה.', { v: stairCaption({ flights, shape }) || '—' })}</div>`
      : html`<div class="note">${tr('בחר צורה כדי לצייר מהלכים, מדרגות ופודסט.')}</div>`}
    <div class="btns"><sw-button size="sm" variant="ghost" data-conn-rotate @click=${() => a.rotate(c.id)}>${tr('סובב 90°')}</sw-button></div>
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
    ${derived ? html`<div class="note" data-conn-derived>${tr('נגזר מעצם ({v}): המיקום, הרוחב והמפלסים מגיעים מהעצם; ערוך אותו בספריית העצמים.', { v: c.object_id ?? '' })}</div>` : nothing}
    <div class="two">
      <sw-field label=${tr('סוג')}><select data-conn-kind ?disabled=${derived} @change=${(e: Event) => a.patch(c.id, { kind: (e.target as HTMLSelectElement).value as ConnectorKind })}>${(['stairs', 'ramp', 'elevator', 'ladder', 'tribune'] as ConnectorKind[]).map((k) => html`<option value=${k} ?selected=${k === c.kind}>${CONNECTOR_LABEL[k]}</option>`)}</select></sw-field>
      <sw-field label=${tr('רוחב (מ׳)')}><input type="number" min=${minWidth} max=${maxWidth} step="0.1" data-ltr data-conn-width ?disabled=${derived} .value=${String(c.width_m)}
        @change=${(e: Event) => { const x = num(e); if (!(x >= minWidth && x <= maxWidth)) return; if (stairs && hasStairModel(c)) a.patchStair(c.id, { width_m: x }); else a.patch(c.id, { width_m: x }); }} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${tr('ממפלס')}><select data-conn-from ?disabled=${derived} @change=${(e: Event) => a.patch(c.id, { level_from: (e.target as HTMLSelectElement).value })}>${v.doc.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === c.level_from}>${l.name}</option>`)}</select></sw-field>
      <sw-field label=${tr('מחבר אל')}><select data-conn-target aria-label=${tr('מחבר אל: מפלס בקומה הזו או מפלס בקומה אחרת')} ?disabled=${derived || v.linkBusy} @change=${(e: Event) => { const val = (e.target as HTMLSelectElement).value; if (val) a.setTarget(c.id, val); }}>
        <option value="" ?selected=${!current}>${cross ? tr('{target} · בחר מפלס', { target }) : tr('בחר מפלס או קומה')}</option>
        ${groups.here.length ? html`<optgroup label=${tr('בקומה הזו')}>${groups.here.map((o) => html`<option value=${o.value} ?selected=${o.value === current}>${o.label}</option>`)}</optgroup>` : nothing}
        ${derived ? nothing : groups.floors.map((f) => html`<optgroup label=${f.name}>${f.options.map((o) => html`<option value=${o.value} ?selected=${o.value === current}>${o.label}</option>`)}</optgroup>`)}
      </select></sw-field>
    </div>
    ${v.linkBusy ? html`<div class="note" data-conn-linking>${tr('מקשר לקומה השנייה…')}</div>` : nothing}
    ${twinCopy ? html`<div class="note" data-conn-twin-origin>${tr('אלה מדרגות שקושרו מקומה אחרת: כדי לקשר אותן לקומה שלישית, קשר מחדש מהקומה המקורית.')}</div>` : nothing}
    ${cross && !derived
      ? html`<div class="note" data-conn-twin-note>${tr('מקושר אל {target}: אותו מחבר מופיע בטיוטה של שתי הקומות. הזזה כאן לא מזיזה את המדרגות בקומה השנייה, ולהפך.', { target })}</div>`
      : nothing}
    ${c.needs_placement ? html`<div class="note warn" data-conn-placement>${tr('מקם את המדרגות בקומה הזו: הן נוצרו במרכז התוכנית כי לשתי הקומות אין מסגרת משותפת. גרור אותן למקומן.')}</div>` : nothing}
    ${!c.needs_placement && c.check_placement ? html`<div class="note warn" data-conn-check-placement>${tr('ודא את המיקום: צורת המדרגות עודכנה מהקומה השנייה והמסלול נבנה מחדש מנקודת ההתחלה שלהן כאן.')}</div>` : nothing}
    ${c.needs_placement || c.check_placement ? html`<div class="btns"><sw-button size="sm" data-conn-confirm-place @click=${() => a.confirmPlacement(c.id)}>${tr('אישור מיקום')}</sw-button></div>` : nothing}
    ${stairs ? renderStairModel(c, a, num) : nothing}
    <sw-field label=${tr('תווית (אופציונלי; ריק = הפרש הגובה או הקומה)')}><input type="text" maxlength="80" data-conn-label ?disabled=${derived} .value=${c.label ?? ''} @change=${(e: Event) => a.patch(c.id, { label: (e.target as HTMLInputElement).value.trim() || null })} /></sw-field>
    <div class="note" data-conn-route>${levelName(c.level_from)} ← ${target}${derived ? '' : tr(' · גרירת פינה מזיזה פינה, גרירת המחבר הנבחר מזיזה את כולו')}</div>
    ${!derived ? html`<div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(c.id)}>${tr('מחק מחבר')}</sw-button></div>` : nothing}
  </div>`;
}

/** "למחוק גם בקומה השנייה?" (T085): deleting a connector linked to another floor asks whether its twin goes too; the
 * default (the primary button) deletes both. */
export function renderTwinDeleteDialog(target: string, canBoth: boolean, onBoth: () => void, onHere: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading=${tr('מחיקת מחבר בין קומות')} subheading=${tr('המחבר מקושר אל {target}', { target })} data-twin-delete-dialog @close=${onCancel}>
    ${canBoth
      ? html`<div class="note">${tr('למחוק גם בקומה השנייה?')}</div><div class="note warn" data-twin-delete-immediate>${tr('המחיקה בקומה השנייה מיידית: Ctrl+Z מחזיר את המדרגות רק כאן.')}</div>`
      : html`<div class="note" data-twin-delete-noperm>${tr('אין לך הרשאת עריכה בקומה השנייה: המדרגות יימחקו רק כאן, והתאום שם יסומן כמקושר לשום מקום.')}</div>`}
    <sw-button slot="footer" variant="ghost" data-twin-delete-cancel @click=${onCancel}>${tr('ביטול')}</sw-button>
    <sw-button slot="footer" variant=${canBoth ? 'secondary' : 'danger'} data-twin-delete-here @click=${onHere}>${tr('רק בקומה הזו')}</sw-button>
    ${canBoth ? html`<sw-button slot="footer" variant="danger" icon="trash" data-twin-delete-both autofocus @click=${onBoth}>${tr('מחק בשתי הקומות')}</sw-button>` : nothing}
  </sw-dialog>`;
}

/** Changing where linked stairs lead removes the twin on the other floor at once (review B1, L2): asked first. */
export function renderLinkConfirmDialog(kind: 'unlink' | 'relink', target: string, onOk: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading=${kind === 'relink' ? tr('קישור לקומה אחרת') : tr('ביטול הקישור בין הקומות')} subheading=${tr('המדרגות מקושרות עכשיו אל {target}', { target })} data-link-confirm-dialog=${kind} @close=${onCancel}>
    <div class="note">${kind === 'relink' ? tr('הקישור לקומה חדשה ימחק את המדרגות מהקומה הנוכחית שלהן שם.') : tr('המדרגות יובילו למפלס בקומה הזו, והתאום בקומה השנייה יימחק.')}</div>
    <div class="note warn">${tr('המחיקה בקומה השנייה מיידית ואינה מתבטלת ב־Ctrl+Z.')}</div>
    <sw-button slot="footer" variant="ghost" data-link-confirm-cancel @click=${onCancel}>${tr('ביטול')}</sw-button>
    <sw-button slot="footer" variant="danger" data-link-confirm-ok @click=${onOk}>${kind === 'relink' ? tr('קשר ומחק שם') : tr('בטל קישור ומחק שם')}</sw-button>
  </sw-dialog>`;
}

function connectorLabelOf(doc: GeometryDoc, c: GeomConnector): string {
  return connectorLabel(new Map(doc.levels.map((l) => [l.id, l])), c);
}

// ---------------------------------------------------------------- circuits (T085)

interface CircuitView {
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

interface CircuitActions {
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
const CIRCUIT_MEMBERS_HINT = tr('לחץ על מנורה קיימת כדי להוסיף או להסיר אותה מהמעגל, או בחר סוג מנורה למטה ולחץ על התוכנית כדי להציב מנורה חדשה שכבר מחוברת למעגל');

/** The hint while a lamp type is armed: the next click on the plan places it, already on the circuit. */
export const circuitPlacingHint = (item: CatalogItem): string => tr('לחץ על התוכנית כדי להציב {he} ישירות במעגל · Esc לביטול', { he: item.names.he });

/** The circuit colour as a CSS variable: a document string reaches the inline style only through the whitelist. */
const circuitVar = (token: string): string => `var(--sw-${circuitToken(token) ?? 'circuit-1'})`;

export function renderCircuitPanel(v: CircuitView, a: CircuitActions): TemplateResult {
  const c = v.creating;
  const sel = v.sel;
  return html`<sw-card heading=${tr('מעגלי תאורה')} subheading=${v.membersMode ? (v.placing ? circuitPlacingHint(v.placing) : CIRCUIT_MEMBERS_HINT) : tr('כמה מנורות על ישות מפסק אחת')} data-circuit-panel data-studio-save=${v.saveState}>
    ${v.doc.circuits.length
      ? html`<div class="list">${v.doc.circuits.map((k) => html`<button class=${sel?.id === k.id ? 'on' : ''} data-circuit-row=${k.id} style=${`--kc: ${circuitVar(k.color_token)}`} @click=${() => a.select(sel?.id === k.id ? null : k.id)}>
          <span>${k.name}</span><span class="note ltr" style="margin:0">${k.member_ids.length} · ${v.power(k)} W · ${k.switch_entity_id}</span>
        </button>`)}</div>`
      : html`<div class="note">${tr('עדיין אין מעגלים בקומה.')}</div>`}
    ${c
      ? html`<div class="sel" data-circuit-new-form>
          <sw-field label=${tr('שם המעגל')}><input type="text" maxlength="80" data-circuit-name placeholder=${tr('למשל: אולם צפון')} .value=${c.name} @input=${(e: Event) => a.setNew({ name: (e.target as HTMLInputElement).value })} /></sw-field>
          <sw-field label=${tr('ישות המפסק (switch / light)')}><input type="search" data-ltr data-circuit-switch-q placeholder=${tr('חיפוש בקטלוג')} .value=${c.q} @input=${(e: Event) => a.setNew({ q: (e.target as HTMLInputElement).value })} /></sw-field>
          <div class="list">${c.results.slice(0, 20).map((e) => html`<button class=${c.entity?.entity_id === e.entity_id ? 'on' : ''} data-circuit-switch=${e.entity_id} @click=${() => a.setNew({ entity: e })}><span>${e.name || e.original_name || e.entity_id}</span><span class="ltr">${e.entity_id}</span></button>`)}</div>
          <sw-field label=${tr('צבע')}><select data-circuit-color @change=${(e: Event) => a.setNew({ color: (e.target as HTMLSelectElement).value })}>${v.colors.map((col, i) => html`<option value=${col} ?selected=${col === c.color}>${tr('מעגל {v}', { v: i + 1 })}</option>`)}</select></sw-field>
          <div class="btns"><sw-button variant="primary" size="sm" icon="check" data-circuit-create ?disabled=${c.busy || !c.name.trim() || !c.entity} @click=${() => a.create()}>${tr('צור מעגל')}</sw-button><sw-button variant="ghost" size="sm" data-circuit-cancel @click=${() => a.cancelNew()}>${tr('ביטול')}</sw-button></div>
        </div>`
      : html`<div class="btns"><sw-button size="sm" icon="plus" data-circuit-new @click=${() => a.startNew()}>${tr('מעגל חדש')}</sw-button></div>`}
    ${sel && !c ? renderCircuitInspector(sel, v, a) : nothing}
  </sw-card>`;
}

function renderCircuitInspector(k: GeomCircuit, v: CircuitView, a: CircuitActions) {
  return html`<div class="sel" data-selected-circuit=${k.id} style=${`--kc: ${circuitVar(k.color_token)}`}>
    <div class="selhead"><strong>${k.name}</strong><span class="muted ltr">${k.switch_entity_id}</span></div>
    <div class="note"><span data-circuit-count>${countLabel(k.member_ids.length, tr('מנורה אחת'), tr('מנורות'))}</span> · <span data-circuit-power>${v.power(k)} W</span></div>
    <div class="two">
      <sw-field label=${tr('שם')}><input type="text" maxlength="80" data-circuit-rename .value=${k.name} @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patch(k.id, { name: x }); }} /></sw-field>
      <sw-field label=${tr('צבע')}><select @change=${(e: Event) => a.patch(k.id, { color_token: (e.target as HTMLSelectElement).value })}>${v.colors.map((col, i) => html`<option value=${col} ?selected=${col === k.color_token}>${tr('מעגל {v}', { v: i + 1 })}</option>`)}</select></sw-field>
    </div>
    <div class="btns">
      <sw-button size="sm" variant=${v.membersMode ? 'primary' : 'ghost'} icon="light" data-circuit-members aria-pressed=${v.membersMode} @click=${() => a.toggleMembers()}>${v.membersMode ? tr('סיים בחירת מנורות') : tr('הוסף / הסר מנורות')}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-circuit-delete @click=${() => a.remove(k.id)}>${tr('מחק מעגל')}</sw-button>
    </div>
    ${v.membersMode && v.lamps.length ? html`<div class="note">${tr('מנורה חדשה: בחר סוג ולחץ על התוכנית (לחיצה נוספת על הסוג מבטלת)')}</div>
      <div class="modes lamps" role="group" aria-label=${tr('סוג מנורה להצבה במעגל')} data-circuit-lamps>${v.lamps.map((i) => {
        const on = v.placing?.id === i.id;
        return html`<button class=${on ? 'on' : ''} data-circuit-lamp=${i.id} aria-pressed=${on} title=${tr('{he} · {w_m}×{d_m} מ׳', { he: i.names.he, w_m: i.size.w_m, d_m: i.size.d_m })} @click=${() => a.armLamp(on ? null : i)}><svg viewBox="0 0 24 24" aria-hidden="true">${symbolOf(i.icon)}</svg><span>${i.names.he}</span></button>`;
      })}</div>` : nothing}
    <div class="note">${tr('המצב החי של המנורות נגזר מהמפסק; ההפעלה מהמפה החיה היא פעולת ההתקן הקיימת, באותן הרשאות.')}</div>
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
    color: var(--sw-text-inverse);
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
  /* A window wall's glazing: its own block under the wall fields; the panels that open are toggled as numbered chips. */
  .glazing {
    display: grid;
    gap: 8px;
    border-block-start: 1px dashed var(--sw-border);
    padding-block-start: 8px;
  }
  .panelchips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .panelchips button {
    min-width: 28px;
    min-height: 28px;
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: var(--sw-r-sm);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  .panelchips button.on {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .panelchips button:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .panelchips button:focus-visible,
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
    border-radius: var(--sw-r-sm);
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
  .ifc-skipped {
    margin: 0;
    padding-inline-start: 18px;
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
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
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
  /* POLISH4 WP6 (D28): the favourite star drew in the bare warning hue (2.0-2.15:1 on the light card and on its warning wash); it takes the
     warning ink, which is the same hue in dark in every skin and >= 4.5:1 in light */
  .libitem .fav.on {
    color: var(--sw-warning-text);
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
    border-radius: var(--sw-r-sm);
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
    border-radius: var(--sw-r-sm);
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
    /* R5-MAPS-297: the warning as a filled field with an inset hairline, not a 3 px coloured side edge (impeccable "side-tab") */
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 60%, transparent);
    border-radius: var(--sw-r-xs);
    padding-inline: 6px;
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
    border-radius: var(--sw-r-xs);
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
    border-radius: var(--sw-r-pill);
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
  /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): an issue is a FILLED status field (danger / warning soft with an inset hairline),
     not a white box with a coloured outline; section labels and the measured value read as headings / display digits (the measurement in the
     interface face with tabular digits - monospace stays for code, taste-skill); the favourite star is a drawn icon; press feedback on every
     chip, mode and row; hover only with a fine pointer. */
  .modes button,
  .btnlink,
  .panelchips button,
  .issue,
  .libitem,
  .linkbtn,
  .libitem .fav {
    transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .modes button:active:not(:disabled),
  .btnlink:active,
  .panelchips button:active:not(:disabled),
  .issue:active:not(:disabled),
  .libitem:active,
  .libitem .fav:active {
    transform: scale(var(--sw-press-scale));
  }
  .modes button.on,
  .panelchips button.on {
    font-weight: var(--sw-fw-semibold);
  }
  .issue.error {
    background: var(--sw-danger-soft);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 55%, transparent);
  }
  .issue.warning {
    background: var(--sw-warning-soft);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 60%, transparent);
  }
  .issue.error .muted,
  .issue.warning .muted {
    color: var(--sw-text);
  }
  .ilbl,
  .selhead > b,
  .selhead > strong {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .measure-val {
    font-family: inherit;
    font-size: var(--sw-fs-2xl);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
    letter-spacing: -0.01em;
  }
  .libitem.on {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-accent-text);
  }
  .libitem .fav {
    display: inline-grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-xs);
  }
  .libitem .fav.on {
    background: var(--sw-warning-soft);
  }
  /* POLISH4 WP6 (D12 / D13): hover only under a fine pointer (it replaces the ungated :hover + (hover: none) undo) */
  @media (hover: hover) and (pointer: fine) {
    .libitem:hover:not(.on) {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
  }
  /* POLISH4 WP6 (D13): a finger on a tablet or a phone gets the 44 px touch target on the studio's small keys (the mode pills, the
     glazing panel chips and the favourite star); a mouse keeps the compact desktop rhythm */
  @media (pointer: coarse) {
    .modes button,
    .panelchips button,
    .btnlink {
      min-block-size: var(--sw-touch-desktop);
    }
    .panelchips button {
      min-inline-size: var(--sw-touch-desktop);
    }
    .libitem .fav {
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
    }
  }
  /* POLISH4 WP6 (D13): on a phone the three-up number row (width / height / depth) keeps each field at least a thumb wide */
  @media (max-width: 479px) {
    .three {
      grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    }
  }
  .badge {
    background: var(--sw-accent-soft);
    border-color: transparent;
    font-weight: var(--sw-fw-semibold);
  }
  .dcand.bad {
    border-radius: var(--sw-r-xs);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 55%, transparent);
  }
`;

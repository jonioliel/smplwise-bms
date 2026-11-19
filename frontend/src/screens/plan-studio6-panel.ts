/**
 * Plan Studio 6 editor UI (CR-029 ST7 UI, design ADR docs/design/ST7_UI.md): the pure render functions the plan editor
 * mounts for the document 2.2 fields - a material field with swatches from the material library (per-style preview, reset
 * to the default), the north compass on the calibration card (drag, keyboard, a number; the sun's direction right now as
 * the preview) and the saved walk positions card (name, level, place on the plan, order, default, delete, "go here").
 * Like plan-studio-panel.ts: the editor owns the state and passes callbacks; its shadow root carries the shared classes
 * (.row, .two, .note, .btns) and `studio6Styles` below. Every edit goes through the pure operations of map/studio6-fields.ts.
 */
import { css, html, nothing, svg, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { GeomLevel, Pt } from '../map/geometry';
import { MATERIALS, materialDef, type VisualStyle } from '../map/material-resolve';
import { MAX_POSITION_NAME, MAX_WALK_POSITIONS, type WalkPosition } from '../map/studio6-fields';
import { sunPosition } from '../map/sun';
import { tr } from '../i18n/msg/media';
// CR-CMP2-SEGMENTED-C-2450: the host (explore-plan-editor) registers sw-segmented - this module stays importable by the node unit tests
import type { SegmentedChange } from '../components/sw-segmented';

// ---------------------------------------------------------------- materials

/** What a surface is made of decides which swatches come first; the select below lists the whole library. */
export type MaterialHost = 'wall' | 'floor' | 'ceiling' | 'object';
const SWATCH_GROUPS: Record<MaterialHost, readonly string[]> = {
  wall: ['wall', 'floor'],
  floor: ['floor', 'outdoor'],
  ceiling: ['ceiling', 'wall'],
  object: ['object', 'door', 'window'],
};
const GROUP_HE: Record<string, string> = { wall: tr('קירות'), ceiling: tr('תקרות'), floor: tr('רצפות'), outdoor: tr('חוץ'), object: tr('עצמים'), door: tr('דלתות'), window: tr('חלונות וזכוכית') };
const STYLE_HE: Record<VisualStyle, string> = { light: tr('בהיר'), dark: tr('כהה') };

/** The swatch materials of a host, in library order (the groups of SWATCH_GROUPS first, each group kept together). */
export function swatchMaterials(host: MaterialHost): readonly (typeof MATERIALS)[number][] {
  const groups = SWATCH_GROUPS[host];
  return [...MATERIALS].filter((m) => groups.includes(m.group)).sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group));
}

interface MaterialFieldView {
  /** The hook `data-material-field` (collection:id), also the aria group's id. */
  key: string;
  label: string;
  host: MaterialHost;
  /** The item's own material (null = none: the default applies). */
  value: string | null;
  /** The material the resolver gives without an own value (by kind / catalog item / role / level). */
  defaultId: string;
  /** The visual style the swatches are tinted for (the UI theme to start with). */
  style: VisualStyle;
  disabled?: boolean;
}
interface MaterialFieldActions {
  pick(id: string | null): void;
  setStyle(style: VisualStyle): void;
}

const tintOf = (id: string, style: VisualStyle): string => materialDef(id)?.tint[style] ?? 'transparent';
const materialName = (id: string): string => materialDef(id)?.he ?? id;

export function renderMaterialField(v: MaterialFieldView, a: MaterialFieldActions): TemplateResult {
  const current = v.value ?? v.defaultId;
  const own = v.value !== null;
  const swatches = swatchMaterials(v.host);
  const groups = [...new Set(MATERIALS.map((m) => m.group))];
  return html`<div class="matf" data-material-field=${v.key}>
    <div class="mathead">
      <span class="lbl">${v.label}<span class="muted" data-material-current>${own ? materialName(current) : tr('ברירת מחדל: {name}', { name: materialName(v.defaultId) })}</span></span>
      <sw-segmented size="sm" label=${tr('תצוגה מקדימה לפי סגנון')} value=${v.style} @change=${(e: CustomEvent<SegmentedChange>) => a.setStyle(e.detail.value as VisualStyle)}
        .options=${(['light', 'dark'] as const).map((s) => ({ value: s, label: STYLE_HE[s], attrs: { 'data-material-style': s } }))}></sw-segmented>
    </div>
    <div class="swatches" role="group" aria-label=${v.label}>
      ${swatches.map(
        (m) => html`<button type="button" class="swatch" data-material-pick=${m.id} aria-pressed=${own && current === m.id ? 'true' : 'false'} aria-label=${m.he} title=${m.he} ?disabled=${v.disabled}
          style=${styleMap({ '--sw-swatch': m.tint[v.style] })} @click=${() => a.pick(own && current === m.id ? null : m.id)}><i aria-hidden="true"></i></button>`,
      )}
    </div>
    <div class="two">
      <sw-field label=${tr('כל החומרים')}><select data-material-select ?disabled=${v.disabled} aria-label=${tr('{label} - כל החומרים', { label: v.label })} @change=${(e: Event) => a.pick((e.target as HTMLSelectElement).value || null)}>
        <option value="" ?selected=${!own}>${tr('ברירת מחדל ({name})', { name: materialName(v.defaultId) })}</option>
        ${groups.map((g) => html`<optgroup label=${GROUP_HE[g] ?? g}>${MATERIALS.filter((m) => m.group === g).map((m) => html`<option value=${m.id} ?selected=${own && current === m.id}>${m.he}</option>`)}</optgroup>`)}
      </select></sw-field>
      <button type="button" class="matreset" data-material-reset ?disabled=${v.disabled || !own} @click=${() => a.pick(null)}>
        <i class="dot" aria-hidden="true" style=${styleMap({ background: tintOf(v.defaultId, v.style) })}></i>${tr('ברירת מחדל')}
      </button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- north

interface NorthView {
  /** The plan's north: the bearing of plan-up, clockwise from true north (0 = plan up is north). */
  northDeg: number | null;
  /** The site for the sun preview (the defaults with `known` false when the installation has no location). */
  site: { latitude: number; longitude: number; known: boolean };
  /** The instant of the preview (ms UTC); the editor passes Date.now() on every render. */
  nowMs: number;
  disabled?: boolean;
}
interface NorthActions {
  set(deg: number | null): void;
}

/** The bearing (deg, clockwise from up, 0..360) of a point from the dial's centre; used by the drag and the tests. */
export function compassAngle(cx: number, cy: number, px: number, py: number): number {
  const a = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
  return Math.round((((a % 360) + 360) % 360) * 10) / 10;
}

/** A compass bearing as the eight winds in Hebrew (for the sun line and the dial's caption). */
export function windName(deg: number): string {
  const names = [tr('צפון'), tr('צפון-מזרח'), tr('מזרח'), tr('דרום-מזרח'), tr('דרום'), tr('דרום-מערב'), tr('מערב'), tr('צפון-מערב')];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** The sun on the plan right now: its bearing on the plan (clockwise from plan up) and its elevation. */
export function sunOnPlan(nowMs: number, site: { latitude: number; longitude: number }, northDeg: number): { planDeg: number; elevation: number; azimuth: number } {
  const s = sunPosition(nowMs, site.latitude, site.longitude, northDeg);
  return { planDeg: (((s.azimuth - northDeg) % 360) + 360) % 360, elevation: s.elevation, azimuth: s.azimuth };
}

const DIAL_R = 60;
const pointAt = (deg: number, r: number): [number, number] => [DIAL_R + r * Math.sin((deg * Math.PI) / 180), DIAL_R - r * Math.cos((deg * Math.PI) / 180)];

export function renderNorthCard(v: NorthView, a: NorthActions): TemplateResult {
  const deg = v.northDeg ?? 0;
  const sun = sunOnPlan(v.nowMs, v.site, deg);
  const up = sun.elevation > 0;
  // the north needle: plan-up has bearing `deg`, so true north sits at -deg on the plan (counter-clockwise by the bearing)
  const north = (360 - deg) % 360;
  const [nx, ny] = pointAt(north, DIAL_R - 14);
  const [sx, sy] = pointAt(sun.planDeg, DIAL_R - 8);
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 15 : 1;
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'Home' ? -deg : null;
    if (delta === null) return;
    e.preventDefault();
    a.set(Math.round((deg + delta) * 10) / 10);
  };
  let dragging = false;
  const bearingFromEvent = (e: PointerEvent): number => {
    const el = e.currentTarget as SVGSVGElement;
    const r = el.getBoundingClientRect();
    // the pointer sits at bearing b from the centre; north is drawn there, so the plan's bearing is 360 - b
    return (360 - compassAngle(r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY)) % 360;
  };
  return html`<sw-card heading=${tr('צפון')} subheading=${v.northDeg === null ? tr('לא הוגדר: למעלה בתוכנית = צפון') : tr('למעלה בתוכנית פונה ל{wind} ({deg}°)', { wind: windName(deg), deg })} data-north-card>
    <div class="northrow">
      <svg class="dial" data-north-dial viewBox=${`0 0 ${DIAL_R * 2} ${DIAL_R * 2}`} role="slider" tabindex=${v.disabled ? -1 : 0} aria-label=${tr('צפון התוכנית')} aria-valuemin="0" aria-valuemax="359" aria-valuenow=${Math.round(deg)} aria-valuetext=${`${deg}° - ${windName(deg)}`}
        @keydown=${onKey}
        @pointerdown=${(e: PointerEvent) => { if (v.disabled) return; dragging = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); a.set(bearingFromEvent(e)); }}
        @pointermove=${(e: PointerEvent) => { if (dragging) a.set(bearingFromEvent(e)); }}
        @pointerup=${(e: PointerEvent) => { dragging = false; (e.currentTarget as Element).releasePointerCapture(e.pointerId); }}
        @pointercancel=${() => { dragging = false; }}>
        <circle class="face" cx=${DIAL_R} cy=${DIAL_R} r=${DIAL_R - 2}></circle>
        ${[0, 90, 180, 270].map((t) => { const [x1, y1] = pointAt(t, DIAL_R - 4); const [x2, y2] = pointAt(t, DIAL_R - 10); return svg`<line class="tick" x1=${x1} y1=${y1} x2=${x2} y2=${y2}></line>`; })}
        <path class="plan-up" d=${`M ${DIAL_R - 5} 14 L ${DIAL_R} 6 L ${DIAL_R + 5} 14 Z`}></path>
        <line class="needle" x1=${DIAL_R} y1=${DIAL_R} x2=${nx} y2=${ny}></line>
        <circle class="hub" cx=${DIAL_R} cy=${DIAL_R} r="4"></circle>
        <text class="n" x=${nx} y=${ny} dy="-7" text-anchor="middle">N</text>
        ${up ? svg`<g class="sun" data-north-sun transform=${`translate(${sx} ${sy})`}><circle r="5"></circle>${[0, 45, 90, 135, 180, 225, 270, 315].map((t) => svg`<line x1="0" y1="-7" x2="0" y2="-9" transform=${`rotate(${t})`}></line>`)}</g>` : nothing}
      </svg>
      <div class="northctl">
        <sw-field label=${tr('כיוון הצפון (°)')} hint=${tr('כמה מעלות הצפון סוטה מלמעלה בתוכנית, עם כיוון השעון')}><input type="number" min="0" max="359.9" step="0.5" inputmode="decimal" data-ltr data-north-deg .value=${v.northDeg === null ? '' : String(deg)} ?disabled=${v.disabled}
          @change=${(e: Event) => { const raw = (e.target as HTMLInputElement).value.trim(); if (!raw) return a.set(null); const x = parseFloat(raw); if (Number.isFinite(x)) a.set(x); }} /></sw-field>
        <div class="note" data-north-sun-note>${up ? tr('השמש עכשיו ב{wind}, {deg}° מעל האופק', { wind: windName(sun.azimuth), deg: Math.round(sun.elevation) }) : tr('השמש מתחת לאופק עכשיו')}${v.site.known ? '' : tr(' · מיקום האתר לא הוגדר: מרכז הארץ (הגדרות ‹ מפה)')}</div>
        <div class="btns"><button type="button" class="tbtn ghost" data-north-reset ?disabled=${v.disabled || v.northDeg === null} @click=${() => a.set(null)}>${tr('למעלה = צפון')}</button></div>
      </div>
    </div>
    <div class="note">${tr('גרור את המחוג, או השתמש בחצים (Shift = 15°). הצפון קובע את מסלול השמש בתצוגה הריאליסטית ובתמונות המוכנות.')}</div>
  </sw-card>`;
}

// ---------------------------------------------------------------- saved walk positions

interface WalkCardView {
  positions: readonly WalkPosition[];
  levels: readonly GeomLevel[];
  /** The plan's size in pixels and its scale (m / px) for the metres caption. */
  W: number;
  H: number;
  scale: number;
  estimated: boolean;
  /** A new position (or the one with this id) is placed by the next click on the plan. */
  armed: string | 'new' | null;
  /** The row whose marker is highlighted on the plan. */
  focused: string | null;
  disabled?: boolean;
}
interface WalkCardActions {
  arm(id: string | 'new' | null): void;
  rename(id: string, name: string): void;
  setLevel(id: string, levelId: string): void;
  setHeading(id: string, deg: number): void;
  setDefault(id: string): void;
  move(id: string, delta: -1 | 1): void;
  remove(id: string): void;
  /** Centre the plan on the position (and lift a level filter hiding it). */
  goTo(id: string): void;
}

/** "עמדה 3": the first free number after the names already taken. */
export function newPositionName(existing: readonly { name: string }[]): string {
  const taken = new Set(existing.map((p) => p.name.trim()));
  for (let i = 1; ; i++) if (!taken.has(tr('עמדה {i}', { i }))) return tr('עמדה {i}', { i });
}

/** A position in metres from the plan's top-left corner, as the walk bar shows the eye. */
export function positionMetres(p: Pick<WalkPosition, 'x' | 'y'>, W: number, H: number, scale: number): { x: number; y: number } {
  return { x: Math.round(p.x * W * scale * 10) / 10, y: Math.round(p.y * H * scale * 10) / 10 };
}

/** The short arrow the canvas draws for a position: from the eye in the heading's direction (0.04 of the plan's width). */
export function positionArrow(p: Pick<WalkPosition, 'x' | 'y' | 'heading_deg'>, W: number, H: number): { a: Pt; b: Pt } {
  const len = 0.045 * W;
  const rad = (p.heading_deg * Math.PI) / 180;
  return { a: [p.x, p.y], b: [p.x + (Math.sin(rad) * len) / W, p.y - (Math.cos(rad) * len) / H] };
}

export function renderWalkCard(v: WalkCardView, a: WalkCardActions): TemplateResult {
  const full = v.positions.length >= MAX_WALK_POSITIONS;
  const levelName = (id: string) => v.levels.find((l) => l.id === id)?.name ?? id;
  return html`<sw-card heading=${tr('עמדות סיור')} subheading=${v.positions.length ? tr('{length} עמדות · הסדר כאן הוא סדר המסלול', { length: v.positions.length }) : tr('נקודות מבט שמורות לסיור בגובה עין')} data-walk-card>
    ${v.armed ? html`<div class="note armed" data-walk-armed role="status">${v.armed === 'new' ? tr('לחץ על התוכנית במקום שבו עומדים · Esc לביטול') : tr('לחץ על התוכנית כדי להזיז את העמדה · Esc לביטול')}</div>` : nothing}
    ${v.positions.length
      ? html`<ol class="walklist" aria-label=${tr('עמדות סיור')}>
          ${v.positions.map((p, i) => {
            const m = positionMetres(p, v.W, v.H, v.scale);
            return html`<li class=${`walkrow${v.focused === p.id ? ' on' : ''}${v.armed === p.id ? ' armed' : ''}`} data-walk-row=${p.id}>
              <span class="idx" aria-hidden="true">${i + 1}</span>
              <input class="name" type="text" maxlength=${MAX_POSITION_NAME} data-walk-name aria-label=${tr('שם העמדה {n}', { n: i + 1 })} .value=${p.name} ?disabled=${v.disabled}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                @change=${(e: Event) => a.rename(p.id, (e.target as HTMLInputElement).value)} />
              <button type="button" class="star" data-walk-default aria-label=${p.is_default ? tr('עמדת הפתיחה של הסיור') : tr('קבע כעמדת הפתיחה')} aria-pressed=${p.is_default ? 'true' : 'false'} title=${p.is_default ? tr('עמדת הפתיחה') : tr('עמדת הפתיחה של הסיור')} ?disabled=${v.disabled} @click=${() => a.setDefault(p.id)}><sw-icon name="star" size=${16}></sw-icon></button>
              <span class="where">
                ${v.levels.length > 1 ? html`<select data-walk-level aria-label=${tr('מפלס')} ?disabled=${v.disabled} @change=${(e: Event) => a.setLevel(p.id, (e.target as HTMLSelectElement).value)}>${v.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === p.level_id}>${l.name}</option>`)}</select>` : html`<span class="muted">${levelName(p.level_id)}</span>`}
                <span class="muted" data-walk-pos>${v.estimated ? '≈ ' : ''}<span class="ltr">${m.x} / ${m.y}</span> ${tr('מ׳')}</span>
                <label class="muted hd">${tr('כיוון')} <input type="number" min="0" max="359" step="5" inputmode="numeric" data-ltr data-walk-heading aria-label=${tr('כיוון המבט במעלות')} .value=${String(Math.round(p.heading_deg))} ?disabled=${v.disabled}
                  @change=${(e: Event) => { const x = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(x)) a.setHeading(p.id, x); }} />°</label>
              </span>
              <span class="acts">
                <button type="button" data-walk-go aria-label=${tr('עבור לעמדה בתוכנית')} title=${tr('הצג בתוכנית')} @click=${() => a.goTo(p.id)}><sw-icon name="target" size=${16}></sw-icon></button>
                <button type="button" data-walk-place aria-label=${tr('הזז את העמדה בלחיצה על התוכנית')} title=${tr('הזז בלחיצה על התוכנית')} aria-pressed=${v.armed === p.id ? 'true' : 'false'} ?disabled=${v.disabled} @click=${() => a.arm(v.armed === p.id ? null : p.id)}><sw-icon name="move" size=${16}></sw-icon></button>
                <button type="button" data-walk-up aria-label=${tr('הקדם במסלול')} title=${tr('למעלה')} ?disabled=${v.disabled || i === 0} @click=${() => a.move(p.id, -1)}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
                <button type="button" data-walk-down aria-label=${tr('אחר במסלול')} title=${tr('למטה')} ?disabled=${v.disabled || i === v.positions.length - 1} @click=${() => a.move(p.id, 1)}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
                <button type="button" class="danger" data-walk-delete aria-label=${tr('מחק את העמדה')} title=${tr('מחק')} ?disabled=${v.disabled} @click=${() => a.remove(p.id)}><sw-icon name="trash" size=${16}></sw-icon></button>
              </span>
            </li>`;
          })}
        </ol>`
      : html`<div class="note" data-walk-empty>${tr('עדיין אין עמדות שמורות. עמדה היא מקום וכיוון מבט שהסיור יכול לקפוץ אליהם (מקשים 1-9 בסיור).')}</div>`}
    <div class="btns">
      <button type="button" class=${v.armed === 'new' ? 'tbtn primary' : 'tbtn'} data-walk-add ?disabled=${v.disabled || full} title=${full ? tr('עד {MAX_WALK_POSITIONS} עמדות', { MAX_WALK_POSITIONS }) : tr('לחיצה על התוכנית מציבה את העמדה')} @click=${() => a.arm(v.armed === 'new' ? null : 'new')}><sw-icon name="plus" size=${16}></sw-icon>${v.armed === 'new' ? tr('בטל הצבה') : tr('עמדה חדשה')}</button>
    </div>
  </sw-card>`;
}

/** The classes of the three cards; the editor adds them to its styles (tokens only: no literal colours). */
export const studio6Styles = css`
  /* a text button sized by the desktop touch dial (the shared sw-button's sm / md sizes stay 26-30 px) */
  .tbtn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: var(--sw-touch-desktop, 44px);
    min-inline-size: var(--sw-touch-desktop, 44px);
    padding: 0 14px;
    border-radius: var(--sw-r-pill);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
  }
  .tbtn.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--sw-text-2);
  }
  .tbtn.primary {
    border-color: var(--sw-accent);
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  /* SETUPPLAN-POLISH-2331: every pressable control of the three cards gives on pointer-down (emil-design-eng: 120 ms, transform only,
     the shared --sw-press-scale) and keeps its hover for a pointer that hovers - a tap no longer leaves a grey wash behind (mobile-native) */
  .tbtn,
  .swatch,
  .matreset,
  .walkrow button {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .tbtn:active:not([disabled]),
  .swatch:active:not([disabled]),
  .matreset:active:not([disabled]),
  .walkrow button:active:not([disabled]) {
    transform: scale(var(--sw-press-scale));
  }
  @media (prefers-reduced-motion: reduce) {
    .tbtn,
    .swatch,
    .matreset,
    .walkrow button {
      transition-duration: 0ms;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .tbtn:hover:not([disabled]),
    .matreset:hover:not([disabled]) {
      background: var(--sw-surface-3);
    }
    .tbtn.primary:hover:not([disabled]) {
      background: var(--sw-accent-hover);
    }
    .swatch:hover:not([disabled]):not([aria-pressed='true']) {
      box-shadow: inset 0 0 0 1px var(--sw-text-3);
    }
  }
  .tbtn:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .tbtn[disabled] {
    opacity: 0.5;
    cursor: default;
  }
  .matf {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-block: 6px;
  }
  .mathead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .mathead .lbl {
    display: flex;
    flex-direction: column;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    font-weight: var(--sw-fw-medium);
  }
  /* CR-CMP2-SEGMENTED-C-2450: the light / dark preview keys are sw-segmented; the card keeps its small track (2 px, the small
     radius) and its 44 px square key with the extra-small regular label */
  .mathead sw-segmented {
    --sw-seg-pad: 2px;
    --sw-seg-radius: var(--sw-r-sm);
    --sw-seg-btn-radius: calc(var(--sw-r-sm) - 2px);
    --sw-seg-h: var(--sw-touch-desktop, 44px);
    --sw-seg-key-min-w: var(--sw-touch-desktop, 44px);
    --sw-seg-key-pad: 8px;
    --sw-seg-fs: var(--sw-fs-xs);
    --sw-seg-fw: var(--sw-fw-regular);
    --sw-seg-on-fw: var(--sw-fw-semibold);
  }
  .swatch:focus-visible,
  .matreset:focus-visible,
  .dial:focus-visible,
  .walkrow button:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--sw-touch-desktop, 44px), 1fr));
    gap: 6px;
  }
  .swatch {
    all: unset;
    box-sizing: border-box;
    display: block;
    aspect-ratio: 1;
    min-inline-size: var(--sw-touch-desktop, 44px);
    min-block-size: var(--sw-touch-desktop, 44px);
    border-radius: var(--sw-r-sm);
    background: var(--sw-swatch, var(--sw-surface-3));
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    cursor: pointer;
    position: relative;
  }
  .swatch[aria-pressed='true'] {
    box-shadow: inset 0 0 0 2px var(--sw-accent), 0 0 0 2px var(--sw-surface);
  }
  .swatch[aria-pressed='true']::after {
    content: '';
    position: absolute;
    inset: 30%;
    border-radius: 50%;
    background: var(--sw-accent);
    box-shadow: 0 0 0 2px var(--sw-text-inverse);
  }
  .swatch[disabled] {
    cursor: default;
    opacity: 0.5;
  }
  .matreset {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: end;
    min-block-size: var(--sw-touch-desktop, 44px);
    padding: 0 10px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .matreset[disabled] {
    opacity: 0.5;
    cursor: default;
  }
  .matreset .dot {
    inline-size: 12px;
    block-size: 12px;
    border-radius: var(--sw-r-2xs);
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
  }
  /* the north compass */
  .northrow {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .dial {
    inline-size: 120px;
    block-size: 120px;
    border-radius: 50%;
    cursor: grab;
    touch-action: none;
    direction: ltr;
  }
  .dial .face {
    fill: var(--sw-surface-2);
    stroke: var(--sw-border-strong);
    stroke-width: 1.5;
  }
  .dial .tick {
    stroke: var(--sw-text-3);
    stroke-width: 1.5;
  }
  .dial .plan-up {
    fill: var(--sw-text-3);
  }
  .dial .needle {
    stroke: var(--sw-danger);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .dial .hub {
    fill: var(--sw-text);
  }
  .dial .n {
    fill: var(--sw-danger-text);
    font-size: var(--sw-fs-xs); /* 11px, from the type scale (unit-token-lint; integration 2.4.7) */
    font-weight: var(--sw-fw-bold);
  }
  .dial .sun circle {
    fill: var(--sw-warning);
  }
  .dial .sun line {
    stroke: var(--sw-warning);
    stroke-width: 1.5;
  }
  .northctl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-inline-size: 0;
  }
  .matf select,
  .northctl input {
    min-block-size: var(--sw-touch-desktop, 44px);
  }
  /* the saved walk positions */
  .note.armed {
    color: var(--sw-accent-text);
    background: var(--sw-accent-soft);
    border-radius: var(--sw-r-sm);
    padding: 6px 8px;
  }
  .walklist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .walkrow {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    grid-template-areas: 'idx name star' 'idx where where' 'idx acts acts';
    gap: 4px 8px;
    align-items: center;
    /* the inline padding is always there, so focusing a row (.on) tints it without shifting its contents sideways */
    padding: 8px 6px;
    border-block-end: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    transition: background var(--sw-t-hover) var(--sw-ease-color);
  }
  .walkrow:last-child {
    border-block-end: 0;
  }
  .walkrow.on {
    background: var(--sw-accent-soft);
  }
  .walkrow.armed {
    box-shadow: inset 0 0 0 2px var(--sw-accent);
  }
  .walkrow .name:focus-visible,
  .walkrow .where select:focus-visible,
  .walkrow .hd input:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .walkrow .idx {
    grid-area: idx;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .walkrow .name {
    grid-area: name;
    min-inline-size: 0;
    inline-size: 100%;
    box-sizing: border-box;
    min-block-size: var(--sw-touch-desktop, 44px);
    padding: 4px 8px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  .walkrow .star {
    grid-area: star;
  }
  .walkrow .where {
    grid-area: where;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
    font-size: var(--sw-fs-xs);
  }
  .walkrow .where select,
  .walkrow .hd input {
    font: inherit;
    font-size: var(--sw-fs-xs);
    min-block-size: var(--sw-touch-desktop, 44px);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    padding: 2px 6px;
  }
  .walkrow .hd {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .walkrow .hd input {
    inline-size: 64px;
  }
  .walkrow .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }
  .walkrow .acts {
    grid-area: acts;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .walkrow button {
    all: unset;
    box-sizing: border-box;
    display: inline-grid;
    place-items: center;
    min-inline-size: var(--sw-touch-desktop, 44px);
    min-block-size: var(--sw-touch-desktop, 44px);
    border-radius: var(--sw-r-sm);
    color: var(--sw-text-2);
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .walkrow button:hover:not([disabled]) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .walkrow button.danger:hover:not([disabled]) {
      color: var(--sw-danger-text);
      background: var(--sw-danger-soft);
    }
  }
  .walkrow button[aria-pressed='true'] {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  /* the default (start) position: the star is filled in the warm accent, not just a pressed wash */
  .walkrow .star[aria-pressed='true'] {
    background: transparent;
    color: var(--sw-warning);
    /* A11Y-POLISHED-2342: the bare warning read 2.0-2.15:1 on white in light; light draws the star in the warning ink (dark unchanged;
       an engine without light-dark() keeps the line above) */
    color: light-dark(var(--sw-warning-text), var(--sw-warning));
  }
  .walkrow button[disabled] {
    opacity: 0.4;
    cursor: default;
  }
  @media (pointer: coarse) {
    .swatch,
    .walkrow button,
    .matreset,
    .walkrow .where select,
    .walkrow .hd input,
    .walkrow .name,
    .matf select,
    .northctl input {
      min-block-size: 44px;
    }
  }
`;

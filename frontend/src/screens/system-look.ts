import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-pill';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { currentSkin, onDesign, resolvedTheme } from '../design/apply';
import './system-palette-editor';
import { allPalettes, onPalettes, paletteById, paletteTokens, setCustomPalettes, type Palette } from '../design/palette';
import { skinTable } from '../design/css';
import {
  DENSITY_BUNDLE, LOOK_DEFAULT, LOOK_DIALS, LOOK_DIAL_IDS, RADIUS_BUNDLE, effectiveSheetAlpha, installationLook, lookAttributes, normalizeDial, onLook, ownLook, saveDemoInstallationLook, saveOwnLook,
  sameLook, setInstallationLook, tierOf, type Look, type LookDial, type PartialLook,
} from '../design/look';

type Target = 'own' | 'installation';

/**
 * הגדרות › כללי › מראה (Bubble foundation, owner 2026-10-02): every look dial of the skin - density, surface, pop-up kind, corner
 * radius, transparency, scale, the desktop touch target and the palette - open and editable here, nothing hard-coded. Two owners of
 * the value: the installation's default (`ui.look`, every dial; a system administrator; saved with the button) and "ההעדפה שלי"
 * (the same key of /me/prefs, a PARTIAL object: each dial either follows the installation or overrides it; each change saved at
 * once). The preview below the dials is drawn with the draft's own tokens (the same bundles the page gets), so it is the look, not a
 * picture. The dials are drawn by the bubble skin; the other skins keep them for when the skin changes.
 */
@customElement('system-look')
export class SystemLook extends LitElement {
  @state() private target: Target = 'own';
  /** The installation draft (every dial) and the own draft (only overridden dials). */
  @state() private draftInst: Look = installationLook();
  @state() private own: PartialLook = ownLook();
  @state() private canEdit = !isApi();
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private skin = currentSkin();
  private stops: (() => void)[] = [];

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-weight: var(--sw-fw-medium);
      min-inline-size: 120px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: 12px;
      flex-wrap: wrap;
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      min-block-size: 36px;
      padding: 0 12px;
      border-radius: 9px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    .seg button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .range {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-inline-size: 220px;
    }
    .range input[type='range'] {
      flex: 1;
      min-inline-size: 140px;
      accent-color: var(--sw-accent);
      block-size: 36px;
      margin: 0;
    }
    .range output {
      min-inline-size: 48px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    .range button {
      all: unset;
      box-sizing: border-box;
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: 9px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      background: var(--sw-surface-3);
    }
    .range button[aria-pressed='true'] {
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
    }
    .range button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the palette row: one chip per palette with its four swatch colours */
    .pal {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .pal button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
      padding: 0 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .pal button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: inset 0 0 0 2px var(--sw-accent);
    }
    .pal button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    .pal button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .dots {
      display: inline-flex;
      direction: ltr;
    }
    .dots i {
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.45);
      margin-inline-start: -4px;
    }
    .dots i:first-child {
      margin-inline-start: 0;
    }
    /* the preview: a canvas with the draft's tokens, two pills, a mini sheet over a colourful backdrop */
    .preview {
      margin-block-start: 12px;
      padding: 14px;
      border-radius: var(--sw-r-lg);
      background: radial-gradient(60% 50% at 85% 0%, rgba(120, 140, 255, 0.32), transparent 70%), radial-gradient(50% 45% at 10% 100%, rgba(255, 170, 120, 0.28), transparent 70%), var(--sw-bg);
      display: grid;
      gap: var(--sw-gap-grid);
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      direction: rtl;
    }
    .pv-col {
      display: grid;
      gap: var(--sw-gap);
      align-content: start;
    }
    .pv-sheet {
      position: relative;
      border-radius: var(--sw-r-xl);
      background: rgba(var(--sw-sheet-rgb), var(--sw-sheet-alpha));
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet);
      backdrop-filter: var(--sw-glass-blur-sheet);
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-2);
      padding: 14px;
      display: grid;
      gap: var(--sw-gap);
      min-block-size: 120px;
    }
    .pv-sheet .t {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-size: calc(var(--sw-fs-lg) * var(--sw-look-scale, 1));
    }
    .pv-sheet .s {
      color: var(--sw-text-2);
      font-size: calc(var(--sw-fs-sm) * var(--sw-look-scale, 1));
    }
    .pv-sheet sw-pill {
      --pill-base: var(--sw-layer);
    }
    .pv-bg {
      position: absolute;
      inset: -20px -30px auto auto;
      inline-size: 140px;
      block-size: 90px;
      border-radius: 30px;
      background: linear-gradient(120deg, var(--sw-lit), var(--sw-hue-2));
      z-index: -1;
      opacity: 0.9;
    }
    .pv-wrap {
      position: relative;
      isolation: isolate;
    }
    .pv-btn {
      min-block-size: var(--sw-touch-desktop, 44px);
      padding: 0 16px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      justify-self: start;
      pointer-events: none;
    }
    .sb {
      inline-size: var(--sw-sub-size, var(--sw-sub));
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-inline-size: var(--sw-touch-desktop, 44px);
      min-block-size: var(--sw-touch-desktop, 44px);
      border: 0;
      border-radius: 50%;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      padding: 0;
      pointer-events: none;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-block-start: 12px;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stops.push(onLook(() => {
      this.own = ownLook();
      if (!this.dirtyInst) this.draftInst = installationLook();
      this.requestUpdate();
    }));
    this.stops.push(onDesign(() => (this.skin = currentSkin())));
    this.stops.push(onPalettes(() => this.requestUpdate()));
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          setInstallationLook(r.settings['ui.look']);
          setCustomPalettes(r.settings['ui.palettes']);
          this.draftInst = installationLook();
        })
        .catch(() => undefined);
    }
  }

  disconnectedCallback() {
    for (const s of this.stops) s();
    super.disconnectedCallback();
  }

  private get dirtyInst(): boolean {
    return !sameLook(this.draftInst, installationLook());
  }

  /** The look the preview draws: the installation draft, or my overrides over the installation. */
  private get preview(): Look {
    return this.target === 'installation' ? this.draftInst : { ...installationLook(), ...this.own };
  }

  private flash(text: string) {
    this.message = text;
    window.setTimeout(() => (this.message = ''), 2500);
  }

  private async saveInstallation() {
    this.busy = true;
    this.error = '';
    try {
      if (isApi()) {
        const r = await patchSettings({ 'ui.look': this.draftInst as unknown as Record<string, unknown> });
        invalidateSettings();
        setInstallationLook(r.settings['ui.look']);
      } else {
        saveDemoInstallationLook(this.draftInst);
      }
      this.draftInst = installationLook();
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** My own dial: a value overrides the installation's, null follows it. Saved at once. */
  private async setOwn<K extends LookDial>(dial: K, value: Look[K] | null) {
    const next: PartialLook = { ...this.own };
    if (value === null) delete next[dial];
    else (next as Record<string, unknown>)[dial] = value;
    this.busy = true;
    this.error = '';
    try {
      await saveOwnLook(next);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setInst<K extends LookDial>(dial: K, value: Look[K]) {
    this.draftInst = { ...this.draftInst, [dial]: value };
    this.message = '';
  }

  private pick<K extends LookDial>(dial: K, value: Look[K] | null) {
    if (this.target === 'installation') {
      if (value !== null) this.setInst(dial, value);
    } else void this.setOwn(dial, value);
  }

  private choiceRow<K extends LookDial>(dial: K) {
    const d = LOOK_DIALS[dial] as { values: readonly (string | number)[]; labelHe: Record<string, string>; hintHe: Record<string, string>; nameHe: string };
    const inst = installationLook()[dial] as string | number;
    const current = (this.target === 'installation' ? this.draftInst[dial] : this.own[dial] ?? null) as string | number | null;
    const disabled = this.busy || (this.target === 'installation' && !this.canEdit);
    let hint = current === null ? `לפי ההתקנה: ${d.labelHe[String(inst)]}` : d.hintHe[String(current)];
    // the performance dial: auto shows what this device decided (design/performance.ts)
    if (dial === 'performance' && (current ?? inst) === 'auto') hint += ` · כרגע: ${d.labelHe[tierOf('auto')]}`;
    return html`<div class="row" data-look-row=${dial}>
      <span class="lbl">${d.nameHe}<span class="muted">${hint}</span></span>
      <span class="seg" role="group" aria-label=${d.nameHe}>
        ${this.target === 'own' ? html`<button type="button" data-look-follow=${dial} aria-pressed=${current === null ? 'true' : 'false'} ?disabled=${disabled} @click=${() => this.pick(dial, null)}>לפי ההתקנה</button>` : nothing}
        ${d.values.map((v) => html`<button type="button" data-look-option=${`${dial}:${v}`} aria-pressed=${current === v ? 'true' : 'false'} ?disabled=${disabled} @click=${() => this.pick(dial, v as Look[K])}>${d.labelHe[String(v)]}</button>`)}
      </span>
    </div>`;
  }

  private rangeRow(dial: 'transparency' | 'scale') {
    const d = LOOK_DIALS[dial];
    const inst = installationLook()[dial];
    const own = this.own[dial];
    const follows = this.target === 'own' && own === undefined;
    const value = this.target === 'installation' ? this.draftInst[dial] : own ?? inst;
    const disabled = this.busy || (this.target === 'installation' && !this.canEdit);
    const floor = dial === 'transparency' ? Math.round(effectiveSheetAlpha() * 100) : 0;
    const floorNote = dial === 'transparency' && this.preview.transparency < floor ? ` · בפועל ${floor}% (סף הניגודיות)` : '';
    const onInput = (e: Event) => {
      const v = normalizeDial(dial, Number((e.target as HTMLInputElement).value));
      if (v === null) return;
      if (this.target === 'installation') this.setInst(dial, v);
    };
    const onChange = (e: Event) => {
      const v = normalizeDial(dial, Number((e.target as HTMLInputElement).value));
      if (v === null) return;
      if (this.target === 'own') void this.setOwn(dial, v);
    };
    return html`<div class="row" data-look-row=${dial}>
      <span class="lbl">${d.nameHe}<span class="muted">${follows ? `לפי ההתקנה: ${inst}%` : `${value}%`}${floorNote}</span></span>
      <span class="range">
        ${this.target === 'own' ? html`<button type="button" data-look-follow=${dial} aria-pressed=${follows ? 'true' : 'false'} ?disabled=${disabled} @click=${() => void this.setOwn(dial, null)}>לפי ההתקנה</button>` : nothing}
        <input type="range" data-look-range=${dial} min=${d.range[0]} max=${d.range[1]} step=${d.step} .value=${String(value)} ?disabled=${disabled} aria-label=${d.nameHe} aria-valuetext=${`${value}%`} @input=${onInput} @change=${onChange} />
        <output>${value}%</output>
      </span>
    </div>`;
  }

  /** The preview's tokens: the same bundles the page gets, as inline custom properties (a shadow root cannot see the document's attribute rules). */
  private previewStyle(l: Look): Record<string, string> {
    const pal = paletteById(l.palette);
    const palMin = pal ? pal.schemes[resolvedTheme()].glass.opacity.min : 0;
    const a = lookAttributes(l, Math.max(palMin, effectiveSheetAlpha() <= l.transparency / 100 ? 0 : effectiveSheetAlpha()));
    return { ...DENSITY_BUNDLE[l.density], ...RADIUS_BUNDLE[l.radius], ...this.paletteStyle(l.palette), ...a.style };
  }

  /** The colours of a palette as the preview's inline custom properties; `default` (and an id with no palette) = the skin's own colours, over whatever the page itself shows. */
  private paletteStyle(id: string): Record<string, string> {
    const theme = resolvedTheme();
    const pal = paletteById(id);
    if (pal) return paletteTokens(pal, theme);
    const table = skinTable('bubble');
    const out: Record<string, string> = {};
    for (const n of Object.keys(paletteTokens(allPalettes()[0], theme))) {
      const v = table[n]?.[theme];
      if (v) out[n] = v;
    }
    return out;
  }

  /** The four colours of a palette's swatch in the scheme in force (bg, surface, accent, text). */
  private swatch(id: string): string[] {
    const theme = resolvedTheme();
    const pal: Palette | null = paletteById(id);
    if (pal) {
      const s = pal.schemes[theme];
      return [s.bg, s.surface, s.accent, s.text];
    }
    const t = skinTable('bubble');
    return ['--sw-bg', '--sw-surface', '--sw-accent', '--sw-text'].map((n) => t[n][theme]);
  }

  /** The palette is chosen for everybody by the installation's system administrator only (owner 2026-10-02): no personal override, so the row exists only on the installation target, for a person who can edit it. */
  private paletteRow() {
    if (this.target !== 'installation' || !this.canEdit) return nothing;
    const d = LOOK_DIALS.palette;
    const current = this.draftInst.palette;
    const disabled = this.busy;
    const nameOf = (id: string) => (id === 'default' ? d.labelHe.default : paletteById(id)?.name.he ?? d.labelHe.default);
    const ids = ['default', ...allPalettes().map((p) => p.id)];
    return html`<div class="row" data-look-row="palette">
      <span class="lbl">${d.nameHe}<span class="muted">${nameOf(current)}</span></span>
      <span class="pal" role="group" aria-label=${d.nameHe}>
        ${ids.map(
          (id) => html`<button type="button" data-look-option=${`palette:${id}`} aria-pressed=${current === id ? 'true' : 'false'} ?disabled=${disabled} @click=${() => this.pick('palette', id)}>
            <span class="dots" aria-hidden="true">${this.swatch(id).map((c) => html`<i style=${styleMap({ background: c })}></i>`)}</span>${nameOf(id)}
          </button>`,
        )}
      </span>
    </div>
    <system-palette-editor .canEdit=${this.canEdit}></system-palette-editor>`;
  }

  render() {
    const l = this.preview;
    const attrs = lookAttributes(l).attrs;
    const instDisabled = !this.canEdit || this.busy;
    return html`<sw-card heading="מראה" subheading="צפיפות, משטח, חלונות קופצים, פינות, אטימות, גודל ויעד לחיצה - לכל ההתקנה ולעצמי" data-look-card>
      <div class="row">
        <span class="lbl">למי<span class="muted">${this.target === 'own' ? 'ההעדפה שלי: כל שינוי נשמר מיד' : 'ברירת המחדל של ההתקנה: נשמרת בכפתור'}</span></span>
        <span class="seg" role="group" aria-label="למי">
          <button type="button" data-look-target="own" aria-pressed=${this.target === 'own' ? 'true' : 'false'} @click=${() => (this.target = 'own')}>ההעדפה שלי</button>
          <button type="button" data-look-target="installation" aria-pressed=${this.target === 'installation' ? 'true' : 'false'} @click=${() => (this.target = 'installation')}>ברירת המחדל של ההתקנה</button>
        </span>
      </div>
      ${this.skin !== 'bubble' ? html`<div class="row"><span class="note" data-look-skin-note>הסגנון הנוכחי הוא ${this.skin}; האפשרויות כאן מצוירות על ידי סגנון Bubble.</span></div>` : nothing}
      ${this.choiceRow('density')}
      ${this.choiceRow('surface')}
      ${this.choiceRow('popup')}
      ${this.choiceRow('radius')}
      ${this.rangeRow('transparency')}
      ${this.rangeRow('scale')}
      ${this.choiceRow('touch')}
      ${this.choiceRow('performance')}
      ${this.paletteRow()}
      <div class="preview" data-look-preview=${`${l.density}/${l.surface}/${l.popup}/${l.radius}/${l.transparency}/${l.scale}/${l.touch}`} aria-label="תצוגה מקדימה" style=${styleMap(this.previewStyle(l))}
        data-bubble-density=${attrs['data-bubble-density']} data-bubble-surface=${attrs['data-bubble-surface']} data-bubble-radius=${attrs['data-bubble-radius']} data-bubble-touch=${attrs['data-bubble-touch']} data-bubble-performance=${attrs['data-bubble-performance']}>
        <div class="pv-col">
          <sw-pill variant="slider" icon="light" label="תאורה מרכזית" state="דולק · 72%" .value=${0.72} on .hue=${2} .density=${l.density} .surface=${l.surface} tabindex="-1" data-preview-pill></sw-pill>
          <sw-pill variant="plain" icon="coverOpen" label="תריס חלון" state="פתוח · 60%" .value=${0.6} on fill-color="var(--sw-accent-soft)" .hue=${4} .density=${l.density} .surface=${l.surface} tabindex="-1">
            <button slot="subs" class="sb" tabindex="-1" aria-hidden="true"><sw-icon name="arrowUp" size=${18}></sw-icon></button>
            <button slot="subs" class="sb" tabindex="-1" aria-hidden="true"><sw-icon name="arrowDown" size=${18}></sw-icon></button>
          </sw-pill>
          <sw-pill variant="toggle" icon="bolt" label="דוד שמש" state="כבוי" .hue=${6} .density=${l.density} .surface=${l.surface} tabindex="-1"></sw-pill>
        </div>
        <div class="pv-wrap"><span class="pv-bg" aria-hidden="true"></span>
          <div class="pv-sheet" data-preview-sheet>
            <span class="t">${LOOK_DIALS.popup.labelHe[l.popup]}</span>
            <span class="s">${LOOK_DIALS.popup.hintHe[l.popup]}</span>
            <sw-pill variant="plain" icon="home" label="סלון" state="3 דולקים" .hue=${2} .density=${l.density} .surface=${l.surface} tabindex="-1"></sw-pill>
            <button type="button" class="pv-btn" tabindex="-1" aria-hidden="true">אישור</button>
          </div>
        </div>
      </div>
      <div class="foot">
        ${this.target === 'installation'
          ? html`<sw-button variant="primary" size="sm" icon="check" data-look-save ?disabled=${instDisabled || !this.dirtyInst} @click=${() => void this.saveInstallation()}>שמור</sw-button>
              <sw-button variant="ghost" size="sm" data-look-reset ?disabled=${instDisabled || sameLook(this.draftInst, LOOK_DEFAULT)} @click=${() => { this.draftInst = { ...LOOK_DEFAULT }; }}>ערכי המוצר</sw-button>
              ${!this.canEdit && isApi() ? html`<span class="note">שינוי ברירת המחדל דורש הרשאת מנהל מערכת.</span>` : nothing}`
          : html`<sw-button variant="ghost" size="sm" data-look-clear-own ?disabled=${this.busy || !Object.keys(this.own).length} @click=${() => void saveOwnLook({}).then(() => this.flash('ההעדפה נמחקה')).catch((e) => (this.error = describeError(e)))}>לפי ההתקנה בכל האפשרויות</sw-button>`}
        ${this.message ? html`<span class="ok" role="status" data-look-message>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

/** The dials, in the order the card shows them (exported for the spec). */
export const LOOK_CARD_DIALS = LOOK_DIAL_IDS;

declare global {
  interface HTMLElementTagNameMap {
    'system-look': SystemLook;
  }
}

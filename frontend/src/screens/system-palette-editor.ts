import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-button';
import '../components/sw-pill';
import { describeError } from '../api/client';
import { patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { lookOf } from '../design/look';
import { MAX_CUSTOM, allPalettes, customPalettes, onPalettes, paletteById, paletteTokens, setCustomPalettes, validatePalette, type Palette, type Scheme } from '../design/palette';

/** The key colours the editor offers (path inside a scheme, Hebrew name). The rest of a palette (states, rings, gradients, slider) is the base palette's. */
export const KEY_COLORS: readonly (readonly [string, string])[] = [
  ['bg', 'רקע'],
  ['surface', 'משטח'],
  ['surface2', 'משטח משני'],
  ['surfaceElevated', 'משטח מוגבה'],
  ['glass.tint', 'גוון זכוכית'],
  ['text', 'טקסט'],
  ['textMuted', 'טקסט משני'],
  ['accent', 'צבע הדגש'],
  ['accentContrast', 'טקסט על הדגש'],
  ['accentText', 'טקסט בצבע הדגש'],
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function setPath(o: Record<string, unknown>, path: string, value: string): void {
  const ks = path.split('.');
  const last = ks.pop() as string;
  let n = o;
  for (const k of ks) n = n[k] as Record<string, unknown>;
  n[last] = value;
}
const getPath = (o: unknown, path: string): string => path.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], o) as string;

/**
 * הגדרות › כללי › מראה › ערכות צבעים (release 0.1.156): the palette editor. A system administrator starts from any palette, edits the
 * key colours of the light and the dark scheme with a live preview, and saves the result as a CUSTOM palette of the installation
 * (`ui.palettes`; the palette dial of every user can then point at it). A palette that does not pass the contrast checks (text 4.5:1,
 * non-text 3:1; design/palette.ts) is refused with a Hebrew message listing the failing pairs: it is never sent, never stored and never
 * applied - the palette in force stays. The backend runs the same checks. Renders nothing for a person who cannot edit the installation.
 */
@customElement('system-palette-editor')
export class SystemPaletteEditor extends LitElement {
  @property({ type: Boolean }) canEdit = false;
  @state() private draft: Palette | null = null;
  @state() private scheme: Scheme = 'light';
  @state() private busy = false;
  @state() private error = '';
  @state() private message = '';
  @state() private confirmDelete = '';
  private stop?: () => void;

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
      font-weight: var(--sw-fw-medium);
    }
    .btns {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: 12px;
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
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .fields {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 0;
    }
    select,
    input[type='text'] {
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px;
    }
    .grid label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-block-size: 40px;
      padding: 0 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .grid input[type='color'] {
      inline-size: 44px;
      block-size: 32px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: none;
      cursor: pointer;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 8px;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .pv {
      margin-block: 10px;
      padding: 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-canvas);
      color: var(--sw-text);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sw-gap-grid);
      direction: rtl;
    }
    .pv-col {
      display: grid;
      gap: var(--sw-gap);
      align-content: start;
    }
    .pv-sheet {
      border-radius: var(--sw-r-xl);
      background: rgba(var(--sw-sheet-rgb), var(--pv-alpha, 0.72));
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet);
      backdrop-filter: var(--sw-glass-blur-sheet);
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
      padding: 14px;
      display: grid;
      gap: var(--sw-gap);
    }
    .pv-sheet .t {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .pv-sheet .s {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
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
    .pv-link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .pv-states {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
    }
    .pv-states b {
      font-weight: var(--sw-fw-semibold);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stop = onPalettes(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private flash(text: string) {
    this.message = text;
    window.setTimeout(() => (this.message = ''), 2500);
  }

  /** A new palette starts as a copy of the palette in force (or the first ready one); editing one starts as that palette. */
  private startNew() {
    const base = paletteById(lookOf('palette')) ?? allPalettes()[0];
    this.draft = { ...clone(base), id: `custom-${Date.now().toString(36)}`, name: { he: '', en: 'Custom' } };
    this.error = '';
  }
  private startEdit(p: Palette) {
    this.draft = clone(p);
    this.error = '';
  }
  private rebase(id: string) {
    const base = paletteById(id);
    if (!base || !this.draft) return;
    this.draft = { ...clone(base), id: this.draft.id, name: this.draft.name };
  }
  private setColor(path: string, value: string) {
    if (!this.draft) return;
    const d = clone(this.draft);
    const s = d.schemes[this.scheme];
    const old = getPath(s, path);
    setPath(s as unknown as Record<string, unknown>, path, value);
    if (path === 'accent' && s.state.on === old) s.state.on = value; // the toggle colour follows the accent while it did
    this.draft = d;
    this.error = '';
  }

  private async save() {
    if (!this.draft) return;
    const v = validatePalette(this.draft, { custom: true });
    if (!v.ok) {
      this.error = v.message; // refused before it is sent: nothing is stored, nothing is applied
      return;
    }
    const next = [...customPalettes().filter((p) => p.id !== v.palette.id), v.palette];
    if (next.length > MAX_CUSTOM) {
      this.error = `אפשר לשמור עד ${MAX_CUSTOM} ערכות מותאמות.`;
      return;
    }
    await this.persist(next, 'הערכה נשמרה', () => (this.draft = null));
  }

  private async removeCustom(id: string) {
    if (this.confirmDelete !== id) {
      this.confirmDelete = id;
      return;
    }
    this.confirmDelete = '';
    await this.persist(customPalettes().filter((p) => p.id !== id), 'הערכה נמחקה');
  }

  private async persist(next: Palette[], done: string, after?: () => void) {
    this.busy = true;
    this.error = '';
    try {
      if (isApi()) {
        const r = await patchSettings({ 'ui.palettes': next as unknown as Record<string, unknown>[] });
        invalidateSettings();
        setCustomPalettes(r.settings['ui.palettes']);
      } else {
        setCustomPalettes(next); // the static demo keeps the list in this browser
      }
      after?.();
      this.flash(done);
    } catch (err) {
      this.error = describeError(err); // the server refused (the same checks): the palette in force stays
    } finally {
      this.busy = false;
    }
  }

  private previewStyle(d: Palette): Record<string, string> {
    try {
      return { ...paletteTokens(d, this.scheme), '--pv-alpha': String(d.schemes[this.scheme].glass.opacity.default) };
    } catch {
      return {};
    }
  }

  render() {
    if (!this.canEdit) return nothing;
    const d = this.draft;
    const list = customPalettes();
    if (!d) {
      return html`<div class="row" data-palette-list>
        <span class="lbl">ערכות מותאמות</span>
        <span class="btns">
          ${list.map(
            (p) => html`<span class="btns" data-palette-custom=${p.id}>
              <sw-button variant="ghost" size="sm" data-palette-edit=${p.id} ?disabled=${this.busy} @click=${() => this.startEdit(p)}>${p.name.he}</sw-button>
              <sw-button variant="ghost" size="sm" icon="trash" data-palette-delete=${p.id} ?disabled=${this.busy} label="מחק" @click=${() => void this.removeCustom(p.id)}>${this.confirmDelete === p.id ? 'לאשר מחיקה' : ''}</sw-button>
            </span>`,
          )}
          <sw-button variant="primary" size="sm" icon="plus" data-palette-new ?disabled=${this.busy || list.length >= MAX_CUSTOM} @click=${() => this.startNew()}>ערכה חדשה</sw-button>
        </span>
        ${this.message ? html`<span class="ok" role="status" data-palette-message>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert" data-palette-error>${this.error}</span>` : nothing}
      </div>`;
    }
    const verdict = validatePalette(d, { custom: true });
    const bad = !verdict.ok;
    const existing = customPalettes().some((p) => p.id === d.id);
    const s = d.schemes[this.scheme];
    return html`<div data-palette-editor style="border-block-end: 1px solid var(--sw-border); padding-block-end: 10px">
      <div class="fields">
        <input type="text" data-palette-name maxlength="40" placeholder="שם הערכה" aria-label="שם הערכה" .value=${d.name.he} @input=${(e: Event) => (this.draft = { ...d, name: { ...d.name, he: (e.target as HTMLInputElement).value } })} />
        ${existing
          ? nothing
          : html`<select data-palette-base aria-label="התחלה מערכה" @change=${(e: Event) => this.rebase((e.target as HTMLSelectElement).value)}>
              <option value="">התחל מ…</option>
              ${allPalettes().map((p) => html`<option value=${p.id}>${p.name.he}</option>`)}
            </select>`}
        <span class="seg" role="group" aria-label="מצב תצוגה">
          <button type="button" data-palette-scheme="light" aria-pressed=${this.scheme === 'light' ? 'true' : 'false'} @click=${() => (this.scheme = 'light')}>בהיר</button>
          <button type="button" data-palette-scheme="dark" aria-pressed=${this.scheme === 'dark' ? 'true' : 'false'} @click=${() => (this.scheme = 'dark')}>כהה</button>
        </span>
      </div>
      <div class="grid" data-palette-colors>
        ${KEY_COLORS.map(
          ([path, name]) => html`<label>${name}<input type="color" data-palette-color=${path} aria-label=${name} .value=${getPath(s, path)} @input=${(e: Event) => this.setColor(path, (e.target as HTMLInputElement).value)} /></label>`,
        )}
      </div>
      ${bad ? html`<div class="err" role="alert" data-palette-invalid>${verdict.message}</div>` : nothing}
      <div class="pv" data-palette-preview style=${styleMap(this.previewStyle(d))}>
        <div class="pv-col">
          <sw-pill variant="slider" icon="light" label="תאורה מרכזית" state="דולק · 72%" .value=${0.72} on .hue=${2} tabindex="-1"></sw-pill>
          <sw-pill variant="toggle" icon="bolt" label="דוד שמש" state="פעיל" on accent .hue=${6} tabindex="-1"></sw-pill>
          <sw-pill variant="toggle" icon="bolt" label="משאבה" state="כבוי" .hue=${4} tabindex="-1"></sw-pill>
        </div>
        <div class="pv-sheet">
          <span class="t">סלון</span>
          <span class="s">3 דולקים · טמפרטורה 23°</span>
          <span class="pv-link">קישור בצבע הדגש</span>
          <span class="pv-states"><b style=${styleMap({ color: 'var(--sw-success-text)' })}>תקין</b><b style=${styleMap({ color: 'var(--sw-warning-text)' })}>אזהרה</b><b style=${styleMap({ color: 'var(--sw-danger-text)' })}>שגיאה</b></span>
          <button type="button" class="pv-btn" tabindex="-1" aria-hidden="true">אישור</button>
        </div>
      </div>
      <div class="btns">
        <sw-button variant="primary" size="sm" icon="check" data-palette-save ?disabled=${this.busy || bad || !d.name.he.trim()} @click=${() => void this.save()}>שמור ערכה</sw-button>
        <sw-button variant="ghost" size="sm" data-palette-cancel ?disabled=${this.busy} @click=${() => { this.draft = null; this.error = ''; }}>ביטול</sw-button>
        ${this.error ? html`<span class="err" role="alert" data-palette-error>${this.error}</span>` : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-palette-editor': SystemPaletteEditor;
  }
}

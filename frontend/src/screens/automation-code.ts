import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { icon } from './automation-builder-icons';
import { editorShared } from './automation-editor-css';
import { lockedLineRanges, scanErrorText, scanJson } from './automation-editor-logic';

/**
 * CR-017 S4: the code view - the second side of the editor's "בונה · קוד" toggle (CR §4.5). In v1 the text is the item's JSON (the wire form;
 * a YAML rendering is a later enhancement). A monospace editor with line numbers; the lines of locked blocks are shaded; a parse error is shown
 * inline (line, column, what was expected) and under the text. Only inside this view do the words JSON / HA internals appear on an operator screen.
 *
 *   .value .locked (fingerprints of the locked blocks) .readonly .chips
 *   code-input {text, ok}   after every edit; `ok` = the text is a JSON object
 */
@customElement('automation-code')
export class AutomationCode extends LitElement {
  @property() value = '';
  @property({ attribute: false }) locked: ReadonlySet<string> = new Set();
  @property({ type: Boolean }) readonly = false;
  @state() private scrollY = 0;
  @query('textarea') private area!: HTMLTextAreaElement;

  static styles = [
    editorShared,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-block-size: 0;
      }
      .card {
        border-radius: var(--dv-radius-sm, 14px);
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-solid, var(--dv-surface));
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .caph {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        padding: 10px 12px;
        border-block-end: 1px solid var(--dv-border);
      }
      .sp {
        flex: 1;
      }
      .wrap {
        position: relative;
        block-size: min(54vh, 520px);
        min-block-size: 220px;
        direction: ltr;
        overflow: hidden;
        background: var(--dv-surface-2);
      }
      .layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .layer .in {
        position: absolute;
        inset-inline: 0;
        inset-block-start: 10px;
      }
      .band {
        position: absolute;
        inset-inline: 0;
        background: color-mix(in srgb, var(--dv-text-2) 14%, transparent);
        border-inline-start: 3px solid var(--dv-text-3);
      }
      .band.err {
        background: color-mix(in srgb, var(--dv-danger) 18%, transparent);
        border-inline-start-color: var(--dv-danger);
      }
      .nums {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 44px;
        overflow: hidden;
        pointer-events: none;
        color: var(--dv-text-3);
        text-align: right;
        font: 12px/20px var(--sw-font-mono, ui-monospace, monospace);
        border-inline-end: 1px solid var(--dv-border);
        background: color-mix(in srgb, var(--dv-surface-3) 60%, transparent);
      }
      .nums .in {
        position: absolute;
        inset-inline: 0;
        inset-block-start: 10px;
        padding-inline-end: 8px;
      }
      textarea {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        margin: 0;
        padding: 10px 12px 10px 56px;
        border: 0;
        outline: none;
        resize: none;
        background: transparent;
        color: var(--dv-text);
        font: 12.5px/20px var(--sw-font-mono, ui-monospace, monospace);
        white-space: pre;
        overflow: auto;
        tab-size: 2;
        direction: ltr;
        text-align: left;
      }
      textarea[readonly] {
        opacity: 0.85;
      }
      .errline {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: var(--dv-danger);
        font-size: 12.5px;
        font-weight: 600;
        padding: 10px 12px;
        border-block-start: 1px solid var(--dv-border);
        background: var(--dv-danger-soft);
      }
      .errline .ic {
        margin-block-start: 2px;
      }
      .note {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        font-size: 12.5px;
        color: var(--dv-text-2);
        line-height: 1.5;
      }
      .note .ic {
        margin-block-start: 3px;
        font-size: 14px;
      }
    `,
  ];

  /** Focus the editor and put the caret at the start of a (0-based) line. */
  focusLine(line: number) {
    const ta = this.area;
    if (!ta) return;
    const at = this.value.split('\n').slice(0, line).reduce((n, l) => n + l.length + 1, 0);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(at, at);
    ta.scrollTop = Math.max(0, line * 20 - 60);
    this.scrollY = ta.scrollTop;
  }

  private onInput(e: Event) {
    const text = (e.target as HTMLTextAreaElement).value;
    this.value = text;
    const s = scanJson(text);
    this.dispatchEvent(new CustomEvent('code-input', { detail: { text, ok: s.ok && s.value !== null && typeof s.value === 'object' && !Array.isArray(s.value) }, bubbles: true, composed: true }));
  }

  render() {
    const lines = this.value.split('\n');
    const scan = scanJson(this.value);
    const bands = lockedLineRanges(this.value, this.locked);
    const errLine = !scan.ok ? scan.line - 1 : -1;
    const notObject = scan.ok && (scan.value === null || typeof scan.value !== 'object' || Array.isArray(scan.value));
    return html`<div class="card">
        <div class="caph"><span class="tag">JSON</span>${this.locked.size ? html`<span class="tag lock">${icon('lock')}${this.locked.size === 1 ? 'חלק נעול' : `${this.locked.size} חלקים נעולים`} · מסומנים</span>` : nothing}<span class="sp"></span><slot name="chips"></slot></div>
        <div class="wrap" data-code-wrap>
          <div class="layer"><div class="in" style=${`transform:translateY(${-this.scrollY}px)`}>
            ${bands.map((b) => html`<div class="band" data-locked-band style=${`inset-block-start:${b.from * 20}px;block-size:${(b.to - b.from + 1) * 20}px`}></div>`)}
            ${errLine >= 0 ? html`<div class="band err" data-error-band style=${`inset-block-start:${errLine * 20}px;block-size:20px`}></div>` : nothing}
          </div></div>
          <div class="nums" aria-hidden="true"><div class="in" style=${`transform:translateY(${-this.scrollY}px)`}>${lines.map((_l, i) => html`<div>${i + 1}</div>`)}</div></div>
          <textarea data-code-text spellcheck="false" aria-label="קוד האוטומציה" ?readonly=${this.readonly} .value=${this.value} @input=${this.onInput} @scroll=${(e: Event) => (this.scrollY = (e.target as HTMLTextAreaElement).scrollTop)}></textarea>
        </div>
        ${!scan.ok ? html`<div class="errline" role="alert" data-code-error>${icon('warning')}<span>${scanErrorText(scan)}</span></div>` : notObject ? html`<div class="errline" role="alert" data-code-error>${icon('warning')}<span>התוכן צריך להיות אובייקט</span></div>` : nothing}
      </div>
      <div class="note"><slot name="note"></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-code': AutomationCode;
  }
}

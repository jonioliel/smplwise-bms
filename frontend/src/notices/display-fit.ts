import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Display } from '../notice-tv/tv-logic';
import { nt } from '../i18n/notices';
import { noticesCss } from './styles';
import {
  PORTRAIT_CHIPS, SAFE_MARGINS, TVFIT_FACTORY, tvFitOwn, tvFitText,
  type PortraitChips, type SafeMargin, type TvFitDefaults, type TvFitKey,
} from './display-fit-model';

const text = (k: TvFitKey, v: PortraitChips | SafeMargin): string => {
  const [key, vars] = tvFitText(k, v);
  return nt(key, vars);
};

/**
 * TV-SETTINGS-2380: the two TV-fit rows of a notice board - "תצוגת אייקוני המבנה במסך אנכי" (portrait_chips) and "שוליים בטוחים בקצוות
 * המסך" (safe_margin, a six-key stepper 0..5: the server takes whole percents only). The same two modes and the same keys look as
 * notice-display-design (the pill-thumb `.seg` of noticesCss):
 *  - `board` (a board's תצוגה tab): the first key "ברירת מחדל" follows the installation default (the patch sends null); a board's own
 *    `0` is a real choice. Sent up as `display-change`; the board's save button stores it.
 *  - `defaults` (the TV defaults card of הגדרות › לוח הודעות): the installation default, sent up as `defaults-change` (saved at once).
 * Neither row is disabled by another setting (they apply to every design; the hints say when they matter).
 */
@customElement('notice-display-fit')
export class NoticeDisplayFit extends LitElement {
  static styles = [noticesCss];

  @property({ attribute: false }) display?: Display;
  @property({ attribute: false }) defaults: TvFitDefaults = TVFIT_FACTORY;
  @property() mode: 'board' | 'defaults' = 'board';

  private emit(key: TvFitKey, value: PortraitChips | SafeMargin | null): void {
    const name = this.mode === 'defaults' ? 'defaults-change' : 'display-change';
    this.dispatchEvent(new CustomEvent(name, { detail: { [key]: value }, bubbles: true, composed: true }));
  }

  private row<K extends TvFitKey>(key: K, seg: string, values: readonly TvFitDefaults[K][], label: string, hint: string) {
    const board = this.mode === 'board';
    const own: TvFitDefaults[K] | null = board ? tvFitOwn(this.display, key) : this.defaults[key];
    const dflt = text(key, this.defaults[key]);
    return html`<div class="fld" data-tv-fit=${key}><span class="lbl">${label}</span>
      <div class="seg" role="group" aria-label=${label} data-seg=${seg}>
        ${board ? html`<button type="button" data-v="default" aria-pressed=${String(own === null)} title=${dflt} @click=${() => this.emit(key, null)}>${nt('tvUseDefault')}</button>` : nothing}
        ${values.map((v) => html`<button type="button" data-v=${String(v)} aria-pressed=${String(own === v)} @click=${() => this.emit(key, v)}>${text(key, v)}</button>`)}</div>
      ${board && own === null ? html`<span class="hint" data-default-note>${nt('tvDefaultNow', { v: dflt })}</span>` : nothing}
      <span class="hint">${hint}</span></div>`;
  }

  render() {
    if (this.mode === 'board' && !this.display) return html``;
    return html`<div class="r" data-tv-fit-rows>
      ${this.row('portrait_chips', 'portrait-chips', PORTRAIT_CHIPS, nt('portraitChipsLabel'), nt('portraitChipsHint'))}
      ${this.row('safe_margin', 'safe-margin', SAFE_MARGINS, nt('safeMarginLabel'), nt('safeMarginHint'))}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-fit': NoticeDisplayFit;
  }
}

import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SAVERS, headerOf, logoLayoutOf, saverOf, type Display, type LogoLayout, type Saver } from '../notice-tv/tv-logic';
import { nt } from '../i18n/notices';
import { noticesCss } from './styles';

/**
 * NOTICESAVER-295: the board's screen saver and logo layout, two segmented choices in the board's תצוגה tab. A choice is sent up as a
 * `display-change` event (the page applies it to its draft and the live preview); the stored keys are `display.saver` and `display.logos`.
 */
@customElement('notice-display-saver')
export class NoticeDisplaySaver extends LitElement {
  static styles = [noticesCss];

  @property({ attribute: false }) display!: Display;

  private emit(patch: Partial<Display>): void {
    this.dispatchEvent(new CustomEvent('display-change', { detail: patch, bubbles: true, composed: true }));
  }

  render() {
    if (!this.display) return html``;
    const sv = saverOf(this.display);
    const lg = logoLayoutOf(this.display);
    const savers: [Saver, string][] = SAVERS.map((s) => [s, nt(`saver_${s}`)]);
    const logos: [LogoLayout, string][] = [['a', nt('logos_a')], ['b', nt('logos_b')], ['c', nt('logos_c')]];
    const oneRow = headerOf(this.display) !== 'c'; // TVOPT-295: the one-row header places both logos itself
    return html`<div class="r">
      <div class="fld"><span class="lbl">${nt('saverLabel')}</span><div class="seg" data-saver-seg>${savers.map(([k, t]) => html`<button data-saver=${k} aria-pressed=${String(sv === k)} @click=${() => this.emit({ saver: k })}>${t}</button>`)}</div></div>
      <div class="fld"><span class="lbl">${nt('logosLabel')}</span><div class="seg" data-logos-seg>${logos.map(([k, t]) => html`<button data-logos=${k} aria-pressed=${String(lg === k)} ?disabled=${oneRow} @click=${() => this.emit({ logos: k })}>${t}</button>`)}</div>
        ${oneRow ? html`<span class="hint">${nt('logosOnlyHeaderC')}</span>` : nothing}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-saver': NoticeDisplaySaver;
  }
}

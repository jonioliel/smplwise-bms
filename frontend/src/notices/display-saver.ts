import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SAVERS, headerOf, logoLayoutOf, saverOf, type Display, type LogoLayout, type Saver } from '../notice-tv/tv-logic';
import { nt } from '../i18n/notices';
import { noticesCss } from './styles';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';

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
      <div class="fld"><span class="lbl">${nt('saverLabel')}</span><sw-segmented data-saver-seg value=${sv} @change=${(e: CustomEvent<SegmentedChange>) => this.emit({ saver: e.detail.value as Saver })}
        .options=${savers.map(([k, t]) => ({ value: k, label: t, attrs: { 'data-saver': k } }))}></sw-segmented></div>
      <div class="fld"><span class="lbl">${nt('logosLabel')}</span><sw-segmented data-logos-seg value=${lg} ?disabled=${oneRow} @change=${(e: CustomEvent<SegmentedChange>) => this.emit({ logos: e.detail.value as LogoLayout })}
        .options=${logos.map(([k, t]) => ({ value: k, label: t, attrs: { 'data-logos': k } }))}></sw-segmented>
        ${oneRow ? html`<span class="hint">${nt('logosOnlyHeaderC')}</span>` : nothing}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-saver': NoticeDisplaySaver;
  }
}

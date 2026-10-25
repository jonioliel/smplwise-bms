import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  HEADERS, NIGHT_LOGOS, SPACE_USES, UPDATED_LINES, headerOf, nightLogoOf, spaceOf, updatedOf,
  type Display, type HeaderLayout, type NightLogo, type SpaceUse, type UpdatedLine,
} from '../notice-tv/tv-logic';
import { nt, type NtKey } from '../i18n/notices';
import { noticesCss } from './styles';

/**
 * TVOPT-295: the four TV screen choices of the owner's one-row header review, segmented choices in the board's תצוגה tab (the same
 * permission as every other screen setting, notices.boards): the header (a / b / c), the "updated" line, what the freed height goes
 * to (only with a one-row header, so it is disabled with "as before") and the company logo on the dark screen. A choice is sent up as
 * a `display-change` event; the stored keys are `display.header`, `display.updated`, `display.space` and `display.night_logo`.
 */
@customElement('notice-display-layout')
export class NoticeDisplayLayout extends LitElement {
  static styles = [noticesCss];

  @property({ attribute: false }) display!: Display;

  private emit(patch: Partial<Display>): void {
    this.dispatchEvent(new CustomEvent('display-change', { detail: patch, bubbles: true, composed: true }));
  }

  private seg<T extends string>(name: string, label: NtKey, keyOf: (v: T) => NtKey, all: T[], cur: T, patch: (v: T) => Partial<Display>, off = false, note: NtKey | '' = '') {
    return html`<div class="fld"><span class="lbl">${nt(label)}</span>
      <div class="seg" data-seg=${name}>${all.map((k) => html`<button data-v=${k} aria-pressed=${String(cur === k)} ?disabled=${off} @click=${() => this.emit(patch(k))}>${nt(keyOf(k))}</button>`)}</div>
      ${off && note ? html`<span class="hint">${nt(note)}</span>` : nothing}</div>`;
  }

  render() {
    if (!this.display) return html``;
    const d = this.display;
    const hd = headerOf(d);
    return html`<div class="r">
        ${this.seg<HeaderLayout>('header', 'headerLabel', (k) => `header_${k}` as NtKey, HEADERS, hd, (k) => ({ header: k }))}
        ${this.seg<UpdatedLine>('updated', 'updatedLabel', (k) => `updated_${k}` as NtKey, UPDATED_LINES, updatedOf(d), (k) => ({ updated: k }))}
      </div>
      <div class="r">
        ${this.seg<SpaceUse>('space', 'spaceLabel', (k) => `space_${k}` as NtKey, SPACE_USES, spaceOf(d), (k) => ({ space: k }), hd === 'c', 'spaceOnlyOneRow')}
        ${this.seg<NightLogo>('night-logo', 'nightLogoLabel', (k) => `nightLogo_${k}` as NtKey, NIGHT_LOGOS, nightLogoOf(d), (k) => ({ night_logo: k }), !d.blocks.company_logo)}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-layout': NoticeDisplayLayout;
  }
}

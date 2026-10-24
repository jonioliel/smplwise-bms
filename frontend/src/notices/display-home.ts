import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { nt } from '../i18n/notices';
import { noticesCss } from './styles';

/**
 * NOTICEPAGE-295: the board setting "ווידג׳ט בבית כשאין הודעות" (`home_empty`): hide the home widget (the default) or show one
 * "no active notices" line. A field of the defaults card of הגדרות › לוח הודעות; the screen saves it through the settings patch
 * (`@home-empty-change`). Kept here so `system-notices.ts` only carries the tag.
 */
@customElement('notice-home-empty')
export class NoticeHomeEmpty extends LitElement {
  static styles = [noticesCss];
  @property() value: 'hide' | 'line' = 'hide';

  render() {
    return html`<div class="fld"><label for="ns-home-empty">${nt('dHomeEmpty')}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${(e: Event) => this.dispatchEvent(new CustomEvent<'hide' | 'line'>('home-empty-change', { detail: (e.target as HTMLSelectElement).value as 'hide' | 'line', bubbles: true, composed: true }))}>
        <option value="hide" ?selected=${this.value === 'hide'}>${nt('dHomeEmptyHide')}</option>
        <option value="line" ?selected=${this.value === 'line'}>${nt('dHomeEmptyLine')}</option></select></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-home-empty': NoticeHomeEmpty;
  }
}

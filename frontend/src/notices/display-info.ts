import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { nt, type NtKey } from '../i18n/notices';

/**
 * NOTICEGB-295 slice B: the chip picker of a board's display tab - which building-status chips (elevators / generator / free parking /
 * gym) the TV footer may show. States only, no details. The server shows a chip only for a kind the installation actually has, so
 * ticking a kind without a module is harmless. Emits `info-change` with the new ordered list; the parent owns the draft and the save.
 */
export const INFO_KINDS = ['elevators', 'generator', 'parking', 'gym'] as const;
const LABEL: Record<(typeof INFO_KINDS)[number], NtKey> = { elevators: 'infoElevators', generator: 'infoGenerator', parking: 'infoParking', gym: 'infoGym' };

@customElement('notice-display-info')
export class NoticeDisplayInfo extends LitElement {
  @property({ attribute: false }) value: string[] = [];

  static styles = css`
    :host { display: block; }
    .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
    .ck { display: inline-flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .sub { display: flex; gap: 8px 16px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  `;

  private toggle(kind: string, on: boolean): void {
    const next = INFO_KINDS.filter((k) => (k === kind ? on : this.value.includes(k)));
    this.dispatchEvent(new CustomEvent<string[]>('info-change', { detail: [...next], bubbles: true, composed: true }));
  }

  protected render() {
    const any = this.value.length > 0;
    return html`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" .checked=${any} @change=${(e: Event) => {
        const on = (e.target as HTMLInputElement).checked;
        this.dispatchEvent(new CustomEvent<string[]>('info-change', { detail: on ? [...INFO_KINDS] : [], bubbles: true, composed: true }));
      }}>${nt('blkInfo')}</label>
      <div class="sub">${INFO_KINDS.map((k) => html`<label class="ck"><input type="checkbox" data-info=${k} .checked=${this.value.includes(k)} @change=${(e: Event) => this.toggle(k, (e.target as HTMLInputElement).checked)}>${nt(LABEL[k])}</label>`)}
        <span>${nt('infoIconsOnly')}</span></div>
    </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'notice-display-info': NoticeDisplayInfo } }

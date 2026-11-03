import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { nt, type NtKey } from '../i18n/notices';
import { nc } from '../i18n/notice-chips';
import { INFO_KINDS, infoRows, moveInfo, needsSource, toggleInfo, type InfoKind, type SourceKind } from './info-chips-model';
import '../components/sw-icon';

/**
 * NOTICEGB-295 slice B: the chip picker of a board's display tab - which building-status chips (elevators / generator / free parking /
 * gym) the TV footer may show. States only, no details. The server shows a chip only for a kind the installation actually has, so
 * ticking a kind without a module is harmless. Emits `info-change` with the new ordered list; the parent owns the draft and the save.
 *
 * TV-CHIPS-2381 (owner 03.11, Q3 = B): the list is ordered - the order on the TV and the priority of the portrait "one row" footer (a
 * healthy chip lower in the list is hidden first). Each picked kind has move up / move down keys. `sources` (the installation's parking /
 * gym sources, Q4 = A): a picked parking or gym kind without a source gets a note that it will not show.
 */
export { INFO_KINDS };
const LABEL: Record<InfoKind, NtKey> = { elevators: 'infoElevators', generator: 'infoGenerator', parking: 'infoParking', gym: 'infoGym' };

@customElement('notice-display-info')
export class NoticeDisplayInfo extends LitElement {
  @property({ attribute: false }) value: string[] = [];
  /** NOTICEPERM-295: show the chips at all (`display.blocks.info_show`); off keeps the picked kinds but the TV asks for none. */
  @property({ type: Boolean }) show = true;
  /** TV-CHIPS-2381: the picked sources of the entity-backed chips (absent = unknown: no note). */
  @property({ attribute: false }) sources: Partial<Record<SourceKind, readonly string[]>> | null = null;

  static styles = css`
    :host { display: block; }
    .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
    .ck { display: inline-flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .help { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .sub { display: flex; gap: 8px 16px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .ord { display: grid; gap: 4px; padding-inline-start: 22px; margin: 0; list-style: none; padding-block: 0; }
    .ord li { display: flex; align-items: center; gap: 6px 10px; flex-wrap: wrap; min-block-size: 32px; }
    .ord .ck { min-inline-size: 120px; }
    .mv { display: inline-grid; place-items: center; inline-size: 28px; block-size: 28px; padding: 0; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md);
      background: var(--sw-surface-2); color: var(--sw-text-2); cursor: pointer; }
    .mv:hover:not(:disabled) { color: var(--sw-text); }
    .mv:disabled { opacity: 0.4; cursor: default; }
    .mv:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
    .mv.up sw-icon { transform: rotate(-90deg); }
    .mv.down sw-icon { transform: rotate(90deg); }
    .note { font-size: var(--sw-fs-xs); color: var(--sw-warning-text); }
    .hint { margin: 0; padding-inline-start: 22px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  `;

  private emit(next: string[]): void {
    this.dispatchEvent(new CustomEvent<string[]>('info-change', { detail: [...next], bubbles: true, composed: true }));
  }

  protected render() {
    const any = this.value.length > 0;
    const rows = infoRows(this.value);
    return html`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" data-info-show .checked=${this.show} @change=${(e: Event) => this.dispatchEvent(new CustomEvent<boolean>('info-show-change', { detail: (e.target as HTMLInputElement).checked, bubbles: true, composed: true }))}>${nt('infoShow')}</label>
      <p class="help" data-info-help>${nt('infoOldBoards')}</p>
      <label class="ck"><input type="checkbox" .checked=${any} @change=${(e: Event) => this.emit((e.target as HTMLInputElement).checked ? [...INFO_KINDS] : [])}>${nt('blkInfo')}</label>
      <ol class="ord" data-info-order>${rows.map((r) => {
        const name = nt(LABEL[r.kind]);
        return html`<li data-info-row=${r.kind} data-on=${String(r.on)}>
          <label class="ck"><input type="checkbox" data-info=${r.kind} .checked=${r.on} @change=${(e: Event) => this.emit(toggleInfo(this.value, r.kind, (e.target as HTMLInputElement).checked))}>${name}</label>
          ${r.on ? html`<button type="button" class="mv up" data-info-up=${r.kind} aria-label=${nc('moveUp', { k: name })} title=${nc('moveUp', { k: name })} ?disabled=${r.pos <= 0}
              @click=${() => this.emit(moveInfo(this.value, r.kind, -1))}><sw-icon name="chevron" size="14"></sw-icon></button>
            <button type="button" class="mv down" data-info-down=${r.kind} aria-label=${nc('moveDown', { k: name })} title=${nc('moveDown', { k: name })} ?disabled=${r.pos >= r.count - 1}
              @click=${() => this.emit(moveInfo(this.value, r.kind, 1))}><sw-icon name="chevron" size="14"></sw-icon></button>` : nothing}
          ${r.on && needsSource(r.kind, this.sources) ? html`<span class="note" data-info-no-source=${r.kind}>${nc('noSource')}</span>` : nothing}
        </li>`;
      })}</ol>
      <p class="hint" data-info-order-hint>${nt('infoIconsOnly')}. ${nc('orderHint')}</p>
    </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'notice-display-info': NoticeDisplayInfo } }

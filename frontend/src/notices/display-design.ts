import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  BOARD_LAYOUTS, CO_SIZES, DESIGNS, NEXT_ROWS, PORTRAIT_ORDERS, TV2_FACTORY, effectiveTv2,
  type Display, type Tv2Defaults,
} from '../notice-tv/tv-logic';
import { nt, type NtKey } from '../i18n/notices';
import { noticesCss } from './styles';

type Key = keyof Tv2Defaults;
const ROWS: { key: Key; seg: string; label: NtKey; values: readonly string[] }[] = [
  { key: 'design', seg: 'design', label: 'designLabel', values: DESIGNS },
  { key: 'board_layout', seg: 'board-layout', label: 'boardLayoutLabel', values: BOARD_LAYOUTS },
  { key: 'co_size', seg: 'co-size', label: 'coSizeLabel', values: CO_SIZES },
  { key: 'portrait_order', seg: 'portrait-order', label: 'portraitOrderLabel', values: PORTRAIT_ORDERS },
  { key: 'next_row', seg: 'next-row', label: 'nextRowLabel', values: NEXT_ROWS },
];
const TEXT: Record<Key, string> = { design: 'design_', board_layout: 'boardLayout_', co_size: 'coSize_', portrait_order: 'portraitOrder_', next_row: 'nextRow_' };
const text = (k: Key, v: string): string => nt(`${TEXT[k]}${v}` as NtKey);

/**
 * BOARDV2-297: the V2 notice board's options (owner 2026-10-26: every V2 choice is a setting) - the design itself (the board as before /
 * V2), the layout (side / strip / slide; the installation value is the default layout), the tenant logo size, the order on a portrait
 * screen and the "next arrivals" row. The same permission as every other screen setting (notices.boards) and the same two modes as
 * notice-display-layout:
 *  - `board` (a board's תצוגה tab): "ברירת מחדל" follows the installation default (the patch sends null); sent up as `display-change`.
 *  - `defaults` (the TV defaults card of הגדרות › לוח הודעות): the installation defaults, sent up as `defaults-change`.
 * On a board, the four V2-only rows are disabled while its effective design is the previous one.
 */
@customElement('notice-display-design')
export class NoticeDisplayDesign extends LitElement {
  static styles = [noticesCss];

  @property({ attribute: false }) display?: Display;
  @property({ attribute: false }) defaults: Tv2Defaults = TV2_FACTORY;
  @property() mode: 'board' | 'defaults' = 'board';

  private emit(key: Key, value: string | null): void {
    const name = this.mode === 'defaults' ? 'defaults-change' : 'display-change';
    this.dispatchEvent(new CustomEvent(name, { detail: { [key]: value }, bubbles: true, composed: true }));
  }

  private row(r: (typeof ROWS)[number], own: string | null, v2: boolean) {
    const board = this.mode === 'board';
    const off = board && r.key !== 'design' && !v2; // the installation defaults stay editable before the switch
    const dflt = text(r.key, this.defaults[r.key]);
    const label = r.key === 'board_layout' && !board ? nt('boardLayoutDefaultLabel') : nt(r.label);
    const note = off ? nt('v2Only') : board && own === null ? nt('tvDefaultNow', { v: dflt }) : '';
    return html`<div class="fld"><span class="lbl">${label}</span>
      <div class="seg" data-seg=${r.seg}>
        ${board ? html`<button data-v="default" aria-pressed=${String(own === null)} ?disabled=${off} title=${dflt} @click=${() => this.emit(r.key, null)}>${nt('tvUseDefault')}</button>` : nothing}
        ${r.values.map((k) => html`<button data-v=${k} aria-pressed=${String(own === k)} ?disabled=${off} @click=${() => this.emit(r.key, k)}>${text(r.key, k)}</button>`)}</div>
      ${note ? html`<span class="hint" data-default-note>${note}</span>` : nothing}</div>`;
  }

  render() {
    const board = this.mode === 'board';
    if (board && !this.display) return html``;
    const d = (this.display ?? {}) as Partial<Record<Key, unknown>>;
    const own = (k: Key): string | null => (board ? ((d[k] as string | null | undefined) ?? null) : this.defaults[k]);
    const eff = board ? effectiveTv2(d, this.defaults) : this.defaults;
    const v2 = eff.design === 'v2';
    const [a, b, c, e, f] = ROWS.map((r) => this.row(r, own(r.key), v2));
    return html`<div class="r" data-tv2>${a}${b}</div><div class="r">${c}${e}</div><div class="r">${f}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-design': NoticeDisplayDesign;
  }
}

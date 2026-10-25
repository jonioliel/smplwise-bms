import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  HEADERS, NIGHT_LOGOS, SPACE_USES, TV_FACTORY, UPDATED_LINES, WEATHER_DAYS, effectiveTv,
  type Display, type TvDefaults,
} from '../notice-tv/tv-logic';
import { nt, type NtKey } from '../i18n/notices';
import { noticesCss } from './styles';

type TvKey = keyof TvDefaults;
type Val = string | number;
const ROWS: { key: TvKey; seg: string; label: NtKey; values: readonly Val[]; text: (v: Val) => string }[] = [
  { key: 'header', seg: 'header', label: 'headerLabel', values: HEADERS, text: (v) => nt(`header_${v}` as NtKey) },
  { key: 'updated', seg: 'updated', label: 'updatedLabel', values: UPDATED_LINES, text: (v) => nt(`updated_${v}` as NtKey) },
  { key: 'space', seg: 'space', label: 'spaceLabel', values: SPACE_USES, text: (v) => nt(`space_${v}` as NtKey) },
  { key: 'night_logo', seg: 'night-logo', label: 'nightLogoLabel', values: NIGHT_LOGOS, text: (v) => nt(`nightLogo_${v}` as NtKey) },
  // owner 2026-10-25: today only, or today and up to 5 days (0 = the forecast row as before)
  { key: 'weather_days', seg: 'weather-days', label: 'weatherDaysLabel', values: WEATHER_DAYS, text: (v) => (v === 0 ? nt('weatherDays_0') : v === 1 ? nt('weatherDays_1') : nt('weatherDays_n', { n: v })) },
];

/**
 * TVOPT-295: the TV screen choices of the owner's one-row header review, as segmented choices (the same permission as every
 * other screen setting, notices.boards): the header (a / b / c), the "updated" line, what the freed height goes to (only with a
 * one-row header), the company logo on the dark screen, and the weather forecast row (as before / today only / 2..5 days).
 *  - mode `board` (a board's תצוגה tab): a first button "ברירת מחדל" follows the installation default (the stored key is removed:
 *    the patch sends null); the others are the board's own value. Sent up as `display-change`.
 *  - mode `defaults` (the TV boards card of הגדרות › לוח הודעות): the installation defaults, sent up as `defaults-change`.
 */
@customElement('notice-display-layout')
export class NoticeDisplayLayout extends LitElement {
  static styles = [noticesCss];

  @property({ attribute: false }) display?: Display;
  @property({ attribute: false }) defaults: TvDefaults = TV_FACTORY;
  @property() mode: 'board' | 'defaults' = 'board';

  private emit(key: TvKey, value: Val | null): void {
    const name = this.mode === 'defaults' ? 'defaults-change' : 'display-change';
    this.dispatchEvent(new CustomEvent(name, { detail: { [key]: value }, bubbles: true, composed: true }));
  }

  private row(r: (typeof ROWS)[number], own: Val | null, effectiveHeader: string, logoOn: boolean, weatherOn: boolean) {
    const board = this.mode === 'board';
    const off = (r.key === 'space' && effectiveHeader === 'c') || (board && r.key === 'night_logo' && !logoOn) || (board && r.key === 'weather_days' && !weatherOn);
    const dflt = r.text(this.defaults[r.key]);
    const note = r.key === 'space' && off ? nt('spaceOnlyOneRow') : board && own === null ? nt('tvDefaultNow', { v: dflt }) : '';
    return html`<div class="fld"><span class="lbl">${nt(r.label)}</span>
      <div class="seg" data-seg=${r.seg}>
        ${board ? html`<button data-v="default" aria-pressed=${String(own === null)} ?disabled=${off} title=${dflt} @click=${() => this.emit(r.key, null)}>${nt('tvUseDefault')}</button>` : nothing}
        ${r.values.map((k) => html`<button data-v=${String(k)} aria-pressed=${String(own === k)} ?disabled=${off} @click=${() => this.emit(r.key, k)}>${r.text(k)}</button>`)}</div>
      ${note ? html`<span class="hint" data-default-note>${note}</span>` : nothing}</div>`;
  }

  render() {
    const board = this.mode === 'board';
    if (board && !this.display) return html``;
    const d = (this.display ?? {}) as Partial<Display>;
    const own = (k: TvKey): Val | null => (board ? ((d[k] as Val | null | undefined) ?? null) : this.defaults[k]);
    const eff = board ? effectiveTv(d, this.defaults) : this.defaults;
    const logoOn = !!d.blocks?.company_logo;
    const weatherOn = !!d.blocks?.weather;
    const [a, b, c, e, w] = ROWS.map((r) => this.row(r, own(r.key), eff.header, logoOn, weatherOn));
    return html`<div class="r">${a}${b}</div><div class="r">${c}${e}</div><div class="r">${w}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-layout': NoticeDisplayLayout;
  }
}

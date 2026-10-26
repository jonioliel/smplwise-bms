import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { transitOf, type TransitGroup, type TransitLayout, type TransitScreen } from '../notice-tv/transit-logic';
import type { Display } from '../notice-tv/tv-logic';
import { transitSettings, type TransitSettings } from '../api/transit';
import { tr } from '../i18n/transit';
import { WINDOWS, WINDOW_RANGE, ROWS_RANGE, DWELL_RANGE, clampInt, screenAfter, toggleStop, windowLabel, windowMode } from '../transit/model';
import { noticesCss } from './styles';

/**
 * BUSTIMES-295: the board's public-transport block (the תצוגה tab): show it or not, which of the installation's stops, one of three layouts,
 * the window (the list or a free value), the rows, the group-by-line choice and, for the rotating slide, its seconds. A choice is sent up as
 * a `display-change` event carrying the WHOLE block (`display.transit`); the page applies it to its draft and the live preview.
 * The stops themselves are set once for the installation in הגדרות › תחבורה ציבורית.
 */
@customElement('notice-display-transit')
export class NoticeDisplayTransit extends LitElement {
  static styles = [
    noticesCss,
    css`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `,
  ];

  @property({ attribute: false }) display!: Display;
  @state() private t: TransitSettings | null = null;
  @state() private failed = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.t = await transitSettings();
    } catch {
      this.failed = true; // no right to read the stops: the block says so below
    }
  }

  private get scr(): TransitScreen {
    return transitOf(this.display);
  }

  private emit(patch: Partial<TransitScreen>): void {
    const configured = (this.t?.config.stops ?? []).map((s) => s.code);
    const next = screenAfter(this.scr, patch, configured);
    this.dispatchEvent(new CustomEvent('display-change', { detail: { transit: next }, bubbles: true, composed: true }));
  }

  render() {
    if (!this.display) return html``;
    const s = this.scr;
    const stops = this.t?.config.stops ?? [];
    const usable = !!this.t?.config.enabled && stops.length > 0;
    const lang = document.documentElement.lang?.startsWith('en') ? 'en' : 'he';
    const layouts: [TransitLayout, string, string][] = [['side', tr('lay_side'), tr('lay_side_hint')], ['strip', tr('lay_strip'), tr('lay_strip_hint')], ['slide', tr('lay_slide'), tr('lay_slide_hint')]];
    const groups: [TransitGroup, string][] = [['auto', tr('grp_auto')], ['always', tr('grp_always')], ['never', tr('grp_never')]];
    const mode = windowMode(s.window_min);
    const picked = s.stops.length ? s.stops : stops.map((x) => x.code);
    return html`<div class="blk" data-transit-block>
      <label class="ck"><input type="checkbox" data-transit-show .checked=${s.enabled} @change=${(e: Event) => this.emit({ enabled: (e.target as HTMLInputElement).checked })}><b>${tr('scrTitle')}</b> - ${tr('scrShow')}</label>
      ${!usable ? html`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed ? tr('forbiddenHint') : tr('scrOffModule')}</span>
        <a href="#/system/transit">${tr('scrGo')}</a></div>` : nothing}
      ${s.enabled && usable ? html`
        <div class="sub" data-transit-stops>
          <span>${tr('scrStops')}</span>
          ${stops.map((st) => html`<label class="ck"><input type="checkbox" data-transit-stop=${st.code} .checked=${picked.includes(st.code)}
            @change=${() => this.emit({ stops: toggleStop(s.stops, st.code, stops.map((x) => x.code)) })}>${st.name || st.catalogue_name || st.code}</label>`)}
          ${s.stops.length === 0 ? html`<span class="hint">${tr('scrStopsAll')}</span>` : nothing}
        </div>
        <div class="sub"><span>${tr('scrLayout')}</span><div class="seg" data-transit-layout>${layouts.map(([k, label, hint]) =>
          html`<button data-layout=${k} title=${hint} aria-pressed=${String(s.layout === k)} @click=${() => this.emit({ layout: k })}>${label}</button>`)}</div></div>
        <div class="sub"><span>${tr('scrWindow')}</span>
          <select class="inp short" data-transit-window .value=${mode === 'list' ? String(s.window_min) : 'free'} @change=${(e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            this.emit({ window_min: v === 'free' ? 45 : Number(v) });
          }}>${WINDOWS.map((w) => html`<option value=${String(w)} ?selected=${mode === 'list' && s.window_min === w}>${windowLabel(w, lang)}</option>`)}
            <option value="free" ?selected=${mode === 'free'}>${tr('scrWindowFree')}</option></select>
          ${mode === 'free' ? html`<input class="inp short num" type="number" data-transit-window-free min=${WINDOW_RANGE[0]} max=${WINDOW_RANGE[1]} step="1" .value=${String(s.window_min)}
            title=${tr('scrFree', { a: WINDOW_RANGE[0], b: WINDOW_RANGE[1] })}
            @change=${(e: Event) => this.emit({ window_min: clampInt((e.target as HTMLInputElement).value, WINDOW_RANGE[0], WINDOW_RANGE[1], s.window_min) })}>` : nothing}
        </div>
        <div class="sub"><span>${tr('scrRows')}</span><input class="inp short num" type="number" data-transit-rows min=${ROWS_RANGE[0]} max=${ROWS_RANGE[1]} step="1" .value=${String(s.rows)}
          @change=${(e: Event) => this.emit({ rows: clampInt((e.target as HTMLInputElement).value, ROWS_RANGE[0], ROWS_RANGE[1], s.rows) })}>
          <span>${tr('scrGroup')}</span><select class="inp" data-transit-group .value=${s.group} @change=${(e: Event) => this.emit({ group: (e.target as HTMLSelectElement).value as TransitGroup })}>
            ${groups.map(([k, label]) => html`<option value=${k} ?selected=${s.group === k}>${label}</option>`)}</select></div>
        ${s.layout === 'slide' ? html`<div class="sub"><span>${tr('scrDwell')}</span><input class="inp short num" type="number" data-transit-dwell min=${DWELL_RANGE[0]} max=${DWELL_RANGE[1]} step="1" .value=${String(s.dwell_s)}
          @change=${(e: Event) => this.emit({ dwell_s: clampInt((e.target as HTMLInputElement).value, DWELL_RANGE[0], DWELL_RANGE[1], s.dwell_s) })}></div>` : nothing}
      ` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-transit': NoticeDisplayTransit;
  }
}

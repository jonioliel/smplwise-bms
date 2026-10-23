import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { emergencyApi, type HistoryPoint, type Verdict } from '../api/emergency';
import { em, type EmKey } from '../i18n/emergency';
import { fmtInstant } from './model';
import { bucketHistory } from './emergency-model';
import { maintCss } from './styles';

const RANGES = [30, 90, 365] as const;
const LOOK: Record<Verdict, string> = { ready: 'ok', ready_with_gaps: 'warn', not_ready: 'alarm' };
/** At most this many bars: the strip always fits the width, it never scrolls. */
const MAX_BARS = 90;

/**
 * CR-EMERG104 (owner q207 c / q284): the readiness history, read only. One strip of bars in the panel, one bar per period, coloured by the WORST
 * verdict of the period (colour plus the word in the tooltip and in the legend). Fits the viewport; nothing scrolls as a page.
 */
@customElement('emergency-history-panel')
export class EmergencyHistoryPanel extends LitElement {
  @state() private points: HistoryPoint[] | null = null;
  @state() private keep = 365;
  @state() private days = 90;
  @state() private error = '';

  static styles = [maintCss, css`
    :host { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 14px; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; padding: 14px; gap: 12px; }
    .strip { flex: 1; min-block-size: 80px; display: flex; align-items: stretch; gap: 2px; }
    .bar { flex: 1 1 0; min-inline-size: 2px; border-radius: 2px; background: var(--c); }
    [data-look='ok'] { --c: var(--sw-success); }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    .axis { display: flex; justify-content: space-between; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .legend { display: flex; gap: 16px; flex-wrap: wrap; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .legend i { display: inline-block; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c); margin-inline-end: 6px; }
    .ctl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const r = await emergencyApi.history(this.days);
      this.points = r.points;
      this.keep = r.keep_days;
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  render() {
    if (this.error && !this.points) return html`<sw-state-panel state="error" heading=${em('errTitle')} hint=${this.error} data-state="error"></sw-state-panel>`;
    if (!this.points) return html`<div class="skl" aria-busy="true" aria-label=${em('loading')}></div>`;
    const bars = bucketHistory(this.points, MAX_BARS);
    const ranges = RANGES.filter((d) => d <= this.keep);
    return html`<div class="panel flush fill" data-emerg-history>
      <div class="ctl"><span class="hint mut">${em('hRange')}</span><div class="seg" role="group">${ranges.map((d) => html`<button type="button" aria-pressed=${String(this.days === d)} data-emerg-range=${d}
        @click=${() => { this.days = d; void this.load(); }}>${em('hDays', { n: d })}</button>`)}</div>
        <span class="mut">${bars.length ? em('hSummary', { n: this.points.length }) : ''}</span></div>
      ${bars.length ? html`<div class="strip" role="img" aria-label=${em('viewHistory')}>${bars.map((b) => html`<span class="bar" data-look=${LOOK[b.verdict]} data-verdict=${b.verdict}
          title=${`${fmtInstant(b.at)} - ${em(`verdict_${b.verdict}` as EmKey)}`}></span>`)}</div>
        <div class="axis"><span>${fmtInstant(bars[0].at, false)}</span><span>${fmtInstant(bars[bars.length - 1].at, false)}</span></div>`
        : html`<div class="nomatch" data-emerg-history-empty>${em('hEmpty')}</div>`}
      <div class="legend">${(['ready', 'ready_with_gaps', 'not_ready'] as Verdict[]).map((v) => html`<span data-look=${LOOK[v]}><i></i>${em(`verdict_${v}` as EmKey)}</span>`)}</div>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'emergency-history-panel': EmergencyHistoryPanel;
  }
}

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { getExplanation, type Explanation } from '../api/temperature';
import { tempCss } from './styles';
import { tt } from '../i18n/temperature';
import { CONF_KEY, CONF_TONE, FACTOR_ICON as ICON, factorText, num as n } from './explain-model';

export { factorText } from './explain-model';

/**
 * TEMPEXPLAIN093-295 (board row r093): "why did it warm?" - the rule-based explanation of one excursion inside the unit's detail. The
 * factors come from the stored signals (door, defrost, mains outage, compressor power, data gaps, spikes, neighbouring units, maintenance,
 * a climate unit's mode / setpoint), strongest first, each with its evidence in words and a score bar. Read only; no external model.
 */
@customElement('temp-explain')
export class TempExplain extends LitElement {
  @property() unitId = '';
  @property() eventId = '';
  @state() private data: Explanation | null = null;
  @state() private err = '';
  private loadedFor = '';

  static styles = [tempCss, css`
    :host { display: block; }
    .ph { display: flex; align-items: center; gap: 8px; margin-block-end: 8px; }
    .ph h4 { flex: 1; margin: 0; }
    .fx { display: grid; gap: 8px; }
    .f { display: grid; grid-template-columns: auto minmax(0, 1fr) 44px; gap: 10px; align-items: center; font-size: var(--sw-fs-sm); }
    .f > span { min-inline-size: 0; overflow-wrap: anywhere; }
    .f .bar { block-size: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); overflow: hidden; }
    .f .bar i { display: block; block-size: 100%; background: var(--tc-acc); }
    .f[data-primary] { font-weight: var(--sw-fw-semibold); }
    .f[data-primary] .bar i { background: var(--tc-warn); }
    .ft { margin: 8px 0 0; font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
  `];

  protected updated() {
    const key = `${this.unitId}|${this.eventId}`;
    if (this.unitId && this.eventId && key !== this.loadedFor) {
      this.loadedFor = key;
      this.data = null;
      this.err = '';
      void getExplanation(this.unitId, { eventId: this.eventId }).then((d) => { if (this.loadedFor === key) this.data = d; }).catch((e) => { if (this.loadedFor === key) this.err = describeError(e); });
    }
  }

  render() {
    const d = this.data;
    const close = html`<button type="button" class="btn sm ghost" aria-label=${tt('close')} data-why-close @click=${() => this.dispatchEvent(new CustomEvent('close'))}><sw-icon name="close" size="14"></sw-icon></button>`;
    if (this.err) return html`<div class="panel" data-temp-why="error"><div class="ph"><h4>${tt('whyTitle')}</h4>${close}</div><p class="err" role="alert">${this.err}</p></div>`;
    if (!d) return html`<div class="panel" data-temp-why="loading"><div class="ph"><h4>${tt('whyTitle')}</h4>${close}</div><div class="skl" style="block-size:64px"></div></div>`;
    return html`<div class="panel" data-temp-why=${d.confidence}>
      <div class="ph"><h4>${tt('whyTitle')}</h4><span class="chip" data-tone=${CONF_TONE[d.confidence]}>${tt(CONF_KEY[d.confidence])}</span>${close}</div>
      ${d.factors.length ? html`<div class="fx">${d.factors.map((f) => html`<div class="f" data-factor=${f.key} ?data-primary=${f.key === d.primary}>
          <sw-icon name=${ICON[f.key] ?? 'info'} size="14"></sw-icon><span>${factorText(f, d.kind)}</span><div class="bar" aria-label=${tt('whyScore', { s: f.score })}><i style=${`inline-size:${f.score}%`}></i></div></div>`)}</div>`
        : html`<p class="hint" style="margin:0">${tt(d.reason === 'no_samples' ? 'whyNoSamples' : 'whyNone')}</p>`}
      <p class="ft">${tt('whyRule')}${d.profile?.rate_h != null ? ` · ${tt('whyRate', { r: n(d.profile.rate_h, 1) })}` : ''}</p></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-explain': TempExplain;
  }
}

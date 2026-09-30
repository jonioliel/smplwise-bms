import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import { describeError, patch } from '../api/client';
import { getSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { DIRECTION_DEFAULT, DIRECTION_LABEL, DIRECTION_LETTER, DIRECTIONS, homeSettingsOf, SIDE_LABEL, SIDES, type Direction, type Side } from '../api/home';

/** A schematic of each direction (the mockup's three layouts): the widgets in the accent colour, the summary tiles, the floors. */
function thumb(d: Direction, side: Side): TemplateResult {
  const w = (x: number, y: number, ww: number, hh: number, cls = 'wg') => svg`<rect class=${cls} x=${x} y=${y} width=${ww} height=${hh} rx="3"/>`;
  const kpis = (x: number, y: number, ww: number) => svg`${[0, 1, 2, 3, 4, 5].map((i) => w(x + (i * ww) / 6, y, ww / 6 - 2, 7, 'kp'))}`;
  if (d === 'a') {
    return svg`${w(4, 4, 30, 22)}${w(37, 4, 30, 22)}${w(70, 4, 22, 22)}${w(95, 4, 21, 22)}${kpis(4, 30, 112)}
      ${w(4, 41, 24, 34, 'fl')}${w(31, 41, 42, 34, 'fl')}${w(76, 41, 40, 34, 'fl')}`;
  }
  if (d === 'b') {
    const sx = side === 'end' ? 4 : 84;
    const mx = side === 'end' ? 38 : 4;
    return svg`${kpis(mx, 4, 78)}${w(sx, 4, 32, 14)}${w(sx, 21, 32, 22)}${w(sx, 46, 32, 12)}${w(sx, 61, 32, 14)}
      ${w(mx, 15, 34, 28, 'fl')}${w(mx + 38, 15, 40, 28, 'fl')}${w(mx, 46, 78, 29, 'fl')}`;
  }
  return svg`${w(4, 4, 28, 14)}${w(35, 4, 28, 14)}${w(66, 4, 24, 14)}${w(93, 4, 23, 14)}${kpis(4, 22, 112)}
    ${w(4, 34, 34, 41, 'fl')}${w(41, 34, 34, 41, 'fl')}${w(78, 34, 38, 41, 'fl')}`;
}

/**
 * הגדרות › חשמל והתקנים › מסך ראשי (home redesign, owner decisions 2026-09-30): the installation's direction of the home
 * screen - a: מרכז בקרה (the default), b: לוח צד, c: מצומצם - each with a live preview thumbnail, and the side of b's column.
 * Applies to everyone without a personal choice (החשבון שלי › המסך שלי, for a holder of screen.personalize). The widgets
 * themselves - which, how big, in what order, fed by which entity - are edited on the screen ("עריכת המסך הראשי" of the user
 * menu). Saved at once (system.configure, audited); read-only for anyone else.
 */
@customElement('system-home-screen')
export class SystemHomeScreen extends LitElement {
  @state() private direction: Direction = DIRECTION_DEFAULT;
  @state() private side: Side = 'end';
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';

  static styles = css`
    :host {
      display: block;
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }
    button.opt {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 2px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
    }
    button.opt[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    button.opt:disabled {
      cursor: default;
      opacity: 0.75;
    }
    button.opt:focus-visible,
    .seg button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    svg.thumb {
      inline-size: 100%;
      block-size: auto;
      aspect-ratio: 120 / 80;
      background: var(--sw-bg);
      border: 1px solid var(--sw-border);
      border-radius: 8px;
    }
    svg.thumb .wg {
      fill: var(--sw-accent);
      opacity: 0.85;
    }
    svg.thumb .kp {
      fill: var(--sw-border-strong);
    }
    svg.thumb .fl {
      fill: var(--sw-surface-3);
      stroke: var(--sw-border-strong);
      stroke-width: 0.6;
    }
    .cap {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .cap .let {
      color: var(--sw-accent-text);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: 12px;
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      min-block-size: 34px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      border-radius: 9px;
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    void getSettings()
      .then((r) => {
        this.canEdit = r.can_edit;
        const h = homeSettingsOf(r.settings as unknown as Record<string, unknown>);
        this.direction = h.direction;
        this.side = h.side;
      })
      .catch(() => undefined);
  }

  private async save(change: { direction?: Direction; side?: Side }) {
    if (!this.canEdit || this.busy) return;
    const before = { direction: this.direction, side: this.side };
    this.direction = change.direction ?? this.direction;
    this.side = change.side ?? this.side;
    this.busy = true;
    this.error = '';
    try {
      const body: Record<string, string> = {};
      if (change.direction) body['home.direction'] = change.direction;
      if (change.side) body['home.side'] = change.side;
      await patch('settings', body);
      invalidateSettings();
      this.message = 'המסך הראשי נשמר';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.direction = before.direction;
      this.side = before.side;
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const ro = !this.canEdit || !isApi();
    return html`<sw-card heading="מסך ראשי" subheading="הכיוון של מסך ״ראשי״ לכל המשתמשים במתקן" data-home-screen-settings>
      <div class="opts" role="group" aria-label="כיוון המסך הראשי">
        ${DIRECTIONS.map(
          (d) => html`<button type="button" class="opt" data-home-dir-option=${d} aria-pressed=${String(this.direction === d)} ?disabled=${ro || this.busy} @click=${() => void this.save({ direction: d })}>
            <svg class="thumb" viewBox="0 0 120 80" aria-hidden="true" data-home-dir-thumb=${d}>${thumb(d, this.side)}</svg>
            <span class="cap"><span class="let">${DIRECTION_LETTER[d]}</span>${DIRECTION_LABEL[d]}</span>
          </button>`,
        )}
      </div>
      ${this.direction === 'b'
        ? html`<div class="row"><span>צד הלוח</span><span class="seg" role="group" aria-label="צד הלוח">${SIDES.map((s) => html`<button type="button" data-home-side-option=${s} aria-pressed=${String(this.side === s)} ?disabled=${ro || this.busy} @click=${() => void this.save({ side: s })}>${SIDE_LABEL[s]}</button>`)}</span></div>`
        : nothing}
      <div class="row">
        <sw-button size="sm" icon="edit" data-home-edit-link @click=${() => (location.hash = '#/devices/building?edit=1')} ?disabled=${ro}>עריכת המסך הראשי</sw-button>
        ${this.message ? html`<span class="ok" role="status" data-home-message>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
        ${ro ? html`<span class="muted">${isApi() ? 'שינוי ההגדרות דורש הרשאת מנהל מערכת.' : 'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.'}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-home-screen': SystemHomeScreen;
  }
}

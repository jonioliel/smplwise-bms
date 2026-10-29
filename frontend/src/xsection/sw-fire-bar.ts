import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { xt } from '../i18n/xsection';
import { xi } from './xs-icons';
import { acknowledgeFire, fireAck, fireReport, floorName, onFire } from './fire-store';
import { ACK_HOLD_MS, alarmFloors, mayAcknowledge, xsOptions, onXsOptions, type XsOptions } from './xs-model';
import { can, session } from '../api/session';
import { navigate } from '../router';

/**
 * The acknowledge control of a fire alarm (owner decision 9 and 10): a long press of 1.2 seconds (default; a press then "Yes, received" and a single
 * press are the other settings), only for who the setting allows (by default the separate permission `fire.acknowledge`). It records "who and
 * when" in this tab and NEVER resets the alarm: the reset stays at the fire panel. Keyboard: hold Space or Enter. Emits `acked`.
 */
@customElement('sw-ack-button')
export class SwAckButton extends LitElement {
  @property() mode: XsOptions['ack'] = 'hold';
  @property({ type: Boolean }) allowed = true;
  @state() private holding = false;
  @state() private confirming = false;
  private timer = 0;

  static styles = css`
    :host { display: inline-block; }
    button { position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 6px; min-block-size: 40px; padding: 0 14px; border-radius: 999px; border: 0; font: inherit; font-weight: 700; color: var(--sw-danger-text, #be123c); background: #fff; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    button.ghost { background: transparent; color: #fff; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.7); }
    .fill { position: absolute; inset: 0; transform-origin: inline-start; transform: scaleX(0); background: color-mix(in srgb, var(--sw-danger, #be123c) 22%, #fff); pointer-events: none; }
    .holding .fill { transform: scaleX(1); transition: transform ${ACK_HOLD_MS}ms linear; }
    .xi { inline-size: 16px; block-size: 16px; flex: none; position: relative; }
    span.t { position: relative; }
    :focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  `;

  private done() {
    this.clear();
    this.dispatchEvent(new CustomEvent('acked', { bubbles: true, composed: true }));
  }
  private clear() {
    window.clearTimeout(this.timer);
    this.holding = false;
  }
  private start() {
    if (!this.allowed || this.holding) return;
    this.holding = true;
    this.timer = window.setTimeout(() => this.done(), ACK_HOLD_MS);
  }

  disconnectedCallback() {
    window.clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  render() {
    if (this.mode === 'confirm' && this.confirming) {
      return html`<button data-ack-yes ?disabled=${!this.allowed} @click=${() => { this.confirming = false; this.done(); }}>${xi('check')}<span class="t">${xt('fireAckYes')}</span></button>
        <button class="ghost" data-ack-no @click=${() => (this.confirming = false)}><span class="t">${xt('fireAckNo')}</span></button>`;
    }
    if (this.mode === 'confirm') return html`<button data-ack-btn ?disabled=${!this.allowed} @click=${() => (this.confirming = true)}>${xi('check')}<span class="t">${xt('fireAckConfirm')}</span></button>`;
    if (this.mode === 'tap') return html`<button data-ack-btn ?disabled=${!this.allowed} @click=${() => this.done()}>${xi('check')}<span class="t">${xt('fireAckOne')}</span></button>`;
    return html`<button data-ack-hold class=${this.holding ? 'holding' : ''} ?disabled=${!this.allowed} aria-label=${xt('fireAck')} title=${this.allowed ? '' : xt('fireAckNoRight')}
      @pointerdown=${(e: PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); this.start(); }} @pointerup=${() => this.clear()} @pointercancel=${() => this.clear()} @pointerleave=${() => this.clear()}
      @contextmenu=${(e: Event) => e.preventDefault()}
      @keydown=${(e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); this.start(); } }} @keyup=${(e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') this.clear(); }} @blur=${() => this.clear()}>
      <span class="fill"></span>${xi('check')}<span class="t">${this.holding ? xt('fireAckHolding') : xt('fireAck')}</span></button>`;
  }
}

/** Who the acknowledgement is recorded for: the signed-in user's display name (the static demo: a fixed demo name). */
export function ackName(): string {
  return session.me?.user.display_name || session.me?.user.username || 'DEMO';
}

/** The setting-aware right to acknowledge. */
export function mayAck(o: Pick<XsOptions, 'ack_who'> = xsOptions()): boolean {
  return mayAcknowledge(o.ack_who, can) || session.mode !== 'api';
}

/**
 * The red alarm bar on every screen (owner decision 11, option A; sound is to be specified later and is NOT here). Drawn only while the off-by-default
 * option `fire_ui` is on AND a fire report holds an alarm - today that is the labelled demo only, since no fire-detection integration exists.
 */
@customElement('sw-fire-bar')
export class SwFireBar extends LitElement {
  /** `home` = the screen is Home or the synoptic map (the option "only there" still shows the bar). */
  @property({ type: Boolean }) home = true;
  private stop: Array<() => void> = [];

  static styles = css`
    :host { display: contents; }
    .bar { position: fixed; inset-block-start: 0; inset-inline: 0; z-index: 2147483000; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 14px calc(8px) 14px; padding-block-start: max(8px, env(safe-area-inset-top)); background: var(--sw-danger, #be123c); color: #fff; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3); font-size: 14px; }
    .bar.ackd { background: color-mix(in srgb, var(--sw-danger, #be123c) 80%, #000); }
    .ico { display: grid; place-items: center; inline-size: 32px; block-size: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); flex: none; }
    .xi { inline-size: 18px; block-size: 18px; }
    .tx { min-inline-size: 0; flex: 1 1 220px; display: flex; flex-direction: column; gap: 1px; }
    .tx b { font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tx span { opacity: 0.95; overflow-wrap: anywhere; }
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; background: repeating-linear-gradient(135deg, transparent 0 5px, rgba(255, 255, 255, 0.35) 5px 6px), rgba(0, 0, 0, 0.25); font-size: 11.5px; font-weight: 700; }
    .ac { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .lnk { min-block-size: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.7); color: #fff; font: inherit; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .lnk .xi { inline-size: 16px; block-size: 16px; }
    :focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    @media (prefers-reduced-motion: no-preference) { .ico { animation: pulse 1.6s ease-in-out infinite; } }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.5); } 50% { box-shadow: 0 0 0 7px rgba(255, 255, 255, 0); } }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stop.push(onFire(() => this.requestUpdate()), onXsOptions(() => this.requestUpdate()));
  }
  disconnectedCallback() {
    this.stop.forEach((s) => s());
    this.stop = [];
    super.disconnectedCallback();
  }

  render() {
    const o = xsOptions();
    const rep = fireReport();
    const ids = o.fire_ui ? alarmFloors(rep) : [];
    if (!ids.length) return nothing;
    if (o.alarm_bar === 'home' && !this.home) return nothing;
    const id = ids[0];
    const f = rep.floors[id];
    const ack = fireAck();
    const where = xt('fireBarWhere', { zone: f.zone ?? '', device: f.device ?? '', time: f.time ?? '' });
    return html`<div class="bar ${ack ? 'ackd' : ''}" role="alert" data-fire-bar>
      <span class="ico">${xi('flame')}</span>
      <span class="tx"><b>${ack ? xt('fireAcked', { who: ack.who }).split(' · ')[0] : xt('fireBarTitle')} · ${floorName(id)}${rep.demo ? html`<span class="tag" data-fire-demo>${xt('fireBarDemo')}</span>` : nothing}${ids.length > 1 ? html` <span>(+${ids.length - 1})</span>` : nothing}</b>
        <span>${ack ? xt('fireAcked', { who: ack.who }) : where}</span></span>
      <span class="ac">
        ${ack ? nothing : html`<sw-ack-button .mode=${o.ack} .allowed=${mayAck(o)} @acked=${() => acknowledgeFire(ackName())}></sw-ack-button>`}
        <button class="lnk" data-fire-open @click=${() => navigate(`/explore/floors/${id}`)}>${xi('map')}${xt('fireOpenFloor')}</button>
      </span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-ack-button': SwAckButton;
    'sw-fire-bar': SwFireBar;
  }
}

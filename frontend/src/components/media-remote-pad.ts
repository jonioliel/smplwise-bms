import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { KeyId } from '../api/media-screens';
import { ICON, KEY_LABEL } from './media-remote-keys';
import { KeyPress } from './media-remote-press';

/**
 * The remote's d-pad (concentric: four arrows round a round OK) and its alternative, the touchpad (swipe = an arrow, tap =
 * OK). Both send ONLY d-pad keys (`up down left right ok`) - there is no other key and never a power key. The pad is never
 * mirrored by RTL: "left" is the left of the screen in every language (video / map / remote geometry are not mirrored).
 *
 * Draws only the keys the screen's `keys` list holds. Events: `mr-key` { key } for every press and every 200 ms repeat
 * while an arrow is held (HoldRepeater, stops on release; the parent owns the rate gate and the send).
 */
@customElement('media-remote-pad')
export class MediaRemotePad extends LitElement {
  /** `caps.keys` of the screen. */
  @property({ attribute: false }) keys: KeyId[] = [];
  @property({ reflect: true }) mode: 'dpad' | 'touch' = 'dpad';
  @property({ type: Boolean, reflect: true }) disabled = false;

  private readonly press = new KeyPress((key) => this.send(key));
  private touchStart: { x: number; y: number } | null = null;
  /* the tokens (--mr-*) come from the remote that holds this pad (media-remote-css.ts): a pad never sets its own,
     so the remote's light / dark scheme reaches it by inheritance */
  static styles = css`
      :host {
        display: block;
        direction: ltr; /* the pad is geometry: never mirrored */
        inline-size: var(--mr-dpad-size);
        block-size: var(--mr-dpad-size);
        -webkit-touch-callout: none;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
      }
      :host([disabled]) {
        pointer-events: none;
      }
      .dpad {
        position: relative;
        inline-size: var(--mr-dpad-size);
        block-size: var(--mr-dpad-size);
        border-radius: 50%;
        background: var(--mr-dpad-ring);
        box-shadow: var(--mr-dpad-shadow);
      }
      .dpad::before {
        content: '';
        position: absolute;
        inset: 9px;
        border-radius: 50%;
        border: 1px solid var(--mr-border);
        pointer-events: none;
      }
      .dpad::after {
        content: '';
        position: absolute;
        inset: calc(50% - var(--mr-ok-size) * 0.625);
        border-radius: 50%;
        box-shadow: var(--mr-dpad-groove);
        pointer-events: none;
      }
      .dk {
        position: absolute;
        inline-size: 64px;
        block-size: 64px;
        border-radius: 50%;
        border: 0;
        padding: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--mr-text-2);
        transition: color 160ms, background 240ms var(--mr-ease);
        z-index: 1;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .dk svg {
        inline-size: 24px;
        block-size: 24px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .dk.up { inset-block-start: 6px; inset-inline-start: calc(50% - 32px); }
      .dk.down { inset-block-end: 6px; inset-inline-start: calc(50% - 32px); }
      .dk.left { inset-inline-start: 6px; inset-block-start: calc(50% - 32px); }
      .dk.right { inset-inline-end: 6px; inset-block-start: calc(50% - 32px); }
      .dk:hover {
        color: var(--mr-text);
      }
      .dk:active,
      .dk.hit {
        color: var(--mr-accent);
        background: radial-gradient(circle, var(--mr-accent-soft) 0, transparent 70%);
      }
      .ok {
        position: absolute;
        inset: 0;
        margin: auto;
        inline-size: var(--mr-ok-size);
        block-size: var(--mr-ok-size);
        border-radius: 50%;
        border: 0;
        padding: 0;
        background: var(--mr-ok-bg);
        color: var(--mr-text);
        font: inherit;
        font-weight: 700;
        font-size: var(--sw-fs-xl);
        letter-spacing: 0.06em;
        box-shadow: var(--mr-key-shadow), 0 10px 22px rgba(0, 0, 0, 0.1);
        z-index: 2;
        cursor: pointer;
        transition: transform 120ms var(--mr-ease), box-shadow 240ms var(--mr-ease), color 200ms;
        -webkit-tap-highlight-color: transparent;
      }
      .ok:active,
      .ok.hit {
        transform: scale(0.95);
        color: var(--mr-accent);
        box-shadow: var(--mr-key-shadow), 0 0 0 6px var(--mr-accent-soft), 0 0 30px var(--mr-accent-glow);
      }
      .dk:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: -6px;
      }
      .ok:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 3px;
      }
      .tpad {
        position: relative;
        inline-size: var(--mr-dpad-size);
        block-size: var(--mr-dpad-size);
        border-radius: 34px;
        background: var(--mr-dpad-ring);
        box-shadow: var(--mr-dpad-groove), 0 0 0 1px var(--mr-border);
        display: grid;
        place-items: center;
        color: var(--mr-text-2);
        font-size: var(--sw-fs-sm);
        touch-action: none;
        cursor: grab;
      }
      .tpad:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 3px;
      }
      .tpad .hint {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .tpad .hint svg {
        inline-size: 26px;
        block-size: 26px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .tpad .fx {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--mr-accent);
        opacity: 0;
        transition: opacity 220ms;
        font-weight: 700;
        font-size: var(--sw-fs-3xl);
        pointer-events: none;
      }
      .tpad .fx svg {
        inline-size: 44px;
        block-size: 44px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .tpad .fx.show {
        opacity: 1;
        transition: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .dk,
        .ok,
        .tpad .fx {
          transition-duration: 0.01ms;
        }
      }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.press.stopAll();
  }

  /** The parent's `visibilitychange` / close: no hold may outlive the remote. */
  stop(): void {
    this.press.stopAll();
  }

  private send(key: KeyId) {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('mr-key', { detail: { key }, bubbles: true, composed: true }));
    this.flashKey(key);
    try {
      navigator.vibrate?.(8);
    } catch {
      /* no haptics here */
    }
  }

  private flashKey(key: KeyId) {
    const el = this.renderRoot.querySelector<HTMLElement>(`[data-k="${key}"]`);
    if (!el) return;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
    window.setTimeout(() => el.classList.remove('hit'), 180);
  }

  private has = (k: KeyId) => this.keys.includes(k);

  private arrow(key: 'up' | 'down' | 'left' | 'right') {
    if (!this.has(key)) return nothing;
    return html`<button type="button" class="dk ${key}" data-k=${key} aria-label=${KEY_LABEL[key]}
      @pointerdown=${(e: PointerEvent) => this.press.down(e, key)} @pointerup=${() => this.press.up()} @pointercancel=${() => this.press.up()} @pointerleave=${() => this.press.up()} @blur=${() => this.press.up()}
      @keydown=${(e: KeyboardEvent) => this.press.keyDown(e, key)} @keyup=${(e: KeyboardEvent) => this.press.keyUp(e, key)} @click=${(e: MouseEvent) => this.press.click(e, key)}
      @contextmenu=${(e: Event) => e.preventDefault()}><svg viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(ICON[key])}</svg></button>`;
  }

  // --- touchpad: a swipe is an arrow, a tap is OK; the keyboard reaches the same keys with the arrows and Enter

  private onTouchDown = (e: PointerEvent) => {
    this.touchStart = { x: e.clientX, y: e.clientY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
  };

  private onTouchUp = (e: PointerEvent) => {
    const s = this.touchStart;
    this.touchStart = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const key = this.swipeKey(dx, dy);
    if (key && this.has(key)) this.touchFx(key);
  };

  /** The key of a swipe: shorter than 14 px is a tap (OK); else the dominant axis. Screen directions, never mirrored. */
  private swipeKey(dx: number, dy: number): KeyId | null {
    if (Math.hypot(dx, dy) < 14) return 'ok';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  private touchFx(key: KeyId) {
    this.send(key);
    const fx = this.renderRoot.querySelector<HTMLElement>('.fx');
    if (!fx) return;
    fx.innerHTML = key === 'ok' ? 'OK' : `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[key]}</svg>`;
    fx.classList.add('show');
    window.setTimeout(() => fx.classList.remove('show'), 60);
  }

  private onTouchKey = (e: KeyboardEvent) => {
    const map: Record<string, KeyId> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok' };
    const key = map[e.key];
    if (!key || !this.has(key)) return;
    e.preventDefault();
    e.stopPropagation(); // the remote's own global handler must not send it a second time
    if (!e.repeat) this.touchFx(key);
  };

  render() {
    if (this.mode === 'touch') {
      return html`<div class="tpad" tabindex="0" role="application" aria-label="משטח מגע: החלקה לכיוון, הקשה לאישור"
        @pointerdown=${this.onTouchDown} @pointerup=${this.onTouchUp} @pointercancel=${() => (this.touchStart = null)} @keydown=${this.onTouchKey}>
        <span class="hint"><svg viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(ICON.touch)}</svg><span>החלקה · הקשה</span></span><span class="fx" aria-hidden="true"></span></div>`;
    }
    return html`<div class="dpad" role="group" aria-label="חצים">
      ${this.arrow('up')}${this.arrow('left')}
      ${this.has('ok')
        ? html`<button type="button" class="ok" data-k="ok" aria-label=${KEY_LABEL.ok}
            @pointerdown=${(e: PointerEvent) => this.press.down(e, 'ok')} @pointerup=${() => this.press.up()} @pointercancel=${() => this.press.up()} @pointerleave=${() => this.press.up()} @blur=${() => this.press.up()}
            @keydown=${(e: KeyboardEvent) => this.press.keyDown(e, 'ok')} @keyup=${(e: KeyboardEvent) => this.press.keyUp(e, 'ok')} @click=${(e: MouseEvent) => this.press.click(e, 'ok')}
            @contextmenu=${(e: Event) => e.preventDefault()}>OK</button>`
        : nothing}
      ${this.arrow('right')}${this.arrow('down')}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-remote-pad': MediaRemotePad;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import './sw-cast-stop';
import { castExtend, castSwitch } from '../api/cast';
import { describeError } from '../api/client';
import { listCameras } from '../api/maps';
import type { Camera } from '../api/types';
import { CastWatch, castStore } from './cast-store';
import { canExtend, extendLimitReached, isLow, leftText, openSessions, pillLabel } from '../screens/cast-logic';
import { t } from '../i18n/he';

/**
 * CR-028: the global "משדר N" pill, one in the action row of every screen (owner Q9 A) - the floating corner of the shell. It exists only while a cast
 * is open for this person (the sessions the server lets them see), shows the countdown of the soonest, and opens the tray: per session the screen, the
 * camera, the time left, "האריכו" (the server allows up to 8; at the limit the button says why), "החלף מצלמה" and the stop with its power-off question.
 * The list follows the `cast_sessions_changed` live-window event through the shared store (no polling), the clock ticks locally.
 */
@customElement('sw-cast-pill')
export class SwCastPill extends LitElement {
  /** Remote (/arx): the same controls (start / extend / switch / stop work remotely). */
  @property({ type: Boolean }) remote = false;
  @state() private openTray = false;
  @state() private errors: Record<string, string> = {};
  @state() private busy = '';
  @state() private picking = '';
  @state() private cams: Camera[] = [];
  private watch = new CastWatch(this);
  private onDoc = (e: Event) => {
    if (this.openTray && !e.composedPath().includes(this)) this.openTray = false;
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.openTray) {
      this.openTray = false;
      this.shadowRoot?.querySelector<HTMLElement>('.pill')?.focus();
    }
  };

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }
    .pill {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      block-size: 28px;
      padding-inline: 8px 10px;
      border-radius: var(--sw-r-pill);
      cursor: pointer;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
      white-space: nowrap;
      max-inline-size: min(52vw, 320px);
    }
    .pill:hover,
    .pill[aria-expanded='true'] {
      background: var(--sw-surface-3);
    }
    .pill:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .pill .lbl {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .dot.warn {
      background: var(--sw-stale);
    }
    .dot.err {
      background: var(--sw-danger);
    }
    .low {
      color: var(--sw-stale);
    }
    .tray {
      position: absolute;
      inset-block-start: calc(100% + 8px);
      inset-inline-end: 0;
      z-index: var(--sw-z-drawer, 60);
      inline-size: min(380px, calc(100vw - 20px));
      max-block-size: min(70vh, 520px);
      overflow: auto;
      box-sizing: border-box;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--sw-text);
      text-align: start;
    }
    /* the phone: the pill sits in the floating corner, so the tray takes the screen's width under it instead of hanging off the pill */
    @media (max-width: 767px) {
      .tray {
        position: fixed;
        inset-inline: 10px;
        inset-block-start: calc(var(--sw-banner-h, 0px) + var(--sw-safe-top, 0px) + 50px);
        inline-size: auto;
        max-block-size: calc(100dvh - 120px);
      }
    }
    h3 {
      margin: 0 4px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .card {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--sw-surface-2, var(--sw-surface));
    }
    .t1 {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .t2 {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .b {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 32px;
      padding-inline: 12px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .b[disabled] {
      opacity: 0.55;
      cursor: default;
    }
    .b:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .cams {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .foot {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin: 0 4px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onDoc, true);
    document.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onDoc, true);
    document.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  private async extend(id: string) {
    this.busy = id;
    this.setErr(id, '');
    try {
      castStore.put(await castExtend(id));
    } catch (err) {
      this.setErr(id, describeError(err));
      void castStore.refresh();
    } finally {
      this.busy = '';
    }
  }

  private async startPick(id: string) {
    this.picking = this.picking === id ? '' : id;
    if (this.picking && !this.cams.length) {
      try {
        this.cams = (await listCameras()).cameras.filter((c) => c.enabled && c.can_view_live !== false);
      } catch {
        this.cams = [];
      }
    }
  }

  private async switchTo(id: string, camId: string) {
    this.busy = id;
    this.setErr(id, '');
    try {
      const r = await castSwitch(id, { camera_id: camId });
      castStore.put(r.session);
      if (r.status === 'refused') this.setErr(id, 'המסך סירב להחלפה. אפשר לנסות שוב.');
      this.picking = '';
    } catch (err) {
      this.setErr(id, describeError(err));
    } finally {
      this.busy = '';
    }
  }

  private setErr(id: string, msg: string) {
    this.errors = { ...this.errors, [id]: msg };
  }

  render() {
    void this.watch;
    const now = castStore.now;
    const open = openSessions(castStore.sessions);
    if (!open.length) return nothing;
    const first = open[0];
    const bad = open.some((s) => s.state === 'not_confirmed');
    const starting = open.every((s) => s.state === 'starting');
    return html`<button type="button" class="pill" data-cast-pill aria-haspopup="dialog" aria-expanded=${this.openTray ? 'true' : 'false'} aria-label=${`${t('cast.pillLabel')}: ${open.length}`}
        @click=${() => (this.openTray = !this.openTray)}>
        <span class=${`dot ${bad ? 'err' : starting ? 'warn' : ''}`}></span><sw-icon name="cast" size=${15}></sw-icon>
        <span class=${`lbl ${isLow(first, now) ? 'low' : ''}`} data-cast-pill-label>${pillLabel(open, now)}</span>
      </button>
      ${this.openTray
        ? html`<div class="tray" role="dialog" aria-label=${t('cast.pillLabel')} data-cast-tray>
            <h3>${t('cast.pillLabel')}</h3>
            ${open.map((s) => html`<div class="card" data-cast-session=${s.session_id} data-cast-session-state=${s.state}>
              <div class="t1">${s.camera_name ?? t('cast.cameraOf')} ← ${s.screen_name}</div>
              <div class="t2">
                <span class=${isLow(s, now) ? 'low' : ''} data-cast-left>${s.state === 'not_confirmed' ? t('cast.notConfirmed') : s.state === 'starting' ? t('cast.starting2') : `${t('cast.pillTimeLeft')} ${leftText(s, now)}`}</span>
                ${s.mine ? html`<span>${t('cast.me')}</span>` : s.started_by_name ? html`<span>${t('cast.startedBy')}: ${s.started_by_name}</span>` : nothing}
                ${s.kind === 'test' ? html`<span>בדיקה</span>` : nothing}
              </div>
              <div class="acts">
                ${s.can.extend && !s.permanent && s.kind !== 'test'
                  ? html`<button type="button" class="b" data-cast-extend ?disabled=${!canExtend(s) || this.busy === s.session_id} title=${extendLimitReached(s) ? 'אי אפשר להאריך יותר: התחילו שידור חדש' : `${t('cast.pillExtendLeft')}: ${s.extensions_left}`} @click=${() => void this.extend(s.session_id)}><sw-icon name="plus" size=${14}></sw-icon>${t('cast.pillExtend')}${extendLimitReached(s) ? '' : ` (${s.extensions_left})`}</button>`
                  : nothing}
                ${s.can.switch ? html`<button type="button" class="b" data-cast-switch @click=${() => void this.startPick(s.session_id)}>החלף מצלמה</button>` : nothing}
                <sw-cast-stop .session=${s}></sw-cast-stop>
              </div>
              ${this.picking === s.session_id ? html`<div class="cams" data-cast-cams>${this.cams.filter((c) => c.id !== s.camera_id).map((c) => html`<button type="button" class="b" data-cast-cam=${c.id} ?disabled=${this.busy === s.session_id} @click=${() => void this.switchTo(s.session_id, c.id)}>${c.alias || c.name}</button>`)}</div>` : nothing}
              ${this.errors[s.session_id] ? html`<div class="err" role="alert">${this.errors[s.session_id]}</div>` : nothing}
            </div>`)}
            <div class="foot">${open.length}/${castStore.max}</div>
          </div>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-cast-pill': SwCastPill;
  }
}

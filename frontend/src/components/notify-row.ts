import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { foldLabel, isUnread, relativeTime, rowActions, type Notification } from '../api/notifications';
import { mediaGlassControls } from '../styles/media-glass';
import { nIcon } from './notify-icons';
import { notifyControls } from './notify-css';
import { iconOf, openLabel, placeText, rowTag } from './notify-logic';

export type RowAction = 'read' | 'snooze' | 'snooze_morning' | 'ack' | 'open';

/**
 * CR-018: one notification row of the center (the approved mockup): the severity bar, the pictogram ring with the folded count, the title with the
 * unread dot, "place · time" and one state tag (acknowledged by, resolved, snoozed until, delivery failed, held by quiet hours), and the ⋯ menu
 * (snooze 1 h / until the morning, acknowledge when permitted, mark read, open the device). The whole row opens the detail. Presentational: it
 * dispatches `row-open` {id} and `row-action` {id, action}; the center acts.
 */
@customElement('notify-row')
export class NotifyRow extends LitElement {
  @property({ attribute: false }) n!: Notification;
  @property({ type: Number }) now = Date.now();
  @property() tz: string | undefined = undefined;
  @property({ attribute: false }) areas: Record<string, string> = {};
  @property({ type: Boolean, reflect: true }) selected = false;
  @state() private menu = false;

  static styles = [
    mediaGlassControls,
    notifyControls,
    css`
      :host {
        display: block;
        position: relative;
      }
      :host([data-menu-open]) {
        z-index: 20;
      }
      .nrow {
        position: relative;
        display: grid;
        grid-template-columns: 4px var(--dv-icon-ring-size-lg, 40px) minmax(0, 1fr) auto;
        gap: 0 12px;
        align-items: center;
        min-block-size: var(--nt-row-min);
        padding: 10px 8px;
        padding-inline: 10px 8px;
        border-radius: var(--sw-r-2xl);
        border: 1px solid transparent;
        background: transparent;
        color: var(--dv-text);
        transition: background var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
        --sev: var(--nt-sev-alert);
        --sev-soft: var(--nt-sev-alert-soft);
      }
      .nrow.s-info {
        --sev: var(--nt-sev-info);
        --sev-soft: var(--nt-sev-info-soft);
      }
      .nrow.s-critical {
        --sev: var(--nt-sev-critical);
        --sev-soft: var(--nt-sev-critical-soft);
      }
      .nrow:hover {
        background: var(--dv-surface-2);
        border-color: var(--dv-border);
      }
      :host([selected]) .nrow {
        background: var(--dv-surface);
        border-color: var(--dv-border-strong);
        box-shadow: var(--dv-shadow-control);
      }
      .open {
        position: absolute;
        inset: 0;
        border: 0;
        background: transparent;
        border-radius: inherit;
        padding: 0;
        z-index: 1;
        cursor: pointer;
      }
      .open:focus-visible {
        outline: 2px solid var(--dv-focus);
        outline-offset: -2px;
      }
      .bar {
        inline-size: 4px;
        block-size: calc(100% - 8px);
        border-radius: var(--sw-r-2xs);
        background: var(--sev);
      }
      .ring {
        inline-size: var(--dv-icon-ring-size-lg, 40px);
        block-size: var(--dv-icon-ring-size-lg, 40px);
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--sev-soft);
        color: var(--sev);
        font-size: var(--sw-fs-2xl);
        position: relative;
      }
      .ring .cnt {
        position: absolute;
        inset-block-end: -4px;
        inset-inline-start: -6px;
        min-inline-size: 22px;
        block-size: 20px;
        padding: 0 5px;
        border-radius: var(--sw-r-md);
        background: var(--dv-text);
        color: var(--mm-text-inverse);
        font-size: var(--sw-fs-xs);
        font-weight: 700;
        display: grid;
        place-items: center;
        font-variant-numeric: tabular-nums;
        border: 2px solid var(--mm-sheet-surface);
      }
      .tx {
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.3;
      }
      .tx b {
        font-size: var(--sw-fs-md);
        font-weight: 600;
        letter-spacing: -0.005em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .tx b .ud {
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--nt-unread-dot);
        flex: none;
        box-shadow: 0 0 0 3px var(--dv-accent-soft);
      }
      .nrow.read .tx b {
        font-weight: 500;
      }
      .tx small {
        font-size: var(--sw-fs-sm);
        color: var(--dv-text-2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tx small .sep {
        opacity: 0.5;
      }
      .tx small .st {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
      }
      .st.ack {
        color: var(--dv-success);
      }
      .st.res {
        color: var(--dv-text-3);
      }
      .st.snz {
        color: var(--dv-accent-text);
      }
      .st.fail {
        color: var(--dv-danger);
      }
      .st.held {
        color: var(--dv-text-2);
      }
      .st .ic {
        font-size: var(--sw-fs-base);
      }
      .more {
        position: relative;
        z-index: 2;
        inline-size: 44px;
        block-size: 44px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--dv-text-3);
        opacity: 0;
        transition: opacity var(--mm-motion);
      }
      .nrow:hover .more,
      :host([selected]) .more,
      :host([data-menu-open]) .more,
      .more:focus-visible {
        opacity: 1;
      }
      @media (pointer: coarse), (max-width: 767px) {
        .more {
          opacity: 1;
        }
      }
      .more:hover {
        background: var(--dv-surface-3);
        color: var(--dv-text);
      }
      .more .ic {
        font-size: var(--sw-fs-xl);
      }
      .nrow.crit.open-state {
        background: var(--nt-pin-bg);
        border-color: color-mix(in srgb, var(--nt-sev-critical) 30%, transparent);
      }
      .nrow.crit.open-state:hover {
        border-color: color-mix(in srgb, var(--nt-sev-critical) 45%, transparent);
      }
      .nrow.crit.open-state .ring {
        box-shadow: 0 0 0 4px var(--nt-sev-critical-soft), 0 8px 20px var(--nt-critical-glow);
      }
      .nrow.faded .ring {
        opacity: 0.6;
      }
      .pop {
        inset-block-start: calc(100% - 8px);
        inset-inline-end: 8px;
        z-index: 30;
        background: var(--mm-sheet-surface);
        -webkit-backdrop-filter: var(--mm-sheet-blur);
        backdrop-filter: var(--mm-sheet-blur);
      }
    `,
  ];

  private emit(action: RowAction): void {
    this.menu = false;
    this.toggleAttribute('data-menu-open', false);
    this.dispatchEvent(new CustomEvent('row-action', { detail: { id: this.n.id, action }, bubbles: true, composed: true }));
  }

  private onDoc = (e: Event) => {
    if (!this.menu) return;
    if (!e.composedPath().includes(this)) this.setMenu(false);
  };
  private onKey = (e: KeyboardEvent) => {
    if (this.menu && e.key === 'Escape') {
      e.stopPropagation();
      this.setMenu(false);
    }
  };
  private setMenu(on: boolean): void {
    this.menu = on;
    this.toggleAttribute('data-menu-open', on);
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onDoc, true);
    this.addEventListener('keydown', this.onKey);
  }
  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onDoc, true);
    super.disconnectedCallback();
  }

  private renderMenu() {
    const a = rowActions(this.n, this.now);
    return html`<div class="pop" role="menu" data-row-menu>
      ${a.snooze ? html`<button type="button" role="menuitem" data-row-act="snooze" @click=${() => this.emit('snooze')}>${nIcon('snooze')}השתק לשעה</button>` : nothing}
      ${a.snoozeMorning ? html`<button type="button" role="menuitem" data-row-act="snooze_morning" @click=${() => this.emit('snooze_morning')}>${nIcon('moon')}עד הבוקר</button>` : nothing}
      ${a.ack ? html`<button type="button" role="menuitem" data-row-act="ack" @click=${() => this.emit('ack')}>${nIcon('checkAll')}אישור</button>` : nothing}
      ${a.read ? html`<button type="button" role="menuitem" data-row-act="read" @click=${() => this.emit('read')}>${nIcon('check')}סמן כנקרא</button>` : nothing}
      ${a.open ? html`<hr /><button type="button" role="menuitem" data-row-act="open" @click=${() => this.emit('open')}>${nIcon('open')}${openLabel(this.n)}</button>` : nothing}
    </div>`;
  }

  render() {
    const n = this.n;
    if (!n) return nothing;
    const unread = isUnread(n, this.now);
    const tag = rowTag(n, this.now, this.tz);
    const place = placeText(n, this.areas);
    const when = relativeTime(n.last_at, this.now, this.tz);
    const crit = n.severity === 'critical';
    const faded = n.state === 'resolved' || (!!n.me.snoozed_until && !unread && n.state === 'open' && rowTag(n, this.now, this.tz)?.kind === 'snz');
    return html`<div class=${classMap({ nrow: true, [`s-${n.severity}`]: true, crit, 'open-state': n.state === 'open', read: !unread, faded })} data-notify-row=${n.id} data-severity=${n.severity} data-state=${n.state} data-unread=${unread ? '1' : '0'}>
      <button type="button" class="open" data-row-open aria-label=${`${n.title} · ${place} · ${when}${unread ? ' · לא נקרא' : ''}`} @click=${() => this.dispatchEvent(new CustomEvent('row-open', { detail: { id: n.id }, bubbles: true, composed: true }))}></button>
      <span class="bar"></span>
      <span class="ring">${nIcon(iconOf(n))}${n.count > 1 ? html`<span class="cnt n" data-fold>${foldLabel(n)}</span>` : nothing}</span>
      <span class="tx"><b>${n.title}${unread ? html`<i class="ud" data-unread-dot></i>` : nothing}</b>
        <small><span>${place}</span><span class="sep">·</span><span class="n" style="direction:rtl">${when}</span>${tag ? html`<span class="sep">·</span><span class="st ${tag.kind}" data-row-tag=${tag.kind}>${tag.text}${nIcon(tag.icon)}</span>` : nothing}</small></span>
      <button type="button" class="more" data-row-more aria-label="עוד פעולות" aria-haspopup="menu" aria-expanded=${this.menu ? 'true' : 'false'} @click=${(e: Event) => {
        e.stopPropagation();
        this.setMenu(!this.menu);
      }}>${nIcon('more')}</button>
      ${this.menu ? this.renderMenu() : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notify-row': NotifyRow;
  }
}

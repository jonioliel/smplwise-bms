import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import {
  clockText, dayLabel, doorButtonVisible, escalationTimeline, foldLabel, rowActions, showsTimeline, stateText, timelineTitle,
  type EscalationSettings, type Notification,
} from '../api/notifications';
import { mediaGlassControls } from '../styles/media-glass';
import { nIcon } from './notify-icons';
import { notifyControls } from './notify-css';
import { detailDelivery, iconOf, placeText, severityText, whereText } from './notify-logic';

export type DetailAction = 'open' | 'ack' | 'snooze' | 'snooze_morning' | 'door';

/**
 * CR-018: the detail of one notification (the mockup's second level of the center): what / where / when, the state and severity tags, the snapshot
 * (fetched inside Arx only, after sign-in), the delivery line ("נשלח לטלפון · 14:02" / "לא נשלח · שעות שקט" / "המסירה נכשלה"), the timeline (the escalation
 * timeline of a critical row, with the steps still to come) and the actions: פתח, אישור, השתק לשעה, עד הבוקר and, on a doorbell row the caller may open, "פתח דלת".
 * "פתח דלת" never opens anything here: it dispatches `detail-action` {action: 'door'} and the center opens its in-app confirmation (CR §9).
 */
@customElement('notify-detail')
export class NotifyDetail extends LitElement {
  @property({ attribute: false }) n!: Notification;
  @property({ type: Number }) now = Date.now();
  @property() tz: string | undefined = undefined;
  @property({ attribute: false }) areas: Record<string, string> = {};
  @property({ attribute: false }) esc: EscalationSettings | null = null;
  /** The snapshot's address (same origin, session cookie), or null. */
  @property() snapshot: string | null = null;
  @state() private snapFailed = false;

  static styles = [
    mediaGlassControls,
    notifyControls,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-block-size: 0;
      }
      .ndet {
        flex: 1;
        overflow: auto;
        padding: 0 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scrollbar-width: thin;
        --sev: var(--nt-sev-alert);
        --sev-soft: var(--nt-sev-alert-soft);
      }
      .ndet > * {
        flex-shrink: 0;
      }
      .ndet.s-info {
        --sev: var(--nt-sev-info);
        --sev-soft: var(--nt-sev-info-soft);
      }
      .ndet.s-critical {
        --sev: var(--nt-sev-critical);
        --sev-soft: var(--nt-sev-critical-soft);
      }
      .dhead {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 4px 2px 0;
      }
      .dhead .ring {
        inline-size: 52px;
        block-size: 52px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--sev-soft);
        color: var(--sev);
        font-size: 25px;
        flex: none;
      }
      .dhead.crit .ring {
        box-shadow: 0 0 0 5px var(--nt-sev-critical-soft), 0 10px 26px var(--nt-critical-glow);
      }
      .dhead .tx {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .dhead h4 {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 8px;
        font-size: 12.5px;
        color: var(--dv-text-2);
      }
      .meta .sevtag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        block-size: 22px;
        padding-inline: 8px;
        border-radius: 999px;
        background: var(--sev-soft);
        color: var(--sev);
        font-weight: 700;
        font-size: 11.5px;
      }
      .dcard {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-radius: 20px;
      }
      .kv {
        display: grid;
        grid-template-columns: 80px minmax(0, 1fr);
        gap: 4px 12px;
        align-items: baseline;
        font-size: 13.5px;
      }
      .kv .k {
        color: var(--dv-text-3);
        font-size: 12.5px;
        font-weight: 600;
      }
      .kv .v {
        color: var(--dv-text);
        min-inline-size: 0;
      }
      .kv .v b {
        font-weight: 600;
      }
      .kv .v .lnk {
        all: unset;
        cursor: pointer;
        color: var(--dv-accent-text);
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: 6px;
        min-block-size: 44px;
      }
      .kv .v .lnk:focus-visible {
        outline: 2px solid var(--dv-focus);
      }
      .kv .v .lnk .ic {
        font-size: 14px;
      }
      .dline {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--dv-text-2);
        padding: 0 4px;
      }
      .dline .ic {
        font-size: 15px;
        color: var(--dv-success);
      }
      .dline.bad {
        color: var(--dv-danger);
        font-weight: 600;
      }
      .dline.bad .ic {
        color: var(--dv-danger);
      }
      .dline.held .ic {
        color: var(--dv-accent);
      }
      .dline.pending .ic {
        color: var(--dv-text-3);
      }
      .snap {
        position: relative;
        block-size: 150px;
        border-radius: 16px;
        overflow: hidden;
        background: radial-gradient(circle at 70% 30%, #3b4660, #141a28 70%);
        color: #fff;
        display: grid;
        place-items: center;
        border: 1px solid var(--dv-border);
      }
      .snap img {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
      }
      .snap .ctr {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: rgba(255, 255, 255, 0.8);
      }
      .snap .ctr .ic {
        font-size: 28px;
        stroke-width: 1.5;
      }
      .snap .pil {
        position: absolute;
        z-index: 1;
        inset-block-start: 10px;
        inset-inline-start: 10px;
        block-size: 24px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.45);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        color: #fff;
        font-size: 11.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
      .dacts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .dacts .span2 {
        grid-column: 1 / -1;
      }
      .tlh {
        font-size: 12.5px;
        color: var(--dv-text-3);
        font-weight: 600;
      }
    `,
  ];

  private act(action: DetailAction): void {
    this.dispatchEvent(new CustomEvent('detail-action', { detail: { id: this.n.id, action }, bubbles: true, composed: true }));
  }

  private renderWhen(n: Notification) {
    const day = dayLabel(n.last_at, this.now, this.tz);
    if (n.count > 1) return html`<b class="n">${clockText(n.first_at, this.tz)}</b> – <b class="n">${clockText(n.last_at, this.tz)}</b> · <span class="n">${foldLabel(n)}</span>`;
    return html`<b class="n">${clockText(n.last_at, this.tz)}</b> · ${day}`;
  }

  private renderTimeline(n: Notification) {
    const lines = escalationTimeline(n, this.esc, this.now, this.tz);
    return html`<section class="glass dcard" data-detail-timeline>
      <span class="tlh">${timelineTitle(n)}</span>
      <div class="tl">${lines.map((l) => html`<div class="ev ${l.kind}" data-tl=${l.kind}><span class="t">${l.clock || '—'}</span><span class="d"><i></i></span><span class="b"><b>${l.title}</b>${l.sub ? html`<small>${l.sub}</small>` : nothing}</span></div>`)}</div>
    </section>`;
  }

  render() {
    const n = this.n;
    if (!n) return nothing;
    const a = rowActions(n, this.now);
    const place = placeText(n, this.areas);
    const line = detailDelivery(n, this.tz);
    const door = doorButtonVisible(n);
    const crit = n.severity === 'critical' && n.state === 'open';
    const stTag = n.state === 'open' ? html`<span class="tag warn" data-detail-state="open">פתוח</span>` : n.state === 'acknowledged' ? html`<span class="tag ok" data-detail-state="acknowledged">${nIcon('check')}${stateText(n)}</span>` : html`<span class="tag" data-detail-state="resolved">${nIcon('check')}נפתר</span>`;
    const hasMain = n.state === 'open' && (n.can_ack || door);
    return html`<div class=${classMap({ ndet: true, [`s-${n.severity}`]: true })} data-notify-detail=${n.id}>
      <div class=${classMap({ dhead: true, crit })}><span class="ring">${nIcon(iconOf(n))}</span>
        <div class="tx"><h4>${n.title}${n.subject.area_id || n.subject.kind === 'door' ? html` · ${place}` : nothing}</h4>
          <div class="meta"><span class="sevtag" data-detail-severity=${n.severity}>${severityText(n.severity)}</span>${stTag}${n.count > 1 ? html`<span class="tag n">${foldLabel(n)}</span>` : nothing}${n.me.snoozed_until && a.snooze === false && n.state === 'open' ? html`<span class="tag soon">${nIcon('snooze')}הושתק עד ${clockText(n.me.snoozed_until, this.tz)}</span>` : nothing}</div></div></div>
      ${n.has_snapshot && this.snapshot
        ? html`<div class="snap" data-detail-snapshot><span class="pil">${nIcon('cam')}${whereText(n, this.areas)}</span>${this.snapFailed ? nothing : html`<img alt="" src=${this.snapshot} @error=${() => (this.snapFailed = true)} />`}<div class="ctr">${nIcon('image')}<span>תמונה מהמצלמה · <span class="n">${clockText(n.last_at, this.tz)}</span></span></div></div>`
        : nothing}
      <section class="glass dcard"><div class="kv">
        <span class="k">מה קרה</span><span class="v">${n.body}</span>
        <span class="k">איפה</span><span class="v">${a.open ? html`<button type="button" class="lnk" data-detail-where @click=${() => this.act('open')}>${nIcon(n.subject.kind === 'door' ? 'door' : n.subject.kind === 'camera' ? 'cam' : iconOf(n))}${whereText(n, this.areas)}${nIcon('chevronBack')}</button>` : whereText(n, this.areas)}</span>
        <span class="k">מתי</span><span class="v">${this.renderWhen(n)}</span>
      </div>${line ? html`<div class="dline ${line.tone === 'ok' ? '' : line.tone}" data-detail-delivery=${line.tone}>${nIcon(line.tone === 'bad' ? 'warning' : line.tone === 'held' ? 'moon' : line.tone === 'pending' ? 'clock' : 'check')}<span>${line.text}</span></div>` : nothing}</section>
      ${showsTimeline(n) ? this.renderTimeline(n) : nothing}
      <div class="dacts" data-detail-actions>
        <button type="button" class=${classMap({ btn: true, primary: true, span2: !hasMain })} data-detail-act="open" @click=${() => this.act('open')}>${nIcon('open')}פתח</button>
        ${a.ack ? html`<button type="button" class="btn" data-detail-act="ack" @click=${() => this.act('ack')}>${nIcon('checkAll')}אישור</button>` : nothing}
        ${a.snooze ? html`<button type="button" class=${classMap({ btn: true, quiet: true, span2: !hasMain && !a.snoozeMorning })} data-detail-act="snooze" @click=${() => this.act('snooze')}>${nIcon('snooze')}השתק לשעה</button>` : nothing}
        ${a.snoozeMorning ? html`<button type="button" class="btn quiet" data-detail-act="snooze_morning" @click=${() => this.act('snooze_morning')}>${nIcon('moon')}עד הבוקר</button>` : nothing}
        ${door ? html`<button type="button" class="btn door span2" data-detail-act="door" @click=${() => this.act('door')}>${nIcon('doorOpen')}פתח דלת</button>` : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notify-detail': NotifyDetail;
  }
}

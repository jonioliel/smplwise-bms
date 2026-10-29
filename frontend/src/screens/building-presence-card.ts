import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { getBuildingPresence, type BuildingSnapshot } from '../api/building-presence';
import { POLL_MS, cardView, clockText } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';
import { canAnywhere, isApi } from '../api/session';

/**
 * PRESENCE-2280 `<building-presence-card>`: the overview card of the building's presence (setting "במסך הראשי" = card). Renders NOTHING (and asks
 * nothing) unless the caller holds presence.building.view and the server reports an enabled, configured module whose display is "card".
 * One state word with a lamp (green only while occupied), one quiet line, the rooms with a sensor as wrapping chips (no scrolling), and a
 * note that the numbers are rooms, not people. Read-only.
 */
@customElement('building-presence-card')
export class BuildingPresenceCard extends LitElement {
  @state() private snap: BuildingSnapshot | null = null;
  private timer = 0;

  static styles = css`
    :host {
      display: none;
    }
    :host([data-on]) {
      display: block;
    }
    .card {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-radius-md, 12px);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .head .grow {
      flex: 1;
    }
    .state {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-xl, 22px);
      font-weight: var(--sw-fw-bold);
    }
    .lamp {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--sw-text-3);
    }
    .card[data-tone='ok'] .lamp {
      background: var(--sw-success-text);
    }
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .map {
      color: var(--sw-accent-text, var(--sw-accent));
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-decoration: none;
    }
    .map:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .sub,
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .rooms {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .r {
      display: inline-flex;
      gap: 6px;
      padding: 2px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      font-size: var(--sw-fs-sm);
    }
    .r[data-tone='ok'] {
      color: var(--sw-success-text);
    }
    .r.more {
      color: var(--sw-text-2);
      border-style: dashed;
    }
    .r[data-tone='unknown'] {
      border-style: dashed;
      color: var(--sw-text-3);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi() || !canAnywhere('presence.building.view')) return;
    void this.load();
    this.timer = window.setInterval(() => {
      if (!document.hidden) void this.load();
    }, POLL_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private async load() {
    try {
      this.snap = await getBuildingPresence();
    } catch {
      // a failed read keeps the last answer; nothing is invented
    }
  }

  render() {
    const v = cardView(this.snap);
    this.toggleAttribute('data-on', v.show);
    if (!v.show) return nothing;
    const at = clockText(this.snap?.at);
    // the home is a control screen: it never scrolls, so the room chips are capped (the full list is on the map)
    const cap = window.matchMedia('(max-width: 700px)').matches ? 4 : 8;
    return html`<section class="card" data-tone=${v.tone} data-building-presence-card-home aria-label=${BP.heading}>
      <div class="head"><sw-icon name="users" size=${15}></sw-icon>${BP.heading}<span class="grow"></span>${at ? BP.updated(at) : nothing}</div>
      <div class="state"><span class="lamp" aria-hidden="true"></span><span data-building-presence-big>${v.big}</span></div>
      <div class="sub">${v.sub}</div>
      <div class="rooms" data-building-rooms>${v.rooms.slice(0, cap).map((r) => html`<span class="r" data-tone=${r.tone}>${r.name} · ${r.text}</span>`)}${v.rooms.length > cap ? html`<span class="r more" data-building-more-rooms>${BP.moreRooms(v.rooms.length - cap)}</span>` : nothing}</div>
      <div class="foot"><span class="note">${BP.cardNote}</span><a class="map" href="#/explore" data-building-card-map>${BP.onMap}</a></div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-presence-card': BuildingPresenceCard;
  }
}

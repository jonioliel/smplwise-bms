import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { getBuildingPresence, type BuildingSnapshot } from '../api/building-presence';
import { POLL_MS, chipView } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';
import { canAnywhere, isApi } from '../api/session';

/**
 * BUILDING-PRESENCE-2271 `<building-presence-chip>`: one quiet part of the overview's thin bar - "פעיל · 3 חדרים" / "ריק מ־14:20".
 * It renders NOTHING (and asks nothing) unless the caller holds presence.building.view and the server reports tagged sensors, so an
 * installation without the tag never sees it. Green only while the building is occupied. Read-only; no person is ever named.
 */
@customElement('building-presence-chip')
export class BuildingPresenceChip extends LitElement {
  @state() private snap: BuildingSnapshot | null = null;
  private timer = 0;

  static styles = css`
    :host {
      display: none;
    }
    :host([data-on]) {
      display: inline-flex;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    sw-icon {
      color: var(--sw-text-3);
      flex: none;
    }
    .chip[data-tone='ok'] {
      color: var(--sw-success-text);
    }
    .chip[data-tone='ok'] sw-icon {
      color: inherit;
    }
    b {
      color: inherit;
      font-weight: var(--sw-fw-semibold);
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
      // a failed read keeps the last answer; nothing is invented and nothing is shown for a chip that never loaded
    }
  }

  render() {
    const v = chipView(this.snap);
    this.toggleAttribute('data-on', v.show);
    if (!v.show) return nothing;
    return html`<span class="chip" data-tone=${v.tone} data-building-presence role="status"><sw-icon name="users" size=${15}></sw-icon>${BP.chipLabel} · <b data-building-presence-text>${v.text}</b></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-presence-chip': BuildingPresenceChip;
  }
}

/**
 * MAPPING-ASSIST-2330 slice 2 - <mapping-health-chip>: the quiet chip in the home's site bar ("3 אזורים חדשים - אשר"), only for a
 * configurer, only with something new since the last apply.
 *
 * CR-HOME-LAZY-2440 (review 07:F4 d, 06:BUNDLE-1): moved here from screens/mapping-health.ts unchanged. The home screen is in the entry
 * chunk and imported the whole mapping family for this chip (screens/mapping-all: the settings page, the assistant, its slices). The chip
 * needs only the mapping engine and the mapping API, which the entry chunk carries anyway; its press goes to the settings tab, whose own
 * chunk brings the page and the assistant. This module must not import system-mapping, mapping-assistant or mapping-all.
 */
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { loadTree } from '../api/catalog';
import { health, levelWaiting, resolve, type Health } from '../api/mapping-engine';
import { loadMapping, type MappingData } from '../api/mapping';
import { navigate } from '../router';

const refsOf = (d: MappingData) => d.buildings.map((b) => ({ id: b.id, name: b.name, shared: b.is_shared }));

export function healthOf(d: MappingData): Health {
  const res = resolve(d.mapItems, d.parsed, { buildings: refsOf(d), settings: d.settings });
  return health(d.mapItems, res, d.seen, levelWaiting(d.mapItems, res, refsOf(d), d.ourFloors, d.links, d.parsed.levels));
}

/** The home's site-bar chip: something new since the last apply, for whoever may configure the site. */
@customElement('mapping-health-chip')
export class MappingHealthChip extends LitElement {
  @state() private h: Health | null = null;

  static styles = css`
    :host {
      display: contents;
    }
    button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      padding: 0 12px;
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      cursor: pointer;
      white-space: nowrap;
      transition: transform 140ms var(--sw-ease-out, ease-out);
    }
    button:active {
      transform: scale(0.97);
    }
    b {
      font-weight: var(--sw-fw-bold);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (isApi() && !canAnywhere('site.content.configure')) return;
    try {
      const cat = await loadTree();
      const site = cat.sites[0];
      if (!site) return;
      const d = await loadMapping(isApi() ? site.id : 'site1');
      if (!d.seen) return;
      this.h = healthOf(d);
    } catch {
      this.h = null; // 403 or offline: no chip
    }
  }

  render() {
    const h = this.h;
    if (!h || !h.fresh.length) return nothing;
    return html`<button type="button" data-home-mapping-health @click=${() => navigate('/system/diagnostics', { tab: 'buildings' })}><sw-icon name="warning" size=${14}></sw-icon><b>${h.fresh.length}</b> ${h.fresh.length === 1 ? 'אזור חדש' : 'אזורים חדשים'} - ${h.ready.length ? 'אשר' : 'החלט'}</button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mapping-health-chip': MappingHealthChip;
  }
}

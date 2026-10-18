import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { RouteState } from '../router';
import { describeError } from '../api/client';
import { listElevators, type ElevatorsResponse } from '../api/elevators';
import { elevatorsAccess, onElevatorsAccess, type ElevatorsAccess } from '../elevators/access';
import { chipOf, sinceText } from '../elevators/model';
import { elt } from '../i18n/elevators';
import { INFRA_TABS, tabStyleOf, visibleTabs } from '../shell/nav';
import { canNav, isApi } from '../api/session';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const POLL_MS = 15_000;

/**
 * תשתיות › מעליות (CR-INFRA-ELEVATORS): one row per elevator - name, area, the state chip (up / down / waiting / door open / fault /
 * out of service / unknown) and the time of the last change when the mirror has it. View only; polled while shown. A stale list shows
 * every elevator as unknown (model.ts). Clean operator screen: no hints, no paragraphs.
 */
@customElement('infra-elevators')
export class InfraElevators extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: ElevatorsAccess = elevatorsAccess();
  @state() private data: ElevatorsResponse | null = null;
  @state() private error = '';
  private timer?: number;
  private stop?: () => void;

  static styles = [elecCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px var(--sw-page-pad) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
    }
    .el {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .el:last-child {
      border-block-end: 0;
    }
    .el .nm {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .el .nm b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .el[data-state='fault'] sw-icon {
      color: var(--sw-danger);
    }
    .ext {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onElevatorsAccess((a) => (this.access = a));
    void this.load();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void this.load();
    }, POLL_MS);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
    this.stop?.();
    super.disconnectedCallback();
  }

  private async load() {
    if (!this.access.view) return;
    try {
      this.data = await listElevators();
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  render() {
    const l1 = isApi() && visibleTabs(INFRA_TABS, true, canNav).length < 2 ? html`<sw-tabs .items=${INFRA_TABS.filter((t) => t.id === 'elevators')} active="elevators" .variant=${tabStyleOf(null, 1)} data-infra-l1></sw-tabs>` : nothing;
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (!this.data) {
      return this.error
        ? html`${l1}<sw-state-panel state="error" heading=${elt('loadError')} hint=${this.error} data-state="error"></sw-state-panel>`
        : html`${l1}<div class="skl" style="block-size:160px" data-state="loading"></div>`;
    }
    const list = this.data.elevators;
    if (!list.length) return html`<sw-state-panel state="empty" heading=${elt('empty')} data-state="empty"></sw-state-panel>`;
    return html`${l1}
      <div class="row"><span class="h2">${elt('title')}</span><div class="sp"></div>${this.data.stale ? html`<sw-badge kind="stale" label=${elt('stale')} data-elevators-stale></sw-badge>` : nothing}</div>
      <div class="card flush" data-elevators>
        ${list.map((e) => {
          const c = chipOf({ state: e.state, stale: e.stale || this.data!.stale });
          const since = c.state === 'unknown' ? '' : sinceText(e.since);
          const extras = e.extras.filter((x) => x.on !== null);
          return html`<div class="el" data-elevator=${e.id} data-state=${c.state}>
            <sw-icon name=${c.icon} size="22"></sw-icon>
            <div class="nm"><b>${e.name}</b>${e.area_name || since ? html`<span class="mut">${[e.area_name, since].filter(Boolean).join(' · ')}</span>` : nothing}
              ${extras.length ? html`<div class="ext">${extras.map((x) => html`<span class="chip ${x.on ? 'c-acc' : 'c-mut'} nodot" data-extra=${x.position}>${x.label}</span>`)}</div>` : nothing}</div>
            <sw-badge kind=${c.tone} label=${c.label} data-elevator-state=${c.state}></sw-badge>
          </div>`;
        })}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-elevators': InfraElevators;
  }
}

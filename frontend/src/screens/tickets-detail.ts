import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../tickets/ticket-detail';
import '../components/sw-state-panel';
import '../components/sw-skeleton';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type ModuleState } from '../api/tickets';
import { lastScope, ticketHref } from '../tickets/model';
import { parseAssignParam } from '../tickets/create-assign-model';
import { tt } from '../tickets/text';
import { t } from '../i18n/he';
import { setTicketNames } from '../tickets/naming';
import { ticketChipSelected } from '../tickets/chip-selected'; // AUDIT30-C-TICKETS: one selected chip look (#4)

/**
 * CR-038 D18: the full-screen form of a ticket (`#/tickets/<id>`) - the deep-link address of a ticket (notifications of slice 6 point here),
 * offered from the drawer's expand button when the installation's setting is "מגירה + מסך מלא" and the only form when it is "מסך מלא". The
 * page is `<ticket-detail mode="page">` on the area's glass backdrop; the back button returns to the list the user came from.
 */
@customElement('tickets-detail')
export class TicketsDetailPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() ticketId = '';
  @state() private module: ModuleState | null = null;
  @state() private failed = '';
  @state() private off = false;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, css`
    .page {
      padding: 0;
    }
    .sk {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      /* the full ticket's own frame (ticket-detail .page: 18 / 36 / 44) so the skeleton and the ticket start at the same place */
      padding: var(--sw-s-4) var(--sw-s-8) var(--sw-s-8);
      box-sizing: border-box;
    }
    @media (max-width: 767px) {
      .sk {
        padding-inline: var(--sw-s-4);
      }
    }
  `, ticketChipSelected];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    void this.loadModule();
  }

  /** The module's answer decides the page: off (404), failed (with "try again" - it used to be a dead end) or ready. */
  private async loadModule(): Promise<void> {
    this.failed = '';
    try {
      const m = await ticketsApi().module();
      this.module = m;
      setTicketNames(m.name);
      this.off = !m.enabled;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.off = true;
      else this.failed = describeError(e);
    }
  }

  private retry = () => {
    this.failed = '';
    this.module = null;
    void this.loadModule();
  };

  /** The full screen before its answer: the shape of what is coming (the back bar, the head, the status block, three rows), so
   * nothing jumps when the ticket lands. Decoration only; the page says it is busy. */
  private skeleton() {
    return html`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${t('states.loading')}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`;
  }

  render() {
    if (this.off) {
      return html`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${tt('moduleOff')} data-tickets-state="off"></sw-state-panel></div>`;
    }
    if (this.failed) {
      return html`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${tt('retry')} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;
    }
    if (!this.module) return this.skeleton();
    // TKUI1: a deep link may pass `?tab=` (a push / WhatsApp link made for that purpose); else the module's default tab
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const tab = params.get('tab') ?? (params.get('view') === 'timeline' ? 'history' : '');
    return html`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${lastScope()} .initialTab=${tab}
      .defaultTab=${this.module.ui.detail_tab ?? ''} .cameraViewfinder=${this.module.ui.camera_viewfinder === true} .assignContact=${parseAssignParam(params.get('assign'))}
      @assign-consumed=${() => history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${ticketHref(this.ticketId)}`)}
      data-screen="tickets-detail"></ticket-detail>${nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-detail': TicketsDetailPage;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../tickets/ticket-detail';
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
import { tIcon } from '../tickets/icons';
import { setTicketNames } from '../tickets/naming';

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
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    void ticketsApi().module().then((m) => {
      this.module = m;
      setTicketNames(m.name);
      this.off = !m.enabled;
    }).catch((e) => {
      if (e instanceof ApiError && e.status === 404) this.off = true;
      else this.failed = describeError(e);
    });
  }

  render() {
    if (this.off) {
      return html`<div class="page"><div class="statebox glass" role="status" data-tickets-state="off"><span class="ring">${tIcon('ticket')}</span><b>${tt('moduleOff')}</b></div></div>`;
    }
    if (this.failed) {
      return html`<div class="page"><div class="statebox glass" role="status" data-tickets-state="error"><span class="ring">${tIcon('warning')}</span><b>${this.failed}</b></div></div>`;
    }
    if (!this.module) return html`<div class="page" aria-busy="true"></div>`;
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

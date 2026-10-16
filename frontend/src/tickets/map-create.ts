import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ticket-create';
import { canAnywhere } from '../api/session';
import { ticketsApi, type Meta, type NewTicketMode } from '../api/tickets';
import type { MapElementDraft } from '../api/tickets-map';
import { ticketsModuleOn } from '../shell/nav';
import { ticketHref } from './model';

/** TKMAP1: whether "פתח בקשת שירות" is offered on a map element / camera page: the module is on and the caller may open requests. */
export function mapTicketsOn(held: (p: string) => boolean = canAnywhere, moduleOn: boolean = ticketsModuleOn()): boolean {
  return moduleOn && held('tickets.create');
}

export const MAP_CREATE_LABEL = 'פתח בקשת שירות';

/**
 * TKMAP1 `<ticket-map-create .open .element>`: the create form opened FROM a map element (the live map's card of a camera / device, a
 * camera page). It loads the departments the caller may open in, opens `<ticket-create>` with the element (attached right after the
 * request exists; a device is also the request's device), and on success opens the new request. Events: `close`.
 */
@customElement('ticket-map-create')
export class TicketMapCreate extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) element: MapElementDraft | null = null;
  @state() private meta: Meta | null = null;
  @state() private mode: NewTicketMode = 'sheet';

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open && !this.meta) void this.loadMeta();
  }

  private async loadMeta(): Promise<void> {
    try {
      const [meta, mod] = await Promise.all([ticketsApi().meta(), ticketsApi().module().catch(() => null)]);
      this.meta = meta;
      if (mod) this.mode = mod.ui.new_ticket;
    } catch {
      this.meta = { departments: [], can: { view: false, create: false, manage: false, all_departments: false, external: false, configure: false } };
    }
  }

  private close = () => {
    this.meta = null; // the departments a user may open in can change between two openings
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  };

  private onCreated = (ev: CustomEvent<{ id: string }>) => {
    ev.stopPropagation();
    const id = ev.detail?.id;
    this.close();
    if (id) window.location.hash = ticketHref(id);
  };

  render(): TemplateResult | typeof nothing {
    if (!this.open || !this.element) return nothing;
    return html`<ticket-create .open=${true} .meta=${this.meta} mode=${this.mode} .mapElement=${this.element} data-map-create
      @created=${this.onCreated} @close=${this.close}></ticket-create>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-map-create': TicketMapCreate;
  }
}

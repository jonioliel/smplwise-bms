import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RouteState } from '../router';

/** CALENDARS-UI-2310: stub - filled by its slice. */
@customElement('system-calendars')
export class SystemCalendars extends LitElement {
  @property({ attribute: false }) route: RouteState | null = null;
  render() {
    return html`<div data-stub="system-calendars"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-calendars': SystemCalendars;
  }
}

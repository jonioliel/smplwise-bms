import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RouteState } from '../router';

/** CALENDARS-UI-2310: stub - filled by its slice. */
@customElement('system-calendar-sync')
export class SystemCalendarSync extends LitElement {
  @property({ attribute: false }) route: RouteState | null = null;
  render() {
    return html`<div data-stub="system-calendar-sync"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-calendar-sync': SystemCalendarSync;
  }
}

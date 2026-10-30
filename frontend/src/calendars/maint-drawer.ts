import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CalCtx } from './ctx';
import { calCss } from './styles';

/** CALENDARS-UI-2310: stub - filled by its slice. */
@customElement('cal-maint-drawer')
export class CalMaintDrawer extends LitElement {
  static styles = [calCss];
  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ attribute: false }) detail: unknown = null;
  render() {
    return html`<div class="panel" data-stub="cal-maint-drawer"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-maint-drawer': CalMaintDrawer;
  }
}

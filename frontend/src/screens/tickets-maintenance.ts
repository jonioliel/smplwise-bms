import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-state-panel';
import type { TabItem } from '../components/sw-tabs';
import type { RouteState } from '../router';
import { can, isApi } from '../api/session';
import { tabStyleOf } from '../shell/nav';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { srHeading, srHeadingCss } from '../components/sr-heading';
import { mt } from '../i18n/maintenance';
import { em } from '../i18n/emergency';
import { emergencyApi, type EmergencyModule } from '../api/emergency';
import { maintAccess, onMaintAccess, refreshMaintenance, type MaintAccess } from '../maintenance/access';
import { PAGE_LABEL, SECTION_HREF, pageHref, pageOf, pagesFor, type Page } from '../maintenance/model';
import '../maintenance/list-page';
import '../maintenance/tags-page';
import '../maintenance/log-page';
import '../maintenance/scan-page';
import '../maintenance/emergency-page';

/**
 * CR-MAINT215 slice 2: the section "תחזוקה ובקרה" of the service-management area (`#/tickets/maintenance/<page>`), drawn as the
 * owner-approved mockup v2: its own page row (level 2: פנקס אישורים ובדיקות · תחזוקה מונעת · סבבים ובדיקות · תגי QR/NFC - the
 * tags page for managers only), then the page. `?task=<id>` opens a task's sheet, `?run=<id>` a round's run, and
 * `#/tickets/maintenance/scan/<token>` resolves a scanned sticker. While the module is off the section says so (with a way to
 * Settings for a system administrator); without maintenance.view it is the "not available" panel. The navigation offers the
 * section only while the module is on and to holders of maintenance.view (shell/nav.ts).
 */
@customElement('tickets-maintenance')
export class TicketsMaintenance extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: MaintAccess = maintAccess();
  /** CR-EMERG104: the emergency readiness tab is offered only while its own switch is on and the caller may view it (maintenance.view or emergency.view) */
  @state() private emergency: EmergencyModule | null = null;
  private stop?: () => void;

  static styles = [srHeadingCss, css`
    /* owner 24.10: a control screen never scrolls as a PAGE - the section fills the height of the screen and each page scrolls inside its
       own panel (the list's table, the log, the tags). */
    :host {
      display: flex; flex-direction: column; gap: 14px; block-size: 100%; min-block-size: 0; padding: 14px var(--sw-page-pad) 16px; max-inline-size: var(--sw-content-max);
      inline-size: 100%; box-sizing: border-box; overflow: hidden;
    }
    sw-tabs { flex: none; } /* a scroll container in a flex column would shrink to nothing on a phone */
    .body { min-inline-size: 0; min-block-size: 0; flex: 1; display: flex; flex-direction: column; gap: 14px; }
    .body > * { flex: 1; min-block-size: 0; overflow: auto; }
    .skl { border-radius: var(--sw-r-md); background: var(--sw-skeleton); block-size: 160px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 7px 14px; border: 1px solid var(--sw-border); background: var(--sw-surface);
      color: var(--sw-text); font: inherit; font-weight: var(--sw-fw-semibold); text-decoration: none; }
    @media (max-width: 767px) { :host { padding: 12px 14px 12px; gap: 12px; } }
    @media print { :host { overflow: visible; block-size: auto; } .body > * { overflow: visible; } }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onMaintAccess((a) => (this.access = a));
    void refreshMaintenance();
    void emergencyApi.module().then((m) => (this.emergency = m), () => (this.emergency = null));
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private pages(): TabItem[] {
    const tabs: TabItem[] = pagesFor(this.access).map((p) => ({ id: p, label: mt(PAGE_LABEL[p]), href: pageHref(p) }));
    if (this.emergency?.enabled && this.emergency.can.view) tabs.push({ id: 'emergency', label: em('tab'), href: `${SECTION_HREF}/emergency` });
    return tabs;
  }

  private body(page: Page) {
    const r = this.route;
    const seg = r?.segments ?? [];
    if (seg[2] === 'scan' && seg[3]) return html`<maint-scan-page .token=${seg[3]} .access=${this.access}></maint-scan-page>`;
    if (seg[2] === 'emergency') return this.emergency?.enabled && this.emergency.can.view ? html`<emergency-readiness-page></emergency-readiness-page>`
      : html`<sw-state-panel state="forbidden" heading=${em('forbiddenTitle')} data-state="forbidden"></sw-state-panel>`;
    if (page === 'tags') return html`<maint-tags-page .access=${this.access}></maint-tags-page>`;
    if (page === 'log') return html`<maint-log-page .access=${this.access}></maint-log-page>`;
    return html`<maint-list-page .page=${page} .access=${this.access} .openTask=${r?.params.get('task') ?? ''} .openRun=${r?.params.get('run') ?? ''}></maint-list-page>`;
  }

  render() {
    const a = this.access;
    const heading = srHeading(mt('section'));
    if (a.enabled === null) return html`${heading}<div class="skl" aria-busy="true" aria-label=${mt('loading')} data-state="loading"></div>`;
    if (!a.enabled) {
      const sys = !isApi() || can('system.configure');
      return html`${heading}<sw-state-panel icon="offline" state="empty" heading=${mt('offTitle')} hint=${mt('offBody')} data-state="off">
        ${sys ? html`<a class="btn" href="#/system/infra/maintenance" data-maint-to-settings>${mt('toSettings')}</a>` : nothing}</sw-state-panel>`;
    }
    if (!a.view) return html`${heading}<sw-state-panel state="forbidden" heading=${mt('forbiddenTitle')} data-state="forbidden"></sw-state-panel>`;
    const emergencyTab = this.route?.segments[2] === 'emergency';
    const page = emergencyTab ? ('emergency' as unknown as Page) : pageOf(this.route?.segments ?? []);
    const items = this.pages();
    const scan = this.route?.segments[2] === 'scan';
    // every page draws its own h1 (the temperature screen's page head); the visually hidden one is only for the state panels above
    return html`${scan ? nothing : html`<sw-tabs .items=${items} .active=${page} .variant=${tabStyleOf(null, 2)} group-label=${mt('pagesLabel')} data-maint-pages></sw-tabs>`}
      <div class="body" data-maint-page=${scan ? 'scan' : page}>${this.body(page)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-maintenance': TicketsMaintenance;
  }
}

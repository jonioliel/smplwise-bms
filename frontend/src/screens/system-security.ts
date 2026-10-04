import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-tabs';
import '../components/sw-button';
import '../components/sw-state-panel';
import './security-alarm';
import './system-alarm';
import './system-security-cameras';
import { alarmPresence, onAlarmPresence, refreshAlarmPresence } from '../api/alarm-presence';
import { describeError, get } from '../api/client';
import { canNav, isApi, nvrLess } from '../api/session';
import { SECURITY_CAMERAS_HREF, SECURITY_SETTINGS_TABS, applyAlarmPresent, tabAllowed, tabStyleOf, visibleTabs } from '../shell/nav';
import { TabsModeController } from '../shell/tabs-mode';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/** GET /api/v1/health - the connection facts, for every signed-in user (the same read הגדרות › חיבורים starts from). */
interface RawHealth {
  nvr_configured: boolean;
  mode?: 'full' | 'ha_only';
  discovery: { cameras: number; cameras_last_ok: string | null; cameras_last_error: string | null };
  events: { ingest: { connected: boolean; last_error: string | null } };
}

function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * הגדרות › אבטחה (2026-09-30, owner request): everything about the alarm system and the NVR in one Settings section.
 * Pages (route `#/system/security/<page>`): `alarm` - the alarm screen itself, unchanged (it left the security area);
 * `manage` - the alarm management (panel code, user policy is in משתמשים והרשאות, zone pairing, remote policy); `nvr` -
 * the NVR's state, with the way to its connection and recorder settings, which stay in הגדרות › חיבורים; `cameras` - the
 * cameras' video settings, read-only (CR-020 S1, system administrators).
 *
 * Nothing here decides access: each page is offered to (and rendered for) the holders of the permission it always
 * required - alarm.view, system.configure, system.configure / sources.configure - and the server checks every call itself.
 * The alarm pages exist only while the platform has an alarm panel (api/alarm-presence.ts); the page in the address bar
 * is still rendered for someone who may see it, so a saved link never lands on a blank screen.
 */
@customElement('system-security')
export class SystemSecurity extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** The page from the route (`alarm` | `manage` | `nvr`), empty for the bare section address. */
  @property() sub = '';
  /** The alarm panel named by the link (`?panel=`), kept through the redirect from the old alarm route. */
  @property() panelId = '';
  @state() private presenceKnown = alarmPresence() !== null;
  private stopPresence?: () => void;
  private tabsMode = new TabsModeController(this, 'settings'); // 0.1.153: tabs / hybrid / dropdown
  private giveUp = 0;

  static styles = [css`
    :host {
      display: block;
    }
    .tabs {
      padding: 14px var(--sw-page-pad, 24px) 0;
    }
    .tabs sw-tabs[data-variant^='underline'] {
      inline-size: 100%;
    }
    .rows {
      display: grid;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .ok {
      color: #15803d;
    }
    .warn {
      color: #92400e;
    }
    .err {
      color: var(--sw-danger);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stopPresence = onAlarmPresence((v) => {
      applyAlarmPresent(v); // the navigation reads the same answer (the shell's own listener does this too)
      this.presenceKnown = v !== null;
      this.requestUpdate();
    });
    void refreshAlarmPresence();
    // never wait on the probe for long: an unknown answer shows the alarm pages (they fail toward showing)
    this.giveUp = window.setTimeout(() => (this.presenceKnown = true), 2500);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPresence?.();
    window.clearTimeout(this.giveUp);
  }

  private get api(): boolean {
    return isApi();
  }

  /** Is this page permitted for the signed-in user (demo data: every page)? */
  private permitted(id: string): boolean {
    const t = SECURITY_SETTINGS_TABS.find((x) => x.id === id);
    return !!t && (!this.api || tabAllowed(t.href ?? '', canNav));
  }

  /** The pages offered: the permitted ones, the alarm pages only while a panel exists. */
  private offered() {
    return visibleTabs(SECURITY_SETTINGS_TABS, this.api, canNav);
  }

  private redirectTo(id: string) {
    const q = id === 'alarm' && this.panelId ? `?panel=${encodeURIComponent(this.panelId)}` : '';
    window.location.replace(`#/system/security/${id}${q}`);
  }

  render() {
    const offered = this.offered();
    const known = SECURITY_SETTINGS_TABS.some((t) => t.id === this.sub);
    if (!known || !this.permitted(this.sub)) {
      // the bare section address (or a page this user may not open): the first page they are offered
      if (this.api && !this.presenceKnown) return html`<sw-state-panel state="loading"></sw-state-panel>`;
      const first = offered[0]?.href?.split('/').pop();
      if (first) {
        queueMicrotask(() => this.redirectTo(first));
        return html`<sw-state-panel state="loading"></sw-state-panel>`;
      }
      return html`<sw-page heading="אבטחה"><sw-state-panel state="forbidden" data-security-settings-forbidden></sw-state-panel></sw-page>`;
    }
    // the page being viewed stays in the row even when the presence answer would hide it (a saved link); the row follows
    // the order and visibility the admin set (ui.tabs, "system.security") through `offered`
    const current = SECURITY_SETTINGS_TABS.find((t) => t.id === this.sub);
    const items = current && !offered.some((o) => o.id === current.id) ? [...offered, current] : offered;
    return html`${items.length > 1
        ? html`<div class="tabs" data-security-settings-tabs><sw-tabs .variant=${this.tabsMode.props(tabStyleOf('system.security')).variant} ?adaptive=${this.tabsMode.props(tabStyleOf('system.security')).adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} .items=${items} .active=${this.sub}></sw-tabs></div>`
        : nothing}
      ${this.sub === 'alarm'
        ? html`<security-alarm .panelId=${this.panelId}></security-alarm>`
        : this.sub === 'manage'
          ? html`<sw-page heading="ניהול אזעקה" subheading="לוחות, קוד הלוח, שיוך חיישנים לעקיפה ומדיניות מרחוק"><system-alarm-settings ?canEdit=${this.api && canNav('system.configure', true)}></system-alarm-settings></sw-page>`
          : this.sub === 'cameras'
            ? html`<system-security-cameras></system-security-cameras>`
            : html`<system-security-nvr></system-security-nvr>`}`;
  }
}

/** הגדרות › אבטחה › NVR: the state at a glance and the way to the connection and recorder settings (they stay in חיבורים). */
@customElement('system-security-nvr')
export class SystemSecurityNvr extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private h: RawHealth | null = null;
  @state() private error = '';

  static styles = [SystemSecurity.styles, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) return;
    try {
      this.h = await get<RawHealth>('health');
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  render() {
    if (!isApi()) return html`<sw-page heading="NVR"><sw-state-panel state="empty" heading="המצב מוצג מול שרת אמיתי" hint="במצב הדגמה אין NVR לקרוא."></sw-state-panel></sw-page>`;
    if (this.error && !this.h) return html`<sw-page heading="NVR"><sw-state-panel state="error" heading="מצב ה־NVR לא נטען" hint=${this.error} actionLabel="נסו שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    if (!this.h) return html`<sw-page heading="NVR"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const h = this.h;
    const off = nvrLess() || h.mode === 'ha_only';
    const links = [
      { href: '#/system/setup', label: 'חיבורים והגדרות ה־NVR', show: tabAllowed('#/system/setup', canNav) },
      { href: SECURITY_CAMERAS_HREF, label: 'הגדרות מצלמות', show: !off && tabAllowed(SECURITY_CAMERAS_HREF, canNav) },
      { href: '#/investigate/health', label: 'בריאות מצלמות', show: !off && tabAllowed('#/investigate/health', canNav) },
    ].filter((l) => l.show);
    return html`<sw-page heading="NVR" subheading=${off ? 'ללא NVR' : h.nvr_configured ? 'מוגדר' : 'לא מוגדר'}>
      <sw-card heading="מצב" data-security-nvr>
        <div class="rows">
          <div class="row"><span>NVR</span><span class=${off ? '' : h.nvr_configured ? 'ok' : 'err'}>${off ? 'מצב ללא NVR' : h.nvr_configured ? 'מוגדר' : 'לא מוגדר'}</span></div>
          ${off
            ? nothing
            : html`<div class="row"><span>זרם התראות</span><span class=${h.events.ingest.connected ? 'ok' : 'err'}>${h.events.ingest.connected ? 'מחובר' : 'מנותק'}</span></div>
                <div class="row"><span>ערוצים שגולו</span><span>${h.discovery.cameras}</span></div>
                <div class="row"><span>גילוי אחרון תקין</span><span class=${h.discovery.cameras_last_error ? 'warn' : ''}>${when(h.discovery.cameras_last_ok)}</span></div>`}
        </div>
        ${links.length
          ? html`<div class="actions">${links.map((l) => html`<sw-button size="sm" variant="ghost" @click=${() => (window.location.hash = l.href)}>${l.label}</sw-button>`)}</div>`
          : nothing}
      </sw-card>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security': SystemSecurity;
    'system-security-nvr': SystemSecurityNvr;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-tabs';
import '../components/sw-button';
import '../components/sw-state-panel';
import './security-alarm';
import './system-alarm';
import { alarmPresence, onAlarmPresence, refreshAlarmPresence } from '../api/alarm-presence';
import { describeError, get } from '../api/client';
import { canNav, isApi, nvrLess } from '../api/session';
import { SECURITY_SETTINGS_TABS, applyAlarmPresent, tabAllowed, visibleTabs } from '../shell/nav';

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
 * the NVR's state, with the way to its connection and recorder settings, which stay in הגדרות › חיבורים.
 *
 * Nothing here decides access: each page is offered to (and rendered for) the holders of the permission it always
 * required - alarm.view, system.configure, system.configure / sources.configure - and the server checks every call itself.
 * The alarm pages exist only while the platform has an alarm panel (api/alarm-presence.ts); the page in the address bar
 * is still rendered for someone who may see it, so a saved link never lands on a blank screen.
 */
@customElement('system-security')
export class SystemSecurity extends LitElement {
  /** The page from the route (`alarm` | `manage` | `nvr`), empty for the bare section address. */
  @property() sub = '';
  /** The alarm panel named by the link (`?panel=`), kept through the redirect from the old alarm route. */
  @property() panelId = '';
  @state() private presenceKnown = alarmPresence() !== null;
  private stopPresence?: () => void;

  static styles = css`
    :host {
      display: block;
    }
    .tabs {
      padding: 14px var(--sw-page-pad, 24px) 0;
    }
    .tabs sw-tabs {
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
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stopPresence = onAlarmPresence((v) => {
      applyAlarmPresent(v); // the navigation reads the same answer (the shell's own listener does this too)
      this.presenceKnown = v !== null;
      this.requestUpdate();
    });
    void refreshAlarmPresence();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPresence?.();
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
    // the page being viewed stays in the row even when the presence answer would hide it (a saved link)
    const items = SECURITY_SETTINGS_TABS.filter((t) => offered.some((o) => o.id === t.id) || t.id === this.sub);
    return html`${items.length > 1
        ? html`<div class="tabs" data-security-settings-tabs><sw-tabs underline .items=${items} .active=${this.sub}></sw-tabs></div>`
        : nothing}
      ${this.sub === 'alarm'
        ? html`<security-alarm .panelId=${this.panelId}></security-alarm>`
        : this.sub === 'manage'
          ? html`<sw-page heading="ניהול אזעקה" subheading="לוחות, קוד הלוח, שיוך חיישנים לעקיפה ומדיניות מרחוק"><system-alarm-settings ?canEdit=${this.api && canNav('system.configure', true)}></system-alarm-settings></sw-page>`
          : html`<system-security-nvr></system-security-nvr>`}`;
  }
}

/** הגדרות › אבטחה › NVR: the state at a glance and the way to the connection and recorder settings (they stay in חיבורים). */
@customElement('system-security-nvr')
export class SystemSecurityNvr extends LitElement {
  @state() private h: RawHealth | null = null;
  @state() private error = '';

  static styles = SystemSecurity.styles;

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

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-tabs';
import '../components/sw-button';
import '../components/sw-state-panel';
import './system-access-status';
import './system-access-audit';
import './system-access-groups';
import './system-access-policy';
import './system-access-messaging';
import type { TabItem } from '../components/sw-tabs';
import type { SyncMeta } from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import { can, isApi, onSession } from '../api/session';
import { accessControlAccess } from '../access-control/access';
import { headline } from '../access-control/status-logic';
import { ageText } from '../access-control/status-text';
import { ACCESS_CONTROL_SETTINGS_HREF, tabStyleOf } from '../shell/nav';
import { UTC_ZONE } from './wiskey-format';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsLadderStyles } from '../styles/settings';
import { st } from '../i18n/access-status';
import { mt } from '../i18n/access-messaging';

export type AccessSegment = 'status' | 'audit' | 'groups' | 'policy' | 'messaging';

/**
 * CR-036 S10: the Settings page "בקרת כניסה" (#/system/access-control[/audit|/groups]) - the technical truth of the access-control
 * integration for administrators: system status (stations, alerts, sync, conflicts), the intercom's own action log, and the groups
 * and profile fields. The segments follow what the caller may have: the status needs `access.admin.read` (at any scope - the server
 * shows a station-scoped administrator only their stations); the action log and the conflicts are installation-wide in the
 * integration, so they are offered to an installation-wide administrator only; the groups need `access.people.read`.
 * The subtitle names the integration, whether it is connected and when it was last asked (a Settings page keeps the technical truth);
 * the refresh button reads every card again - nothing here asks a device. The page writes the four administrator settings of the
 * policy segment and the message settings and templates of the "הודעות" segment (CR-036 WA) - both `system.configure`; the display
 * switch of the access-control screens (CR-036 S12) joins as another segment later.
 */
@customElement('system-access-control')
export class SystemAccessControl extends LitElement {
  /** The route's segment after `access-control`: '' (status), `audit` or `groups`. */
  @property() view = '';
  @state() private rev = 0;
  @state() private meta: SyncMeta | null = null;
  @state() private zone: DisplayZone = UTC_ZONE;
  @state() private admin = true;
  @state() private wide = true;
  @state() private people = true;
  @state() private configure = false;
  private stop: (() => void) | null = null;

  static styles = [
    settingsLadderStyles,
    css`
      :host {
        display: block;
        --_t: var(--sw-touch-desktop, 44px);
        --sw-ctl-h-sm: var(--_t);
        --sw-ctl-h-md: var(--_t);
        --sw-ctl-h-lg: var(--_t);
      }
      @media (max-width: 1100px) {
        :host {
          --_t: max(44px, var(--sw-touch-desktop, 44px));
        }
      }
      .segs {
        display: flex;
        min-inline-size: 0;
      }
      .body {
        display: block;
        min-inline-size: 0;
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.sync();
    this.stop = onSession(() => this.sync());
  }

  disconnectedCallback(): void {
    this.stop?.();
    super.disconnectedCallback();
  }

  private sync(): void {
    const a = accessControlAccess();
    this.admin = a.admin;
    this.people = a.people;
    this.wide = !isApi() || can('access.admin.read');
    this.configure = isApi() && can('system.configure');
  }

  /** The segments this caller has, in order. */
  private segments(): Array<{ id: AccessSegment; label: string }> {
    const out: Array<{ id: AccessSegment; label: string }> = [{ id: 'status', label: st('segStatus') }];
    if (this.wide) out.push({ id: 'audit', label: st('segAudit') });
    if (this.people || this.wide) out.push({ id: 'groups', label: st('segGroups') });
    if (this.configure) out.push({ id: 'policy', label: st('segPolicy') });
    if (this.configure) out.push({ id: 'messaging', label: mt('segment') }); // CR-036 WA: the message settings and templates (system.configure)
    return out;
  }

  private active(segments: Array<{ id: AccessSegment }>): AccessSegment {
    return segments.find((s) => s.id === this.view)?.id ?? 'status';
  }

  private subtitle(): string {
    if (!this.meta) return '';
    const h = headline(this.meta, new Date(), this.zone);
    return [h.version ? st('hlVersion', { v: h.version }) : '', h.connected === true ? st('hlConnected') : h.connected === false ? st('hlDisconnected') : '', h.checked.key !== 'none' ? st('hlChecked', { when: ageText(h.checked) }) : '']
      .filter(Boolean)
      .join(' · ');
  }

  private onMeta = (e: Event) => {
    const d = (e as CustomEvent<{ meta: SyncMeta | null; zone: DisplayZone }>).detail;
    this.meta = d.meta;
    this.zone = d.zone;
  };

  render() {
    if (isApi() && !this.admin) {
      return html`<sw-page heading=${st('title')}><sw-state-panel quiet data-access-state="no_permission" state="forbidden" heading=${st('noPermission')}></sw-state-panel></sw-page>`;
    }
    const segments = this.segments();
    const active = this.active(segments);
    const items: TabItem[] = segments.map((s) => ({ id: s.id, label: s.label, href: `${ACCESS_CONTROL_SETTINGS_HREF}${s.id === 'status' ? '' : `/${s.id}`}` }));
    return html`<sw-page heading=${st('title')} subheading=${this.subtitle()} wide>
      <sw-button slot="actions" size="lg" variant="ghost" icon="refresh" data-access-refresh @click=${() => (this.rev += 1)}>${st('refresh')}</sw-button>
      ${segments.length > 1 ? html`<div class="segs"><sw-tabs .items=${items} .active=${active} .variant=${tabStyleOf(null, 2)} group-label=${st('segments')} data-access-segments></sw-tabs></div>` : nothing}
      <div class="body" data-access-segment=${active}>
        ${active === 'audit'
          ? html`<system-access-audit .rev=${this.rev} @access-meta=${this.onMeta}></system-access-audit>`
          : active === 'groups'
            ? html`<system-access-groups .rev=${this.rev} @access-meta=${this.onMeta}></system-access-groups>`
            : active === 'policy'
              ? html`<system-access-policy .rev=${this.rev}></system-access-policy>`
              : active === 'messaging'
                ? html`<system-access-messaging .rev=${this.rev}></system-access-messaging>`
                : html`<system-access-status .rev=${this.rev} @access-meta=${this.onMeta}></system-access-status>`}
      </div>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-control': SystemAccessControl;
  }
}

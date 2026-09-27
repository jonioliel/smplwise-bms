import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-kpi';
import '../components/sw-button';
import '../components/sw-state-panel';
import type { PanelState } from '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import { can, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { getIntercomOverview, subscribeIntercom, type IntercomFeed, type IntercomFeedState, type IntercomOverview, type IntercomStation } from '../api/intercom';
import { formatTime, t, UTC_ZONE } from './wiskey-format';

/** A timestamp as epoch milliseconds for ordering; unparseable ones sort last. */
export function instant(ts: string | null | undefined): number {
  const ms = ts ? Date.parse(ts) : NaN;
  return Number.isNaN(ms) ? -Infinity : ms;
}

/** WisKey's door filter (wiskey-v4-overview.ts `WiskeyDoorFilter`). */
type DoorFilter = 'all' | 'online' | 'attention';

const PAGE = 12; // WisKey's entry center never shows more than 12 doors a page (fitWall capacity ceiling)
const POLL_MS = 30000; // WisKey's own panel polls `overview` every 30 s; used here only while the notices are down

const DEMO: IntercomOverview = {
  version: 'demo',
  api_version: 1,
  default_zone: { kind: 'iana', name: 'Asia/Jerusalem' },
  user_count: 48,
  stations: [
    { id: 'd1', name: 'שער ראשי', online: true, call_state: 'ringing', sync_state: 'synced', lock_enabled: true, lock_count: 1, has_camera: true, last_error: null, last_seen: '2026-09-27T08:00:00+03:00', pending_user_count: 0, managed_user_count: 42, zone: { kind: 'iana', name: 'Asia/Jerusalem' }, last_access: { timestamp: '2026-09-27T07:58:12+03:00', time_source: 'device', person_name: 'דנה כהן', employee_no: '1001', authentication: 'card', result: 'granted', event_type: 'access_granted', recovered: false, door: 1 } },
    { id: 'd2', name: 'לובי', online: true, call_state: 'idle', sync_state: 'synced', lock_enabled: true, lock_count: 2, has_camera: true, last_error: null, last_seen: '2026-09-27T08:00:00+03:00', pending_user_count: 0, managed_user_count: 42, zone: { kind: 'iana', name: 'Asia/Jerusalem' }, last_access: { timestamp: '2026-09-27T07:41:03+03:00', time_source: 'device', person_name: null, employee_no: '2044', authentication: 'pin', result: 'granted', event_type: 'access_granted', recovered: false, door: 2 } },
    { id: 'd3', name: 'חניון', online: true, call_state: 'idle', sync_state: 'pending', lock_enabled: false, lock_count: 0, has_camera: true, last_error: null, last_seen: '2026-09-27T08:00:00+03:00', pending_user_count: 3, managed_user_count: 39, zone: { kind: 'iana', name: 'Asia/Jerusalem' }, last_access: { timestamp: '2026-09-26T22:10:40+03:00', time_source: 'received', person_name: null, employee_no: null, authentication: 'unknown', result: 'denied', event_type: 'access_denied', recovered: true, door: null } },
    { id: 'd4', name: 'מחסן', online: false, call_state: 'unavailable', sync_state: 'offline', lock_enabled: true, lock_count: 1, has_camera: false, last_error: null, last_seen: '2026-09-26T19:02:00+03:00', pending_user_count: 1, managed_user_count: null, zone: null, last_access: null },
  ],
};

/** The honest message for each feed state the entry center cannot show stations in. */
const FEED_PANELS: Record<Exclude<IntercomFeedState, 'ready'>, { panel: PanelState; heading: string; hint: string }> = {
  ha_not_configured: {
    panel: 'stale',
    heading: 'WisKey אינו מחובר בסביבה הזו',
    hint: 'ל־SMPLWISE אין כאן גישה ל־Home Assistant, ולכן אין נתוני אינטרקום להצגה. בתוך Home Assistant המסך מתחבר לאינטגרציית WisKey (hikvision_intercom) מעצמו.',
  },
  connecting: { panel: 'loading', heading: 'מתחבר ל־WisKey…', hint: 'הנתונים יופיעו ברגע ש־Home Assistant יענה.' },
  ha_unavailable: { panel: 'stale', heading: 'Home Assistant אינו זמין כרגע', hint: 'אין חיבור ל־Home Assistant, ולכן אין נתוני אינטרקום עדכניים. החיבור מתחדש אוטומטית.' },
  not_installed: {
    panel: 'empty',
    heading: 'אינטגרציית WisKey אינה מותקנת ב־Home Assistant',
    hint: 'Home Assistant לא מכיר את הפקודות של WisKey (hikvision_intercom). אחרי התקנה המסך יתחבר אליה מעצמו תוך כמה דקות.',
  },
  forbidden: { panel: 'forbidden', heading: 'WisKey דחה את הגישה של SMPLWISE', hint: 'המשתמש של ה־Add-on ב־Home Assistant אינו מורשה בהרשאות של WisKey, ולכן אין נתונים להצגה.' },
  error: { panel: 'error', heading: 'WisKey החזיר שגיאה', hint: 'הבקשה ל־WisKey לא הושלמה. הניסיון יחזור אוטומטית.' },
};

/**
 * WisKey tab: the entry center (CR-005 phase 1a, read-only). Ported from the owner's WisKey frontend - the WisKey 04
 * overview (`wiskeyOverview()`, wiskey-v4-overview.ts: stats, search, door filter, door grid, recent activity,
 * attention) and the station last-access block (panel.ts `lastAccess()`) - with WisKey's `hass.callWS` replaced by the
 * SMPLWISE API and WisKey's styles replaced by SMPLWISE's own components. No release, call, camera or edit controls:
 * those are later, separately approved phases.
 */
@customElement('wiskey-overview')
export class WiskeyOverview extends LitElement {
  @state() private feed: IntercomFeed | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private query = '';
  @state() private filter: DoorFilter = 'all';
  @state() private page = 0;
  private stop: (() => void) | null = null;
  private poll = 0;
  private loading = false;
  private loadAgain = false;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    if (!can('access.read')) {
      this.forbidden = true;
      return;
    }
    void this.load();
    this.stop = subscribeIntercom(
      (m) => {
        if (m.type !== 'heartbeat') void this.load();
      },
      (connected) => {
        this.setPolling(!connected);
        if (connected) void this.load(); // notices sent while the socket was down are gone: catch up now
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    this.setPolling(false);
  }

  private setPolling(on: boolean) {
    window.clearInterval(this.poll);
    this.poll = on ? window.setInterval(() => void this.load(), POLL_MS) : 0;
  }

  /** Single-flight refetch with coalescing, as WisKey's own `refresh()` (`_refreshAgain`). */
  private async load() {
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    try {
      do {
        this.loadAgain = false;
        try {
          this.feed = await getIntercomOverview();
          this.error = '';
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) this.forbidden = true;
          else this.error = describeError(err);
        }
      } while (this.loadAgain);
    } finally {
      this.loading = false;
    }
  }

  // ------------------------------------------------------------------ render

  render() {
    if (!isApi()) return this.renderPage({ state: 'ready', configured: true, fresh: true, fetched_at: null, last_error: null, overview: DEMO }, true);
    if (this.forbidden) {
      return html`<sw-page heading="WisKey" subheading="מרכז הכניסה"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (!this.feed) {
      return html`<sw-page heading="WisKey" subheading="מרכז הכניסה">${this.error
        ? html`<sw-state-panel data-wiskey-state="load_error" state="error" heading="לא ניתן לטעון את מרכז הכניסה" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    return this.renderPage(this.feed, false);
  }

  private renderPage(feed: IntercomFeed, demo: boolean) {
    const ov = feed.overview;
    const sub = `${t('wk4_entry_intro')} · צפייה בלבד${demo ? ' · נתוני הדגמה' : ''}`;
    return html`<sw-page heading="WisKey · ${t('wk4_entry_center')}" subheading=${sub} wide>
      ${this.renderFeedBadge(feed, demo)}
      ${ov && feed.state !== 'ready' ? this.renderStaleNote(feed) : nothing}
      ${this.error ? html`<div class="note err" role="status">${this.error}</div>` : nothing}
      ${ov ? this.renderOverview(ov) : this.renderFeedPanel(feed)}
    </sw-page>`;
  }

  private renderFeedBadge(feed: IntercomFeed, demo: boolean) {
    if (demo) return html`<sw-badge slot="actions" kind="neutral" label="נתוני הדגמה"></sw-badge>`;
    const kind: StateKind = feed.state === 'ready' ? 'live' : feed.state === 'connecting' ? 'unknown' : feed.state === 'forbidden' ? 'forbidden' : feed.state === 'error' ? 'error' : 'offline';
    const label = feed.state === 'ready' ? `מחובר ל־WisKey${feed.overview?.version ? ` ${feed.overview.version}` : ''}` : feed.state === 'connecting' ? 'מתחבר' : 'לא מחובר';
    return html`<sw-badge slot="actions" data-wiskey-feed=${feed.state} kind=${kind} label=${label}></sw-badge>`;
  }

  private renderFeedPanel(feed: IntercomFeed) {
    const p = FEED_PANELS[feed.state === 'ready' ? 'error' : feed.state];
    return html`<sw-state-panel data-wiskey-state=${feed.state} state=${p.panel} heading=${p.heading} hint=${p.hint}></sw-state-panel>`;
  }

  private renderStaleNote(feed: IntercomFeed) {
    return html`<div class="note stale" role="status" data-wiskey-stale>
      <sw-icon name="offline" size=${16}></sw-icon>
      <span>${FEED_PANELS[feed.state === 'ready' ? 'error' : feed.state].heading}. מוצג המידע האחרון שהתקבל${feed.fetched_at ? html` (<bdi>${formatTime(feed.fetched_at, 'he-IL', feed.overview?.default_zone ?? UTC_ZONE)}</bdi>)` : nothing} - ייתכן שאינו עדכני.</span>
    </div>`;
  }

  private renderOverview(o: IntercomOverview) {
    // --- ported from wiskeyOverview() (wiskey-v4-overview.ts:41-68)
    const all = o.stations;
    const ringing = all.filter((s) => s.call_state === 'ringing' && s.online);
    const attention = all.filter((s) => !s.online || !!s.last_error || s.pending_user_count > 0);
    const q = this.query.trim().toLocaleLowerCase();
    const matches = all.filter((s) => {
      if (!s.name.toLocaleLowerCase().includes(q)) return false;
      return this.filter === 'all' || (this.filter === 'online' && s.online) || (this.filter === 'attention' && attention.includes(s));
    });
    const pages = Math.max(1, Math.ceil(matches.length / PAGE));
    const page = Math.min(this.page, pages - 1);
    const visible = matches.slice(page * PAGE, (page + 1) * PAGE);
    const events = all
      .filter((s) => s.last_access)
      // by instant, not by text: device time carries the station's own offset, received time is +00:00 (a string
      // sort puts 05:30+00:00 below 07:59+03:00; WisKey's own sort does that, CR-005 fixes it rather than keeps it)
      .sort((a, b) => instant(b.last_access!.timestamp) - instant(a.last_access!.timestamp))
      .slice(0, 5);
    const pending = all.reduce((sum, s) => sum + s.pending_user_count, 0); // panel.ts pendingCount()
    const zone = o.default_zone ?? UTC_ZONE;
    // panel.ts sorts the legacy grid ringing-first; the WisKey 04 grid keeps WisKey's own order
    return html`
      <div class="stats" data-wiskey-stats aria-label="סיכום">
        <sw-kpi icon="door" tone=${all.length && all.every((s) => s.online) ? 'live' : all.some((s) => !s.online) ? 'offline' : 'neutral'} label=${t('online_stations')} value=${`⁦${all.filter((s) => s.online).length} / ${all.length}⁩`}></sw-kpi>
        <sw-kpi icon="users" label=${t('total_users')} value=${String(o.user_count)}></sw-kpi>
        <sw-kpi icon="bell" tone=${ringing.length ? 'stale' : 'neutral'} label=${t('ringing_now')} value=${String(ringing.length)}></sw-kpi>
        <sw-kpi icon="refresh" tone=${pending ? 'stale' : 'neutral'} label=${t('pending_sync')} value=${String(pending)}></sw-kpi>
      </div>
      <div class="layout">
        <div class="main">
          <div class="toolbar">
            <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wiskey-search aria-label=${t('wall_search')} placeholder=${t('wall_search')} .value=${this.query} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.page = 0; }} /></label>
            <div class="filters" role="group" aria-label=${t('wk4_door_filter')}>
              ${(['all', 'online', 'attention'] as const).map((f) => html`<sw-chip data-wiskey-filter=${f} ?selected=${this.filter === f} aria-pressed=${this.filter === f} @click=${() => { this.filter = f; this.page = 0; }}>${t('wk4_filter_' + f)}</sw-chip>`)}
            </div>
            <span class="count" data-wiskey-count>${matches.length} ${t('devices')}</span>
          </div>
          ${matches.length
            ? html`<div class="grid">${repeat(visible, (s) => s.id, (s) => this.renderDoor(s, zone))}</div>`
            : html`<sw-state-panel compact state="empty" data-wiskey-empty heading=${all.length ? 'לא נמצאו דלתות תואמות' : t('no_stations')}></sw-state-panel>`}
          ${pages > 1
            ? html`<div class="pager">
                <sw-button size="sm" variant="ghost" ?disabled=${page === 0} @click=${() => (this.page = page - 1)}>${t('wall_previous')}</sw-button>
                <span role="status"><bdi>${page + 1} / ${pages}</bdi></span>
                <sw-button size="sm" variant="ghost" ?disabled=${page + 1 >= pages} @click=${() => (this.page = page + 1)}>${t('wall_next')}</sw-button>
              </div>`
            : nothing}
        </div>
        <aside class="side">
          <sw-card heading=${t('access_recent_activity')} data-wiskey-activity>
            ${events.length
              ? events.map((s) => html`<div class="event">
                  <strong>${s.last_access!.person_name || t('unknown')}</strong>
                  <small>${s.name} · ${t(s.last_access!.authentication)}</small>
                  <time><bdi>${formatTime(s.last_access!.timestamp, 'he-IL', zone)}</bdi></time>
                </div>`)
              : html`<p class="muted">${t('no_events')}</p>`}
          </sw-card>
          ${attention.length
            ? html`<sw-card heading=${t('access_attention')} data-wiskey-attention>
                <sw-badge slot="actions" kind="stale" label=${String(attention.length)}></sw-badge>
                ${attention.slice(0, 5).map((s) => html`<div class="attn"><strong>${s.name}</strong><small>${!s.online ? t('offline') : s.last_error || t('pending_sync')}</small></div>`)}
              </sw-card>`
            : nothing}
        </aside>
      </div>
    `;
  }

  private renderDoor(s: IntercomStation, zone: typeof UTC_ZONE) {
    const status = !s.online ? 'offline' : s.call_state === 'ringing' ? 'ringing' : 'online';
    const kind: StateKind = status === 'offline' ? 'offline' : status === 'ringing' ? 'stale' : 'live';
    return html`<article class="door ${status}" data-wiskey-door=${s.id} data-status=${status}>
      <div class="door-head">
        <span class="ic"><sw-icon name=${s.online ? 'door' : 'offline'} size=${18}></sw-icon></span>
        <div class="title">
          <b title=${s.name}>${s.name}</b>
          <small>${!s.online && s.last_seen
            ? html`${t('last_seen')}: <bdi>${formatTime(s.last_seen, 'he-IL', zone)}</bdi>`
            : s.pending_user_count
              ? `${t('pending_users')}: ${s.pending_user_count}`
              : t('access_by_permissions')}</small>
        </div>
        <sw-badge kind=${kind} label=${t(status)}></sw-badge>
      </div>
      ${status === 'ringing' ? html`<div class="ring" role="status"><sw-icon name="bell" size=${14}></sw-icon>${t('ringing')}</div>` : nothing}
      <div class="facts">
        <span>${s.lock_enabled ? (s.lock_count > 1 ? `${t('lock_enabled')} · ${s.lock_count}` : t('lock_enabled')) : t('camera_only')}</span>
        <span>סנכרון: ${t(s.sync_state)}</span>
        ${s.online && s.call_state !== 'ringing' ? html`<span>שיחה: ${t(s.call_state)}</span>` : nothing}
      </div>
      ${this.renderLastAccess(s)}
    </article>`;
  }

  /** panel.ts `lastAccess()` (1079-1096): the station's last access in the station's own clock zone. */
  private renderLastAccess(s: IntercomStation) {
    const e = s.last_access;
    return html`<div class="last" data-wiskey-last>
      <span class="muted">${t('last_access')}</span>
      ${e
        ? html`<div>${e.person_name ?? e.employee_no ?? t('unknown_person')}</div>
            <div class="muted">${t(e.event_type)} · ${t(e.authentication)}</div>
            <div class="muted">
              <bdi>${formatTime(e.timestamp, 'he-IL', s.zone ?? UTC_ZONE)}</bdi>
              ${!e.person_name && !e.employee_no ? html`<div>${t('identity_unavailable')}</div>` : nothing}
              ${e.time_source === 'received' ? html` · ${t('receipt_time')}` : nothing}
              ${e.recovered ? html` · ${t('historical_record')}` : nothing}
            </div>`
        : html`<div class="muted">${t('no_access_recorded')}</div>`}
    </div>`;
  }

  static styles = css`
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 1000px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .main,
    .side {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .search {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding-inline: 10px;
      min-block-size: 34px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-3);
      flex: 1 1 220px;
      max-inline-size: 360px;
    }
    .search input {
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      color: var(--sw-text);
      inline-size: 100%;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .count {
      margin-inline-start: auto;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    .door {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
    }
    .door.ringing {
      border-color: var(--sw-warning);
      box-shadow: 0 0 0 3px var(--sw-warning-soft);
    }
    .door.offline {
      background: var(--sw-surface-2);
    }
    .door-head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 8px;
      background: var(--sw-live-soft);
      color: var(--sw-success);
      flex: none;
    }
    .door.offline .ic {
      background: var(--sw-offline-soft);
      color: var(--sw-offline);
    }
    .door.ringing .ic {
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
    }
    .title {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .title b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    small,
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ring {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .last {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .event,
    .attn {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .event:last-child,
    .attn:last-child {
      border-block-end: 0;
    }
    .event time {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note.stale {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
  `;
}

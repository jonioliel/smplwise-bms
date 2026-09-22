import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-kpi';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-scene';
import '../components/sw-camera-tile';
import { demoEvents, demoHealth, demoScene, demoSites, demoWall, eventTypeLabel } from '../fixtures/catalog';
import { navigate } from '../router';
import { isApi, session } from '../api/session';
import { ApiError, get } from '../api/client';
import { listCameras } from '../api/maps';
import { eventsSummary, listEvents, thumbnailUrl, EVENT_LABEL, EVENT_TONE as API_EVENT_TONE, type EventsSummary, type VmsEvent } from '../api/events';
import { getStorage, fmtMb, type StorageReport } from '../api/storage';
import { healthSummary, STATUS_LABEL, type HealthSummary } from '../api/health';
import { productSettings } from '../api/prefs';
import { snapshotUrl } from '../api/media';
import type { Camera, Site } from '../api/types';

/** GET /api/v1/health — connection facts used for the attention list. */
interface RawHealth {
  events: { ingest: { connected: boolean; last_event_at: string | null; events_stored: number } };
  home_assistant: { configured: boolean; connected: boolean; last_error: string | null };
  discovery: { cameras_last_error: string | null };
}

interface Spot {
  kind: 'critical' | 'alert' | 'info';
  title: string;
  meta: string;
  why: string;
  link: string;
}

function greeting(hour: number): string {
  if (hour < 5) return 'לילה טוב';
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

const EVENT_TONE: Record<string, string> = { person: 'var(--sw-accent)', vehicle: 'var(--sw-live)', motion: 'var(--sw-danger)', line: 'var(--sw-stale)', offline: 'var(--sw-offline)', door: 'var(--sw-purple)' };
const EVENT_SCENE: Record<string, string> = { 'כניסה ראשית': 'entrance', 'חצר אחורית': 'backyard', מחסן: 'warehouse', לובי: 'lobby', 'חניה מקורה': 'parking' };

/**
 * SC01 — overview dashboard (board 1 screen 1 / board 2 screen 15 on phones): greeting, four stat
 * cards, storage donut beside site health, and recent events with thumbnails. Attention items say why
 * they are shown (deterministic rules, no scoring).
 */
@customElement('live-overview')
export class LiveOverview extends LitElement {
  @state() private cams: Camera[] | null = null;
  @state() private recorder: { name: string; model: string | null } | null = null;
  @state() private sites: Site[] | null = null;
  @state() private summary: EventsSummary | null = null;
  @state() private summaryDenied = false; // events.read missing: the KPI says so instead of a misleading 0 (0.1.80)
  @state() private recent: VmsEvent[] = [];
  @state() private storage: StorageReport | null = null;
  @state() private health: HealthSummary | null = null;
  @state() private raw: RawHealth | null = null;
  @state() private tz = 'Asia/Jerusalem';
  @state() private now = new Date();
  @state() private loaded = false;
  private timer = 0;
  private clockTimer = 0;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    void this.load();
    this.timer = window.setInterval(() => void this.load(), 60_000);
    this.clockTimer = window.setInterval(() => (this.now = new Date()), 30_000);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
    window.clearInterval(this.clockTimer);
    super.disconnectedCallback();
  }

  private async load() {
    // the storage report can take tens of seconds when its cache is cold: never let it hold the rest back
    void this.loadStorage();
    const [settings, cams, sites, summary, recent, health, raw] = await Promise.allSettled([
      productSettings(),
      listCameras(),
      get<{ sites: Site[] }>('sites?tree=true'),
      eventsSummary(),
      listEvents({ limit: 6 }),
      healthSummary(),
      get<RawHealth>('health'),
    ]);
    if (settings.status === 'fulfilled') this.tz = settings.value['time.zone'] ?? this.tz;
    if (cams.status === 'fulfilled') {
      this.cams = cams.value.cameras.filter((c) => c.enabled);
      this.recorder = cams.value.recorder;
    } else if (this.cams === null) this.cams = [];
    if (sites.status === 'fulfilled') this.sites = sites.value.sites;
    else if (this.sites === null) this.sites = [];
    if (summary.status === 'fulfilled') this.summary = summary.value;
    else this.summaryDenied = summary.reason instanceof ApiError && summary.reason.status === 403;
    if (recent.status === 'fulfilled') this.recent = recent.value.events;
    if (health.status === 'fulfilled') this.health = health.value;
    if (raw.status === 'fulfilled') this.raw = raw.value;
    this.loaded = true;
    this.now = new Date();
  }

  private async loadStorage() {
    try {
      this.storage = await getStorage(); // 403 for non-admins: the card is simply absent
    } catch {
      this.storage = null;
    }
  }

  private fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: this.tz });
  }

  private spots(): Spot[] {
    const out: Spot[] = [];
    const cams = this.cams ?? [];
    for (const c of cams.filter((x) => x.status === 'offline')) {
      out.push({ kind: 'critical', title: `מצלמה מנותקת: ${c.name}`, meta: `ערוץ ${c.channel}${c.last_seen_at ? ` · נראתה לאחרונה ${this.fmtTime(c.last_seen_at)}` : ''}`, why: 'מוצג כי ה־NVR מדווח שהערוץ אינו מחובר', link: `#/live/cameras/${c.id}` });
    }
    for (const it of (this.health?.items ?? []).filter((i) => i.status !== 'ok')) {
      out.push({ kind: it.status === 'error' ? 'critical' : 'alert', title: it.label, meta: `בדיקת מערכת · ${STATUS_LABEL[it.status]}`, why: 'מוצג כי בדיקת הבריאות של ה־Add-on מדווחת על כך', link: '#/system/diagnostics' });
    }
    const un = this.summary?.today.unacked ?? 0;
    if (un > 0) {
      const by = Object.entries(this.summary?.today.by_type ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${EVENT_LABEL[t as keyof typeof EVENT_LABEL] ?? t} ${n}`).join(' · ');
      out.push({ kind: 'alert', title: `${un} אירועים שלא נבדקו היום`, meta: by, why: 'מוצג כי אירועים ממתינים לסימון טיפול במרכז האירועים', link: '#/investigate/events' });
    }
    const ing = this.raw?.events.ingest;
    if (ing?.connected && !ing.events_stored && !ing.last_event_at) {
      out.push({ kind: 'info', title: 'ה־NVR לא שלח התראות מאז ההפעלה', meta: 'אירועי תנועה נגזרים מההקלטות כל 10 דקות', why: 'מוצג כי זרם ההתראות מחובר אך ריק — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה', link: '#/system/setup' });
    }
    if (this.raw?.home_assistant.configured && !this.raw.home_assistant.connected) {
      out.push({ kind: 'alert', title: 'אין חיבור ל־Home Assistant', meta: this.raw.home_assistant.last_error ?? '', why: 'מוצג כי מצבי הישויות והדלתות עלולים להיות מיושנים', link: '#/system/setup' });
    }
    return out;
  }

  private renderApi() {
    const me = session.me?.user;
    const name = me?.display_name || me?.username || '';
    const hour = Number(this.now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: this.tz }));
    const cams = this.cams ?? [];
    const online = cams.filter((c) => c.status === 'online').length;
    const sites = this.sites ?? [];
    const floors = sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => b.floors ?? []));
    const h = this.health;
    const tone = !h ? 'neutral' : h.status === 'ok' ? 'live' : h.status === 'warn' ? 'stale' : 'offline';
    const firstIssue = h?.items.find((i) => i.status !== 'ok');
    const spots = this.loaded ? this.spots() : [];
    const st = this.storage;
    const tot = st?.totals ?? null;
    const usedPct = tot?.used_pct ?? null;
    const r = 34;
    const c = 2 * Math.PI * r;
    const favorites = cams.filter((x) => x.status === 'online').slice(0, 2);
    return html`
      <sw-page heading=${`${greeting(hour)}${name ? `, ${name}` : ''}`} subheading=${h ? `מצב המערכת: ${STATUS_LABEL[h.status]}${firstIssue ? ` · ${firstIssue.label}` : ' · כל הבדיקות תקינות'}` : 'קורא את מצב המערכת…'}>
        <div slot="actions" class="date">${this.now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: this.tz })}<br />${this.now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: this.tz })}</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi icon="camera" tone=${cams.length && online === cams.length ? 'live' : online ? 'stale' : 'offline'} value=${`${online}/${cams.length}`} label="מצלמות" detail=${this.recorder ? `מחוברות · ${this.recorder.model ?? this.recorder.name}` : 'מחוברות'}></sw-kpi>
          <sw-kpi icon="building" value=${String(sites.length)} label="אתרים" detail=${`${floors.length} קומות · ${floors.filter((f) => f.has_plan).length} עם תוכנית`} tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" value=${this.summaryDenied ? '—' : String(this.summary?.today.total ?? 0)} label="אירועים" detail=${this.summaryDenied ? 'ללא הרשאה לאירועים' : 'היום'} tone="neutral" badge=${this.summary?.today.unacked ? `${this.summary.today.unacked} לבדיקה` : ''}></sw-kpi>
          <sw-kpi icon="shield" tone=${tone} value=${h ? STATUS_LABEL[h.status] : '…'} label="מצב מערכת" detail=${firstIssue ? firstIssue.label : 'NVR, go2rtc, HA ואחסון'}></sw-kpi>
        </div>
        ${favorites.length
          ? html`<div class="fav" data-overview-favorites>
              ${favorites.map((cam) => html`<sw-camera-tile name=${cam.name} state="live" cameraId=${cam.id} poster=${snapshotUrl(cam.id)} noDemo @click=${() => navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`)}
            </div>`
          : nothing}
        <div class="row2">
          ${st && tot
            ? html`<sw-card heading="אחסון" subheading=${st.cached ? 'מהמטמון · נמדד מול ה־NVR' : 'נמדד מול ה־NVR'}>
                <div class="donut">
                  <svg viewBox="0 0 84 84" role="img" aria-label=${`אחסון בשימוש ${usedPct ?? 0}%`}>
                    ${svg`<circle cx="42" cy="42" r=${r} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                    <circle cx="42" cy="42" r=${r} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${(c * (usedPct ?? 0)) / 100} ${c}`} transform="rotate(-90 42 42)" />
                    <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">${usedPct ?? 0}%</text>`}
                  </svg>
                  <div class="txt">
                    <div class="big">${fmtMb(tot.used_mb)} מתוך ${fmtMb(tot.capacity_mb)}</div>
                    <div class="bar"><i style=${`inline-size:${usedPct ?? 0}%`}></i></div>
                    <div class="muted">${st.retention.measured_days_min !== null ? `הקלטה ישנה ביותר ≈ ${st.retention.measured_days_min}${st.retention.measured_days_max !== null && st.retention.measured_days_max !== st.retention.measured_days_min ? `–${st.retention.measured_days_max}` : ''} ימים (נמדד)` : st.retention.measured_reason}${st.work_mode ? ` · ${st.work_mode}` : ''} · ${tot.disks} דיסקים</div>
                  </div>
                </div>
              </sw-card>`
            : nothing}
          <sw-card heading="אתרים ומבנים" subheading=${sites.length ? `${sites.length} אתרים · ${floors.length} קומות` : 'עדיין לא הוגדרו אתרים'}>
            ${sites.map((s) => {
              const fl = (s.buildings ?? []).flatMap((b) => b.floors ?? []);
              const plans = fl.filter((f) => f.has_plan).length;
              const placed = fl.reduce((n, f) => n + f.camera_count, 0);
              return html`<div class="hrow" @click=${() => navigate('/explore/sites')} style="cursor:pointer"><span>${s.name}<div class="muted">${(s.buildings ?? []).length} מבנים · ${fl.length} קומות · ${placed} מצלמות מוצבות · ${plans}/${fl.length} תוכניות</div></span><span class="status"><i style=${`--c:${fl.length && plans === fl.length ? 'var(--sw-live)' : 'var(--sw-stale)'}`}></i>${fl.length && plans === fl.length ? 'תוכניות מפורסמות' : 'חסרות תוכניות'}</span></div>`;
            })}
            ${this.recorder ? html`<div class="hrow"><span>NVR · ${this.recorder.name}<div class="muted">${this.recorder.model ?? ''} · ${online}/${cams.length} מצלמות מחוברות</div></span><span class="status"><i style=${`--c:${online === cams.length ? 'var(--sw-live)' : 'var(--sw-offline)'}`}></i>${online === cams.length ? 'מחובר' : `${cams.length - online} מנותקות`}</span></div>` : nothing}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card heading="אירועים אחרונים" subheading=${this.summary ? `${this.summary.today.total} היום · ${this.summary.today.measured} נמדדו · ${this.summary.today.inferred} נגזרו מהקלטה` : ''}>
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${this.recent.length
              ? this.recent.map(
                  (e) => html`<div class="ev" data-overview-event @click=${() => navigate(`/investigate/events/${e.id}`)}>
                    ${e.thumbnail === 'ready'
                      ? html`<img class="thumb" src=${thumbnailUrl(e.id)} alt="" loading="lazy" />`
                      : html`<div class="none"><sw-icon name=${e.type === 'offline' || e.type === 'coverage_gap' ? 'offline' : e.type === 'door' || e.type === 'io' ? 'door' : e.type === 'person' ? 'user' : e.type === 'vehicle' ? 'route' : 'bell'} size=${14}></sw-icon></div>`}
                    <div class="txt"><b style=${`--tone:${API_EVENT_TONE[e.type as keyof typeof API_EVENT_TONE] ?? '#6b7280'}`}><i></i>${EVENT_LABEL[e.type as keyof typeof EVENT_LABEL] ?? e.type}${e.acked_at ? '' : ' · לבדיקה'}</b><small>${e.camera_name ?? (e.details as { name?: string } | undefined)?.name ?? 'ללא מצלמה'} · ${e.confidence === 'inferred' ? 'נגזר מהקלטה' : e.source === 'ha' ? 'חיישן HA' : 'התראה'}</small></div>
                    <time>${this.fmtTime(e.occurred_at)}</time>
                  </div>`,
                )
              : html`<div class="muted">${this.loaded ? 'אין אירועים ב־24 השעות האחרונות' : 'טוען…'}</div>`}
          </sw-card>
          <sw-card heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${spots.length
              ? spots.map(
                  (s) => html`<div class="spot ${s.kind}" data-overview-spot>
                    <div class="ic"><sw-icon name=${s.kind === 'critical' ? 'offline' : s.kind === 'info' ? 'info' : 'warning'} size=${15}></sw-icon></div>
                    <div><div class="t">${s.title}</div><div class="muted">${s.meta}</div><div class="why">${s.why}</div></div>
                    <div class="actions"><a href=${s.link}><sw-button size="sm">פתח</sw-button></a></div>
                  </div>`,
                )
              : html`<div class="muted" data-overview-calm>${this.loaded ? 'הכול תקין — אין פריטים שדורשים תשומת לב כרגע.' : 'בודק…'}</div>`}
          </sw-card>
        </div>
      </sw-page>
    `;
  }

  static styles = css`
    .date {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: end;
      line-height: 1.3;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .row2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 12px;
      align-items: stretch;
    }
    .row3 {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .donut {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .donut svg {
      inline-size: 84px;
      block-size: 84px;
      flex-shrink: 0;
    }
    .donut .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .donut .big {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
      margin-block: 6px 4px;
    }
    .bar i {
      display: block;
      block-size: 100%;
      inline-size: 68%;
      background: var(--sw-accent);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .hrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .hrow:last-child {
      border-block-end: 0;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
    }
    .ev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .ev:last-child {
      border-block-end: 0;
    }
    .ev sw-scene,
    .ev img.thumb,
    .ev .none {
      inline-size: 56px;
      block-size: 36px;
      border-radius: 6px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .ev img.thumb {
      object-fit: cover;
      display: block;
      background: var(--sw-surface-3);
    }
    .spot.info .ic {
      color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .ev .none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .ev .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .ev .txt b {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .ev .txt b i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--tone);
      flex-shrink: 0;
    }
    .ev .txt small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      display: block;
    }
    .ev time {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .spot {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      align-items: flex-start;
      font-size: var(--sw-fs-sm);
    }
    .spot:last-child {
      border-block-end: 0;
    }
    .spot .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
      flex-shrink: 0;
    }
    .spot.critical .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .spot .t {
      font-weight: var(--sw-fw-semibold);
    }
    .spot .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .spot .actions {
      margin-inline-start: auto;
      align-self: center;
    }
    .seeall {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .fav {
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 1023px) {
      .row2,
      .row3 {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .fav {
        display: grid;
      }
      .date {
        display: none;
      }
    }
  `;

  render() {
    if (isApi()) return this.renderApi();
    const online = demoWall.filter((c) => c.state === 'live' || c.state === 'stale').length;
    const unacked = demoEvents.filter((e) => !e.acked);
    const spotlights = [
      { kind: 'critical', title: 'מצלמה מנותקת: מסדרון מזרחי', meta: 'קומה 0 · מאז 07:55', why: 'מוצג כי אין הקלטה ממצלמה זו כבר שעתיים', link: '#/system/devices' },
      { kind: 'alert', title: `${unacked.length} אירועים שלא נבדקו`, meta: 'אדם בכניסה הראשית 10:14, רכב בחצר 09:42', why: 'מוצג כי אירועי אדם/רכב מחכים לסימון טיפול', link: '#/investigate/events' },
      { kind: 'alert', title: 'החיבור ל־Home Assistant לא רענן', meta: 'סנכרון אחרון לפני 4 דק׳', why: 'מוצג כי מצבי הישויות עלולים להיות מיושנים', link: '#/system/diagnostics' },
    ];
    const used = 0.68;
    const r = 34;
    const c = 2 * Math.PI * r;
    const favorites = demoWall.filter((x) => x.state === 'live').slice(0, 2);
    return html`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר Home Assistant לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis">
          <sw-kpi icon="camera" tone="live" value=${String(online)} label="מצלמות" detail="מחוברות"></sw-kpi>
          <sw-kpi icon="building" value=${String(demoSites.length)} label="אתרים" detail="פעילים" tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" value=${String(demoEvents.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${unacked.length} חדשים`}></sw-kpi>
          <sw-kpi icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
        </div>
        <div class="fav">
          ${favorites.map((cam) => html`<sw-camera-tile name=${cam.name} state=${cam.state} scene=${demoScene[cam.id] ?? 'lobby'} @click=${() => navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${svg`<circle cx="42" cy="42" r=${r} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${r} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${c * used} ${c}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
              </svg>
              <div class="txt">
                <div class="big">1.3 TB מתוך 1.9 TB</div>
                <div class="bar"><i></i></div>
                <div class="muted">הקלטה ישנה ביותר ≈ 11 ימים (נמדד) · overwrite פעיל</div>
              </div>
            </div>
          </sw-card>
          <sw-card heading="בריאות האתרים">
            ${demoSites.map((s) => html`<div class="hrow"><span>${s.name}<div class="muted">${s.online}/${s.cameras} מצלמות · ${s.alerts} התראות</div></span><span class="status"><i style="--c:${s.health === 'live' ? 'var(--sw-live)' : s.health === 'offline' ? 'var(--sw-danger)' : 'var(--sw-stale)'}"></i>${s.health === 'live' ? 'מחובר' : s.health === 'offline' ? 'מנותק' : 'חלקי'}</span></div>`)}
            ${demoHealth.slice(0, 2).map((h) => html`<div class="hrow"><span>${h.name}<div class="muted">${h.detail}</div></span><span class="status"><i style="--c:${h.state === 'live' ? 'var(--sw-live)' : 'var(--sw-stale)'}"></i>${h.state === 'live' ? 'מחובר' : 'לא רענן'}</span></div>`)}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${demoEvents.slice(0, 5).map(
              (e) => html`<div class="ev" @click=${() => navigate('/investigate/events')}>
                ${e.type === 'offline' || e.type === 'door'
                  ? html`<div class="none"><sw-icon name=${e.type === 'offline' ? 'offline' : 'door'} size=${14}></sw-icon></div>`
                  : html`<sw-scene kind=${(EVENT_SCENE[e.camera] ?? 'lobby') as 'lobby'}></sw-scene>`}
                <div class="txt"><b style="--tone:${EVENT_TONE[e.type]}"><i></i>${eventTypeLabel[e.type]}</b><small>${e.camera} · ${e.floor}</small></div>
                <time>${e.time}</time>
              </div>`,
            )}
          </sw-card>
          <sw-card heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${spotlights.map(
              (s) => html`<div class="spot ${s.kind}">
                <div class="ic"><sw-icon name=${s.kind === 'critical' ? 'offline' : 'warning'} size=${15}></sw-icon></div>
                <div><div class="t">${s.title}</div><div class="muted">${s.meta}</div><div class="why">${s.why}</div></div>
                <div class="actions"><a href=${s.link}><sw-button size="sm">פתח</sw-button></a></div>
              </div>`,
            )}
          </sw-card>
        </div>
      </sw-page>
    `;
  }
}

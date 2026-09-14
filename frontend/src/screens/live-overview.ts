import { LitElement, html, css, svg } from 'lit';
import { customElement } from 'lit/decorators.js';
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

const EVENT_TONE: Record<string, string> = { person: 'var(--sw-accent)', vehicle: 'var(--sw-live)', motion: 'var(--sw-danger)', line: 'var(--sw-stale)', offline: 'var(--sw-offline)', door: 'var(--sw-purple)' };
const EVENT_SCENE: Record<string, string> = { 'כניסה ראשית': 'entrance', 'חצר אחורית': 'backyard', מחסן: 'warehouse', לובי: 'lobby', 'חניה מקורה': 'parking' };

/**
 * SC01 — overview dashboard (board 1 screen 1 / board 2 screen 15 on phones): greeting, four stat
 * cards, storage donut beside site health, and recent events with thumbnails. Attention items say why
 * they are shown (deterministic rules, no scoring).
 */
@customElement('live-overview')
export class LiveOverview extends LitElement {
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
    .ev .none {
      inline-size: 56px;
      block-size: 36px;
      border-radius: 6px;
      flex-shrink: 0;
      overflow: hidden;
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

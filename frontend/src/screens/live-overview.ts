import { LitElement, html, css, svg } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-kpi';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-camera-tile';
import '../components/sw-tabs';
import { demoEvents, demoHealth, demoScene, demoSites, demoWall, eventTypeLabel } from '../fixtures/catalog';
import { navigate } from '../router';

const EVENT_TONE: Record<string, string> = { person: 'var(--sw-accent)', vehicle: 'var(--sw-live)', motion: 'var(--sw-danger)', line: 'var(--sw-stale)', offline: 'var(--sw-offline)', door: 'var(--sw-purple)' };

/**
 * SC01 — dashboard (board 1 screen 1): greeting, four stat cards, live camera tiles, recent events with
 * thumbnails, health and storage. Spotlight cards say why they are shown (deterministic rules).
 */
@customElement('live-overview')
export class LiveOverview extends LitElement {
  static styles = css`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sw-s-4);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-3);
    }
    .spot {
      display: flex;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3) 0;
      border-block-end: 1px solid var(--sw-border);
      align-items: flex-start;
    }
    .spot:last-child {
      border-block-end: 0;
      padding-block-end: 0;
    }
    .spot .ic {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border-radius: 10px;
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
      font-size: var(--sw-fs-sm);
    }
    .spot .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .spot .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .spot .actions {
      margin-inline-start: auto;
      align-self: center;
    }
    .ev {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .ev:last-child {
      border-block-end: 0;
    }
    .ev .thumb {
      inline-size: 64px;
      block-size: 40px;
      border-radius: 6px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, #e7e2d8 0%, #c9bda9 55%, #6e5f4c 100%);
    }
    .ev .thumb.none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .ev .thumb::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.35) 100%);
    }
    .ev .thumb.none::after {
      display: none;
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
    }
    .ev .txt b i {
      inline-size: 8px;
      block-size: 8px;
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
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .donut {
      display: flex;
      align-items: center;
      gap: var(--sw-s-4);
    }
    .donut svg {
      inline-size: 96px;
      block-size: 96px;
      flex-shrink: 0;
    }
    .donut .lg {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .donut .lg span::before {
      content: '';
      display: inline-block;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 3px;
      margin-inline-end: 8px;
      background: var(--c);
      vertical-align: middle;
    }
    .seeall {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    @media (max-width: 1279px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        gap: var(--sw-s-3);
      }
      .tiles {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const online = demoWall.filter((c) => c.state === 'live' || c.state === 'stale').length;
    const unacked = demoEvents.filter((e) => !e.acked);
    const featured = demoWall.filter((c) => c.state === 'live').slice(0, 4);
    const spotlights = [
      { kind: 'critical', title: 'מצלמה מנותקת: מסדרון מזרחי', meta: 'קומה 0 · מאז 07:55', why: 'מוצג כי אין הקלטה ממצלמה זו כבר שעתיים', link: '#/system/devices' },
      { kind: 'alert', title: `${unacked.length} אירועים שלא נבדקו`, meta: 'אדם בכניסה הראשית 10:14, רכב בחצר 09:42', why: 'מוצג כי אירועי אדם/רכב מחכים לסימון טיפול', link: '#/investigate/events' },
      { kind: 'alert', title: 'החיבור ל־Home Assistant לא רענן', meta: 'סנכרון אחרון לפני 4 דק׳', why: 'מוצג כי מצבי הישויות עלולים להיות מיושנים', link: '#/system/diagnostics' },
    ];
    const used = 0.68;
    const r = 40;
    const c = 2 * Math.PI * r;
    return html`
      <sw-page heading="שלום, יוני" subheading="יום שני, 14 בספטמבר 2026 · המערכת מחוברת · נתוני הדגמה">
        <sw-tabs slot="actions" .items=${[{ id: 'all', label: 'כל האתרים', count: demoSites.length }, { id: 'a', label: 'אתר הדגמה' }]} active="all"></sw-tabs>
        <div class="kpis">
          <sw-kpi icon="camera" tone="live" value=${`${online}/${demoWall.length}`} label="מצלמות מחוברות" detail="▲ 1 מנותקת · 1 מיושנת" badge="1"></sw-kpi>
          <sw-kpi icon="building" value=${String(demoSites.length)} label="אתרים" detail="2 עם התראות" tone="neutral"></sw-kpi>
          <sw-kpi icon="bell" tone="stale" value=${String(unacked.length)} label="אירועים ללא טיפול" detail="ב־24 השעות האחרונות"></sw-kpi>
          <sw-kpi icon="storage" value="68%" label="אחסון בשימוש" detail="≈ 11 ימי הקלטה" tone="live"></sw-kpi>
        </div>
        <div class="grid">
          <div class="stack">
            <sw-card heading="מצלמות חיות" subheading="ארבע המצלמות הראשונות בתצוגה המועדפת">
              <a slot="actions" class="seeall" href="#/live/wall">כל המצלמות ↗</a>
              <div class="tiles">
                ${featured.map((cam) => html`<sw-camera-tile name=${cam.name} meta=${cam.floor} state=${cam.state} scene=${demoScene[cam.id] ?? 'indoor'} stamp="10:24:36" @click=${() => navigate(`/live/cameras/${cam.id}`)}></sw-camera-tile>`)}
              </div>
            </sw-card>
            <sw-card heading="דורש תשומת לב" subheading="כל כרטיס מסביר מדוע הוא מוצג">
              ${spotlights.map(
                (s) => html`<div class="spot ${s.kind}">
                  <div class="ic"><sw-icon name=${s.kind === 'critical' ? 'offline' : 'warning'} size=${18}></sw-icon></div>
                  <div>
                    <div class="t">${s.title}</div>
                    <div class="meta">${s.meta}</div>
                    <div class="why">${s.why}</div>
                  </div>
                  <div class="actions"><a href=${s.link}><sw-button size="sm" variant="secondary">פתח</sw-button></a></div>
                </div>`,
              )}
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="אירועים אחרונים">
              <a slot="actions" class="seeall" href="#/investigate/events">הכל ↗</a>
              ${demoEvents.slice(0, 5).map(
                (e) => html`<div class="ev">
                  <div class="thumb ${e.type === 'offline' || e.type === 'door' ? 'none' : ''}">${e.type === 'offline' || e.type === 'door' ? html`<sw-icon name=${e.type === 'offline' ? 'offline' : 'door'} size=${16}></sw-icon>` : ''}</div>
                  <div class="txt"><b style="--tone:${EVENT_TONE[e.type]}"><i></i>${eventTypeLabel[e.type]}</b><small>${e.camera} · ${e.floor}</small></div>
                  <time>${e.time}</time>
                </div>`,
              )}
            </sw-card>
            <sw-card heading="אחסון">
              <div class="donut">
                <svg viewBox="0 0 100 100" role="img" aria-label="אחסון בשימוש 68%">
                  ${svg`<circle cx="50" cy="50" r=${r} fill="none" stroke="var(--sw-surface-3)" stroke-width="12" />
                  <circle cx="50" cy="50" r=${r} fill="none" stroke="var(--sw-accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray=${`${c * used} ${c}`} transform="rotate(-90 50 50)" />
                  <text x="50" y="54" text-anchor="middle" font-size="18" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
                </svg>
                <div class="lg">
                  <span style="--c: var(--sw-accent)">בשימוש · 1.3 TB</span>
                  <span style="--c: var(--sw-surface-3)">פנוי · 0.6 TB</span>
                  <span class="muted">הקלטה ישנה ביותר ≈ 11 ימים (נמדד)</span>
                </div>
              </div>
            </sw-card>
            <sw-card heading="בריאות רכיבים">
              ${demoHealth.map((h) => html`<div class="row"><span>${h.name}<div class="muted">${h.detail}</div></span><sw-badge kind=${h.state}></sw-badge></div>`)}
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}

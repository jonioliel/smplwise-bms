import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-kpi';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import { demoEvents, demoHealth, demoSites, demoWall, eventTypeLabel } from '../fixtures/catalog';

/** SC01 — overview / Spotlights (board 1, screen 1). Deterministic rules, each card says why it is shown. */
@customElement('live-overview')
export class LiveOverview extends LitElement {
  static styles = css`
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--sw-s-3);
    }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: var(--sw-s-4);
      align-items: start;
    }
    .spot {
      display: flex;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3) 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .spot:last-child {
      border-block-end: 0;
      padding-block-end: 0;
    }
    .spot .ic {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: var(--sw-r-sm);
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
    .spot .meta {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .spot .actions {
      margin-inline-start: auto;
      display: flex;
      gap: var(--sw-s-1);
      align-self: center;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
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
    return html`
      <sw-page heading="שלום, יוני" subheading="סיכום המערכת · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">רענון</sw-button>
        <div class="kpis">
          <sw-kpi icon="camera" tone="live" value=${`${online}/${demoWall.length}`} label="מצלמות מחוברות" detail="1 מנותקת · 1 מיושנת"></sw-kpi>
          <sw-kpi icon="building" value=${String(demoSites.length)} label="אתרים" detail="2 עם התראות"></sw-kpi>
          <sw-kpi icon="warning" tone="stale" value=${String(unacked.length)} label="אירועים ללא טיפול" detail="ב־24 השעות האחרונות"></sw-kpi>
          <sw-kpi icon="check" tone="partial" value="חלקי" label="מצב מערכת" detail="גשר HA לא רענן"></sw-kpi>
        </div>
        <div class="grid">
          <div class="stack">
            <sw-card heading="Spotlights: מה דורש תשומת לב">
              ${spotlights.map(
                (s) => html`<div class="spot ${s.kind}">
                  <div class="ic"><sw-icon name=${s.kind === 'critical' ? 'offline' : 'warning'} size=${20}></sw-icon></div>
                  <div>
                    <div class="t">${s.title}</div>
                    <div class="meta">${s.meta}</div>
                    <div class="why">${s.why}</div>
                  </div>
                  <div class="actions"><a href=${s.link}><sw-button size="sm" variant="ghost" icon="chevron">פתח</sw-button></a></div>
                </div>`,
              )}
            </sw-card>
            <sw-card heading="אירועים אחרונים">
              <a slot="actions" href="#/investigate/events"><sw-button size="sm" variant="ghost">הכל</sw-button></a>
              ${demoEvents.slice(0, 5).map(
                (e) => html`<div class="row">
                  <span><strong>${eventTypeLabel[e.type]}</strong> · ${e.camera}</span>
                  <span class="muted">${e.time}</span>
                  <sw-badge kind=${e.acked ? 'neutral' : 'stale'} label=${e.acked ? 'טופל' : 'ממתין'}></sw-badge>
                </div>`,
              )}
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="בריאות רכיבים">
              ${demoHealth.map((h) => html`<div class="row"><span>${h.name}<div class="muted">${h.detail}</div></span><sw-badge kind=${h.state}></sw-badge></div>`)}
            </sw-card>
            <sw-card heading="אתרים">
              ${demoSites.map((s) => html`<div class="row"><span>${s.name}<div class="muted">${s.online}/${s.cameras} מצלמות · ${s.alerts} התראות</div></span><sw-badge kind=${s.health}></sw-badge></div>`)}
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-icon';
import type { TableColumn } from '../components/sw-table';
import type { StateKind } from '../components/sw-badge';

interface Ent {
  id: string;
  name: string;
  domain: string;
  area: string;
  state: string;
  fresh: StateKind;
  placed: boolean;
  actions: string;
  [k: string]: unknown;
}

const ENTITIES: Ent[] = [
  { id: 'lock.main_door', name: 'דלת כניסה', domain: 'lock', area: 'לובי', state: 'נעול', fresh: 'live', placed: true, actions: 'נעילה / פתיחה (grant נפרד)' },
  { id: 'light.lobby', name: 'תאורת לובי', domain: 'light', area: 'לובי', state: 'דולק · 80%', fresh: 'live', placed: true, actions: 'הדלקה / כיבוי / עמעום' },
  { id: 'binary_sensor.hall_motion', name: 'תנועה באולם', domain: 'binary_sensor', area: 'אולם', state: 'ללא תנועה', fresh: 'live', placed: true, actions: 'קריאה בלבד' },
  { id: 'climate.hall', name: 'מזגן אולם', domain: 'climate', area: 'אולם', state: 'קירור · 23°', fresh: 'stale', placed: false, actions: 'יעד טמפרטורה (allowlist)' },
  { id: 'cover.parking_gate', name: 'שער חניה', domain: 'cover', area: 'חניה', state: 'סגור', fresh: 'live', placed: false, actions: 'פתיחה / סגירה (רגיש)' },
  { id: 'script.night_mode', name: 'מצב לילה', domain: 'script', area: '—', state: '—', fresh: 'unknown', placed: false, actions: 'חסום עד allowlist' },
  { id: 'sensor.power_main', name: 'צריכת חשמל', domain: 'sensor', area: 'חדר מכונות', state: '4.2 kW', fresh: 'live', placed: false, actions: 'קריאה בלבד' },
  { id: 'camera.intercom_m2', name: 'אינטרקום M2', domain: 'camera', area: 'כניסה', state: 'זמין', fresh: 'live', placed: false, actions: 'צפייה (provider נפרד)' },
];

/** SC10 — HA entity catalogue and drawer (new:HA). Import ≠ placement ≠ control permission. */
@customElement('explore-entities')
export class ExploreEntities extends LitElement {
  @state() private selected: string | null = null;
  @state() private domain = 'all';

  static styles = css`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .search {
      flex: 1;
      min-inline-size: 220px;
      max-inline-size: 420px;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;

  private columns: TableColumn[] = [
    { key: 'name', label: 'ישות', render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:7px;background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${r.domain === 'lock' || r.domain === 'cover' ? 'lock' : r.domain === 'light' ? 'light' : r.domain === 'camera' ? 'camera' : r.domain === 'climate' ? 'activity' : 'sensor'} size=${13}></sw-icon></span><span><strong>${String(r.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(r.id)}</div></span></span>` },
    { key: 'domain', label: 'Domain', ltr: true },
    { key: 'area', label: 'אזור HA' },
    { key: 'state', label: 'מצב' },
    { key: 'fresh', label: 'רעננות', render: (r) => html`<sw-badge kind=${r.fresh as StateKind} label=${r.fresh === 'live' ? 'עדכני' : r.fresh === 'stale' ? 'מיושן' : 'לא ידוע'}></sw-badge>` },
    { key: 'placed', label: 'במפה', render: (r) => (r.placed ? html`<sw-badge kind="recorded" label="מוצב"></sw-badge>` : html`<span style="color:var(--sw-text-3)">לא</span>`) },
  ];

  render() {
    const domains = ['all', ...new Set(ENTITIES.map((e) => e.domain))];
    const rows = ENTITIES.filter((e) => this.domain === 'all' || e.domain === this.domain);
    const ent = ENTITIES.find((e) => e.id === this.selected);
    return html`
      <sw-page heading="קטלוג ישויות Home Assistant" subheading="${ENTITIES.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" /></sw-field>
          ${domains.map((d) => html`<sw-chip ?selected=${d === this.domain} @click=${() => (this.domain = d)}>${d === 'all' ? 'הכל' : d}</sw-chip>`)}
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>
          ${ent
            ? html`<sw-drawer open heading=${ent.name} subheading=${ent.id} @close=${() => (this.selected = null)}>
                <dl>
                  <dt>מצב</dt><dd><sw-badge kind=${ent.fresh} label=${ent.state}></sw-badge></dd>
                  <dt>Domain</dt><dd><span class="ltr">${ent.domain}</span></dd>
                  <dt>אזור HA</dt><dd>${ent.area}</dd>
                  <dt>פעולות נתמכות</dt><dd>${ent.actions}</dd>
                  <dt>במפה</dt><dd>${ent.placed ? 'קומה 0' : 'לא מוצב'}</dd>
                </dl>
                <div class="note">ישות מ־domain לא מוכר מקבלת כרטיס כללי לקריאה בלבד. scripts ו־scenes חסומים עד allowlist.</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="map">${ent.placed ? 'הצג במפה' : 'הצב במפה'}</sw-button>
                  <sw-button variant="ghost">פתח ב־HA</sw-button>
                </div>
              </sw-drawer>`
            : ''}
        </div>
      </sw-page>
    `;
  }
}

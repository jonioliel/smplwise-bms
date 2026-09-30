import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { TableColumn } from '../components/sw-table';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { can, isApi } from '../api/session';
import { describeError } from '../api/client';
import { navigate, parseRoute } from '../router';
import { firstFloor, loadTree } from '../api/catalog';
import { domainLabel, entityTone, fmtTime, listEntities, stateLabel, subscribeHa, type HaCatalogue, type HaEntity, type HaSyncState } from '../api/ha';

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

export function domainIcon(domain: string): IconName {
  if (domain === 'lock' || domain === 'cover') return 'lock';
  if (domain === 'light' || domain === 'switch' || domain === 'fan') return 'light';
  if (domain === 'camera') return 'camera';
  if (domain === 'climate' || domain === 'script' || domain === 'scene' || domain === 'button' || domain === 'automation') return 'activity';
  return 'sensor';
}

/**
 * SC10 — HA entity catalogue and drawer. Against the backend it is the synced catalogue (read-only mirror of
 * Home Assistant, scoped by placements for floor users); the demo rows remain for the fixture screenshots.
 * Import ≠ placement ≠ control permission.
 *
 * 2026-09-30: this is a management page of הגדרות (`#/system/entities`, "קטלוג התקנים"), no longer a tab of the map; the
 * old address `#/explore/entities` redirects (nav.ts legacyRedirect). The shell offers it only to holders of
 * system.configure and this screen checks the same permission (the catalogue API itself is shared with other screens -
 * see docs/architecture/TABS_CONFIG.md). `?q=` from a search result fills the search box.
 */
@customElement('explore-entities')
export class ExploreEntities extends LitElement {
  @state() private selected: string | null = null;
  @state() private domain = 'all';
  @state() private q = '';
  @state() private area = '';
  @state() private onlyPlaced = false;
  @state() private cat: HaCatalogue | null = null;
  @state() private error = '';
  @state() private loading = false;
  @state() private sync: HaSyncState | null = null;
  @state() private firstFloorId: string | null = null;

  private stopWs: (() => void) | null = null;
  private searchTimer = 0;

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
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 10px;
    }
    .attrs {
      margin-block-start: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 10px;
      direction: ltr;
      text-align: left;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .statusline {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;

  /** A backend session without system.configure at the installation: nothing is requested and nothing is shown. */
  private get forbidden(): boolean {
    return isApi() && !can('system.configure');
  }

  connectedCallback() {
    super.connectedCallback();
    this.q = parseRoute().params.get('q') ?? '';
    if (isApi() && !this.forbidden) {
      void this.load();
      void loadTree().then((t) => (this.firstFloorId = firstFloor(t)?.id ?? null)).catch(() => undefined);
      this.stopWs = subscribeHa((m) => {
        if (m.type === 'entity_state_changed' && this.cat) {
          const i = this.cat.entities.findIndex((e) => e.entity_id === m.entity.entity_id);
          if (i >= 0) {
            const next = [...this.cat.entities];
            next[i] = { ...next[i], ...m.entity, placements: next[i].placements, actions: next[i].actions };
            this.cat = { ...this.cat, entities: next };
          }
        } else if (m.type === 'heartbeat') this.sync = m.sync;
        else if (m.type === 'ha_sync_state' && this.sync) this.sync = { ...this.sync, connected: m.connected };
        else if (m.type === 'structure_changed') this.reloadForStructure(); // CR-007 HA refresh: area names, new entities
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopWs?.();
    this.stopWs = null;
  }

  /** A structure push while a load is in flight is remembered and served by ONE more load after it, never overlapped. */
  private structureAgain = false;
  private reloadForStructure() {
    if (this.loading) this.structureAgain = true; // load()'s finally runs it
    else void this.load();
  }

  private async load() {
    this.loading = true;
    this.error = '';
    try {
      this.cat = await listEntities({ domain: this.domain === 'all' ? undefined : this.domain, q: this.q || undefined, area: this.area || undefined, placed: this.onlyPlaced ? true : undefined, limit: 800 });
      this.sync = this.cat.sync;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
      if (this.structureAgain) {
        this.structureAgain = false;
        void this.load();
      }
    }
  }

  private onSearch(v: string) {
    this.q = v;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => void this.load(), 250);
  }

  private columns: TableColumn[] = [
    { key: 'name', label: 'ישות', render: (r) => html`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:7px;background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${domainIcon(String(r.domain))} size=${13}></sw-icon></span><span><strong>${String(r.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(r.id)}</div></span></span>` },
    { key: 'domain', label: 'Domain', ltr: true },
    { key: 'area', label: 'אזור' },
    { key: 'state', label: 'מצב' },
    { key: 'fresh', label: 'רעננות', render: (r) => html`<sw-badge kind=${r.fresh as StateKind} label=${r.fresh === 'live' || r.fresh === 'neutral' ? 'עדכני' : r.fresh === 'stale' ? 'מיושן' : r.fresh === 'offline' ? 'לא זמין' : 'לא ידוע'}></sw-badge>` },
    { key: 'placed', label: 'במפה', render: (r) => (r.placed ? html`<sw-badge kind="recorded" label="מוצב"></sw-badge>` : html`<span style="color:var(--sw-text-3)">לא</span>`) },
  ];

  private toRow(e: HaEntity): Ent {
    return {
      id: e.entity_id,
      name: e.name || e.original_name || e.entity_id,
      domain: e.domain,
      area: e.area_name ?? '—',
      state: stateLabel(e),
      fresh: entityTone(e),
      placed: Boolean(e.placements?.length),
      actions: e.actions?.length ? e.actions.map((a) => `${a.label}${a.sensitive ? ' (רגיש)' : ''}`).join(' / ') : 'קריאה בלבד',
    };
  }

  private renderApiDrawer(e: HaEntity) {
    const tone = entityTone(e);
    const attrs = Object.entries(e.attributes).filter(([k]) => k !== 'friendly_name' && k !== 'icon').slice(0, 14);
    return html`<sw-drawer open heading=${e.name || e.original_name || e.entity_id} subheading=${e.entity_id} @close=${() => (this.selected = null)}>
      <dl>
        <dt>מצב</dt><dd><sw-badge kind=${tone} label=${stateLabel(e)}></sw-badge></dd>
        <dt>Domain</dt><dd><span class="ltr">${e.domain}</span> · ${domainLabel(e.domain)}${e.device_class ? html` · <span class="ltr">${e.device_class}</span>` : nothing}</dd>
        <dt>אזור</dt><dd>${e.area_name ?? '—'}${e.ha_floor_name ? ` · ${e.ha_floor_name}` : ''}</dd>
        <dt>שינוי אחרון</dt><dd>${fmtTime(e.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${fmtTime(e.state_seen_at)}${e.fresh ? '' : ' · הסנכרון מנותק'}</dd>
        <dt>אינטגרציה</dt><dd><span class="ltr">${e.platform ?? '—'}</span></dd>
        <dt>פעולות נתמכות</dt><dd>${e.actions?.length ? e.actions.map((a) => `${a.label}${a.sensitive ? ' (רגיש)' : ''}`).join(' / ') : 'קריאה בלבד'}</dd>
        <dt>במפה</dt><dd>${e.placements?.length ? html`<span class="chips">${e.placements.map((p) => html`<sw-chip @click=${() => navigate(`/explore/floors/${p.floor_id}`)}>${p.floor_name}</sw-chip>`)}</span>` : 'לא מוצב'}</dd>
      </dl>
      ${attrs.length ? html`<div class="attrs">${attrs.map(([k, v]) => html`<span>${k}</span><span>${typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>`)}</div>` : nothing}
      <div class="note">הקטלוג הוא שיקוף לקריאה בלבד של תשתית המערכת. הפעולות רצות בזהות המשתמש; שליטה מהמפה דורשת הרשאת ha.entity.control.</div>
      <div slot="footer">
        ${e.placements?.length
          ? html`<sw-button variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${e.placements![0].floor_id}`)}>הצג במפה</sw-button>`
          : html`<sw-button variant="primary" icon="map" ?disabled=${!this.firstFloorId} title=${this.firstFloorId ? 'פותח את עורך התוכנית עם הישות מוכנה להצבה' : 'אין קומות עדיין'} @click=${() => this.firstFloorId && navigate(`/explore/floors/${this.firstFloorId}/edit`, { entity: e.entity_id })}>הצב במפה</sw-button>`}
      </div>
    </sw-drawer>`;
  }

  private renderApi() {
    const cat = this.cat;
    const sync = this.sync;
    const rows = cat ? cat.entities.map((e) => this.toRow(e)) : [];
    const domains = cat ? Object.entries(cat.domains).sort((a, b) => b[1] - a[1]) : [];
    const ent = cat?.entities.find((e) => e.entity_id === this.selected);
    const total = domains.reduce((n, [, c]) => n + c, 0);
    const sub = sync
      ? `${total} ישויות בקטלוג · ${sync.connected ? `סנכרון פעיל · גרסה ${sync.ha_version ?? ''}` : `הסנכרון מנותק${sync.last_error ? ` · ${sync.last_error}` : ''}`}`
      : 'טוען את הקטלוג…';
    return html`
      <sw-page heading="קטלוג ההתקנים" subheading=${sub}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.loading} @click=${() => this.load()}>רענון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" .value=${this.q} @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)} /></sw-field>
          <sw-field><select aria-label="אזור" @change=${(e: Event) => { this.area = (e.target as HTMLSelectElement).value; void this.load(); }}><option value="">כל האזורים</option>${(cat?.areas ?? []).map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.area}>${a.area_name ?? a.area_id}</option>`)}</select></sw-field>
          <sw-chip ?selected=${this.onlyPlaced} icon="map" @click=${() => { this.onlyPlaced = !this.onlyPlaced; void this.load(); }}>מוצבות בלבד</sw-chip>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.domain === 'all'} count=${total} @click=${() => { this.domain = 'all'; void this.load(); }}>הכל</sw-chip>
          ${domains.map(([d, n]) => html`<sw-chip ?selected=${d === this.domain} count=${n} @click=${() => { this.domain = d; void this.load(); }}><span class="ltr">${d}</span></sw-chip>`)}
        </div>
        <div class="stage">
          ${this.error
            ? html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`
            : !cat
              ? html`<sw-state-panel state="loading"></sw-state-panel>`
              : !rows.length
                ? html`<sw-state-panel state="empty" heading=${total ? 'אין ישויות שתואמות את הסינון' : 'הקטלוג ריק'} hint=${total ? 'נקה את החיפוש או בחר domain אחר.' : sync?.connected ? 'ההסנכרון פעיל אך טרם התקבלו מצבים.' : 'לא מחובר לתשתית המערכת. בדוק בהגדרות → כללי.'}></sw-state-panel>`
                : html`<sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>`}
          ${ent ? this.renderApiDrawer(ent) : nothing}
        </div>
      </sw-page>
    `;
  }

  render() {
    if (this.forbidden) return html`<sw-page heading="קטלוג ההתקנים"><sw-state-panel state="forbidden" data-entities-forbidden></sw-state-panel></sw-page>`;
    if (isApi()) return this.renderApi();
    const domains = ['all', ...new Set(ENTITIES.map((e) => e.domain))];
    const rows = ENTITIES.filter((e) => this.domain === 'all' || e.domain === this.domain);
    const ent = ENTITIES.find((e) => e.id === this.selected);
    return html`
      <sw-page heading="קטלוג ההתקנים" subheading="${ENTITIES.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
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
                  <dt>אזור</dt><dd>${ent.area}</dd>
                  <dt>פעולות נתמכות</dt><dd>${ent.actions}</dd>
                  <dt>במפה</dt><dd>${ent.placed ? 'קומה 0' : 'לא מוצב'}</dd>
                </dl>
                <div class="note">ישות מ־domain לא מוכר מקבלת כרטיס כללי לקריאה בלבד. scripts ו־scenes חסומים עד allowlist.</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="map">${ent.placed ? 'הצג במפה' : 'הצב במפה'}</sw-button>
                  <sw-button variant="ghost">פתח בתשתית המערכת</sw-button>
                </div>
              </sw-drawer>`
            : ''}
        </div>
      </sw-page>
    `;
  }
}

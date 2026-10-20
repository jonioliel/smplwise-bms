import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import '../components/sw-chip';
import { describeError } from '../api/client';
import { fmtWhen } from '../api/access';
import {
  applyDoorSuggestions, clearDoorMapping, getDoorGrants, getDoorMap, getDoorPathInventory, getDoorSettings, placeStation, setDoorMapping, setEditorBlock, switchDoorRole, switchDoorSubject,
  type DoorGrantRole, type DoorGrantSubject, type DoorGrants, type DoorMap, type DoorMapLock, type DoorPathInventory, type DoorPathItem, type DoorSettings,
} from '../api/doors';
import {
  builtinAnswer, doorsText, filterInventory, filterSubjects, grantQuestion, guardTone, INVENTORY_FILTERS, inventorySummary, itemMeta, lastRunText, mappingState, otherGrants, parsePlacement,
  parseRelay, peopleLine, placementOptions, placementValue, relayOptions, roleQuestion, type InventoryFilter,
} from './system-doors-logic';
import { editorBlockHint, editorBlockLabel, editorBlockQuestion, lockJobLine } from './door-path-logic';

const cardCss = css`
  :host {
    display: block;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sw-s-3);
    flex-wrap: wrap;
    padding: var(--sw-s-2) 0;
    border-block-end: 1px solid var(--sw-border);
  }
  .row:last-child {
    border-block-end: 0;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .name {
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text);
  }
  .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  h3 {
    margin: var(--sw-s-4) 0 var(--sw-s-1);
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  input,
  select {
    font: inherit;
    color: var(--sw-text);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    padding: var(--sw-s-1) var(--sw-s-2);
    min-block-size: 36px;
    max-inline-size: 100%;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .tools {
    display: flex;
    gap: var(--sw-s-2);
    flex-wrap: wrap;
    align-items: center;
    margin-block-end: var(--sw-s-2);
  }
  .err {
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-sm);
  }
  .ctl {
    display: flex;
    gap: var(--sw-s-2);
    align-items: center;
    flex-wrap: wrap;
  }
`;

type Pending =
  | { kind: 'subject'; row: DoorGrantSubject; enabled: boolean }
  | { kind: 'role'; role: DoorGrantRole; enabled: boolean };

/**
 * Settings › הרשאות › "פתיחת דלתות" (CR-033 D3, owner decision 13: "anyone I choose, not too complicated"). One switch per
 * user and group (a door opening grant for every door of the installation, or revoking exactly the grant this card made)
 * and one per custom role; built-in roles are shown read-only with their effective answer. Every switch asks one short
 * confirmation. "רק דלתות מסוימות": the bindings wizard with the role "פותח דלתות" and a station scope.
 */
@customElement('sw-door-grants')
export class SwDoorGrants extends LitElement {
  @state() private data: DoorGrants | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private q = '';
  @state() private pending: Pending | null = null;

  static styles = [cardCss];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.data = await getDoorGrants();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async confirm() {
    const p = this.pending;
    if (!p) return;
    this.busy = true;
    try {
      if (p.kind === 'subject') await switchDoorSubject(p.row.kind, p.row.id, p.enabled);
      else await switchDoorRole(p.role.id, p.enabled, p.role.revision ?? 1);
      this.pending = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
      this.pending = null;
    } finally {
      this.busy = false;
    }
  }

  private subjectRow(r: DoorGrantSubject) {
    const other = otherGrants(r);
    return html`<div class="row" data-door-grant=${`${r.kind}:${r.id}`}>
      <div class="who"><span class="name">${r.name}</span>${other ? html`<span class="sub">${other}</span>` : nothing}</div>
      <sw-toggle label="רשאי לפתוח דלתות" .checked=${live(r.granted)} ?disabled=${this.busy || !this.data?.can_manage_subjects || (!r.active && !r.granted)}
        @change=${(e: CustomEvent<{ checked: boolean }>) => { this.pending = { kind: 'subject', row: r, enabled: e.detail.checked }; this.requestUpdate(); }}></sw-toggle>
    </div>`;
  }

  private roleRow(r: DoorGrantRole) {
    if (!r.custom) {
      return html`<div class="row" data-door-role=${r.id}><div class="who"><span class="name">${r.name}</span><span class="sub">תפקיד מובנה</span></div><span class="sub" data-door-role-answer>${builtinAnswer(r)}</span></div>`;
    }
    return html`<div class="row" data-door-role=${r.id}>
      <div class="who"><span class="name">${r.name}</span><span class="sub">תפקיד מותאם</span></div>
      <sw-toggle label="כולל פתיחת דלתות" .checked=${live(r.includes)} ?disabled=${this.busy || !r.editable}
        @change=${(e: CustomEvent<{ checked: boolean }>) => { this.pending = { kind: 'role', role: r, enabled: e.detail.checked }; this.requestUpdate(); }}></sw-toggle>
    </div>`;
  }

  render() {
    if (this.error && !this.data) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.data) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const d = this.data;
    const subjects = filterSubjects([...d.users, ...d.groups], this.q);
    const p = this.pending;
    const pname = p ? (p.kind === 'subject' ? p.row.name : p.role.name) : '';
    return html`<sw-card heading="פתיחת דלתות" subheading="מי רשאי לפתוח דלתות אינטרקום מ-Arx · ברירת המחדל: כל הדלתות בהתקנה" data-door-grants-card>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      <h3>משתמשים וקבוצות</h3>
      <div class="tools">
        <input type="search" placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
        <span class="sub">רק דלתות מסוימות: שיוך התפקיד "פותח דלתות" לעמדה, בלשונית המשתמשים או הקבוצות</span>
      </div>
      ${subjects.length ? subjects.map((r) => this.subjectRow(r)) : html`<sw-state-panel icon="door" state="empty" heading="אין משתמשים או קבוצות"></sw-state-panel>`}
      ${d.can_manage_roles ? html`<h3>תפקידים</h3>${d.roles.map((r) => this.roleRow(r))}` : nothing}
      ${p
        ? html`<sw-dialog open heading="פתיחת דלתות" data-door-grant-confirm @close=${() => { this.pending = null; }}>
            <p>${p.kind === 'subject' ? grantQuestion(pname, p.enabled) : roleQuestion(pname, p.enabled)}</p>
            <sw-button slot="footer" variant="ghost" @click=${() => { this.pending = null; }}>ביטול</sw-button>
            <sw-button slot="footer" variant=${p.enabled ? 'primary' : 'danger'} data-door-grant-ok ?disabled=${this.busy} @click=${() => this.confirm()}>אישור</sw-button>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }
}

/**
 * Settings › הגדרת מערכת › WisKey: "מיקום תחנות" (CR-033 D2: which site or building a station belongs to, so a site or
 * building grant covers it) and "שיוך דלתות" (D1: which station relay each WisKey lock is - explicit only, never by name).
 * System administrator only (`system.configure`); the station's id is never shown.
 */
@customElement('sw-door-setup')
export class SwDoorSetup extends LitElement {
  @state() private map: DoorMap | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private picks: Record<string, string> = {};
  @state() private settings: DoorSettings | null = null;
  @state() private confirmEditor: DoorSettings['editor_block'] | null = null;

  static styles = [cardCss];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.map = await getDoorMap();
      this.settings = await getDoorSettings();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async run(fn: () => Promise<unknown>) {
    this.busy = true;
    try {
      await fn();
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private lockRow(m: DoorMap, lock: DoorMapLock) {
    const st = mappingState(lock);
    const options = relayOptions(m, lock);
    const current = lock.mapping ? `${lock.mapping.station_id}#${lock.mapping.relay}` : lock.suggestion ? `${lock.suggestion.station_id}#${lock.suggestion.relay}` : '';
    const pick = this.picks[lock.entity_id] ?? current;
    const target = parseRelay(pick);
    return html`<div class="row" data-door-map=${lock.entity_id}>
      <div class="who"><span class="name">${lock.name}</span><sw-badge kind=${st.tone} label=${st.text}></sw-badge></div>
      <div class="ctl">
        <select aria-label=${`ממסר עבור ${lock.name}`} @change=${(e: Event) => (this.picks = { ...this.picks, [lock.entity_id]: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!pick}>בחירת ממסר</option>
          ${options.map((o) => html`<option value=${o.value} ?selected=${o.value === pick}>${o.label}</option>`)}
        </select>
        <sw-button size="sm" variant="primary" data-door-map-save ?disabled=${this.busy || !target || (lock.mapping?.valid && pick === current)}
          @click=${() => target && this.run(() => setDoorMapping(lock.entity_id, target.station_id, target.relay))}>שמירה</sw-button>
        ${lock.mapping ? html`<sw-button size="sm" variant="ghost" data-door-map-clear ?disabled=${this.busy} @click=${() => this.run(() => clearDoorMapping(lock.entity_id))}>ביטול שיוך</sw-button>` : nothing}
      </div>
    </div>`;
  }

  /** CR-033 D8 + D6: the editor block (default blocked) and the scheduled lock jobs that will never work. */
  private editorCard(st: DoorSettings) {
    const next: DoorSettings['editor_block'] = st.editor_block === 'blocked' ? 'allowed' : 'blocked';
    return html`<sw-card heading="פריטים שפותחים דלתות" subheading="עורכי האוטומציות, הסקריפטים, הסצנות והתזמונים · הבדיקה נעשית בשרת בעת שמירה" data-door-editor-card style="margin-block-start: var(--sw-s-3)">
      <div class="row" data-door-editor-block>
        <div class="who"><span class="name">${editorBlockLabel(st.editor_block)}</span><span class="sub">${editorBlockHint(st)}</span></div>
        <sw-button size="sm" data-door-editor-switch ?disabled=${this.busy || (next === 'allowed' && !st.editor_allowed_available)} @click=${() => { this.confirmEditor = next; }}>${next === 'allowed' ? 'לאפשר' : 'לחסום'}</sw-button>
      </div>
      <h3>תזמוני נעילה שלא יעבדו</h3>
      ${st.lock_jobs.length
        ? st.lock_jobs.map((j) => html`<div class="row" data-door-lock-job=${j.schedule_id}><span class="name">${lockJobLine(j)}</span></div>`)
        : html`<sw-state-panel icon="door" state="empty" heading="אין תזמוני נעילה על דלתות אינטרקום"></sw-state-panel>`}
      ${this.confirmEditor
        ? html`<sw-dialog open heading="פריטים שפותחים דלתות" data-door-editor-confirm @close=${() => { this.confirmEditor = null; }}>
            <p>${editorBlockQuestion(this.confirmEditor)}</p>
            <sw-button slot="footer" variant="ghost" @click=${() => { this.confirmEditor = null; }}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-door-editor-ok ?disabled=${this.busy} @click=${() => { const v = this.confirmEditor; this.confirmEditor = null; if (v) void this.run(() => setEditorBlock(v)); }}>אישור</sw-button>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  render() {
    if (this.error && !this.map) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.map) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const m = this.map;
    const places = placementOptions(m);
    const suggested = m.locks.filter((l) => l.suggestion).length;
    return html`
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      <sw-card heading="מיקום תחנות" subheading="שיוך תחנה לאתר או למבנה: הרשאת פתיחה באתר או במבנה חלה גם על התחנות שבו" data-door-placement-card>
        ${m.stations.length
          ? m.stations.map((s) => html`<div class="row" data-door-placement=${s.name}>
              <div class="who"><span class="name">${s.name}</span>${s.online ? nothing : html`<span class="sub">התחנה לא זמינה</span>`}</div>
              <select aria-label=${`מיקום ${s.name}`} ?disabled=${this.busy} @change=${(e: Event) => this.run(() => placeStation(s.id, parsePlacement((e.target as HTMLSelectElement).value)))}>
                ${places.map((o) => html`<option value=${o.value} ?selected=${o.value === placementValue(s.placement)}>${o.label}</option>`)}
              </select>
            </div>`)
          : html`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${m.has_copy ? 'WisKey לא מסר תחנות.' : 'נתוני WisKey אינם זמינים כרגע.'}></sw-state-panel>`}
      </sw-card>
      <sw-card heading="שיוך דלתות" subheading="לכל מנעול אינטרקום: התחנה והממסר שהוא פותח · שיוך מפורש בלבד, לא לפי שם" data-door-map-card style="margin-block-start: var(--sw-s-3)">
        ${suggested ? html`<div class="tools"><sw-button size="sm" data-door-map-apply ?disabled=${this.busy} @click=${() => this.run(() => applyDoorSuggestions())}>אישור ${suggested} הצעות חד-משמעיות</sw-button></div>` : nothing}
        ${m.locks.length ? m.locks.map((l) => this.lockRow(m, l)) : html`<sw-state-panel icon="door" state="empty" heading="אין מנעולי אינטרקום"></sw-state-panel>`}
      </sw-card>
      ${this.settings ? this.editorCard(this.settings) : nothing}`;
  }
}

/**
 * Settings › הגדרת מערכת › WisKey: "פריטים שפותחים דלתות" (CR-033 D7, owner decision 15). A READ-ONLY report of every saved
 * item - automation, script, scene, schedule, home-screen launcher button - whose steps open an intercom door, with where it
 * came from, who wrote and who approved it, its state and last run, what a run started from Arx does now, and a
 * conversion suggestion. Nothing is converted, disabled or sent from here. System administrator only; names only.
 */
@customElement('sw-door-inventory')
export class SwDoorInventory extends LitElement {
  @state() private inv: DoorPathInventory | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private filter: InventoryFilter = 'all';

  static styles = [
    cardCss,
    css`
      .chips {
        display: flex;
        gap: var(--sw-s-1);
        flex-wrap: wrap;
      }
      .item .who {
        flex: 1 1 260px;
      }
      .facts {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
        flex: 1 1 220px;
        min-inline-size: 0;
      }
      .warn {
        color: var(--sw-warning-text, var(--sw-text-2));
        font-size: var(--sw-fs-sm);
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.busy = true;
    try {
      this.inv = await getDoorPathInventory();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private itemRow(i: DoorPathItem) {
    return html`<div class="row item" data-door-item=${i.key}>
      <div class="who">
        <span class="name">${i.name}</span>
        <span class="sub">${itemMeta(i)}</span>
        <span class="sub">${peopleLine(i)} · ${lastRunText(i, fmtWhen)}</span>
      </div>
      <div class="facts">
        <sw-badge kind=${guardTone(i)} label=${i.run_guard_text}></sw-badge>
        <span class="sub">דלתות: ${doorsText(i)}</span>
        <span class="sub">הצעה: ${i.suggestion_text}</span>
        ${i.unresolved.length ? html`<span class="warn">${i.unresolved.join(' · ')}</span>` : nothing}
        ${i.disable_required ? html`<span class="warn" data-door-item-disable>דורש השבתה - פועל לבד ואין לו מאשר תקף</span>` : nothing}
      </div>
    </div>`;
  }

  render() {
    if (this.error && !this.inv) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.inv) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const inv = this.inv;
    const shown = filterInventory(inv.items, this.filter);
    return html`<sw-card heading="פריטים שפותחים דלתות" subheading=${`דוח לקריאה בלבד · ${inventorySummary(inv)}`} data-door-inventory-card style="margin-block-start: var(--sw-s-3)">
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      <div class="tools">
        <div class="chips" role="group" aria-label="סינון">
          ${INVENTORY_FILTERS.map((f) => html`<sw-chip data-door-inventory-filter=${f.id} ?selected=${this.filter === f.id} @click=${() => (this.filter = f.id)}>${f.label}</sw-chip>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-door-inventory-refresh ?disabled=${this.busy} @click=${() => this.load()}>רענון</sw-button>
      </div>
      ${shown.length
        ? shown.map((i) => this.itemRow(i))
        : html`<sw-state-panel icon=${inv.items.length ? 'filter' : 'door'} state="empty" heading=${inv.items.length ? 'אין פריטים בסינון הזה' : inventorySummary(inv)}></sw-state-panel>`}
    </sw-card>`;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import {
  applyDoorSuggestions, clearDoorMapping, getDoorGrants, getDoorMap, placeStation, setDoorMapping, switchDoorRole, switchDoorSubject,
  type DoorGrantRole, type DoorGrantSubject, type DoorGrants, type DoorMap, type DoorMapLock,
} from '../api/doors';
import {
  builtinAnswer, filterSubjects, grantQuestion, mappingState, otherGrants, parsePlacement, parseRelay, placementOptions, placementValue, relayOptions, roleQuestion,
} from './system-doors-logic';

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
      ${subjects.length ? subjects.map((r) => this.subjectRow(r)) : html`<sw-state-panel state="empty" heading="אין משתמשים או קבוצות"></sw-state-panel>`}
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

  static styles = [cardCss];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.map = await getDoorMap();
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
          : html`<sw-state-panel state="empty" heading="אין תחנות" hint=${m.has_copy ? 'WisKey לא מסר תחנות.' : 'נתוני WisKey אינם זמינים כרגע.'}></sw-state-panel>`}
      </sw-card>
      <sw-card heading="שיוך דלתות" subheading="לכל מנעול אינטרקום: התחנה והממסר שהוא פותח · שיוך מפורש בלבד, לא לפי שם" data-door-map-card style="margin-block-start: var(--sw-s-3)">
        ${suggested ? html`<div class="tools"><sw-button size="sm" data-door-map-apply ?disabled=${this.busy} @click=${() => this.run(() => applyDoorSuggestions())}>אישור ${suggested} הצעות חד-משמעיות</sw-button></div>` : nothing}
        ${m.locks.length ? m.locks.map((l) => this.lockRow(m, l)) : html`<sw-state-panel state="empty" heading="אין מנעולי אינטרקום"></sw-state-panel>`}
      </sw-card>`;
  }
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { ticketsApi } from '../api/tickets';
import { ticketsLocationsApi, type LocationsAdminAnswer, type OrgLocationAdmin } from '../api/tickets-locations';
import { ticketSettingsCss } from './settings-styles';
import {
  CITY_MAX, DETAILS_MAX, NAME_MAX, STREET_MAX, addressLine, blankDraft, draftBody, draftOf, locationProblems, serverProblem,
  type LocationDraft, type LocationField, type LocationProblem,
} from './org-locations-model';
import { lt, type LocTextKey } from './org-locations-text';

const PROBLEM_TEXT: Record<LocationProblem, LocTextKey> = {
  required: 'err_required', too_long: 'err_too_long', duplicate: 'err_duplicate', address: 'err_address', url: 'err_url', coords: 'err_coords',
  inactive_default: 'err_inactive_default',
};

/**
 * CR-ORG-LOCATIONS: Settings ג€÷ service management ג€÷ "׳׳™׳§׳•׳׳™׳" (tickets.configure). The organisation's locations - name (unique), street and
 * number, city, free additional details (building, floor, entrance, access), optional coordinates with the navigation link, active,
 * one optional organisation default, the order - added and edited in one inline editor; a location some request already names is
 * deactivated, never deleted (the server answers 409 location_in_use). Under it the optional default per department (it wins over
 * the organisation default). Events: `notice` {ok | error}.
 */
@customElement('tickets-locations-settings')
export class TicketsLocationsSettings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private data: LocationsAdminAnswer | null = null;
  @state() private depts: { id: string; name: string }[] = [];
  @state() private failed = '';
  @state() private forbidden = false;
  @state() private busy = false;
  /** the open editor: 'new', a location id, or '' (closed) */
  @state() private editing = '';
  @state() private draft: LocationDraft = blankDraft();
  @state() private tried = false;
  @state() private serverErr: Partial<Record<LocationField, LocationProblem>> = {};

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .loc {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .loc:last-child {
      border-block-end: 0;
    }
    .loc .txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 220px;
      min-inline-size: 0;
    }
    .loc .txt small {
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .loc[data-inactive] .txt b {
      color: var(--sw-text-3);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
      padding: 10px 0;
    }
    .editor .wide {
      grid-column: 1 / -1;
    }
    .editor .pair {
      display: flex;
      gap: 8px;
    }
    .editor .pair input {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .editor .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .chip {
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
    }
    a.nav {
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 640px) {
      .editor {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    this.failed = '';
    try {
      this.data = await ticketsLocationsApi().admin();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.failed = describeError(e);
      return;
    }
    try {
      const r = await ticketsApi().departments();
      this.depts = r.departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }));
    } catch {
      this.depts = [];
    }
  }

  private open(id: string): void {
    const loc = this.data?.locations.find((x) => x.id === id);
    this.editing = id;
    this.draft = loc ? draftOf(loc) : blankDraft(this.data?.locations.length ?? 0);
    this.tried = false;
    this.serverErr = {};
  }

  private set<K extends keyof LocationDraft>(k: K, v: LocationDraft[K]): void {
    this.draft = { ...this.draft, [k]: v };
    this.serverErr = {};
  }

  private problems(): Partial<Record<LocationField, LocationProblem>> {
    return { ...locationProblems(this.draft, this.data?.locations ?? [], this.editing === 'new' ? null : this.editing), ...this.serverErr };
  }

  private takeServer(e: unknown): boolean {
    if (!(e instanceof ApiError)) return false;
    if (e.code === 'location_name_taken') {
      this.serverErr = { name: 'duplicate' };
      return true;
    }
    const fields = (e.body.details?.fields ?? []) as { field: string; code: string }[];
    const out: Partial<Record<LocationField, LocationProblem>> = {};
    for (const f of fields) {
      const p = serverProblem(f.code);
      if (!p) continue;
      const key: LocationField = f.field === 'lat' || f.field === 'lng' ? 'coords' : f.field === 'is_default' ? 'default' : (f.field as LocationField);
      out[key] = key === 'street' && p === 'required' ? 'address' : p;
    }
    this.serverErr = out;
    return Object.keys(out).length > 0;
  }

  private async save(): Promise<void> {
    this.tried = true;
    if (Object.keys(this.problems()).length) return;
    this.busy = true;
    try {
      const api = ticketsLocationsApi();
      const loc = this.data?.locations.find((x) => x.id === this.editing);
      this.data = this.editing === 'new' ? await api.create(draftBody(this.draft)) : await api.update(this.editing, draftBody(this.draft, loc?.revision));
      this.editing = '';
      this.notice({ ok: lt('saved') });
    } catch (e) {
      if (!this.takeServer(e)) this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  private async patch(loc: OrgLocationAdmin, body: { active?: boolean; is_default?: boolean }): Promise<void> {
    this.busy = true;
    try {
      this.data = await ticketsLocationsApi().update(loc.id, { ...body, revision: loc.revision });
      this.notice({ ok: lt('saved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  private async removeLocation(loc: OrgLocationAdmin): Promise<void> {
    if (!window.confirm(lt('confirmRemove', { name: loc.name }))) return;
    this.busy = true;
    try {
      this.data = await ticketsLocationsApi().remove(loc.id);
      this.notice({ ok: lt('removed') });
    } catch (e) {
      this.notice({ error: e instanceof ApiError && e.code === 'location_in_use' ? lt('err_in_use') : describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  private async setDept(deptId: string, locationId: string): Promise<void> {
    this.busy = true;
    try {
      this.data = await ticketsLocationsApi().setDepartmentDefault(deptId, locationId || null);
      this.notice({ ok: lt('saved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- render

  private err(p: Partial<Record<LocationField, LocationProblem>>, f: LocationField): TemplateResult | typeof nothing {
    const code = p[f];
    return (this.tried || this.serverErr[f]) && code ? html`<span class="err" role="alert" data-location-err=${f}>${lt(PROBLEM_TEXT[code])}</span>` : nothing;
  }

  private editor(): TemplateResult {
    const d = this.draft;
    const p = this.problems();
    const inv = (f: LocationField) => String(!!(this.tried && p[f]));
    const text = (k: 'name' | 'street' | 'city' | 'details', label: LocTextKey, max: number, wide = false, ph = '') => html`<label class=${`fld${wide ? ' wide' : ''}`}>${lt(label)}
      <input class="in" data-location-field=${k} maxlength=${max} placeholder=${ph} aria-invalid=${inv(k)} .value=${d[k]}
        @input=${(e: Event) => this.set(k, (e.target as HTMLInputElement).value)} />${this.err(p, k)}</label>`;
    return html`<div class="editor" data-location-editor=${this.editing}>
      ${text('name', 'fName', NAME_MAX)}
      <label class="fld">${lt('fSort')}<input class="in num" inputmode="numeric" dir="ltr" data-location-field="sort_order" .value=${d.sort_order}
        @input=${(e: Event) => this.set('sort_order', (e.target as HTMLInputElement).value)} /></label>
      ${text('street', 'fStreet', STREET_MAX)}
      ${text('city', 'fCity', CITY_MAX)}
      ${text('details', 'fDetails', DETAILS_MAX, true, lt('fDetailsPh'))}
      <div class="fld wide"><span>${lt('fCoords')}</span><div class="pair">
        <input class="in" inputmode="decimal" dir="ltr" data-location-field="lat" aria-label=${lt('fLat')} placeholder=${lt('fLat')} aria-invalid=${inv('coords')} .value=${d.lat}
          @input=${(e: Event) => this.set('lat', (e.target as HTMLInputElement).value)} />
        <input class="in" inputmode="decimal" dir="ltr" data-location-field="lng" aria-label=${lt('fLng')} placeholder=${lt('fLng')} aria-invalid=${inv('coords')} .value=${d.lng}
          @input=${(e: Event) => this.set('lng', (e.target as HTMLInputElement).value)} /></div>${this.err(p, 'coords')}</div>
      <div class="checks wide">
        <label><input type="checkbox" data-location-field="active" .checked=${d.active} @change=${(e: Event) => this.set('active', (e.target as HTMLInputElement).checked)} /> ${lt('fActive')}</label>
        <label><input type="checkbox" data-location-field="is_default" .checked=${d.is_default} @change=${(e: Event) => this.set('is_default', (e.target as HTMLInputElement).checked)} /> ${lt('fDefault')}</label>
        ${this.err(p, 'default')}
      </div>
      <div class="acts wide">
        <sw-button size="sm" variant="primary" data-location-save ?disabled=${this.busy} @click=${() => void this.save()}>${lt('save')}</sw-button>
        <sw-button size="sm" data-location-cancel ?disabled=${this.busy} @click=${() => (this.editing = '')}>${lt('cancel')}</sw-button>
      </div>
    </div>`;
  }

  private row(l: OrgLocationAdmin): TemplateResult {
    if (this.editing === l.id) return this.editor();
    return html`<div class="loc" data-location=${l.id} ?data-inactive=${!l.active}>
      <span class="txt"><b>${bidi(l.name)} ${l.is_default ? html`<span class="chip" data-location-default>${lt('defaultChip')}</span>` : nothing}
        ${!l.active ? html`<span class="chip" data-location-inactive>${lt('inactiveChip')}</span>` : nothing}</b>
        <small>${bidi([addressLine(l), l.details].filter(Boolean).join(' ֲ· '))}</small>
        ${l.references ? html`<small data-location-refs>${lt('inUse', { n: l.references })}</small>` : nothing}</span>
      ${l.nav_url ? html`<a class="nav" href=${l.nav_url} target="_blank" rel="noopener noreferrer" data-location-nav>${lt('navigate')}</a>` : nothing}
      <span class="acts">
        <sw-button size="sm" data-location-edit=${l.id} ?disabled=${this.busy || !!this.editing} @click=${() => this.open(l.id)}>${lt('edit')}</sw-button>
        ${l.active && !l.is_default ? html`<sw-button size="sm" data-location-make-default=${l.id} ?disabled=${this.busy} @click=${() => void this.patch(l, { is_default: true })}>${lt('makeDefault')}</sw-button>` : nothing}
        <sw-button size="sm" data-location-toggle=${l.id} ?disabled=${this.busy} @click=${() => void this.patch(l, { active: !l.active })}>${l.active ? lt('deactivate') : lt('activate')}</sw-button>
        ${l.references ? nothing : html`<sw-button size="sm" data-location-remove=${l.id} ?disabled=${this.busy} @click=${() => void this.removeLocation(l)}>${lt('remove')}</sw-button>`}
      </span>
    </div>`;
  }

  private deptCard(a: LocationsAdminAnswer): TemplateResult | typeof nothing {
    const active = a.locations.filter((l) => l.active);
    if (!this.depts.length || !active.length) return nothing;
    return html`<sw-card heading=${lt('deptTitle')} subheading=${lt('deptSub')} data-card="locations-departments">
      ${this.depts.map((d) => html`<div class="row" data-location-dept=${d.id}><span class="lbl">${bidi(d.name)}</span>
        <span class="end"><select class="in" aria-label=${`${lt('deptTitle')} ֲ· ${d.name}`} ?disabled=${this.busy} @change=${(e: Event) => void this.setDept(d.id, (e.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${!a.department_defaults[d.id]}>${lt('deptNone')}</option>
          ${active.map((l) => html`<option value=${l.id} ?selected=${a.department_defaults[d.id] === l.id}>${bidi(l.name)}</option>`)}
        </select></span></div>`)}
    </sw-card>`;
  }

  render() {
    if (this.forbidden) return html`<sw-state-panel state="forbidden"></sw-state-panel>`;
    if (this.failed) return html`<sw-state-panel state="error" heading=${this.failed}><sw-button size="sm" @click=${() => void this.load()}>${lt('retry')}</sw-button></sw-state-panel>`;
    const a = this.data;
    if (!a) return html`<sw-state-panel state="loading" heading=${lt('loading')}></sw-state-panel>`;
    const full = a.locations.length >= a.max;
    return html`<sw-card heading=${lt('title')} subheading=${lt('sub')} data-card="locations">
      ${a.locations.length || this.editing === 'new' ? nothing : html`<div class="row" data-locations-empty><span class="lbl">${lt('empty')}</span></div>`}
      ${repeat(a.locations, (l) => l.id, (l) => this.row(l))}
      ${this.editing === 'new' ? this.editor() : html`<div class="row"><sw-button size="sm" data-location-add ?disabled=${this.busy || !!this.editing || full}
        @click=${() => this.open('new')}>${lt('add')}</sw-button></div>`}
    </sw-card>
    ${this.deptCard(a)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-locations-settings': TicketsLocationsSettings;
  }
}

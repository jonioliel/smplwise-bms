import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-badge';
import '../components/sw-button';
import { ApiError } from '../api/client';
import {
  approveStation, decideStation, getStationPermissions, refuseStation, syncStation,
  type SpPerson, type SpStation,
} from '../api/station-permissions';
import { addChoices, blockNotice, doorsText, outcomeKey, rowButtons, sourceBadge, stationLabel, syncBadge, type SpAction } from '../access-control/station-permissions-logic';
import { spt } from '../i18n/station-permissions';

type Phase = 'loading' | 'ready' | 'hidden' | 'error';

/**
 * STATIONPERM-295: the person's access per station, inside the person's page (tab "גישה"). One row per station the caller may see:
 * name, where the access comes from (group / personal / blocked), the WisKey state of the last Arx decision, and only the actions the
 * server allows. Renders NOTHING while the feature is off (404 `station_permissions_off`) or the caller may not see the person - the
 * operator screen stays clean. A block asks for a one-line confirmation; everything else acts at once and reloads the block.
 */
@customElement('wiskey-station-permissions')
export class WiskeyStationPermissions extends LitElement {
  @property() personId = '';
  @property({ attribute: false }) stationNames: Record<string, string> = {};

  @state() private phase: Phase = 'loading';
  @state() private data: SpPerson | null = null;
  @state() private busy = '';
  @state() private confirming = '';
  @state() private line: { ok: boolean; text: string } | null = null;
  @state() private pick = '';
  private seq = 0;

  static styles = css`
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    .name {
      flex: 1 1 8rem;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex-basis: 100%;
      justify-content: flex-end;
    }
    .req {
      flex-basis: 100%;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .note,
    .line {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .line.ok {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .line.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    select {
      flex: 1 1 10rem;
      min-block-size: 44px;
      padding-inline: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    sw-button {
      min-block-size: 44px;
    }
  `;

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('personId')) {
      this.line = null;
      this.confirming = '';
      this.pick = '';
      void this.load();
    }
  }

  private async load() {
    const id = this.personId;
    const mine = ++this.seq;
    if (!id) {
      this.phase = 'hidden';
      return;
    }
    if (!this.data || this.data.person_id !== id) this.phase = 'loading';
    try {
      const data = await getStationPermissions(id);
      if (mine !== this.seq) return;
      this.data = data;
      this.phase = 'ready';
    } catch (err) {
      if (mine !== this.seq) return;
      // off, forbidden, not visible: the block is simply not there (clean operator screen)
      this.phase = err instanceof ApiError && (err.status === 404 || err.status === 403) ? 'hidden' : 'error';
    }
  }

  private async act(st: SpStation, action: SpAction, relays?: number[]) {
    if (action === 'deny' && this.confirming !== st.station_id) {
      this.confirming = st.station_id;
      return;
    }
    this.confirming = '';
    this.busy = st.station_id;
    this.line = null;
    const id = this.personId;
    try {
      const r = action === 'approve' ? await approveStation(id, st.station_id, st.revision)
        : action === 'refuse' ? await refuseStation(id, st.station_id, st.revision)
          : action === 'sync' ? await syncStation(id, st.station_id, st.revision)
            : await decideStation(id, st.station_id, action, st.revision, action === 'allow' ? (relays ?? (st.relays.length ? st.relays : [1])) : undefined);
      this.line = { ok: true, text: spt(outcomeKey(r.outcome)) };
    } catch (err) {
      this.line = { ok: false, text: err instanceof ApiError ? err.message : spt('error') };
    } finally {
      this.busy = '';
      await this.load();
    }
  }

  private addStation() {
    const choice = this.data ? addChoices(this.data).find((s) => s.station_id === this.pick) : undefined;
    if (!choice) return;
    const row: SpStation = {
      station_id: choice.station_id, name: choice.name, enabled: false, relays: choice.relays, source: 'none', record: null, request: null, revision: 0,
      decides: !choice.request_only, request_only: choice.request_only, actions: { allow: true, deny: false, inherit: false, approve: false, refuse: false, sync: false },
    };
    this.pick = '';
    void this.act(row, 'allow', choice.relays.length ? choice.relays : [1]);
  }

  private renderRow(st: SpStation): TemplateResult {
    const src = sourceBadge(st.source);
    const sync = st.record && st.record.sync_state !== 'applied' ? syncBadge(st.record.sync_state) : null;
    const label = stationLabel(st, this.stationNames);
    const doors = doorsText(st.relays);
    const busy = this.busy === st.station_id;
    return html`<li data-sp-station=${st.station_id}>
      <span class="name">${label}</span>
      ${doors ? html`<span class="sub">${doors}</span>` : nothing}
      <sw-badge data-sp-source=${st.source} kind=${src.kind} label=${src.label}></sw-badge>
      ${sync ? html`<sw-badge data-sp-sync=${st.record!.sync_state} kind=${sync.kind} label=${sync.label}></sw-badge>` : nothing}
      ${st.request
        ? html`<span class="req" data-sp-request>${st.request.mine ? spt('requestedMine') : spt('requested', { who: st.request.requested_by_name ?? '—' })}</span>`
        : nothing}
      ${this.confirming === st.station_id
        ? html`<div class="acts" role="group">
            <span class="sub" style="margin-inline-end:auto">${spt('confirmDeny', { station: label })}</span>
            <sw-button size="sm" @click=${() => (this.confirming = '')}>${spt('cancel')}</sw-button>
            <sw-button size="sm" variant="danger" data-sp-confirm @click=${() => void this.act(st, 'deny')}>${spt('confirmYes')}</sw-button>
          </div>`
        : (() => {
            const buttons = rowButtons(st);
            return buttons.length
              ? html`<div class="acts">${buttons.map((b) => html`<sw-button size="sm" variant=${b.primary ? 'primary' : b.action === 'deny' ? 'ghost' : 'secondary'} ?disabled=${busy}
                  data-sp-action=${b.action} @click=${() => void this.act(st, b.action)}>${b.label}</sw-button>`)}</div>`
              : nothing;
          })()}
    </li>`;
  }

  render() {
    if (this.phase === 'hidden' || (this.phase === 'loading' && !this.data)) return nothing;
    if (this.phase === 'error') {
      return html`<section data-sp-block="error"><h4>${spt('title')}</h4>
        <p class="note">${spt('error')} <sw-button size="sm" @click=${() => void this.load()}>${spt('retry')}</sw-button></p></section>`;
    }
    const p = this.data!;
    const notice = blockNotice(p);
    const choices = notice ? [] : addChoices(p);
    return html`<section data-sp-block="ready">
      <h4>${spt('title')}</h4>
      ${notice ? html`<p class="note" data-sp-notice=${notice}>${spt(notice)}</p>` : nothing}
      ${this.line ? html`<p class="line ${this.line.ok ? 'ok' : 'bad'}" role="status" data-sp-line>${this.line.text}</p>` : nothing}
      ${p.stations.length ? html`<ul>${p.stations.map((s) => this.renderRow(s))}</ul>` : html`<span class="sub" data-sp-empty>${spt('empty')}</span>`}
      ${choices.length
        ? html`<div class="add">
            <select aria-label=${spt('addPick')} data-sp-add-pick .value=${this.pick} @change=${(e: Event) => (this.pick = (e.target as HTMLSelectElement).value)}>
              <option value="">${spt('addPick')}</option>
              ${choices.map((c) => html`<option value=${c.station_id}>${c.name || this.stationNames[c.station_id] || c.station_id}</option>`)}
            </select>
            <sw-button size="sm" icon="plus" data-sp-add ?disabled=${!this.pick || !!this.busy} @click=${() => this.addStation()}>${spt('add')}</sw-button>
          </div>`
        : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-station-permissions': WiskeyStationPermissions;
  }
}

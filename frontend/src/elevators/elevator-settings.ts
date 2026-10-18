import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-badge';
import '../components/sw-state-panel';
import type { RouteState } from '../router';
import { describeError } from '../api/client';
import {
  ELEVATOR_ROLES, MAX_EXTRAS, createElevator, deleteElevator, listCandidates, listManaged, reorderElevators, updateElevator,
  type Candidate, type ElevatorRole, type ManagedElevator,
} from '../api/elevators';
import { elevatorsAccess, refreshElevatorsVisibility } from './access';
import { bodyOf, draftOf, moved, newDraft, problemOf, type Draft, type DraftProblem } from './draft';
import { chipOf } from './model';
import { elt, type EltKey } from '../i18n/elevators';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';

const ROLE_LABEL: Record<ElevatorRole, EltKey> = {
  moving_up: 'roleMovingUp', moving_down: 'roleMovingDown', waiting: 'roleWaiting', fault: 'roleFault', fire_service: 'roleFireService', door_open: 'roleDoorOpen', out_of_service: 'roleOutOfService',
};
const PROBLEM: Record<Exclude<DraftProblem, null>, EltKey> = {
  name: 'name', no_sensor: 'needOne', duplicate_sensor: 'needOne', too_many_extras: 'extras', extra_label: 'extraLabel',
};

/**
 * הגדרות › תשתיות › מעליות (CR-INFRA-ELEVATORS, `infra.elevators.manage`): the elevators in their order (up / down to reorder), the add / edit
 * dialog with one select per state role (the generator mapping's per-role select, filled from the setter's visible binary sensors) plus up to
 * four labelled extras, and delete with a confirmation. Nothing is sent to an elevator.
 */
@customElement('elevator-settings')
export class ElevatorSettings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private list: ManagedElevator[] | null = null;
  @state() private cands: Candidate[] = [];
  @state() private draft: Draft | null = null;
  @state() private confirmDelete: ManagedElevator | null = null;
  @state() private busy = false;
  @state() private fail = '';
  @state() private msg = '';

  static styles = [elecCss, css`
    :host { display: flex; flex-direction: column; gap: 14px; }
    .el { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-block-end: 1px solid var(--sw-border); }
    .el:last-child { border-block-end: 0; }
    .el .grow { flex: 1; min-inline-size: 0; }
    .map { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr); gap: 8px 12px; align-items: center; }
    .map select, .map input, .fld input { inline-size: 100%; box-sizing: border-box; }
    .xrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; gap: 8px; align-items: center; }
    .foot { display: flex; justify-content: flex-end; gap: 8px; padding-block-start: 10px; }
    @media (max-width: 600px) { .map { grid-template-columns: 1fr; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.list = (await listManaged()).elevators;
    } catch (e) {
      this.fail = describeError(e);
      this.list = this.list ?? [];
    }
  }

  private async run(fn: () => Promise<unknown>) {
    this.busy = true;
    this.fail = '';
    this.msg = '';
    try {
      await fn();
      this.msg = elt('saved');
      await this.load();
      void refreshElevatorsVisibility();
    } catch (e) {
      this.fail = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async open(d: Draft) {
    this.draft = d;
    this.fail = '';
    if (!this.cands.length) {
      try {
        this.cands = (await listCandidates()).items;
      } catch (e) {
        this.fail = describeError(e);
      }
    }
  }

  private async save() {
    const d = this.draft!;
    if (problemOf(d)) return;
    await this.run(async () => {
      if (d.id) await updateElevator(d.id, bodyOf(d));
      else await createElevator(bodyOf(d));
      this.draft = null;
    });
  }

  private setDraft(patch: Partial<Draft>) {
    this.draft = { ...this.draft!, ...patch };
  }

  private options(cur: string) {
    const opts = [...this.cands];
    if (cur && !opts.some((o) => o.entity_id === cur)) opts.unshift({ entity_id: cur, name: cur, device_class: null, area_name: null });
    return html`<option value="" ?selected=${!cur}>${elt('none')}</option>${opts.map((o) => html`<option value=${o.entity_id} ?selected=${o.entity_id === cur}>${o.name}${o.area_name ? ` · ${o.area_name}` : ''}</option>`)}`;
  }

  private dialog() {
    const d = this.draft;
    if (!d) return nothing;
    const problem = problemOf(d);
    return html`<sw-dialog open wide heading=${d.id ? elt('edit') : elt('add')} data-elevator-dialog @close=${() => (this.draft = null)}>
      <div class="col" style="gap:12px">
        <div class="fld"><label for="elname">${elt('name')}</label><input id="elname" maxlength="60" .value=${d.name} @input=${(e: Event) => this.setDraft({ name: (e.target as HTMLInputElement).value })} /></div>
        <label class="row"><input type="checkbox" .checked=${d.enabled} @change=${(e: Event) => this.setDraft({ enabled: (e.target as HTMLInputElement).checked })} /> ${elt('enabled')}</label>
        <div class="map" data-roles>${ELEVATOR_ROLES.map((r) => html`<label for=${`el-${r}`}>${elt(ROLE_LABEL[r])}</label>
          <select id=${`el-${r}`} data-role=${r} @change=${(e: Event) => this.setDraft({ sensors: { ...d.sensors, [r]: (e.target as HTMLSelectElement).value } })}>${this.options(d.sensors[r])}</select>`)}</div>
        <div class="col" style="gap:8px" data-extras><span class="b">${elt('extras')}</span>
          ${d.extras.map((x, i) => html`<div class="xrow" data-extra=${i}>
            <input aria-label=${elt('extraLabel')} placeholder=${elt('extraLabel')} maxlength="40" .value=${x.label} @input=${(e: Event) => this.setDraft({ extras: d.extras.map((y, j) => (j === i ? { ...y, label: (e.target as HTMLInputElement).value } : y)) })} />
            <select aria-label=${elt('extras')} @change=${(e: Event) => this.setDraft({ extras: d.extras.map((y, j) => (j === i ? { ...y, entity_id: (e.target as HTMLSelectElement).value } : y)) })}>${this.options(x.entity_id)}</select>
            <button type="button" class="btn sm" aria-label=${elt('remove')} @click=${() => this.setDraft({ extras: d.extras.filter((_y, j) => j !== i) })}><sw-icon name="trash" size="16"></sw-icon></button></div>`)}
          ${d.extras.length < MAX_EXTRAS ? html`<div><button type="button" class="btn sm" data-add-extra @click=${() => this.setDraft({ extras: [...d.extras, { entity_id: '', label: '' }] })}><sw-icon name="plus" size="16"></sw-icon> ${elt('addExtra')}</button></div>` : nothing}
        </div>
        ${problem && problem !== 'name' ? html`<div class="mut" data-problem=${problem}>${elt(PROBLEM[problem])}</div>` : nothing}
        ${this.fail ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.fail}</div></div>` : nothing}
      </div>
      <div class="foot"><button type="button" class="btn" @click=${() => (this.draft = null)}>${elt('cancel')}</button>
        <button type="button" class="btn pri" ?disabled=${this.busy || !!problem} data-elevator-save @click=${() => void this.save()}>${elt('save')}</button></div>
    </sw-dialog>`;
  }

  private deleteDialog() {
    const e = this.confirmDelete;
    if (!e) return nothing;
    return html`<sw-dialog open heading=${elt('removeConfirm', { name: e.name })} data-elevator-delete @close=${() => (this.confirmDelete = null)}>
      <div class="foot"><button type="button" class="btn" autofocus @click=${() => (this.confirmDelete = null)}>${elt('cancel')}</button>
        <button type="button" class="btn dng pri" ?disabled=${this.busy} data-elevator-delete-yes @click=${() => void this.run(async () => { await deleteElevator(e.id); this.confirmDelete = null; })}>${elt('remove')}</button></div>
    </sw-dialog>`;
  }

  render() {
    if (!elevatorsAccess().manage) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (!this.list) return html`<div class="skl" style="block-size:120px" data-state="loading"></div>`;
    const ids = this.list.map((e) => e.id);
    return html`<div class="row"><span class="h2">${elt('title')}</span><div class="sp"></div>
        <button type="button" class="btn pri" data-elevator-add @click=${() => void this.open(newDraft())}><sw-icon name="plus" size="16"></sw-icon> ${elt('add')}</button></div>
      <div class="mut">${elt('settingsIntro')}</div>
      ${this.msg ? html`<div class="mut" role="status" data-saved>${this.msg}</div>` : nothing}
      ${this.fail && !this.draft ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.fail}</div></div>` : nothing}
      ${!this.list.length
        ? html`<sw-state-panel state="empty" heading=${elt('settingsEmpty')} data-state="empty"></sw-state-panel>`
        : html`<div class="card flush" data-elevator-list>${this.list.map((e, i) => {
            const c = chipOf(e);
            const missing = Object.values(e.sensors).some((s) => s?.missing) || e.extras.some((x) => x.missing);
            return html`<div class="el" data-elevator=${e.id}>
              <div class="grow"><b>${e.name}</b>${!e.enabled ? html` <span class="chip c-mut nodot">${elt('disabled')}</span>` : nothing}${missing ? html`<div class="mut" data-missing>${elt('missing')}</div>` : nothing}</div>
              <sw-badge kind=${c.tone} label=${c.label}></sw-badge>
              <button type="button" class="btn sm" aria-label=${elt('up')} ?disabled=${this.busy || i === 0} @click=${() => void this.run(() => reorderElevators(moved(ids, e.id, -1)))}><sw-icon name="arrowUp" size="16"></sw-icon></button>
              <button type="button" class="btn sm" aria-label=${elt('down')} ?disabled=${this.busy || i === ids.length - 1} @click=${() => void this.run(() => reorderElevators(moved(ids, e.id, 1)))}><sw-icon name="arrowDown" size="16"></sw-icon></button>
              <button type="button" class="btn sm" data-elevator-edit @click=${() => void this.open(draftOf(e))}>${elt('edit')}</button>
              <button type="button" class="btn sm dng" data-elevator-remove @click=${() => (this.confirmDelete = e)}><sw-icon name="trash" size="16"></sw-icon></button>
            </div>`;
          })}</div>`}
      ${this.dialog()}${this.deleteDialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elevator-settings': ElevatorSettings;
  }
}

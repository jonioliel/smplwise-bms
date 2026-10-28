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
import { ELEVATOR_FILTERS, ELEVATOR_MODES, FILTER_KEY, HOME_EDIT_HREF, MODE_KEY, chipOf } from './model';
import { elevatorCss, stateBadge } from './styles';
import './elevator-alerts'; // 2.8.0: the alert settings card (owner decision 2026-10-18)
import { elt, type EltKey } from '../i18n/elevators';
import { canAnywhere } from '../api/session';
import { loadHomeSettings, saveHomeSettings, type ElevatorsCfg, type HomeSettings } from '../api/home';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';

const ROLE_LABEL: Record<ElevatorRole, EltKey> = {
  moving_up: 'roleMovingUp', moving_down: 'roleMovingDown', waiting: 'roleWaiting', fault: 'roleFault', fire_service: 'roleFireService', door_open: 'roleDoorOpen', out_of_service: 'roleOutOfService',
};
/** 2.8.0 (owner 2026-10-18): the installation has waiting / fault / fire service / shutdown sensors only - up, down and door are offered again
 * only when an elevator already links one (kept, never dropped silently); the dialog says they can be added later. */
const SHOWN_ROLES: readonly ElevatorRole[] = ['waiting', 'fault', 'fire_service', 'out_of_service'];
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
  /** 2.8.0: the installation's home settings (the elevators widget's display choices); null = not read / not allowed. */
  @state() private home: HomeSettings | null = null;
  @state() private homeBusy = false;
  @state() private homeFail = '';

  static styles = [elecCss, elevatorCss, css`
    :host { display: flex; flex-direction: column; gap: 14px; }
    .dset { display: grid; gap: 8px; max-inline-size: 640px; margin-block-start: 8px; }
    /* R5-MEDIA-ENERGY-297: an option row is a well inside the card (no outlined box inside a card inside a card), its label in the heading ink */
    .drow { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; border: 0; background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 10px 14px; min-block-size: 48px; }
    .drow > span:first-child { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .seg { display: inline-flex; flex-wrap: wrap; background: var(--sw-surface-3); padding: 2px; border-radius: 999px; gap: 1px; }
    .seg button { border: 0; background: transparent; padding: 3px 12px; min-block-size: 30px; font: inherit; font-size: var(--sw-fs-xs); color: var(--sw-text-2); border-radius: 999px; cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .seg button:focus-visible, .lnk:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent)); outline-offset: 1px; }
    .incl { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .lnk { color: var(--sw-accent-text, var(--sw-accent)); font-size: var(--sw-fs-sm); }
    /* R5-MEDIA-ENERGY-297: an elevator row is a well (52 px) with its name 16 px / 700 in the heading ink, not a ruled table line */
    .el { display: flex; align-items: center; gap: 10px; padding: 8px 14px; margin: 6px 8px; min-block-size: 52px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    .el:first-child { margin-block-start: 8px; }
    .el:last-child { margin-block-end: 8px; }
    .el .grow { flex: 1; min-inline-size: 0; }
    .el .grow > b { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .map { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr); gap: 8px 12px; align-items: center; }
    .map select, .map input, .fld input { inline-size: 100%; box-sizing: border-box; }
    .xrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; gap: 8px; align-items: center; }
    .foot { display: flex; justify-content: flex-end; gap: 8px; padding-block-start: 10px; }
    @media (max-width: 600px) { .map { grid-template-columns: 1fr; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    if (canAnywhere('system.configure')) void this.loadHome();
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
        <label class="row" data-travel-option><input type="checkbox" data-travel-toggle .checked=${d.showTravel} @change=${(e: Event) => this.setDraft({ showTravel: (e.target as HTMLInputElement).checked })} /> ${elt('travelOption')}</label>
        <div class="mut">${elt('travelOptionHint')}</div>
        <div class="map" data-roles>${ELEVATOR_ROLES.filter((r) => SHOWN_ROLES.includes(r) || !!d.sensors[r]).map((r) => html`<label for=${`el-${r}`}>${elt(ROLE_LABEL[r])}</label>
          <select id=${`el-${r}`} data-role=${r} @change=${(e: Event) => this.setDraft({ sensors: { ...d.sensors, [r]: (e.target as HTMLSelectElement).value } })}>${this.options(d.sensors[r])}</select>`)}
          <span class="mut">${elt('futureRoles')}</span><span class="mut" data-roles-future>${elt('futureNone')}</span></div>
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
        ? html`<sw-state-panel icon="elevator" state="empty" heading=${elt('settingsEmpty')} data-state="empty"></sw-state-panel>`
        : html`<div class="card flush" data-elevator-list>${this.list.map((e, i) => {
            const c = chipOf(e);
            const missing = Object.values(e.sensors).some((s) => s?.missing) || e.extras.some((x) => x.missing);
            return html`<div class="el" data-elevator=${e.id}>
              <div class="grow"><b>${e.name}</b>${!e.enabled ? html` <span class="chip c-mut nodot">${elt('disabled')}</span>` : nothing}${missing ? html`<div class="mut" data-missing>${elt('missing')}</div>` : nothing}</div>
              ${stateBadge(c, true)}
              <button type="button" class="btn sm" aria-label=${elt('up')} ?disabled=${this.busy || i === 0} @click=${() => void this.run(() => reorderElevators(moved(ids, e.id, -1)))}><sw-icon name="arrowUp" size="16"></sw-icon></button>
              <button type="button" class="btn sm" aria-label=${elt('down')} ?disabled=${this.busy || i === ids.length - 1} @click=${() => void this.run(() => reorderElevators(moved(ids, e.id, 1)))}><sw-icon name="arrowDown" size="16"></sw-icon></button>
              <button type="button" class="btn sm" data-elevator-edit @click=${() => void this.open(draftOf(e))}>${elt('edit')}</button>
              <button type="button" class="btn sm dng" data-elevator-remove @click=${() => (this.confirmDelete = e)}><sw-icon name="trash" size="16"></sw-icon></button>
            </div>`;
          })}</div>`}
      ${this.list.length ? this.display() : nothing}
      ${this.list.length ? html`<elevator-alerts></elevator-alerts>` : nothing}
      ${this.dialog()}${this.deleteDialog()}`;
  }

  // ---------------------------------------------------------------- 2.8.0: how the elevators appear on the home screen (for everyone)

  private async loadHome() {
    try {
      this.home = await loadHomeSettings(true);
    } catch {
      this.home = null;
    }
  }

  /** Review L4: the change is applied to a FRESH copy of the home settings read right before the save, and only the elevators widget's own keys
   * change - an edit made meanwhile in the home edit mode (another tab or user) is kept, never overwritten by an old snapshot. */
  private async saveHome(fn: (c: ElevatorsCfg, direction: HomeSettings['direction']) => void) {
    if (!this.home) return;
    this.homeBusy = true;
    this.homeFail = '';
    const before = this.home;
    try {
      const from = await loadHomeSettings(true);
      const to: HomeSettings = JSON.parse(JSON.stringify(from)) as HomeSettings;
      fn(to.config.elevators, to.direction);
      this.home = to;
      this.home = await saveHomeSettings(from, to);
    } catch (e) {
      this.home = before;
      this.homeFail = describeError(e);
    } finally {
      this.homeBusy = false;
    }
  }

  /** The mockup's "תצוגה במסך הראשי": the widget on / off, the display mode, the size in the layout direction in use (the others keep theirs, review L4), what is listed and which
   * elevators appear. These are the installation's choices (system.configure, the home settings' own permission); a user with
   * screen.personalize may choose differently for himself (החשבון שלי › המסך שלי). Place and size per direction: the home edit mode. */
  private display() {
    const canHome = canAnywhere('system.configure');
    if (!canHome) return html`<div class="card" data-elevators-display><div class="b">${elt('displayTitle')}</div><div class="mut">${elt('displayAdmin')}</div></div>`;
    if (!this.home) return nothing;
    const c = this.home.config.elevators;
    const size = c.sizes[this.home.direction]; // review L4: the size of the layout direction in use; the other directions keep theirs
    const seg = <T extends string>(label: string, values: readonly T[], cur: T, key: (v: T) => EltKey, set: (v: T) => void, attr: string) => html`<div class="drow"><span>${label}</span>
      <span class="seg" role="group" aria-label=${label}>${values.map((v) => html`<button type="button" data-elevators-display-opt=${`${attr}:${v}`} aria-pressed=${String(cur === v)} ?disabled=${this.homeBusy} @click=${() => set(v)}>${elt(key(v))}</button>`)}</span></div>`;
    return html`<div class="card" data-elevators-display>
      <div class="b">${elt('displayTitle')}</div>
      <div class="dset">
        ${seg(elt('displayWidget'), ['on', 'off'] as const, c.on ? 'on' : 'off', (v) => (v === 'on' ? 'shown' : 'hiddenOpt'), (v) => void this.saveHome((x) => (x.on = v === 'on')), 'on')}
        ${seg(elt('displayMode'), ELEVATOR_MODES, c.mode, (v) => MODE_KEY[v], (v) => void this.saveHome((x) => (x.mode = v)), 'mode')}
        ${seg(elt('defaultSize'), ['s', 'm', 'l'] as const, size, (v) => (v === 's' ? 'sizeS' : v === 'm' ? 'sizeM' : 'sizeL'), (v) => void this.saveHome((x, dir) => (x.sizes = { ...x.sizes, [dir]: v })), 'size')}
        ${seg(elt('filter'), ELEVATOR_FILTERS, c.filter, (v) => FILTER_KEY[v], (v) => void this.saveHome((x) => (x.filter = v)), 'filter')}
        <div class="drow"><span>${elt('include')}</span><span class="incl">${(this.list ?? []).map((e) => html`<label class="row"><input type="checkbox" data-elevators-display-include=${e.id} .checked=${!c.hidden.includes(e.id)} ?disabled=${this.homeBusy}
          @change=${(ev: Event) => { const on = (ev.target as HTMLInputElement).checked; void this.saveHome((x) => (x.hidden = on ? x.hidden.filter((h) => h !== e.id) : [...x.hidden, e.id])); }} /> ${e.name}</label>`)}</span></div>
        <a class="lnk" href=${HOME_EDIT_HREF} data-elevators-home-edit>${elt('editHome')}</a>
      </div>
      ${this.homeFail ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.homeFail}</div></div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elevator-settings': ElevatorSettings;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { MATCH_LABEL, PRESET_LABEL, getConditionCandidates, type ConditionCandidate, type ConditionPreset, type ConditionView, type DraftCondition, type DraftConditions, type MatchType, type Problem, type ShabbatSensor } from '../api/schedules';
import { activePreset, addCondition, applyPreset, clearConditions, describeCondition, newCondition, removeCondition, stateChoices, updateCondition } from './schedule-edit-logic';
import { tr } from '../i18n/msg/automation';
import '../components/sw-field';

/**
 * CR-014 S4: the condition builder (SCHEDULER_API §2.4, §12.5) - one block for the whole schedule (the component keeps the
 * same conditions in every slot). Presets first ("רק בשבת ובחג", "לא בשבת ובחג", "מוצאי שבת" - they need the configured
 * holiday sensor), then any sensor / binary sensor / helper / sun as a condition with `is / not` (and `above / below` for a
 * number), "all of them" or "one of them", and "keep checking until the window ends". A condition on a device the person may
 * not read is shown locked: no controls, and it is sent back unchanged (the server refuses anything else).
 *
 *   conditions-change {conditions}    preset-motzash {}
 */

const OPS_STATE: MatchType[] = ['is', 'not'];
const OPS_NUMBER: MatchType[] = ['above', 'below', 'is', 'not'];

@customElement('schedule-conditions')
export class ScheduleConditions extends LitElement {
  @property({ attribute: false }) conditions: DraftConditions = { items: [], type: null, track: false };
  /** The schedule's conditions as loaded (to know which are locked and their names). */
  @property({ attribute: false }) views: ConditionView[] = [];
  @property({ attribute: false }) sensor: ShabbatSensor | null = null;
  /** The person may pick the holiday sensor (settings): a hint replaces the presets when none is set. */
  @property({ type: Boolean }) canConfigure = false;
  @property({ attribute: false }) warnings: Problem[] = [];
  @property({ type: Boolean }) readOnly = false;
  @state() private adding = false;
  @state() private cands: ConditionCandidate[] = [];
  @state() private loading = false;
  @state() private q = '';

  static styles = css`
    :host {
      display: block;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-end: 10px;
    }
    .preset {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      border-radius: var(--sw-r-sm);
      padding: 4px 10px;
      min-block-size: 30px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .preset[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .preset:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      margin-block-end: 8px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cond {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 8px;
      align-items: center;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      background: var(--sw-surface-2);
    }
    .cond.locked {
      background: var(--sw-surface-3);
    }
    .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      min-inline-size: 0;
    }
    .nm small {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .ctl {
      grid-column: 1 / -1;
      display: flex;
      gap: 6px;
    }
    select,
    input {
      min-block-size: 30px;
      box-sizing: border-box;
      padding: 3px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    select {
      flex: 1;
    }
    input.val {
      flex: 1;
      direction: ltr;
      text-align: start;
    }
    select:focus,
    input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the and / or switch is sw-segmented - its small 2 px track and plain-weight keys through the knobs */
    sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-gap: 0px;
      --sw-seg-h: 26px;
      --sw-seg-radius: var(--sw-r-sm);
      --sw-seg-btn-radius: var(--sw-r-xs);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-regular);
    }
    label.check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    label.check input {
      min-block-size: 0;
      accent-color: var(--sw-accent);
    }
    .lock {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .add {
      margin-block-start: 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 8px;
      background: var(--sw-surface);
    }
    .add input {
      inline-size: 100%;
    }
    .cands {
      max-block-size: 220px;
      overflow: auto;
      margin-block-start: 6px;
    }
    .cand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      inline-size: 100%;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      padding: 7px 8px;
      border-radius: var(--sw-r-sm);
      cursor: pointer;
      color: var(--sw-text);
    }
    .cand:hover,
    .cand:focus-visible {
      background: var(--sw-accent-soft);
      outline: none;
    }
    .cand small {
      color: var(--sw-text-3);
    }
    .warn {
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `;

  private emit(c: DraftConditions) {
    // the names of the devices in the block travel with it (the header chip of the editor reads them)
    const names: Record<string, string> = {};
    for (const it of c.items) names[it.entity_id] = this.nameOf(it.entity_id);
    this.dispatchEvent(new CustomEvent('conditions-change', { detail: { conditions: c, names }, bubbles: true, composed: true }));
  }

  private get lockedIds(): string[] {
    return this.views.filter((v) => v.locked).map((v) => v.entity_id);
  }

  private viewOf(c: DraftCondition): ConditionView | undefined {
    return this.views.find((v) => v.entity_id === c.entity_id && v.attribute === c.attribute && v.match_type === c.match_type && v.value === c.value);
  }

  private nameOf(id: string): string {
    return this.views.find((v) => v.entity_id === id)?.name ?? this.cands.find((c) => c.entity_id === id)?.name ?? (this.sensor?.entity_id === id ? this.sensor.name : id);
  }

  private candOf(id: string): ConditionCandidate | undefined {
    return this.cands.find((c) => c.entity_id === id);
  }

  private preset(p: ConditionPreset) {
    if (!this.sensor || this.readOnly) return;
    const active = activePreset(this.conditions, this.sensor.entity_id);
    this.emit(active === p ? clearConditions(this.conditions, this.lockedIds) : applyPreset(this.conditions, p, this.sensor.entity_id, this.lockedIds));
  }

  private asked = false;

  private async loadCands() {
    if (this.asked) return;
    this.asked = true;
    this.loading = true;
    try {
      this.cands = (await getConditionCandidates()).entities;
    } catch {
      this.cands = [];
    }
    this.loading = false;
  }

  willUpdate() {
    // the names and kinds of the conditions already on the schedule come from the same list
    if (!this.asked && this.conditions.items.length && !this.readOnly) void this.loadCands();
  }

  private async openAdd() {
    this.adding = true;
    this.q = '';
    await this.loadCands();
  }

  private pick(c: ConditionCandidate) {
    this.adding = false;
    this.emit(addCondition(this.conditions, newCondition(c)));
  }

  private renderCondition(c: DraftCondition, i: number) {
    const view = this.viewOf(c);
    const locked = !!view?.locked;
    const name = this.nameOf(c.entity_id);
    if (locked) {
      return html`<div class="cond locked" data-condition-locked=${c.entity_id}>
        <div class="nm"><sw-icon name="lock" size="14"></sw-icon>${describeCondition(c, name)}</div>
        <span class="lock">${tr('מחוץ להרשאתך')}</span>
      </div>`;
    }
    const cand = this.candOf(c.entity_id);
    const numeric = cand?.numeric || c.match_type === 'above' || c.match_type === 'below' || typeof c.value === 'number';
    const ops = numeric ? OPS_NUMBER : OPS_STATE;
    const choices = stateChoices(cand ?? (numeric ? undefined : { entity_id: c.entity_id, name, domain: c.entity_id.startsWith('sun.') ? 'sun' : 'binary_sensor', device_class: null, state: null, unit: null, numeric: false, suggested_shabbat: false }));
    return html`<div class="cond" data-condition=${c.entity_id}>
      <div class="nm">${name}${c.attribute !== 'state' ? html`<small>${c.attribute}</small>` : nothing}${view?.readable && view.state !== null ? html`<small>${tr('כרגע: {state}', { state: view.state })}</small>` : nothing}</div>
      ${this.readOnly ? nothing : html`<sw-button size="sm" variant="ghost" iconOnly icon="close" label=${tr('הסרת התנאי')} data-condition-remove @click=${() => this.emit(removeCondition(this.conditions, i))}></sw-button>`}
      <div class="ctl">
        <sw-field flow><select ?disabled=${this.readOnly} aria-label=${tr('סוג ההשוואה')} data-condition-op @change=${(e: Event) => this.emit(updateCondition(this.conditions, i, { match_type: (e.target as HTMLSelectElement).value as MatchType }))}>
          ${ops.map((o) => html`<option value=${o} ?selected=${c.match_type === o}>${MATCH_LABEL[o]}</option>`)}
        </select></sw-field>
        ${numeric
          ? html`<input class="val" type="number" ?disabled=${this.readOnly} aria-label=${tr('ערך')} data-condition-value .value=${String(c.value)} @change=${(e: Event) => this.emit(updateCondition(this.conditions, i, { value: Number((e.target as HTMLInputElement).value) }))} />`
          : choices.length
            ? html`<sw-field flow><select ?disabled=${this.readOnly} aria-label=${tr('ערך')} data-condition-value @change=${(e: Event) => this.emit(updateCondition(this.conditions, i, { value: (e.target as HTMLSelectElement).value }))}>
                ${choices.some((x) => x.value === c.value) ? nothing : html`<option value=${String(c.value)} selected>${String(c.value)}</option>`}
                ${choices.map((x) => html`<option value=${x.value} ?selected=${c.value === x.value}>${x.label}</option>`)}
              </select></sw-field>`
            : html`<input class="val" type="text" ?disabled=${this.readOnly} aria-label=${tr('ערך')} data-condition-value .value=${String(c.value)} @change=${(e: Event) => this.emit(updateCondition(this.conditions, i, { value: (e.target as HTMLInputElement).value }))} />`}
      </div>
    </div>`;
  }

  private renderAdd() {
    const q = this.q.trim().toLowerCase();
    const rank = (c: ConditionCandidate) => ({ binary_sensor: 0, sensor: 1, input_boolean: 2, sun: 3 })[c.domain];
    const list = this.cands
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.entity_id.toLowerCase().includes(q))
      .sort((a, b) => Number(b.suggested_shabbat) - Number(a.suggested_shabbat) || rank(a) - rank(b));
    return html`<div class="add" data-condition-add>
      <input type="search" placeholder=${tr('חיפוש חיישן')} aria-label=${tr('חיפוש חיישן לתנאי')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
      <div class="cands">
        ${this.loading ? html`<div class="hint">${tr('טוען…')}</div>` : list.length ? list.map((c) => html`<button type="button" class="cand" data-candidate=${c.entity_id} @click=${() => this.pick(c)}><span>${c.name}</span><small>${c.state ?? ''}${c.unit ? ` ${c.unit}` : ''}</small></button>`) : html`<div class="hint">${tr('לא נמצאו חיישנים')}</div>`}
      </div>
      <div class="row"><sw-button size="sm" @click=${() => (this.adding = false)}>${tr('ביטול')}</sw-button></div>
    </div>`;
  }

  render() {
    const c = this.conditions;
    const active = this.sensor ? activePreset(c, this.sensor.entity_id) : null;
    return html`<div data-conditions>
      ${this.sensor
        ? html`<div class="presets" role="group" aria-label=${tr('תנאים מוכנים')}>
            ${(['only_holy_days', 'not_holy_days'] as ConditionPreset[]).map((p) => html`<button type="button" class="preset" data-preset=${p} aria-pressed=${active === p} ?disabled=${this.readOnly} @click=${() => this.preset(p)}>${PRESET_LABEL[p]}</button>`)}
            <button type="button" class="preset" data-preset="motzash" ?disabled=${this.readOnly} @click=${() => this.dispatchEvent(new CustomEvent('preset-motzash', { bubbles: true, composed: true }))}>${tr('מוצאי שבת')}</button>
          </div>`
        : this.canConfigure
          ? html`<div class="hint" data-preset-hint>${tr('בחרו חיישן שבת וחג בהגדרות ‹ תזמונים כדי לקבל תנאים מוכנים.')}</div>`
          : nothing}
      <div class="list">${c.items.map((it, i) => this.renderCondition(it, i))}</div>
      ${c.items.length > 1
        ? html`<div class="row"><span>${tr('יתקיימו')}</span><sw-segmented size="sm" label=${tr('חיבור התנאים')} value=${c.type === 'or' ? 'or' : 'and'} ?disabled=${this.readOnly}
            @change=${(e: CustomEvent<SegmentedChange>) => this.emit({ ...c, type: e.detail.value === 'or' ? 'or' : 'and' })}
            .options=${[{ value: 'and', label: tr('כל התנאים'), attrs: { 'data-cond-type': 'and' } }, { value: 'or', label: tr('אחד מהם'), attrs: { 'data-cond-type': 'or' } }]}></sw-segmented></div>`
        : nothing}
      ${c.items.length
        ? html`<div class="row"><label class="check"><input type="checkbox" data-cond-track ?disabled=${this.readOnly} .checked=${c.track} @change=${(e: Event) => this.emit({ ...c, track: (e.target as HTMLInputElement).checked })} />${tr('המשך לבדוק עד סוף החלון')}</label></div>`
        : nothing}
      ${this.adding ? this.renderAdd() : this.readOnly ? nothing : html`<div class="row"><sw-button size="sm" icon="plus" data-condition-new @click=${() => this.openAdd()}>${tr('תנאי')}</sw-button></div>`}
      ${this.warnings.length ? html`<ul class="warn" data-cond-warnings>${this.warnings.map((w) => html`<li>${w.message}</li>`)}</ul>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-conditions': ScheduleConditions;
  }
}

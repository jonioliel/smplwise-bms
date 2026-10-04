import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-schedule-bar';
import { actionLabel, type ArgSpec, type Problem } from '../api/schedules';
import {
  defaultDataFor,
  groupActions,
  isLoweringAction,
  isSensitiveAction,
  mirrorAction,
  removeEntityFromSlot,
  serviceWord,
  setGroupAction,
  slotSummary,
  timeFromParts,
  timeParts,
  type ActionGroup,
  type EditSlot,
  type MetaMap,
  type TimeKind,
} from './schedule-edit-logic';

/**
 * CR-014 S4: the editor of one slot (mockup 05 / 06, the card under the board): when it runs, when its window ends, what it
 * does, and the "כיבוי בסיום" helper. The panel edits a copy and reports `slot-change` with the whole new slot; the editor
 * applies it (and re-validates). Read-only content (`locked`) shows why and offers nothing to change.
 *
 *   slot-change {slot}   slot-delete   slot-duplicate   slot-copy-days   slot-close   pair-off {on}
 */

const ADVANCED = new Set(['cover.stop_cover', 'cover.set_cover_tilt_position', 'cover.open_cover_tilt', 'cover.close_cover_tilt', 'climate.set_fan_mode', 'climate.set_preset_mode', 'climate.set_swing_mode', 'climate.set_humidity', 'fan.set_percentage']);

const ARG_LABEL: Record<string, string> = {
  brightness: 'בהירות',
  brightness_pct: 'בהירות',
  position: 'מיקום',
  tilt_position: 'הטיה',
  temperature: 'טמפרטורה',
  hvac_mode: 'מצב פעולה',
  percentage: 'עוצמה',
  fan_mode: 'מצב מאוורר',
  preset_mode: 'מצב מוגדר',
  swing_mode: 'מצב נדנוד',
  humidity: 'לחות',
  mode: 'מצב',
  value: 'ערך',
  option: 'אפשרות',
};

const HVAC_WORDS: Record<string, string> = { cool: 'קירור', heat: 'חימום', heat_cool: 'אוטומטי', auto: 'אוטומטי', dry: 'ייבוש', fan_only: 'מאוורר', off: 'כבוי' };

const KIND_LABEL: Record<TimeKind, string> = { fixed: 'שעה קבועה', sunrise: 'זריחה', sunset: 'שקיעה', end: 'סוף היום', none: 'ללא (פעולה חד־פעמית)' };

@customElement('schedule-slot-panel')
export class ScheduleSlotPanel extends LitElement {
  @property({ attribute: false }) slotData: EditSlot | null = null;
  @property({ type: Number }) index = 0;
  @property({ type: Number }) count = 0;
  @property({ attribute: false }) meta: MetaMap = new Map();
  /** Every device of the schedule (to add one to this slot's actions). */
  @property({ attribute: false }) entityIds: string[] = [];
  @property({ type: Boolean }) allowNegativeSun = false;
  @property({ type: Boolean }) readOnly = false;
  /** Why this slot's content cannot be edited here (round-tripped untouched). */
  @property({ attribute: false }) locked: Problem[] = [];
  @property({ attribute: false }) errors: Problem[] = [];
  /** A "כיבוי בסיום" companion exists. */
  @property({ type: Boolean }) paired = false;
  @property({ type: Boolean }) canPair = false;
  @property({ type: Boolean }) canCopyDays = true;

  static styles = css`
    :host {
      display: block;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .sum {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .sp {
      flex: 1;
    }
    .marks {
      display: inline-flex;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .chip.warn {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .chip.sens {
      background: rgba(139, 92, 246, 0.14);
      color: #6d28d9;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      align-items: start;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-inline-size: 0;
    }
    .f > label,
    .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .pair {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .pair input {
      inline-size: 96px;
      flex: none;
    }
    .pair .unit {
      white-space: nowrap;
    }
    input,
    select {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 32px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    input[type='range'] {
      padding: 0;
      min-block-size: 24px;
      accent-color: var(--sw-accent);
    }
    input[type='time'],
    input[type='number'] {
      direction: ltr;
      text-align: start;
    }
    input[disabled],
    select[disabled] {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .groups {
      display: flex;
      flex-direction: column;
      gap: 10px;
      grid-column: 1 / -1;
    }
    .group {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px;
      background: var(--sw-surface-2);
    }
    .ents {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ent {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      font-size: var(--sw-fs-sm);
    }
    .ent button {
      display: grid;
      place-items: center;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    .ent button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .arg {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .vars {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      align-items: end;
    }
    .vars > .lbl {
      grid-column: 1 / -1;
    }
    .arg .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .arg .row input[type='number'] {
      inline-size: 84px;
      flex: none;
    }
    .unit {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .lockmsg {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: #92400e;
      font-size: var(--sw-fs-sm);
    }
    .lockmsg sw-icon {
      margin-block-start: 1px;
    }
    .errs {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .off {
      display: flex;
      align-items: center;
      gap: 10px;
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 10px;
      font-size: var(--sw-fs-sm);
    }
    .off b {
      font-weight: var(--sw-fw-semibold);
    }
    .add-ent {
      max-inline-size: 260px;
    }
    .empty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
  `;

  private change(slot: EditSlot) {
    this.dispatchEvent(new CustomEvent('slot-change', { detail: { slot }, bubbles: true, composed: true }));
  }

  private fire(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------------------------------ times

  private setTime(which: 'start' | 'stop', patch: Partial<{ kind: TimeKind; time: string; offset: number }>) {
    const s = this.slotData;
    if (!s) return;
    const cur = timeParts(which === 'start' ? s.start : s.stop, which === 'stop');
    let next = { ...cur, ...patch };
    if (patch.kind && patch.kind !== cur.kind && patch.kind === 'fixed' && cur.kind !== 'fixed') {
      // from a sun anchor / end / none to a fixed time: keep something sensible next to the start
      next = { ...next, time: which === 'stop' ? this.nextTime(s.start) : '08:00' };
    }
    if (next.offset < 0 && !this.allowNegativeSun) next = { ...next, offset: 0 };
    const raw = timeFromParts(next);
    this.change(which === 'start' ? { ...s, start: raw ?? s.start } : { ...s, stop: raw });
  }

  private nextTime(startRaw: string): string {
    const m = /^(\d{2}):(\d{2})/.exec(startRaw);
    if (!m) return '09:00';
    const t = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + 60);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  private timeField(which: 'start' | 'stop') {
    const s = this.slotData!;
    const p = timeParts(which === 'start' ? s.start : s.stop, which === 'stop');
    const kinds: TimeKind[] = which === 'start' ? ['fixed', 'sunrise', 'sunset'] : ['fixed', 'sunrise', 'sunset', 'end', 'none'];
    const id = `${which}-${s.uid}`;
    return html`<div class="f">
      <label for=${id}>${which === 'start' ? 'משעה (רגע הביצוע)' : 'עד שעה (סוף חלון)'}</label>
      <select id=${id} ?disabled=${this.readOnly} data-time-kind=${which} @change=${(e: Event) => this.setTime(which, { kind: (e.target as HTMLSelectElement).value as TimeKind })}>
        ${kinds.map((k) => html`<option value=${k} ?selected=${p.kind === k}>${KIND_LABEL[k]}</option>`)}
      </select>
      ${p.kind === 'fixed'
        ? html`<input type="time" step="60" ?disabled=${this.readOnly} data-time=${which} aria-label=${which === 'start' ? 'שעת התחלה' : 'שעת סיום'} .value=${p.time} @change=${(e: Event) => (e.target as HTMLInputElement).value && this.setTime(which, { time: (e.target as HTMLInputElement).value })} />`
        : p.kind === 'sunrise' || p.kind === 'sunset'
          ? html`<div class="pair">
              <input type="number" min=${this.allowNegativeSun ? -720 : 0} max="720" step="5" ?disabled=${this.readOnly} data-offset=${which} aria-label="דקות אחרי ${p.kind === 'sunrise' ? 'הזריחה' : 'השקיעה'}" .value=${String(p.offset)} @change=${(e: Event) => this.setTime(which, { offset: Number((e.target as HTMLInputElement).value) || 0 })} />
              <span class="unit">דקות אחרי</span>
            </div>`
          : nothing}
    </div>`;
  }

  // ------------------------------------------------------------------------------------------ actions

  private updateGroup(group: ActionGroup, service: string, data: Record<string, unknown>) {
    const s = this.slotData;
    if (!s) return;
    this.change({ ...s, actions: setGroupAction(s.actions, group, service, data) });
  }

  private onService(group: ActionGroup, service: string) {
    const first = group.entities.find((e): e is string => !!e);
    const meta = first ? this.meta.get(first) : undefined;
    const specs = meta?.actions.find((a) => a.service === service)?.args ?? [];
    this.updateGroup(group, service, defaultDataFor(specs, meta));
  }

  private removeEntity(id: string | null) {
    const s = this.slotData;
    if (!s || !id) return;
    this.change({ ...s, actions: removeEntityFromSlot(s.actions, id) });
  }

  private addEntity(id: string) {
    const s = this.slotData;
    const m = this.meta.get(id);
    if (!s || !m) return;
    const groups = groupActions(s.actions);
    let a = null;
    for (const g of groups) {
      const sample = s.actions.find((x) => x.entity_id === g.entities[0]);
      if (sample) {
        a = mirrorAction(sample, m);
        if (a) break;
      }
    }
    a ??= m.actions[0] ? { service: m.actions[0].service, entity_id: id, data: defaultDataFor(m.actions[0].args, m) } : null;
    if (a) this.change({ ...s, actions: [...s.actions, a] });
  }

  private setArg(group: ActionGroup, name: string, value: unknown) {
    const data = { ...group.data };
    if (value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) delete data[name];
    else data[name] = value;
    this.updateGroup(group, group.service, data);
  }

  /** A script's variables (`data.variables`): one field per variable the script declares, typed by its selector (2026-10-04). */
  private setVar(group: ActionGroup, name: string, value: unknown) {
    const vars = { ...((group.data.variables as Record<string, unknown> | undefined) ?? {}) };
    if (value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) delete vars[name];
    else vars[name] = value;
    const data = { ...group.data };
    if (Object.keys(vars).length) data.variables = vars;
    else delete data.variables;
    this.updateGroup(group, group.service, data);
  }

  private renderVars(group: ActionGroup, spec: ArgSpec) {
    const ro = this.readOnly;
    const vars = (group.data.variables as Record<string, unknown> | undefined) ?? {};
    return html`<div class="vars" data-arg="variables">
      <span class="lbl">${spec.label ?? 'משתני הסקריפט'}</span>
      ${(spec.fields ?? []).map((f) => {
        const v = vars[f.name];
        const key = `${group.key}:var:${f.name}`;
        const label = `${f.label ?? f.name}${f.required ? ' *' : ''}`;
        if (f.type === 'bool') {
          return html`<label class="pair" data-var=${f.name}><input type="checkbox" style="inline-size:auto;min-block-size:0" ?disabled=${ro} .checked=${v === true} @change=${(e: Event) => this.setVar(group, f.name, (e.target as HTMLInputElement).checked)} />${label}</label>`;
        }
        if (f.choices && f.choices.length) {
          return html`<div class="arg" data-var=${f.name}><label for=${key}>${label}</label>
            <select id=${key} ?disabled=${ro} @change=${(e: Event) => this.setVar(group, f.name, (e.target as HTMLSelectElement).value)}>
              ${f.required ? nothing : html`<option value="" ?selected=${v === undefined}>ללא</option>`}
              ${f.choices.map((c) => html`<option value=${c} ?selected=${v === c}>${c}</option>`)}
            </select></div>`;
        }
        if (f.type === 'int' || f.type === 'float') {
          return html`<div class="arg" data-var=${f.name}><label for=${key}>${label}</label>
            <div class="row"><input id=${key} type="number" step=${f.step ?? (f.type === 'int' ? 1 : 0.5)} min=${f.min ?? nothing} max=${f.max ?? nothing} ?disabled=${ro} .value=${v === undefined ? '' : String(v)}
              @change=${(e: Event) => this.setVar(group, f.name, (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value))} /><span class="unit">${f.unit ?? ''}</span></div></div>`;
        }
        return html`<div class="arg" data-var=${f.name}><label for=${key}>${label}</label>
          <input id=${key} type="text" maxlength=${f.max ?? 200} ?disabled=${ro} .value=${v === undefined ? '' : String(v)} @change=${(e: Event) => this.setVar(group, f.name, (e.target as HTMLInputElement).value)} /></div>`;
      })}
    </div>`;
  }

  private renderArg(group: ActionGroup, spec: ArgSpec) {
    if (spec.type === 'vars') return this.renderVars(group, spec);
    const ro = this.readOnly;
    const v = group.data[spec.name];
    const label = spec.label ?? ARG_LABEL[spec.name] ?? spec.name;
    const key = `${group.key}:${spec.name}`;
    // brightness: shown as a percentage of the 0..255 the card writes; brightness_pct is used only when it is already there
    // (the server lists both; "brightness" is what the card writes, so the control is that one unless brightness_pct is already set)
    if (spec.name === 'brightness_pct' && group.data.brightness_pct === undefined) return nothing;
    if (spec.name === 'brightness' && group.data.brightness_pct !== undefined) return nothing;
    if (spec.name === 'brightness' || spec.name === 'brightness_pct') {
      const isRaw = spec.name === 'brightness';
      const pct = typeof v === 'number' ? (isRaw ? Math.round((v / 255) * 100) : v) : null;
      const write = (p: number) => this.setArg(group, spec.name, isRaw ? Math.round((p / 100) * 255) : p);
      return html`<div class="arg" data-arg=${spec.name}>
        <span class="lbl">${label}</span>
        ${pct === null
          ? html`<div class="row"><sw-button size="sm" ?disabled=${ro} @click=${() => write(80)}>הגדרת בהירות</sw-button></div>`
          : html`<div class="row">
              <input type="range" min="1" max="100" step="1" ?disabled=${ro} aria-label=${label} .value=${String(pct)} @input=${(e: Event) => write(Number((e.target as HTMLInputElement).value))} />
              <input type="number" min="1" max="100" ?disabled=${ro} aria-label="${label} באחוזים" .value=${String(pct)} @change=${(e: Event) => write(Math.min(100, Math.max(1, Number((e.target as HTMLInputElement).value) || 1)))} />
              <span class="unit">%</span>
              ${ro ? nothing : html`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="ללא בהירות" @click=${() => this.setArg(group, spec.name, undefined)}></sw-button>`}
            </div>`}
      </div>`;
    }
    if (spec.choices && spec.choices.length) {
      return html`<div class="arg" data-arg=${spec.name}>
        <label for=${key}>${label}</label>
        <select id=${key} ?disabled=${ro} @change=${(e: Event) => this.setArg(group, spec.name, (e.target as HTMLSelectElement).value)}>
          ${spec.required ? nothing : html`<option value="" ?selected=${v === undefined}>ללא שינוי</option>`}
          ${spec.choices.map((c) => html`<option value=${c} ?selected=${v === c}>${spec.name === 'hvac_mode' ? HVAC_WORDS[c] ?? c : c}</option>`)}
        </select>
      </div>`;
    }
    if (spec.type === 'bool') {
      return html`<div class="arg" data-arg=${spec.name}>
        <label class="pair"><input type="checkbox" style="inline-size:auto;min-block-size:0" ?disabled=${ro} .checked=${v === true} @change=${(e: Event) => this.setArg(group, spec.name, (e.target as HTMLInputElement).checked)} />${label}</label>
      </div>`;
    }
    if (spec.type === 'int' && spec.min !== undefined && spec.max !== undefined) {
      // an optional number (a fan's speed) is set on purpose: until then the action leaves it out
      if (!spec.required && typeof v !== 'number') {
        return html`<div class="arg" data-arg=${spec.name}>
          <span class="lbl">${label}</span>
          <div class="row"><sw-button size="sm" ?disabled=${ro} @click=${() => this.setArg(group, spec.name, Math.min(spec.max as number, Math.max(spec.min as number, 50)))}>הגדרת ${label}</sw-button></div>
        </div>`;
      }
      const num = typeof v === 'number' ? v : spec.min;
      return html`<div class="arg" data-arg=${spec.name}>
        <label for=${key}>${label}</label>
        <div class="row">
          <input id=${key} type="range" min=${spec.min} max=${spec.max} step="1" ?disabled=${ro} .value=${String(num)} @input=${(e: Event) => this.setArg(group, spec.name, Number((e.target as HTMLInputElement).value))} />
          <input type="number" min=${spec.min} max=${spec.max} ?disabled=${ro} aria-label=${label} .value=${String(num)} @change=${(e: Event) => this.setArg(group, spec.name, Number((e.target as HTMLInputElement).value))} />
          <span class="unit">${spec.name === 'position' || spec.name === 'tilt_position' || spec.name === 'percentage' ? '%' : ''}</span>
          ${ro || spec.required ? nothing : html`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="ללא ${label}" @click=${() => this.setArg(group, spec.name, undefined)}></sw-button>`}
        </div>
      </div>`;
    }
    if (spec.type === 'int' || spec.type === 'float') {
      return html`<div class="arg" data-arg=${spec.name}>
        <label for=${key}>${label}</label>
        <div class="row">
          <input id=${key} type="number" step=${spec.step ?? (spec.type === 'float' && spec.name !== 'temperature' ? '0.5' : '1')} min=${spec.min ?? nothing} max=${spec.max ?? nothing} ?disabled=${ro} .value=${v === undefined ? '' : String(v)} @change=${(e: Event) => this.setArg(group, spec.name, (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value))} />
          <span class="unit">${spec.name === 'temperature' ? '°' : ''}</span>
        </div>
      </div>`;
    }
    return html`<div class="arg" data-arg=${spec.name}>
      <label for=${key}>${label}</label>
      <input id=${key} type="text" ?disabled=${ro} .value=${v === undefined ? '' : String(v)} @change=${(e: Event) => this.setArg(group, spec.name, (e.target as HTMLInputElement).value)} />
    </div>`;
  }

  private renderGroup(group: ActionGroup, i: number) {
    const first = group.entities.find((e): e is string => !!e);
    const meta = first ? this.meta.get(first) : undefined;
    const catalog = meta?.actions ?? [];
    const specs = catalog.find((a) => a.service === group.service)?.args ?? [];
    const common = catalog.filter((a) => !ADVANCED.has(a.service));
    const advanced = catalog.filter((a) => ADVANCED.has(a.service));
    const known = catalog.some((a) => a.service === group.service);
    const id = `svc-${this.slotData?.uid}-${i}`;
    return html`<div class="group" data-action-group=${i}>
      <div class="ents">
        ${group.entities.map((e) => html`<span class="ent">${e ? this.meta.get(e)?.name ?? e : 'ללא התקן'}${this.readOnly || !e ? nothing : html`<button type="button" aria-label="הסרת ${this.meta.get(e)?.name ?? e} מהפעולה" @click=${() => this.removeEntity(e)}><sw-icon name="close" size="12"></sw-icon></button>`}</span>`)}
      </div>
      <div class="f">
        <label for=${id}>פעולה</label>
        <select id=${id} ?disabled=${this.readOnly || !catalog.length} data-service @change=${(e: Event) => this.onService(group, (e.target as HTMLSelectElement).value)}>
          ${known || !catalog.length ? nothing : html`<option value=${group.service} selected>${actionLabel({ service: group.service })}</option>`}
          ${!catalog.length ? html`<option value=${group.service} selected>${actionLabel({ service: group.service, data: group.data })}</option>` : nothing}
          ${common.map((a) => html`<option value=${a.service} ?selected=${a.service === group.service}>${serviceWord(a.service, a.label)}</option>`)}
          ${advanced.length ? html`<optgroup label="מתקדם">${advanced.map((a) => html`<option value=${a.service} ?selected=${a.service === group.service}>${serviceWord(a.service, a.label)}</option>`)}</optgroup>` : nothing}
        </select>
      </div>
      ${specs.map((sp) => this.renderArg(group, sp))}
    </div>`;
  }

  render() {
    const s = this.slotData;
    if (!s) return nothing;
    const groups = groupActions(s.actions);
    const sensitive = s.actions.some((a) => isSensitiveAction(a, a.entity_id ? this.meta.get(a.entity_id)?.class ?? null : null, a.entity_id ? this.meta.get(a.entity_id) : undefined));
    const lowering = s.actions.some((a) => {
      const m = a.entity_id ? this.meta.get(a.entity_id) : undefined;
      return isLoweringAction(a, m?.class ?? null, m?.actions);
    });
    const inSlot = new Set(s.actions.map((a) => a.entity_id));
    const addable = this.entityIds.filter((id) => !inSlot.has(id) && this.meta.has(id));
    const onlyOff = (s.stop ?? '') !== '' && s.stop !== '00:00:00';
    return html`<section class="panel" aria-label="עריכת משבצת" data-slot-panel>
      <header>
        <h3>משבצת ${this.index + 1} מתוך ${this.count}</h3>
        <span class="sum">${slotSummary(s, this.meta)}</span>
        <sw-schedule-markers .sensitive=${sensitive} .lowering=${lowering}></sw-schedule-markers>
        <span class="sp"></span>
        ${this.readOnly
          ? nothing
          : html`
              ${this.canCopyDays ? html`<sw-button size="sm" icon="calendar" data-slot-copy-days @click=${() => this.fire('slot-copy-days')}>העתקה לימים…</sw-button>` : nothing}
              <sw-button size="sm" icon="layers" data-slot-duplicate @click=${() => this.fire('slot-duplicate')}>שכפול</sw-button>
              <sw-button size="sm" variant="danger" icon="trash" data-slot-delete @click=${() => this.fire('slot-delete')}>מחיקה</sw-button>
            `}
        <sw-button size="sm" variant="ghost" iconOnly icon="close" label="סגירת העריכה" @click=${() => this.fire('slot-close')}></sw-button>
      </header>
      ${this.locked.length
        ? html`<div class="lockmsg" data-slot-locked><sw-icon name="lock" size="16"></sw-icon><div>${this.locked.map((p) => html`<div>${p.message}</div>`)}<div><b>לעריכה:</b> ברכיב התזמונים המקורי.</div></div></div>`
        : html`
            <div class="fields">
              ${this.timeField('start')} ${this.timeField('stop')}
              <div class="groups">
                ${groups.length ? groups.map((g, i) => this.renderGroup(g, i)) : html`<div class="empty" data-slot-empty>בחרו פעולה: הוסיפו התקנים לתזמון בכפתור "בחירת התקנים".</div>`}
                ${!this.readOnly && addable.length
                  ? html`<select class="add-ent" aria-label="הוספת התקן לפעולה" data-add-entity @change=${(e: Event) => {
                      const el = e.target as HTMLSelectElement;
                      if (el.value) this.addEntity(el.value);
                      el.value = '';
                    }}>
                      <option value="">הוספת התקן למשבצת…</option>
                      ${addable.map((id) => html`<option value=${id}>${this.meta.get(id)?.name ?? id}</option>`)}
                    </select>`
                  : nothing}
              </div>
            </div>
            ${this.errors.length ? html`<ul class="errs" data-slot-errors>${this.errors.map((e) => html`<li>${e.message}</li>`)}</ul>` : nothing}
            ${this.canPair || this.paired
              ? html`<div class="off">
                  <sw-toggle .checked=${this.paired} ?disabled=${this.readOnly || (!this.paired && !onlyOff)} label="כיבוי בסיום החלון" @change=${(e: CustomEvent<{ checked: boolean }>) => this.fire('pair-off', { on: e.detail.checked })}></sw-toggle>
                  <span class="unit">${onlyOff || this.paired ? 'מוסיף משבצת כיבוי בשעת הסיום' : 'נדרשת שעת סיום קבועה'}</span>
                </div>`
              : nothing}
          `}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-slot-panel': ScheduleSlotPanel;
  }
}

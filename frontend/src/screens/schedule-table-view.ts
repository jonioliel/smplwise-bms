import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { actionLabel, type Problem, type SunTimes } from '../api/schedules';
import {
  defaultDataFor,
  groupActions,
  serviceWord,
  setGroupAction,
  type EditSlot,
  type MetaMap,
} from './schedule-edit-logic';
import { applyTableEdit, tableRows, timeInputText, type TableField } from './schedule-grid-logic';

/**
 * CR-014 S4: the table view of the same scheme (mockup 07 / 23): one row per slot, "from" and "to" typed inline (07:30,
 * 18, "שקיעה+30", "24:00"), the action and its value in place. The table shows and edits exactly the slots of the graph:
 * a typed time goes through the same rules as a drag (`applyTableEdit`), so the two views can never disagree.
 * On a phone every row becomes a card.
 *
 *   slots-change {slots, uid}    a time was applied
 *   slot-change {slot}           the action or its value changed
 *   slot-select {uid}   slot-delete {uid}   slot-duplicate {uid}   slot-add
 */

const HVAC_WORDS: Record<string, string> = { cool: 'קירור', heat: 'חימום', heat_cool: 'אוטומטי', auto: 'אוטומטי', dry: 'ייבוש', fan_only: 'מאוורר' };
const ADVANCED = new Set(['cover.stop_cover', 'cover.set_cover_tilt_position', 'climate.set_fan_mode', 'climate.set_preset_mode', 'fan.set_percentage']);

@customElement('schedule-table-view')
export class ScheduleTableView extends LitElement {
  @property({ attribute: false }) slots: EditSlot[] = [];
  @property({ attribute: false }) meta: MetaMap = new Map();
  @property({ attribute: false }) sun: SunTimes | null = null;
  @property({ type: Number }) snap = 15;
  @property({ type: Boolean }) allowNegativeSun = false;
  @property({ type: Boolean }) readOnly = false;
  @property() selected = '';
  /** uid → why the slot's content is read-only. */
  @property({ attribute: false }) lockedUids: Record<string, Problem[]> = {};
  @property({ attribute: false }) errorsByUid: Record<string, Problem[]> = {};
  /** uid → the text of its next run ("היום 18:00 · בתנאי"). */
  @property({ attribute: false }) nextByUid: Record<string, string> = {};
  /** The slot index this slot's "כיבוי בסיום" companion has, or null. */
  @property({ attribute: false }) pairOf: (index: number) => number | null = () => null;
  @state() private cellError: { uid: string; field: TableField; message: string } | null = null;

  static styles = css`
    :host {
      display: block;
    }
    table {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: var(--sw-fs-sm);
    }
    th {
      text-align: start;
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      padding: 8px 8px;
      border-block-end: 1px solid var(--sw-border);
      white-space: nowrap;
    }
    td {
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    tr.sel td {
      background: var(--sw-accent-soft);
    }
    tr.bad td.n {
      color: var(--sw-danger);
    }
    td.n {
      color: var(--sw-text-3);
      inline-size: 32px;
    }
    input,
    select {
      box-sizing: border-box;
      min-block-size: 30px;
      padding: 3px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      max-inline-size: 100%;
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    input.t {
      inline-size: 116px;
      direction: rtl;
      text-align: start;
    }
    input.t.err {
      border-color: var(--sw-danger);
    }
    input.num {
      inline-size: 68px;
      direction: ltr;
    }
    input[disabled],
    select[disabled] {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .val {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .unit {
      color: var(--sw-text-3);
    }
    .ents {
      color: var(--sw-text-2);
    }
    .msg {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
      margin-block-start: 3px;
    }
    .chip {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .chip.lock {
      background: var(--sw-warning-soft);
      color: #92400e;
    }
    .acts {
      display: flex;
      gap: 2px;
      justify-content: flex-end;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-block-start: 10px;
    }
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--sw-text-3);
    }
    @media (max-width: 720px) {
      table,
      tbody {
        display: block;
      }
      thead {
        display: none;
      }
      tr {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 10px;
        padding: 10px;
        margin-block-end: 8px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
      }
      tr.sel {
        border-color: var(--sw-accent);
        background: var(--sw-accent-soft);
      }
      td {
        display: block;
        border: 0;
        padding: 0;
      }
      td.n,
      td.who,
      td.val-cell,
      td.next,
      td.act-cell {
        grid-column: 1 / -1;
      }
      td.n {
        display: none;
      }
      td[data-label]::before {
        content: attr(data-label);
        display: block;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        margin-block-end: 2px;
      }
      input.t {
        inline-size: 100%;
      }
    }
  `;

  private fire(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private commit(slot: EditSlot, field: TableField, text: string) {
    const index = this.slots.findIndex((s) => s.uid === slot.uid);
    const cur = field === 'from' ? timeInputText(slot.start) : timeInputText(slot.stop, true);
    if (text.trim() === cur) {
      this.cellError = null;
      return;
    }
    const r = applyTableEdit(this.slots, index, field, text, { step: this.snap, sun: this.sun, allowNegativeSun: this.allowNegativeSun });
    if ('error' in r) {
      this.cellError = { uid: slot.uid, field, message: r.error };
      return;
    }
    this.cellError = null;
    this.fire('slots-change', { slots: r.slots, uid: slot.uid });
  }

  private setService(slot: EditSlot, service: string) {
    const g = groupActions(slot.actions)[0];
    if (!g) return;
    const first = g.entities.find((e): e is string => !!e);
    const meta = first ? this.meta.get(first) : undefined;
    const specs = meta?.actions.find((a) => a.service === service)?.args ?? [];
    this.fire('slot-change', { slot: { ...slot, actions: setGroupAction(slot.actions, g, service, defaultDataFor(specs, meta)) } });
  }

  private setArg(slot: EditSlot, name: string, value: unknown) {
    const g = groupActions(slot.actions)[0];
    if (!g) return;
    const data = { ...g.data };
    if (value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) delete data[name];
    else data[name] = value;
    this.fire('slot-change', { slot: { ...slot, actions: setGroupAction(slot.actions, g, g.service, data) } });
  }

  private renderValue(slot: EditSlot, ro: boolean) {
    const g = groupActions(slot.actions)[0];
    if (!g) return html`<span class="unit">—</span>`;
    const d = g.data;
    const first = g.entities.find((e): e is string => !!e);
    const specs = (first ? this.meta.get(first) : undefined)?.actions.find((a) => a.service === g.service)?.args ?? [];
    const parts = [] as unknown[];
    for (const sp of specs) {
      const v = d[sp.name];
      if (sp.name === 'hvac_mode' && sp.choices?.length) {
        parts.push(html`<select ?disabled=${ro} aria-label="מצב פעולה" @change=${(e: Event) => this.setArg(slot, 'hvac_mode', (e.target as HTMLSelectElement).value)}>
          ${sp.required ? nothing : html`<option value="" ?selected=${v === undefined}>ללא שינוי</option>`}
          ${sp.choices.map((c) => html`<option value=${c} ?selected=${v === c}>${HVAC_WORDS[c] ?? c}</option>`)}
        </select>`);
      } else if (sp.name === 'temperature') {
        parts.push(html`<input class="num" type="number" step="0.5" min=${sp.min ?? nothing} max=${sp.max ?? nothing} ?disabled=${ro} aria-label="טמפרטורה" .value=${v === undefined ? '' : String(v)} @change=${(e: Event) => this.setArg(slot, 'temperature', (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value))} /><span class="unit">°</span>`);
      } else if (sp.name === 'brightness' || sp.name === 'brightness_pct') {
        if (sp.name === 'brightness_pct' && d.brightness !== undefined) continue;
        if (sp.name === 'brightness' && d.brightness_pct !== undefined) continue;
        const raw = sp.name === 'brightness';
        const pct = typeof v === 'number' ? (raw ? Math.round((v / 255) * 100) : v) : '';
        parts.push(html`<input class="num" type="number" min="1" max="100" placeholder="בהירות" ?disabled=${ro} aria-label="בהירות באחוזים" .value=${String(pct)} @change=${(e: Event) => {
          const t = (e.target as HTMLInputElement).value;
          this.setArg(slot, sp.name, t === '' ? undefined : raw ? Math.round((Math.min(100, Math.max(1, Number(t))) / 100) * 255) : Math.min(100, Math.max(1, Number(t))));
        }} /><span class="unit">%</span>`);
      } else if ((sp.name === 'position' || sp.name === 'tilt_position' || sp.name === 'percentage') && sp.type === 'int') {
        parts.push(html`<input class="num" type="number" min=${sp.min ?? 0} max=${sp.max ?? 100} ?disabled=${ro} aria-label=${sp.name === 'position' ? 'מיקום' : sp.name === 'percentage' ? 'עוצמה' : 'הטיה'} .value=${v === undefined ? '' : String(v)} @change=${(e: Event) => this.setArg(slot, sp.name, (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value))} /><span class="unit">%</span>`);
      }
    }
    return parts.length ? html`<div class="val">${parts}</div>` : html`<span class="unit">—</span>`;
  }

  private renderRow(r: ReturnType<typeof tableRows>[number], display: number) {
    const slot = this.slots[r.index];
    const locked = this.lockedUids[slot.uid];
    const ro = this.readOnly || !!locked;
    const errs = this.errorsByUid[slot.uid] ?? [];
    const groups = groupActions(slot.actions);
    const g = groups[0];
    const first = g?.entities.find((e): e is string => !!e);
    const catalog = (first ? this.meta.get(first) : undefined)?.actions ?? [];
    const names = [...new Set(slot.actions.map((a) => (a.entity_id ? this.meta.get(a.entity_id)?.name ?? a.entity_id : 'ללא התקן')))];
    const pair = this.pairOf(r.index);
    const ce = this.cellError?.uid === slot.uid ? this.cellError : null;
    return html`<tr class="${slot.uid === this.selected ? 'sel' : ''} ${errs.length ? 'bad' : ''}" data-row=${slot.uid} @click=${() => this.fire('slot-select', { uid: slot.uid })}>
      <td class="n" title=${errs.map((e) => e.message).join(' · ')}>${errs.length ? html`<sw-icon name="warning" size="14"></sw-icon>` : display}</td>
      <td data-label="משעה">
        <input class="t ${ce?.field === 'from' ? 'err' : ''}" data-cell="from" ?disabled=${ro} .value=${r.from} aria-label="משעה, משבצת ${display}" @change=${(e: Event) => this.commit(slot, 'from', (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} @click=${(e: Event) => e.stopPropagation()} />
        ${ce?.field === 'from' ? html`<div class="msg" role="alert">${ce.message}</div>` : nothing}
      </td>
      <td data-label="עד שעה (סוף חלון)">
        <input class="t ${ce?.field === 'to' ? 'err' : ''}" data-cell="to" ?disabled=${ro} placeholder="ללא" .value=${r.to} aria-label="עד שעה, משבצת ${display}" @change=${(e: Event) => this.commit(slot, 'to', (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} @click=${(e: Event) => e.stopPropagation()} />
        ${ce?.field === 'to' ? html`<div class="msg" role="alert">${ce.message}</div>` : nothing}
      </td>
      <td class="act-cell" data-label="פעולה">
        ${locked
          ? html`<span class="chip lock"><sw-icon name="lock" size="12"></sw-icon>${g ? actionLabel({ service: g.service, data: g.data }) : 'לא נתמך'}</span>`
          : !g
            ? html`<span class="unit">בחרו פעולה</span>`
            : groups.length > 1
              ? html`<span class="chip">${groups.length} פעולות</span>`
              : html`<select ?disabled=${ro || !catalog.length} data-cell="service" aria-label="פעולה, משבצת ${display}" @click=${(e: Event) => e.stopPropagation()} @change=${(e: Event) => this.setService(slot, (e.target as HTMLSelectElement).value)}>
                  ${catalog.length ? nothing : html`<option selected>${actionLabel({ service: g.service, data: g.data })}</option>`}
                  ${catalog.filter((a) => !ADVANCED.has(a.service)).map((a) => html`<option value=${a.service} ?selected=${a.service === g.service}>${serviceWord(a.service, a.label)}</option>`)}
                  ${catalog.some((a) => ADVANCED.has(a.service)) ? html`<optgroup label="מתקדם">${catalog.filter((a) => ADVANCED.has(a.service)).map((a) => html`<option value=${a.service} ?selected=${a.service === g.service}>${serviceWord(a.service, a.label)}</option>`)}</optgroup>` : nothing}
                </select>`}
        ${pair !== null ? html`<span class="chip" title="משבצת כיבוי בסיום">כיבוי בסיום</span>` : nothing}
      </td>
      <td class="val-cell" data-label="ערך" @click=${(e: Event) => e.stopPropagation()}>${groups.length === 1 && !locked ? this.renderValue(slot, ro) : html`<span class="unit">—</span>`}</td>
      <td class="who ents" data-label="התקנים">${names.join(', ') || '—'}</td>
      <td class="next" data-label="הרצה הבאה">${this.nextByUid[slot.uid] ?? '—'}</td>
      <td class="acts">
        ${this.readOnly
          ? nothing
          : html`<sw-button size="sm" variant="ghost" iconOnly icon="layers" label="שכפול משבצת ${display}" @click=${(e: Event) => (e.stopPropagation(), this.fire('slot-duplicate', { uid: slot.uid }))}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="trash" label="מחיקת משבצת ${display}" @click=${(e: Event) => (e.stopPropagation(), this.fire('slot-delete', { uid: slot.uid }))}></sw-button>`}
      </td>
    </tr>`;
  }

  render() {
    const rows = tableRows(this.slots, this.sun, this.pairOf);
    return html`<table data-schedule-table>
        <thead>
          <tr>
            <th>#</th>
            <th>משעה</th>
            <th>עד שעה (סוף חלון)</th>
            <th>פעולה</th>
            <th>ערך</th>
            <th>התקנים</th>
            <th>הרצה הבאה</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map((r, i) => this.renderRow(r, i + 1)) : html`<tr><td colspan="8" class="empty">אין משבצות. הוסיפו משבצת.</td></tr>`}
        </tbody>
      </table>
      ${this.readOnly ? nothing : html`<div class="foot"><sw-button size="sm" icon="plus" data-table-add @click=${() => this.fire('slot-add')}>משבצת חדשה</sw-button></div>`}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-table-view': ScheduleTableView;
  }
}

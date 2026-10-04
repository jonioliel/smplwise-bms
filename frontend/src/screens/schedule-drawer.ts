import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-schedule-bar';
import { aIcon } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { ApiError } from '../api/client';
import { isApi } from '../api/session';
import { DEMO_SUN } from '../api/schedules-mock';
import {
  MATCH_LABEL,
  RESULT_LABEL,
  copySchedule,
  deleteSchedule,
  getSchedule,
  listScheduleRuns,
  runSchedule,
  setScheduleEnabled,
  whenLabel,
  type ConditionView,
  type RunItem,
  type Schedule,
  type ScheduleStatus,
} from '../api/schedules';
import {
  conditionHolds,
  devicesLine,
  loweringSummary,
  nextRunText,
  periodLabel,
  runIsLowering,
  runNeedsConfirm,
  slotChips,
  windowText,
  type LoweringSummary,
  scheduleErrorText,
} from './schedules-logic';
import { toneColor } from '../components/sw-schedule-bar';

/** How an action ended, for the screen's note or the drawer's status line. */
export interface ActionResult {
  text: string;
  tone: 'ok' | 'error';
}

type Dialog =
  | { kind: 'run'; s: Schedule; slot: number | null; skip: boolean; error: string; busy: boolean }
  | { kind: 'delete'; s: Schedule; error: string; busy: boolean }
  | { kind: 'copy'; s: Schedule; name: string; error: string; busy: boolean }
  | { kind: 'lowering'; s: Schedule; op: 'enable' | 'run'; slot: number | null; summary: LoweringSummary; needsCode: boolean; error: string; busy: boolean };

/**
 * CR-014: the confirmations and calls behind a schedule's write actions - run now, enable / disable, copy, delete - in one
 * element, used by the list (its cards and rows) and by the drawer (inside its modal panel, since a dialog outside the
 * top layer is inert while the drawer is open). It owns no data: it calls the typed client, then tells its host what
 * changed (`changed`), what was deleted (`deleted`, with the trash id: the 30-day undo) or copied (`copied`), and how it
 * went (`result`). A lowering schedule (opens or disarms something) is confirmed through S4's
 * `<schedule-lowering-dialog>` (docs/architecture/SCHEDULER_API.md §12.3), by tag.
 */
@customElement('schedule-actions')
export class ScheduleActions extends LitElement {
  @state() private dialog: Dialog | null = null;

  static styles = [...automationsStyles, css`
    :host {
      display: contents;
    }
    /* the confirmations carry the sheet material, as on the automations screen */
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .slots {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label.opt {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      min-block-size: 48px;
      padding: 10px 12px;
      border: 1px solid var(--dv-border);
      border-radius: 14px;
      background: var(--dv-surface);
      font-size: 14px;
      cursor: pointer;
    }
    label.opt:has(input:checked) {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      background: var(--dv-accent-soft);
    }
    label.opt small {
      display: block;
      color: var(--dv-text-2);
      font-size: 12.5px;
    }
    label.check {
      display: flex;
      gap: 10px;
      align-items: center;
      min-block-size: 44px;
      font-size: 14px;
    }
    input[type='radio'],
    input[type='checkbox'] {
      inline-size: 17px;
      block-size: 17px;
      accent-color: var(--dv-accent);
      margin: 2px 0 0;
    }
    p {
      margin: 0;
      font-size: 14px;
      color: var(--dv-text-2);
    }
    .err {
      color: var(--dv-danger);
      font-size: 13px;
      font-weight: 600;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }


  // ---------------------------------------------------------------------------- entry points

  /** Enable or disable. Enabling a lowering schedule first asks for the explicit confirmation (§5.3). */
  async enable(s: Schedule, on: boolean): Promise<void> {
    if (on && s.lowering) {
      this.dialog = { kind: 'lowering', s, op: 'enable', slot: null, summary: loweringSummary(s), needsCode: false, error: '', busy: false };
      return;
    }
    await this.doEnable(s, on, {});
  }

  run(s: Schedule): void {
    const only = s.slots.length === 1 ? 0 : null;
    this.dialog = { kind: 'run', s, slot: only, skip: false, error: '', busy: false };
  }

  askDelete(s: Schedule): void {
    this.dialog = { kind: 'delete', s, error: '', busy: false };
  }

  copy(s: Schedule): void {
    this.dialog = { kind: 'copy', s, name: `העתק של ${s.display_name}`, error: '', busy: false };
  }

  // ---------------------------------------------------------------------------- calls

  private emit(name: 'changed' | 'deleted' | 'copied' | 'result', detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private result(text: string, tone: ActionResult['tone'] = 'ok') {
    this.emit('result', { text, tone } satisfies ActionResult);
  }

  private async doEnable(s: Schedule, on: boolean, opts: { confirm_lowering?: boolean; alarm_code?: string | null }): Promise<boolean> {
    try {
      const r = await setScheduleEnabled(s.id, on, opts);
      this.emit('changed', { schedule: r.schedule });
      this.result(on ? `"${s.display_name}" הופעל` : `"${s.display_name}" הושבת`);
      return true;
    } catch (err) {
      this.emit('changed', { schedule: null });
      if (err instanceof ApiError && err.code === 'schedule_changed') this.result('התזמון שונה במקום אחר. הרשימה עודכנה.', 'error');
      else this.result(scheduleErrorText(err), 'error');
      return false;
    }
  }

  private async submit() {
    const d = this.dialog;
    if (!d || d.busy) return;
    this.dialog = { ...d, busy: true, error: '' } as Dialog;
    try {
      if (d.kind === 'run') {
        const r = await runSchedule(d.s.id, d.slot, { confirm: true, skip_conditions: d.skip });
        this.dialog = null;
        this.result(r.note);
        this.emit('changed', { schedule: null });
      } else if (d.kind === 'delete') {
        const r = await deleteSchedule(d.s.id, d.s.revision);
        this.dialog = null;
        this.emit('deleted', { trashId: r.trash_id, name: d.s.display_name, scheduleId: d.s.id });
      } else if (d.kind === 'copy') {
        const r = await copySchedule(d.s.id, d.name.trim() || `העתק של ${d.s.display_name}`);
        this.dialog = null;
        this.emit('copied', { schedule: r.schedule });
        this.result('שוכפל');
      }
    } catch (err) {
      const stale = err instanceof ApiError && err.code === 'schedule_changed';
      if (stale) this.emit('changed', { schedule: null });
      const cur = this.dialog;
      if (cur) this.dialog = { ...cur, busy: false, error: stale ? 'התזמון שונה במקום אחר. הגרסה העדכנית נטענה; בדקו ונסו שוב.' : scheduleErrorText(err) } as Dialog;
    }
  }

  private async confirmLowering(e: CustomEvent<{ alarm_code: string | null }>) {
    const d = this.dialog;
    if (!d || d.kind !== 'lowering') return;
    e.stopPropagation();
    const code = e.detail?.alarm_code ?? null;
    this.dialog = { ...d, busy: true };
    try {
      if (d.op === 'enable') {
        const r = await setScheduleEnabled(d.s.id, true, { confirm_lowering: true, alarm_code: code });
        this.dialog = null;
        this.emit('changed', { schedule: r.schedule });
        this.result(`"${d.s.display_name}" הופעל`);
      } else {
        const r = await runSchedule(d.s.id, d.slot, { confirm: true, alarm_code: code });
        this.dialog = null;
        this.result(r.note);
        this.emit('changed', { schedule: null });
      }
    } catch (err) {
      // the panel wants (or refused) a code: the dialog stays, now with the code field
      if (err instanceof ApiError && (err.code === 'code_required' || err.code === 'wrong_code')) {
        this.dialog = { ...d, busy: false, needsCode: true };
        this.result(scheduleErrorText(err), 'error');
        return;
      }
      this.dialog = null;
      this.emit('changed', { schedule: null });
      this.result(scheduleErrorText(err), 'error');
    }
  }

  private close = (e?: Event) => {
    e?.stopPropagation();
    if (this.dialog?.busy) return;
    this.dialog = null;
  };


  // ---------------------------------------------------------------------------- render (the automations screen's dialog form: a line, the buttons)

  private buttons(okAttr: string, okLabel: string, busyLabel: string, d: { busy: boolean }, onOk: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) {
    return html`<div class="dlgrow"><button type="button" class="btn" data-dialog-cancel @click=${this.close}>ביטול</button><button type="button" class=${`btn ${opts.danger ? 'danger' : 'primary'}`} data-dialog-ok data-run-confirm=${okAttr === 'run' ? '' : nothing} data-delete-confirm=${okAttr === 'delete' ? '' : nothing} data-copy-confirm=${okAttr === 'copy' ? '' : nothing} ?disabled=${!!opts.disabled || d.busy} @click=${onOk}>${d.busy ? busyLabel : okLabel}</button></div>`;
  }

  private renderRun(d: Extract<Dialog, { kind: 'run' }>) {
    const s = d.s;
    const lowering = runIsLowering(d.slot === null ? undefined : s.slots[d.slot]);
    const can = d.slot !== null;
    return html`<sw-dialog open heading=${`להריץ עכשיו את "${s.display_name}"?`} data-dialog="run" @close=${this.close}><div class="dlgform">
      ${s.slots.length > 1
        ? html`<div class="slots" role="radiogroup" aria-label="משבצת להרצה">${s.slots.map(
            (sl) => html`<label class="opt"><input type="radio" name="slot" .checked=${d.slot === sl.index} @change=${() => (this.dialog = { ...d, slot: sl.index })} data-run-slot=${sl.index} /><span><span class="n">${windowText(sl)}</span><small>${slotChips(sl, s).map((c) => `${c.label} · ${c.devices.join(', ')}`).join(' | ')}</small></span></label>`,
          )}</div>`
        : html`<p>${s.slots[0] ? `${windowText(s.slots[0])} · ${slotChips(s.slots[0], s).map((c) => `${c.label} · ${c.devices.join(', ')}`).join(' | ')}` : ''}</p>`}
      ${runNeedsConfirm(d.slot === null ? undefined : s.slots[d.slot]) ? html`<p>הפעולה תפעיל התקנים פיזיים מיד.</p>` : nothing}
      ${s.conditions.items.length ? html`<label class="check"><input type="checkbox" .checked=${d.skip} @change=${(e: Event) => (this.dialog = { ...d, skip: (e.target as HTMLInputElement).checked })} data-run-skip />להריץ גם אם התנאים אינם מתקיימים</label>` : nothing}
      ${d.error ? html`<div class="err" role="alert" data-actions-error>${d.error}</div>` : nothing}
      ${this.buttons('run', 'הרץ', 'מריץ…', d, () => (lowering ? this.askLoweringForRun(d) : void this.submit()), { disabled: !can })}
    </div></sw-dialog>`;
  }

  /** A run of a slot that opens or disarms: the lowering confirmation replaces the plain one. */
  private askLoweringForRun(d: Extract<Dialog, { kind: 'run' }>) {
    this.dialog = { kind: 'lowering', s: d.s, op: 'run', slot: d.slot, summary: loweringSummary(d.s), needsCode: false, error: '', busy: false };
  }

  render() {
    const d = this.dialog;
    if (!d) return nothing;
    if (d.kind === 'run') return this.renderRun(d);
    if (d.kind === 'delete')
      return html`<sw-dialog open heading=${`למחוק את "${d.s.display_name}"?`} data-dialog="delete" @close=${this.close}><div class="dlgform">
        <p>התזמון יישמר בסל המחזור 30 יום וניתן לשחזר אותו.</p>
        ${d.error ? html`<div class="err" role="alert" data-actions-error>${d.error}</div>` : nothing}
        ${this.buttons('delete', 'מחיקה', 'מוחק…', d, () => void this.submit(), { danger: true })}
      </div></sw-dialog>`;
    if (d.kind === 'copy')
      return html`<sw-dialog open heading="שכפול" data-dialog="copy" @close=${this.close}><div class="dlgform">
        <label class="fld">שם העותק<input class="inp" type="text" maxlength="80" .value=${live(d.name)} data-copy-name @input=${(e: Event) => (this.dialog = { ...d, name: (e.target as HTMLInputElement).value })} /></label>
        ${d.error ? html`<div class="err" role="alert" data-actions-error>${d.error}</div>` : nothing}
        ${this.buttons('copy', 'שכפול', 'משכפל…', d, () => void this.submit(), { disabled: !d.name.trim() })}
      </div></sw-dialog>`;
    // lowering: S4's dialog, by tag (the summary sentence, the checkbox and - when the panel needs it - the code field)
    return html`<schedule-lowering-dialog .open=${true} .summary=${d.summary} .needsCode=${d.needsCode} @confirm=${(e: CustomEvent<{ alarm_code: string | null }>) => void this.confirmLowering(e)} @close=${this.close}></schedule-lowering-dialog>`;
  }
}

/** A condition line of the drawer: the name, what it must be, and how it stands now (or that it is out of the caller's reach). */
function conditionLine(c: ConditionView) {
  const want = c.attribute === 'state' && (c.value === 'on' || c.value === 'off') ? `${c.match_type === 'is' ? '' : 'לא '}${c.value === 'on' ? 'פעיל' : 'כבוי'}` : `${MATCH_LABEL[c.match_type]} ${c.value}`;
  if (!c.readable) return html`<div class="blk locked cond" data-condition-locked><span class="bi">${aIcon('lock')}</span><span class="bt">${c.name}<small>${want}</small></span><span class="chip">${aIcon('lock')}מחוץ להרשאתך</span></div>`;
  const holds = conditionHolds(c);
  const now = holds === null ? 'לא זמין כרגע' : holds ? 'כרגע: מתקיים' : 'כרגע: לא מתקיים';
  return html`<div class="blk cond"><span class="bi">${aIcon('help')}</span><span class="bt">${c.name}<small>${want}</small></span><span class=${holds === true ? 'chip ok' : 'chip'}>${now}</span></div>`;
}

/**
 * CR-014 mockup 04: one schedule in a drawer - the switch, its 24 h bar and days, the slots with their actions, the conditions
 * (with how each stands now), the next and the last runs, the tags, and the actions (full edit, run now, copy, delete). The
 * host gives it the schedule (the list's copy first, the detail route's fresh one after); it calls the write actions
 * through `<schedule-actions>` (rendered inside the panel) and reports what changed through events.
 */
@customElement('schedule-drawer')
export class ScheduleDrawer extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) schedule: Schedule | null = null;
  @property({ attribute: false }) status: ScheduleStatus | null = null;
  /** The schedule could not be loaded (it does not exist or is not visible to this person). */
  @property({ type: Boolean }) missing = false;
  @state() private runs: RunItem[] | null = null;
  @state() private note: ActionResult | null = null;
  @state() private conflict = false;
  private runsFor = '';


  static styles = [...automationsStyles, css`
    :host {
      display: contents;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    /* the drawer's body is a flex column with a limit (the phone's bottom sheet): nothing in it may shrink to nothing */
    .stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: none;
    }
    .stack > * {
      flex: none;
    }
    .swrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-block-size: 52px;
      padding: 8px 14px;
      border-radius: 14px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: 15px;
      font-weight: 600;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .slot .w {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
      flex: none;
      min-inline-size: 86px;
      text-align: end;
    }
    .slot .acts {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
      flex: 1;
    }
    .slot .act {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
    }
    .slot .act i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    .slot .act small,
    .slot .bad-note {
      display: block;
      color: var(--dv-text-3);
      font-size: 12px;
    }
    .blk.slot.bad {
      border-color: color-mix(in srgb, var(--dv-warning) 40%, transparent);
      background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface);
    }
    .li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-block-size: 44px;
      padding: 8px 12px;
      border-radius: 14px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: 13.5px;
    }
    .li span:last-child {
      color: var(--dv-text-2);
      font-variant-numeric: tabular-nums;
      flex: none;
    }
    .muted {
      color: var(--dv-text-3);
    }
    .by {
      font-size: 12.5px;
      color: var(--dv-text-3);
    }
    .foot2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }


  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('schedule') && this.schedule?.id !== this.runsFor) {
      this.runsFor = this.schedule?.id ?? '';
      this.runs = null;
      this.note = null;
      this.conflict = false;
      if (this.runsFor) void this.loadRuns(this.runsFor);
    }
    if (changed.has('open') && !this.open) {
      this.note = null;
      this.conflict = false;
    }
  }

  private async loadRuns(id: string) {
    try {
      const r = await listScheduleRuns({ schedule_id: id, limit: 10 });
      if (this.runsFor === id) this.runs = r.items;
    } catch {
      if (this.runsFor === id) this.runs = [];
    }
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private onResult = (e: CustomEvent<ActionResult>) => {
    e.stopPropagation();
    this.note = e.detail;
  };

  /** After a write: take the answer's schedule when it has one, else fetch it again (a stale revision shows the banner). */
  private onChanged = async (e: CustomEvent<{ schedule: Schedule | null }>) => {
    e.stopPropagation();
    const id = this.schedule?.id;
    if (e.detail.schedule) this.emit('changed', { schedule: e.detail.schedule });
    else if (id) {
      try {
        const fresh = await getSchedule(id);
        if (this.schedule && fresh.revision !== this.schedule.revision) this.conflict = true;
        this.emit('changed', { schedule: fresh });
      } catch {
        this.emit('changed', { schedule: null });
      }
    }
    if (id) void this.loadRuns(id);
  };

  private onDeleted = (e: CustomEvent) => {
    e.stopPropagation();
    this.emit('deleted', e.detail);
  };

  private onCopied = (e: CustomEvent) => {
    e.stopPropagation();
    this.emit('copied', e.detail);
  };

  private get actions(): ScheduleActions | null {
    return this.renderRoot.querySelector('schedule-actions');
  }

  private disabledWhy(s: Schedule, flag: 'edit' | 'run' | 'copy' | 'delete' | 'toggle'): string {
    if (s.can[flag]) return '';
    return s.read_only?.reasons[0]?.message ?? 'אין הרשאה לפעולה זו.';
  }


  private renderBody(s: Schedule) {
    const upcoming = s.upcoming.slice(0, 5);
    const readOnly = s.read_only?.reasons ?? [];
    const period = periodLabel(s);
    return html`<div class="stack" data-drawer-detail>
      ${readOnly.length ? html`<div class="banner info" data-drawer-readonly>${aIcon(s.sensitive ? 'lock' : 'eye')}<div>${readOnly[0].message}</div></div>` : nothing}
      ${this.conflict ? html`<div class="banner bad" role="alert" data-drawer-conflict>${aIcon('warning')}<div><b>התזמון שונה במקום אחר</b><small>מוצגת הגרסה העדכנית</small></div></div>` : nothing}
      ${s.warnings.map((w) => html`<div class="banner warn" data-drawer-warning>${aIcon('warning')}<div>${w.message}</div></div>`)}
      ${this.note ? html`<div class=${`banner ${this.note.tone === 'error' ? 'bad' : 'info'}`} role="status" data-drawer-status>${aIcon(this.note.tone === 'error' ? 'warning' : 'check')}<div>${this.note.text}</div></div>` : nothing}
      <div class="swrow"><span>פעיל</span>${s.can.toggle
        ? html`<button type="button" class="tog" role="switch" aria-checked=${String(s.enabled)} aria-label="פעיל" data-drawer-toggle @click=${() => void this.actions?.enable(s, !s.enabled)}></button>`
        : html`<span class=${`chip ${s.enabled ? 'ok' : ''}`} data-drawer-toggle-state title=${this.disabledWhy(s, 'toggle')}>${s.enabled ? 'פעיל' : 'מושבת'}</span>`}</div>
      <section class="sect" data-section="when">
        <h4>${aIcon('clock')}מתי</h4>
        <sw-schedule-bar .slots=${s.slots} .sun=${isApi() ? null : DEMO_SUN}></sw-schedule-bar>
        <div class="chips">
          <sw-day-chips .days=${s.days}></sw-day-chips>
          ${period ? html`<span class="chip info" data-period>${aIcon('calendar')}${period}</span>` : nothing}
          <schedule-condition-chip .conditions=${s.conditions}></schedule-condition-chip>
          <sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>
        </div>
      </section>
      <section class="sect" data-section="slots">
        <h4>${aIcon('play')}משבצות <span class="num">${s.slots.length}</span></h4>
        <div class="stack" style="gap:8px" data-drawer-slots>
          ${s.slots.map(
            (sl) => html`<div class=${sl.supported ? 'blk slot' : 'blk slot bad'} data-slot-row=${sl.index}>
              <span class="w">${windowText(sl)}</span>
              <span class="acts">${slotChips(sl, s).map(
                (c) => html`<span class="act"><i style=${`--c:${toneColor(c.tone)}`}></i><span>${c.label}<small>${c.devices.join(', ')}</small></span></span>`,
              )}${sl.unsupported.map((u) => html`<small class="bad-note">${u.message}</small>`)}</span>
            </div>`,
          )}
        </div>
      </section>
      ${s.conditions.items.length
        ? html`<section class="sect" data-section="conditions"><h4>${aIcon('help')}תנאים${s.conditions.items.length > 1 ? (s.conditions.type === 'and' ? ' · כולם' : ' · אחד מהם') : ''}</h4>
            <div class="stack" style="gap:8px" data-drawer-conditions>${s.conditions.items.map((c) => conditionLine(c))}${s.conditions.track ? html`<small class="muted">ממשיך לבדוק עד סוף החלון</small>` : nothing}</div></section>`
        : nothing}
      <section class="sect" data-section="upcoming">
        <h4>${aIcon('calendar')}ההרצות הבאות</h4>
        <div class="stack" style="gap:6px" data-drawer-upcoming>
          ${upcoming.length
            ? upcoming.map((u) => html`<div class="li"><span>${s.slots[u.slot_index] ? slotChips(s.slots[u.slot_index], s).map((c) => `${c.label} · ${c.devices.join(', ')}`).join(' | ') : ''}</span><span>${whenLabel(u.at)}${s.conditions.items.length ? ' · בתנאי' : ''}</span></div>`)
            : html`<div class="li"><span class="muted">${nextRunText(s)}</span></div>`}
        </div>
      </section>
      <section class="sect" data-section="runs">
        <h4>${aIcon('history')}הרצות אחרונות</h4>
        <div class="stack" style="gap:6px" data-drawer-runs>
          ${this.runs === null
            ? html`<div class="li"><span class="muted">טוען…</span></div>`
            : this.runs.length
              ? this.runs.map((r) => html`<div class="li"><span>${whenLabel(r.started_at)}${r.via === 'run_now' ? ' · הרצה ידנית' : ''}</span><span>${RESULT_LABEL[r.result]}</span></div>`)
              : html`<div class="li"><span class="muted">אין הרצות</span></div>`}
        </div>
      </section>
      ${s.tags.length ? html`<div class="chips">${s.tags.map((t) => html`<span class="chip">${aIcon('list')}${t}</span>`)}</div>` : nothing}
      ${s.owner || s.updated_at ? html`<div class="by">${s.owner ? `עודכן על ידי ${s.owner.display_name}` : 'נוצר מחוץ למערכת'}${s.updated_at ? ` · ${whenLabel(s.updated_at)}` : ''}</div>` : nothing}
    </div>`;
  }

  /** The footer: the automation drawer's buttons (עריכה first, primary); a control the caller may not use stays, disabled with the reason. */
  private footer(s: Schedule) {
    return html`<div class="foot2" slot="footer">
      <button type="button" class="btn primary" data-drawer-edit ?disabled=${!s.can.edit} title=${this.disabledWhy(s, 'edit')} @click=${() => this.emit('edit', { id: s.id })}>${aIcon('edit')}עריכה</button>
      <button type="button" class="btn" data-drawer-run ?disabled=${!s.can.run} title=${this.disabledWhy(s, 'run')} @click=${() => this.actions?.run(s)}>${aIcon('play')}הרץ עכשיו</button>
      <button type="button" class="btn quiet" data-drawer-copy ?disabled=${!s.can.copy} title=${this.disabledWhy(s, 'copy')} @click=${() => this.actions?.copy(s)}>${aIcon('copy')}שכפול</button>
      <button type="button" class="btn quiet dz" data-drawer-delete ?disabled=${!s.can.delete} title=${this.disabledWhy(s, 'delete')} @click=${() => this.actions?.askDelete(s)}>${aIcon('trash')}מחיקה</button>
    </div>`;
  }

  render() {
    const s = this.schedule;
    return html`<sw-drawer modal ?open=${this.open} heading=${s?.display_name ?? 'תזמון'} subheading=${s ? devicesLine(s) : ''} @close=${(e: Event) => {
      // the drawer's own close only: a nested confirmation's `close` stops at its dialog
      if (e.target !== e.currentTarget) return;
      e.stopPropagation();
      this.emit('drawer-close');
    }}>
      ${s
        ? html`${this.renderBody(s)}
            <schedule-actions .status=${this.status} @result=${this.onResult} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-actions>
            ${this.footer(s)}`
        : this.missing
          ? html`<div class="statebox" data-drawer-missing>${aIcon('search', 30)}<b>התזמון לא נמצא</b></div>`
          : html`<div class="stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span></div>`}
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-actions': ScheduleActions;
    'schedule-drawer': ScheduleDrawer;
  }
}

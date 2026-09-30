import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-schedule-bar';
import { ApiError, describeError } from '../api/client';
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

  static styles = css`
    :host {
      display: contents;
    }
    .slots {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label.opt {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    label.opt:has(input:checked) {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    label.opt small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    label.check {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: var(--sw-fs-sm);
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    input[type='text'] {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 32px;
      padding: 5px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
  `;

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
      this.result(on ? `התזמון "${s.display_name}" הופעל.` : `התזמון "${s.display_name}" הושבת.`);
      return true;
    } catch (err) {
      this.emit('changed', { schedule: null });
      if (err instanceof ApiError && err.code === 'schedule_changed') this.result('התזמון שונה במקום אחר. הרשימה עודכנה.', 'error');
      else this.result(describeError(err), 'error');
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
        this.result(`נוצר עותק: "${r.schedule.display_name}".`);
      }
    } catch (err) {
      const stale = err instanceof ApiError && err.code === 'schedule_changed';
      if (stale) this.emit('changed', { schedule: null });
      const cur = this.dialog;
      if (cur) this.dialog = { ...cur, busy: false, error: stale ? 'התזמון שונה במקום אחר. הגרסה העדכנית נטענה; בדקו ונסו שוב.' : describeError(err) } as Dialog;
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
        this.result(`התזמון "${d.s.display_name}" הופעל.`);
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
        this.result(describeError(err), 'error');
        return;
      }
      this.dialog = null;
      this.emit('changed', { schedule: null });
      this.result(describeError(err), 'error');
    }
  }

  private close = (e?: Event) => {
    e?.stopPropagation();
    if (this.dialog?.busy) return;
    this.dialog = null;
  };

  // ---------------------------------------------------------------------------- render

  private renderRun(d: Extract<Dialog, { kind: 'run' }>) {
    const s = d.s;
    const lowering = runIsLowering(d.slot === null ? undefined : s.slots[d.slot]);
    const can = d.slot !== null;
    return html`<sw-dialog open heading=${`הרצה עכשיו · ${s.display_name}`} @close=${this.close}>
      ${s.slots.length > 1
        ? html`<div class="slots" role="radiogroup" aria-label="משבצת להרצה">${s.slots.map(
            (sl) => html`<label class="opt"><input type="radio" name="slot" .checked=${d.slot === sl.index} @change=${() => (this.dialog = { ...d, slot: sl.index })} data-run-slot=${sl.index} /><span>${windowText(sl)}<small>${slotChips(sl, s).map((c) => `${c.label} · ${c.devices.join(', ')}`).join(' | ')}</small></span></label>`,
          )}</div>`
        : html`<p>${s.slots[0] ? `${windowText(s.slots[0])} · ${slotChips(s.slots[0], s).map((c) => `${c.label} · ${c.devices.join(', ')}`).join(' | ')}` : ''}</p>`}
      <p>${runNeedsConfirm(d.slot === null ? undefined : s.slots[d.slot]) ? 'הפעולה תפעיל התקנים פיזיים מיד.' : 'הפעולות של המשבצת ירוצו מיד.'}</p>
      ${s.conditions.items.length ? html`<label class="check"><input type="checkbox" .checked=${d.skip} @change=${(e: Event) => (this.dialog = { ...d, skip: (e.target as HTMLInputElement).checked })} data-run-skip />להריץ גם אם התנאים אינם מתקיימים</label>` : nothing}
      ${d.error ? html`<div class="err" role="alert" data-actions-error>${d.error}</div>` : nothing}
      <sw-button slot="footer" variant="ghost" @click=${this.close}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-run-confirm ?disabled=${!can || d.busy} @click=${() => (lowering ? this.askLoweringForRun(d) : void this.submit())}>${d.busy ? 'מריץ…' : 'הרצה'}</sw-button>
    </sw-dialog>`;
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
      return html`<sw-dialog open heading="מחיקת תזמון" @close=${this.close}>
        <p>למחוק את "${d.s.display_name}"? התזמון יפסיק לפעול ויועבר לסל המחזור ל־30 יום, ואפשר לשחזר אותו משם.</p>
        ${d.error ? html`<div class="err" role="alert" data-actions-error>${d.error}</div>` : nothing}
        <sw-button slot="footer" variant="ghost" @click=${this.close}>ביטול</sw-button>
        <sw-button slot="footer" variant="danger" data-delete-confirm ?disabled=${d.busy} @click=${() => void this.submit()}>${d.busy ? 'מוחק…' : 'מחיקה'}</sw-button>
      </sw-dialog>`;
    if (d.kind === 'copy')
      return html`<sw-dialog open heading="שכפול תזמון" @close=${this.close}>
        <label class="check" style="flex-direction:column;align-items:stretch">שם העותק<input type="text" maxlength="80" .value=${live(d.name)} data-copy-name @input=${(e: Event) => (this.dialog = { ...d, name: (e.target as HTMLInputElement).value })} /></label>
        ${d.error ? html`<div class="err" role="alert" data-actions-error>${d.error}</div>` : nothing}
        <sw-button slot="footer" variant="ghost" @click=${this.close}>ביטול</sw-button>
        <sw-button slot="footer" variant="primary" data-copy-confirm ?disabled=${d.busy || !d.name.trim()} @click=${() => void this.submit()}>${d.busy ? 'משכפל…' : 'שכפול'}</sw-button>
      </sw-dialog>`;
    // lowering: S4's dialog, by tag (the summary sentence, the checkbox and - when the panel needs it - the code field)
    return html`<schedule-lowering-dialog .open=${true} .summary=${d.summary} .needsCode=${d.needsCode} @confirm=${(e: CustomEvent<{ alarm_code: string | null }>) => void this.confirmLowering(e)} @close=${this.close}></schedule-lowering-dialog>`;
  }
}

/** A condition line of the drawer: the name, what it must be, and how it stands now (or that it is out of the caller's reach). */
function conditionLine(c: ConditionView) {
  const want = c.attribute === 'state' && (c.value === 'on' || c.value === 'off') ? `${c.match_type === 'is' ? '' : 'לא '}${c.value === 'on' ? 'פעיל' : 'כבוי'}` : `${MATCH_LABEL[c.match_type]} ${c.value}`;
  if (!c.readable) return html`<div class="cond" data-condition-locked><span class="cn">${c.name}<small>${want}</small></span><span class="cs muted"><sw-icon name="lock" size=${12}></sw-icon>מחוץ להרשאתך</span></div>`;
  const holds = conditionHolds(c);
  const now = holds === null ? 'לא זמין כרגע' : holds ? 'כרגע: מתקיים' : 'כרגע: לא מתקיים';
  return html`<div class="cond"><span class="cn">${c.name}<small>${want}</small></span><span class=${holds === true ? 'cs ok' : 'cs muted'}>${now}</span></div>`;
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

  static styles = css`
    :host {
      display: contents;
    }
    /* the drawer's body is a flex column with a limit (the phone's bottom sheet): nothing in it may shrink to nothing */
    .banner,
    .row,
    .meta,
    .slots,
    .list,
    .tags,
    .foot,
    .status,
    h4,
    sw-schedule-bar {
      flex: none;
    }
    .banner {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 9px 11px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-stale-soft);
      color: #92400e;
      border: 1px solid #fde3b4;
    }
    .banner.info {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border-color: #d7e4ff;
    }
    .banner.bad {
      background: var(--sw-danger-soft);
      color: #b91c1c;
      border-color: #f8caca;
    }
    .banner sw-icon {
      margin-block-start: 1px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .row b {
      font-size: var(--sw-fs-md);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    h4 {
      margin: 6px 0 0;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .slots {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
    }
    .slot {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      padding: 8px 11px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .slot:last-child {
      border-block-end: 0;
    }
    .slot .w {
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      text-align: end;
      unicode-bidi: isolate;
    }
    .slot .acts {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-inline-size: 0;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-inline-size: 100%;
    }
    .chip i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    .chip small,
    .cond small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .slot.bad {
      background: var(--sw-stale-soft);
    }
    .cond {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 10px;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .cs {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-size: var(--sw-fs-xs);
    }
    .cs.ok {
      color: #15803d;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 10px;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .li span:last-child {
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .foot {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .status {
      font-size: var(--sw-fs-sm);
      padding: 6px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-success-soft);
      color: #15803d;
    }
    .status.error {
      background: var(--sw-danger-soft);
      color: #b91c1c;
    }
  `;

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
    return html`
      ${readOnly.length ? html`<div class="banner info" data-drawer-readonly><sw-icon name=${s.sensitive ? 'lock' : 'eye'} size=${16}></sw-icon><span>לקריאה בלבד: ${readOnly[0].message}</span></div>` : nothing}
      ${this.conflict ? html`<div class="banner bad" role="alert" data-drawer-conflict><sw-icon name="warning" size=${16}></sw-icon><span>התזמון שונה במקום אחר. מוצגת הגרסה העדכנית.</span></div>` : nothing}
      ${s.warnings.map((w) => html`<div class="banner" data-drawer-warning><sw-icon name="warning" size=${16}></sw-icon><span>${w.message}</span></div>`)}
      ${this.note ? html`<div class=${this.note.tone === 'error' ? 'status error' : 'status'} role="status" data-drawer-status>${this.note.text}</div>` : nothing}
      <div class="row"><b>פעיל</b><sw-toggle label="פעיל" labelHidden .checked=${live(s.enabled)} ?disabled=${!s.can.toggle} title=${this.disabledWhy(s, 'toggle')} data-drawer-toggle @change=${(e: CustomEvent<{ checked: boolean }>) => void this.actions?.enable(s, e.detail.checked)}></sw-toggle></div>
      <sw-schedule-bar .slots=${s.slots} .sun=${isApi() ? null : DEMO_SUN}></sw-schedule-bar>
      <div class="meta">
        <sw-day-chips .days=${s.days}></sw-day-chips>
        ${periodLabel(s) ? html`<span class="pill" data-period><sw-icon name="calendar" size=${12}></sw-icon>${periodLabel(s)}</span>` : nothing}
        <schedule-condition-chip .conditions=${s.conditions}></schedule-condition-chip>
        <sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>
      </div>
      <h4>משבצות</h4>
      <div class="slots" data-drawer-slots>
        ${s.slots.map(
          (sl) => html`<div class=${sl.supported ? 'slot' : 'slot bad'} data-slot-row=${sl.index}>
            <span class="w">${windowText(sl)}</span>
            <span class="acts">${slotChips(sl, s).map(
              (c) => html`<span class="chip"><i style=${`--c:${toneColor(c.tone)}`}></i><span>${c.label}<small>${c.devices.join(', ')}</small></span></span>`,
            )}${sl.unsupported.map((u) => html`<small class="muted">${u.message}</small>`)}</span>
          </div>`,
        )}
      </div>
      ${s.conditions.items.length
        ? html`<h4>תנאים${s.conditions.items.length > 1 ? (s.conditions.type === 'and' ? ' · כולם' : ' · אחד מהם') : ''}</h4>
            <div class="list" data-drawer-conditions>${s.conditions.items.map((c) => conditionLine(c))}${s.conditions.track ? html`<small class="muted">ממשיך לבדוק עד סוף החלון</small>` : nothing}</div>`
        : nothing}
      <h4>ההרצות הבאות</h4>
      <div class="list" data-drawer-upcoming>
        ${upcoming.length
          ? upcoming.map((u) => html`<div class="li"><span>${s.slots[u.slot_index] ? slotChips(s.slots[u.slot_index], s).map((c) => `${c.label} · ${c.devices.join(', ')}`).join(' | ') : ''}</span><span>${whenLabel(u.at)}${s.conditions.items.length ? ' · בתנאי' : ''}</span></div>`)
          : html`<div class="li"><span class="muted">${nextRunText(s)}</span></div>`}
      </div>
      <h4>הרצות אחרונות</h4>
      <div class="list" data-drawer-runs>
        ${this.runs === null
          ? html`<div class="li"><span class="muted">טוען…</span></div>`
          : this.runs.length
            ? this.runs.map((r) => html`<div class="li"><span>${whenLabel(r.started_at)}${r.via === 'run_now' ? ' · הרצה ידנית' : ''}</span><span>${RESULT_LABEL[r.result]}</span></div>`)
            : html`<div class="li"><span class="muted">עדיין לא נרשמו הרצות.</span></div>`}
      </div>
      ${s.tags.length ? html`<div class="tags">${s.tags.map((t) => html`<span class="tag"><sw-icon name="bookmark" size=${11}></sw-icon>${t}</span>`)}</div>` : nothing}
      ${s.owner || s.updated_at ? html`<div class="foot">${s.owner ? `עודכן לאחרונה על ידי ${s.owner.display_name}` : 'נוצר מחוץ למערכת'}${s.updated_at ? ` · ${whenLabel(s.updated_at)}` : ''}</div>` : nothing}
    `;
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
            <sw-button slot="footer" variant="primary" icon="edit" data-drawer-edit ?disabled=${!s.can.edit} title=${this.disabledWhy(s, 'edit')} @click=${() => this.emit('edit', { id: s.id })}>עריכה מלאה</sw-button>
            <sw-button slot="footer" icon="play" data-drawer-run ?disabled=${!s.can.run} title=${this.disabledWhy(s, 'run')} @click=${() => this.actions?.run(s)}>הרצה עכשיו</sw-button>
            <sw-button slot="footer" icon="layers" data-drawer-copy ?disabled=${!s.can.copy} title=${this.disabledWhy(s, 'copy')} @click=${() => this.actions?.copy(s)}>שכפול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-drawer-delete ?disabled=${!s.can.delete} title=${this.disabledWhy(s, 'delete')} @click=${() => this.actions?.askDelete(s)}>מחיקה</sw-button>`
        : this.missing
          ? html`<div class="banner bad" data-drawer-missing><sw-icon name="warning" size=${16}></sw-icon><span>התזמון לא נמצא. ייתכן שנמחק או שאינו זמין לך.</span></div>`
          : html`<div class="muted">טוען…</div>`}
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-actions': ScheduleActions;
    'schedule-drawer': ScheduleDrawer;
  }
}

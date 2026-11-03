import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-dialog';
import './sw-icon';
import './wk-action-button';
import { getStationCodes, getStationPrograms, type AccessStation, type Period, type StationCodes, type StationProgram, type StationPrograms, type WeekdayName } from '../api/access-stations';
import { canAnywhere } from '../api/session';
import {
  WEEK,
  codeFormProblem,
  deleteHold,
  emptyBody,
  getDoorTech,
  getHold,
  normalized,
  phraseFor,
  policyProblems,
  programAction,
  runWrite,
  saveHold,
  saveProgram,
  statusText,
  statusTone,
  toBody,
  weekLines,
  writeCode,
  type DoorTechKind,
  type DoorTechOutcome,
  type DoorTechView,
  type HoldDraft,
  type PolicyBody,
} from '../api/door-tech';
import { fill } from '../i18n/wiskey-stations';
import { dtt } from '../i18n/wiskey-door-tech';

type Tab = 'hold' | 'codes' | 'programs' | 'history';
type Load = 'idle' | 'loading' | 'ready' | 'error';
interface Pending {
  key: string;
  kind: DoorTechKind;
  title: string;
  sentence: string;
  send: () => Promise<DoorTechOutcome>;
}
interface CodeForm {
  slot: number;
  action: 'set' | 'clear';
  expected: boolean;
  door: number;
  compatibility: boolean;
}

/**
 * Door technical writes inside the stations drawer's "הגדרות דלת" section (WISKEY-DOOR-TECH-2390; mounted there with one line; owner
 * Q5 = a): hold-open schedules (view / add / edit / delete), public door codes (set / clear - a value is typed, sent once and never
 * shown; the screen says "set" / "not set" only) and hold-open programs (apply / turn on again / pause / remove). For system
 * administrators only: the block is drawn only for a caller who holds `system.configure` or `access.stations.manage` somewhere, and the
 * server decides per station. NOTHING is read or sent before the operator opens the dialog; every write needs its confirmation (a code
 * also the typed phrase "קוד <n>"), runs ONCE per click and reports honestly: sending, done and acknowledged, partly done, WisKey's
 * refusal with its reason, not sent with the reason, or "sent, no clear answer".
 */
@customElement('wk-door-tech')
export class WkDoorTech extends LitElement {
  @property({ attribute: false }) station: AccessStation | null = null;
  /** The screen's feed is live (a write is never offered on a stale copy). */
  @property({ type: Boolean }) live = true;

  @state() private open = false;
  @state() private tab: Tab = 'hold';
  @state() private phase: Load = 'idle';
  @state() private view: DoorTechView | null = null;
  @state() private programs: StationPrograms | null = null;
  @state() private holds: Record<number, HoldDraft | null> = {};
  @state() private zone = 'Asia/Jerusalem';
  @state() private codes: StationCodes | null = null;
  @state() private codesPhase: Load = 'idle';
  @state() private editing: { door: number; revision: number; body: PolicyBody } | null = null;
  @state() private codeForm: CodeForm | null = null;
  @state() private pending: Pending | null = null;
  @state() private running: string | null = null;
  @state() private results: Record<string, DoorTechOutcome> = {};
  private seq = 0;
  private loadedFor = '';

  static styles = css`
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      padding-block-start: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
    }
    .row .t {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    /* the dialog's body is a column that scrolls: its direct children keep their height (a tall tab must not squash the tab bar) */
    .sub,
    .tabs,
    .note,
    [role='tabpanel'] {
      flex-shrink: 0;
    }
    .sub {
      margin: 0 0 var(--sw-s-3);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 3px;
      margin-block-end: var(--sw-s-3);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2, var(--sw-bg-2));
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs button {
      flex: 1 0 auto;
      min-block-size: 36px;
      padding: 0 var(--sw-s-3);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-surface, #fff);
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin: 0 0 var(--sw-s-2);
    }
    .note.warn {
      color: var(--sw-warning-text);
    }
    .door {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      margin-block-end: var(--sw-s-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .dh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .dh .n {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .lines {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .btns {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .line {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .line[data-tone='ok'] {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .line[data-tone='err'] {
      color: var(--sw-danger-text);
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .confirm {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
      border: 1px solid var(--sw-warning-border, var(--sw-border-strong));
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-bg, var(--sw-surface-2));
    }
    .confirm h5 {
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    .confirm p {
      margin: 0;
      line-height: 1.5;
    }
    form,
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-2) var(--sw-s-3);
    }
    label.f {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    input,
    select {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: var(--sw-ctl-h-md, 36px);
      padding: 4px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface, #fff);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    input.hm {
      inline-size: 5.5em;
      direction: ltr;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    input[type='password'],
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    input[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .day {
      display: grid;
      grid-template-columns: 4.5em 1fr;
      gap: var(--sw-s-2);
      align-items: start;
      padding-block: 4px;
      border-block-end: 1px dashed var(--sw-border);
    }
    .day .dn {
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .periods {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .period {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .closed {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      padding-block-start: 8px;
    }
    .holiday {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .problem {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger-text);
    }
    .check {
      display: flex;
      gap: var(--sw-s-2);
      align-items: center;
      font-size: var(--sw-fs-sm);
    }
    .check input {
      inline-size: auto;
      min-block-size: 0;
    }
    ul.hist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    ul.hist li {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      padding-block-end: var(--sw-s-2);
      border-block-end: 1px solid var(--sw-border);
    }
    bdi {
      unicode-bidi: isolate;
    }
    @media (max-width: 520px) {
      .grid2 {
        grid-template-columns: minmax(0, 1fr);
      }
      .day {
        grid-template-columns: minmax(0, 1fr);
      }
      .day .dn {
        padding-block-start: 0;
        font-weight: var(--sw-fw-semibold);
      }
    }
  `;

  /** The block exists only for a caller who may write door settings somewhere (the server decides per station). */
  private mayWrite(): boolean {
    return canAnywhere('system.configure') || canAnywhere('access.stations.manage');
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('station') && this.station && this.station.id !== this.loadedFor) {
      this.loadedFor = this.station.id;
      this.reset();
    }
    this.hidden = !this.station || !this.mayWrite();
  }

  private reset(): void {
    this.seq++;
    this.open = false;
    this.view = null;
    this.programs = null;
    this.holds = {};
    this.codes = null;
    this.codesPhase = 'idle';
    this.phase = 'idle';
    this.editing = null;
    this.codeForm = null;
    this.pending = null;
    this.running = null;
    this.results = {};
  }

  private doors(): number[] {
    return (this.view?.locks ?? this.station?.locks.map((l) => ({ door: l.physical_index, name: l.name ?? null })) ?? []).map((l) => l.door);
  }

  private doorName(door: number): string {
    const t = dtt();
    const lock = this.view?.locks.find((l) => l.door === door);
    return lock?.name?.trim() || fill(t.door, { n: door });
  }

  // ---------------------------------------------------------------- reads (only after the operator opened the dialog)

  private async openDialog(): Promise<void> {
    this.open = true;
    this.tab = 'hold';
    await this.load();
  }

  private async load(): Promise<void> {
    const s = this.station;
    if (!s) return;
    const mine = ++this.seq;
    this.phase = 'loading';
    try {
      const view = await getDoorTech(s.id);
      if (mine !== this.seq) return;
      this.view = view;
      if (!view.allowed) {
        this.phase = 'ready';
        return;
      }
      const [programs, ...holds] = await Promise.all([getStationPrograms(s.id), ...view.locks.map((l) => getHold(s.id, l.door))]);
      if (mine !== this.seq) return;
      this.programs = programs.programs;
      this.zone = programs.programs?.timezone || holds.find((h) => h.hold?.timezone)?.hold?.timezone || this.zone;
      this.holds = Object.fromEntries(view.locks.map((l, i) => [l.door, holds[i]?.hold?.draft ?? null]));
      this.phase = 'ready';
    } catch {
      if (mine === this.seq) this.phase = 'error';
    }
  }

  private async loadCodes(): Promise<void> {
    const s = this.station;
    if (!s) return;
    const mine = this.seq;
    this.codesPhase = 'loading';
    try {
      const r = await getStationCodes(s.id);
      if (mine !== this.seq) return;
      this.codes = r.codes;
      this.codesPhase = r.codes ? 'ready' : 'error';
    } catch {
      if (mine === this.seq) this.codesPhase = 'error';
    }
  }

  private pick(tab: Tab): void {
    this.tab = tab;
    this.pending = null;
    if (tab === 'codes' && this.codesPhase === 'idle') void this.loadCodes();
  }

  // ---------------------------------------------------------------- writes (each behind its confirmation, once)

  private ask(p: Pending): void {
    this.pending = p;
    this.updateComplete.then(() => {
      const box = this.renderRoot.querySelector<HTMLElement>('[data-wk-dt-confirm]');
      box?.scrollIntoView({ block: 'nearest' });
      box?.querySelector<HTMLElement>('[data-wk-dt-send]')?.focus();
    });
  }

  private async send(): Promise<void> {
    const p = this.pending;
    if (!p || this.running) return;
    this.pending = null;
    await this.execute(p.key, p.kind, p.send);
  }

  private async execute(key: string, kind: DoorTechKind, send: () => Promise<DoorTechOutcome>): Promise<void> {
    const sid = this.station?.id;
    this.running = key;
    this.results = { ...this.results, [key]: { kind, status: 'sending', code: null, retry_after_s: null, data: null } };
    const out = await send();
    if (this.station?.id !== sid) return;
    this.running = null;
    this.results = { ...this.results, [key]: out };
    this.dispatchEvent(new CustomEvent('door-tech-changed', { detail: out, bubbles: true, composed: true }));
    await this.load(); // a READ: what the door looks like after the answer (nothing is repeated)
    if (key.startsWith('code:')) await this.loadCodes();
  }

  private stationName(): string {
    return this.station?.name ?? '';
  }

  private askHoldSave(): void {
    const e = this.editing;
    const s = this.station;
    if (!e || !s || policyProblems(e.body).length) return;
    const t = dtt();
    const body = normalized(e.body);
    const door = e.door;
    const revision = e.revision;
    this.ask({
      key: `hold:${door}`,
      kind: 'hold_save',
      title: t.confirm.hold_save.title,
      sentence: fill(t.confirm.hold_save.one, { name: body.name, door: this.doorName(door), station: this.stationName() }),
      send: async () => {
        const out = await runWrite('hold_save', () => saveHold(s.id, door, revision, body));
        if (out.status === 'acknowledged') this.editing = null;
        return out;
      },
    });
  }

  private askHoldDelete(door: number): void {
    const s = this.station;
    const d = this.holds[door];
    if (!s || !d || d.revision === null) return;
    const t = dtt();
    const revision = d.revision;
    this.ask({
      key: `hold:${door}`,
      kind: 'hold_delete',
      title: t.confirm.hold_delete.title,
      sentence: fill(t.confirm.hold_delete.one, { door: this.doorName(door), station: this.stationName() }),
      send: () => runWrite('hold_delete', () => deleteHold(s.id, door, revision)),
    });
  }

  private askProgramSave(door: number, policy: PolicyBody, revision: number): void {
    const s = this.station;
    if (!s) return;
    const t = dtt();
    this.ask({
      key: `program:${door}`,
      kind: 'program_save',
      title: t.confirm.program_apply.title,
      sentence: fill(t.confirm.program_apply.one, { name: policy.name, door: this.doorName(door), station: this.stationName() }),
      send: () => runWrite('program_save', () => saveProgram(s.id, door, revision, normalized(policy), true)),
    });
  }

  private askProgramAction(p: StationProgram, action: 'pause' | 'remove'): void {
    const s = this.station;
    if (!s || p.door === null || p.revision === null) return;
    const t = dtt();
    const c = action === 'pause' ? t.confirm.program_pause : t.confirm.program_remove;
    const door = p.door;
    const revision = p.revision;
    this.ask({
      key: `program:${door}`,
      kind: 'program_action',
      title: c.title,
      sentence: fill(c.one, { door: this.doorName(door), station: this.stationName() }),
      send: () => runWrite('program_action', () => programAction(s.id, door, revision, action)),
    });
  }

  /** The code form's fields are read from the DOM at send time and cleared at once: no code value is ever kept in this element's state. */
  private async sendCode(ev: Event): Promise<void> {
    ev.preventDefault();
    const f = this.codeForm;
    const s = this.station;
    const v = this.view;
    if (!f || !s || !v || this.running) return;
    const root = this.renderRoot;
    const val = (name: string) => root.querySelector<HTMLInputElement>(`[data-wk-dt-code-field="${name}"]`)?.value ?? '';
    const form = { action: f.action, expected: f.expected, newCode: val('new'), repeatCode: val('repeat'), currentCode: val('current'), typed: val('typed'), phrase: phraseFor(v.confirm_phrase, f.slot) };
    const problem = codeFormProblem(form);
    const note = root.querySelector<HTMLElement>('[data-wk-dt-code-problem]');
    if (problem) {
      if (note) note.textContent = dtt().codes.problems[problem];
      return;
    }
    const request = { slot: f.slot, action: f.action, door: f.door, expected: f.expected, newCode: form.newCode, currentCode: form.currentCode, compatibility: f.compatibility, confirmText: form.typed };
    root.querySelectorAll<HTMLInputElement>('[data-wk-dt-code-field]').forEach((i) => (i.value = ''));
    form.newCode = form.repeatCode = form.currentCode = '';
    this.codeForm = null;
    await this.execute(`code:${f.slot}`, 'code_write', () => runWrite('code_write', () => writeCode(s.id, request)));
  }

  // ---------------------------------------------------------------- render

  render() {
    const s = this.station;
    if (!s || !this.mayWrite()) return nothing;
    const t = dtt();
    return html`<div class="row" data-wk-dt=${s.id}>
        <span class="t"><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</span>
        <wk-action-button icon="door" data-wk-dt-open @click=${() => void this.openDialog()}>${t.open}</wk-action-button>
      </div>
      ${this.open ? this.renderDialog(s) : nothing}`;
  }

  private renderDialog(s: AccessStation): TemplateResult {
    const t = dtt();
    return html`<sw-dialog
      open
      xl
      heading=${fill(t.heading, { name: s.name })}
      ?locked=${!!this.running}
      data-wk-dt-dialog
      data-wk-dt-state=${this.phase}
      @close=${(e: Event) => {
        if (e.target === e.currentTarget) {
          this.open = false;
          this.pending = null;
          this.editing = null;
          this.codeForm = null;
        }
      }}
    >
      <p class="sub">${t.sub}</p>
      ${this.renderBody()}
      <div slot="footer"><wk-action-button data-wk-dt-close ?disabled=${!!this.running} @click=${() => (this.open = false)}>${t.close}</wk-action-button></div>
    </sw-dialog>`;
  }

  private renderBody(): TemplateResult | typeof nothing {
    const t = dtt();
    if (this.phase === 'loading' && !this.view) return html`<p class="note" role="status">${t.loading}</p>`;
    if (this.phase === 'error' && !this.view)
      return html`<p class="note" role="status" data-wk-dt-error>${t.unavailable} <wk-action-button tone="quiet" @click=${() => void this.load()}>${t.retry}</wk-action-button></p>`;
    const v = this.view;
    if (!v) return nothing;
    if (!v.allowed) return html`<p class="note warn" data-wk-dt-not-allowed>${t.notAllowed}</p>`;
    if (!v.locks.length) return html`<p class="note" data-wk-dt-no-doors>${t.noDoors}</p>`;
    const tabs: Tab[] = ['hold', 'programs', 'codes', 'history'];
    return html`${v.online === false ? html`<p class="note warn" data-wk-dt-offline>${t.offline}</p>` : nothing}
      <div class="tabs" role="tablist" aria-label=${t.title}>
        ${tabs.map(
          (id) => html`<button type="button" role="tab" aria-selected=${String(this.tab === id)} data-wk-dt-tab=${id} @click=${() => this.pick(id)}>${t.tabs[id]}</button>`,
        )}
      </div>
      <div role="tabpanel" data-wk-dt-panel=${this.tab}>
        ${this.tab === 'hold' ? this.renderHold() : this.tab === 'codes' ? this.renderCodes() : this.tab === 'programs' ? this.renderPrograms() : this.renderHistory()}
      </div>`;
  }

  private renderConfirm(p: Pending): TemplateResult {
    const t = dtt();
    return html`<div class="confirm" role="alertdialog" aria-label=${p.title} data-wk-dt-confirm=${p.kind}>
      <h5>${p.title}</h5>
      <p data-wk-dt-sentence>${p.sentence}</p>
      <div class="btns">
        <wk-action-button tone="primary" data-wk-dt-send ?disabled=${!this.live || !!this.running} @click=${() => void this.send()}>${t.confirm.send}</wk-action-button>
        <wk-action-button data-wk-dt-cancel @click=${() => (this.pending = null)}>${t.confirm.cancel}</wk-action-button>
      </div>
    </div>`;
  }

  /** The confirmation of a write, drawn where the operator asked for it (the door's card, under the editor's buttons) - never off-screen. */
  private confirmAt(key: string): TemplateResult | typeof nothing {
    return this.pending?.key === key ? this.renderConfirm(this.pending) : nothing;
  }

  private result(key: string): TemplateResult | typeof nothing {
    const r = this.results[key];
    if (!r) return nothing;
    return html`<span class="line" role="status" data-wk-dt-result=${key} data-status=${r.status} data-tone=${statusTone(r.status)}>${statusText(r, dtt())}</span>`;
  }

  private unsupported(kind: DoorTechKind): boolean {
    return this.view?.commands?.[kind]?.available === false;
  }

  // ---- hold-open schedules

  private renderHold(): TemplateResult {
    const t = dtt();
    if (this.editing) return this.renderEditor();
    return html`<p class="note">${t.hold.draftNote}</p>
      ${this.doors().map((door) => {
        const d = this.holds[door] ?? null;
        const body = d?.policy ? toBody(d.policy, this.zone) : null;
        const lines = weekLines(body, t);
        const key = `hold:${door}`;
        const busy = this.running === key;
        return html`<div class="door" data-wk-dt-hold=${door}>
          <div class="dh">
            <span class="n">${this.doorName(door)}${body ? html` · <bdi>${body.name}</bdi>` : nothing}</span>
            <div class="btns">
              ${this.unsupported('hold_save')
                ? nothing
                : html`<wk-action-button icon=${d ? 'edit' : 'plus'} data-wk-dt-hold-edit=${door} ?disabled=${!this.live || !!this.running || d?.revision === null}
                    @click=${() => (this.editing = { door, revision: d?.revision ?? 0, body: body ?? emptyBody(this.zone) })}>${d ? t.hold.edit : t.hold.add}</wk-action-button>`}
              ${d && !this.unsupported('hold_delete')
                ? html`<wk-action-button tone="danger" icon="trash" data-wk-dt-hold-delete=${door} ?busy=${busy} ?disabled=${!this.live || !!this.running}
                    @click=${() => this.askHoldDelete(door)}>${t.hold.remove}</wk-action-button>`
                : nothing}
            </div>
          </div>
          ${body
            ? html`<div class="lines">${lines.length ? lines.map((l) => html`<bdi>${l}</bdi>`) : html`<span>${t.hold.noHours}</span>`}${body.holidays.length
                ? html`<span>${fill(t.hold.holidays, { n: body.holidays.length })}</span>`
                : nothing}</div>`
            : html`<span class="line">${t.hold.none}</span>`}
          ${this.confirmAt(key)} ${this.result(key)}
        </div>`;
      })}`;
  }

  private change(fn: (b: PolicyBody) => void): void {
    if (!this.editing) return;
    const body = structuredClone(this.editing.body);
    fn(body);
    this.editing = { ...this.editing, body };
  }

  private periodInputs(list: Period[], path: string, set: (i: number, k: 'start' | 'end', v: string) => void, drop: (i: number) => void): TemplateResult {
    const t = dtt().editor;
    return html`${list.map(
      (p, i) => html`<span class="period" data-wk-dt-period=${`${path}.${i}`}>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="07:00" aria-label=${t.from} .value=${p.start} @input=${(e: Event) => set(i, 'start', (e.target as HTMLInputElement).value)} />
        <span aria-hidden="true">–</span>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="19:00" aria-label=${t.to} .value=${p.end} @input=${(e: Event) => set(i, 'end', (e.target as HTMLInputElement).value)} />
        <wk-action-button tone="quiet" icon="close" icon-only label=${t.removePeriod} @click=${() => drop(i)}></wk-action-button>
      </span>`,
    )}`;
  }

  private renderEditor(): TemplateResult {
    const t = dtt();
    const e = this.editing!;
    const b = e.body;
    const problems = policyProblems(b);
    const at = (prefix: string) => problems.filter((p) => p.field === prefix || p.field.startsWith(prefix + '.'));
    const say = (list: { key: keyof typeof t.editor.problems }[]) => (list.length ? html`<span class="problem">${t.editor.problems[list[0].key]}</span>` : nothing);
    return html`<div class="form" data-wk-dt-editor=${e.door}>
      <h5>${fill(e.revision ? t.editor.titleEdit : t.editor.titleNew, { door: this.doorName(e.door) })}</h5>
      <div class="grid2">
        <label class="f">${t.editor.name}<input data-wk-dt-name maxlength="32" .value=${b.name} aria-invalid=${String(!!at('name').length)} @input=${(ev: Event) => this.change((x) => (x.name = (ev.target as HTMLInputElement).value))} />${say(at('name'))}</label>
        <label class="f">${t.editor.zone}<input class="ltr" data-wk-dt-zone maxlength="64" .value=${b.timezone} @input=${(ev: Event) => this.change((x) => (x.timezone = (ev.target as HTMLInputElement).value.trim()))} />${say(at('timezone'))}</label>
      </div>
      <div>
        <div class="line">${t.editor.week}</div>
        ${WEEK.map((d: WeekdayName) => {
          const list = b.weekly[d] ?? [];
          return html`<div class="day" data-wk-dt-day=${d}>
            <span class="dn">${t.dayNames[d]}</span>
            <div>
              <div class="periods">
                ${list.length ? nothing : html`<span class="closed">${t.editor.closed}</span>`}
                ${this.periodInputs(list, d, (i, k, v) => this.change((x) => (x.weekly[d][i][k] = v)), (i) => this.change((x) => x.weekly[d].splice(i, 1)))}
                ${list.length < 8
                  ? html`<wk-action-button tone="quiet" icon="plus" data-wk-dt-add-period=${d} @click=${() => this.change((x) => x.weekly[d].push(list.length ? { start: '', end: '' } : { start: '07:00', end: '19:00' }))}>${t.editor.addPeriod}</wk-action-button>`
                  : nothing}
              </div>
              ${say(at(`weekly.${d}`))}
            </div>
          </div>`;
        })}
      </div>
      <div class="form">
        <div class="line">${t.editor.holidays}</div>
        ${b.holidays.map(
          (h, i) => html`<div class="holiday" data-wk-dt-holiday=${i}>
            <div class="grid2">
              <label class="f">${t.editor.holidayName}<input maxlength="32" .value=${h.name} @input=${(ev: Event) => this.change((x) => (x.holidays[i].name = (ev.target as HTMLInputElement).value))} /></label>
              <span></span>
              <label class="f">${t.editor.holidayStart}<input type="date" min="2000-01-01" max="2037-12-31" .value=${h.start} @input=${(ev: Event) => this.change((x) => (x.holidays[i].start = (ev.target as HTMLInputElement).value))} /></label>
              <label class="f">${t.editor.holidayEnd}<input type="date" min="2000-01-01" max="2037-12-31" .value=${h.end} @input=${(ev: Event) => this.change((x) => (x.holidays[i].end = (ev.target as HTMLInputElement).value))} /></label>
            </div>
            <div class="periods">
              ${h.periods.length ? nothing : html`<span class="closed">${t.editor.holidayClosed}</span>`}
              ${this.periodInputs(h.periods, `h${i}`, (j, k, v) => this.change((x) => (x.holidays[i].periods[j][k] = v)), (j) => this.change((x) => x.holidays[i].periods.splice(j, 1)))}
              <wk-action-button tone="quiet" icon="plus" @click=${() => this.change((x) => x.holidays[i].periods.push({ start: '08:00', end: '12:00' }))}>${t.editor.addPeriod}</wk-action-button>
              <wk-action-button tone="quiet" icon="trash" @click=${() => this.change((x) => x.holidays.splice(i, 1))}>${t.editor.removeHoliday}</wk-action-button>
            </div>
            ${say(at(`holidays.${i}`))}
          </div>`,
        )}
        ${say(problems.filter((p) => p.field === 'holidays'))}
        <div class="btns">
          <wk-action-button tone="quiet" icon="plus" data-wk-dt-add-holiday @click=${() => this.change((x) => x.holidays.push({ name: '', start: '', end: '', periods: [] }))}>${t.editor.addHoliday}</wk-action-button>
        </div>
      </div>
      <div class="btns">
        <wk-action-button tone="primary" icon="check" data-wk-dt-save ?disabled=${!this.live || !!this.running || problems.length > 0} @click=${() => this.askHoldSave()}>${t.editor.save}</wk-action-button>
        <wk-action-button data-wk-dt-editor-cancel ?disabled=${!!this.running} @click=${() => ((this.editing = null), (this.pending = null))}>${t.editor.cancel}</wk-action-button>
      </div>
      ${this.confirmAt(`hold:${e.door}`)} ${this.result(`hold:${e.door}`)}
    </div>`;
  }

  // ---- programs

  private renderPrograms(): TemplateResult {
    const t = dtt();
    const online = this.view?.online !== false;
    return html`${this.doors().map((door) => {
      const p = this.programs?.programs.find((x) => x.door === door) ?? null;
      const draft = this.holds[door] ?? null;
      const draftBody = draft?.policy ? toBody(draft.policy, this.zone) : null;
      const key = `program:${door}`;
      const off = !this.live || !!this.running;
      const canSave = !this.unsupported('program_save');
      const canAct = !this.unsupported('program_action');
      const paused = !!p && !p.enabled && !p.removing;
      const state = !p ? t.programs.none : p.removing ? t.programs.removing : p.enabled ? t.programs.on : t.programs.paused;
      const exec = p?.execution?.status ? t.programs.exec[p.execution.status] : null;
      const progBody = p?.policy ? toBody(p.policy, this.zone) : null;
      return html`<div class="door" data-wk-dt-program=${door} data-state=${!p ? 'none' : p.removing ? 'removing' : p.enabled ? 'on' : 'paused'}>
        <div class="dh">
          <span class="n">${this.doorName(door)}${progBody?.name ? html` · <bdi>${progBody.name}</bdi>` : nothing}</span>
          <sw-badge kind=${!p ? 'neutral' : p.removing ? 'stale' : p.enabled ? 'live' : 'offline'} label=${state}></sw-badge>
        </div>
        ${progBody ? html`<div class="lines">${weekLines(progBody, t).map((l) => html`<bdi>${l}</bdi>`)}</div>` : nothing}
        ${exec && p?.enabled ? html`<span class="line">${exec}</span>` : nothing}
        <div class="btns">
          ${canSave && draftBody && (!p || paused)
            ? html`<wk-action-button tone="primary" icon="play" data-wk-dt-program-apply=${door} ?disabled=${off || !online} @click=${() => this.askProgramSave(door, draftBody, p?.revision ?? 0)}>${t.programs.apply}</wk-action-button>`
            : nothing}
          ${canSave && paused && progBody && p?.revision !== null
            ? html`<wk-action-button icon="play" data-wk-dt-program-resume=${door} ?disabled=${off || !online} @click=${() => this.askProgramSave(door, progBody, p!.revision!)}>${t.programs.resume}</wk-action-button>`
            : nothing}
          ${canAct && p?.enabled && !p.removing
            ? html`<wk-action-button icon="pause" data-wk-dt-program-pause=${door} ?disabled=${off} @click=${() => this.askProgramAction(p, 'pause')}>${t.programs.pause}</wk-action-button>`
            : nothing}
          ${canAct && p && !p.removing
            ? html`<wk-action-button tone="danger" icon="trash" data-wk-dt-program-remove=${door} ?disabled=${off} @click=${() => this.askProgramAction(p, 'remove')}>${t.programs.remove}</wk-action-button>`
            : nothing}
        </div>
        ${!draftBody && (!p || paused) ? html`<span class="line">${t.programs.needDraft}</span>` : nothing}
        ${draftBody && p?.enabled ? html`<span class="line">${t.programs.pauseFirst}</span>` : nothing}
        ${this.confirmAt(key)} ${this.result(key)}
      </div>`;
    })}`;
  }

  // ---- public codes

  private renderCodes(): TemplateResult {
    const t = dtt();
    if (this.codesPhase === 'loading' && !this.codes) return html`<p class="note" role="status">${t.loading}</p>`;
    if (this.codesPhase === 'error' && !this.codes)
      return html`<p class="note" data-wk-dt-codes-error>${t.unavailable} <wk-action-button tone="quiet" @click=${() => void this.loadCodes()}>${t.retry}</wk-action-button></p>`;
    const c = this.codes;
    if (!c) return html`<wk-action-button @click=${() => void this.loadCodes()}>${t.codes.load}</wk-action-button>`;
    const online = this.view?.online !== false;
    const can = !this.unsupported('code_write');
    const limits = this.view?.limits;
    return html`<p class="note">${t.codes.never}${limits ? html` ${fill(t.codes.rate, { n: limits.code_max, m: Math.round(limits.code_window_s / 60) })}` : nothing}</p>
      ${this.codeForm ? this.renderCodeForm(this.codeForm, c) : nothing}
      ${c.slots.map((sl) => {
        const key = `code:${sl.slot}`;
        const state = sl.configured === true ? t.codes.set : sl.configured === false ? t.codes.notSet : t.codes.unknown;
        const off = !this.live || !!this.running || !online || sl.configured === null || !!this.codeForm;
        return html`<div class="door" data-wk-dt-slot=${sl.slot} data-configured=${String(sl.configured)}>
          <div class="dh">
            <span class="n">${fill(t.codes.slot, { n: sl.slot })}</span>
            <sw-badge kind=${sl.configured === true ? 'live' : sl.configured === false ? 'offline' : 'unknown'} label=${state}></sw-badge>
          </div>
          ${can
            ? html`<div class="btns">
                <wk-action-button icon="lock" data-wk-dt-code-set=${sl.slot} ?disabled=${off}
                  @click=${() => (this.codeForm = { slot: sl.slot, action: 'set', expected: sl.configured === true, door: this.doors()[0] ?? 1, compatibility: false })}>${sl.configured ? t.codes.replace : t.codes.define}</wk-action-button>
                ${sl.configured
                  ? html`<wk-action-button tone="danger" icon="trash" data-wk-dt-code-clear=${sl.slot} ?disabled=${off}
                      @click=${() => (this.codeForm = { slot: sl.slot, action: 'clear', expected: true, door: this.doors()[0] ?? 1, compatibility: false })}>${t.codes.clear}</wk-action-button>`
                  : nothing}
              </div>`
            : nothing}
          ${this.result(key)}
        </div>`;
      })}`;
  }

  private renderCodeForm(f: CodeForm, c: StationCodes): TemplateResult {
    const t = dtt();
    const slot = fill(t.codes.slot, { n: f.slot });
    const title = f.action === 'clear' ? t.codes.formClear : f.expected ? t.codes.formReplace : t.codes.formSet;
    const phrase = phraseFor(this.view?.confirm_phrase ?? 'קוד {slot}', f.slot);
    const doors = this.doors();
    return html`<form class="confirm" data-wk-dt-code-form=${f.slot} data-action=${f.action} autocomplete="off" @submit=${(e: Event) => void this.sendCode(e)}>
      <h5>${fill(title, { slot })}</h5>
      ${doors.length > 1
        ? html`<label class="f">${t.codes.door}<select data-wk-dt-code-door @change=${(e: Event) => (this.codeForm = { ...f, door: Number((e.target as HTMLSelectElement).value) })}>
            ${doors.map((d) => html`<option value=${d} ?selected=${d === f.door}>${this.doorName(d)}</option>`)}
          </select></label>`
        : nothing}
      ${f.action === 'set'
        ? html`<div class="grid2">
            <label class="f">${t.codes.newCode}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="new" /></label>
            <label class="f">${t.codes.repeat}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="repeat" /></label>
          </div>`
        : nothing}
      ${f.expected
        ? html`<label class="f">${t.codes.current}<input type="password" inputmode="numeric" autocomplete="off" maxlength="16" data-wk-dt-code-field="current" /><span class="line">${t.codes.currentHint}</span></label>`
        : nothing}
      ${c.capabilities.advertised === false && f.action === 'set'
        ? html`<label class="check"><input type="checkbox" data-wk-dt-code-compat .checked=${f.compatibility} @change=${(e: Event) => (this.codeForm = { ...f, compatibility: (e.target as HTMLInputElement).checked })} />${t.codes.compatibility}</label>`
        : nothing}
      <label class="f">${fill(t.codes.typed, { phrase })}<input autocomplete="off" maxlength="32" data-wk-dt-code-field="typed" /></label>
      <span class="problem" role="alert" data-wk-dt-code-problem></span>
      <div class="btns">
        <wk-action-button tone="primary" icon="lock" data-wk-dt-code-send ?disabled=${!this.live || !!this.running} @click=${(e: Event) => void this.sendCode(e)}>${t.codes.send}</wk-action-button>
        <wk-action-button data-wk-dt-code-cancel @click=${() => (this.codeForm = null)}>${t.codes.cancel}</wk-action-button>
      </div>
    </form>`;
  }

  // ---- history

  private renderHistory(): TemplateResult {
    const t = dtt();
    const list = this.view?.history ?? [];
    if (!list.length) return html`<p class="note" data-wk-dt-history-empty>${t.historyEmpty}</p>`;
    return html`<ul class="hist" data-wk-dt-history>
      ${list.map((h) => {
        const what =
          h.kind === 'code_write' && h.slot
            ? fill(t.historyCode, { action: t.codeActions[h.code_action ?? 'set'], slot: fill(t.codes.slot, { n: h.slot }) })
            : `${h.kind === 'program_action' && h.program_action ? t.programActions[h.program_action] : t.kinds[h.kind]}${h.door ? ` · ${this.doorName(h.door)}` : ''}`;
        return html`<li data-wk-dt-history-row=${h.kind} data-status=${h.status}>
          <span>${what}</span>
          <span class="line" data-tone=${statusTone(h.status)}><bdi>${new Date(h.at).toLocaleString(document.documentElement.lang || 'he', { dateStyle: 'short', timeStyle: 'short' })}</bdi> · ${statusText(h, t)}</span>
        </li>`;
      })}
    </ul>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-door-tech': WkDoorTech;
  }
}

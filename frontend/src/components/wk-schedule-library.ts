import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-card';
import './sw-dialog';
import './sw-dropdown';
import type { DropdownChange } from './sw-dropdown';
import './sw-drawer';
import './sw-icon';
import './wk-action-button';
import './wk-schedule-draft-form';
import type { StateKind } from './sw-badge';
import type { AccessStation } from '../api/access-stations';
import { dateInputLang } from '../api/day-format'; // DATEFMT60-295: Hebrew lang on date / time inputs
import type { LibrarySchedule, ScheduleOperations, SchedulePlan } from '../api/access-schedules';
import {
  applyImport,
  assessDraft,
  checkDraft,
  clearBaseline,
  confirmClaim,
  createSchedule,
  deletePlan,
  deleteSchedule,
  deployPlans,
  exportLibrary,
  getClaims,
  getJobs,
  jobAction,
  outcomeOf,
  previewClaim,
  previewImport,
  previewPlan,
  readReadiness,
  recheckPlan,
  releaseClaim,
  saveBaseline,
  savePlan,
  updateSchedule,
  type Assessment,
  type Bindings,
  type CheckResult,
  type Claim,
  type DeployResult,
  type Draft,
  type Impact,
  type ImportPreview,
  type Job,
  type Outcome,
  type Plan,
  type Readiness,
} from '../api/schedule-writes';
import {
  bindingFaults,
  canonical,
  defaultBindings,
  deployTone,
  draftOf,
  emptyDraft,
  faults,
  isActive,
  jobTone,
  localNow,
  rangeOf,
  sameDraft,
  weekMinutes,
  type Tone,
} from '../access-control/schedule-editor-logic';
import { BASELINE_STATES, JOB_STATES, KIND_NAMES, LIMIT_NAMES, RES_STATES, reasonOf, sed } from '../i18n/schedule-editor';

const KIND: Record<Tone, StateKind> = { live: 'live', stale: 'stale', error: 'error', offline: 'offline', unknown: 'unknown', neutral: 'neutral' };
const POLL_MS = 2_000;
const POLL_MAX_MS = 180_000;
const IMPORT_MAX = 60_000;

/** The last result line of the card: what happened, honestly. */
interface Note {
  tone: 'ok' | 'refused' | 'not_sent' | 'unknown';
  text: string;
  code: string | null;
}

/** One station of a deployment being prepared. */
interface Target {
  stationId: string;
  readiness: Readiness | null;
  bindings: Bindings;
  phase: 'idle' | 'reading' | 'previewing' | 'previewed' | 'saving' | 'saved' | 'error';
  previewId: string | null;
  impact: Impact | null;
  plan: Plan | null;
  error: Outcome | null;
}

type Ask =
  | { kind: 'save' }
  | { kind: 'delete'; schedule: LibrarySchedule }
  | { kind: 'import' }
  | { kind: 'deploy' }
  | { kind: 'baseline_save' }
  | { kind: 'baseline_clear' }
  | { kind: 'plan_recheck' | 'plan_delete'; plan: SchedulePlan }
  | { kind: 'claim'; plan: SchedulePlan; previewId: string; keys: string[] }
  | { kind: 'release'; claim: Claim }
  | { kind: 'job'; action: 'job_check' | 'job_cancel' | 'job_archive'; job: Job };

/**
 * The device schedule LIBRARY editor (WISKEY-SCHED-WRITE-2390; owner decision 03.11 Q4 "a": full editing in Arx). Shown inside the
 * schedules screen to the schedules administrator only (`access.schedules.manage` or `system.configure` at the installation; the
 * server checks it again on every call). It edits the integration's library and its deployment - never a door's own hold-open program.
 *
 * Every write is: the integration's own preview first (the draft check, the import preview, the station read and the deployment
 * preview with its impact - which station, which doors, how many people), then an explicit confirmation, then ONE call, and the
 * result said as it is: done, "WisKey סירב: <reason>", not sent (and why), or sent with no clear answer. Deployments are followed by
 * their job ids until every station reached a final state; a station that fails never hides the others. Nothing repeats by itself.
 *
 * Data: the screen's own reads (library, proposals, operations) come in as properties; after any write the component asks the screen
 * to read again (`sched-changed`).
 */
@customElement('wk-schedule-library')
export class WkScheduleLibrary extends LitElement {
  @property({ attribute: false }) stations: AccessStation[] = [];
  @property({ attribute: false }) library: LibrarySchedule[] | null = null;
  @property({ attribute: false }) plans: SchedulePlan[] | null = null;
  @property({ attribute: false }) ops: ScheduleOperations | null = null;
  /** The screen's copy is current (a write is never offered on a stale copy). */
  @property({ type: Boolean }) live = true;
  @property({ type: Boolean }) narrow = false;

  // the editor
  @state() private editing: LibrarySchedule | 'new' | null = null;
  @state() private draft: Draft = emptyDraft();
  @state() private checkAt = localNow(Date.now());
  @state() private checked: { draft: Draft; id: string; result: CheckResult } | null = null;
  @state() private busy: string | null = null;
  @state() private assessStation = '';
  @state() private assessment: { station: string; data: Assessment; previewId: string | null } | null = null;
  // import
  @state() private importing: { preview: ImportPreview; previewId: string; file: string } | null = null;
  // deploy
  @state() private deploying: LibrarySchedule | null = null;
  @state() private targets: Target[] = [];
  @state() private progress: { results: DeployResult[]; jobs: Record<string, Job>; done: boolean; writesEnabled: boolean | null } | null = null;
  // misc
  @state() private ask: Ask | null = null;
  @state() private note: Note | null = null;
  @state() private claims: Claim[] | null = null;
  private pollTimer = 0;
  private pollStarted = 0;

  /** Owner 04.11 (Q11 "a"): the deploy button is shown now, with a plain warning while the integration's LIVE answer says it writes no
   * schedule to the stations (`operations_list.writes_enabled` false - in WisKey 2.0.1-rc.10 every job ends `blocked` with
   * `schedule_writes_unverified` / `schedule_ownership_unknown`: the job is created and WisKey's preflight runs, nothing reaches a
   * station). Read from the operations answer, never from a version number, so the warning goes away once WisKey enables writing. No
   * operations answer yet (loading, refused): no claim either way. */
  private get writesOff(): boolean {
    return this.ops?.writes_enabled === false;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      margin-block-start: var(--sw-s-4);
      --se-hit: var(--sw-touch-desktop, 44px);
    }
    @media (max-width: 1100px) {
      :host {
        --se-hit: 44px;
      }
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding: var(--sw-s-4);
    }
    .bh {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .bh h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .bh .n {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .bh .sp {
      flex: 1;
    }
    .rows {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:first-child {
      border-block-start: 0;
    }
    .row .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    .s {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
      justify-content: flex-end;
    }
    @media (max-width: 640px) {
      .row {
        flex-wrap: wrap;
      }
      .acts {
        inline-size: 100%;
        justify-content: flex-start;
      }
    }
    .note {
      margin: 0;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .note[data-tone='ok'] {
      background: var(--sw-live-soft, var(--sw-surface-2));
      color: var(--sw-live-text, var(--sw-text));
    }
    .note[data-tone='refused'] {
      background: var(--sw-danger-soft, var(--sw-surface-2));
      color: var(--sw-danger-text);
    }
    .note[data-tone='not_sent'],
    .note[data-tone='unknown'] {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .warn {
      margin: 0;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      font-size: var(--sw-fs-sm);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .panel h4 {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    input {
      box-sizing: border-box;
      min-block-size: var(--se-hit);
      padding: 0 var(--sw-s-3);
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: max(16px, var(--sw-fs-sm));
      font-variant-numeric: tabular-nums;
    }
    input[type='time'],
    input[type='date'],
    input[type='number'] {
      direction: ltr;
    }
    input[type='number'] {
      inline-size: 6.5em;
    }
    input[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    label.f,
    div.f {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    ul.plain {
      margin: 0;
      padding-inline-start: var(--sw-s-4);
      font-size: var(--sw-fs-sm);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .result {
      font-size: var(--sw-fs-sm);
    }
    .result[data-ok='true'] {
      color: var(--sw-live-text, var(--sw-text));
    }
    .result[data-ok='false'] {
      color: var(--sw-text-2);
    }
    .target {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .target[data-phase='previewed'],
    .target[data-phase='saved'] {
      border-color: var(--sw-accent);
    }
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .pick {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--se-hit);
      padding-inline: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill, 999px);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      touch-action: manipulation;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
    }
    .pick[data-on] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft, var(--sw-surface-2));
    }
    .pick[data-off] {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .pick input {
      min-block-size: 0;
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .prog {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .prog .row {
      border-block-start: 1px solid var(--sw-border);
    }
    .spin {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--sw-border);
      border-block-start-color: var(--sw-accent);
      animation: spin 700ms linear infinite;
      flex: none;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .sentence {
      margin: 0 0 var(--sw-s-2);
      line-height: 1.5;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    input[type='file'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.pollTimer);
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('stations') && !this.assessStation) this.assessStation = this.stations.find((s) => s.online)?.id ?? '';
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('sched-changed', { bubbles: true, composed: true }));
  }

  private stationName(id: string | null | undefined): string {
    return this.stations.find((s) => s.id === id)?.name ?? id ?? '';
  }

  private say(o: Outcome | null, okText?: string) {
    if (!o) {
      this.note = { tone: 'ok', text: okText ?? sed('done'), code: null };
      return;
    }
    const text =
      o.status === 'refused' ? sed('refusedBy', { reason: reasonOf(o.code) || o.message }) : o.status === 'not_sent' ? sed('notSent', { reason: o.message || reasonOf(o.code) }) : sed('unknownOutcome');
    this.note = { tone: o.status, text, code: o.code };
  }

  /** One deliberate call: `busy` while it runs, the outcome said, `changed` when something may have been stored. */
  private async run<T>(key: string, call: () => Promise<T>, okText?: string, writes = true): Promise<T | null> {
    this.busy = key;
    try {
      const r = await call();
      if (writes) {
        this.say(null, okText);
        this.changed();
      }
      return r;
    } catch (err) {
      const o = outcomeOf(err);
      this.say(o);
      if (writes && o.status !== 'not_sent') this.changed();
      return null;
    } finally {
      this.busy = null;
    }
  }

  // ------------------------------------------------------------------ the editor

  private openEditor(s: LibrarySchedule | 'new') {
    this.editing = s;
    this.draft = s === 'new' ? emptyDraft() : draftOf(s);
    this.checked = null;
    this.assessment = null;
    this.checkAt = localNow(Date.now());
    this.note = null;
  }

  private closeEditor() {
    this.editing = null;
    this.ask = null;
  }

  private async runCheck() {
    const draft = canonical(this.draft);
    const r = await this.run('check', () => checkDraft(draft, this.checkAt.date, this.checkAt.time), undefined, false);
    if (r?.check_id) this.checked = { draft, id: r.check_id, result: r.data };
  }

  private checkValid(): boolean {
    return !!this.checked && sameDraft(this.checked.draft, this.draft);
  }

  private async save() {
    const c = this.checked;
    const target = this.editing;
    this.ask = null;
    if (!c || !target) return;
    const r = await this.run('save', () => (target === 'new' ? createSchedule(c.draft, c.id) : updateSchedule(target.id, target.revision ?? 0, c.draft, c.id)), sed('saved'));
    if (r) this.closeEditor();
    else this.checked = null; // a check is used once (or was refused): the next save needs a new one
  }

  private async runAssess() {
    if (!this.assessStation) return;
    const station = this.assessStation;
    const r = await this.run('assess', () => assessDraft(station, canonical(this.draft)), undefined, false);
    if (r) this.assessment = { station, data: r.data, previewId: r.baseline_preview_id ?? null };
  }

  private async baseline(kind: 'baseline_save' | 'baseline_clear') {
    const a = this.assessment;
    this.ask = null;
    if (!a) return;
    if (kind === 'baseline_save' && a.previewId) {
      const r = await this.run('baseline', () => saveBaseline(a.station, a.previewId!), sed('baselineSaved'));
      if (r) this.assessment = { ...a, previewId: null, data: { ...a.data, baseline: { ...a.data.baseline, state: 'unchanged', revision: r.data.revision } } };
    } else if (kind === 'baseline_clear' && a.data.baseline.revision) {
      const r = await this.run('baseline', () => clearBaseline(a.station, a.data.baseline.revision!), sed('baselineCleared'));
      if (r) this.assessment = { ...a, data: { ...a.data, baseline: { ...a.data.baseline, state: 'missing', revision: 0 } } };
    }
  }

  // ------------------------------------------------------------------ import / export

  private async pickFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > IMPORT_MAX) {
      this.note = { tone: 'not_sent', text: sed('importTooLarge'), code: null };
      return;
    }
    const text = await file.text();
    const r = await this.run('import', () => previewImport(text), undefined, false);
    if (r?.preview_id) {
      this.importing = { preview: r.data, previewId: r.preview_id, file: file.name };
      this.ask = { kind: 'import' }; // the integration's preview first, then the confirmation
    }
  }

  private async applyImport() {
    const imp = this.importing;
    this.ask = null;
    if (!imp) return;
    const r = await this.run('import', () => applyImport(imp.previewId));
    if (r) this.note = { tone: 'ok', text: sed('importDone', { n: r.data.length }), code: null };
    this.importing = null;
  }

  private async exportFile() {
    const doc = await this.run('export', () => exportLibrary(), undefined, false);
    if (!doc) return;
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schedules-${localNow(Date.now()).date}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ------------------------------------------------------------------ deploy

  private openDeploy(s: LibrarySchedule) {
    this.deploying = s;
    this.targets = [];
    this.progress = null;
    this.note = null;
  }

  private closeDeploy() {
    window.clearTimeout(this.pollTimer);
    this.deploying = null;
    this.targets = [];
    this.progress = null;
    this.ask = null;
  }

  private previousBindings(stationId: string): Bindings | null {
    const p = (this.plans ?? []).find((x) => x.station_id === stationId && x.draft_id === this.deploying?.id) as Plan | undefined;
    return p?.bindings ?? null;
  }

  private toggleTarget(stationId: string) {
    const s = this.deploying!;
    if (this.targets.some((t) => t.stationId === stationId)) this.targets = this.targets.filter((t) => t.stationId !== stationId);
    else
      this.targets = [
        ...this.targets,
        { stationId, readiness: null, bindings: defaultBindings(s.holidays?.length ?? 0, null, this.previousBindings(stationId)), phase: 'idle', previewId: null, impact: null, plan: null, error: null },
      ];
  }

  private patchTarget(stationId: string, patch: Partial<Target>) {
    this.targets = this.targets.map((t) => (t.stationId === stationId ? { ...t, ...patch } : t));
  }

  private async readTarget(t: Target) {
    this.patchTarget(t.stationId, { phase: 'reading', error: null });
    try {
      const r = await readReadiness(t.stationId);
      const fresh = this.previousBindings(t.stationId) ? t.bindings : defaultBindings(this.deploying?.holidays?.length ?? 0, r.data);
      this.patchTarget(t.stationId, { phase: 'idle', readiness: r.data, bindings: fresh });
    } catch (err) {
      this.patchTarget(t.stationId, { phase: 'error', error: outcomeOf(err) });
    }
  }

  private async previewTarget(t: Target) {
    const s = this.deploying!;
    this.patchTarget(t.stationId, { phase: 'previewing', error: null, previewId: null, impact: null });
    try {
      const r = await previewPlan(t.stationId, s.id, s.revision ?? 0, t.bindings);
      this.patchTarget(t.stationId, { phase: 'previewed', previewId: r.preview_id ?? null, impact: r.impact ?? null, plan: r.data });
    } catch (err) {
      this.patchTarget(t.stationId, { phase: 'error', error: outcomeOf(err) });
    }
  }

  private async previewAll() {
    for (const t of this.targets) {
      if (t.phase === 'previewed' || t.phase === 'saved') continue;
      if (Object.keys(bindingFaults(t.bindings, t.readiness)).length) continue;
      await this.previewTarget(this.targets.find((x) => x.stationId === t.stationId)!);
    }
  }

  /** Confirmed: save each previewed proposal, then deploy every saved one in ONE request, then follow the jobs. */
  private async deploy() {
    this.ask = null;
    this.busy = 'deploy';
    try {
      for (const t of this.targets.filter((x) => x.phase === 'previewed' && x.previewId)) {
        this.patchTarget(t.stationId, { phase: 'saving' });
        try {
          const r = await savePlan(t.previewId!);
          this.patchTarget(t.stationId, { phase: 'saved', plan: r.data, previewId: null });
        } catch (err) {
          this.patchTarget(t.stationId, { phase: 'error', error: outcomeOf(err), previewId: null });
        }
      }
      const saved = this.targets.filter((x) => x.phase === 'saved' && x.plan);
      this.changed();
      if (!saved.length) return;
      try {
        const r = await deployPlans(saved.map((x) => ({ plan_id: x.plan!.id, revision: x.plan!.revision ?? 1 })));
        this.progress = { results: r.results, jobs: Object.fromEntries(r.results.filter((x) => x.job).map((x) => [x.job!.id, x.job!])), done: false, writesEnabled: null };
        this.pollStarted = Date.now();
        void this.poll();
      } catch (err) {
        this.say(outcomeOf(err));
      }
    } finally {
      this.busy = null;
    }
  }

  private async poll() {
    const p = this.progress;
    if (!p) return;
    const ids = Object.keys(p.jobs);
    if (!ids.length) {
      this.progress = { ...p, done: true };
      return;
    }
    try {
      const r = await getJobs(ids);
      if (r.jobs) {
        const jobs = { ...p.jobs };
        for (const j of r.jobs) jobs[j.id] = j;
        this.progress = { ...p, jobs, done: r.done, writesEnabled: r.writes_enabled };
      }
    } catch {
      /* the next tick asks again; the lines keep the last known state */
    }
    if (!this.progress?.done && Date.now() - this.pollStarted < POLL_MAX_MS && this.deploying) this.pollTimer = window.setTimeout(() => void this.poll(), POLL_MS);
    else this.changed();
  }

  // ------------------------------------------------------------------ plans, claims, jobs

  private async loadClaims() {
    try {
      const r = await getClaims();
      this.claims = r.claims;
    } catch {
      this.claims = null;
    }
  }

  private async claimPreview(p: SchedulePlan) {
    const r = await this.run(`claim:${p.id}`, () => previewClaim(p.id, p.revision ?? 0), undefined, false);
    if (r?.preview_id) this.ask = { kind: 'claim', plan: p, previewId: r.preview_id, keys: (r.data.resource_keys ?? []).filter(Boolean) as string[] };
  }

  private async confirmAsk() {
    const a = this.ask;
    if (!a) return;
    this.ask = null;
    if (a.kind === 'save') return this.save();
    if (a.kind === 'import') return this.applyImport();
    if (a.kind === 'deploy') return this.deploy();
    if (a.kind === 'baseline_save' || a.kind === 'baseline_clear') return this.baseline(a.kind);
    if (a.kind === 'delete') {
      await this.run(`delete:${a.schedule.id}`, () => deleteSchedule(a.schedule.id, a.schedule.revision ?? 0), sed('deleted'));
      return;
    }
    if (a.kind === 'plan_recheck') {
      await this.run(`plan:${a.plan.id}`, () => recheckPlan(a.plan.id, a.plan.revision ?? 0));
      return;
    }
    if (a.kind === 'plan_delete') {
      await this.run(`plan:${a.plan.id}`, () => deletePlan(a.plan.id, a.plan.revision ?? 0));
      return;
    }
    if (a.kind === 'claim') {
      await this.run(`claim:${a.plan.id}`, () => confirmClaim(a.previewId));
      await this.loadClaims();
      return;
    }
    if (a.kind === 'release') {
      await this.run(`claim:${a.claim.plan_id}`, () => releaseClaim(a.claim.id, a.claim.revision ?? 0));
      await this.loadClaims();
      return;
    }
    if (a.kind === 'job') await this.run(`job:${a.job.id}`, () => jobAction(a.action, a.job.id, a.job.revision ?? 0));
  }

  protected firstUpdated() {
    void this.loadClaims();
  }

  // ------------------------------------------------------------------ render

  render() {
    const lib = this.library ?? [];
    const disabled = !this.live || !!this.busy;
    return html`<sw-card>
        <div class="block" data-se-library>
          <div class="bh">
            <h3>${sed('manageTitle')}</h3>
            <span class="n">${lib.length}</span>
            <span class="sp"></span>
            <wk-action-button tone="primary" icon="plus" data-se-new ?disabled=${disabled} @click=${() => this.openEditor('new')}>${sed('newSchedule')}</wk-action-button>
            <span>
              <input type="file" accept="application/json,.json" data-se-file @change=${(e: Event) => void this.pickFile(e)} ?disabled=${disabled} />
              <wk-action-button tone="quiet" icon="upload" data-se-import ?busy=${this.busy === 'import'} ?disabled=${disabled}
                @click=${(e: Event) => ((e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement).click()}>${sed('importFile')}</wk-action-button>
            </span>
            <wk-action-button tone="quiet" icon="download" data-se-export ?busy=${this.busy === 'export'} ?disabled=${!!this.busy || !lib.length} @click=${() => void this.exportFile()}>${sed('exportFile')}</wk-action-button>
          </div>
          ${this.live ? nothing : html`<p class="warn" role="status" data-se-stale>${sed('stale')}</p>`}
          ${this.writesOff ? html`<p class="warn" role="note" data-se-writes-off>${sed('deployWritesOff')}</p>` : nothing}
          ${this.note && !this.editing && !this.deploying ? this.renderNote() : nothing}
          <div class="rows">${lib.map((s) => this.renderScheduleRow(s))}</div>
        </div>
      </sw-card>
      ${this.renderPlans()} ${this.renderJobs()} ${this.renderEditor()} ${this.renderDeploy()} ${this.editing || this.deploying ? nothing : this.renderAsk()}`;
  }

  private renderNote() {
    const n = this.note!;
    return html`<p class="note" role="status" data-se-note=${n.tone} data-se-code=${n.code ?? ''} data-tone=${n.tone}>${n.text}</p>`;
  }

  private plansFor(id: string): SchedulePlan[] {
    return (this.plans ?? []).filter((p) => p.draft_id === id);
  }

  private renderScheduleRow(s: LibrarySchedule) {
    const plans = this.plansFor(s.id);
    const hours = Math.round((weekMinutes(draftOf(s).weekly) / 60) * 10) / 10;
    const disabled = !this.live || !!this.busy;
    return html`<div class="row" data-se-row=${s.id}>
      <div class="main">
        <span class="t">${s.name ?? '—'}</span>
        <span class="s">${[sed('summaryHours', { h: hours }), s.holidays?.length ? `${s.holidays.length} · ${sed('holidaysTitle')}` : '', plans.length ? plans.map((p) => this.stationName(p.station_id)).join(', ') : ''].filter(Boolean).join(' · ')}</span>
      </div>
      <div class="acts">
        <wk-action-button tone="quiet" icon="edit" data-se-edit=${s.id} ?disabled=${disabled} @click=${() => this.openEditor(s)}>${sed('edit')}</wk-action-button>
        <wk-action-button tone="quiet" icon="upload" data-se-deploy=${s.id} ?disabled=${disabled} @click=${() => this.openDeploy(s)}>${sed('deploy')}</wk-action-button>
        <wk-action-button tone="quiet" icon="trash" icon-only label=${sed('remove')} data-se-delete=${s.id} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'delete', schedule: s })}></wk-action-button>
      </div>
    </div>`;
  }

  private renderPlans() {
    const plans = this.plans ?? [];
    if (!plans.length) return nothing;
    const disabled = !this.live || !!this.busy;
    return html`<sw-card>
      <div class="block" data-se-plans>
        <div class="bh"><h3>${sed('plansTitle')}</h3><span class="n">${plans.length}</span></div>
        <div class="rows">
          ${plans.map((p) => {
            const claim = (this.claims ?? []).find((c) => c.plan_id === p.id) ?? null;
            const blockers = (p.report?.blockers ?? []).filter(Boolean) as string[];
            return html`<div class="row" data-se-plan=${p.id}>
              <div class="main">
                <span class="t">${p.name ?? '—'} · ${this.stationName(p.station_id)}</span>
                <span class="s" data-se-plan-blockers>${blockers.map((b) => reasonOf(b)).join(' · ')}</span>
              </div>
              ${claim ? html`<sw-badge kind="live" label=${sed('claimed')} data-se-claimed></sw-badge>` : nothing}
              <div class="acts">
                <wk-action-button tone="quiet" icon="refresh" data-se-recheck=${p.id} ?busy=${this.busy === `plan:${p.id}`} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'plan_recheck', plan: p })}>${sed('planRecheck')}</wk-action-button>
                ${claim
                  ? html`<wk-action-button tone="quiet" icon="unlock" data-se-release=${p.id} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'release', claim })}>${sed('planRelease')}</wk-action-button>`
                  : html`<wk-action-button tone="quiet" icon="lock" data-se-claim=${p.id} ?busy=${this.busy === `claim:${p.id}`} ?disabled=${disabled} @click=${() => void this.claimPreview(p)}>${sed('planClaim')}</wk-action-button>`}
                <wk-action-button tone="quiet" icon="trash" icon-only label=${sed('planDelete')} data-se-plan-delete=${p.id} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'plan_delete', plan: p })}></wk-action-button>
              </div>
            </div>`;
          })}
        </div>
      </div>
    </sw-card>`;
  }

  private renderJobs() {
    const jobs = [...(this.ops?.jobs ?? [])] as Job[];
    if (!jobs.length) return nothing;
    const disabled = !this.live || !!this.busy;
    return html`<sw-card>
      <div class="block" data-se-jobs>
        <div class="bh"><h3>${sed('jobsTitle')}</h3><span class="n">${jobs.length}</span></div>
        <div class="rows">
          ${jobs.map((j) => {
            const st = j.status ?? 'unknown';
            const active = isActive(st);
            const terminal = st === 'cancelled' || st === 'verified';
            return html`<div class="row" data-se-job=${j.id} data-status=${st}>
              <div class="main">
                <span class="t">${j.name ?? '—'} · ${this.stationName(j.station_id)}</span>
                <span class="s">${j.error ? reasonOf(j.error) : ((j.blockers ?? []).filter(Boolean) as string[]).map((b) => reasonOf(b)).join(' · ')}</span>
              </div>
              <sw-badge kind=${KIND[jobTone(st)]} label=${JOB_STATES[st] ?? st}></sw-badge>
              <div class="acts">
                ${active || terminal ? nothing : html`<wk-action-button tone="quiet" icon="refresh" data-se-job-check=${j.id} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'job', action: 'job_check', job: j })}>${sed('jobRecheck')}</wk-action-button>`}
                ${active || terminal ? nothing : html`<wk-action-button tone="quiet" icon="close" data-se-job-cancel=${j.id} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'job', action: 'job_cancel', job: j })}>${sed('jobCancel')}</wk-action-button>`}
                ${terminal ? html`<wk-action-button tone="quiet" icon="inbox" data-se-job-archive=${j.id} ?disabled=${disabled} @click=${() => (this.ask = { kind: 'job', action: 'job_archive', job: j })}>${sed('jobArchive')}</wk-action-button>` : nothing}
              </div>
            </div>`;
          })}
        </div>
      </div>
    </sw-card>`;
  }

  // ---- the editor drawer
  private renderEditor() {
    const e = this.editing;
    if (!e) return nothing;
    const all = faults(this.draft);
    const valid = all.length === 0;
    const checkedOk = this.checkValid();
    const plans = e === 'new' ? [] : this.plansFor(e.id);
    const heading = e === 'new' ? sed('editorNew') : sed('editorEdit', { name: e.name ?? '' });
    const busy = !!this.busy;
    return html`<sw-drawer modal open heading=${heading} data-se-editor=${e === 'new' ? 'new' : e.id} @close=${(ev: Event) => ev.target === ev.currentTarget && this.closeEditor()}>
      <wk-schedule-draft-form .draft=${this.draft} .faults=${all} ?narrow=${this.narrow} today=${localNow(Date.now()).date} ?disabled=${busy}
        @draft-change=${(ev: CustomEvent<Draft>) => (this.draft = ev.detail)}></wk-schedule-draft-form>
      <div class="panel" data-se-check>
        <h4><sw-icon name="check" size=${14}></sw-icon>${sed('checkTitle')}</h4>
        <div class="line">
          <label class="f">${sed('checkAt')}<input type="date" lang=${dateInputLang()} .value=${this.checkAt.date} @change=${(ev: Event) => (this.checkAt = { ...this.checkAt, date: (ev.target as HTMLInputElement).value })} /></label>
          <label class="f">&nbsp;<input type="time" lang=${dateInputLang()} step="60" .value=${this.checkAt.time} @change=${(ev: Event) => (this.checkAt = { ...this.checkAt, time: (ev.target as HTMLInputElement).value })} /></label>
          <wk-action-button icon="check" data-se-check-run ?busy=${this.busy === 'check'} ?disabled=${busy || !valid || !this.live} @click=${() => void this.runCheck()}>${sed('checkRun')}</wk-action-button>
        </div>
        ${this.checked
          ? html`<span class="result" role="status" data-se-check-result data-ok=${String(!!this.checked.result.within_window)}>${this.checkLine(this.checked.result)}${checkedOk ? '' : ` · ${sed('checkStale')}`}</span>`
          : html`<span class="s">${sed('checkNeeded')}</span>`}
      </div>
      ${this.renderAssess(valid)}
      ${this.note ? this.renderNote() /* next to the save button: on a phone the sheet is scrolled to its end when a save answers */ : nothing}
      ${plans.length ? html`<p class="warn" data-se-affects>${sed('affectsPlans', { stations: plans.map((p) => this.stationName(p.station_id)).join(', ') })}</p>` : nothing}
      <div slot="footer" class="foot">
        <wk-action-button data-se-cancel @click=${() => this.closeEditor()}>${sed('cancel')}</wk-action-button>
        <wk-action-button tone="primary" icon="check" data-se-save ?busy=${this.busy === 'save'} ?disabled=${busy || !valid || !checkedOk || !this.live} @click=${() => (this.ask = { kind: 'save' })}>${sed('save')}</wk-action-button>
      </div>
      ${this.renderAsk()}
    </sw-drawer>`;
  }

  private checkLine(r: CheckResult): string {
    const source = r.source === 'holiday' ? sed('sourceHoliday', { name: r.holiday ?? '' }) : sed('sourceWeekly');
    return sed(r.within_window ? 'checkOpen' : 'checkClosed', { date: r.date ?? '', time: r.time ?? '', source });
  }

  private renderAssess(valid: boolean) {
    const online = this.stations.filter((s) => s.online);
    const a = this.assessment;
    const busy = !!this.busy;
    return html`<div class="panel" data-se-assess>
      <h4><sw-icon name="cpu" size=${14}></sw-icon>${sed('assessTitle')}</h4>
      <div class="line">
        <div class="f"><span>${sed('pickStation')}</span>
          <sw-dropdown data-se-assess-station label=${sed('pickStation')} .value=${this.assessStation}
            .items=${online.map((s) => ({ id: s.id, label: s.name }))}
            @change=${(ev: CustomEvent<DropdownChange>) => (this.assessStation = ev.detail.id)}></sw-dropdown>
        </div>
        <wk-action-button icon="search" data-se-assess-run ?busy=${this.busy === 'assess'} ?disabled=${busy || !valid || !this.assessStation || !this.live} @click=${() => void this.runAssess()}>${sed('assessRun')}</wk-action-button>
      </div>
      ${this.busy === 'assess' ? html`<span class="s">${sed('reading')}</span>` : nothing}
      ${a
        ? html`<span class="result" role="status" data-se-assess-state=${a.data.assessment.state ?? 'unknown'}>${a.data.assessment.state === 'fits' ? sed('assessFits') : a.data.assessment.state === 'exceeds' ? sed('assessExceeds') : sed('assessUnknown')}</span>
            <ul class="plain">${a.data.assessment.limits.map((l) => html`<li data-state=${l.state ?? ''}>${sed('limitRow', { key: LIMIT_NAMES[l.key ?? ''] ?? l.key ?? '', needed: l.needed ?? '—', available: l.available ?? '—' })}</li>`)}</ul>
            <span class="s" data-se-baseline=${a.data.baseline.state ?? ''}>${sed('baselineTitle')} · ${sed('baselineState', { state: BASELINE_STATES[a.data.baseline.state ?? ''] ?? a.data.baseline.state ?? '—' })}</span>
            <div class="line">
              ${a.previewId ? html`<wk-action-button tone="quiet" icon="bookmark" data-se-baseline-save ?disabled=${busy} @click=${() => (this.ask = { kind: 'baseline_save' })}>${sed('baselineSave')}</wk-action-button>` : nothing}
              ${a.data.baseline.revision ? html`<wk-action-button tone="quiet" icon="trash" data-se-baseline-clear ?disabled=${busy} @click=${() => (this.ask = { kind: 'baseline_clear' })}>${sed('baselineClear')}</wk-action-button>` : nothing}
            </div>`
        : nothing}
    </div>`;
  }

  // ---- the deploy drawer
  private renderDeploy() {
    const s = this.deploying;
    if (!s) return nothing;
    const ready = this.targets.filter((t) => t.phase === 'previewed');
    const busy = !!this.busy || this.targets.some((t) => t.phase === 'reading' || t.phase === 'previewing' || t.phase === 'saving');
    return html`<sw-drawer modal open heading=${sed('deployTitle', { name: s.name ?? '' })} data-se-deploy-drawer=${s.id} @close=${(ev: Event) => ev.target === ev.currentTarget && this.closeDeploy()}>
      ${this.note ? this.renderNote() : nothing}
      ${this.progress ? this.renderProgress() : html`
        ${this.writesOff ? html`<p class="warn" role="note" data-se-deploy-warning>${sed('deployWritesOff')}</p>` : nothing}
        <div class="panel" data-se-targets>
          <h4><sw-icon name="building" size=${14}></sw-icon>${sed('deployStep1')}</h4>
          ${this.stations.length ? nothing : html`<span class="s">${sed('noStations')}</span>`}
          <div class="picks">
            ${this.stations.map((st) => {
              const on = this.targets.some((t) => t.stationId === st.id);
              return html`<label class="pick" ?data-on=${on} ?data-off=${!st.online} data-se-pick=${st.id}>
                <input type="checkbox" .checked=${on} ?disabled=${!st.online || busy} @change=${() => this.toggleTarget(st.id)} />
                ${st.name}${st.online ? '' : ` · ${sed('offline')}`}
              </label>`;
            })}
          </div>
          ${this.targets.length ? html`<span class="s">${sed('stationsPicked', { n: this.targets.length })}</span>` : nothing}
        </div>
        ${this.targets.map((t) => this.renderTarget(t, s, busy))}
      `}
      <div slot="footer" class="foot">
        <wk-action-button data-se-deploy-close @click=${() => this.closeDeploy()}>${this.progress ? sed('close') : sed('cancel')}</wk-action-button>
        ${this.progress
          ? nothing
          : html`<wk-action-button icon="search" data-se-preview-all ?disabled=${busy || !this.targets.length || !this.live} @click=${() => void this.previewAll()}>${sed('previewAll')}</wk-action-button>
              <wk-action-button tone="primary" icon="upload" data-se-deploy-go ?busy=${this.busy === 'deploy'} ?disabled=${busy || !ready.length || !this.live} @click=${() => (this.ask = { kind: 'deploy' })}>${sed('deployNow')}${ready.length ? ` (${ready.length})` : ''}</wk-action-button>`}
      </div>
      ${this.renderAsk()}
    </sw-drawer>`;
  }

  private renderTarget(t: Target, s: LibrarySchedule, busy: boolean) {
    const holidays = s.holidays?.length ?? 0;
    const bad = bindingFaults(t.bindings, t.readiness);
    const field = (key: string, label: string, kind: string, value: number | null, set: (v: number) => Bindings) => {
      const range = rangeOf(t.readiness, kind);
      return html`<label class="f">${label}${range ? html` <span class="s">${sed('range', { a: range[0], b: range[1] })}</span>` : nothing}
        <input type="number" inputmode="numeric" min="1" max="65535" .value=${value === null ? '' : String(value)} aria-invalid=${String(!!bad[key])} data-se-slot=${key}
          ?disabled=${busy || t.phase === 'saved'} @change=${(ev: Event) => this.patchTarget(t.stationId, { bindings: set(Number((ev.target as HTMLInputElement).value)), phase: 'idle', previewId: null, impact: null })} />
      </label>`;
    };
    return html`<div class="target" data-se-target=${t.stationId} data-phase=${t.phase}>
      <div class="bh"><h3>${this.stationName(t.stationId)}</h3><span class="sp"></span>
        <wk-action-button tone="quiet" icon="cpu" data-se-read=${t.stationId} ?busy=${t.phase === 'reading'} ?disabled=${busy || t.phase === 'saved'} @click=${() => void this.readTarget(t)}>${sed('readStation')}</wk-action-button>
      </div>
      <span class="s">${sed('slotsHint')}</span>
      <div class="line">
        ${field('template', sed('slotTemplate'), 'template', t.bindings.template, (v) => ({ ...t.bindings, template: v }))}
        ${field('weekly', sed('slotWeekly'), 'weekly', t.bindings.weekly, (v) => ({ ...t.bindings, weekly: v }))}
        ${holidays ? field('holiday_group', sed('slotGroup'), 'holiday_group', t.bindings.holiday_group, (v) => ({ ...t.bindings, holiday_group: v })) : nothing}
        ${t.bindings.holidays.map((h, i) => field(`holidays.${i}`, sed('slotHoliday', { n: i + 1 }), 'holiday', h, (v) => ({ ...t.bindings, holidays: t.bindings.holidays.map((x, k) => (k === i ? v : x)) })))}
      </div>
      ${Object.values(bad).length ? html`<span class="s" role="alert" data-se-slot-fault>${reasonOf(Object.values(bad)[0])}</span>` : nothing}
      ${t.phase === 'reading' || t.phase === 'previewing' ? html`<span class="s line"><span class="spin" aria-hidden="true"></span>${sed('reading')}</span>` : nothing}
      ${t.error ? html`<p class="note" role="status" data-tone=${t.error.status} data-se-target-error=${t.error.code ?? ''}>${t.error.status === 'refused' ? sed('refusedBy', { reason: reasonOf(t.error.code) }) : t.error.status === 'not_sent' ? sed('notSent', { reason: t.error.message }) : sed('unknownOutcome')}</p>` : nothing}
      ${t.impact ? this.renderImpact(t.impact) : nothing}
      ${t.phase !== 'previewed' && t.phase !== 'saved'
        ? html`<div><wk-action-button icon="search" data-se-preview=${t.stationId} ?busy=${t.phase === 'previewing'} ?disabled=${busy || Object.keys(bad).length > 0 || !this.live} @click=${() => void this.previewTarget(t)}>${sed('previewRun')}</wk-action-button></div>`
        : nothing}
    </div>`;
  }

  private renderImpact(i: Impact) {
    const doors = i.station?.doors ?? [];
    const people = i.people;
    const resources = (i.resources ?? []).filter((r) => r.state && r.state !== 'matches' || r.externally_referenced || r.active);
    const blockers = (i.blockers ?? []).filter(Boolean) as string[];
    return html`<div class="panel" data-se-impact>
      <h4><sw-icon name="target" size=${14}></sw-icon>${sed('impactTitle')}</h4>
      <ul class="plain">
        <li data-se-impact-station>${sed('impactStation', { name: i.station?.name ?? i.station?.id ?? '' })}</li>
        <li data-se-impact-doors>${doors.length ? sed('impactDoors', { doors: doors.map((d) => d.name ?? `#${d.index}`).join(', ') }) : sed('impactNoDoors')}</li>
        <li data-se-impact-people>${people && people.state === 'complete'
          ? sed('impactPeople', { explicit: people.explicit ?? '—', implicit: people.implicit ?? '—', read: people.read ?? '—' })
          : sed('impactPeopleUnknown')}</li>
      </ul>
      ${resources.length
        ? html`<h4>${sed('conflictsTitle')}</h4><ul class="plain" data-se-conflicts>${resources.map(
            (r) => html`<li>${sed('resourceRow', { kind: KIND_NAMES[r.kind ?? ''] ?? r.kind ?? '', id: r.id ?? '—', state: RES_STATES[r.state ?? ''] ?? r.state ?? '' })}${r.externally_referenced ? ` · ${sed('externalRef')}` : ''}${r.active ? ` · ${sed('activeRes')}` : ''}</li>`,
          )}</ul>`
        : nothing}
      ${blockers.length ? html`<h4>${sed('blockersTitle')}</h4><ul class="plain" data-se-blockers>${blockers.map((b) => html`<li data-code=${b}>${reasonOf(b)}</li>`)}</ul>` : nothing}
    </div>`;
  }

  private renderProgress() {
    const p = this.progress!;
    return html`<div class="panel prog" data-se-progress data-done=${String(p.done)}>
      <h4>${p.done ? html`<sw-icon name="check" size=${14}></sw-icon>${sed('progressDone')}` : html`<span class="spin" aria-hidden="true"></span>${sed('progressRunning')}`}</h4>
      ${p.writesEnabled === false ? html`<p class="warn" data-se-writes-off>${sed('writesOff')}</p>` : nothing}
      ${p.results.map((r) => {
        const job = r.job ? p.jobs[r.job.id] ?? r.job : null;
        const status = job ? JOB_STATES[job.status ?? ''] ?? job.status ?? '' : sed(`st_${r.status}` as 'st_queued');
        // a failed job says why it failed; the creation-time blockers would only blur that
        const why = job ? (job.error ? reasonOf(job.error) : ((job.blockers ?? []).filter(Boolean) as string[]).map((b) => reasonOf(b)).join(' · ')) : reasonOf(r.code) || r.reason || '';
        const tone = job ? jobTone(job.status) : deployTone(r);
        return html`<div class="row" data-se-result=${r.station?.id ?? r.plan_id} data-status=${job?.status ?? r.status}>
          <div class="main"><span class="t">${r.station?.name ?? this.stationName(r.station?.id)}</span><span class="s">${why}</span></div>
          ${job && isActive(job.status) ? html`<span class="spin" aria-hidden="true"></span>` : nothing}
          <sw-badge kind=${KIND[tone]} label=${status}></sw-badge>
        </div>`;
      })}
    </div>`;
  }

  // ---- confirmations (inside the open drawer when there is one: everything outside the top layer is inert)
  private renderAsk() {
    const a = this.ask;
    if (!a) return nothing;
    let title = '';
    let body: unknown = nothing;
    const danger = a.kind === 'delete' || a.kind === 'plan_delete';
    switch (a.kind) {
      case 'save': {
        const e = this.editing;
        const plans = e && e !== 'new' ? this.plansFor(e.id) : [];
        title = sed('confirmSaveTitle');
        body = html`<p class="sentence" data-se-sentence>${e === 'new' ? sed('confirmSaveNew', { name: this.draft.name }) : sed('confirmSaveEdit', { name: this.draft.name, rev: ((e as LibrarySchedule)?.revision ?? 0) + 1 })}</p>
          ${plans.length ? html`<p class="sentence">${sed('affectsPlans', { stations: plans.map((p) => this.stationName(p.station_id)).join(', ') })}</p>` : nothing}`;
        break;
      }
      case 'delete': {
        const plans = this.plansFor(a.schedule.id);
        title = sed('confirmDeleteTitle');
        body = html`<p class="sentence" data-se-sentence>${sed('confirmDelete', { name: a.schedule.name ?? '' })}</p>
          ${plans.length ? html`<p class="sentence">${sed('affectsPlans', { stations: plans.map((p) => this.stationName(p.station_id)).join(', ') })}</p>` : nothing}`;
        break;
      }
      case 'import': {
        const imp = this.importing!;
        title = sed('importTitle');
        body = html`<p class="sentence" data-se-sentence>${sed('importPreview', { n: imp.preview.count ?? 0, c: imp.preview.name_collisions ?? 0 })}</p>
          <ul class="plain">${imp.preview.items.map((i) => html`<li>${sed('importRow', { name: i.name ?? '—', p: i.weekly_periods ?? 0, h: i.holidays ?? 0 })}</li>`)}</ul>
          <p class="sentence s">${sed('importAppend')}</p>`;
        break;
      }
      case 'deploy': {
        const ready = this.targets.filter((t) => t.phase === 'previewed');
        title = sed('confirmDeployTitle', { n: ready.length });
        body = html`<p class="sentence" data-se-sentence>${sed('confirmDeploy')}</p>
          ${this.writesOff ? html`<p class="sentence warn" data-se-confirm-writes-off>${sed('confirmDeployWritesOff')}</p>` : nothing}
          <ul class="plain">${ready.map((t) => html`<li>${this.stationName(t.stationId)} · ${(t.impact?.station?.doors ?? []).map((d) => d.name).join(', ')}${t.impact?.people?.explicit != null ? ` · ${sed('impactPeople', { explicit: t.impact.people.explicit, implicit: t.impact.people.implicit ?? '—', read: t.impact.people.read ?? '—' })}` : ''}</li>`)}</ul>`;
        break;
      }
      case 'baseline_save':
      case 'baseline_clear':
        title = a.kind === 'baseline_save' ? sed('baselineSave') : sed('baselineClear');
        body = html`<p class="sentence" data-se-sentence>${this.stationName(this.assessment?.station)}</p>`;
        break;
      case 'plan_recheck':
        title = sed('planRecheck');
        body = html`<p class="sentence" data-se-sentence>${sed('confirmRecheck')} (${this.stationName(a.plan.station_id)})</p>`;
        break;
      case 'plan_delete':
        title = sed('planDelete');
        body = html`<p class="sentence" data-se-sentence>${sed('confirmPlanDelete', { station: this.stationName(a.plan.station_id) })}</p>`;
        break;
      case 'claim':
        title = sed('confirmClaimTitle');
        body = html`<p class="sentence" data-se-sentence>${sed('confirmClaim', { keys: a.keys.join(', '), station: this.stationName(a.plan.station_id) })}</p>`;
        break;
      case 'release':
        title = sed('planRelease');
        body = html`<p class="sentence" data-se-sentence>${sed('confirmRelease')}</p>`;
        break;
      case 'job': {
        const name = { job_check: sed('jobRecheck'), job_cancel: sed('jobCancel'), job_archive: sed('jobArchive') }[a.action];
        title = name;
        body = html`<p class="sentence" data-se-sentence>${sed('confirmJob', { action: name, station: this.stationName(a.job.station_id) })}</p>`;
        break;
      }
    }
    return html`<sw-dialog open heading=${title} data-se-confirm=${a.kind} @close=${(e: Event) => e.target === e.currentTarget && (this.ask = null)}>
      ${body}
      <div slot="footer">
        <wk-action-button data-se-confirm-cancel @click=${() => (this.ask = null)}>${sed('cancel')}</wk-action-button>
        <wk-action-button tone=${danger ? 'danger' : 'primary'} data-se-confirm-send ?disabled=${!this.live} @click=${() => void this.confirmAsk()}>${sed('confirmSend')}</wk-action-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-schedule-library': WkScheduleLibrary;
  }
}

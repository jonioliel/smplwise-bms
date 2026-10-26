import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-icon';
import { describeError } from '../api/client';
import {
  applyBatch,
  bulkSettings,
  cancelJob,
  confirmJob,
  confirmVerified,
  dryRun,
  exportPeopleCsv,
  idempotencyKey,
  setBulkEnabled,
  setWiskeyCsvEnabled,
  stageEdit,
  stageImport,
  templateCsv,
  verifiedResult,
  verifyImport,
  type BulkJob,
  type BulkSettings,
  type CsvOperation,
  type DryRunRow,
  type VerifiedPreview,
} from '../api/bulk-people';
import { blockerKey, canConfirm, expiryText, pageCount, pageOf, resultWords, shouldPoll, verifyMode, POLL_MS } from '../access-control/people-csv-verify-logic';
import { attention, codesText, editRequest, EMPTY_EDIT, precheckFile, previewCounts, shouldContinue, stepOf, valueText, type EditForm } from '../access-control/bulk-people-logic';
import { bt, btDynamic, btLang } from '../i18n/bulk-people';
import { dateInputLang } from '../api/day-format';

export interface BulkStation {
  id: string;
  name: string;
  locks: number[];
}

/**
 * CR-BULKPEOPLE-295: the bulk people dialog of the people screen - import from a CSV file, export, and bulk edit of the selected
 * people. Every step is the server's: upload -> the validation report -> preview (never writes) -> a system administrator's confirm
 * (the typed row count) -> writing in bounded batches, resumable. No PIN, card or photo is ever read from or written to a file.
 * Events: `close`, `changed` (people may have changed: the list reloads).
 */
@customElement('sw-bulk-people-dialog')
export class SwBulkPeopleDialog extends LitElement {
  @property({ type: Boolean }) open = false;
  @property() mode: 'import' | 'edit' = 'import';
  @property({ attribute: false }) personIds: string[] = [];
  @property({ attribute: false }) stations: BulkStation[] = [];
  @property({ attribute: false }) groups: { id: string; label: string }[] = [];

  @state() private settings: BulkSettings | null = null;
  @state() private job: BulkJob | null = null;
  @state() private rows: DryRunRow[] = [];
  @state() private busy = false;
  @state() private error = '';
  @state() private note = '';
  @state() private typed = '';
  @state() private form: EditForm = { ...EMPTY_EDIT };
  @state() private addStation = '';
  @state() private addRelays: number[] = [1];
  // WKR5ADOPT-295: the verified preview (the file stays in memory here only to be shown to the server again; it is never stored)
  private file: File | null = null;
  @state() private vp: VerifiedPreview | null = null;
  @state() private op: CsvOperation | null = null;
  @state() private vpage = 0;
  @state() private vtyped = '';

  static styles = css`
    :host {
      display: contents;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .muted {
      color: var(--sw-text-muted);
    }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .line.warn {
      background: var(--sw-warning-bg, var(--sw-surface-2));
    }
    .line.bad {
      background: var(--sw-danger-bg, var(--sw-surface-2));
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      font-variant-numeric: tabular-nums;
    }
    .rows {
      max-block-size: 320px;
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(64px, auto) 1fr;
      gap: 8px;
      padding: 8px 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .diff {
      display: grid;
      grid-template-columns: auto 1fr 1fr;
      gap: 2px 10px;
      margin-block-start: 4px;
    }
    .diff .k {
      color: var(--sw-text-muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    input,
    select {
      font: inherit;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      min-block-size: 36px;
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }
    progress {
      inline-size: 100%;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .vlist {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .vrow {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .vrow:last-child {
      border-block-end: 0;
    }
  `;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) void this.load();
  }

  private async load(): Promise<void> {
    this.job = null;
    this.rows = [];
    this.error = '';
    this.note = '';
    this.typed = '';
    this.file = null;
    this.vp = null;
    this.op = null;
    this.vpage = 0;
    this.vtyped = '';
    this.form = { ...EMPTY_EDIT };
    try {
      this.settings = await bulkSettings();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private close(): void {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    this.busy = true;
    this.error = '';
    try {
      return await fn();
    } catch (err) {
      this.error = describeError(err);
      return undefined;
    } finally {
      this.busy = false;
    }
  }

  private save(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.settings) return;
    const first = (await file.slice(0, 2048).text()).split(/\r?\n/, 1)[0] ?? '';
    const bad = precheckFile(file.name, file.size, first, this.settings.limits.max_file_bytes);
    if (bad === 'secret_column') {
      this.error = bt('no_secrets');
      return;
    }
    if (bad) {
      this.error = bt('file_hint', { rows: this.settings.limits.max_rows, kb: Math.round(this.settings.limits.max_file_bytes / 1024) });
      return;
    }
    const out = await this.run(() => stageImport(file, idempotencyKey()));
    if (out) {
      this.job = out.job;
      this.file = file;
    }
  }

  // ---- WKR5ADOPT-295 (W-006): WisKey's verified preview -> the typed count -> start -> the completion read. Every refusal is the server's.
  private async verify(): Promise<void> {
    if (!this.job || !this.file) return;
    const file = this.file;
    const out = await this.run(() => verifyImport(this.job!.id, file));
    if (out) {
      this.job = out.job;
      this.vp = out.preview;
      this.vpage = 0;
      this.vtyped = '';
    }
  }

  private async confirmVerifiedStep(): Promise<void> {
    if (!this.job || !this.vp || !canConfirm(this.vp, this.vtyped, Date.now())) return;
    const id = this.job.id;
    const out = await this.run(() => confirmVerified(id, this.vp!.preview_digest, this.vtyped));
    if (!out) return;
    this.op = out.operation;
    this.vp = null;
    this.vtyped = '';
    await this.pollResult(id);
  }

  private async pollResult(id: string): Promise<void> {
    let polls = 0;
    while (this.open && shouldPoll(this.op, polls)) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      polls += 1;
      const out = await this.run(() => verifiedResult(id));
      if (!out) return;
      this.op = out.operation;
    }
    if (this.op?.state === 'finished') this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
  }

  private async enableVerify(): Promise<void> {
    const out = await this.run(() => setWiskeyCsvEnabled('on'));
    if (out && this.settings) this.settings = { ...this.settings, wiskey_csv: out };
  }

  private async stageEdit(): Promise<void> {
    const req = editRequest(this.personIds, this.form);
    if (!req) {
      this.error = bt('edit_nochange');
      return;
    }
    const out = await this.run(() => stageEdit(req, idempotencyKey()));
    if (out) {
      this.job = out.job;
      await this.preview();
    }
  }

  private async preview(): Promise<void> {
    if (!this.job) return;
    const out = await this.run(() => dryRun(this.job!.id));
    if (out) {
      this.job = out.job;
      this.rows = out.rows;
    }
  }

  private async confirm(): Promise<void> {
    if (!this.job?.plan_digest) return;
    const out = await this.run(() => confirmJob(this.job!.id, this.job!.plan_digest!, this.typed));
    if (out) this.job = out.job;
  }

  private async apply(): Promise<void> {
    if (!this.job) return;
    let next: BulkJob | undefined = this.job;
    do {
      const out = await this.run(() => applyBatch(next!.id));
      next = out?.job;
      if (next) this.job = next;
    } while (next && shouldContinue(next) && this.open);
    this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
  }

  private async cancel(): Promise<void> {
    if (!this.job) return;
    const out = await this.run(() => cancelJob(this.job!.id));
    if (out) this.job = null;
    this.rows = [];
    this.vp = null;
    this.op = null;
    this.file = null;
  }

  private async exportFile(): Promise<void> {
    const out = await this.run(() => exportPeopleCsv());
    if (out) {
      this.save(out.blob, 'access-people.csv');
      this.note = bt('export_done', { n: out.rows ?? 0 });
    }
  }

  private async template(): Promise<void> {
    const out = await this.run(() => templateCsv());
    if (out) this.save(out.blob, 'people-template.csv');
  }

  private async enable(): Promise<void> {
    const out = await this.run(() => setBulkEnabled('on'));
    if (out) this.settings = { ...this.settings!, ...out };
  }

  render(): TemplateResult {
    const heading = this.mode === 'edit' ? bt('edit_title', { n: this.personIds.length }) : bt('title');
    return html`<sw-dialog wide ?open=${this.open} ?locked=${this.busy} heading=${heading} @close=${(e: Event) => { e.stopPropagation(); this.close(); }} data-bulk-dialog>
      <div class="stack">
        ${this.error ? html`<div class="line bad" role="alert" data-bulk-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>` : nothing}
        ${this.note ? html`<div class="line" role="status" data-bulk-note><sw-icon name="check" size=${16}></sw-icon><span>${this.note}</span></div>` : nothing}
        ${this.body()}
      </div>
      <sw-button slot="footer" variant="ghost" ?disabled=${this.busy} @click=${() => this.close()}>${bt('close')}</sw-button>
    </sw-dialog>`;
  }

  private body(): TemplateResult {
    const s = this.settings;
    if (!s) return html`<div class="muted" role="status">…</div>`;
    if (s.enabled !== 'on') {
      return html`<div class="line warn" data-bulk-off><sw-icon name="warning" size=${16}></sw-icon><div><strong>${bt('off_title')}</strong><div class="muted">${bt('off_text')}</div></div></div>
        ${s.system_admin ? html`<div class="actions"><sw-button variant="primary" data-bulk-enable ?disabled=${this.busy} @click=${() => void this.enable()}>${bt('off_enable')}</sw-button></div>` : nothing}`;
    }
    const permit = s.go_live_permitted ? nothing : html`<div class="line warn" data-bulk-permit><sw-icon name="clock" size=${16}></sw-icon><span>${bt('permit_missing')}</span></div>`;
    if (this.job) return html`${permit}${this.jobView(this.job)}`;
    if (this.mode === 'edit') return html`${permit}${this.editForm()}`;
    return html`${permit}
      <div class="muted">${bt('no_secrets')}</div>
      ${s.may_export ? html`<div class="actions"><sw-button icon="download" data-bulk-export ?disabled=${this.busy} @click=${() => void this.exportFile()}>${bt('export_btn')}</sw-button></div>
        <div class="muted">${bt('export_hint')}</div>` : nothing}
      ${s.may_import ? html`<div class="actions">
          <sw-button variant="ghost" icon="download" data-bulk-template ?disabled=${this.busy} @click=${() => void this.template()}>${bt('template')}</sw-button>
          <label class="file"><span>${bt('choose_file')}</span><input type="file" accept=".csv,text/csv" data-bulk-file ?disabled=${this.busy} @change=${(e: Event) => void this.onFile(e)}></label>
        </div>
        <div class="muted">${bt('file_hint', { rows: s.limits.max_rows, kb: Math.round(s.limits.max_file_bytes / 1024) })}</div>
        ${s.system_admin && s.wiskey_csv && s.wiskey_csv.enabled !== 'on' ? html`<div class="actions"><sw-button variant="ghost" data-verify-enable ?disabled=${this.busy} @click=${() => void this.enableVerify()}>${bt('v_enable')}</sw-button></div>` : nothing}` : nothing}
      ${this.busy ? html`<div class="muted" role="status">${bt('uploading')}</div>` : nothing}`;
  }

  private jobView(job: BulkJob): TemplateResult {
    const step = stepOf(job);
    if (step === 'report') {
      const bad = job.report.filter((e) => e.status !== 'ok');
      return html`<strong>${bt('report_title')}</strong>
        <div class="chips" data-bulk-report><span class="chip">${bt('report_ok', { n: job.counts.ok })}</span><span class="chip">${bt('report_skip', { n: job.counts.skip })}</span><span class="chip">${bt('report_error', { n: job.counts.error })}</span></div>
        ${bad.length ? html`<div class="rows">${bad.map((e) => html`<div class="row" data-bulk-row=${e.row}><span>${bt('row', { n: e.row })}</span><span>${codesText(e)}</span></div>`)}</div>` : nothing}
        ${this.verifySection(job)}`;
    }
    if (step === 'preview') {
      const c = previewCounts(this.rows);
      const writes = job.writes ?? 0;
      return html`<strong>${bt('dry_title')}</strong>
        <div class="chips" data-bulk-preview><span class="chip">${bt('will_create', { n: c.create })}</span><span class="chip">${bt('will_update', { n: c.update })}</span>
          <span class="chip">${bt('unchanged', { n: c.unchanged })}</span><span class="chip">${bt('errors', { n: c.error })}</span></div>
        <div class="rows">${this.rows.filter((r) => r.status !== 'unchanged').map((r) => this.previewRow(r))}</div>
        ${writes > 0
          ? this.settings?.system_admin
            ? html`<strong>${bt('confirm_title')}</strong><div>${bt('confirm_text', { n: writes })}</div>
              <div class="actions"><label><span class="muted">${bt('confirm_label')}</span><input inputmode="numeric" data-bulk-typed .value=${this.typed} @input=${(e: Event) => (this.typed = (e.target as HTMLInputElement).value)}></label>
                <sw-button variant="primary" data-bulk-confirm ?disabled=${this.busy || this.typed.trim() !== String(writes)} @click=${() => void this.confirm()}>${bt('confirm_btn')}</sw-button></div>`
            : html`<div class="line" data-bulk-admin-only><sw-icon name="clock" size=${16}></sw-icon><span>${bt('confirm_admin_only')}</span></div>`
          : nothing}
        <div class="actions"><sw-button variant="ghost" ?disabled=${this.busy} @click=${() => void this.cancel()}>${bt('cancel')}</sw-button></div>`;
    }
    if (step === 'apply' || step === 'done') {
      const p = job.progress;
      const need = attention(job.results);
      return html`<strong>${step === 'done' ? bt('done_title') : bt('apply')}</strong>
        <progress max=${Math.max(1, p.total)} value=${p.done} aria-label=${bt('applying', { done: p.done, total: p.total })}></progress>
        <div role="status" data-bulk-progress>${bt('applying', { done: p.done, total: p.total })}</div>
        <div class="chips">${Object.entries(job.outcomes).map(([o, n]) => html`<span class="chip">${btDynamic(`outcome_${o}`, 'code_generic')} · ${n}</span>`)}</div>
        ${job.stalled ? html`<div class="line warn" data-bulk-stalled><sw-icon name="pause" size=${16}></sw-icon><span>${bt('stalled')}</span></div>`
          : job.state === 'paused' ? html`<div class="line" data-bulk-paused><sw-icon name="pause" size=${16}></sw-icon><span>${bt('paused')}</span></div>` : nothing}
        ${need.length ? html`<div class="rows">${need.map((r) => html`<div class="row" data-bulk-result=${r.row}><span>${bt('row', { n: r.row })}</span>
          <span>${btDynamic(`outcome_${r.outcome}`, 'code_generic')}${r.code ? html` · ${btDynamic(`code_${r.code}`, 'code_generic')}` : nothing}</span></div>`)}</div>` : nothing}
        ${need.some((r) => r.outcome === 'unknown') ? html`<div class="muted">${bt('unknown_hint')}</div>` : nothing}
        ${step === 'apply' ? html`<div class="actions"><sw-button variant="primary" icon="play" data-bulk-apply ?disabled=${this.busy || !job.go_live_permitted} @click=${() => void this.apply()}>${job.state === 'confirmed' ? bt('apply') : bt('resume')}</sw-button></div>` : nothing}`;
    }
    return html`<div class="muted">${bt('code_generic')}</div>`;
  }

  private verifySection(job: BulkJob): TemplateResult {
    const mode = verifyMode(this.settings);
    const cancel = html`<sw-button variant="ghost" ?disabled=${this.busy} @click=${() => void this.cancel()}>${bt('cancel')}</sw-button>`;
    if (this.op) return this.resultView(this.op);
    if (mode === 'off') {
      return html`<div class="actions"><sw-button variant="primary" data-bulk-dry ?disabled=${this.busy || job.counts.ok === 0} @click=${() => void this.preview()}>${bt('dry_run')}</sw-button>${cancel}</div>`;
    }
    if (mode === 'blocked') {
      return html`<div class="chips" data-verify-blockers>${(this.settings?.wiskey_csv?.blockers ?? []).map((c) => html`<span class="chip">${bt(blockerKey(c))}</span>`)}</div><div class="actions">${cancel}</div>`;
    }
    const vp = this.vp;
    if (!vp) {
      return html`<strong>${bt('v_title')}</strong>
        <div class="actions"><sw-button variant="primary" data-verify-run ?disabled=${this.busy || job.counts.ok === 0 || !this.file} @click=${() => void this.verify()}>${this.busy ? bt('v_running') : bt('v_btn')}</sw-button>${cancel}</div>`;
    }
    const pages = pageCount(vp.rows.length);
    const at = Math.min(this.vpage, pages - 1);
    return html`<strong>${bt('v_title')}</strong>
      <div class="chips" data-verify-preview>
        <span class="chip">${bt('v_will_write', { n: vp.writes })}</span><span class="chip">${bt('unchanged', { n: vp.skipped })}</span><span class="chip">${bt('errors', { n: vp.errors })}</span>
        <span class="chip">${bt('v_expires', { t: expiryText(vp.expires_at, btLang()) })}</span></div>
      <div class="vlist">${pageOf(vp.rows, at).map((r) => html`<div class="vrow" data-verify-row=${r.source_line}><span>${bt('v_line', { n: r.source_line })}</span><span>${r.op === 'create' ? bt('v_op_create') : bt('v_op_update')}</span></div>`)}</div>
      ${pages > 1 ? html`<div class="pager"><sw-button variant="ghost" data-verify-prev ?disabled=${at === 0} @click=${() => (this.vpage = at - 1)}>${bt('v_prev')}</sw-button>
        <span class="muted">${bt('v_page', { a: at + 1, b: pages })}</span><sw-button variant="ghost" data-verify-next ?disabled=${at >= pages - 1} @click=${() => (this.vpage = at + 1)}>${bt('v_next')}</sw-button></div>` : nothing}
      ${vp.writes === 0 ? html`<div class="line" data-verify-none><span>${bt('v_none')}</span></div>`
        : this.settings?.system_admin
          ? html`<div>${bt('confirm_text', { n: vp.writes })}</div>
            <div class="actions"><label><span class="muted">${bt('confirm_label')}</span><input inputmode="numeric" data-verify-typed .value=${this.vtyped} @input=${(e: Event) => (this.vtyped = (e.target as HTMLInputElement).value)}></label>
              <sw-button variant="primary" data-verify-confirm ?disabled=${this.busy || !canConfirm(vp, this.vtyped, Date.now())} @click=${() => void this.confirmVerifiedStep()}>${bt('v_confirm_btn')}</sw-button></div>`
          : html`<div class="line" data-verify-admin-only><sw-icon name="clock" size=${16}></sw-icon><span>${bt('v_admin_only')}</span></div>`}
      <div class="actions"><sw-button variant="ghost" data-verify-again ?disabled=${this.busy} @click=${() => void this.verify()}>${bt('v_btn')}</sw-button>${cancel}</div>`;
  }

  private resultView(op: CsvOperation): TemplateResult {
    const w = resultWords(op);
    return html`<strong>${bt('v_sent')}</strong>
      <div class="line ${op.state === 'unknown' ? 'warn' : ''}" role="status" data-verify-result=${op.state}><span>${bt(w.key, w.n === undefined ? undefined : { n: w.n })}</span></div>
      ${op.state === 'running' || op.state === 'unknown'
        ? html`<div class="actions"><sw-button variant="ghost" data-verify-check ?disabled=${this.busy} @click=${() => void this.recheck()}>${bt('v_check')}</sw-button></div>` : nothing}`;
  }

  private async recheck(): Promise<void> {
    if (!this.job) return;
    const id = this.job.id;
    const out = await this.run(() => verifiedResult(id));
    if (out) {
      this.op = out.operation;
      await this.pollResult(id);
    }
  }

  private previewRow(r: DryRunRow): TemplateResult {
    return html`<div class="row" data-bulk-preview-row=${r.row}><span>${bt('row', { n: r.row })}</span><div>
      ${r.name ? html`<strong>${r.name}</strong>` : nothing}
      ${r.status === 'error' ? html`<div>${codesText(r)}</div>` : nothing}
      ${r.diff?.length ? html`<div class="diff"><span></span><span class="k">${bt('before')}</span><span class="k">${bt('after')}</span>
        ${r.diff.map((d) => html`<span class="k">${btDynamic(`field_${d.field}`, 'code_generic')}</span><span>${valueText(d.before)}</span><span>${valueText(d.after)}</span>`)}</div>` : nothing}
    </div></div>`;
  }

  private editForm(): TemplateResult {
    const f = this.form;
    const set = (patch: Partial<EditForm>) => (this.form = { ...f, ...patch });
    return html`<div class="grid2">
        <label>${bt('edit_from')}<input type="date" lang=${dateInputLang()} data-bulk-from .value=${f.validFrom} @change=${(e: Event) => set({ validFrom: (e.target as HTMLInputElement).value })}></label>
        <label>${bt('edit_until')}<input type="date" lang=${dateInputLang()} data-bulk-until .value=${f.validUntil} @change=${(e: Event) => set({ validUntil: (e.target as HTMLInputElement).value })}></label>
        <label>${bt('edit_active')}<select data-bulk-active @change=${(e: Event) => set({ active: (e.target as HTMLSelectElement).value as EditForm['active'] })}>
          <option value="keep" ?selected=${f.active === 'keep'}>${bt('edit_keep')}</option>
          <option value="on" ?selected=${f.active === 'on'}>${bt('edit_activate')}</option>
          <option value="off" ?selected=${f.active === 'off'}>${bt('edit_deactivate')}</option></select></label>
      </div>
      ${this.stations.length ? html`<div class="grid2">
        <label>${bt('edit_doors_add')}<select data-bulk-door-add @change=${(e: Event) => (this.addStation = (e.target as HTMLSelectElement).value)}>
          <option value="">—</option>${this.stations.map((s) => html`<option value=${s.id}>${s.name}</option>`)}</select></label>
        <label>${bt('edit_relays')}<select data-bulk-relays @change=${(e: Event) => (this.addRelays = (e.target as HTMLSelectElement).value.split('+').map(Number))}>
          <option value="1">1</option><option value="2">2</option><option value="1+2">1+2</option></select></label>
        <label>${bt('edit_doors_remove')}<select data-bulk-door-remove multiple @change=${(e: Event) => set({ doorsRemove: [...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value) })}>
          ${this.stations.map((s) => html`<option value=${s.id}>${s.name}</option>`)}</select></label>
      </div>` : nothing}
      ${this.groups.length ? html`<div class="grid2">
        <label>${bt('edit_groups_add')}<select multiple data-bulk-group-add @change=${(e: Event) => set({ groupsAdd: [...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value) })}>
          ${this.groups.map((g) => html`<option value=${g.id}>${g.label}</option>`)}</select></label>
        <label>${bt('edit_groups_remove')}<select multiple data-bulk-group-remove @change=${(e: Event) => set({ groupsRemove: [...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value) })}>
          ${this.groups.map((g) => html`<option value=${g.id}>${g.label}</option>`)}</select></label>
      </div>` : nothing}
      <div class="actions"><sw-button variant="primary" data-bulk-edit-stage ?disabled=${this.busy} @click=${() => {
        this.form = { ...this.form, doorsAdd: this.addStation ? { [this.addStation]: this.addRelays } : {} };
        void this.stageEdit();
      }}>${bt('edit_stage')}</sw-button></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-bulk-people-dialog': SwBulkPeopleDialog;
  }
}

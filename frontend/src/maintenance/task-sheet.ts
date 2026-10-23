import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { dateInputLang } from '../api/day-format';
import { maintApi, type MaintFile, type MaintRecord, type TaskDetail, type TaskKind } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { badgeText, categoryText, docTypeText, fileSizeText, fmtDate, fmtInstant, intervalText, kindText, lookOf } from './model';
import { maintCss } from './styles';

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 'YYYY-MM-DD' + an interval (the server computes the real next date; this only pre-fills the field). */
function plus(d: string, unit: string, count: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const p = (n: number) => String(n).padStart(2, '0');
  if (unit === 'day' || unit === 'week') {
    const t = new Date(Date.UTC(y, mo, day + count * (unit === 'week' ? 7 : 1)));
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
  }
  const months = unit === 'year' ? count * 12 : count;
  const ty = y + Math.floor((mo + months) / 12);
  const tm = (mo + months) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${p(tm + 1)}-${p(Math.min(day, last))}`;
}

/**
 * The task sheet (mockup v2 "כרטיס אישור"): the valid-until / due date with its state, the links, the reminder and - while the
 * tickets module is on - the request on schedule; the renewal (a certificate / supplier document: maintenance.manage) or the
 * "mark done" form (a plan: maintenance.perform; the next-date override is a manager's); a round's start / continue; the history.
 * Pause, delete and edit are a manager's. Every action is offered only when the server's `can` says so.
 */
@customElement('maint-task-sheet')
export class MaintTaskSheet extends LitElement {
  @property() taskId = '';
  @property() mode: 'view' | 'complete' = 'view';
  @property({ attribute: false }) access!: MaintAccess;
  @state() private task: TaskDetail | null = null;
  @state() private records: MaintRecord[] = [];
  @state() private error = '';
  @state() private busy = false;
  @state() private formError = '';
  @state() private confirmDelete = false;
  @state() private fileBusy = false;
  @state() private fileError = '';
  @state() private confirmFile: MaintFile | null = null;
  @state() private f = { performed_on: '', valid_until: '', next_due: '', note: '' };

  static styles = maintCss;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('taskId') && this.taskId) void this.load();
  }

  private async load() {
    try {
      const [t, r] = await Promise.all([maintApi.task(this.taskId), maintApi.records(this.taskId).catch(() => ({ items: [] as MaintRecord[] }))]);
      this.task = t;
      this.records = r.items;
      this.error = '';
      const doc = t.kind === 'certificate' || t.kind === 'vendor_document';
      this.f = { performed_on: today(), valid_until: doc && t.interval ? plus(today(), t.interval.unit, t.interval.count) : '', next_due: '', note: '' };
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private async complete() {
    const t = this.task;
    if (!t) return;
    const doc = t.kind === 'certificate' || t.kind === 'vendor_document';
    if (doc && !t.interval && !this.f.valid_until) {
      this.formError = mt('fRequired');
      return;
    }
    this.busy = true;
    this.formError = '';
    try {
      await maintApi.complete(t.id, {
        performed_on: this.f.performed_on || undefined, ...(doc && this.f.valid_until ? { valid_until: this.f.valid_until } : {}),
        ...(!doc && this.f.next_due ? { next_due: this.f.next_due } : {}), ...(this.f.note.trim() ? { note: this.f.note.trim() } : {}), revision: t.revision,
      });
      this.emit('changed', mt(doc ? 'renewedToast' : 'doneToast'));
      this.close();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'revision_conflict') {
        this.formError = mt('conflict');
        await this.load();
      } else this.formError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async setActive(active: boolean) {
    const t = this.task;
    if (!t) return;
    this.busy = true;
    try {
      await maintApi.update(t.id, { active, revision: t.revision });
      this.emit('changed', mt(active ? 'resumedToast' : 'pausedToast'));
      await this.load();
    } catch (e) {
      this.formError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeTask() {
    const t = this.task;
    if (!t) return;
    this.busy = true;
    try {
      await maintApi.remove(t.id);
      this.emit('removed', mt('removedToast'));
    } catch (e) {
      this.formError = describeError(e);
      this.busy = false;
    }
  }

  private async uploadFile(input: HTMLInputElement) {
    const t = this.task;
    const f = input.files?.[0];
    input.value = '';
    if (!t || !f) return;
    this.fileBusy = true;
    this.fileError = '';
    try {
      await maintApi.uploadFile(t.id, f);
      this.emit('changed', mt('fileAddedToast'));
      await this.load();
    } catch (e) {
      this.fileError = describeError(e);
    } finally {
      this.fileBusy = false;
    }
  }

  private async downloadFile(f: MaintFile) {
    if (!this.task) return;
    this.fileError = '';
    try {
      await maintApi.downloadFile(this.task.id, f);
    } catch (e) {
      this.fileError = describeError(e);
    }
  }

  private async removeFile(f: MaintFile) {
    const t = this.task;
    if (!t) return;
    this.fileBusy = true;
    this.fileError = '';
    try {
      await maintApi.removeFile(t.id, f.id);
      this.confirmFile = null;
      this.emit('changed', mt('fileRemovedToast'));
      await this.load();
    } catch (e) {
      this.fileError = describeError(e);
    } finally {
      this.fileBusy = false;
    }
  }

  /** The scanned certificate / the policy (certificates and supplier documents): a list with download; adding and removing are a manager's. */
  private filesPanel(t: TaskDetail): TemplateResult | typeof nothing {
    if (t.kind !== 'certificate' && t.kind !== 'vendor_document') return nothing;
    const files = t.files ?? [];
    return html`<div class="panel" data-maint-files><div class="hd"><h4>${mt('filesTitle')}</h4><span class="sp"></span>
        ${t.can.edit ? html`<label class="btn sm" aria-disabled=${String(this.fileBusy)}><sw-icon name="plus" size="14"></sw-icon>${this.fileBusy ? mt('fileUploading') : mt('fileAdd')}
          <input type="file" hidden accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" ?disabled=${this.fileBusy} data-maint-file-input @change=${(e: Event) => void this.uploadFile(e.target as HTMLInputElement)}></label>` : nothing}</div>
      ${files.length ? html`<ul class="hist" data-maint-file-list>${files.map((f) => html`<li data-maint-file=${f.id}><span class="t"><b>${f.name}</b><span class="mut"> · ${fileSizeText(f.bytes)}</span></span>
          <button type="button" class="btn sm" data-maint-file-download @click=${() => void this.downloadFile(f)}><sw-icon name="download" size="14"></sw-icon>${mt('fileDownload')}</button>
          ${t.can.edit ? html`<button type="button" class="btn sm ghost" aria-label=${`${mt('fileRemove')} ${f.name}`} data-maint-file-remove @click=${() => { this.confirmFile = f; }}><sw-icon name="trash" size="14"></sw-icon></button>` : nothing}</li>`)}</ul>`
        : html`<div class="mut" data-maint-files-empty>${mt('filesEmpty')}</div>`}
      ${t.can.edit ? html`<div class="mut">${mt('fileHint')}</div>` : nothing}
      ${this.fileError ? html`<div class="alert err" role="alert" data-maint-file-error>${this.fileError}</div>` : nothing}
      ${this.confirmFile ? html`<div class="alert err" role="alertdialog" data-maint-file-confirm><sw-icon name="warning" size="18"></sw-icon><div>${mt('fileRemoveConfirm', { n: this.confirmFile.name })}
        <div class="acts"><button type="button" class="btn sm dng" ?disabled=${this.fileBusy} data-maint-file-remove-yes @click=${() => void this.removeFile(this.confirmFile!)}>${mt('fileRemove')}</button>
        <button type="button" class="btn sm" @click=${() => { this.confirmFile = null; }}>${mt('cancel')}</button></div></div></div>` : nothing}
    </div>`;
  }

  private async startRound() {
    const t = this.task;
    if (!t) return;
    if (t.open_run_id) {
      this.emit('start-run', t.open_run_id);
      return;
    }
    this.busy = true;
    try {
      this.emit('start-run', (await maintApi.startRun(t.id)).id);
    } catch (e) {
      const runId = e instanceof ApiError ? (e.body?.details as { run_id?: string } | undefined)?.run_id : undefined;
      if (runId) this.emit('start-run', runId);
      else this.formError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private histLine(r: MaintRecord): TemplateResult {
    let text: string;
    let look = 'ok';
    if (r.kind === 'run') {
      const issues = Object.values(r.answers ?? {}).filter((a) => a?.ok === false).length;
      if (r.status === 'cancelled') { text = mt('histRunCancelled'); look = 'unk'; }
      else if (r.status === 'open') { text = mt('histRunOpen'); look = 'acc'; }
      else if (issues) { text = mt('histRunIssues', { n: issues }); look = 'alarm'; }
      else text = mt('histRunOk');
    } else if (r.valid_until) text = mt('histRenewed', { d: fmtDate(r.valid_until) });
    else text = r.due_after ? mt('histDone', { d: fmtDate(r.due_after) }) : mt('histDoneNoNext');
    const when = r.performed_on ? fmtDate(r.performed_on) : fmtInstant(r.started_at);
    const note = r.ticket_ids?.length && r.kind === 'completion' ? mt('histViaTicket') : r.note;
    return html`<li data-look=${look} data-maint-hist=${r.id}><span class="dot" aria-hidden="true"></span><span class="t">${text}${note ? html`<span class="mut"> · ${note}</span>` : nothing}</span>
      <span class="w">${[when, r.started_by_name].filter(Boolean).join(' · ')}</span></li>`;
  }

  private completePanel(t: TaskDetail): TemplateResult | typeof nothing {
    if (t.kind === 'round') {
      if (!t.can.start_round && !t.open_run_id) return nothing;
      return html`<div class="panel" data-maint-round-start><div class="hd"><h4>${mt('kindRound')}</h4></div>
        <button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-start @click=${() => void this.startRound()}>${mt(t.open_run_id ? 'continue' : 'scanStartRound')}</button></div>`;
    }
    if (!t.can.complete || !t.active) return nothing;
    const doc = t.kind === 'certificate' || t.kind === 'vendor_document';
    return html`<div class="panel" data-maint-complete><div class="hd"><h4>${mt(doc ? 'renewal' : 'doneTitle')}</h4></div>
      <div class="form">
        <div class="fld"><label for="po">${mt(doc ? 'performedOn' : 'performedOnPlan')}</label><input id="po" class="inp num" type="date" lang=${dateInputLang()} max=${today()} .value=${this.f.performed_on}
          @input=${(e: Event) => { this.f = { ...this.f, performed_on: (e.target as HTMLInputElement).value }; }}></div>
        ${doc ? html`<div class="fld"><label for="vu">${mt('newValidUntil')}</label><input id="vu" class="inp num" type="date" lang=${dateInputLang()} .value=${this.f.valid_until} data-maint-valid-until
            @input=${(e: Event) => { this.f = { ...this.f, valid_until: (e.target as HTMLInputElement).value }; }}></div>`
          : t.can.edit ? html`<div class="fld"><label for="nd">${mt('nextDueOverride')}</label><input id="nd" class="inp num" type="date" lang=${dateInputLang()} .value=${this.f.next_due}
            @input=${(e: Event) => { this.f = { ...this.f, next_due: (e.target as HTMLInputElement).value }; }}></div>` : nothing}
        <div class="fld"><label for="nt">${mt('note')}</label><input id="nt" class="inp" maxlength="300" .value=${this.f.note} @input=${(e: Event) => { this.f = { ...this.f, note: (e.target as HTMLInputElement).value }; }}></div>
        ${this.formError ? html`<div class="alert err" role="alert">${this.formError}</div>` : nothing}
        <button type="button" class="btn pri" ?disabled=${this.busy} data-maint-save-complete @click=${() => void this.complete()}>${mt(doc ? 'saveRenewal' : 'saveDone')}</button>
      </div></div>`;
  }

  private body(t: TaskDetail): TemplateResult {
    const doc = t.kind === 'certificate' || t.kind === 'vendor_document';
    const look = lookOf(t);
    const link = t.elevator_name ? ['elevator', t.elevator_name] : t.generator_name ? ['generator', t.generator_name] : t.entity_name ? ['device', t.entity_name] : null;
    const reqText = t.ticket_error ? mt(`ticketErr_${t.ticket_error}` as MtKey) : '';
    return html`<div class="two">
      <div>
        <div class="panel" data-look=${look} data-maint-due>
          <div class="hd"><div><div class="mut">${mt(doc ? 'validUntil' : 'dueBy')}</div><div class="bigdate">${t.due_date ? fmtDate(t.due_date) : mt('dash')}</div></div><span class="sp"></span>
            <span class="badge">${badgeText(t)}</span></div>
          <dl class="kv">
            ${link ? html`<dt>${mt(link[0] as MtKey)}</dt><dd>${link[1]}</dd>` : nothing}
            ${t.kind === 'vendor_document' ? html`<dt>${mt('fDocType')}</dt><dd>${docTypeText(t.doc_type)}</dd>` : html`<dt>${mt('fCategory')}</dt><dd>${categoryText(t.category)}</dd>`}
            ${t.owner_name ? html`<dt>${mt('owner')}</dt><dd>${t.owner_name}</dd>` : nothing}
            <dt>${mt('reminder')}</dt><dd>${t.lead_days ? mt('reminderDays', { n: t.lead_days }) : mt('reminderSameDay')}</dd>
            ${this.access.ticketsOn && (t.auto_ticket || t.ticket_id) ? html`<dt>${mt('requestRow')}</dt><dd data-maint-request-row>${t.auto_ticket ? mt('requestAuto') : ''}
              ${t.ticket_id ? html` · <a href=${`#/tickets/${encodeURIComponent(t.ticket_id)}`}>${mt('requestLast')}</a>` : nothing}${reqText ? html`<div class="mut">${reqText}</div>` : nothing}</dd>` : nothing}
          </dl>
        </div>
        ${t.notes ? html`<div class="panel"><div class="hd"><h4>${mt('notes')}</h4></div><div style="white-space:pre-line">${t.notes}</div></div>` : nothing}
        ${t.vendor_id && t.vendor_name ? html`<button type="button" class="btn ghost" data-maint-open-vendor @click=${() => this.emit('open-vendor', t.vendor_id)}>${mt('colVendor')}: ${t.vendor_name}</button>` : nothing}
      </div>
      <div>
        ${this.completePanel(t)}
        ${this.filesPanel(t)}
        <div class="panel"><div class="hd"><h4>${mt('history')}</h4></div>
          ${this.records.length ? html`<ol class="hist" data-maint-history>${this.records.map((r) => this.histLine(r))}</ol>` : html`<div class="mut">${mt('historyEmpty')}</div>`}
        </div>
      </div>
    </div>
    ${this.confirmDelete ? html`<div class="alert err" role="alertdialog" data-maint-confirm-delete><sw-icon name="warning" size="18"></sw-icon><div>${mt('removeConfirm', { t: t.title })}
      <div class="acts"><button type="button" class="btn sm dng" ?disabled=${this.busy} data-maint-delete-yes @click=${() => void this.removeTask()}>${mt('removeYes')}</button>
      <button type="button" class="btn sm" @click=${() => { this.confirmDelete = false; }}>${mt('cancel')}</button></div></div></div>` : nothing}`;
  }

  render() {
    const t = this.task;
    const sub = t ? [kindText(t.kind), intervalText(t.interval), t.place?.name, t.vendor_name].filter(Boolean).join(' · ') : '';
    return html`<sw-dialog open xl heading=${t?.title ?? ''} subheading=${sub} data-maint-sheet=${this.taskId} @close=${() => this.close()}>
      ${this.error ? html`<sw-state-panel state="error" heading=${this.error} compact></sw-state-panel>` : t ? this.body(t) : html`<div class="skl" aria-busy="true" aria-label=${mt('loading')}></div>`}
      ${t ? html`<div class="foot" slot="footer">
        ${t.can.edit ? html`<button type="button" class="btn ghost" ?disabled=${this.busy} data-maint-pause @click=${() => void this.setActive(!t.active)}>${mt(t.active ? 'pause' : 'resume')}</button>
          <button type="button" class="btn ghost" data-maint-delete @click=${() => { this.confirmDelete = true; }}>${mt('remove')}</button>` : nothing}
        <span class="sp"></span>
        ${t.can.edit ? html`<button type="button" class="btn" data-maint-edit @click=${() => this.emit('edit', { kind: t.kind as TaskKind, id: t.id })}><sw-icon name="edit" size="14"></sw-icon>${mt('edit')}</button>` : nothing}
        <button type="button" class="btn" @click=${() => this.close()}>${mt('close')}</button>
      </div>` : nothing}
    </sw-dialog>`;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('task') && this.task && this.mode === 'complete') {
      const el = this.renderRoot.querySelector<HTMLInputElement>('[data-maint-valid-until], #po');
      requestAnimationFrame(() => el?.focus());
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-task-sheet': MaintTaskSheet;
  }
}

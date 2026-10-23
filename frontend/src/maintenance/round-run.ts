import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { maintApi, type ChecklistItem, type Run } from '../api/maintenance';
import { mt } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { answerBody, answered, issueKeys, missingRequired, outOfRange, rangeText, resumeIndex, roundViewOf, saveRoundView, type RunDraft as Draft } from './model';
import type { RoundView } from '../api/maintenance';
import { maintCss } from './styles';

/**
 * The round run (mockup v2: one checkpoint per screen, large targets): yes / no, a number judged against its range (a person may
 * still mark an in-range value as a problem) or a text, a note, and - only while the tickets module is on and the person may open
 * requests - "open a service request" from a checkpoint with a problem. The last screen sums up and finishes or cancels the round.
 * Each mark is saved when the person moves on (the server keeps the time of each mark, never a position).
 */
@customElement('maint-round-run')
export class MaintRoundRun extends LitElement {
  @property() runId = '';
  @property({ attribute: false }) access!: MaintAccess;
  @state() private run: Run | null = null;
  @state() private i = 0;
  @state() private drafts: Record<string, Draft> = {};
  @state() private error = '';
  @state() private busy = false;
  @state() private note = '';
  @state() private dept = '';
  @state() private flash = '';
  /** MAINT215B: one checkpoint per screen, or one long list - the person's own choice, else the installation's default (Settings) */
  @state() private view: RoundView = 'step';

  static styles = [maintCss, css`
    :host { display: flex; justify-content: center; flex: 1; min-block-size: 0; }
    .runner { inline-size: min(440px, 100%); block-size: 100%; max-block-size: 780px; min-block-size: 0; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1); display: flex; flex-direction: column; overflow: hidden; }
    .ph { padding: 14px 16px 10px; border-block-end: 1px solid var(--sw-border); }
    .ph .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .ph b { color: var(--sw-heading); }
    .prog { block-size: 6px; background: var(--sw-surface-3); border-radius: var(--sw-r-2xs); overflow: hidden; margin-block-start: 8px; }
    .prog i { display: block; block-size: 100%; background: var(--sw-accent); transition: inline-size var(--sw-t-fast) var(--sw-ease-out); }
    .pb { flex: 1; min-block-size: 0; overflow: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; }
    .runner[data-view='list'] { inline-size: min(720px, 100%); max-block-size: none; }
    .plist { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .plist li { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface); }
    .plist li[data-look='alarm'] { border-color: var(--sw-danger); }
    .plist .q { font-size: var(--sw-fs-lg); }
    .plist .yn button { padding: 10px 0; min-block-size: 44px; font-size: var(--sw-fs-lg); }
    .plist .numin { font-size: var(--sw-fs-xl); padding: 8px; }
    .vw { display: inline-flex; padding: 2px; gap: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); }
    .vw button { border: 0; background: transparent; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 4px 10px; border-radius: calc(var(--sw-r-sm) - 2px); cursor: pointer; min-block-size: 32px; }
    .vw button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-text); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .vw button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .q { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); line-height: 1.3; }
    .yn { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .yn button { border-radius: var(--sw-r-lg); padding: 20px 0; font: inherit; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-xl); border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface); color: var(--sw-text); cursor: pointer; min-block-size: 64px; }
    .yn .yes[aria-pressed='true'] { border-color: var(--sw-success); background: var(--sw-success-soft); color: var(--sw-success-text); }
    .yn .no[aria-pressed='true'] { border-color: var(--sw-danger); background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .yn button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .numin { font: inherit; font-size: var(--sw-fs-3xl); text-align: center; inline-size: 100%; padding: 12px; border-radius: var(--sw-r-md); border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface); color: var(--sw-heading); font-variant-numeric: tabular-nums; box-sizing: border-box; }
    .numin[aria-invalid='true'] { border-color: var(--sw-danger); box-shadow: 0 0 0 3px var(--sw-danger-soft); }
    .req { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 10px 12px; background: var(--sw-surface); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .pf { padding: 12px 16px 18px; display: grid; gap: 8px; border-block-start: 1px solid var(--sw-border); }
    .pf .nav { display: grid; grid-template-columns: auto 1fr; gap: 8px; }
    .dots { display: flex; gap: 6px; flex-wrap: wrap; }
    .dots button { inline-size: 32px; block-size: 32px; border-radius: 50%; display: grid; place-items: center; font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold);
      background: var(--c-soft, var(--sw-surface-3)); color: var(--c-text, var(--sw-text-2)); border: 0; cursor: pointer; }
    .req-chip { justify-self: start; }
    @media (max-width: 767px) {
      .runner { max-block-size: none; border-radius: var(--sw-r-lg); }
    }
  `];

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('runId') && this.runId) void this.load();
    if (changed.has('access') && this.access && !this.viewChosen) {
      this.view = roundViewOf(this.access.roundView);
      this.viewChosen = true;
    }
  }

  private viewChosen = false;

  /** The quick switch on the screen (owner review 24.10): saved in this browser, so the next round opens the same way. */
  private async setView(v: RoundView) {
    if (v === this.view) return;
    if (this.view === 'step') await this.saveCurrent();
    else await this.saveAll();
    this.view = v;
    this.viewChosen = true;
    saveRoundView(v);
  }

  /** List view: save every checkpoint changed since its last save, in one call. */
  private async saveAll(): Promise<boolean> {
    const r = this.run;
    if (!r || !r.can.write || !this.dirty.size) return true;
    const body: Record<string, NonNullable<ReturnType<typeof answerBody>>> = {};
    for (const it of r.checklist) {
      if (!this.dirty.has(it.key)) continue;
      const b = answerBody(it, this.drafts[it.key] ?? {});
      if (b) body[it.key] = b;
    }
    if (!Object.keys(body).length) {
      this.dirty.clear();
      return true;
    }
    try {
      this.apply(await maintApi.answers(r.id, body), false);
      this.dirty.clear();
      return true;
    } catch (e) {
      this.error = describeError(e);
      return false;
    }
  }

  private async load() {
    try {
      const r = await maintApi.run(this.runId);
      this.apply(r, true);
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private apply(r: Run, jump: boolean) {
    this.run = r;
    const d: Record<string, Draft> = {};
    for (const it of r.checklist) {
      const a = r.answers[it.key];
      if (a) d[it.key] = { ok: a.ok ?? null, value: a.value ?? null, note: a.note ?? '' };
    }
    this.drafts = { ...d, ...Object.fromEntries(Object.entries(this.drafts).filter(([k]) => !(k in d))) };
    if (jump) this.i = resumeIndex(r.checklist, r.answers);
    this.dept = r.task.department_id || r.request_departments?.[0]?.id || '';
  }

  private item(): ChecklistItem | null {
    return this.run?.checklist[this.i] ?? null;
  }

  /** the checkpoints changed since their last save */
  private dirty = new Set<string>();

  private setDraft(key: string, patch: Draft) {
    this.drafts = { ...this.drafts, [key]: { ...this.drafts[key], ...patch } };
    this.dirty.add(key);
  }

  /** Save the current checkpoint (when it changed) before moving. */
  private async saveCurrent(): Promise<boolean> {
    const r = this.run;
    const it = this.item();
    if (!r || !it || !r.can.write) return true;
    if (!this.dirty.has(it.key)) return true;
    const body = answerBody(it, this.drafts[it.key] ?? {});
    if (!body) return true;
    try {
      this.apply(await maintApi.answers(r.id, { [it.key]: body }), false);
      this.dirty.delete(it.key);
      return true;
    } catch (e) {
      this.error = describeError(e);
      return false;
    }
  }

  private async go(delta: number) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (await this.saveCurrent()) this.i = Math.max(0, Math.min((this.run?.checklist.length ?? 0), this.i + delta));
    } finally {
      this.busy = false;
    }
  }

  private async request(key: string) {
    const r = this.run;
    if (!r) return;
    this.busy = true;
    this.error = '';
    try {
      if (!(await (this.view === 'list' ? this.saveAll() : this.saveCurrent()))) return;
      const res = await maintApi.request(r.id, key, this.dept ? { department_id: this.dept } : {});
      this.apply(res.run, false);
      this.flash = mt('requestOpened');
    } catch (e) {
      this.error = e instanceof ApiError && e.code === 'request_exists' ? mt('requestOpened') : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async finish() {
    let r = this.run;
    if (!r) return;
    if (this.view === 'list' && !(await this.saveAll())) return;
    r = this.run!;
    const missing = missingRequired(r.checklist, r.answers);
    if (missing.length) {
      this.error = mt('missingRequired');
      this.i = r.checklist.findIndex((x) => x.key === missing[0]);
      if (this.view === 'list') this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`[data-maint-point="${missing[0]}"]`)?.scrollIntoView({ block: 'center' }));
      return;
    }
    this.busy = true;
    try {
      await maintApi.finish(r.id, this.note.trim() || undefined);
      this.dispatchEvent(new CustomEvent('done', { detail: mt('runDone') }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async cancelRun() {
    const r = this.run;
    if (!r) return;
    this.busy = true;
    try {
      await maintApi.cancel(r.id);
      this.dispatchEvent(new CustomEvent('done', { detail: mt('runCancelled') }));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private requestBox(it: ChecklistItem): TemplateResult | typeof nothing {
    const r = this.run!;
    // owner rule 2026-10-20: with the tickets module off (or no tickets.create) there is no request element at all
    if (!this.access.request || !r.can.open_request || !r.can.write) return nothing;
    const d = this.drafts[it.key] ?? {};
    const problem = d.ok === false || (it.kind === 'number' && outOfRange(it, typeof d.value === 'number' ? d.value : null));
    if (!problem) return nothing;
    const opened = r.answers[it.key]?.ticket_id;
    const depts = r.request_departments ?? [];
    return html`<div class="req" data-maint-request=${it.key}><span>${mt('openRequest')}</span>
      ${opened ? html`<a class="chip" data-look="ok" href=${`#/tickets/${encodeURIComponent(opened)}`}>${mt('requestOpened')}</a>`
        : html`${!r.task.department_id && depts.length > 1 ? html`<select class="inp" style="inline-size:auto" aria-label=${mt('fDepartment')} @change=${(e: Event) => { this.dept = (e.target as HTMLSelectElement).value; }}>
              ${depts.map((x) => html`<option value=${x.id} ?selected=${x.id === this.dept}>${x.name}</option>`)}</select>` : nothing}
            <button type="button" class="btn sm" ?disabled=${this.busy || (!r.task.department_id && !depts.length)} data-maint-request-open @click=${() => void this.request(it.key)}>${mt('openRequestBtn')}</button>`}
    </div>`;
  }

  private point(it: ChecklistItem): TemplateResult {
    const d = this.drafts[it.key] ?? {};
    const kind = it.kind ?? 'check';
    const ro = !this.run!.can.write;
    const num = typeof d.value === 'number' ? d.value : null;
    const out = kind === 'number' && outOfRange(it, num);
    const qid = `q-${it.key}`;
    return html`<div class="q" id=${qid}>${it.label}${it.required === false ? nothing : html` <span class="mut">· ${mt('required')}</span>`}</div>
      ${kind === 'check' ? html`<div class="yn" role="group" aria-labelledby=${qid}>
          <button type="button" class="yes" aria-pressed=${String(d.ok === true)} ?disabled=${ro} data-maint-yes @click=${() => this.setDraft(it.key, { ok: true })}>${mt('yes')}</button>
          <button type="button" class="no" aria-pressed=${String(d.ok === false)} ?disabled=${ro} data-maint-no @click=${() => this.setDraft(it.key, { ok: false })}>${mt('no')}</button></div>`
        : kind === 'number' ? html`<input class="numin" inputmode="decimal" dir="ltr" aria-labelledby=${qid} aria-invalid=${String(out)} ?disabled=${ro} .value=${num ?? ''} data-maint-number
            @input=${(e: Event) => { const v = (e.target as HTMLInputElement).value.replace(',', '.'); this.setDraft(it.key, { value: v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v), ok: null }); }}>
          ${out ? html`<div class="chip req-chip" data-look="alarm" data-maint-out>${mt('outOfRange')} <span class="num">${rangeText(it)}</span></div>` : rangeText(it) ? html`<div class="mut">${rangeText(it)}</div>` : nothing}
          ${!out && num !== null ? html`<label class="check"><input type="checkbox" .checked=${d.ok === false} ?disabled=${ro} @change=${(e: Event) => this.setDraft(it.key, { ok: (e.target as HTMLInputElement).checked ? false : null })}>${mt('no')} - ${mt('outOfRange')}</label>` : nothing}`
          : html`<textarea class="inp" aria-labelledby=${qid} maxlength="300" ?disabled=${ro} .value=${typeof d.value === 'string' ? d.value : ''} data-maint-text
              @input=${(e: Event) => this.setDraft(it.key, { value: (e.target as HTMLTextAreaElement).value })}></textarea>`}
      ${kind !== 'text' ? html`<input class="inp" placeholder=${mt('noteField')} aria-label=${mt('noteField')} maxlength="300" ?disabled=${ro} .value=${d.note ?? ''} data-maint-note
          @input=${(e: Event) => this.setDraft(it.key, { note: (e.target as HTMLInputElement).value })}>` : nothing}
      ${this.requestBox(it)}`;
  }

  /** The whole round as one list (owner review 24.10): every checkpoint with its controls, then the summary and the finish. */
  private list(r: Run): TemplateResult {
    const answeredN = r.checklist.filter((it) => answered(it, { ...r.answers[it.key], ...this.draftAnswer(it) })).length;
    return html`<div class="mut" data-maint-list-progress>${mt('listProgress', { a: answeredN, b: r.checklist.length })}</div>
      <ol class="plist" data-maint-list>${r.checklist.map((it, n) => {
        const d = this.drafts[it.key] ?? {};
        const bad = d.ok === false || (it.kind === 'number' && outOfRange(it, typeof d.value === 'number' ? d.value : null));
        return html`<li data-maint-point=${it.key} data-look=${bad ? 'alarm' : 'unk'}><span class="mut num">${n + 1} / ${r.checklist.length}</span>${this.point(it)}</li>`;
      })}</ol>
      ${this.summary(r)}`;
  }

  private draftAnswer(it: ChecklistItem): { ok?: boolean | null; value?: number | string | null } {
    const d = this.drafts[it.key];
    return d ? { ok: d.ok ?? null, value: d.value ?? null } : {};
  }

  private summary(r: Run): TemplateResult {
    const issues = issueKeys(r.checklist, r.answers);
    const opened = r.checklist.map((it, n) => ({ it, n, t: r.answers[it.key]?.ticket_id })).filter((x) => x.t);
    return html`<div class="q">${mt('finishTitle')}</div>
      <div class="dots" role="list">${r.checklist.map((it, n) => {
        const a = r.answers[it.key];
        const look = !answered(it, a) ? 'unk' : a?.ok === false ? 'alarm' : 'ok';
        return html`<button type="button" role="listitem" data-look=${look} aria-label=${`${n + 1}. ${it.label}`} @click=${() => { this.i = n; }}>${n + 1}</button>`;
      })}</div>
      <div class="mut" data-maint-issues>${issues.length === 0 ? mt('issues0') : issues.length === 1 ? mt('issues1') : mt('issuesN', { n: issues.length })}</div>
      ${this.access.request ? opened.map((x) => html`<div class="req"><span>${mt('pointN', { i: x.n + 1 })}</span><a class="chip" data-look="ok" href=${`#/tickets/${encodeURIComponent(x.t!)}`}>${mt('requestOpened')}</a></div>`) : nothing}
      ${r.can.write ? html`<input class="inp" placeholder=${mt('runNote')} aria-label=${mt('runNote')} maxlength="300" .value=${this.note} @input=${(e: Event) => { this.note = (e.target as HTMLInputElement).value; }}>` : nothing}`;
  }

  render() {
    if (this.error && !this.run) return html`<sw-state-panel state="error" heading=${this.error} actionLabel=${mt('backToList')} @action=${() => this.dispatchEvent(new CustomEvent('close'))}></sw-state-panel>`;
    const r = this.run;
    if (!r) return html`<div class="skl" style="inline-size:min(440px,100%)" aria-busy="true" aria-label=${mt('loading')}></div>`;
    const total = r.checklist.length;
    const atEnd = this.i >= total;
    const it = this.item();
    const pct = Math.round((Math.min(this.i, total) / Math.max(1, total)) * 100);
    const list = this.view === 'list';
    return html`<section class="runner" aria-label=${r.task.title} data-maint-run=${r.id} data-view=${this.view}>
      <div class="ph"><div class="row"><b>${r.task.title}</b>${atEnd || list ? nothing : html`<span class="mut num" data-maint-step>${mt('runOf', { a: this.i + 1, b: total })}</span>`}
          <span class="vw" role="group" aria-label=${mt('viewSwitchLabel')} data-maint-view-switch>
            <button type="button" aria-pressed=${String(!list)} data-view="step" title=${mt('viewSwitchToStep')} @click=${() => void this.setView('step')}>${mt('viewStep')}</button>
            <button type="button" aria-pressed=${String(list)} data-view="list" title=${mt('viewSwitchToList')} @click=${() => void this.setView('list')}>${mt('viewList')}</button></span></div>
        ${list ? nothing : html`<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax=${total} aria-valuenow=${Math.min(this.i, total)}><i style=${`inline-size:${atEnd ? 100 : pct}%`}></i></div>`}</div>
      <div class="pb">
        ${!r.can.write ? html`<div class="alert warn" role="note">${mt('runReadOnly', { who: r.started_by_name || '-' })}</div>` : nothing}
        ${list ? this.list(r) : atEnd || !it ? this.summary(r) : this.point(it)}
        ${this.error ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing}
        ${this.flash ? html`<div class="chip" data-look="ok" role="status">${this.flash}</div>` : nothing}
      </div>
      <div class="pf">
        ${list ? html`${r.can.write ? html`<button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-finish @click=${() => void this.finish()}>${mt('finish')}</button>
            <button type="button" class="btn" ?disabled=${this.busy} data-maint-cancel-run @click=${() => void this.cancelRun()}>${mt('cancelRun')}</button>` : nothing}`
          : atEnd ? html`${r.can.write ? html`<button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-finish @click=${() => void this.finish()}>${mt('finish')}</button>
            <button type="button" class="btn" ?disabled=${this.busy} data-maint-cancel-run @click=${() => void this.cancelRun()}>${mt('cancelRun')}</button>` : nothing}`
          : html`<div class="nav">${this.i > 0 ? html`<button type="button" class="btn big" ?disabled=${this.busy} data-maint-prev @click=${() => void this.go(-1)}>${mt('prev')}</button>` : html`<span></span>`}
            <button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-next @click=${() => void this.go(1)}>${mt('next')}</button></div>`}
        <button type="button" class="btn ghost" data-maint-run-close @click=${() => { void (this.view === 'list' ? this.saveAll() : this.saveCurrent()).then(() => this.dispatchEvent(new CustomEvent('close'))); }}>${mt('backToList')}</button>
      </div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-round-run': MaintRoundRun;
  }
}

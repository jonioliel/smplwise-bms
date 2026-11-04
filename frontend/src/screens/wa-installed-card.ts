import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { waInstalledApi, type InstalledCommand, type InstalledJob, type InstalledTemplate, type InstalledView } from '../api/wa-installed';
import { statusStyles } from '../access-control/status-css';
import { skeletonRows } from '../access-control/status-panel';
import { bidi } from '../i18n/bidi';
import { wi, type WiKey } from '../i18n/wa-installed';
import { blockers, jobTone, jobWord, pacedEditable, recentJobs, syncTone } from '../messaging/wa-installed-model';
import { timeText } from '../api/day-format';

const COMMAND_ROWS: [InstalledCommand, WiKey][] = [
  ['whatsapp/template_registry_v1', 'cmd_registry'],
  ['whatsapp/template_enqueue_v1', 'cmd_queue'],
  ['whatsapp/template_job_v1', 'cmd_job'],
  ['whatsapp/template_cancel_v1', 'cmd_cancel'],
  ['whatsapp/template_send_v3', 'cmd_now'],
  ['whatsapp/send_pacing_v1', 'cmd_paced'],
];

/**
 * WISKEY-WA-QUEUE-2400 (T12): the installed WisKey client's messaging, as one card below the message settings (Settings > access
 * control > messages, system.configure). It shows - never claims - what is there: why a template send is blocked now (in the server's
 * order), which of WisKey's commands the direct join selects now, the template list by source with a "refresh from WisKey" action, the
 * newest queue jobs with their honest word (accepted by the provider / not sent with its reason / unknown; WisKey reports no delivery),
 * and the opt-in for WisKey's paced free-text send (turning it ON only while WisKey lists the command). The conversation history stays
 * in WisKey (plan row 75, "X") - this card never reads it.
 */
@customElement('wa-installed-card')
export class WaInstalledCard extends LitElement {
  @state() private view: InstalledView | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private notice = '';
  @state() private busy: '' | 'sync' | 'save' = '';
  private noticeTimer = 0;

  static styles = [
    statusStyles,
    css`
      :host { display: block; min-inline-size: 0; }
      .sec { padding: 10px 14px; border-block-start: 1px solid var(--sw-border); display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
      .sec h4 { margin: 0; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; min-inline-size: 0; }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs);
        background: var(--sw-surface-3); color: var(--sw-text-2); max-inline-size: 100%; overflow-wrap: anywhere; }
      .chip.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
      .chip.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
      .chip.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
      .cmds { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 6px 12px; }
      .cmd { display: flex; align-items: center; gap: 8px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
      .cmd span { min-inline-size: 0; overflow-wrap: anywhere; }
      .line { display: flex; align-items: center; gap: 10px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
      .line .grow { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
      .line .meta { color: var(--sw-text-3); font-size: var(--sw-fs-xs); white-space: nowrap; }
      .row { min-block-size: max(44px, var(--_t)); }
      .ltr { direction: ltr; unicode-bidi: isolate; }
      .hint { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .toggle { display: flex; align-items: center; gap: 12px; min-inline-size: 0; }
      .toggle .txt { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; gap: 2px; }
      .toggle .t { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .toggle .x { color: var(--sw-text-3); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    window.clearTimeout(this.noticeTimer);
    super.disconnectedCallback();
  }

  async load(): Promise<void> {
    this.phase = this.view ? this.phase : 'loading';
    try {
      this.view = await waInstalledApi().view();
      this.phase = 'ready';
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
      this.phase = 'error';
    }
  }

  private flash(text: string): void {
    this.notice = text;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.notice = ''), 3000);
  }

  private async sync(): Promise<void> {
    if (this.busy) return;
    this.busy = 'sync';
    this.error = '';
    try {
      const v = await waInstalledApi().sync();
      this.view = v;
      this.flash(wi(`sync_${v.sync?.outcome ?? 'synced'}` as WiKey));
    } catch (e) {
      const why = describeError(e);
      await this.load(); // the stored outcome of the failed refresh (the list itself is unchanged)
      if (this.phase === 'ready') this.error = why;
    } finally {
      this.busy = '';
    }
  }

  private async setPaced(on: boolean): Promise<void> {
    if (this.busy || !this.view) return;
    this.busy = 'save';
    this.error = '';
    try {
      this.view = await waInstalledApi().save({ send_pacing_v1: on });
      this.flash(wi('saved'));
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = '';
    }
  }

  private template(t: InstalledTemplate): TemplateResult {
    return html`<div class="row" data-wa-template=${t.id} data-source=${t.source}>
      <span class="dot ${t.bound ? 'ok' : 'muted'}" aria-hidden="true"></span>
      <span class="main"><span class="t ltr">${bidi(t.name)}</span>
        <span class="s">${t.language} · ${wi(t.source === 'wiskey' ? 'src_wiskey' : 'src_arx')}${t.account ? html` · <span class="ltr">${bidi(t.account)}</span>` : nothing}${t.bound ? nothing : html` · ${wi('unbound')}`}</span></span>
    </div>`;
  }

  private job(j: InstalledJob): TemplateResult {
    const word = jobWord(j);
    const tone = jobTone(word);
    return html`<div class="row" data-wa-job=${j.operation_id} data-word=${word}>
      <span class="dot ${tone === 'bad' ? 'err' : tone}" aria-hidden="true"></span>
      <span class="main"><span class="t">${wi(`job_${word}` as WiKey)}</span>
        <span class="s"><span class="ltr">${bidi(j.template_id ?? '–')}</span> · ${timeText(new Date(j.updated_at))}</span></span>
    </div>`;
  }

  render() {
    if (this.phase === 'loading') return html`<sw-card flush data-wa-installed data-state="loading">${skeletonRows(3)}</sw-card>`;
    if (this.phase === 'error' || !this.view) {
      return html`<sw-card flush data-wa-installed data-state="error"><div class="ch"><div><h3>${wi('title')}</h3></div></div>
        <div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${wi('loadError')}: ${this.error}</span>
          <sw-button size="sm" data-wa-retry @click=${() => void this.load()}>${wi('retry')}</sw-button></div></div></sw-card>`;
    }
    const v = this.view;
    const blocks = blockers(v);
    const last = v.registry.last_sync;
    const jobs = recentJobs(v.jobs);
    const pacedOk = pacedEditable(v);
    return html`<sw-card flush data-wa-installed data-state="ready">
      <div class="ch">
        <div><h3>${wi('title')}</h3><div class="sub">${wi('sub')}</div></div>
        <div class="ctl"><sw-button size="sm" icon="refresh" data-wa-sync ?disabled=${!!this.busy || !v.commands['whatsapp/template_registry_v1']}
          @click=${() => void this.sync()}>${this.busy === 'sync' ? wi('syncing') : wi('sync')}</sw-button></div>
      </div>
      ${this.error ? html`<div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>` : nothing}
      ${this.notice ? html`<div class="sec"><div class="note info" role="status" data-wa-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>` : nothing}
      <div class="sec" data-wa-blockers=${blocks.join(' ')}>
        ${blocks.length
          ? html`<h4>${wi('blocked')}</h4><div class="chips">${blocks.map((b) => html`<span class="chip bad" data-wa-blocker=${b}>${wi(`blk_${b}` as WiKey)}</span>`)}</div>`
          : html`<div class="chips"><span class="chip ok" data-wa-ready>${wi('ready')}</span></div>`}
      </div>
      <div class="sec">
        <h4>${wi('commands')}</h4>
        <div class="cmds">${COMMAND_ROWS.map(([cmd, key]) => html`<div class="cmd" data-wa-command=${cmd} data-on=${String(v.commands[cmd])}>
          <span class="dot ${v.commands[cmd] ? 'ok' : 'muted'}" aria-hidden="true"></span><span>${wi(key)} · ${wi(v.commands[cmd] ? 'on' : 'off')}</span></div>`)}</div>
      </div>
      <div class="sec" data-wa-registry>
        <div class="line"><h4 class="grow">${wi('registry')}</h4>
          <span class="chip" data-wa-count="wiskey">${wi('fromWiskey', { n: v.registry.wiskey_rows })}</span>
          <span class="chip" data-wa-count="arx">${wi('fromArx', { n: v.registry.arx_rows })}</span></div>
        <div class="line"><span class="chip ${syncTone(last?.outcome)}" data-wa-last-sync=${last?.outcome ?? 'never'}>${last ? wi(`sync_${last.outcome}` as WiKey) : wi('neverSynced')}</span>
          ${last?.at ? html`<span class="meta">${wi('lastSync', { time: timeText(new Date(last.at)) })}</span>` : nothing}</div>
        ${v.registry.wiskey_rows && !v.registry.native_sendable ? html`<div class="hint" data-wa-native-locked>${wi('nativeLocked')}</div>` : nothing}
      </div>
      <div data-wa-templates>${v.registry.templates.length ? repeat(v.registry.templates, (t) => t.id, (t) => this.template(t)) : html`<div class="empty">${wi('noTemplates')}</div>`}</div>
      <div class="sec" data-wa-jobs-head><h4>${wi('jobs')}</h4><div class="hint">${wi('ttl', { n: v.queue_ttl_s })}</div>
        ${v.delivery_receipts ? nothing : html`<div class="hint" data-wa-no-delivery>${wi('delivery')}</div>`}</div>
      <div data-wa-jobs>${jobs.length ? repeat(jobs, (j) => j.operation_id, (j) => this.job(j)) : html`<div class="empty">${wi('noJobs')}</div>`}</div>
      <div class="sec">
        <div class="toggle" data-wa-paced>
          <span class="txt"><span class="t">${wi('paced')}</span>
            <span class="x">${v.settings.send_pacing_v1 ? wi('pacedOn') : pacedOk ? wi('pacedOff') : wi('pacedUnlisted')}</span></span>
          <sw-toggle label=${wi('paced')} labelHidden data-wa-paced-toggle .checked=${v.settings.send_pacing_v1} ?disabled=${!!this.busy || !pacedOk}
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.setPaced(e.detail.checked)}></sw-toggle>
        </div>
        <div class="hint" data-wa-history>${wi('history')}</div>
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wa-installed-card': WaInstalledCard;
  }
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-card';
import './sw-dialog';
import './sw-toggle';
import { ApiError, describeError } from '../api/client';
import {
  CONFIG_FIELDS, SECRET_FIELDS, blankTarget, checkTarget, createTarget, deleteTarget, drillStatus, exportKey, importKey, offboxStatus, pushTarget,
  rotateKey, runDrill, setDrillMonthly, setTargetEnabled, toRequest, updateTarget,
  type DrillStatus, type OffboxRun, type OffboxStatus, type OffboxTarget, type OffboxTargetIn,
} from '../api/backup-offbox';
import { keyExportReady, obt, obtError, type ObtKey } from '../i18n/backup-offbox';
import { settingsStyles } from '../styles/settings';
import { dayMonthTimeText } from '../api/day-format';

type Dialog = null | 'export' | 'rotate' | { remove: OffboxTarget };

/**
 * DATASTORE-295 phase 2: Settings › אבחון › גיבוי ושחזור - the off-box targets (S3-compatible / SFTP), the encryption key (export once,
 * replace, import) and the restore drill (local archive, newest encrypted copy, monthly switch). System administrators only
 * (`backup.manage`; the parent renders it for them). Credentials are write-only: a saved one shows "saved", never a value.
 */
@customElement('sw-offbox-backup')
export class SwOffboxBackup extends LitElement {
  @state() private status: OffboxStatus | null = null;
  @state() private drill: DrillStatus | null = null;
  @state() private form: (OffboxTargetIn & { id?: string }) | null = null;
  @state() private clear: string[] = [];
  @state() private busy = '';
  @state() private msg: { ok: boolean; text: string } | null = null;
  @state() private dialog: Dialog = null;
  @state() private confirm = '';
  @state() private acked = false;
  @state() private shownKey = '';
  @state() private copied = false;
  @state() private importText = '';
  private poll: number | undefined;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.poll);
  }

  private async load() {
    try {
      [this.status, this.drill] = await Promise.all([offboxStatus(), drillStatus()]);
    } catch (err) {
      this.msg = { ok: false, text: describeError(err) };
    }
    if (this.status?.running || this.drill?.running) {
      window.clearTimeout(this.poll);
      this.poll = window.setTimeout(() => void this.load(), 2000);
    }
  }

  private fail(err: unknown) {
    const code = err instanceof ApiError ? err.code : undefined;
    this.msg = { ok: false, text: code ? obtError(code) : describeError(err) };
  }

  private async act(tag: string, fn: () => Promise<unknown>, done?: string) {
    this.busy = tag;
    this.msg = null;
    try {
      await fn();
      if (done) this.msg = { ok: true, text: done };
      await this.load();
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy = '';
    }
  }

  // ---------------------------------------------------------------- targets

  private edit(t?: OffboxTarget, kind: 's3' | 'sftp' = 's3') {
    this.clear = [];
    this.msg = null;
    this.form = t
      ? { id: t.id, name: t.name, kind: t.kind, enabled: t.enabled, config: { ...t.config }, secrets: {}, retention: { ...t.retention } }
      : blankTarget(kind);
  }

  private async save() {
    const f = this.form;
    if (!f) return;
    await this.act('save', async () => {
      const body = toRequest(f, this.clear);
      if (f.id) await updateTarget(f.id, body);
      else await createTarget(body);
      this.form = null;
    }, obt('saved'));
  }

  private async test(t: OffboxTarget) {
    this.busy = `test:${t.id}`;
    this.msg = null;
    try {
      const r = await checkTarget(t.id);
      this.msg = r.ok ? { ok: true, text: obt('testOk') } : { ok: false, text: obtError(r.error) };
      await this.load();
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy = '';
    }
  }

  private async dry(t: OffboxTarget) {
    this.busy = `dry:${t.id}`;
    this.msg = null;
    try {
      const r = await pushTarget(t.id, true);
      const res = r.result;
      this.msg = res?.ok && res.plan ? { ok: true, text: obt('dryRunOk', { name: res.plan.upload.name, n: res.plan.delete.length }) } : { ok: false, text: obtError(res?.error) };
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy = '';
    }
  }

  private when(iso: string | null | undefined): string {
    if (!iso) return obt('never');
    return dayMonthTimeText(new Date(iso));
  }

  private runBadge(r: OffboxRun | null, label: ObtKey): TemplateResult {
    if (!r) return html`<span class="muted">${obt(label)} · ${obt('never')}</span>`;
    return html`<span class="run" data-run=${r.action}>${obt(label)}
      <sw-badge kind=${r.ok ? 'live' : 'error'} label=${r.ok ? (r.verified ? obt('verified') : obt('ok')) : obt('failed')}></sw-badge>
      <span class="muted">${this.when(r.finished_at ?? r.started_at)}${r.ok ? '' : ` · ${obtError(r.error)}`}</span></span>`;
  }

  private renderTarget(t: OffboxTarget) {
    const b = this.busy;
    const sftpMissing = t.kind === 'sftp' && this.status && !this.status.transports.sftp;
    return html`<div class="target" data-offbox-target=${t.id}>
      <div class="head">
        <span class="name">${t.name}<span class="muted"> · ${obt(`kind_${t.kind}` as ObtKey)}</span></span>
        <sw-toggle ?checked=${t.enabled} label=${t.enabled ? obt('enabled') : obt('disabled')} ?disabled=${!!b}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(`en:${t.id}`, () => setTargetEnabled(t.id, e.detail.checked))}></sw-toggle>
      </div>
      <div class="runs">${this.runBadge(t.last.push, 'lastPush')}${this.runBadge(t.last.test, 'lastTest')}${this.runBadge(t.last.drill, 'lastDrill')}</div>
      ${sftpMissing ? html`<div class="msg err" role="note">${obt('sftpMissing')}</div>` : nothing}
      <div class="actions">
        <sw-button size="sm" icon="check" ?disabled=${!!b} data-offbox-test @click=${() => void this.test(t)}>${obt('test')}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!b} data-offbox-dry @click=${() => void this.dry(t)}>${obt('dryRun')}</sw-button>
        <sw-button size="sm" variant="primary" icon="upload" ?disabled=${!!b || this.status?.running} data-offbox-push
          @click=${() => void this.act(`push:${t.id}`, () => pushTarget(t.id), obt('pushStarted'))}>${obt('pushNow')}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!b} data-offbox-edit @click=${() => this.edit(t)}>${obt('edit')}</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${!!b} data-offbox-remove @click=${() => { this.dialog = { remove: t }; }}>${obt('remove')}</sw-button>
      </div>
    </div>`;
  }

  private setCfg(k: string, v: string | number | boolean) {
    if (this.form) this.form = { ...this.form, config: { ...this.form.config, [k]: v } };
  }

  private setSecret(k: string, v: string) {
    if (!this.form) return;
    this.form = { ...this.form, secrets: { ...this.form.secrets, [k]: v } };
    this.clear = this.clear.filter((x) => x !== k);
  }

  private renderForm() {
    const f = this.form;
    if (!f || f.kind === 'local') return nothing;
    const kind = f.kind;
    const saved = f.id ? this.status?.targets.find((t) => t.id === f.id)?.secrets ?? {} : {};
    return html`<div class="form" data-offbox-form=${kind}>
      <label class="row"><span class="lbl">${obt('name')}</span><input class="ctl" data-f="name" .value=${f.name} maxlength="80"
        @input=${(e: Event) => { if (this.form) this.form = { ...this.form, name: (e.target as HTMLInputElement).value }; }} /></label>
      ${CONFIG_FIELDS[kind].map((k) => {
        const v = f.config[k];
        if (k === 'path_style') {
          return html`<div class="row"><span class="lbl">${obt('path_style')}</span><sw-toggle ?checked=${!!v} label=${obt('path_style')} labelHidden
            @change=${(e: CustomEvent<{ checked: boolean }>) => this.setCfg(k, e.detail.checked)}></sw-toggle></div>`;
        }
        if (k === 'host_key') {
          return html`<label class="row stack"><span class="lbl">${obt('host_key')}<span class="muted">${obt('hostKeyHint')}</span></span>
            <textarea class="ctl wide" data-ltr data-f="host_key" rows="2" spellcheck="false" .value=${String(v ?? '')}
              @input=${(e: Event) => this.setCfg(k, (e.target as HTMLTextAreaElement).value)}></textarea></label>`;
        }
        return html`<label class="row"><span class="lbl">${obt(k as ObtKey)}</span><input class="ctl" data-ltr data-f=${k} type=${k === 'port' ? 'number' : 'text'}
          .value=${String(v ?? '')} @input=${(e: Event) => this.setCfg(k, (e.target as HTMLInputElement).value)} /></label>`;
      })}
      ${SECRET_FIELDS[kind].map((k) => {
        const isSet = !!saved[k] && !this.clear.includes(k);
        const ph = isSet ? obt('secretSet') : obt('secretMissing');
        return k === 'key'
          ? html`<label class="row stack"><span class="lbl">${obt('key')}</span><textarea class="ctl wide" data-ltr data-secret=${k} rows="3" spellcheck="false" autocomplete="off"
              placeholder=${ph} .value=${f.secrets[k] ?? ''} @input=${(e: Event) => this.setSecret(k, (e.target as HTMLTextAreaElement).value)}></textarea></label>`
          : html`<label class="row"><span class="lbl">${obt(k as ObtKey)}</span><input class="ctl" data-ltr data-secret=${k} type="password" autocomplete="new-password"
              placeholder=${ph} .value=${f.secrets[k] ?? ''} @input=${(e: Event) => this.setSecret(k, (e.target as HTMLInputElement).value)} /></label>`;
      })}
      <div class="row"><span class="lbl">${obt('retention')}</span><span class="ret">
        ${(['keep_last', 'keep_daily', 'keep_weekly', 'keep_monthly'] as const).map((k) => html`<label><input type="number" min=${k === 'keep_last' ? 1 : 0} max="1000"
          data-f=${k} .value=${String(f.retention[k])} @input=${(e: Event) => { if (this.form) this.form = { ...this.form, retention: { ...this.form.retention, [k]: Number((e.target as HTMLInputElement).value) } }; }} />
          <span class="muted">${obt(k)}</span></label>`)}</span></div>
      <div class="row"><span class="lbl">${obt('enabled')}</span><sw-toggle ?checked=${f.enabled} label=${obt('enabled')} labelHidden
        @change=${(e: CustomEvent<{ checked: boolean }>) => { if (this.form) this.form = { ...this.form, enabled: e.detail.checked }; }}></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" ?disabled=${!!this.busy || !f.name.trim()} data-offbox-save @click=${() => void this.save()}>${obt('save')}</sw-button>
        <sw-button variant="ghost" @click=${() => { this.form = null; }}>${obt('cancel')}</sw-button></div>
    </div>`;
  }

  // ---------------------------------------------------------------- key

  private async doExport() {
    await this.act('export', async () => {
      const r = await exportKey();
      this.shownKey = r.key;
      this.confirm = '';
    });
  }

  private async copyKey() {
    try {
      await navigator.clipboard.writeText(this.shownKey);
      this.copied = true;
    } catch {
      this.copied = false;
    }
  }

  private closeDialog() {
    this.dialog = null;
    this.confirm = '';
    this.acked = false;
    this.shownKey = '';
    this.copied = false;
  }

  private renderDialog() {
    const d = this.dialog;
    if (!d) return nothing;
    if (typeof d === 'object') {
      return html`<sw-dialog open heading=${obt('remove')} subheading=${d.remove.name} data-offbox-remove-dialog @close=${() => this.closeDialog()}>
        <div class="muted">${obt('removeConfirm')}</div>
        <div slot="footer"><sw-button variant="danger" icon="trash" ?disabled=${!!this.busy} data-offbox-remove-go
          @click=${() => void this.act('remove', async () => { await deleteTarget(d.remove.id); this.closeDialog(); })}>${obt('remove')}</sw-button>
          <sw-button variant="ghost" @click=${() => this.closeDialog()}>${obt('cancel')}</sw-button></div>
      </sw-dialog>`;
    }
    const isExport = d === 'export';
    const word = isExport ? 'EXPORT' : 'ROTATE';
    return html`<sw-dialog open heading=${obt(isExport ? 'keyExportTitle' : 'keyRotateTitle')} data-offbox-key-dialog=${d} @close=${() => this.closeDialog()}>
      ${this.shownKey
        ? html`<div class="msg ok" role="status">${obt('keyShown')}</div>
            <textarea class="keybox" data-ltr readonly rows="3" data-offbox-key-text .value=${this.shownKey}></textarea>`
        : html`<div class="msg warn" role="note">${obt(isExport ? 'keyExportWarn' : 'keyRotateWarn')}</div>
            ${isExport
              ? html`<ul class="keyfacts" data-offbox-key-facts>
                  <li>${obt('keyExportWhat')}</li><li>${obt('keyExportNoRestore')}</li><li>${obt('keyExportLost')}</li><li>${obt('keyExportStore')}</li></ul>
                <label class="ack"><input type="checkbox" data-offbox-ack .checked=${this.acked}
                  @change=${(e: Event) => { this.acked = (e.target as HTMLInputElement).checked; }} /><span>${obt('keyExportAck')}</span></label>`
              : nothing}
            <div class="muted">${obt(isExport ? 'keyExportConfirm' : 'keyRotateConfirm')}</div>
            <input class="confirm-in" data-ltr data-offbox-confirm placeholder=${word} .value=${this.confirm} @input=${(e: Event) => { this.confirm = (e.target as HTMLInputElement).value; }} />`}
      <div slot="footer">
        ${this.shownKey
          ? html`<sw-button variant="primary" icon="copy" data-offbox-copy @click=${() => void this.copyKey()}>${this.copied ? obt('copied') : obt('copy')}</sw-button>`
          : html`<sw-button variant=${isExport ? 'primary' : 'danger'} ?disabled=${isExport ? !keyExportReady(this.confirm, this.acked, !!this.busy) : this.confirm !== word || !!this.busy} data-offbox-key-go
              @click=${() => void (isExport ? this.doExport() : this.act('rotate', async () => { await rotateKey(); this.closeDialog(); }, obt('keyRotated')))}>${obt(isExport ? 'keyExport' : 'keyRotate')}</sw-button>`}
        <sw-button variant="ghost" @click=${() => this.closeDialog()}>${obt('cancel')}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderKey() {
    const k = this.status?.key;
    const active = k?.keys.find((x) => x.active);
    return html`<sw-card heading=${obt('keyTitle')} subheading=${obt('keySub')} data-offbox-key>
      <div class="row"><span class="lbl">${obt('keyActive')}${k && k.keys.length > 1 ? html`<span class="muted">${obt('keys', { n: k.keys.length })}</span>` : nothing}</span>
        <span class="end">${active
          ? html`<code data-ltr>${active.id}</code> <sw-badge kind=${active.exported ? 'live' : 'partial'} label=${active.exported ? obt('keyExported') : obt('keyNotExported')}></sw-badge>`
          : html`<span class="muted">${obt('keyNone')}</span>`}</span></div>
      <div class="actions">
        <sw-button size="sm" icon="lock" ?disabled=${!!this.busy || !!active?.exported} data-offbox-export @click=${() => { this.dialog = 'export'; }}>${obt('keyExport')}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!this.busy || !active} data-offbox-rotate @click=${() => { this.dialog = 'rotate'; }}>${obt('keyRotate')}</sw-button>
      </div>
      <div class="row"><span class="lbl">${obt('keyImport')}<span class="muted">${obt('keyImportHint')}</span></span>
        <span class="end"><input class="ctl" data-ltr type="password" autocomplete="off" data-offbox-import .value=${this.importText}
          @input=${(e: Event) => { this.importText = (e.target as HTMLInputElement).value; }} />
          <sw-button size="sm" ?disabled=${!this.importText.trim() || !!this.busy} data-offbox-import-go
            @click=${() => void this.act('import', async () => { await importKey(this.importText); this.importText = ''; }, obt('keyImported'))}>${obt('keyImport')}</sw-button></span></div>
    </sw-card>`;
  }

  // ---------------------------------------------------------------- drill

  private renderDrill() {
    const d = this.drill;
    const enabled = (this.status?.targets ?? []).filter((t) => t.enabled);
    const res = (r: DrillStatus['last']) => r
      ? html`<sw-badge kind=${r.result === 'PASS' ? 'live' : 'error'} label=${r.result === 'PASS' ? obt('pass') : obt('fail')}></sw-badge> <span class="muted">${this.when(r.finished_at)}</span>`
      : html`<span class="muted">${obt('never')}</span>`;
    return html`<sw-card heading=${obt('drillTitle')} subheading=${obt('drillSub')} data-offbox-drill>
      <div class="row"><span class="lbl">${obt('drillLocal')}</span><span class="end">${res(d?.last ?? null)}
        <sw-button size="sm" ?disabled=${!!d?.running || !!this.busy} data-drill-run @click=${() => void this.act('drill', () => runDrill())}>${d?.running ? obt('drillRunning') : obt('drillRun')}</sw-button></span></div>
      ${enabled.length
        ? html`<div class="row"><span class="lbl">${obt('drillOffbox')}</span><span class="end">${res(d?.last_offbox ?? null)}
            ${enabled.map((t) => html`<sw-button size="sm" variant="ghost" ?disabled=${!!d?.running || !!this.busy} data-drill-run-target=${t.id}
              @click=${() => void this.act('drill', () => runDrill(t.id))}>${enabled.length > 1 ? `${obt('drillRunTarget')} · ${t.name}` : obt('drillRunTarget')}</sw-button>`)}</span></div>`
        : nothing}
      <div class="row"><span class="lbl">${obt('drillMonthly')}</span><sw-toggle ?checked=${!!d?.schedule.monthly} label=${obt('drillMonthly')} labelHidden data-drill-monthly
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act('monthly', () => setDrillMonthly(e.detail.checked))}></sw-toggle></div>
    </sw-card>`;
  }

  render() {
    const s = this.status;
    return html`
      <sw-card heading=${obt('cardTitle')} subheading=${obt('cardSub')} data-offbox>
        ${s === null ? html`<div class="muted">…</div>` : s.targets.length ? s.targets.map((t) => this.renderTarget(t)) : html`<div class="muted" data-offbox-empty>${obt('empty')}</div>`}
        ${this.form ? this.renderForm() : html`<div class="actions">
          <sw-button size="sm" icon="plus" data-offbox-add="s3" @click=${() => this.edit(undefined, 's3')}>${obt('addS3')}</sw-button>
          <sw-button size="sm" icon="plus" data-offbox-add="sftp" @click=${() => this.edit(undefined, 'sftp')}>${obt('addSftp')}</sw-button></div>`}
        ${this.msg ? html`<div class="msg ${this.msg.ok ? 'ok' : 'err'}" role=${this.msg.ok ? 'status' : 'alert'} data-offbox-msg>${this.msg.text}</div>` : nothing}
      </sw-card>
      ${this.renderKey()}
      ${this.renderDrill()}
      ${this.renderDialog()}`;
  }

  static styles = [settingsStyles, css`
    :host { display: grid; gap: var(--sw-space-4, 16px); }
    .target { display: grid; gap: 6px; padding-block: 10px; border-block-end: 1px solid var(--sw-border); }
    .target:last-of-type { border-block-end: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .name { font-weight: 600; }
    .runs { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--sw-fs-sm); }
    .run { display: inline-flex; align-items: center; gap: 6px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; padding-block: 6px; }
    .form { display: grid; gap: 2px; padding-block: 8px; }
    .ret { display: flex; flex-wrap: wrap; gap: 10px; }
    .ret label { display: inline-flex; align-items: center; gap: 4px; }
    .ret input { inline-size: 64px; }
    input.ctl, textarea.ctl, .ret input, .confirm-in, .keybox { font: inherit; padding: 6px 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-radius-sm, 6px);
      background: var(--sw-surface); color: var(--sw-text); min-inline-size: 0; }
    .keyfacts { margin: 0; padding-inline-start: 18px; display: grid; gap: 4px; }
    .ack { display: flex; gap: 8px; align-items: flex-start; }
    textarea.ctl, .keybox { inline-size: 100%; box-sizing: border-box; font-family: var(--sw-font-mono, monospace); font-size: var(--sw-fs-sm); }
    [data-ltr] { direction: ltr; text-align: start; }
    .end { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    code { font-family: var(--sw-font-mono, monospace); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-offbox-backup': SwOffboxBackup;
  }
}

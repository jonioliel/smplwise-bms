import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-state-panel';
import '../components/wk-installer-confirm';
import type { ConfirmRequest } from '../components/wk-installer-confirm';
import { settingsStyles } from '../styles/settings';
import { installerStyles } from './installer-styles';
import { ApiError } from '../api/client';
import { dateInputLang } from '../api/day-format';
import {
  DOOR_FIELDS,
  applyChange,
  applyImport,
  applyRetention,
  cancelMaintenance,
  diffRows,
  enqueueMaintenance,
  exportPlatform,
  getPlatform,
  previewChange,
  previewImport,
  previewRetention,
  receiptSummary,
  revealWebhookKey,
  saveStationMeta,
  saveWebhook,
  webhookErrors,
  windowErrors,
  type ChangePreview,
  type DoorValues,
  type ImportReview,
  type MaintJob,
  type PlatformData,
  type PlatformView,
  type Receipt,
  type StationMeta,
} from '../api/installer';
import { fill, installerText as T, platformText as X, technicalText as D } from '../i18n/wiskey-installer';

const EMPTY_META = (): StationMeta => ({
  zone: '',
  owner: '',
  tags: [],
  thresholds: { offline: 600, sync_stalled: 900, event_gap: 600 },
  window: { enabled: false, days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
});
const MB = 1_048_576;
const errText = (err: unknown) => (err instanceof ApiError ? err.body.user_message : String(err));

/**
 * WISKEY-INSTALLER-NATIVE-2400 phase 4 - הגדרות › התקנה ותחזוקת מערכת האינטרקום › תצורת המערכת. The rest of WisKey's platform, in the
 * order an installer reaches for it: health (integrity, stored events, capacity per station), each station's metadata and maintenance
 * window, a change to several stations at once (now, or queued into each station's window - preview first, results per station), the
 * maintenance queue (its states are the progress), event retention (preview how much is deleted), the webhook (and its key, shown once),
 * and the configuration file (export / import with a preview and a station mapping). Every write goes through the confirmation dialog;
 * the deleting / fleet-wide / key-revealing ones need the typed phrase WisKey's operation names.
 */
@customElement('installer-platform')
export class InstallerPlatform extends LitElement {
  @state() private view: PlatformView | null = null;
  @state() private loadState: 'loading' | 'ready' | 'error' = 'loading';
  @state() private loadError = '';
  @state() private confirm: ConfirmRequest | null = null;
  @state() private flash: { tone: 'ok' | 'warn'; text: string } | null = null;
  // station metadata
  @state() private metaStation = '';
  @state() private meta: StationMeta | null = null;
  @state() private tagsText = '';
  // fleet change
  @state() private chosen = new Set<string>();
  @state() private door = 1;
  @state() private changeMode: 'config' | 'maintenance' = 'config';
  @state() private changes: DoorValues = {};
  @state() private preview: ChangePreview | null = null;
  @state() private previewError = '';
  @state() private receipts: Receipt[] | null = null;
  // retention
  @state() private ret = { days: '30', count: '5000', mb: '16' };
  @state() private retPreview: { review_id: string; before: number | null; removed: number | null } | null = null;
  // webhook
  @state() private hook: PlatformData['webhook'] | null = null;
  @state() private key = '';
  // import
  @state() private importContent = '';
  @state() private importMap: Record<string, string> = {};
  @state() private importReview: ImportReview | null = null;
  @state() private importError = '';

  static styles = [
    settingsStyles,
    installerStyles,
    css`
      :host {
        display: block;
      }
      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      th,
      td {
        text-align: start;
        padding: 6px 8px;
        border-block-end: 1px solid var(--sw-border);
        overflow-wrap: anywhere;
      }
      th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-sm);
      }
      .scroll {
        overflow-x: auto;
      }
      .days {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .days label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .key {
        font-family: var(--sw-font-mono, ui-monospace, monospace);
        font-size: var(--sw-fs-sm);
        direction: ltr;
        overflow-wrap: anywhere;
        user-select: all;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-3);
      }
      .bar {
        block-size: 6px;
        border-radius: 3px;
        background: var(--sw-surface-3);
        overflow: hidden;
        min-inline-size: 60px;
      }
      .bar span {
        display: block;
        block-size: 100%;
        background: var(--sw-accent);
      }
      .bar[data-alert='near_limit'] span,
      .bar[data-alert='growth_to_limit'] span {
        background: var(--sw-warn, var(--sw-accent));
      }
      .bar[data-alert='at_limit'] span {
        background: var(--sw-danger, var(--sw-err));
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.view = await getPlatform();
      const p = this.view.platform.data;
      if (p) {
        this.hook = { ...p.webhook, kinds: [...p.webhook.kinds] };
        if (p.retention.days !== null) this.ret = { days: String(p.retention.days), count: String(p.retention.count), mb: String(Math.round(((p.retention.bytes ?? 0) / MB) * 100) / 100) };
      }
      if (this.metaStation) this.pickMeta(this.metaStation);
      this.loadState = 'ready';
    } catch (err) {
      this.loadState = 'error';
      this.loadError = errText(err);
    }
  }

  private get stations() {
    return this.view?.stations ?? [];
  }

  private nameOf(id: string | null): string {
    return this.stations.find((s) => s.id === id)?.name ?? id ?? '';
  }

  private section<T>(p: { state: string; error: { message: string } | null; data: T | null }, heading: string, attr: string, body: (d: T) => TemplateResult): TemplateResult {
    if (!p.data) return html`<sw-card heading=${heading} data-part=${attr} data-state="error"><div class="msg err" role="alert">${fill(T.clock.sectionUnavailable, { message: p.error?.message ?? '' })}</div></sw-card>`;
    return html`<sw-card heading=${heading} data-part=${attr} data-state="ready">${body(p.data)}</sw-card>`;
  }

  // ---------------------------------------------------------------- health and capacity

  private healthCard(): TemplateResult {
    const v = this.view!;
    return this.section(v.integrity, X.healthTitle, 'health', (i) => {
      const bad = i.checks.filter((c) => c.state !== 'available');
      const usage = v.platform.data?.event_usage;
      return html`<div class="check"><span>${X.integrity}</span>
          <sw-badge kind=${bad.length ? 'error' : 'live'} label=${bad.length ? fill(X.integrityBad, { list: bad.map((c) => X.components[c.component ?? ''] ?? c.component).join(', ') }) : X.integrityOk}></sw-badge></div>
        ${usage
          ? html`<div class="check"><span>${X.events}</span><span class="val">${fill(X.eventsLine, { records: String(usage.records ?? T.none), limit: String(usage.count_limit ?? T.none), rate: String(usage.observed_records_per_day ?? T.none) })}</span></div>`
          : nothing}
        ${v.demo.data ? html`<div class="hint">${X.demo}</div>` : nothing}
        <div class="hint">${X.noWrites}</div>`;
    });
  }

  private capacityCard(): TemplateResult {
    return this.section(this.view!.capacity, X.capacityTitle, 'capacity', (c) => html`<div class="hint">${X.capacityHint}</div>
      <div class="list">
        ${c.records.map((r) => {
          const kind = (label: string, k: typeof r.users) => html`<div class="grow"><span class="muted">${label}: ${k.count ?? T.none} / ${k.advertised_limit ?? T.none} · ${X.alerts[k.alert ?? 'unknown'] ?? k.alert}</span>
              <div class="bar" data-alert=${k.alert ?? 'unknown'} aria-hidden="true"><span style="inline-size:${Math.min(100, k.used_percent ?? 0)}%"></span></div>
              ${k.estimated_days_to_limit !== null ? html`<span class="muted">${fill(X.daysTo, { d: k.estimated_days_to_limit })}</span>` : nothing}</div>`;
          return html`<div class="item" data-capacity=${r.station_id ?? ''}><div class="grow"><b dir="auto">${r.name ?? r.station_id}</b></div>${kind(X.users, r.users)}${kind(X.cards, r.cards)}</div>`;
        })}
      </div>`);
  }

  // ---------------------------------------------------------------- station metadata

  private pickMeta(id: string): void {
    this.metaStation = id;
    const row = this.view?.platform.data?.stations[id]?.values;
    this.meta = row ? JSON.parse(JSON.stringify(row)) : EMPTY_META();
    if (this.meta && !this.meta.window) this.meta.window = EMPTY_META().window;
    this.tagsText = (this.meta?.tags ?? []).join(', ');
  }

  private metaValues(): StationMeta {
    const m = this.meta!;
    return { ...m, zone: m.zone ?? '', owner: m.owner ?? '', tags: this.tagsText.split(',').map((t) => t.trim()).filter(Boolean), window: m.window };
  }

  private askMeta(): void {
    const p = this.view?.platform.data;
    if (!p || !this.meta) return;
    const values = this.metaValues();
    const before = p.stations[this.metaStation]?.values ?? null;
    this.confirm = {
      heading: fill(X.metaHeading, { name: this.nameOf(this.metaStation) }),
      body: X.metaBody,
      diff: diffRows(before ? { zone: before.zone, owner: before.owner, tags: before.tags.join(', '), window: JSON.stringify(before.window) } : null,
        { zone: values.zone, owner: values.owner, tags: values.tags.join(', '), window: JSON.stringify(values.window) }).map((d) => ({ ...d, label: d.key === 'zone' ? X.zone : d.key === 'owner' ? X.owner : d.key === 'tags' ? X.tags : X.windowOn })),
      maxSeconds: 15,
      send: () => saveStationMeta(this.metaStation, p.revision, values),
      done: () => {
        this.flash = { tone: 'ok', text: X.saved };
        void this.load();
      },
    };
  }

  private metaCard(): TemplateResult {
    const m = this.meta;
    const w = m?.window;
    const wbad = w ? windowErrors(w) : [];
    const setW = (patch: Partial<NonNullable<StationMeta['window']>>) => (this.meta = { ...m!, window: { ...w!, ...patch } });
    return html`<sw-card heading=${X.metaTitle} data-meta>
      <div class="hint">${X.metaHint}</div>
      <div class="pickrow"><label class="f"><span>${D.pick}</span>
        <select class="pick" @change=${(e: Event) => this.pickMeta((e.target as HTMLSelectElement).value)} data-meta-pick>
          <option value="" ?selected=${!this.metaStation}>—</option>
          ${this.stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.metaStation}>${s.name}</option>`)}
        </select></label></div>
      ${m && w
        ? html`<div class="grid2">
              <label class="f"><span>${X.zone}</span><input dir="auto" .value=${m.zone ?? ''} @input=${(e: Event) => (this.meta = { ...m, zone: (e.target as HTMLInputElement).value })} data-meta-field="zone" /></label>
              <label class="f"><span>${X.owner}</span><input dir="auto" .value=${m.owner ?? ''} @input=${(e: Event) => (this.meta = { ...m, owner: (e.target as HTMLInputElement).value })} /></label>
              <label class="f"><span>${X.tags}</span><input dir="auto" .value=${this.tagsText} @input=${(e: Event) => (this.tagsText = (e.target as HTMLInputElement).value)} /></label>
              ${(['offline', 'sync_stalled', 'event_gap'] as const).map(
                (k) => html`<label class="f"><span>${X.thresholds[k]}</span><input inputmode="numeric" dir="ltr" .value=${String(m.thresholds[k] ?? '')}
                  @input=${(e: Event) => (this.meta = { ...m, thresholds: { ...m.thresholds, [k]: Number((e.target as HTMLInputElement).value) } })} /></label>`,
              )}
            </div>
            <label class="opt"><input type="checkbox" .checked=${w.enabled} @change=${(e: Event) => setW({ enabled: (e.target as HTMLInputElement).checked })} data-window-on /><span>${X.windowOn}</span></label>
            ${w.enabled
              ? html`<div class="days" role="group" aria-label=${X.dayNames}>
                    ${X.days.map((label, i) => html`<label><input type="checkbox" .checked=${w.days.includes(i)}
                      @change=${(e: Event) => setW({ days: (e.target as HTMLInputElement).checked ? [...w.days, i].sort() : w.days.filter((d) => d !== i) })} />${label}</label>`)}
                  </div>
                  <div class="grid2">
                    <label class="f"><span>${X.start}</span><input type="time" dir="ltr" lang=${dateInputLang()} .value=${w.start ?? ''} aria-invalid=${wbad.includes('start') ? 'true' : 'false'} @input=${(e: Event) => setW({ start: (e.target as HTMLInputElement).value })} /></label>
                    <label class="f"><span>${X.end}</span><input type="time" dir="ltr" lang=${dateInputLang()} .value=${w.end ?? ''} aria-invalid=${wbad.includes('end') ? 'true' : 'false'} @input=${(e: Event) => setW({ end: (e.target as HTMLInputElement).value })} /></label>
                    <label class="f"><span>${X.timezone}</span><input dir="ltr" .value=${w.timezone ?? ''} @input=${(e: Event) => setW({ timezone: (e.target as HTMLInputElement).value })} /></label>
                  </div>
                  ${wbad.length ? html`<div class="field-error" role="alert">${wbad.map((b) => X.invalid[b] ?? b).join(' · ')}</div>` : nothing}`
              : nothing}
            <div class="foot"><sw-button variant="primary" ?disabled=${wbad.length > 0} @click=${() => this.askMeta()} data-meta-save>${X.saveMeta}</sw-button></div>`
        : nothing}
    </sw-card>`;
  }

  // ---------------------------------------------------------------- a change to several stations

  private async runPreview(): Promise<void> {
    this.preview = null;
    this.previewError = '';
    this.receipts = null;
    try {
      this.preview = (await previewChange(this.changeMode, [...this.chosen], this.door, this.changes)).data;
    } catch (err) {
      this.previewError = errText(err);
    }
  }

  private askChange(): void {
    const p = this.preview;
    const typed = this.view!.typed[this.changeMode === 'config' ? 'config_apply' : 'maint_enqueue'];
    if (!p?.review_id) return;
    const n = p.count ?? 0;
    const now = this.changeMode === 'config';
    this.confirm = {
      heading: fill(now ? X.applyHeading : X.enqueueHeading, { n }),
      body: now ? X.applyBody : X.enqueueBody,
      typed,
      danger: true,
      maxSeconds: 58,
      send: (t) => (now ? applyChange(p.review_id!, t ?? '') : enqueueMaintenance(p.review_id!, t ?? '')),
      done: (reply) => {
        this.preview = null;
        if (now) {
          this.receipts = (reply as { data: { receipts: Receipt[] } }).data.receipts;
          const s = receiptSummary(this.receipts);
          this.flash = s.failed ? { tone: 'warn', text: X.partial } : { tone: 'ok', text: T.result.completed };
        } else this.flash = { tone: 'ok', text: T.result.completed };
        void this.load();
      },
    };
  }

  private changeCard(): TemplateResult {
    const setChange = (k: keyof DoorValues, v: unknown) => {
      const next = { ...this.changes } as Record<string, unknown>;
      if (v === '' || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) delete next[k];
      else next[k] = v;
      this.changes = next as DoorValues;
      this.preview = null;
    };
    const canPreview = this.chosen.size >= 1 && this.chosen.size <= 12 && Object.keys(this.changes).length > 0;
    return html`<sw-card heading=${X.changeTitle} data-change>
      <div class="hint">${X.changeHint}</div>
      <div class="days" role="group" aria-label=${X.stations}>
        ${this.stations.map((s) => html`<label><input type="checkbox" .checked=${this.chosen.has(s.id)} data-change-station=${s.id}
          @change=${(e: Event) => {
            const next = new Set(this.chosen);
            if ((e.target as HTMLInputElement).checked) next.add(s.id);
            else next.delete(s.id);
            this.chosen = next;
            this.preview = null;
          }} /><span dir="auto">${s.name}</span></label>`)}
      </div>
      <div class="grid2">
        <label class="f"><span>${X.door}</span><select @change=${(e: Event) => ((this.door = Number((e.target as HTMLSelectElement).value)), (this.preview = null))} data-change-door>
          <option value="1" ?selected=${this.door === 1}>1</option><option value="2" ?selected=${this.door === 2}>2</option></select></label>
        <label class="f"><span>${X.mode}</span><select @change=${(e: Event) => ((this.changeMode = (e.target as HTMLSelectElement).value as 'config' | 'maintenance'), (this.preview = null))} data-change-mode>
          <option value="config" ?selected=${this.changeMode === 'config'}>${X.modeNow}</option><option value="maintenance" ?selected=${this.changeMode === 'maintenance'}>${X.modeWindow}</option></select></label>
        <label class="f"><span>${D.fields.doorName}</span><input dir="auto" .value=${String(this.changes.doorName ?? '')} @input=${(e: Event) => setChange('doorName', (e.target as HTMLInputElement).value)} data-change-field="doorName" /></label>
        <label class="f"><span>${D.fields.openDuration}</span><input inputmode="numeric" dir="ltr" .value=${String(this.changes.openDuration ?? '')}
          @input=${(e: Event) => {
            const raw = (e.target as HTMLInputElement).value.trim();
            setChange('openDuration', raw === '' ? '' : Number(raw));
          }} data-change-field="openDuration" /></label>
      </div>
      <div class="foot"><sw-button variant="secondary" ?disabled=${!canPreview} @click=${() => void this.runPreview()} data-change-preview>${X.preview}</sw-button></div>
      ${this.previewError ? html`<div class="msg err" role="alert">${this.previewError}</div>` : nothing}
      ${this.preview
        ? html`<div class="scroll"><table data-change-rows>
              <thead><tr><th>${D.pick}</th><th>${T.confirm.before}</th><th>${T.confirm.after}</th></tr></thead>
              <tbody>${this.preview.rows.map((r) => html`<tr data-row=${r.station_id ?? ''}><td dir="auto">${r.name ?? r.station_id}</td>
                ${r.error ? html`<td colspan="2" class="field-error">${r.error}</td>`
                  : html`<td>${DOOR_FIELDS.filter((k) => k in this.changes).map((k) => html`<div>${D.fields[k]}: ${String(r.before?.[k] ?? T.none)}</div>`)}</td>
                         <td>${DOOR_FIELDS.filter((k) => k in this.changes).map((k) => html`<div><b>${D.fields[k]}: ${String(r.after?.[k] ?? T.none)}</b></div>`)}</td>`}</tr>`)}</tbody>
            </table></div>
            ${this.preview.review_id
              ? html`<div class="foot"><sw-button variant="danger" @click=${() => this.askChange()} data-change-apply>${this.changeMode === 'config' ? X.apply : X.enqueue}</sw-button></div>`
              : html`<div class="hint">${X.previewEmpty}</div>`}`
        : nothing}
      ${this.receipts
        ? html`<div class="list" data-receipts aria-label=${X.receipts}>${this.receipts.map((r) => html`<div class="item" data-receipt=${r.station_id ?? ''} data-state=${r.state ?? ''}>
              <span dir="auto">${this.nameOf(r.station_id)}</span>
              <sw-badge kind=${r.state === 'verified' ? 'live' : 'error'} label=${r.state === 'verified' ? X.receiptOk : fill(X.receiptFail, { code: r.code ?? '' })}></sw-badge></div>`)}</div>`
        : nothing}
    </sw-card>`;
  }

  private queueCard(): TemplateResult {
    return this.section(this.view!.maintenance, X.queueTitle, 'queue', (q) =>
      q.records.length === 0
        ? html`<div class="hint">${X.noJobs}</div>`
        : html`<div class="list">${q.records.map((j: MaintJob) => html`<div class="item" data-maint-job=${j.id ?? ''} data-state=${j.state ?? ''}>
            <div class="grow"><b>${X.jobStates[j.state ?? 'unknown'] ?? j.state}</b>
              ${j.rows.map((r) => html`<span class="muted"><span dir="auto">${r.name ?? r.station_id}</span> · ${X.rowStates[r.state ?? 'unknown'] ?? r.state}${r.code ? ` (${r.code})` : ''}</span>`)}</div>
            ${j.state === 'queued' || j.state === 'awaiting_approval'
              ? html`<sw-button size="sm" variant="ghost" @click=${() => (this.confirm = { heading: X.cancelHeading, body: X.cancelBody, maxSeconds: 15, send: () => cancelMaintenance(j), done: () => void this.load() })} data-maint-cancel>${X.cancelJob}</sw-button>`
              : nothing}
          </div>`)}</div>`,
    );
  }

  // ---------------------------------------------------------------- retention, webhook, export / import

  private retValues() {
    return { days: Number(this.ret.days), count: Number(this.ret.count), bytes: Math.round(Number(this.ret.mb) * MB) };
  }

  private async runRetPreview(): Promise<void> {
    try {
      const r = (await previewRetention(this.retValues())).data;
      this.retPreview = { review_id: r.review_id, before: r.before, removed: r.removed };
    } catch (err) {
      this.flash = { tone: 'warn', text: errText(err) };
    }
  }

  private retentionCard(): TemplateResult {
    const v = this.retValues();
    const ok = Number.isInteger(v.days) && v.days >= 1 && v.days <= 365 && Number.isInteger(v.count) && v.count >= 100 && v.count <= 20000 && v.bytes >= 262144 && v.bytes <= 25_165_824;
    const set = (k: 'days' | 'count' | 'mb') => (e: Event) => ((this.ret = { ...this.ret, [k]: (e.target as HTMLInputElement).value }), (this.retPreview = null));
    const rp = this.retPreview;
    return html`<sw-card heading=${X.retentionTitle} data-retention>
      <div class="hint">${X.retentionHint}</div>
      <div class="grid2">
        <label class="f"><span>${X.retDays}</span><input inputmode="numeric" dir="ltr" .value=${this.ret.days} @input=${set('days')} data-ret="days" /></label>
        <label class="f"><span>${X.retCount}</span><input inputmode="numeric" dir="ltr" .value=${this.ret.count} @input=${set('count')} data-ret="count" /></label>
        <label class="f"><span>${X.retMb}</span><input inputmode="decimal" dir="ltr" .value=${this.ret.mb} @input=${set('mb')} data-ret="mb" /></label>
      </div>
      ${rp ? html`<div class="msg ${rp.removed ? 'warn' : 'ok'}" role="status" data-ret-preview>${fill(X.retRemoved, { removed: rp.removed ?? 0, before: rp.before ?? 0 })}</div>` : nothing}
      <div class="foot">
        <sw-button variant="secondary" ?disabled=${!ok} @click=${() => void this.runRetPreview()} data-ret-check>${X.retPreview}</sw-button>
        ${rp
          ? html`<sw-button variant="danger" @click=${() =>
              (this.confirm = { heading: X.retHeading, body: fill(X.retBody, { removed: rp.removed ?? 0 }), typed: this.view!.typed.retention_apply, danger: true, maxSeconds: 30,
                send: (t) => applyRetention(rp.review_id, t ?? ''), done: () => ((this.retPreview = null), (this.flash = { tone: 'ok', text: T.result.completed }), void this.load()) })} data-ret-apply>${X.retApply}</sw-button>`
          : nothing}
      </div>
    </sw-card>`;
  }

  private webhookCard(): TemplateResult {
    const h = this.hook;
    const p = this.view!.platform.data;
    if (!h || !p) return html``;
    const bad = webhookErrors(h);
    const changed = JSON.stringify({ ...h, kinds: [...h.kinds].sort() }) !== JSON.stringify({ ...p.webhook, kinds: [...p.webhook.kinds].sort() });
    return html`<sw-card heading=${X.webhookTitle} data-webhook>
      <div class="hint">${X.webhookHint}</div>
      <label class="opt"><input type="checkbox" .checked=${h.enabled} @change=${(e: Event) => (this.hook = { ...h, enabled: (e.target as HTMLInputElement).checked })} data-hook-on /><span>${X.webhookOn}</span></label>
      <label class="f"><span>${X.url}</span><input dir="ltr" inputmode="url" .value=${h.url} aria-invalid=${bad.includes('url') ? 'true' : 'false'} @input=${(e: Event) => (this.hook = { ...h, url: (e.target as HTMLInputElement).value.trim() })} data-hook-url />
        ${bad.includes('url') ? html`<span class="field-error">${X.invalid.url}</span>` : nothing}</label>
      <div class="days" role="group">${Object.entries(X.kinds).map(([k, label]) => html`<label><input type="checkbox" .checked=${h.kinds.includes(k)}
        @change=${(e: Event) => (this.hook = { ...h, kinds: (e.target as HTMLInputElement).checked ? [...h.kinds, k] : h.kinds.filter((x) => x !== k) })} />${label}</label>`)}</div>
      ${bad.includes('kinds') ? html`<div class="field-error">${X.invalid.kinds}</div>` : nothing}
      ${this.key ? html`<div class="hint">${X.keyShown}</div><div class="key" data-hook-key>${this.key}</div>` : nothing}
      <div class="foot">
        <sw-button variant="primary" ?disabled=${!changed || bad.length > 0} @click=${() =>
          (this.confirm = { heading: X.webhookHeading, body: X.webhookBody, maxSeconds: 15, send: () => saveWebhook(p.revision, { ...h, kinds: [...h.kinds].sort() }),
            done: () => ((this.flash = { tone: 'ok', text: X.saved }), void this.load()) })} data-hook-save>${X.saveWebhook}</sw-button>
        ${this.key
          ? html`<sw-button variant="ghost" @click=${() => (this.key = '')} data-hook-hide>${X.hideKey}</sw-button>`
          : html`<sw-button variant="ghost" @click=${() =>
              (this.confirm = { heading: X.keyHeading, body: X.keyBody, typed: this.view!.typed.webhook_key, danger: true, maxSeconds: 15, send: (t) => revealWebhookKey(t ?? ''),
                done: (reply) => (this.key = (reply as { data: { key: string } }).data.key) })} data-hook-key-show>${X.showKey}</sw-button>`}
      </div>
    </sw-card>`;
  }

  private async download(): Promise<void> {
    try {
      const r = await exportPlatform();
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'intercom-configuration.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      this.flash = { tone: 'warn', text: errText(err) };
    }
  }

  private async readFile(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    this.importReview = null;
    this.importError = '';
    if (!file) return;
    this.importContent = (await file.text()).slice(0, 60000);
    try {
      const parsed = JSON.parse(this.importContent) as { stations?: Record<string, unknown> };
      this.importMap = Object.fromEntries(Object.keys(parsed.stations ?? {}).map((k) => [k, this.stations.some((s) => s.id === k) ? k : '']));
    } catch {
      this.importError = T.errorTitle;
    }
  }

  private ioCard(): TemplateResult {
    const review = this.importReview;
    const mapped = Object.values(this.importMap).every(Boolean);
    return html`<sw-card heading=${X.ioTitle} data-io>
      <div class="hint">${X.ioHint}</div>
      <div class="foot"><sw-button variant="secondary" @click=${() => void this.download()} data-export>${X.export}</sw-button></div>
      <label class="f"><span>${X.importLabel}</span><input type="file" accept="application/json,.json" @change=${(e: Event) => void this.readFile(e)} data-import-file /></label>
      ${Object.keys(this.importMap).map((k) => html`<label class="f"><span dir="auto">${k} → ${X.mapTo}</span>
        <select @change=${(e: Event) => ((this.importMap = { ...this.importMap, [k]: (e.target as HTMLSelectElement).value }), (this.importReview = null))} data-import-map=${k}>
          <option value="" ?selected=${!this.importMap[k]}>—</option>${this.stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.importMap[k]}>${s.name}</option>`)}
        </select></label>`)}
      ${this.importError ? html`<div class="msg err" role="alert">${this.importError}</div>` : nothing}
      ${this.importContent
        ? html`<div class="foot"><sw-button variant="secondary" ?disabled=${!mapped} @click=${async () => {
            try {
              this.importReview = (await previewImport(this.importContent, this.importMap)).data;
              this.importError = '';
            } catch (err) {
              this.importError = errText(err);
            }
          }} data-import-preview>${X.importPreview}</sw-button>
            ${review
              ? html`<sw-button variant="danger" @click=${() =>
                  (this.confirm = { heading: X.importHeading, body: fill(X.importBody, { n: review.stations.length, t: review.templates ?? 0 }), typed: this.view!.typed.import_apply, danger: true,
                    maxSeconds: 30, send: (t) => applyImport(review.review_id, t ?? ''),
                    done: () => ((this.importReview = null), (this.importContent = ''), (this.importMap = {}), (this.flash = { tone: 'ok', text: fill(X.imported, { n: review.stations.length }) }), void this.load()) })}
                  data-import-apply>${X.importApply}</sw-button>`
              : nothing}</div>`
        : nothing}
    </sw-card>`;
  }

  render(): TemplateResult {
    if (this.loadState === 'loading') return html`<sw-state-panel state="loading" heading=${T.loading} compact data-platform="loading"></sw-state-panel>`;
    if (this.loadState === 'error' || !this.view) {
      return html`<sw-state-panel state="error" heading=${T.errorTitle} hint=${this.loadError} actionLabel=${T.retry} @action=${() => void this.load()} data-platform="error"></sw-state-panel>`;
    }
    return html`<div class="sections" data-platform="ready">
      ${this.flash ? html`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>` : nothing}
      ${this.healthCard()}${this.capacityCard()}${this.metaCard()}${this.changeCard()}${this.queueCard()}${this.retentionCard()}${this.webhookCard()}${this.ioCard()}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${() => (this.confirm = null)}></wk-installer-confirm>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'installer-platform': InstallerPlatform;
  }
}

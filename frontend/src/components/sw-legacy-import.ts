import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-card';
import './sw-dialog';
import './sw-icon';
import './sw-pager';
import './sw-state-panel';
import './sw-table';
import type { TableColumn } from './sw-table';
import type { StateKind } from './sw-badge';
import { ApiError, describeError } from '../api/client';
import { fmtBytes } from '../api/backup';
import { dayMonthTimeText } from '../api/day-format';
import {
  LEGACY_ACTIONS, legacyApply, legacyDryRun, legacyStatus, pageRows, writeCount,
  type LegacyAction, type LegacyApplyResult, type LegacyItem, type LegacyReport, type LegacyRow, type LegacyStatus,
} from '../api/legacy-migration';
import { confirmWord, confirmWordTyped } from '../i18n/confirm-words';
import { tr } from '../i18n/msg/components';
import { settingsStyles } from '../styles/settings';
import { PHONE_MQ } from '../design/mobile-polish-css';

/** The report's table: rows per page (owner rule 2026-10-24: a list on a settings card is paged, never scrolled). */
const PAGE_WIDE = 8;
const PAGE_PHONE = 5;
/** The newest runs listed under the card. */
const RUNS_SHOWN = 3;

const ACTION_LABEL: Record<LegacyAction, string> = {
  update: tr('יועתק'),
  create: tr('ייווצר'),
  manual: tr('לטיפול ידני'),
  keep: tr('נשמר כמו שהוא'),
  same: tr('כבר זהה'),
  skip: tr('לא מועבר'),
  info: tr('לידיעה'),
};
/** The badge per action: a write stands out (accent), "a person does this" is amber and dashed, "not carried" is quiet and dashed. */
const ACTION_KIND: Record<LegacyAction, StateKind> = {
  update: 'historic', create: 'historic', manual: 'partial', keep: 'neutral', same: 'neutral', skip: 'unknown', info: 'neutral',
};

const AREA_LABEL: Record<string, string> = {
  cameras: tr('מצלמות'),
  connection: tr('חיבור ה־NVR'),
  options: tr('אפשרויות התוסף'),
  people: tr('אנשים והרשאות'),
  time: tr('זמן ההקלטות'),
  manual_recording: tr('הקלטות ידניות'),
  events: tr('יומן האירועים'),
  layouts: tr('פריסות'),
  schedules: tr('לוחות זמנים'),
  notifications: tr('התראות'),
  override: tr('קובץ ההתאמות'),
};

/** What one row is about, by its id (`<area>.<ident>`); an unknown id shows its ident as it is (left to right). */
const SUBJECT: Record<string, string> = {
  'connection.host': tr('כתובת ה־NVR'),
  'connection.http_port': tr('פורט HTTP'),
  'connection.rtsp_port': tr('פורט RTSP'),
  'connection.user': tr('משתמש NVR'),
  'connection.password': tr('סיסמת NVR'),
  'people.app_pin': tr('PIN של היישום'),
  'people.technician_pin': tr('PIN טכנאי'),
  'time.display_offset': tr('הסטת השעה בהקלטות'),
  'layouts.live_grid': tr('פריסת הצפייה החיה'),
  'schedules.recording': tr('לוחות זמנים להקלטה'),
  'notifications.all': tr('התראות'),
};

const CONTAINER_LABEL: Record<string, string> = {
  json: tr('קובץ JSON'),
  jsonl: tr('יומן אירועים (JSON lines)'),
  zip: tr('ארכיון ZIP'),
  tar: tr('ארכיון TAR'),
  ha_backup: tr('גיבוי מלא של מערכת הבית'),
  export: tr('ייצוא של כלי ההעברה'),
};

const FOUND_LABEL: Record<string, string> = {
  options: tr('אפשרויות התוסף'),
  override: tr('קובץ ההתאמות'),
  events: tr('יומן האירועים'),
  addon_meta: tr('פרטי התוסף'),
};

const isAction = (a: string): a is LegacyAction => (LEGACY_ACTIONS as readonly string[]).includes(a);
const shortSha = (s: string) => s.slice(0, 12);

/**
 * LEGACY-IMPORT-UI-2550 (T070; owner rule = recommendations Q1 a, Q3 a): Settings › גיבוי ושחזור › "ייבוא מהמערכת הישנה" - the import from
 * the legacy NVR add-on 1.5.27 on the three existing routes (api/legacy-migration.ts):
 *   1. pick the file (a full unprotected home-system backup, a ZIP / TAR of the add-on's files, or the export of the workstation script):
 *      the dry run starts at once and writes nothing;
 *   2. the report: what was read, the counts per action, the warnings and every item with its action and the server's note (Hebrew or
 *      English, by the reader's language), grouped by area and paged (no scrolling list);
 *   3. apply: a dialog that says what changes (only empty camera aliases), that a project backup `auto-pre-legacy-import` is written first,
 *      and takes the typed confirm word; a 409 "changed since the dry run" is shown as it is, with "run the check again";
 *   4. the result: what was copied, the backup's name, the run record (and the newest runs under the card).
 * System administrators only: the parent draws it for `system.configure`, and the card draws nothing when the server refuses (403) or
 * does not have the routes (404). Fires `backups-changed` (bubbles, composed) after an apply that wrote a backup.
 */
@customElement('sw-legacy-import')
export class SwLegacyImport extends LitElement {
  @state() private status: LegacyStatus | null = null;
  /** 403 / 404: this user (or this server) has no legacy import - nothing is drawn */
  @state() private hidden = false;
  @state() private loadErr = '';
  @state() private file: File | null = null;
  @state() private report: LegacyReport | null = null;
  @state() private busy: '' | 'check' | 'apply' = '';
  @state() private err = '';
  /** the server answered 409 `legacy_plan_changed`: the report on screen is no longer what an apply would do */
  @state() private stale = false;
  @state() private page = 1;
  @state() private dialog = false;
  @state() private confirm = '';
  @state() private dialogErr = '';
  @state() private result: LegacyApplyResult | null = null;
  @state() private phone = typeof matchMedia === 'function' && matchMedia(PHONE_MQ).matches;
  private phoneMq: MediaQueryList | null = null;
  private readonly onPhoneMq = (e: MediaQueryListEvent) => { this.phone = e.matches; };

  connectedCallback() {
    super.connectedCallback();
    if (typeof matchMedia === 'function') {
      this.phoneMq = matchMedia(PHONE_MQ);
      this.phoneMq.addEventListener('change', this.onPhoneMq);
    }
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq?.removeEventListener('change', this.onPhoneMq);
  }

  private async load() {
    this.loadErr = '';
    try {
      this.status = await legacyStatus();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) this.hidden = true;
      else this.loadErr = describeError(err);
    }
  }

  private pickFile() {
    (this.renderRoot.querySelector('input[data-legacy-file]') as HTMLInputElement | null)?.click();
  }

  private async onFile(f: File | undefined) {
    if (!f) return;
    this.file = f;
    this.result = null;
    await this.check();
  }

  /** The dry run of the chosen file (again after a 409): nothing is written on the server, an audit row only. */
  private async check() {
    if (!this.file || this.busy) return;
    this.busy = 'check';
    this.err = '';
    this.report = null;
    this.stale = false;
    this.page = 1;
    try {
      this.report = await legacyDryRun(this.file);
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  private reset() {
    this.file = null;
    this.report = null;
    this.result = null;
    this.err = '';
    this.stale = false;
    this.page = 1;
  }

  private openApply() {
    this.confirm = '';
    this.dialogErr = '';
    this.dialog = true;
  }

  private async apply() {
    const r = this.report;
    if (!r || !this.file || this.busy || !confirmWordTyped('legacy_import_apply', this.confirm)) return;
    this.busy = 'apply';
    this.dialogErr = '';
    try {
      const out = await legacyApply(this.file, r.plan_digest, this.confirm);
      this.result = out;
      this.dialog = false;
      this.report = null;
      this.file = null;
      if (out.backup) this.dispatchEvent(new CustomEvent('backups-changed', { bubbles: true, composed: true }));
      void this.load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'legacy_plan_changed') {
        // honest: the plan on screen is not what the server would do now - nothing was written; the check has to run again
        this.dialog = false;
        this.stale = true;
        this.err = describeError(err);
      } else {
        this.dialogErr = describeError(err);
      }
    } finally {
      this.busy = '';
      this.confirm = '';
    }
  }

  private subject(it: LegacyItem): string {
    const ch = it.target?.channel;
    if ((it.area === 'cameras' || it.area === 'manual_recording') && ch !== undefined && ch !== null) {
      const head = tr('ערוץ {ch}', { ch: String(ch) });
      return it.value ? `${head} · ${it.value}` : head;
    }
    if (it.area === 'events') return tr('{n} רשומות', { n: Number(it.target?.rows ?? 0) });
    return SUBJECT[it.id] ?? it.value ?? it.id.slice(it.area.length + 1);
  }

  private columns(): TableColumn[] {
    const item = (r: Record<string, unknown>) => r as unknown as LegacyItem;
    return [
      { key: 'subject', label: tr('פריט'), width: '30%', card: 'title', kind: 'truncate', cellTitle: (r) => this.subject(item(r)), render: (r) => html`<bdi>${this.subject(item(r))}</bdi>` },
      {
        key: 'action', label: tr('פעולה'), width: '9rem', card: 'badge', kind: 'status',
        render: (r) => { const a = item(r).action; return html`<sw-badge kind=${isAction(a) ? ACTION_KIND[a] : 'neutral'} label=${isAction(a) ? ACTION_LABEL[a] : a}></sw-badge>`; },
      },
      { key: 'note', label: tr('הסבר'), card: 'show', render: (r) => item(r).note },
    ];
  }

  private renderPick() {
    const max = this.status ? fmtBytes(this.status.max_bytes) : '…';
    return html`<div class="row" data-legacy-pick><span class="lbl">${tr('קובץ מהמערכת הישנה')}<span class="muted">${tr('גיבוי מלא של מערכת הבית (לא מוצפן), ZIP / TAR של קבצי התוסף, או הייצוא שלו · עד {max} · הקובץ לא נשמר', { max })}</span></span>
      <span class="end"><input type="file" hidden data-legacy-file accept=".json,.jsonl,.zip,.tar,.tgz,.gz,application/json,application/zip,application/x-tar,application/gzip"
        @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.onFile(inp.files?.[0]); inp.value = ''; }} />
        <sw-button size="sm" icon="upload" ?disabled=${!!this.busy || !this.status} data-legacy-choose @click=${() => this.pickFile()}>${this.busy === 'check' ? tr('בודק…') : this.file ? tr('קובץ אחר…') : tr('בחר קובץ…')}</sw-button></span></div>
      <div class="hint">${tr('קודם רק בדיקה: מוצג מה ייווצר, ישתנה, יישמר או יידרש ממך. שום דבר לא משתנה עד האישור.')}</div>`;
  }

  private renderSource(r: LegacyReport) {
    const s = r.source;
    const found = s.found.map((f) => FOUND_LABEL[f] ?? f).join(' · ');
    return html`<div class="src" data-legacy-source>
      <span class="name"><bdi>${this.file?.name ?? ''}</bdi></span>
      <span class="muted">${CONTAINER_LABEL[s.container] ?? s.container} · ${fmtBytes(s.bytes)} · ${tr('גרסה {v}', { v: s.legacy_version ?? '?' })}${found ? html` · ${tr('נמצאו: {found}', { found })}` : nothing}</span>
    </div>`;
  }

  private renderSummary(r: LegacyReport) {
    const shown = LEGACY_ACTIONS.filter((a) => (r.summary[a] ?? 0) > 0);
    return html`<div class="sum" data-legacy-summary>${shown.map((a) => html`<sw-badge data-legacy-count=${a} kind=${ACTION_KIND[a]} label=${`${ACTION_LABEL[a]} · ${r.summary[a]}`}></sw-badge>`)}</div>`;
  }

  private renderTable(r: LegacyReport) {
    const size = this.phone ? PAGE_PHONE : PAGE_WIDE;
    const { rows, pages, page } = pageRows(r.items, this.page, size);
    const heading = (x: Record<string, unknown>) => {
      const row = x as unknown as LegacyRow;
      return row.kind === 'head' ? `${AREA_LABEL[row.area] ?? row.area} · ${row.count}` : null;
    };
    const hooks = (x: Record<string, unknown>) => {
      const row = x as unknown as LegacyRow;
      return row.kind === 'head' ? { 'data-legacy-group': row.area } : { 'data-legacy-item': row.id, 'data-action': row.action };
    };
    return html`<sw-table bare static-rows data-legacy-items .columns=${this.columns()} .rows=${rows as unknown as Record<string, unknown>[]} rowKey="id"
        .groupHeading=${heading} .rowAttrs=${hooks} emptyText=${tr('בקובץ אין פריטים של המערכת הישנה')}></sw-table>
      ${pages > 1 ? html`<div class="pager"><sw-pager data-legacy-pager .page=${page} .pages=${pages} @page-change=${(e: CustomEvent<{ page: number }>) => (this.page = e.detail.page)}></sw-pager></div>` : nothing}`;
  }

  private renderReport(r: LegacyReport) {
    const writes = writeCount(r);
    const before = r.applied_before[0];
    return html`${this.renderSource(r)}
      ${this.renderSummary(r)}
      ${r.warnings.map((w) => html`<div class="msg warn" role="note" data-legacy-warning=${w.code}><sw-icon name="warning" size=${13}></sw-icon>${w.note}</div>`)}
      ${before ? html`<div class="msg ok" role="note" data-legacy-applied-before><sw-icon name="history" size=${13}></sw-icon>${tr('הקובץ הזה כבר יובא ב־{when}. ייבוא חוזר לא ישנה דבר שכבר הועתק.', { when: dayMonthTimeText(new Date(before.at)) })}</div>` : nothing}
      ${this.renderTable(r)}
      <div class="foot">
        <sw-button variant="primary" icon="upload" ?disabled=${!!this.busy || this.stale || writes === 0} data-legacy-apply-open @click=${() => this.openApply()}>${tr('ייבוא…')}</sw-button>
        <sw-button variant="ghost" icon="refresh" ?disabled=${!!this.busy} data-legacy-recheck @click=${() => void this.check()}>${tr('לבדוק שוב')}</sw-button>
        <sw-button variant="ghost" ?disabled=${!!this.busy} data-legacy-clear @click=${() => this.reset()}>${tr('ביטול')}</sw-button>
        <span class="muted" data-legacy-writes>${writes === 0 ? tr('אין מה לייבא: כל מה שאפשר להעתיק כבר נמצא ב־Arx.') : tr('ישתנו {n} כינויי מצלמות ריקים. ב־NVR, במערכת הבית וב־go2rtc לא ישתנה דבר.', { n: writes })}</span>
      </div>`;
  }

  private renderResult(out: LegacyApplyResult) {
    const chans = out.cameras.map((c) => c.channel).join(', ');
    return html`<div class="msg ok" role="status" data-legacy-result>
        <sw-icon name="check" size=${13}></sw-icon>${out.already_applied ? tr('הקובץ הזה כבר יובא: לא השתנה דבר ולא נכתב גיבוי.') : tr('הייבוא הסתיים: הועתקו {n} כינויים, {m} נשארו כמו שהם.', { n: out.applied, m: out.unchanged })}
      </div>
      <dl class="facts" data-legacy-result-facts>
        <div><dt>${tr('גיבוי לפני השינוי')}</dt><dd data-legacy-result-backup>${out.backup ? html`<bdi class="ltr">${out.backup.name}</bdi> · ${fmtBytes(out.backup.bytes)}` : tr('לא נדרש')}</dd></div>
        ${chans ? html`<div><dt>${tr('ערוצים שעודכנו')}</dt><dd class="num" data-legacy-result-channels>${chans}</dd></div>` : nothing}
        <div><dt>${tr('נרשם')}</dt><dd>${dayMonthTimeText(new Date(out.run.at))}${out.run.by ? html` · <bdi>${out.run.by}</bdi>` : nothing}</dd></div>
        <div><dt>${tr('טביעת הקובץ')}</dt><dd><code class="ltr">${shortSha(out.run.sha256)}</code></dd></div>
      </dl>
      <div class="hint">${tr('הפעולה נרשמה ביומן הפעולות. אפשר לחזור למצב הקודם בשחזור הגיבוי שלמעלה.')}</div>
      <div class="foot"><sw-button size="sm" data-legacy-done @click=${() => this.reset()}>${tr('סיום')}</sw-button></div>`;
  }

  private renderRuns(s: LegacyStatus) {
    if (!s.runs.length || this.report) return nothing;
    return html`<div class="runs" data-legacy-runs>
      <div class="grouplabel">${tr('ייבואים קודמים')}</div>
      ${s.runs.slice(0, RUNS_SHOWN).map((r) => html`<div class="run" data-legacy-run>
        <span>${dayMonthTimeText(new Date(r.at))}${r.by ? html` · <bdi>${r.by}</bdi>` : nothing}</span>
        <span class="muted">${tr('הועתקו {n} · ללא שינוי {m}', { n: r.applied, m: r.unchanged })}${r.backup ? html` · <bdi class="ltr">${r.backup}</bdi>` : nothing}</span>
      </div>`)}
    </div>`;
  }

  private renderDialog(r: LegacyReport) {
    const word = confirmWord('legacy_import_apply');
    const ok = confirmWordTyped('legacy_import_apply', this.confirm) !== null;
    const kind = this.status?.backup_kind ?? 'auto-pre-legacy-import';
    return html`<sw-dialog open heading=${tr('ייבוא מהמערכת הישנה')} subheading=${this.file?.name ?? ''} data-legacy-dialog @close=${() => { if (this.busy !== 'apply') this.dialog = false; }}>
      <div class="msg ok" role="note" data-legacy-dialog-backup><sw-icon name="history" size=${13}></sw-icon>${tr('לפני כל שינוי ייכתב גיבוי של הפרויקט ({kind}). אם הגיבוי לא נכתב - שום דבר לא משתנה.', { kind })}</div>
      <div class="muted" data-legacy-dialog-what>${tr('ישתנו ב־Arx {n} כינויי מצלמות שריקים היום. כינוי קיים לא נדרס. ב־NVR, במערכת הבית וב־go2rtc לא ישתנה דבר.', { n: writeCount(r) })}</div>
      ${this.dialogErr ? html`<div class="msg err" role="alert" data-legacy-dialog-error><sw-icon name="warning" size=${13}></sw-icon>${this.dialogErr}</div>` : nothing}
      <label class="muted cw" for="legacy-confirm">${tr('לאישור הקלידו')} <code>${word}</code></label>
      <input id="legacy-confirm" class="confirm-in" dir="auto" autocomplete="off" data-legacy-confirm placeholder=${word} .value=${this.confirm}
        @input=${(e: Event) => (this.confirm = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && ok) void this.apply(); }} />
      <div slot="footer"><sw-button variant="primary" icon="upload" ?disabled=${!ok || !!this.busy} data-legacy-apply @click=${() => void this.apply()}>${this.busy === 'apply' ? tr('מייבא…') : tr('ייבא עכשיו')}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy === 'apply'} @click=${() => (this.dialog = false)}>${tr('ביטול')}</sw-button></div>
    </sw-dialog>`;
  }

  render() {
    if (this.hidden) return nothing;
    const s = this.status;
    return html`<sw-card heading=${tr('ייבוא מהמערכת הישנה')} subheading=${tr('מהתוסף הקודם (גרסה {v}) · מנהלי מערכת בלבד', { v: s?.legacy_version ?? '1.5.27' })} data-legacy-import>
      ${this.loadErr
        ? html`<sw-state-panel compact state="error" heading=${tr('מצב הייבוא לא נטען')} hint=${this.loadErr} actionLabel=${tr('נסו שוב')} @action=${() => void this.load()}></sw-state-panel>`
        : !s
          ? html`<sw-state-panel compact state="loading"></sw-state-panel>`
          : html`${this.result ? this.renderResult(this.result) : this.renderPick()}
              ${this.err ? html`<div class="msg err" role="alert" data-legacy-error><sw-icon name="warning" size=${13}></sw-icon><span>${this.err}</span>
                ${this.stale ? html`<sw-button size="sm" icon="refresh" data-legacy-rerun @click=${() => void this.check()}>${tr('להריץ את הבדיקה שוב')}</sw-button>` : nothing}</div>` : nothing}
              ${this.busy === 'check' ? html`<sw-state-panel compact state="loading" data-legacy-checking></sw-state-panel>` : nothing}
              ${this.report && !this.result ? this.renderReport(this.report) : nothing}
              ${this.renderRuns(s)}`}
    </sw-card>
    ${this.dialog && this.report ? this.renderDialog(this.report) : nothing}`;
  }

  static styles = [settingsStyles, css`
    :host { display: block; }
    .end { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--sw-s-2); }
    .src { display: grid; gap: var(--sw-s-1); padding-block: var(--sw-s-2); }
    .src .name { font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); overflow-wrap: anywhere; }
    .sum { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); padding-block-end: var(--sw-s-2); }
    .pager { display: flex; justify-content: flex-end; padding-block-start: var(--sw-s-2); }
    .foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sw-s-2); }
    .runs { display: grid; gap: var(--sw-s-1); padding-block-start: var(--sw-s-3); }
    .run { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--sw-s-1) var(--sw-s-3); font-size: var(--sw-fs-sm); }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: var(--sw-s-2) var(--sw-s-4); margin: 0; padding-block: var(--sw-s-2); }
    .facts dt { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .facts dd { margin: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); overflow-wrap: anywhere; }
    .facts .num { font-variant-numeric: tabular-nums; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    code { font-family: var(--sw-font-mono, monospace); }
    .cw { display: block; margin-block-start: var(--sw-s-3); }
    .confirm-in { inline-size: 100%; box-sizing: border-box; font: inherit; margin-block-start: var(--sw-s-2); padding: var(--sw-s-2) var(--sw-s-3);
      border: thin solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); }
    .confirm-in:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 0; border-color: var(--sw-accent); }
    @media (pointer: coarse) {
      .confirm-in { min-block-size: var(--sw-ctl-h-lg); }
    }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-legacy-import': SwLegacyImport;
  }
}

import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/run-trace';
import '../components/script-fields-form';
import { aIcon, blockIcon, domainIcon } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass, autoApi } from '../api/automations-demo';
import { bidi } from '../i18n/bidi';
import {
  childLists, controlsSchedules, copyItem, deleteItem, mapAutomationError, readOnlyChip, runAutomation, runNeedsConfirm, runScriptNow, stopScriptNow, walkDraft,
  type AnyDraft, type AutomationDraft, type AutomationsStatus, type Block, type DryRunResult, type ItemDetail, type ItemKind, type Mode, type RunSummary, type RunTrace, type ScriptDraft,
  type VersionRow,
} from '../api/automations';
import { commandId } from '../api/request-id';
import { areaLine, fieldDefaults, missingFields, type FieldChoice, cardChips, confirmLine, deletedText, floorLine, keepText, runRows, whenText, type DrawerView } from './automations-logic';
import type { TrashRow } from '../api/automations';

export type DrawerResult = { text: string; tone: 'ok' | 'error'; action?: { label: string; run: () => void } };

const MODE_CHIP: Record<Mode, string> = { single: 'התעלם', restart: 'התחל מחדש', queued: 'המתן בתור', parallel: 'הרץ במקביל' };
const LIST_LABEL: Record<string, string> = { conditions: 'אם', if: 'אם', then: 'אז', else: 'אחרת', default: 'אחרת', sequence: 'אז' };

/**
 * CR-017 `<automation-drawer .kind .itemId .view .runId .trash .status .now>`: the detail of one automation or script (and the trash), a
 * modal `sw-drawer` (a side sheet on a desktop, a bottom sheet on a phone). The detail: the banners that explain what the caller may not do
 * (view-only, a configuration-file item, an invalid item, a change made outside), the item's sentence, its blocks as an outline (כאשר · אם · אז;
 * locked blocks with a padlock), the devices it touches, the last runs, and the actions the caller may take (עריכה, הרץ עכשיו, בדיקה, למה זה רץ,
 * גרסאות, שכפול, מחיקה). The sub-views: "למה זה רץ" (the run chips and `<run-trace>`), the versions (restore), the dry-run, and the trash
 * (restore). A script shows its fields form and runs with the values. It loads and writes through `autoApi()` and tells the screen what happened
 * with events: `drawer-close`, `view-change` {view, run}, `edit` {kind, id}, `changed` {id}, `deleted` {trash_id, name, kind, id}, `copied` {item}, `result`.
 * Opening the builder is the screen's job (`edit`); the builder itself is `<automation-builder>` (S4).
 */
@customElement('automation-drawer')
export class AutomationDrawer extends LitElement {
  @property() kind: ItemKind = 'automation';
  @property() itemId = '';
  @property({ type: Boolean }) open = false;
  @property() view: DrawerView = 'detail';
  @property() runId = '';
  @property({ type: Boolean }) trash = false;
  @property({ attribute: false }) status: AutomationsStatus | null = null;
  @property({ attribute: false }) now: Date = new Date();
  @state() private phase: 'loading' | 'ready' | 'missing' | 'forbidden' | 'error' = 'loading';
  @state() private item: ItemDetail | null = null;
  @state() private errorText = '';
  @state() private runs: RunSummary[] | null = null;
  @state() private trace: RunTrace | null = null;
  @state() private traceBusy = false;
  @state() private traceError = '';
  @state() private versions: VersionRow[] | null = null;
  /** `?do=run|copy|delete` of the address (a card's menu): the drawer opens that confirmation once the item is loaded. */
  @property() action = '';
  @state() private dry: DryRunResult | null = null;
  @state() private dryBusy = false;
  @state() private busy = false;
  @state() private confirm: 'run' | 'delete' | 'copy' | 'restore' | null = null;
  @state() private copyName = '';
  @state() private restoring: VersionRow | null = null;
  @state() private conflict: ItemDetail | null = null;
  @state() private values: Record<string, unknown> = {};
  @state() private valid = true;
  @state() private trashRows: TrashRow[] | null = null;
  @state() private choices: Record<string, FieldChoice[]> = {};
  private loadedKey = '';

  static styles = [...automationsStyles, css`
    :host {
      display: contents;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .desc {
      font-size: 13.5px;
      color: var(--dv-text-2);
    }
    .blk .chip.warn {
      flex: none;
    }
    .dev {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 52px;
      padding: 8px 12px;
      border-radius: 14px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
    }
    .dev .bi {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .dev .bi .ic {
      font-size: 16px;
    }
    .dev .bt {
      flex: 1;
      min-inline-size: 0;
      font-size: 14px;
    }
    .dev .bt small {
      display: block;
      color: var(--dv-text-3);
      font-size: 12px;
    }
    .run {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 48px;
      padding: 8px 12px;
      border-radius: 14px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      color: inherit;
      text-align: start;
      inline-size: 100%;
      box-sizing: border-box;
      font-size: 13.5px;
    }
    a.run,
    button.run {
      cursor: pointer;
      text-decoration: none;
    }
    .run:hover {
      border-color: var(--dv-border-strong, var(--dv-border));
    }
    .run .t {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      flex: none;
    }
    .run .s {
      flex: 1;
      min-inline-size: 0;
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .runchips {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-block-end: 2px;
    }
    .runchips::-webkit-scrollbar {
      display: none;
    }
    .rc {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      block-size: 38px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      font-size: 13px;
      font-weight: 600;
      color: var(--dv-text);
    }
    .rc[aria-pressed='true'] {
      background: var(--dv-text);
      color: var(--mm-text-inverse);
      border-color: transparent;
    }
    .ver {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
    }
    .ver.cur {
      background: var(--dv-accent-soft);
      border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    }
    .ver .vh {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 14px;
      flex-wrap: wrap;
    }
    .ver .vs {
      grid-column: 1;
      font-size: 13.5px;
    }
    .ver .vm {
      grid-column: 1;
      font-size: 12.5px;
      color: var(--dv-text-2);
    }
    .ver .btn {
      grid-column: 2;
      grid-row: 1 / span 3;
    }
    .tr {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      gap: 4px 12px;
      align-items: center;
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
    }
    .tr .bi {
      grid-row: 1 / span 3;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
    }
    .tr .bi .ic {
      font-size: 17px;
    }
    .tr b {
      font-size: 14.5px;
    }
    .tr small {
      grid-column: 2;
      color: var(--dv-text-2);
      font-size: 12.5px;
    }
    .tr .urgent {
      color: var(--dv-danger);
    }
    .tr .trbtns {
      grid-column: 3;
      grid-row: 1 / span 3;
      display: flex;
      gap: 6px;
    }
    .dry-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: 14px;
    }
    .dry-row .st {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .dry-row .st.ok {
      background: var(--dv-success-soft);
      color: var(--au-ok-text);
    }
    .dry-row .st.bad {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .dry-row .st .ic {
      font-size: 15px;
    }
    .dry-row .arrow {
      margin-inline-start: auto;
      color: var(--dv-text-2);
      font-size: 13px;
    }
    .skl-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .center {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
      padding: 30px 10px;
    }
    .center b {
      font-size: 16px;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      font-size: 14px;
      color: var(--dv-text-2);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .foot2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(c: PropertyValues<this>) {
    const key = `${this.open}|${this.trash}|${this.kind}|${this.itemId}`;
    if (this.open && key !== this.loadedKey) {
      this.loadedKey = key;
      this.dry = null;
      this.conflict = null;
      this.confirm = null;
      this.runs = null;
      this.versions = null;
      this.trace = null;
      if (this.trash) void this.loadTrash();
      else if (this.itemId) void this.load();
    } else if (!this.open && this.loadedKey) {
      this.loadedKey = '';
    }
    if (this.open && !this.trash && (c.has('view') || c.has('runId')) && this.item) void this.loadView();
  }

  // ------------------------------------------------------------------------------------------------ data

  /** Reloads whatever is open (the screen calls it when the server says something changed). */
  async refresh(): Promise<void> {
    if (this.trash) return this.loadTrash();
    if (this.itemId) await this.load(true);
  }

  private async load(quiet = false) {
    if (!quiet) { this.phase = 'loading'; this.item = null; }
    try {
      const it = await autoApi().get(this.kind, this.itemId);
      this.item = it;
      this.phase = 'ready';
      this.errorText = '';
      if (it.kind === 'script') {
        const fields = (it.draft as ScriptDraft).fields;
        if (!quiet || !Object.keys(this.values).length) this.values = fieldDefaults(fields);
        this.valid = missingFields(fields, this.values).length === 0;
        void this.loadChoices(fields.filter((f) => f.selector.kind === 'entity').length > 0);
      }
      void this.loadRuns();
      this.applyAction();
      await this.loadView();
    } catch (err) {
      const f = mapAutomationError(err);
      if (f.status === 404) this.phase = 'missing';
      else if (f.status === 403) this.phase = 'forbidden'; // owner decision 1b: no view-only access - a deep link to an automation the caller may not edit
      else { this.phase = 'error'; this.errorText = f.message; }
    }
  }

  private async loadChoices(any: boolean) {
    if (!any) return;
    try {
      const cat = await autoApi().catalog();
      const out: Record<string, FieldChoice[]> = {};
      for (const f of (this.item?.draft as ScriptDraft).fields) {
        if (f.selector.kind !== 'entity') continue;
        const domains = f.selector.domains;
        out[f.key] = cat.entities.filter((e) => !domains.length || domains.includes(e.domain)).map((e) => ({ value: e.entity_id, label: e.name }));
      }
      this.choices = out;
    } catch {
      this.choices = {}; // a caller without the catalogue sees the field's default choice only
    }
  }

  private async loadRuns() {
    if (!this.item || this.item.kind === 'scene') return;
    try { this.runs = await autoApi().runs(this.item.kind, this.item.id); } catch { this.runs = []; }
  }

  private async loadView() {
    if (!this.item) return;
    if (this.view === 'dryrun' && !this.dry && !this.dryBusy) void this.dryRun();
    if (this.view === 'versions' && !this.versions) {
      try { this.versions = await autoApi().versions(this.item.kind, this.item.id); } catch { this.versions = []; }
    }
    if (this.view === 'trace') {
      if (!this.runs) await this.loadRuns();
      const id = this.runId || this.runs?.[0]?.run_id || '';
      if (!id) { this.trace = null; return; }
      if (this.trace?.run_id === id) return;
      this.traceBusy = true;
      this.traceError = '';
      try { this.trace = await autoApi().runTrace(this.item.kind, this.item.id, id); } catch (err) { this.traceError = mapAutomationError(err).message; this.trace = null; } finally { this.traceBusy = false; }
    }
  }

  private async loadTrash() {
    this.phase = 'loading';
    try { this.trashRows = await autoApi().trash(); this.phase = 'ready'; } catch (err) { this.errorText = mapAutomationError(err).message; this.phase = 'error'; }
  }

  // ------------------------------------------------------------------------------------------------ events

  private fire<T>(name: string, detail?: T) {
    if (!this.isConnected) return; // a drawer closes itself while the screen is torn down (a route change): that is not the user's close
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  private say(text: string, tone: 'ok' | 'error' = 'ok', action?: DrawerResult['action']) {
    this.fire<DrawerResult>('result', { text, tone, action });
  }
  private close = () => this.fire('drawer-close');
  private go(view: DrawerView, run = '') {
    this.fire('view-change', { view, run });
  }

  // ------------------------------------------------------------------------------------------------ actions

  /** Maps a failed write to the drawer's state (a conflict shows its banner) and a Hebrew note. */
  private failed(err: unknown) {
    const f = mapAutomationError(err);
    if (f.kind === 'conflict' && f.current) this.conflict = f.current;
    this.say(f.message, 'error');
    return f;
  }

  private async run(confirmed = false) {
    const it = this.item;
    if (!it || this.busy) return;
    if (!confirmed && runNeedsConfirm(it)) { this.confirm = 'run'; return; }
    this.confirm = null;
    this.busy = true;
    try {
      if (it.kind === 'script') await runScriptNow(it.id, this.values, { confirm: confirmed || undefined });
      else await runAutomation(it.id, { skip_condition: true, confirm: confirmed || undefined });
      this.say(it.kind === 'script' ? 'הסקריפט הופעל' : 'האוטומציה הורצה');
      this.fire('changed', { id: it.id });
      window.setTimeout(() => void this.load(true), 250);
    } catch (err) {
      const f = mapAutomationError(err);
      if (f.kind === 'confirm' && !confirmed) this.confirm = 'run';
      else this.failed(err);
    } finally {
      this.busy = false;
    }
  }

  private async stop() {
    const it = this.item;
    if (!it || this.busy) return;
    this.busy = true;
    try { await stopScriptNow(it.id); this.say('הסקריפט נעצר'); this.fire('changed', { id: it.id }); await this.load(true); } catch (err) { this.failed(err); } finally { this.busy = false; }
  }

  /** The dry-run view (`?view=dryrun`): asks the server what the conditions say now and what would change; nothing runs. */
  private async dryRun() {
    const it = this.item;
    if (!it || this.dryBusy) return;
    this.dry = null;
    this.dryBusy = true;
    try { this.dry = await autoApi().dryRun(it.kind, it.id); } catch (err) { this.say(mapAutomationError(err).message, 'error'); this.go('detail'); } finally { this.dryBusy = false; }
  }

  /** A card's menu asked for run / copy / delete: open that confirmation (the dialogs live here), then tell the screen to clear the address. */
  private applyAction() {
    const it = this.item;
    const a = this.action;
    if (!it || !a) return;
    if (a === 'run' && it.can.run) void this.run();
    else if (a === 'copy' && it.can.copy) { this.copyName = `${it.name} (עותק)`; this.confirm = 'copy'; }
    else if (a === 'delete' && it.can.delete) this.confirm = 'delete';
    this.fire('action-done');
  }

  private async doDelete() {
    const it = this.item;
    if (!it || this.busy) return;
    this.busy = true;
    try {
      const r = await deleteItem(it.kind, it.id, it.revision, { confirm: true });
      this.confirm = null;
      this.fire('deleted', { trash_id: r.trash_id, name: it.name, kind: it.kind, id: it.id });
    } catch (err) {
      this.confirm = null;
      this.failed(err);
    } finally {
      this.busy = false;
    }
  }

  private async doCopy() {
    const it = this.item;
    const name = this.copyName.trim();
    if (!it || !name || this.busy) return;
    this.busy = true;
    try {
      const r = await copyItem(it.kind, it.id, name);
      this.confirm = null;
      if (r.item) this.fire('copied', { item: r.item });
      else this.say('נשמר', 'ok');
    } catch (err) {
      this.confirm = null;
      this.failed(err);
    } finally {
      this.busy = false;
    }
  }

  private async doRestore() {
    const it = this.item;
    const v = this.restoring;
    if (!it || !v || this.busy) return;
    this.busy = true;
    try {
      await autoApi().restoreVersion(it.kind, it.id, v.version_id, { base_revision: it.revision, client_request_id: commandId() });
      this.confirm = null;
      this.restoring = null;
      this.versions = null;
      this.say('הגרסה שוחזרה');
      this.fire('changed', { id: it.id });
      await this.load(true);
      await this.loadView();
    } catch (err) {
      this.confirm = null;
      this.failed(err);
    } finally {
      this.busy = false;
    }
  }

  private async restoreFromTrash(t: TrashRow) {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await autoApi().restoreTrash(t.trash_id, { client_request_id: `restore-${t.trash_id}-${Date.now()}` });
      this.say(`"${t.name}" שוחזר`);
      this.fire('changed', { id: r.item?.id ?? t.config_id });
      this.trashRows = (this.trashRows ?? []).filter((x) => x.trash_id !== t.trash_id);
    } catch (err) {
      this.say(mapAutomationError(err).message, 'error');
    } finally {
      this.busy = false;
    }
  }

  private async purge(t: TrashRow) {
    if (this.busy) return;
    this.busy = true;
    try {
      await autoApi().purgeTrash(t.trash_id);
      this.trashRows = (this.trashRows ?? []).filter((x) => x.trash_id !== t.trash_id);
      this.say(`"${t.name}" נמחק לצמיתות`);
    } catch (err) {
      this.say(mapAutomationError(err).message, 'error');
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------------ pieces

  private blockRow(b: Block, nested = false, label = ''): TemplateResult {
    const locked = b.kind === 'locked';
    const sched = locked && controlsSchedules(b);
    return html`<div class=${`blk${locked ? ' locked' : ''}${nested ? ' nested' : ''}`} data-block=${b.uid} data-block-kind=${b.kind}>
      <span class="bi">${aIcon(blockIcon(b))}</span>
      <span class="bt">${label ? html`<small>${label}</small>` : nothing}${bidi(locked ? `${b.label}${b.sentence && b.sentence !== b.label ? ` · ${b.sentence}` : ''}` : b.sentence)}</span>
      ${sched ? html`<span class="chip warn" data-chip="schedules">${aIcon('calendar')}שולט בתזמונים</span>` : nothing}
      ${locked && b.sensitive ? html`<span class="chip sens">${aIcon('shield')}רגישה</span>` : nothing}
    </div>`;
  }

  private nestedRows(b: Block, depth = 0): TemplateResult[] {
    if (depth >= 2) return [];
    const out: TemplateResult[] = [];
    for (const l of childLists(b)) {
      const tail = l.name.split('.').pop() ?? l.name;
      l.blocks.forEach((c, i) => {
        out.push(this.blockRow(c, true, i === 0 ? LIST_LABEL[tail] ?? '' : ''));
        out.push(...this.nestedRows(c, depth + 1));
      });
    }
    return out;
  }

  private section(num: 1 | 2 | 3, title: string, icon: Parameters<typeof aIcon>[0], blocks: Block[]): TemplateResult | typeof nothing {
    if (!blocks.length) return nothing;
    return html`<section class="sect" data-section=${num}>
      <h4><span class=${`tag t${num}`}>${aIcon(icon)}</span>${title} <span class="num">${blocks.length}</span></h4>
      ${blocks.map((b) => html`${this.blockRow(b)}${this.nestedRows(b)}`)}
    </section>`;
  }

  private banners(it: ItemDetail): TemplateResult {
    const out: TemplateResult[] = [];
    const ro = readOnlyChip(it);
    if (this.conflict) {
      out.push(html`<div class="banner warn" role="alert" data-drawer-conflict>${aIcon('warning')}<div><b>הפריט שונה במקום אחר</b><small>טענו את הגרסה העדכנית והחליטו מה לשמור.</small></div><button type="button" class="btn sm" data-conflict-reload @click=${() => { this.conflict = null; void this.load(true); }}>טען מחדש</button></div>`);
    }
    if (ro) {
      const yaml = ro.code === 'yaml_managed' || ro.code === 'no_config_id';
      out.push(html`<div class=${`banner ${yaml ? 'warn' : 'info'}`} data-drawer-readonly=${ro.code}>${aIcon(yaml ? 'eye' : ro.code === 'delegation_off' ? 'lock' : 'eye')}<div><b>${yaml ? 'מוגדרת בקובץ תצורה' : ro.text}</b>${yaml ? html`<small>לצפייה בלבד. עריכה: בתשתית המערכת.</small>` : nothing}</div></div>`);
    }
    if (it.state === 'invalid') out.push(html`<div class="banner bad" data-drawer-invalid>${aIcon('warning')}<div><b>לא פעילה – שגיאה בהגדרה</b>${it.warnings.find((w) => w.code === 'invalid_config')?.message ? html`<small>${it.warnings.find((w) => w.code === 'invalid_config')!.message}</small>` : nothing}</div></div>`);
    if (it.warnings.some((w) => w.code === 'changed_outside')) out.push(html`<div class="banner info" data-drawer-outside>${aIcon('history')}<div><b>שונתה מחוץ למערכת</b></div><button type="button" class="btn sm" @click=${() => this.go('versions')}>גרסאות</button></div>`);
    return html`${out}`;
  }

  private detail(it: ItemDetail): TemplateResult {
    const isScript = it.kind === 'script';
    const d = it.draft as AutomationDraft & ScriptDraft;
    const blocks = walkDraft(it.draft as AnyDraft).length;
    const chips = cardChips(it, { sensitiveWarning: this.status?.ui.sensitive_warning !== false });
    const targets = it.targets.filter((t, i, a) => a.findIndex((x) => x.entity_id === t.entity_id) === i);
    return html`<div class="stack" data-drawer-detail>
      ${this.banners(it)}
      ${it.sentence ? html`<div class="sentence" data-drawer-sentence>${aIcon('bolt')}<div>${it.sentence}${it.description ? html`<small>${it.description}</small>` : nothing}</div></div>` : nothing}
      ${chips.length || it.mode ? html`<div class="chips">${it.mode ? html`<span class="chip" data-chip="mode">${MODE_CHIP[it.mode]}</span>` : nothing}${chips.filter((c) => c.id !== 'read_only').map((c) => html`<span class=${`chip ${c.id === 'sensitive' ? 'sens' : c.tone === 'bad' ? 'bad' : c.tone === 'warn' ? 'warn' : ''}`} data-chip=${c.id}>${aIcon(c.id === 'sensitive' ? 'shield' : c.id === 'locked' ? 'lock' : 'warning')}${c.label}</span>`)}</div>` : nothing}
      ${isScript && d.fields?.some((f) => f.selector.kind !== 'locked')
        ? html`<script-fields-form .fields=${d.fields} .values=${this.values} .entityChoices=${this.choices} @change=${(e: CustomEvent<{ values: Record<string, unknown>; valid: boolean }>) => { this.values = e.detail.values; this.valid = e.detail.valid; }}></script-fields-form>`
        : nothing}
      ${isScript ? this.section(3, 'אז', 'play', d.sequence ?? []) : html`${this.section(1, 'כאשר', 'bolt', d.triggers ?? [])}${this.section(2, 'אם', 'help', d.conditions ?? [])}${this.section(3, 'אז', 'play', d.actions ?? [])}`}
      ${!blocks ? html`<div class="empty-note">אין פירוט להצגה</div>` : nothing}
      ${targets.length ? html`<section class="sect" data-section="devices"><h4>${aIcon('layers')}מכשירים מושפעים <span class="num">${targets.length}</span></h4>${targets.map((t) => html`<div class="dev" data-target=${t.entity_id}><span class="bi">${aIcon(domainIcon(t.entity_id))}</span><span class="bt">${bidi(t.name)}<small>${bidi([t.floor, t.area].filter(Boolean).join(' · '))}</small></span>${t.missing ? html`<span class="chip bad">${aIcon('warning')}חסר</span>` : t.sensitive ? html`<span class="chip sens">${aIcon('shield')}רגישה</span>` : nothing}</div>`)}</section>` : nothing}
      ${this.runs && this.runs.length ? html`<section class="sect" data-section="runs"><h4>${aIcon('history')}ריצות אחרונות <span class="num">${it.runs_7d ?? this.runs.length}</span></h4>
        ${runRows(this.runs.slice(0, 3), this.now).map((r) => html`<button type="button" class="run" data-run-row=${r.run_id} @click=${() => this.go('trace', r.run_id)}><i class=${`dot ${r.tone === 'none' ? '' : r.tone}`}></i><span class="t">${r.label}</span><span class="s">${r.sentence}</span>${aIcon('chevronBack')}</button>`)}</section>` : nothing}
    </div>`;
  }

  private traceView(it: ItemDetail): TemplateResult {
    const rows = runRows(this.runs ?? [], this.now);
    const cur = this.runId || rows[0]?.run_id || '';
    return html`<div class="stack" data-drawer-trace>
      ${rows.length ? html`<div class="runchips" role="group" aria-label="ריצות">${rows.map((r) => html`<button type="button" class="rc" aria-pressed=${String(r.run_id === cur)} data-run-chip=${r.run_id} @click=${() => this.go('trace', r.run_id)}>${r.label}<i class=${`dot ${r.tone === 'none' ? '' : r.tone}`}></i></button>`)}</div>` : html`<div class="empty-note" data-trace-empty>אין ריצות להצגה</div>`}
      ${this.traceBusy ? html`<div class="skl-stack"><span class="skl" style="block-size:70px"></span><span class="skl" style="block-size:120px"></span><span class="skl" style="block-size:200px"></span></div>` : nothing}
      ${this.traceError ? html`<div class="banner bad" role="alert">${aIcon('warning')}${this.traceError}</div>` : nothing}
      ${this.trace && !this.traceBusy ? html`<run-trace .trace=${this.trace} .mode=${it.mode} .now=${this.now}></run-trace>` : nothing}
    </div>`;
  }

  private versionsView(it: ItemDetail): TemplateResult {
    if (!this.versions) return html`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`;
    const canRestore = it.can.edit;
    return html`<div class="stack" data-drawer-versions>${this.versions.map((v) => html`<div class=${`ver${v.current ? ' cur' : ''}`} data-version=${v.version_id}>
      <div class="vh"><span>${v.version_id}${v.current ? ' · נוכחית' : ''}</span>${v.via === 'external' ? html`<span class="chip warn">${aIcon('history')}מחוץ למערכת</span>` : nothing}</div>
      <div class="vs">${v.summary}</div>
      <div class="vm">${whenText(v.at, this.now)}${v.actor ? ` · ${v.actor}` : ''}</div>
      ${!v.current && canRestore ? html`<button type="button" class="btn sm" data-version-restore=${v.version_id} @click=${() => { this.restoring = v; this.confirm = 'restore'; }}>${aIcon('restore')}שחזר</button>` : nothing}
    </div>`)}</div>`;
  }

  private dryView(): TemplateResult {
    if (this.dryBusy || !this.dry) return html`<div class="skl-stack"><span class="skl" style="block-size:60px"></span><span class="skl" style="block-size:60px"></span></div>`;
    const d = this.dry;
    return html`<div class="stack" data-drawer-dryrun>
      <section class="sect"><h4>${aIcon('help')}תנאים <span class="num">${d.conditions.length}</span></h4>
        ${d.conditions.length ? d.conditions.map((c) => html`<div class="dry-row"><span class=${`st ${c.passed === true ? 'ok' : c.passed === false ? 'bad' : ''}`}>${aIcon(c.passed === true ? 'check' : c.passed === false ? 'close' : 'minus')}</span><span>${bidi(c.sentence)}</span>${c.passed === null ? html`<span class="arrow">לא ניתן לבדוק</span>` : nothing}</div>`) : html`<div class="empty-note">אין תנאים</div>`}</section>
      <section class="sect"><h4>${aIcon('layers')}מה ישתנה <span class="num">${d.effects.entities.length}</span></h4>
        ${d.effects.entities.length ? d.effects.entities.map((e) => html`<div class="dry-row"><span class="bt">${bidi(e.name)}</span><span class="arrow">${e.from ?? '—'} ← ${e.to ?? '—'}</span></div>`) : html`<div class="empty-note">אין שינוי במכשירים</div>`}
        ${d.effects.unknown ? html`<div class="banner info">${aIcon('info')}יש פעולה מתקדמת שהשפעתה אינה ידועה</div>` : nothing}</section>
    </div>`;
  }

  private trashView(): TemplateResult {
    if (this.phase === 'error') return html`<div class="center" data-drawer-state="error">${aIcon('warning', 30)}<b>${this.errorText}</b><button type="button" class="btn sm" @click=${() => void this.loadTrash()}>${aIcon('refresh')}נסו שוב</button></div>`;
    if (this.trashRows === null || this.phase === 'loading') return html`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`;
    if (!this.trashRows.length) return html`<div class="center" data-drawer-state="trash-empty">${aIcon('trash', 30)}<b>סל המחזור ריק</b></div>`;
    return html`<div class="stack" data-drawer-trash>${this.trashRows.map((t) => {
      const keep = keepText(t.expires_at, this.now);
      return html`<div class="tr" data-trash=${t.trash_id}>
        <span class="bi">${aIcon(t.kind === 'script' ? 'script' : t.kind === 'scene' ? 'sparkle' : 'bolt')}</span>
        <b>${bidi(t.name)} ${t.sensitive ? html`<span class="chip sens">${aIcon('shield')}רגישה</span>` : nothing}</b>
        <small>${t.sentence}</small>
        <small>${deletedText(t.deleted_at, this.now)}${t.deleted_by ? ` · ${t.deleted_by}` : ''} · <span class=${keep.urgent ? 'urgent' : ''}>${keep.text}</span></small>
        <span class="trbtns">${t.can_restore ? html`<button type="button" class="btn sm" data-trash-restore=${t.trash_id} ?disabled=${this.busy} @click=${() => void this.restoreFromTrash(t)}>${aIcon('restore')}שחזר</button>` : nothing}${this.status?.can.manage && this.status?.can.configure ? html`<button type="button" class="btn sm quiet dz" data-trash-purge=${t.trash_id} aria-label=${`מחיקה לצמיתות · ${t.name}`} ?disabled=${this.busy} @click=${() => void this.purge(t)}>${aIcon('trash')}</button>` : nothing}</span>
      </div>`;
    })}</div>`;
  }

  private stateBox(): TemplateResult | null {
    if (this.phase === 'loading') return html`<div class="skl-stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span></div>`;
    if (this.phase === 'missing') return html`<div class="center" data-drawer-state="missing">${aIcon('search', 30)}<b>הפריט לא נמצא</b></div>`;
    if (this.phase === 'forbidden') return html`<div class="center" data-drawer-state="forbidden">${aIcon('lock', 30)}<b>אין הרשאה</b></div>`;
    if (this.phase === 'error') return html`<div class="center" data-drawer-state="error">${aIcon('warning', 30)}<b>${this.errorText || 'לא ניתן לטעון'}</b><button type="button" class="btn sm" @click=${() => void this.load()}>${aIcon('refresh')}נסו שוב</button></div>`;
    return null;
  }

  private footer(it: ItemDetail): TemplateResult | typeof nothing {
    const sub = this.view;
    if (sub === 'trace') {
      return html`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>סגירה</button>${it.can.run ? html`<button type="button" class="btn" data-drawer-run ?disabled=${this.busy} @click=${() => void this.run()}>${aIcon('play')}הרץ שוב</button>` : nothing}<button type="button" class="btn" data-drawer-back-detail @click=${() => this.go('detail')}>${aIcon('eye')}לאוטומציה</button></div>`;
    }
    if (sub === 'versions' || sub === 'dryrun') return html`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${() => this.go('detail')}>סגירה</button></div>`;
    const running = it.state === 'running';
    const isScript = it.kind === 'script';
    const edit = it.can.edit ? html`<button type="button" class=${`btn${isScript ? '' : ' primary'}`} data-drawer-edit @click=${() => this.fire('edit', { kind: it.kind, id: it.id })}>${aIcon('edit')}עריכה</button>` : nothing;
    const run = running && isScript ? html`<button type="button" class="btn danger" data-drawer-stop ?disabled=${this.busy} @click=${() => void this.stop()}>${aIcon('stop')}עצור</button>`
      : it.can.run ? html`<button type="button" class=${`btn${isScript ? ' primary' : ''}`} data-drawer-run ?disabled=${this.busy || (isScript && !this.valid)} @click=${() => void this.run()}>${aIcon('play')}${isScript ? 'הפעל' : 'הרץ עכשיו'}</button>` : nothing;
    return html`<div class="foot2" slot="footer">
      ${isScript ? html`${run}${edit}` : html`${edit}${run}`}
      ${!isScript ? html`<button type="button" class="btn" data-drawer-dry @click=${() => this.go('dryrun')}>${aIcon('flask')}בדיקה</button>` : nothing}
      ${it.last_run && !isScript ? html`<button type="button" class="btn" data-drawer-why @click=${() => this.go('trace')}>${aIcon('help')}למה זה רץ</button>` : nothing}
      ${it.source === 'ui' ? html`<button type="button" class="btn quiet" data-drawer-versions @click=${() => this.go('versions')}>${aIcon('history')}גרסאות</button>` : nothing}
      ${it.can.copy ? html`<button type="button" class="btn quiet" data-drawer-copy @click=${() => { this.copyName = `${it.name} (עותק)`; this.confirm = 'copy'; }}>${aIcon('copy')}שכפול</button>` : nothing}
      ${it.can.delete ? html`<button type="button" class="btn quiet dz" data-drawer-delete @click=${() => (this.confirm = 'delete')}>${aIcon('trash')}מחיקה</button>` : nothing}
    </div>`;
  }

  private dialogs(it: ItemDetail | null): TemplateResult | typeof nothing {
    const c = this.confirm;
    if (!c || !it) return nothing;
    if (c === 'run') {
      const line = confirmLine(it);
      return html`<sw-dialog open heading=${it.kind === 'script' ? 'להפעיל עכשיו?' : 'להריץ עכשיו?'} data-dialog="run" @close=${() => (this.confirm = null)}>
        <div class="dlgform">${line ? html`<p>${line}</p>` : nothing}<div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button><button type="button" class="btn primary" data-dialog-ok @click=${() => void this.run(true)}>${it.kind === 'script' ? 'הפעל' : 'הרץ'}</button></div></div></sw-dialog>`;
    }
    if (c === 'delete') {
      return html`<sw-dialog open heading=${`למחוק את "${it.name}"?`} data-dialog="delete" @close=${() => (this.confirm = null)}>
        <div class="dlgform"><p>הפריט יישמר בסל המחזור וניתן לשחזר אותו.</p><div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button><button type="button" class="btn danger" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.doDelete()}>מחיקה</button></div></div></sw-dialog>`;
    }
    if (c === 'copy') {
      return html`<sw-dialog open heading="שכפול" data-dialog="copy" @close=${() => (this.confirm = null)}>
        <div class="dlgform"><label class="fld">שם<input class="inp" type="text" maxlength="120" .value=${this.copyName} data-copy-name @input=${(e: Event) => (this.copyName = (e.target as HTMLInputElement).value)} /></label><div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy || !this.copyName.trim()} @click=${() => void this.doCopy()}>שכפול</button></div></div></sw-dialog>`;
    }
    return html`<sw-dialog open heading=${`לשחזר את ${this.restoring?.version_id ?? ''}?`} data-dialog="restore" @close=${() => (this.confirm = null)}>
      <div class="dlgform"><p>${this.restoring?.summary ?? ''}</p><div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.doRestore()}>שחזר</button></div></div></sw-dialog>`;
  }

  render() {
    if (this.trash) {
      return html`<sw-drawer modal .open=${this.open} heading="סל המחזור" @close=${this.close}>${this.trashView()}<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>סגירה</button></div></sw-drawer>`;
    }
    const it = this.item;
    const sub = this.view;
    const heading = !it ? '' : sub === 'trace' ? 'למה זה רץ' : sub === 'versions' ? 'גרסאות' : sub === 'dryrun' ? 'בדיקה' : bidi(it.name);
    const subheading = !it ? '' : sub === 'detail' ? [floorLine(it), areaLine(it)].filter(Boolean).join(' · ') : bidi(it.name);
    const stateBlock = this.stateBox();
    return html`<sw-drawer modal .open=${this.open} heading=${heading} subheading=${subheading} @close=${this.close}>
      ${sub !== 'detail' && it ? html`<button slot="action" type="button" class="rb sm" aria-label="חזרה" data-drawer-back @click=${() => this.go('detail')}>${aIcon('chevron')}</button>` : nothing}
      ${stateBlock ?? (it ? (sub === 'trace' ? this.traceView(it) : sub === 'versions' ? this.versionsView(it) : sub === 'dryrun' ? this.dryView() : this.detail(it)) : nothing)}
      ${it && !stateBlock ? this.footer(it) : nothing}
      ${this.dialogs(it)}
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-drawer': AutomationDrawer;
  }
}

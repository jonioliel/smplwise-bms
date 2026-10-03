import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../components/sw-button';
import '../../components/sw-state-panel';
import { describeError } from '../../api/client';
import { estimateBytes, getRetention, putRetention, RETENTION_RANGES, type EnergySettings, type RetentionKey, type RetentionPatch } from '../../api/electricity-meters';
import { energyAccess, onEnergyAccess, type EnergyAccess } from '../../electricity/access';
import { fmtMb } from '../../electricity/format';
import { electricityCss } from '../../electricity/styles';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';

interface RowDef {
  key: RetentionKey;
  label: string;
  usage: keyof EnergySettings['usage'];
  /** Who edits it: the retention classes are system settings, the drafts belong to the module's managers. */
  owner: 'system' | 'manage';
}

const ROWS: RowDef[] = [
  { key: 'raw_retention_days', label: 'קריאות גולמיות', usage: 'raw_bytes', owner: 'system' },
  { key: 'interval_retention_months', label: 'נתוני רבע שעה', usage: 'interval_bytes', owner: 'system' },
  { key: 'bill_retention_years', label: 'חיובים וקבצי PDF', usage: 'bill_bytes', owner: 'system' },
  { key: 'draft_retention_days', label: 'טיוטות שלא הונפקו', usage: 'draft_bytes', owner: 'manage' },
];

/**
 * הגדרות › תשתיות › שמירת נתונים (CR-023 section 15, mockups "שמירת נתונים" and "ערך מחוץ לטווח"): how long raw readings, quarter-hour data and bills with
 * their files are kept, with the size in use per class, an estimate for the value being typed, and the range error. The three retention classes
 * need `system.configure`; the drafts need `energy.manage`. The server checks the ranges again.
 */
@customElement('elec-settings-retention')
export class ElecSettingsRetention extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private data: EnergySettings | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private values: Partial<Record<RetentionKey, string>> = {};
  @state() private saving = false;
  @state() private saveError = '';
  @state() private saved = false;
  @state() private access: EnergyAccess = energyAccess();
  private stop?: () => void;

  static styles = [
    electricityCss,
    css`
      :host {
        display: block;
        max-inline-size: 760px;
      }
      .rowx {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 10px 16px;
        padding: 10px 12px;
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
      }
      .rowx .grow {
        flex: 1 1 200px;
        min-inline-size: 0;
      }
      .rowx .fld {
        flex: 0 0 170px;
      }
      .rowx .t1 {
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-sm);
      }
      .rowx .t2 {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .foot {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-block-start: 14px;
      }
      .ok {
        color: var(--sw-success-text, var(--sw-live-text));
        font-size: var(--sw-fs-sm);
      }
    `,
    bubbleChrome,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onEnergyAccess((a) => (this.access = a));
    void this.load();
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private async load() {
    this.phase = 'loading';
    try {
      const d = await getRetention();
      this.data = d;
      this.values = Object.fromEntries(ROWS.map((r) => [r.key, String(d[r.key])]));
      this.phase = 'ready';
    } catch (err) {
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private editable(r: RowDef): boolean {
    if (!this.data) return false;
    return r.owner === 'system' ? this.data.can_edit_retention && this.access.system : this.data.can_edit_drafts && this.access.manage;
  }

  private problem(r: RowDef): string {
    const raw = (this.values[r.key] ?? '').trim();
    const range = RETENTION_RANGES[r.key];
    const n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n < range.min || n > range.max) return `הערך חייב להיות בין ${range.min} ל-${range.max}`;
    return '';
  }

  private changed(): RetentionPatch {
    const out: RetentionPatch = {};
    if (!this.data) return out;
    for (const r of ROWS) {
      const n = Number(this.values[r.key]);
      if (this.editable(r) && !this.problem(r) && n !== this.data[r.key]) out[r.key] = n;
    }
    return out;
  }

  private async save() {
    const patch = this.changed();
    if (!Object.keys(patch).length || this.saving) return;
    this.saving = true;
    this.saveError = '';
    this.saved = false;
    try {
      this.data = await putRetention(patch);
      this.values = Object.fromEntries(ROWS.map((r) => [r.key, String(this.data![r.key])]));
      this.saved = true;
    } catch (err) {
      this.saveError = describeError(err);
    } finally {
      this.saving = false;
    }
  }

  render() {
    if (!this.access.system && !this.access.manage) return html`<sw-state-panel state="forbidden" data-elec="retention" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'loading') return html`<div data-elec="retention" data-state="loading" aria-busy="true" class="card">${[0, 1, 2, 3].map(() => html`<div class="row" style="padding:12px 0"><div class="sk" style="inline-size:36%"></div><span class="sp"></span><div class="sk" style="inline-size:20%"></div></div>`)}</div>`;
    if (this.phase === 'error' || !this.data) return html`<div data-elec="retention" data-state="error"><sw-state-panel state="error" heading="לא ניתן לטעון את ההגדרות" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel></div>`;
    const d = this.data;
    const total = ROWS.reduce((s, r) => s + d.usage[r.usage], 0);
    const hasChange = Object.keys(this.changed()).length > 0;
    const anyProblem = ROWS.some((r) => this.editable(r) && this.problem(r));
    return html`<div data-elec="retention" data-state="ready" class="card">
      <div class="list">${ROWS.map((r) => {
        const range = RETENTION_RANGES[r.key];
        const err = this.editable(r) ? this.problem(r) : '';
        const n = Number(this.values[r.key]);
        const edited = !err && n !== d[r.key];
        return html`<div class="rowx" data-retention=${r.key}>
          <div class="grow"><div class="t1">${r.label}</div>
            <div class="t2">${range.min} עד ${range.max} · בשימוש <span class="num" data-usage>${fmtMb(d.usage[r.usage])}</span>${edited && r.key !== 'draft_retention_days' ? html` · הערכה לערך החדש <span class="num" data-estimate>${fmtMb(estimateBytes(r.key, n, d.meter_count))}</span>` : nothing}</div></div>
          <div class="fld"><div class="inp ${err ? 'err' : ''}"><input inputmode="numeric" data-retention-input=${r.key} aria-label=${r.label} aria-invalid=${err ? 'true' : 'false'} ?disabled=${!this.editable(r)} .value=${this.values[r.key] ?? ''}
            @input=${(e: Event) => { this.saved = false; this.values = { ...this.values, [r.key]: (e.target as HTMLInputElement).value }; }} /><span class="mut">${range.unit}</span></div>
            ${err ? html`<div class="msg" role="alert" data-retention-error=${r.key}>${err}</div>` : nothing}</div>
        </div>`;
      })}</div>
      ${this.saveError ? html`<div class="alert err" role="alert" style="margin-block-start:12px" data-save-error>${this.saveError}</div>` : nothing}
      <div class="foot"><span class="mut">נתונים בתוך תקופה של טיוטה פתוחה לא נמחקים.</span><span class="mut">סה״כ בשימוש <span class="num">${fmtMb(total)}</span></span><span class="sp"></span>
        ${this.saved ? html`<span class="ok" role="status" data-saved>נשמר</span>` : nothing}
        <sw-button variant="primary" data-retention-save ?disabled=${!hasChange || anyProblem || this.saving} @click=${() => void this.save()}>שמירה</sw-button></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-settings-retention': ElecSettingsRetention;
  }
}

import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-camera-tile';
import '../components/sw-field';
import '../components/sw-tabs';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-scene';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import type { TableColumn } from '../components/sw-table';
import type { StateKind } from '../components/sw-badge';
import { demoCases } from '../fixtures/catalog';
import { navigate } from '../router';
import { isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { productSettings } from '../api/prefs';
import { EVENT_LABEL, thumbnailUrl, type EventKind } from '../api/events';
import { frameUrl } from '../api/recordings';
import { exportDownloadUrl, formatBytes } from '../api/exports';
import { listCameras } from '../api/maps';
import type { Camera } from '../api/types';
import { CASE_STATUS_LABEL, FILE_STATUS_LABEL, PRESERVATION_LABEL, PRODUCER_LABEL, producerOf, addCaseItem, bundleUrl, caseItemFileUrl, checkCaseIntegrity, createBundle, createCase, deleteCase, getCase, importBundle, listBundles, listCases, preserveCaseItem, removeCaseItem, updateCase, verifyBundle, type Bundle, type BundleFileStatus, type BundleVerification, type Case, type CaseDetail, type CaseIntegrity, type CaseItem, type CaseStatus, type Preservation, type SignatureVerdict } from '../api/cases';

const STATUS_KIND: Record<CaseStatus, StateKind> = { open: 'stale', in_review: 'recorded', closed: 'neutral' };
const PRES_KIND: Record<Preservation, StateKind> = { preserved: 'recorded', preserving: 'partial', nvr_only: 'stale', missing: 'error', unknown: 'unknown', not_in_bundle: 'neutral', none: 'neutral' };
const FILE_KIND: Record<BundleFileStatus, StateKind> = { ok: 'recorded', mismatch: 'error', missing: 'error', corrupt: 'error' };
const shortHash = (h?: string | null) => (h ? `${h.slice(0, 12)}…` : '—');
/** One line on a manifest signature: integrity since export, and whose key it is. */
function signatureText(s?: SignatureVerdict | null): string {
  if (!s || !s.present) return 'ללא חתימה (חבילה מגרסה ישנה, או שהחתימה הוסרה) — נבדקו רק הגיבובים.';
  if (!s.valid) return `חתימה לא תקינה${s.reason ? ` (${s.reason})` : ''} — ה־manifest שונה אחרי הייצוא או שהחתימה זויפה.`;
  return `חתימה תקינה · Ed25519 · מפתח ${s.kid}${s.trust === 'installation' ? (s.retired ? ' · מפתח שהוחלף, מוכר למתקן זה' : ' · המפתח הפעיל של מתקן זה') : ' · מפתח שאינו מוכר למתקן זה — שלמות בלבד, לא אמון'}`;
}
const fmtWhen = (iso: string, tz?: string) => new Intl.DateTimeFormat('he-IL', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const API_COLUMNS: TableColumn[] = [
  { key: 'title', label: 'תיק', render: (r) => html`<strong>${String(r.title)}</strong>${r.imported ? html` <sw-badge kind="historic" label="מיובא" data-case-imported></sw-badge>` : nothing}${r.tags ? html`<div style="font-size:11px;color:var(--sw-text-3)">${String(r.tags)}</div>` : nothing}` },
  { key: 'status', label: 'סטטוס', render: (r) => html`<sw-badge kind=${STATUS_KIND[r.status as CaseStatus]} label=${CASE_STATUS_LABEL[r.status as CaseStatus]}></sw-badge>` },
  { key: 'owner', label: 'בעלים' },
  { key: 'items', label: 'פריטים' },
  { key: 'preserved', label: 'עותקים שמורים', render: (r) => html`${String(r.preserved)} מתוך ${String(r.clips)}` },
  { key: 'updated', label: 'עודכן', ltr: true, render: (r) => fmtWhen(String(r.updated)) },
];

const columns: TableColumn[] = [
  { key: 'title', label: 'תיק', render: (r) => html`<strong>${String(r.title)}</strong>` },
  { key: 'status', label: 'סטטוס', render: (r) => html`<sw-badge kind=${r.status === 'פתוח' ? 'stale' : r.status === 'סגור' ? 'neutral' : 'recorded'} label=${String(r.status)}></sw-badge>` },
  { key: 'owner', label: 'בעלים' },
  { key: 'clips', label: 'קטעים' },
  { key: 'notes', label: 'הערות' },
  { key: 'preserved', label: 'ראיות שמורות', render: (r) => html`${r.preserved} שמורות${Number(r.missing) ? html` · <span style="color:var(--sw-danger)">${r.missing} חסרות</span>` : ''}` },
  { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
];

/** SC16 — cases list (board 2 screen 10, Beta). */
@customElement('investigate-cases')
export class InvestigateCases extends LitElement {
  @state() private cases: Case[] = [];
  @state() private canManage = false;
  @state() private loading = false;
  @state() private error = '';
  @state() private status: CaseStatus | 'all' = 'all';
  @state() private q = '';
  @state() private creating = false;
  @state() private newTitle = '';
  @state() private newDesc = '';
  @state() private newTags = '';
  @state() private busy = false;
  @state() private canImport = false;
  @state() private importOpen = false;
  @state() private importFile: File | null = null;
  @state() private importReport: BundleVerification | null = null;
  @state() private importBusy = false;
  @state() private importError = '';
  private qTimer = 0;

  static styles = css`
    .bar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-end: 10px;
    }
    .grow {
      flex: 1;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
      margin-block-end: 8px;
    }
    .verdict {
      border-radius: 8px;
      padding: 8px 10px;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-2);
    }
    .verdict[data-ok='true'] {
      border-color: #15803d;
    }
    .verdict[data-ok='false'] {
      border-color: var(--sw-danger);
    }
    .kv {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 3px 10px;
      font-size: var(--sw-fs-xs);
    }
    .kv > span {
      color: var(--sw-text-3);
    }
    .kv strong {
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .files {
      max-block-size: 220px;
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
    }
    .files .r {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: center;
      padding: 4px 8px;
      font-size: var(--sw-fs-xs);
      border-block-end: 1px solid var(--sw-border);
    }
    .files .r:last-child {
      border-block-end: 0;
    }
    .files .path {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: start;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--sw-font-mono);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    this.loading = true;
    this.error = '';
    try {
      const r = await listCases({ status: this.status === 'all' ? undefined : this.status, q: this.q || undefined });
      this.cases = r.cases;
      this.canManage = r.can_manage;
      this.canImport = Boolean(r.can_import);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private setStatus(s: CaseStatus | 'all') {
    this.status = s;
    void this.load();
  }

  private onQuery(v: string) {
    this.q = v;
    window.clearTimeout(this.qTimer);
    this.qTimer = window.setTimeout(() => void this.load(), 250);
  }

  private async create() {
    if (!this.newTitle.trim()) return;
    this.busy = true;
    this.error = '';
    try {
      const c = await createCase({ title: this.newTitle.trim(), description: this.newDesc, tags: this.newTags.split(',').map((t) => t.trim()).filter(Boolean) });
      this.creating = false;
      this.newTitle = this.newDesc = this.newTags = '';
      navigate(`/investigate/cases/${c.id}`);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private pickImport() {
    const input = this.renderRoot.querySelector<HTMLInputElement>('[data-bundle-import-file]');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  /** Verify first (nothing is imported yet): the report dialog shows every file, the producer and the verdict. */
  private async onImportFile(file?: File) {
    if (!file) return;
    this.importFile = file;
    this.importReport = null;
    this.importError = '';
    this.importOpen = true;
    this.importBusy = true;
    try {
      this.importReport = await verifyBundle(file);
    } catch (err) {
      this.importError = describeError(err);
    } finally {
      this.importBusy = false;
    }
  }

  private async importNow() {
    if (!this.importFile) return;
    this.importBusy = true;
    this.importError = '';
    try {
      const r = await importBundle(this.importFile);
      this.importOpen = false;
      this.importFile = null;
      navigate(`/investigate/cases/${r.case.id}`);
    } catch (err) {
      this.importError = describeError(err);
      if (err instanceof ApiError && err.code === 'already_imported' && this.importReport)
        this.importReport = { ...this.importReport, importable: false, already_imported: { case_id: String(err.body.details.case_id ?? ''), title: String(err.body.details.title ?? '') } };
    } finally {
      this.importBusy = false;
    }
  }

  private renderImportDialog() {
    const v = this.importReport;
    const f = this.importFile;
    const o = v?.origin;
    const when = (iso?: string | null) => (iso ? fmtWhen(iso) : '—');
    const producer = o ? PRODUCER_LABEL[producerOf(o)] : '—';
    const dup = v?.already_imported;
    return html`<sw-dialog open heading="ייבוא חבילת ראיות" subheading=${f ? `${f.name} · ${formatBytes(f.size)}` : ''} data-bundle-import-dialog @close=${() => (this.importOpen = false)}>
      ${this.importBusy && !v ? html`<sw-state-panel state="loading" heading="מאמת את החבילה…" hint="כל קובץ מגובב מחדש ומושווה ל־manifest; שום דבר עוד לא יובא"></sw-state-panel>` : nothing}
      ${this.importError ? html`<div class="err" data-import-error>${this.importError}</div>` : nothing}
      ${v
        ? html`<div class="verdict" data-import-summary data-ok=${String(v.ok)}>${v.summary ?? (v.ok ? 'החבילה אומתה.' : 'האימות נכשל.')}</div>
            <div class="kv" data-import-origin>
              <span>תיק במקור</span><strong>${v.case ?? '—'}</strong>
              <span>יוצא</span><strong>${when(o?.exported_at)}${o?.exported_by_display || o?.exported_by ? ` · על ידי ${o?.exported_by_display || o?.exported_by}` : ''}</strong>
              <span>הופקה ב־</span><strong data-import-producer data-this-installation=${String(o?.this_installation ?? 'unknown')} data-producer=${producerOf(o)}>${producer}${o?.installation_id ? html` · <span class="ltr">${o.installation_id}</span>` : nothing}</strong>
              <span>גרסה</span><strong><span class="ltr">Arx ${o?.app_version ?? '?'} · manifest v${v.schema_version ?? '?'}</span>${v.supported === false ? ' · לא נתמכת' : ''}</strong>
              <span>חתימה</span><strong data-import-signature>${signatureText(v.signature)}</strong>
              <span>SHA-256 של החבילה</span><strong class="ltr" title=${v.bundle?.sha256 ?? ''}>${shortHash(v.bundle?.sha256)}</strong>
            </div>
            ${v.files.length || v.extra.length
              ? html`<div class="files" data-import-files>
                  ${v.files.map((x) => html`<div class="r" data-import-file data-status=${x.status}><span class="path" title=${x.path}>${x.path}</span><sw-badge kind=${FILE_KIND[x.status]} label=${FILE_STATUS_LABEL[x.status]}></sw-badge><span class="hint ltr">${x.bytes == null ? '—' : formatBytes(x.bytes)}</span></div>`)}
                  ${v.extra.map((x) => html`<div class="r" data-import-file data-status="extra"><span class="path" title=${x}>${x}</span><sw-badge kind="error" label="לא ב־manifest"></sw-badge><span></span></div>`)}
                </div>`
              : nothing}
            ${dup
              ? html`<div class="hint" data-import-duplicate>החבילה הזו כבר יובאה לתיק "${dup.title}". <sw-button size="sm" variant="ghost" @click=${() => { this.importOpen = false; navigate(`/investigate/cases/${dup.case_id}`); }}>פתח את התיק הקיים</sw-button></div>`
              : nothing}
            ${!this.canImport ? html`<div class="hint">ייבוא כתיק דורש הרשאת ניהול תיקים לכל ההתקנה; אימות מותר לכל מי שקורא תיקים.</div>` : nothing}
            <div class="hint">${v.authenticity ?? ''} ייבוא יוצר תיק חדש לקריאה בלבד: שום דבר מהחבילה לא הופך למצלמה, לתוכנית, למשתמש או להגדרה.</div>`
        : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => (this.importOpen = false)}>סגור</sw-button>
      ${this.canImport ? html`<sw-button slot="footer" variant="primary" icon="upload" data-bundle-import-confirm ?disabled=${this.importBusy || !v?.importable} @click=${() => this.importNow()}>ייבא כתיק</sw-button>` : nothing}
    </sw-dialog>`;
  }

  private renderApi() {
    const rows = this.cases.map((c) => ({ id: c.id, title: c.title, status: c.status, owner: c.owner_username, items: c.counts.items, clips: c.counts.events + c.counts.clips, preserved: c.counts.preserved, updated: c.updated_at, tags: c.tags.join(' · '), imported: c.origin === 'imported' }));
    return html`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת מה־NVR">
        <sw-button slot="actions" icon="upload" data-bundle-import @click=${() => this.pickImport()}>ייבוא חבילת ראיות</sw-button>
        ${this.canManage ? html`<sw-button slot="actions" variant="primary" icon="plus" data-case-new @click=${() => (this.creating = true)}>תיק חדש</sw-button>` : nothing}
        <input type="file" accept=".zip,application/zip" hidden data-bundle-import-file @change=${(e: Event) => void this.onImportFile((e.target as HTMLInputElement).files?.[0])} />
        <div class="bar">
          ${(['all', 'open', 'in_review', 'closed'] as const).map((s) => html`<sw-chip ?selected=${this.status === s} @click=${() => this.setStatus(s)}>${s === 'all' ? 'הכל' : CASE_STATUS_LABEL[s]}</sw-chip>`)}
          <span class="grow"></span>
          <sw-field><input type="search" placeholder="חיפוש בכותרת, תיאור ותגיות" aria-label="חיפוש תיקים" .value=${this.q} @input=${(e: Event) => this.onQuery((e.target as HTMLInputElement).value)} /></sw-field>
        </div>
        ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
        ${this.loading && !this.cases.length
          ? html`<sw-state-panel state="loading"></sw-state-panel>`
          : !this.cases.length
            ? html`<sw-state-panel state="empty" heading="אין תיקים עדיין" hint="פתח תיק מדף אירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק), או כאן."></sw-state-panel>`
            : html`<sw-table data-cases-table .columns=${API_COLUMNS} .rows=${rows} @row-select=${(e: CustomEvent<{ id: string }>) => navigate(`/investigate/cases/${e.detail.id}`)}></sw-table>`}
        ${this.creating
          ? html`<sw-dialog open heading="תיק חדש" subheading="כותרת קצרה; פריטים נוספים מדפי האירוע, הנגן והמפה" data-case-create @close=${() => (this.creating = false)}>
              <sw-field label="כותרת"><input data-case-title .value=${this.newTitle} @input=${(e: Event) => (this.newTitle = (e.target as HTMLInputElement).value)} /></sw-field>
              <sw-field label="תיאור"><textarea rows="3" .value=${this.newDesc} @input=${(e: Event) => (this.newDesc = (e.target as HTMLTextAreaElement).value)}></textarea></sw-field>
              <sw-field label="תגיות (מופרדות בפסיק)"><input .value=${this.newTags} @input=${(e: Event) => (this.newTags = (e.target as HTMLInputElement).value)} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${() => (this.creating = false)}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" icon="plus" data-case-create-confirm ?disabled=${this.busy || !this.newTitle.trim()} @click=${() => this.create()}>צור תיק</sw-button>
            </sw-dialog>`
          : nothing}
        ${this.importOpen ? this.renderImportDialog() : nothing}
      </sw-page>
    `;
  }

  render() {
    if (isApi()) return this.renderApi();
    return html`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תיק חדש</sw-button>
        <sw-table .columns=${columns} .rows=${demoCases} @row-select=${(e: CustomEvent<{ id: string }>) => navigate(`/investigate/cases/${e.detail.id}`)}></sw-table>
      </sw-page>
    `;
  }
}

/** SC17 — incident / case review (board 2 screen 10): picture with controls, clip strip, Details / Notes / Related tabs, Share / Export Evidence. */
@customElement('investigate-case-detail')
export class InvestigateCaseDetail extends LitElement {
  @property() caseId = 'case-1';
  @state() private tab = 'details';
  @state() private data: CaseDetail | null = null;
  @state() private error = '';
  @state() private info = '';
  @state() private busy = false;
  @state() private tz = 'Asia/Jerusalem';
  @state() private noteText = '';
  @state() private editing = false;
  @state() private editTitle = '';
  @state() private editDesc = '';
  @state() private editTags = '';
  @state() private confirmDelete = false;
  @state() private bundles: Bundle[] = [];
  @state() private verifyResult: BundleVerification | null = null;
  @state() private cams: Camera[] = [];
  @state() private snapCam = '';
  @state() private integrity: CaseIntegrity | null = null;
  private loadedFor = '';
  private pollTimer = 0;

  static styles = css`
    .wrap {
      max-inline-size: 860px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
      color: #fff;
    }
    .video sw-scene {
      position: absolute;
      inset: 0;
    }
    .video .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .video .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      border-radius: 4px;
      padding: 2px 7px;
    }
    .bar {
      position: absolute;
      inset-inline: 12px;
      inset-block-end: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(17, 24, 39, 0.65);
      backdrop-filter: var(--sw-perf-blur, blur(8px));
      border-radius: var(--sw-r-pill);
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
    }
    .bar sw-button {
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.14);
    }
    .bar .track {
      flex: 1;
      block-size: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.3);
      overflow: hidden;
    }
    .bar .track i {
      display: block;
      inline-size: 35%;
      block-size: 100%;
      background: #fff;
    }
    .clips {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .clip {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
    }
    .clip sw-scene {
      position: absolute;
      inset: 0;
    }
    .clip.on {
      box-shadow: 0 0 0 2px var(--sw-accent);
    }
    .clip .t {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: #fff;
      font-size: 10px;
      font-family: var(--sw-font-mono);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .clip.missing {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .add {
      aspect-ratio: 16 / 9;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .form {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(200px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pills {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
    }
    .pill sw-icon {
      color: var(--sw-accent);
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      background: var(--sw-surface);
    }
    .item[data-preservation='missing'] {
      border-color: var(--sw-danger);
    }
    .item .thumb {
      inline-size: 112px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .item .body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .item .head {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .item .range {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .item .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .item .acts {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .composer {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-block-start: 10px;
    }
    .composer sw-field {
      flex: 1;
    }
    .desc {
      white-space: pre-wrap;
      font-size: var(--sw-fs-sm);
    }
    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 6px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .item {
        grid-template-columns: 1fr;
      }
      .item .thumb {
        inline-size: 100%;
      }
    }
    .note {
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .note small {
      color: var(--sw-text-3);
      display: block;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .prov {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
    }
    .prov > sw-icon {
      color: var(--sw-accent);
    }
    .prov .body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .prov .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    @media (max-width: 767px) {
      .prov {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .prov > sw-button {
        grid-column: 1 / -1;
      }
      .clips {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .form {
        grid-template-columns: 1fr;
      }
    }
  `;

  updated(changed: Map<string, unknown>) {
    if (changed.has('caseId') && isApi() && this.loadedFor !== this.caseId) void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.pollTimer);
  }

  private async load() {
    const id = this.caseId;
    this.loadedFor = id;
    this.error = '';
    try {
      const [s, d] = await Promise.all([productSettings(), getCase(id)]);
      this.tz = s['time.zone'] ?? this.tz;
      this.data = d;
      this.bundles = (await listBundles(id).catch(() => ({ bundles: [] as Bundle[] }))).bundles;
      if (!this.cams.length) {
        this.cams = (await listCameras().catch(() => ({ cameras: [] as Camera[] }))).cameras.filter((c) => c.enabled);
        if (!this.snapCam && this.cams[0]) this.snapCam = this.cams[0].id;
      }
      window.clearTimeout(this.pollTimer);
      if (d.items.some((i) => i.preservation === 'preserving')) this.pollTimer = window.setTimeout(() => void this.load(), 5000);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private fmt(iso: string) {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));
  }

  private async run(action: () => Promise<void>, okInfo = '') {
    this.busy = true;
    this.error = '';
    try {
      await action();
      this.info = okInfo;
      await this.load();
      if (okInfo) setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
      if (err instanceof ApiError && err.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private patchCase(body: { title?: string; description?: string; tags?: string[]; status?: CaseStatus }) {
    const d = this.data;
    if (!d) return;
    void this.run(async () => {
      await updateCase(d.id, { revision: d.revision, ...body });
    });
  }

  private async verify(file?: File) {
    if (!file) return;
    this.verifyResult = null;
    this.busy = true;
    this.error = '';
    try {
      this.verifyResult = await verifyBundle(file);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderBundleCard(d: CaseDetail) {
    const v = this.verifyResult;
    return html`<sw-card heading="חבילת ראיות" subheading="ZIP עם הקטעים השמורים, התמונות, ההערות, manifest עם SHA-256 לכל קובץ ודוח קריא" data-bundle>
      ${d.can_manage ? html`<sw-button size="sm" variant="primary" icon="download" data-bundle-create ?disabled=${this.busy} @click=${() => void this.run(async () => { await createBundle(d.id); }, 'החבילה נוצרה; פריטים שאינם עותק שמור מופיעים בה כ"לא נכללו"')}>צור חבילת ראיות</sw-button>` : nothing}
      ${this.bundles.length
        ? html`<div class="items" style="margin-block-start:8px">${this.bundles.map((b) => html`<div class="item" data-bundle-row style="grid-template-columns:minmax(0,1fr) auto"><div class="body"><strong class="ltr">${b.name}</strong><span class="meta">${formatBytes(b.bytes)} · ${this.fmt(b.created_at)}${b.signed ? ` · חתום · מפתח ${b.signed}` : ' · ללא חתימה'}</span></div><div class="acts"><a href=${bundleUrl(d.id, b.name)} download><sw-button size="sm" icon="download">הורדה</sw-button></a></div></div>`)}</div>`
        : html`<div class="hint" style="margin-block-start:6px">עדיין לא נוצרה חבילה לתיק הזה.</div>`}
      <div class="composer"><sw-field label="אימות חבילה (בחר קובץ ZIP שהורד)"><input type="file" accept=".zip,application/zip" data-bundle-verify-file @change=${(e: Event) => void this.verify((e.target as HTMLInputElement).files?.[0])} /></sw-field></div>
      ${v
        ? html`<div class="note" data-bundle-verify-result>${v.ok ? `החבילה אומתה: ${v.files.length} קבצים תואמים ל־manifest${v.case ? ` · תיק "${v.case}"` : ''}` : `האימות נכשל${v.errors.length ? `: ${v.errors.join(', ')}` : ''}`}
            ${v.files.some((f) => f.status !== 'ok') || v.extra.length ? html`<ul class="hint" style="margin:4px 0 0;padding-inline-start:18px">${v.files.filter((f) => f.status !== 'ok').map((f) => html`<li class="ltr">${f.path}: ${f.status}</li>`)}${v.extra.map((x) => html`<li class="ltr">${x}: extra</li>`)}</ul>` : nothing}
            ${v.signature ? html`<div data-bundle-signature data-signature-trust=${v.signature.trust}>${signatureText(v.signature)}</div>` : nothing}
            ${v.summary ? html`<div class="hint" style="margin-block-start:4px" data-bundle-verify-summary>${v.summary}</div>` : nothing}
            ${v.authenticity ? html`<div class="hint" style="margin-block-start:4px">${v.authenticity}</div>` : nothing}
          </div>`
        : nothing}
      <div class="hint" style="margin-block-start:6px">SHA-256 מוכיח שכל קובץ לא השתנה מאז יצירת החבילה; חתימת Ed25519 על ה־manifest מוכיחה שהחבילה לא שונתה מאז הייצוא על ידי מחזיק המפתח של המתקן (integrity-at-export). אף אחד מהם אינו מוכיח את אמיתות הצילום במקור (capture authenticity), ואין כאן הצהרה על קבילות משפטית. אימות מחוץ למערכת: scripts/verify_bundle.py.</div>
    </sw-card>`;
  }

  private async recheck(d: CaseDetail) {
    this.busy = true;
    this.error = '';
    try {
      this.integrity = await checkCaseIntegrity(d.id);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** An imported case: where the bundle came from, when, by whom, and whether its hashes matched (T050 import). */
  private renderProvenance(d: CaseDetail) {
    const p = d.provenance;
    if (d.origin !== 'imported' || !p) return nothing;
    const producer = producerOf(p);
    const where = { this_confirmed: 'מהתקנה זו (מאושר בחתימה)', this_claimed: 'לכאורה מהתקנה זו — לפי המזהה בלבד, לא מאושר בחתימה', other: 'מהתקנה אחרת', unknown: 'מהתקנה לא ידועה' }[producer];
    const ch = this.integrity;
    return html`<sw-card data-case-provenance data-this-installation=${String(p.this_installation ?? 'unknown')} data-producer=${producer}>
      <div class="prov">
        <sw-icon name="shield" size=${18}></sw-icon>
        <div class="body">
          <strong data-provenance-headline>יובא ${where} ב־${this.fmt(p.imported_at)}; hash ${p.verification.ok ? 'תואם' : 'לא תואם'} (${p.verification.files} קבצים נבדקו בייבוא)</strong>
          <span class="meta">במקור: "${p.source_case.title ?? '—'}" · יוצא ${p.exported_at ? this.fmt(p.exported_at) : '—'}${p.exported_by_display || p.exported_by ? ` על ידי ${p.exported_by_display || p.exported_by}` : ''} · Arx ${p.source_app_version ?? '?'}</span>
          <span class="meta">התקנת מקור <span class="ltr">${p.source_installation_id ?? '—'}</span> · ${signatureText({ present: p.signature.present, valid: p.signature.valid, kid: p.signature.kid, known: p.signature.known, retired: p.signature.retired, trust: p.signature.trust })}</span>
          <span class="meta">חבילה <span class="ltr" title=${p.bundle_sha256}>SHA-256 ${shortHash(p.bundle_sha256)}</span> · ${formatBytes(p.bundle_bytes)} · יובא על ידי ${p.imported_by ?? '—'}${p.skipped_at_source ? ` · ${p.skipped_at_source} פריטים לא נכללו כבר במקור` : ''}</span>
          ${ch
            ? html`<span class=${ch.ok ? 'ok' : 'err'} data-case-integrity-result data-ok=${String(ch.ok)}>${ch.ok ? (ch.files.length ? `בדיקה חוזרת ${this.fmt(ch.checked_at)}: hash תואם — ${ch.files.length} קבצים לא השתנו מאז הייבוא` : `בדיקה חוזרת ${this.fmt(ch.checked_at)}: אין בתיק קבצים שמורים לבדוק`) : `בדיקה חוזרת ${this.fmt(ch.checked_at)}: hash לא תואם — ${ch.files.filter((f) => f.status !== 'ok').length} מתוך ${ch.files.length} קבצים שונו או חסרים`}</span>`
            : nothing}
          <span class="hint">התאמת hash מוכיחה שהקבצים לא שונו מאז הייצוא; היא אינה מוכיחה שהצילום אמיתי. פריטים מיובאים הם לקריאה בלבד; מחיקת התיק מסירה גם את הקבצים המיובאים.</span>
        </div>
        <sw-button size="sm" icon="refresh" data-case-integrity ?disabled=${this.busy} @click=${() => void this.recheck(d)}>בדיקת hash חוזרת</sw-button>
      </div>
    </sw-card>`;
  }

  private renderItem(it: CaseItem, d: CaseDetail) {
    const kind = it.kind === 'event' ? `אירוע · ${EVENT_LABEL[(it.event?.type ?? 'other') as EventKind] ?? it.event?.type ?? ''}` : it.kind === 'clip' ? 'קטע הקלטה' : it.kind === 'snapshot' ? 'תמונה' : 'הערה';
    const pres = it.preservation;
    const at = it.kind === 'event' && it.event ? it.event.occurred_at : it.from_at;
    const thumb =
      it.kind === 'note'
        ? html`<div class="thumb"><sw-icon name="edit" size=${18}></sw-icon></div>`
        : it.kind === 'snapshot' && it.file_path
          ? html`<img class="thumb" src=${caseItemFileUrl(d.id, it.id)} alt="תמונה מהמצלמה" />`
          : it.imported
          ? html`<div class="thumb"><sw-icon name=${it.file_path ? 'case' : 'bookmark'} size=${18}></sw-icon></div>`
          : it.kind === 'event' && it.event?.thumbnail === 'ready' && it.event_id
          ? html`<img class="thumb" src=${thumbnailUrl(it.event_id)} alt="" />`
          : it.camera_id && at
            ? html`<img class="thumb" src=${frameUrl(it.camera_id, at)} alt="" @error=${(e: Event) => ((e.target as HTMLElement).style.visibility = 'hidden')} />`
            : html`<div class="thumb"></div>`;
    const o = it.origin;
    return html`<div class="item" data-case-item data-kind=${it.kind} data-preservation=${pres} ?data-imported=${Boolean(it.imported)}>
      ${thumb}
      <div class="body">
        <div class="head"><strong>${kind}</strong>${it.camera_name ? html`<span>· ${it.camera_name}${it.imported ? ' (מצלמת המקור)' : ''}</span>` : nothing}${pres !== 'none' ? html`<sw-badge kind=${PRES_KIND[pres]} label=${PRESERVATION_LABEL[pres]}></sw-badge>` : nothing}${it.imported ? html`<sw-badge kind="historic" label="מיובא · לקריאה בלבד"></sw-badge>` : nothing}</div>
        ${it.from_at && it.to_at ? html`<div class="range ltr">${this.fmt(it.from_at)} → ${this.fmt(it.to_at)}</div>` : nothing}
        ${it.note ? html`<div>${it.note}</div>` : nothing}
        <div class="meta">${o
          ? `במקור: ${o.added_by ?? '—'}${o.created_at ? ` · ${this.fmt(o.created_at)}` : ''} · יובא על ידי ${it.added_by_username}${pres === 'missing' ? ' · הקובץ המיובא חסר בדיסק' : ''}`
          : html`${it.added_by_username} · ${this.fmt(it.created_at)}${it.export?.error ? ` · ייצוא: ${it.export.error}` : ''}${pres === 'missing' ? ' · לא ניתן לשמר: ההקלטה כבר לא ב־NVR' : ''}`}</div>
      </div>
      <div class="acts">
        ${it.camera_id && at && it.kind !== 'snapshot' ? html`<sw-button size="sm" icon="play" @click=${() => navigate('/investigate/playback', { camera: it.camera_id ?? '', t: at })}>נגן</sw-button>` : nothing}
        ${(it.kind === 'snapshot' || it.imported) && it.file_sha256 ? html`<span class="meta ltr" title="SHA-256">${it.file_sha256.slice(0, 12)}…</span>` : nothing}
        ${it.imported && it.file_path && it.kind !== 'snapshot' ? html`<a href=${caseItemFileUrl(d.id, it.id)} download data-item-file><sw-button size="sm" variant="ghost" icon="download">הורדה</sw-button></a>` : nothing}
        ${it.event_id ? html`<sw-button size="sm" variant="ghost" icon="bell" @click=${() => navigate(`/investigate/events/${it.event_id}`)}>אירוע</sw-button>` : nothing}
        ${d.can_manage && it.kind !== 'note' && (pres === 'nvr_only' || pres === 'unknown') ? html`<sw-button size="sm" icon="download" data-item-preserve ?disabled=${this.busy} @click=${() => void this.run(() => preserveCaseItem(d.id, it.id).then(() => undefined), 'עבודת שימור נוצרה; הפריט יסומן כשמור כשההעתקה תסתיים')}>שמור עותק</sw-button>` : nothing}
        ${it.export?.download_ready ? html`<a href=${exportDownloadUrl(it.export.id)} download><sw-button size="sm" variant="ghost" icon="download">הורדה</sw-button></a>` : nothing}
        ${d.can_manage && !it.imported ? html`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="הסר מהתיק" data-item-remove ?disabled=${this.busy} @click=${() => void this.run(() => removeCaseItem(d.id, it.id).then(() => undefined))}></sw-button>` : nothing}
      </div>
    </div>`;
  }

  private renderApi() {
    if (this.error && !this.data) return html`<sw-page heading="תיק"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    const d = this.data;
    if (!d) return html`<sw-page heading="תיק"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const c = d.counts;
    return html`
      <sw-page heading=${d.title} subheading=${`${CASE_STATUS_LABEL[d.status]} · בעלים: ${d.owner_username} · ${c.items} פריטים · ${c.preserved} עותקים שמורים · עודכן ${this.fmt(d.updated_at)}`} crumbs="חקירה | תיקים" wide>
        ${d.can_manage
          ? html`<sw-field slot="actions"><select aria-label="סטטוס" data-case-status ?disabled=${this.busy} @change=${(e: Event) => this.patchCase({ status: (e.target as HTMLSelectElement).value as CaseStatus })}>${(Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((s) => html`<option value=${s} ?selected=${s === d.status}>${CASE_STATUS_LABEL[s]}</option>`)}</select></sw-field>
              <sw-button slot="actions" icon="edit" data-case-edit @click=${() => { this.editTitle = d.title; this.editDesc = d.description; this.editTags = d.tags.join(', '); this.editing = true; }}>עריכה</sw-button>
              <sw-button slot="actions" variant="ghost" icon="trash" data-case-delete @click=${() => (this.confirmDelete = true)}>מחיקה</sw-button>`
          : nothing}
        <sw-button slot="actions" variant="ghost" icon="list" @click=${() => navigate('/investigate/cases')}>לרשימת התיקים</sw-button>
        <div class="wrap">
          ${this.error ? html`<div class="err" data-case-error>${this.error}</div>` : nothing}
          ${this.info ? html`<div class="ok" data-case-info>${this.info}</div>` : nothing}
          ${this.renderProvenance(d)}
          ${d.description || d.tags.length
            ? html`<sw-card>${d.description ? html`<div class="desc" data-case-description>${d.description}</div>` : nothing}${d.tags.length ? html`<div class="tags">${d.tags.map((t) => html`<sw-chip>${t}</sw-chip>`)}</div>` : nothing}</sw-card>`
            : nothing}
          <sw-card heading="ראיות והערות" subheading=${d.checked ? 'מצב השימור נבדק מול ה־NVR עכשיו' : 'מצב השימור לא נבדק מול ה־NVR'}>
            ${d.items.length ? html`<div class="items" data-case-items>${d.items.map((it) => this.renderItem(it, d))}</div>` : html`<div class="hint">עדיין אין פריטים בתיק. הוסף מאירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק).</div>`}
            ${d.hidden_items ? html`<div class="hint">${d.hidden_items} פריטים ממצלמות שאינן בהרשאתך אינם מוצגים.</div>` : nothing}
            ${d.can_manage && d.status !== 'closed'
              ? html`<div class="composer"><sw-field label="הערה חדשה"><textarea rows="2" data-note-text .value=${this.noteText} @input=${(e: Event) => (this.noteText = (e.target as HTMLTextAreaElement).value)}></textarea></sw-field><sw-button size="sm" icon="plus" data-note-add ?disabled=${this.busy || !this.noteText.trim()} @click=${() => void this.run(async () => { await addCaseItem(d.id, { kind: 'note', note: this.noteText.trim() }); this.noteText = ''; })}>הוסף הערה</sw-button></div>
                  <div class="composer"><sw-field label="תמונה ממצלמה לתיק (עותק שמור מיידי)"><select aria-label="מצלמה לצילום" data-snapshot-camera @change=${(e: Event) => (this.snapCam = (e.target as HTMLSelectElement).value)}>${this.cams.map((c) => html`<option value=${c.id} ?selected=${c.id === this.snapCam}>${c.name}</option>`)}</select></sw-field><sw-button size="sm" icon="camera" data-snapshot-add ?disabled=${this.busy || !this.snapCam} @click=${() => void this.run(async () => { await addCaseItem(d.id, { kind: 'snapshot', camera_id: this.snapCam }); }, 'התמונה נשמרה בתיק עם ה־hash שלה')}>צלם תמונה לתיק</sw-button></div>`
              : nothing}
          </sw-card>
          ${this.renderBundleCard(d)}
          <div class="hint">סימנייה מצביעה על ההקלטה ב־NVR ואינה שימור: קטע נחשב שמור רק אחרי שעבודת ייצוא העתיקה אותו (sha256 ב־manifest). קטע שה־NVR כבר מחק מוצג כחסר ולעולם לא כשמור.</div>
        </div>
        ${this.editing
          ? html`<sw-dialog open heading="עריכת תיק" data-case-edit-dialog @close=${() => (this.editing = false)}>
              <sw-field label="כותרת"><input data-edit-title .value=${this.editTitle} @input=${(e: Event) => (this.editTitle = (e.target as HTMLInputElement).value)} /></sw-field>
              <sw-field label="תיאור"><textarea rows="4" data-edit-description .value=${this.editDesc} @input=${(e: Event) => (this.editDesc = (e.target as HTMLTextAreaElement).value)}></textarea></sw-field>
              <sw-field label="תגיות (מופרדות בפסיק)"><input .value=${this.editTags} @input=${(e: Event) => (this.editTags = (e.target as HTMLInputElement).value)} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${() => (this.editing = false)}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" icon="check" data-case-edit-save ?disabled=${this.busy || !this.editTitle.trim()} @click=${() => { this.editing = false; this.patchCase({ title: this.editTitle.trim(), description: this.editDesc, tags: this.editTags.split(',').map((t) => t.trim()).filter(Boolean) }); }}>שמירה</sw-button>
            </sw-dialog>`
          : nothing}
        ${this.confirmDelete
          ? html`<sw-dialog open heading="מחיקת תיק" subheading="הפריטים בתיק יימחקו; ההקלטות ב־NVR והעותקים שיוצאו נשארים" @close=${() => (this.confirmDelete = false)}>
              <sw-button slot="footer" variant="ghost" @click=${() => (this.confirmDelete = false)}>ביטול</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-case-delete-confirm ?disabled=${this.busy} @click=${() => { this.confirmDelete = false; void this.run(async () => { await deleteCase(d.id); navigate('/investigate/cases'); }); }}>מחק תיק</sw-button>
            </sw-dialog>`
          : nothing}
      </sw-page>
    `;
  }

  render() {
    if (isApi()) return this.renderApi();
    const c = demoCases.find((x) => x.id === this.caseId) ?? demoCases[0];
    return html`
      <sw-page heading="סקירת אירוע" subheading=${`${c.title} · בעלים: ${c.owner} · נתוני הדגמה`} crumbs="אירועים | תיקים | 13.09.2026 10:12 | כניסה ראשית">
        <sw-field slot="actions"><select aria-label="סטטוס"><option>${c.status}</option><option>בבדיקה</option><option>סגור</option></select></sw-field>
        <div class="wrap">
          <div class="video">
            <sw-scene kind="entrance"></sw-scene>
            <span class="stamp">2026-09-13 10:12:04</span>
            <span class="demo">דמו · הקטע ינוגן מהתיק (T050)</span>
            <div class="bar">
              <sw-button variant="ghost" size="sm" iconOnly icon="play" label="נגן"></sw-button>
              <span class="ltr">0:00 / 0:13</span>
              <span class="track"><i></i></span>
              <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="אחורה"></sw-button>
              <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
            </div>
          </div>
          <div class="clips">
            <div class="clip on"><sw-scene kind="entrance"></sw-scene><span class="t">00:00</span></div>
            <div class="clip"><sw-scene kind="lobby"></sw-scene><span class="t">00:06</span></div>
            <div class="clip missing"><span>מסדרון 10:15<br />לא שמור: NVR מחק</span></div>
            <div class="add"><span><sw-icon name="plus" size=${14}></sw-icon> הוסף קטע</span></div>
          </div>
          <sw-tabs .items=${[{ id: 'details', label: 'פרטים' }, { id: 'notes', label: 'הערות', count: 2 }, { id: 'related', label: 'מצלמות קשורות', count: 3 }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
          ${this.tab === 'details'
            ? html`<div class="form">
                <div class="stack">
                  <sw-field label="כותרת"><input value=${c.title} /></sw-field>
                  <sw-field label="תיאור"><textarea rows="3">אדם נכנס אחרי פתיחת הדלת ב־10:12. לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).</textarea></sw-field>
                </div>
                <div class="pills">
                  <div class="pill"><sw-icon name="calendar" size=${14}></sw-icon>13.09.2026 · 10:12</div>
                  <div class="pill"><sw-icon name="camera" size=${14}></sw-icon>כניסה ראשית · לובי</div>
                  <div class="pill"><sw-icon name="shield" size=${14}></sw-icon>2/3 ראיות שמורות · sha256</div>
                </div>
              </div>`
            : this.tab === 'notes'
              ? html`<sw-card>
                  <div class="note">נראה אדם נכנס אחרי פתיחת הדלת ב־10:12.<small>יוני · 10:40</small></div>
                  <div class="note">לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).<small>יוסי · 10:52</small></div>
                  <sw-field style="margin-block-start:8px"><textarea rows="2" placeholder="הערה חדשה…"></textarea></sw-field>
                </sw-card>`
              : html`<div class="clips">
                  <sw-camera-tile compact name="כניסה ראשית" state="recorded" scene="entrance"></sw-camera-tile>
                  <sw-camera-tile compact name="לובי" state="recorded" scene="lobby"></sw-camera-tile>
                  <sw-camera-tile compact name="מסדרון מזרחי" state="unknown"></sw-camera-tile>
                </div>`}
          <div class="foot">
            <sw-button icon="link">שיתוף</sw-button>
            <sw-button variant="primary" icon="download">ייצוא ראיות</sw-button>
          </div>
          <div class="hint">Manifest: clips 2/3 · notes 2 · requested/actual ranges · timezone Asia/Jerusalem · pipeline v0.1 · sha256 לכל קובץ. Hash מוכיח התאמה לקובץ שנשמר, לא אותנטיות מאז המצלמה. "מצלמות מוצעות לחקירה" בלבד: אין קביעה שמדובר באותו אדם.</div>
        </div>
      </sw-page>
    `;
  }
}

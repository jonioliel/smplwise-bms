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
import { exportDownloadUrl } from '../api/exports';
import { CASE_STATUS_LABEL, PRESERVATION_LABEL, addCaseItem, createCase, deleteCase, getCase, listCases, preserveCaseItem, removeCaseItem, updateCase, type Case, type CaseDetail, type CaseItem, type CaseStatus, type Preservation } from '../api/cases';

const STATUS_KIND: Record<CaseStatus, StateKind> = { open: 'stale', in_review: 'recorded', closed: 'neutral' };
const PRES_KIND: Record<Preservation, StateKind> = { preserved: 'recorded', preserving: 'partial', nvr_only: 'stale', missing: 'error', unknown: 'unknown', none: 'neutral' };
const fmtWhen = (iso: string, tz?: string) => new Intl.DateTimeFormat('he-IL', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const API_COLUMNS: TableColumn[] = [
  { key: 'title', label: 'תיק', render: (r) => html`<strong>${String(r.title)}</strong>${r.tags ? html`<div style="font-size:11px;color:var(--sw-text-3)">${String(r.tags)}</div>` : nothing}` },
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

  private renderApi() {
    const rows = this.cases.map((c) => ({ id: c.id, title: c.title, status: c.status, owner: c.owner_username, items: c.counts.items, clips: c.counts.events + c.counts.clips, preserved: c.counts.preserved, updated: c.updated_at, tags: c.tags.join(' · ') }));
    return html`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת מה־NVR">
        ${this.canManage ? html`<sw-button slot="actions" variant="primary" icon="plus" data-case-new @click=${() => (this.creating = true)}>תיק חדש</sw-button>` : nothing}
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
      backdrop-filter: blur(8px);
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
    @media (max-width: 767px) {
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

  private renderItem(it: CaseItem, d: CaseDetail) {
    const kind = it.kind === 'event' ? `אירוע · ${EVENT_LABEL[(it.event?.type ?? 'other') as EventKind] ?? it.event?.type ?? ''}` : it.kind === 'clip' ? 'קטע הקלטה' : 'הערה';
    const pres = it.preservation;
    const at = it.kind === 'event' && it.event ? it.event.occurred_at : it.from_at;
    const thumb =
      it.kind === 'note'
        ? html`<div class="thumb"><sw-icon name="edit" size=${18}></sw-icon></div>`
        : it.kind === 'event' && it.event?.thumbnail === 'ready' && it.event_id
          ? html`<img class="thumb" src=${thumbnailUrl(it.event_id)} alt="" />`
          : it.camera_id && at
            ? html`<img class="thumb" src=${frameUrl(it.camera_id, at)} alt="" @error=${(e: Event) => ((e.target as HTMLElement).style.visibility = 'hidden')} />`
            : html`<div class="thumb"></div>`;
    return html`<div class="item" data-case-item data-kind=${it.kind} data-preservation=${pres}>
      ${thumb}
      <div class="body">
        <div class="head"><strong>${kind}</strong>${it.camera_name ? html`<span>· ${it.camera_name}</span>` : nothing}${pres !== 'none' ? html`<sw-badge kind=${PRES_KIND[pres]} label=${PRESERVATION_LABEL[pres]}></sw-badge>` : nothing}</div>
        ${it.from_at && it.to_at ? html`<div class="range ltr">${this.fmt(it.from_at)} → ${this.fmt(it.to_at)}</div>` : nothing}
        ${it.note ? html`<div>${it.note}</div>` : nothing}
        <div class="meta">${it.added_by_username} · ${this.fmt(it.created_at)}${it.export?.error ? ` · ייצוא: ${it.export.error}` : ''}${pres === 'missing' ? ' · לא ניתן לשמר: ההקלטה כבר לא ב־NVR' : ''}</div>
      </div>
      <div class="acts">
        ${it.camera_id && at ? html`<sw-button size="sm" icon="play" @click=${() => navigate('/investigate/playback', { camera: it.camera_id ?? '', t: at })}>נגן</sw-button>` : nothing}
        ${it.event_id ? html`<sw-button size="sm" variant="ghost" icon="bell" @click=${() => navigate(`/investigate/events/${it.event_id}`)}>אירוע</sw-button>` : nothing}
        ${d.can_manage && it.kind !== 'note' && (pres === 'nvr_only' || pres === 'unknown') ? html`<sw-button size="sm" icon="download" data-item-preserve ?disabled=${this.busy} @click=${() => void this.run(() => preserveCaseItem(d.id, it.id).then(() => undefined), 'עבודת שימור נוצרה; הפריט יסומן כשמור כשההעתקה תסתיים')}>שמור עותק</sw-button>` : nothing}
        ${it.export?.download_ready ? html`<a href=${exportDownloadUrl(it.export.id)} download><sw-button size="sm" variant="ghost" icon="download">הורדה</sw-button></a>` : nothing}
        ${d.can_manage ? html`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="הסר מהתיק" data-item-remove ?disabled=${this.busy} @click=${() => void this.run(() => removeCaseItem(d.id, it.id).then(() => undefined))}></sw-button>` : nothing}
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
          ${d.description || d.tags.length
            ? html`<sw-card>${d.description ? html`<div class="desc" data-case-description>${d.description}</div>` : nothing}${d.tags.length ? html`<div class="tags">${d.tags.map((t) => html`<sw-chip>${t}</sw-chip>`)}</div>` : nothing}</sw-card>`
            : nothing}
          <sw-card heading="ראיות והערות" subheading=${d.checked ? 'מצב השימור נבדק מול ה־NVR עכשיו' : 'מצב השימור לא נבדק מול ה־NVR'}>
            ${d.items.length ? html`<div class="items" data-case-items>${d.items.map((it) => this.renderItem(it, d))}</div>` : html`<div class="hint">עדיין אין פריטים בתיק. הוסף מאירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק).</div>`}
            ${d.hidden_items ? html`<div class="hint">${d.hidden_items} פריטים ממצלמות שאינן בהרשאתך אינם מוצגים.</div>` : nothing}
            ${d.can_manage && d.status !== 'closed'
              ? html`<div class="composer"><sw-field label="הערה חדשה"><textarea rows="2" data-note-text .value=${this.noteText} @input=${(e: Event) => (this.noteText = (e.target as HTMLTextAreaElement).value)}></textarea></sw-field><sw-button size="sm" icon="plus" data-note-add ?disabled=${this.busy || !this.noteText.trim()} @click=${() => void this.run(async () => { await addCaseItem(d.id, { kind: 'note', note: this.noteText.trim() }); this.noteText = ''; })}>הוסף הערה</sw-button></div>`
              : nothing}
          </sw-card>
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

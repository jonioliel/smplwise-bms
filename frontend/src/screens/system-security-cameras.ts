import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { nvrSettings, type CameraList, type Recorder } from '../api/nvr-settings';
import {
  DASH,
  DEFAULT_SORT,
  NO_FILTERS,
  ROLE_HE,
  VERDICT_HE,
  applyFilters,
  bitrateLabel,
  codecLabel,
  counts,
  filtersActive,
  flatten,
  fpsLabel,
  nextSort,
  numberLabel,
  resolutionLabel,
  sortRows,
  startsGroup,
  svcLabel,
  type CodecFilter,
  type Filters,
  type RoleFilter,
  type Sort,
  type SortKey,
  type StreamRow,
  type SvcFilter,
  type VerdictFilter,
} from './nvr-cameras-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const STALE_NOTE = 'ה־NVR אינו זמין. מוצגים הערכים האחרונים.';

/** Table columns in display order; `sort` is the column's sort key (none: not sortable). */
const COLUMNS: { id: string; label: string; sort?: SortKey }[] = [
  { id: 'channel', label: 'ערוץ', sort: 'channel' },
  { id: 'camera', label: 'מצלמה', sort: 'camera' },
  { id: 'role', label: 'זרם', sort: 'role' },
  { id: 'codec', label: 'קידוד', sort: 'codec' },
  { id: 'svc', label: 'SVC', sort: 'svc' },
  { id: 'resolution', label: 'רזולוציה', sort: 'resolution' },
  { id: 'fps', label: 'FPS', sort: 'fps' },
  { id: 'bitrate', label: 'קצב', sort: 'bitrate' },
  { id: 'gop', label: 'GOP', sort: 'gop' },
  { id: 'webrtc', label: 'WebRTC', sort: 'webrtc' },
];

const CHECK = html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const CROSS = html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>`;

/**
 * הגדרות › אבטחה › מצלמות (CR-020 slice S1): every camera of the NVR with the video settings of each of its streams - codec,
 * SVC, resolution, frame rate, bitrate, GOP, profile, stream type and whether the browser plays it over WebRTC - in one
 * read-only table with a search, filters and column sort. System administrators only (`system.configure`; the server
 * checks it, the tab is only offered to them). Nothing on this screen writes to the NVR: changing an encoding is slice S2.
 * Values the device does not report show "—" (never a guessed default). Technical names are exact (H.264, SVC, GOP):
 * this is a settings screen. Numbers, codecs and resolutions stay left-to-right inside the right-to-left page.
 */
@customElement('system-security-cameras')
export class SystemSecurityCameras extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private data: CameraList | null = null;
  @state() private recorder: Recorder | null = null;
  @state() private loading = true;
  /** A failure with nothing to show: the error panel (a partial failure is `data.stale`). */
  @state() private failure: { status: number; code: string; message: string } | null = null;
  @state() private filters: Filters = { ...NO_FILTERS };
  @state() private sort: Sort = { ...DEFAULT_SORT };
  private seq = 0;

  static styles = [css`
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .toolbar sw-field {
      inline-size: 150px;
    }
    .toolbar sw-field.search {
      inline-size: 240px;
    }
    .count {
      margin-inline-start: auto;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .note {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .wrap {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow-x: auto;
      max-inline-size: 100%;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      padding: 8px 10px;
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    th {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      padding: 0;
    }
    th button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 9px 10px;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    th button:hover,
    th[aria-sort='ascending'] button,
    th[aria-sort='descending'] button {
      color: var(--sw-text);
    }
    th button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
      border-radius: 4px;
    }
    .arrow {
      inline-size: 8px;
      font-size: 9px;
      color: var(--sw-accent-text);
    }
    tbody tr.first td {
      border-block-start: 2px solid var(--sw-border);
    }
    tbody tr:first-child td {
      border-block-start: 0;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    tbody tr:hover {
      background: var(--sw-surface-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      display: inline-block;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .repeat .cam {
      color: var(--sw-text-3);
    }
    .off .cam {
      color: var(--sw-text-3);
    }
    .dot {
      display: inline-block;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-text-4, #9aa3b2);
      margin-inline-end: 6px;
      vertical-align: middle;
    }
    .v {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
    }
    .v.ok {
      color: var(--sw-success, #15803d);
      background: var(--sw-success-soft, #e7f6ec);
    }
    .v.no {
      color: var(--sw-danger);
      background: var(--sw-danger-soft);
    }
    .v.unknown {
      color: var(--sw-text-3);
    }
    .chan {
      display: none;
      font-size: var(--sw-fs-xs);
    }
    /* tablet widths: the channel folds into the camera cell and the cells tighten, so all columns fit without scrolling */
    @media (max-width: 1100px) {
      .c-chan {
        display: none;
      }
      .chan {
        display: inline;
      }
      th button {
        padding: 8px 6px;
      }
      td {
        padding: 7px 6px;
      }
    }
    .cards {
      display: none;
    }
    .card {
      display: grid;
      gap: 3px;
      padding: 10px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
    }
    .card .head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .card .line {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      align-items: center;
    }
    .card .facts {
      color: var(--sw-text-2);
    }
    @media (max-width: 767px) {
      .wrap {
        display: none;
      }
      .cards {
        display: grid;
        gap: 8px;
      }
      .toolbar sw-field,
      .toolbar sw-field.search {
        inline-size: calc(50% - 4px);
      }
      .toolbar sw-field.search {
        inline-size: 100%;
      }
      .count {
        inline-size: 100%;
        margin: 0;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    const mine = ++this.seq;
    this.loading = true;
    try {
      const api = nvrSettings();
      const [list, recs] = await Promise.all([api.cameras(), api.recorders().catch(() => null)]);
      if (mine !== this.seq) return;
      this.data = list;
      this.recorder = recs?.recorders[0] ?? null;
      this.failure = null;
      // the device could not be read and the registry knows nothing: the same as an error with nothing to show
      if (list.stale && !list.cameras.length) {
        this.data = null;
        this.failure = { status: 503, code: list.error ?? 'source_unavailable', message: STALE_NOTE };
      }
    } catch (err) {
      if (mine !== this.seq) return;
      this.data = null;
      this.failure = { status: err instanceof ApiError ? err.status : 0, code: err instanceof ApiError ? err.code : 'network', message: describeError(err) };
    } finally {
      if (mine === this.seq) this.loading = false;
    }
  }

  private patch(p: Partial<Filters>) {
    this.filters = { ...this.filters, ...p };
  }

  private select(label: string, key: keyof Filters, options: [string, string][], attr: string) {
    return html`<sw-field><select aria-label=${label} data-nvr-filter=${attr} .value=${this.filters[key]} @change=${(e: Event) => this.patch({ [key]: (e.target as HTMLSelectElement).value } as Partial<Filters>)}>
      ${options.map(([v, l]) => html`<option value=${v} ?selected=${v === this.filters[key]}>${l}</option>`)}
    </select></sw-field>`;
  }

  private renderToolbar(shown: number, total: number) {
    const f = this.filters;
    return html`<div class="toolbar" data-nvr-toolbar>
      <sw-field class="search"><input type="search" placeholder="חיפוש מצלמה, קידוד, רזולוציה" aria-label="חיפוש" data-nvr-search .value=${f.q} @input=${(e: Event) => this.patch({ q: (e.target as HTMLInputElement).value })} /></sw-field>
      ${this.select('קידוד', 'codec', [['', 'כל הקידודים'], ['h264', 'H.264'], ['h265', 'H.265'], ['other', 'אחר']] satisfies [CodecFilter, string][], 'codec')}
      ${this.select('סוג זרם', 'role', [['', 'כל הזרמים'], ['main', 'ראשי'], ['sub', 'משני'], ['other', 'נוסף']] satisfies [RoleFilter, string][], 'role')}
      ${this.select('SVC', 'svc', [['', 'כל ה־SVC'], ['on', 'SVC פעיל'], ['off', 'SVC כבוי'], ['none', 'ללא SVC']] satisfies [SvcFilter, string][], 'svc')}
      ${this.select('WebRTC', 'webrtc', [['', 'כל ה־WebRTC'], ['ok', 'מתנגן'], ['no', 'לא מתנגן'], ['unknown', 'לא ידוע']] satisfies [VerdictFilter, string][], 'webrtc')}
      ${filtersActive(f) ? html`<sw-button size="sm" variant="ghost" data-nvr-clear @click=${() => (this.filters = { ...NO_FILTERS })}>נקה</sw-button>` : nothing}
      <sw-button size="sm" icon="refresh" data-nvr-refresh ?disabled=${this.loading} @click=${() => void this.load()}>רענון</sw-button>
      <span class="count" data-nvr-count>${filtersActive(f) ? `${shown} מתוך ${total} זרמים` : `${total} זרמים`}</span>
    </div>`;
  }

  private headerCell(c: (typeof COLUMNS)[number]) {
    const on = this.sort.key === c.sort;
    const aria = on ? (this.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return html`<th scope="col" class=${c.id === 'channel' ? 'c-chan' : ''} aria-sort=${aria} data-col=${c.id}>
      ${c.sort ? html`<button type="button" data-nvr-sort=${c.sort} @click=${() => (this.sort = nextSort(this.sort, c.sort as SortKey))}>${c.label}<span class="arrow" aria-hidden="true">${on ? (this.sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button>` : html`<span style="padding:9px 10px;display:inline-block">${c.label}</span>`}
    </th>`;
  }

  private verdict(r: StreamRow) {
    const v = r.stream?.webrtc ?? 'unknown';
    const known = r.stream !== null;
    return html`<span class="v ${known ? v : 'unknown'}" role="img" aria-label=${known ? VERDICT_HE[v] : DASH} title=${known ? VERDICT_HE[v] : ''} data-verdict=${known ? v : 'none'}>${known ? (v === 'ok' ? CHECK : v === 'no' ? CROSS : DASH) : DASH}</span>`;
  }

  private renderRow(rows: StreamRow[], i: number) {
    const r = rows[i];
    const s = r.stream;
    const first = startsGroup(rows, i);
    return html`<tr class="${first ? 'first' : 'repeat'} ${r.enabledInArx ? '' : 'off'}" data-stream-row data-camera=${r.cameraKey} data-stream=${s?.stream_ref ?? ''}>
      <td class="muted c-chan" data-col="channel"><span class="ltr">${r.channel}</span></td>
      <td data-col="camera"><span class="cam">${r.online === false ? html`<span class="dot" title="לא מקוונת" data-offline></span>` : nothing}${r.cameraName}</span><span class="chan muted"> ערוץ <span class="ltr">${r.channel}</span></span></td>
      <td data-col="role">${s ? ROLE_HE[s.role] : html`<span class="muted" data-unread>לא נקרא</span>`}</td>
      <td data-col="codec"><span class="ltr"><bdi>${codecLabel(s)}</bdi>${s?.profile ? html` <bdi class="muted">${s.profile}</bdi>` : nothing}</span></td>
      <td data-col="svc">${svcLabel(s)}</td>
      <td data-col="resolution"><bdi class="ltr">${resolutionLabel(s)}</bdi></td>
      <td data-col="fps"><span class="ltr">${fpsLabel(s)}</span></td>
      <td data-col="bitrate"><span class="ltr"><bdi>${bitrateLabel(s)}</bdi>${s?.bitrate_mode && s.bitrate_kbps ? html` <span class="muted">${s.bitrate_mode}</span>` : nothing}</span></td>
      <td data-col="gop"><span class="ltr">${numberLabel(s?.gop)}</span></td>
      <td data-col="webrtc">${this.verdict(r)}</td>
    </tr>`;
  }

  private renderCard(r: StreamRow) {
    const s = r.stream;
    return html`<div class="card ${r.enabledInArx ? '' : 'off'}" data-stream-card data-camera=${r.cameraKey} data-stream=${s?.stream_ref ?? ''}>
      <div class="head"><span class="cam">${r.online === false ? html`<span class="dot" title="לא מקוונת"></span>` : nothing}${r.cameraName}</span><span class="muted">ערוץ <span class="ltr">${r.channel}</span></span><span style="margin-inline-start:auto">${this.verdict(r)}</span></div>
      ${s
        ? html`<div class="line"><span>${ROLE_HE[s.role]}</span><bdi class="ltr">${codecLabel(s)}</bdi><bdi class="ltr">${resolutionLabel(s)}</bdi><span class="ltr">${fpsLabel(s)}</span></div>
          <div class="line facts"><span>SVC ${svcLabel(s)}</span><bdi class="ltr">${bitrateLabel(s)}${s.bitrate_mode && s.bitrate_kbps ? ` ${s.bitrate_mode}` : ''}</bdi><span>GOP <span class="ltr">${numberLabel(s.gop)}</span></span>${s.profile ? html`<bdi class="ltr muted">${s.profile}</bdi>` : nothing}</div>`
        : html`<div class="line muted" data-unread>לא נקרא</div>`}
    </div>`;
  }

  private renderBody() {
    const data = this.data;
    if (!data) return nothing;
    const all = flatten(data.cameras);
    const shown = sortRows(applyFilters(all, this.filters), this.sort);
    const c = counts(all);
    const body = !all.length
      ? html`<sw-state-panel state="empty" heading="לא נמצאו מצלמות ב־NVR." actionLabel="רענן" data-nvr-empty @action=${() => void this.load()}></sw-state-panel>`
      : !shown.length
        ? html`<sw-state-panel state="empty" heading="אין זרמים שמתאימים לסינון." actionLabel="נקה סינון" data-nvr-no-match @action=${() => (this.filters = { ...NO_FILTERS })}></sw-state-panel>`
        : html`<div class="wrap" data-nvr-table>
              <table>
                <thead><tr>${COLUMNS.map((col) => this.headerCell(col))}</tr></thead>
                <tbody>${shown.map((_, i) => this.renderRow(shown, i))}</tbody>
              </table>
            </div>
            <div class="cards" data-nvr-cards>${shown.map((r) => this.renderCard(r))}</div>`;
    return html`
      ${data.stale ? html`<div class="note" data-nvr-stale role="status"><span>${STALE_NOTE}</span><sw-button size="sm" data-nvr-retry ?disabled=${this.loading} @click=${() => void this.load()}>נסה שוב</sw-button></div>` : nothing}
      ${all.length ? this.renderToolbar(shown.length, c.streams) : nothing}
      ${body}`;
  }

  private subheading(): string {
    const r = this.recorder;
    if (!r) return '';
    return [r.name, r.model].filter(Boolean).join(' · ');
  }

  render() {
    const f = this.failure;
    let content;
    if (this.loading && !this.data) content = html`<sw-state-panel state="loading" data-nvr-loading></sw-state-panel>`;
    else if (f?.status === 403) content = html`<sw-state-panel state="forbidden" data-nvr-forbidden></sw-state-panel>`;
    else if (f?.code === 'nvr_not_configured')
      content = html`<sw-state-panel state="empty" heading="אין NVR מחובר" actionLabel="לחיבורים" data-nvr-none @action=${() => (window.location.hash = '#/system/setup')}></sw-state-panel>`;
    else if (f) content = html`<sw-state-panel state="error" heading="ה־NVR אינו זמין." hint=${f.status === 503 ? '' : f.message} actionLabel="נסה שוב" data-nvr-error @action=${() => void this.load()}></sw-state-panel>`;
    else content = this.renderBody();
    return html`<sw-page heading="הגדרות מצלמות" subheading=${this.subheading()}><div data-nvr-cameras data-state=${this.loading && !this.data ? 'loading' : f ? 'error' : this.data?.stale ? 'stale' : 'ready'} style="display:contents">${content}</div></sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security-cameras': SystemSecurityCameras;
  }
}

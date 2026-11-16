import { LitElement, html, css, nothing } from 'lit';
import '../components/sw-button';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-page';
import '../components/sw-dropdown';
import '../components/sw-state-panel';
import '../components/sw-icon';
import '../generator/gen-live-page';
import '../generator/gen-charts-page';
import '../generator/gen-alerts-page';
import '../maintenance/cert-row'; // MAINT215B: the nearest inspection / certificate of the generator (while the maintenance module is on)
import '../generator/gen-log-page';
import { glt } from '../i18n/generator-log';
import type { TabItem } from '../components/sw-tabs';
import type { DropdownChange, DropdownItem } from '../components/sw-dropdown';
import type { RouteState } from '../router';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { getDevice, listDevices, listLive, runDetect, type LiveSummaryItem, type DevicesResponse, type GenDevice } from '../api/generator';
import { generatorAccess, onGeneratorAccess, type GeneratorAccess } from '../generator/access';
import { fill, fmtDateTime } from '../generator/gen-logic';
import { applyGeneratorLog, infraPageTabs, tabStyleOf } from '../shell/nav';
import { TabsModeController } from '../shell/tabs-mode';
import { clearPairChip, publishPairChip, type PairChip } from '../shell/tab-pair';
import { infraPagesAsChip, infraPagesChip } from '../shell/infra-pages';
import { isApi } from '../api/session';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { genCss } from '../generator/gen-styles';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const G = he.generator;
// GENLOG092-295: 'log' (the run log) is offered only while its switch is on (log_enabled of the devices list; default off)
const PAGES = ['live', 'alerts', 'charts', 'history', 'log'] as const;
type Page = (typeof PAGES)[number];
const POLL_MS = 30_000;
const LAST_KEY = 'sw.generator.device';

export const pageOf = (segments: readonly string[]): Page => (PAGES as readonly string[]).includes(segments[2]) ? (segments[2] as Page) : 'live';

/**
 * תשתיות › גנרטור (CR-031 GEN1): the sibling of the electricity meters. Draws the page row (מצב חי, התראות פעילות with the open count, גרפים, היסטוריה), the generator
 * picker (a searchable dropdown: any number of generators, one at a time, `?device=<id>`) and mounts the page. Capability-driven: the pages bind to the roles the
 * selected controller exposes. States: loading, not found (with a retry for managers), detected partially, forbidden, error. Monitoring only.
 */
@customElement('infra-generator')
export class InfraGenerator extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: GeneratorAccess = generatorAccess();
  @state() private list: DevicesResponse | null = null;
  @state() private device: GenDevice | null = null;
  @state() private summary: Record<string, LiveSummaryItem> = {};
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private detecting = false;
  /** The selected generator's own load failed (POLISH4-WP5: the page said "loading" forever; it now says so, with a retry). */
  @state() private deviceFailed = false;
  private stop?: () => void;
  private timer = 0;
  private readonly tabsMode = new TabsModeController(this, 'area');
  /** The page row as the shell's second chip (the dropdown form), published after each render; null = drawn here as a tab row. */
  private pagesChip: PairChip | null = null;

  /* AUDIT30-E2 (round-30 audit #6, #9): the page is a <sw-page> (header, padding, width from the shared component) */
  static styles = [elecCss, genCss, css`
    :host { display: flex; flex-direction: column; min-block-size: 100%; inline-size: 100%; }
    sw-page { flex: 1 1 auto; min-block-size: 0; }
    .rows { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
    .body { min-inline-size: 0; }
    .body > * { display: block; }
    /* INSIGHTS-POLISH-2331: the loading state draws the page's shape - the tab row, the hero (diagram + side card) - and shimmers like the
       other infrastructure skeletons; the not-found explanation keeps a reading measure */
    .sk-tabs { inline-size: min(320px, 70%); block-size: 22px; }
    .sk-hero { block-size: 280px; }
    .sk-line { block-size: 14px; }
    .sk-line + .sk-line { margin-block-start: 12px; inline-size: 70%; }
    .measure { max-inline-size: 520px; }
    .body > .card + .card { margin-block-start: 14px; }
    /* the generators' count beside the picker is a quiet counter, not a bare digit */
    .gpick > .mut:last-child { font-variant-numeric: tabular-nums; padding: 2px 9px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onGeneratorAccess((a) => (this.access = a));
    void this.loadList();
    this.timer = window.setInterval(() => {
      if (!document.hidden) void this.loadList(true);
    }, POLL_MS);
  }
  disconnectedCallback() {
    this.stop?.();
    window.clearInterval(this.timer);
    clearPairChip(this);
    this.pagesChip = null;
    super.disconnectedCallback();
  }
  protected updated(c: Map<string, unknown>) {
    if (this.pagesChip) publishPairChip(this, this.pagesChip);
    else clearPairChip(this);
    if (c.has('route')) {
      const id = this.selectedId();
      if (id && id !== this.device?.id) void this.loadDevice(id);
    }
  }

  private shown(): GenDevice[] {
    const all = this.list?.devices ?? [];
    return this.access.manage ? all : all.filter((d) => d.core_met);
  }
  private selectedId(): string {
    const ds = this.shown();
    const asked = this.route?.params.get('device') ?? '';
    if (asked && ds.some((d) => d.id === asked)) return asked;
    let last = '';
    try { last = localStorage.getItem(LAST_KEY) ?? ''; } catch { /* storage unavailable */ }
    if (last && ds.some((d) => d.id === last)) return last;
    return (ds.find((d) => d.core_met) ?? ds[0])?.id ?? '';
  }

  private async loadList(quiet = false) {
    try {
      this.list = await listDevices();
      applyGeneratorLog(this.list.log_enabled === true); // GENLOG092-295: the generator tab's entry page skips the run log while it is off
      void listLive().then((r) => (this.summary = Object.fromEntries(r.devices.map((x) => [x.id, x])))).catch(() => undefined);
      this.phase = 'ready';
      const id = this.selectedId();
      if (id) await this.loadDevice(id);
      else this.device = null;
    } catch (e) {
      this.error = describeError(e);
      if (!quiet || !this.list) this.phase = 'error';
    }
  }
  private async loadDevice(id: string) {
    try {
      const d = await getDevice(id);
      if (id === this.selectedId()) {
        this.device = d;
        this.deviceFailed = false;
      }
    } catch (e) {
      this.error = describeError(e);
      if (id === this.selectedId() && !this.device) this.deviceFailed = true;
    }
  }
  private async detect() {
    this.detecting = true;
    try {
      await runDetect();
      await this.loadList();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.detecting = false;
    }
  }
  private pick(e: CustomEvent<DropdownChange>) {
    try { localStorage.setItem(LAST_KEY, e.detail.id); } catch { /* storage unavailable */ }
    const page = pageOf(this.route?.segments ?? []);
    navigate(`/infra/generator/${page}`, { device: e.detail.id });
  }

  private notFound() {
    const m = this.access.manage;
    return html`<div class="card" data-state="not-found"><div class="empty"><div class="ic"><sw-icon name="bolt" size="26"></sw-icon></div><h3>${G.notFound.title}</h3>
      <div class="mut measure">${G.notFound.body}${this.list?.last_detect_at ? ` ${fill(G.notFound.checked, { t: fmtDateTime(this.list.last_detect_at) })}` : ''}</div>
      ${m ? html`<div class="row" style="justify-content:center"><sw-button variant="primary" icon="refresh" ?disabled=${this.detecting} @click=${() => this.detect()} data-retry>${this.detecting ? G.notFound.detecting : G.notFound.retry}</sw-button>
        <a class="btn" href="#/system/infra/generator/routing">${G.notFound.toSettings}</a></div>` : nothing}</div></div>
      <div class="card"><div class="hd"><span class="h3">${G.notFound.howTitle}</span></div><dl class="kv">${G.notFound.how.map((t, i) => html`<dt>${i + 1}</dt><dd>${t}</dd>`)}</dl></div>`;
  }

  /** UXFIX-NAV-295 / AUDIT30-E2: one h1 on every state of the page - sw-page's heading, the navigation label of the page. */
  render() {
    return html`<sw-page heading=${G.tab} data-infra-page="generator">${this.renderPage()}</sw-page>`;
  }

  private renderPage() {
    this.pagesChip = null;
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'error' && !this.list) return html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} actionLabel=${G.retry} @action=${() => this.loadList()} data-state="error"></sw-state-panel>`;
    if (this.phase === 'loading' && !this.list) return html`<div class="col" data-state="loading" aria-busy="true"><div class="skl sk-tabs"></div><div class="hero"><div class="card"><div class="skl sk-hero"></div></div><div class="card"><div class="skl sk-line"></div><div class="skl sk-line"></div></div></div></div>`;
    const ds = this.shown();
    if (!ds.length) return html`<div class="body">${this.notFound()}</div>`;
    const d = this.device;
    const page = pageOf(this.route?.segments ?? []);
    const q = d ? `?device=${encodeURIComponent(d.id)}` : '';
    const open = d?.open_alerts ?? 0;
    // TABSET-293: the page row follows ui.tabs (`infra.generator`: order, hidden pages)
    const items: TabItem[] = infraPageTabs('infra.generator', PAGES.filter((p) => p !== 'log' || this.list?.log_enabled === true).map((p) => ({ id: p, label: G.pages[p], href: `#/infra/generator/${p}${q}`, ...(p === 'alerts' && open ? { count: open } : {}) })), isApi());
    const picker: DropdownItem[] = ds.map((x) => ({ id: x.id, label: `${x.name}${this.summary[x.id] && typeof this.summary[x.id].summary.engine_state?.value === 'string' ? ` · ${(G.engine as Record<string, string>)[String(this.summary[x.id].summary.engine_state.value)] ?? ''}` : ''}`, ...(x.open_alerts ? { alert: true as const } : {}) }));
    const pick = ds.length > 1 ? html`<div class="gpick" data-picker><span class="mut">${G.pickerLabel}</span><sw-dropdown .items=${picker} .value=${d?.id ?? ''} label=${G.pickerLabel} @change=${(e: CustomEvent<DropdownChange>) => this.pick(e)}></sw-dropdown><span class="mut">${ds.length}</span></div>` : nothing;
    let body;
    if (!d && this.deviceFailed) body = html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} actionLabel=${G.retry} @action=${() => { this.deviceFailed = false; void this.loadDevice(this.selectedId()); }} data-state="error"></sw-state-panel>`;
    else if (!d) body = html`<div class="skl" style="block-size:240px" data-state="loading" aria-busy="true"></div>`;
    else if (!d.core_met) body = html`<div class="card" data-state="partial"><div class="empty"><div class="ic"><sw-icon name="warning" size="26"></sw-icon></div><h3>${G.notFound.partialTitle}</h3><div class="mut">${G.notFound.partialBody}</div>
      ${this.access.manage ? html`<a class="btn pri" href="#/system/infra/generator/mapping?device=${encodeURIComponent(d.id)}">${G.settings.subs.mapping}</a>` : nothing}</div></div>`;
    else if (page === 'live') body = html`<gen-live-page .device=${d} ?manage=${this.access.manage}></gen-live-page>`;
    else if (page === 'log') body = this.list?.log_enabled ? html`<gen-log-page .device=${d}></gen-log-page>` : html`<sw-state-panel icon="list" state="empty" heading=${glt('off')} data-state="log-off"></sw-state-panel>`;
    else if (page === 'charts') body = html`<gen-charts-page .device=${d} .params=${this.route?.params ?? new URLSearchParams()}></gen-charts-page>`;
    else body = html`<gen-alerts-page .device=${d} .mode=${page} .alertId=${this.route?.segments[3] ? decodeURIComponent(this.route.segments[3]) : ''} ?manage=${this.access.manage} @alerts-changed=${() => void this.loadDevice(d.id)}></gen-alerts-page>`;
    // the page row follows the tab mode: in the dropdown form the shell draws it as the second chip, beside the area's chip (shell/infra-pages.ts)
    const asChip = infraPagesAsChip(this.tabsMode.value, items.length);
    this.pagesChip = asChip ? infraPagesChip('עמודים', items, page, (id) => navigate(`/infra/generator/${id}`, d ? { device: d.id } : undefined)) : null;
    const row = asChip ? nothing : html`<sw-tabs .items=${items} .active=${page} .variant=${tabStyleOf('infra.generator')} data-infra-pages></sw-tabs>`;
    return html`<div class="rows" data-gen-shell>${row}${pick}${d ? html`<maint-cert-row kind="generator" subjectId=${d.id}></maint-cert-row>` : nothing}</div><div class="body" data-page=${page}>${body}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-generator': InfraGenerator;
  }
}

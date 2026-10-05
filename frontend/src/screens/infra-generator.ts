import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-dropdown';
import '../components/sw-state-panel';
import '../components/sw-icon';
import '../generator/gen-live-page';
import '../generator/gen-charts-page';
import '../generator/gen-alerts-page';
import type { TabItem } from '../components/sw-tabs';
import type { DropdownChange, DropdownItem } from '../components/sw-dropdown';
import type { RouteState } from '../router';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { getDevice, listDevices, runDetect, type DevicesResponse, type GenDevice } from '../api/generator';
import { generatorAccess, onGeneratorAccess, type GeneratorAccess } from '../generator/access';
import { fill, fmtDateTime } from '../generator/gen-logic';
import { INFRA_TABS, tabStyleOf, visibleTabs } from '../shell/nav';
import { canNav, isApi } from '../api/session';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { genCss } from '../generator/gen-styles';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const G = he.generator;
const PAGES = ['live', 'alerts', 'charts', 'history'] as const;
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
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private detecting = false;
  private stop?: () => void;
  private timer = 0;

  static styles = [elecCss, genCss, css`
    :host { display: flex; flex-direction: column; gap: 14px; min-block-size: 100%; padding: 14px var(--sw-page-pad, 24px) 24px; max-inline-size: var(--sw-content-max); inline-size: 100%; box-sizing: border-box; }
    .rows { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
    .body { min-inline-size: 0; }
    .body > * { display: block; }
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
    super.disconnectedCallback();
  }
  protected updated(c: Map<string, unknown>) {
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
      if (id === this.selectedId()) this.device = d;
    } catch (e) {
      this.error = describeError(e);
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
      <div class="mut" style="max-inline-size:520px">${G.notFound.body}${this.list?.last_detect_at ? ` ${fill(G.notFound.checked, { t: fmtDateTime(this.list.last_detect_at) })}` : ''}</div>
      ${m ? html`<div class="row" style="justify-content:center"><button class="btn pri" ?disabled=${this.detecting} @click=${() => this.detect()} data-retry><sw-icon name="refresh" size="16"></sw-icon> ${this.detecting ? G.notFound.detecting : G.notFound.retry}</button>
        <a class="btn" href="#/system/infra/generator/routing">${G.notFound.toSettings}</a></div>` : nothing}</div></div>
      <div class="card"><div class="hd"><span class="h3">${G.notFound.howTitle}</span></div><dl class="kv">${G.notFound.how.map((t, i) => html`<dt>${i + 1}</dt><dd>${t}</dd>`)}</dl></div>`;
  }

  render() {
    const l1 = isApi() && visibleTabs(INFRA_TABS, true, canNav).length < 2 ? html`<sw-tabs .items=${INFRA_TABS.filter((t) => t.id === 'generator')} active="generator" .variant=${tabStyleOf(null, 1)} data-infra-l1></sw-tabs>` : nothing;
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'error' && !this.list) return html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} actionLabel=${G.retry} @action=${() => this.loadList()} data-state="error"></sw-state-panel>`;
    if (this.phase === 'loading' && !this.list) return html`<div class="col" data-state="loading"><div class="skl" style="inline-size:320px;block-size:22px"></div><div class="hero"><div class="card"><div class="skl" style="block-size:280px"></div></div><div class="card"><div class="skl"></div><div class="skl" style="margin-block-start:12px"></div></div></div></div>`;
    const ds = this.shown();
    if (!ds.length) return html`<div class="rows">${l1}</div><div class="body">${this.notFound()}</div>`;
    const d = this.device;
    const page = pageOf(this.route?.segments ?? []);
    const q = d ? `?device=${encodeURIComponent(d.id)}` : '';
    const open = d?.open_alerts ?? 0;
    const items: TabItem[] = PAGES.map((p) => ({ id: p, label: G.pages[p], href: `#/infra/generator/${p}${q}`, ...(p === 'alerts' && open ? { count: open } : {}) }));
    const picker: DropdownItem[] = ds.map((x) => ({ id: x.id, label: x.name, ...(x.open_alerts ? { alert: true as const } : {}) }));
    const pick = ds.length > 1 ? html`<div class="gpick" data-picker><span class="mut">${G.pickerLabel}</span><sw-dropdown .items=${picker} .value=${d?.id ?? ''} label=${G.pickerLabel} @change=${(e: CustomEvent<DropdownChange>) => this.pick(e)}></sw-dropdown><span class="mut">${ds.length}</span></div>` : nothing;
    let body;
    if (!d) body = html`<div class="skl" style="block-size:240px" data-state="loading"></div>`;
    else if (!d.core_met) body = html`<div class="card" data-state="partial"><div class="empty"><div class="ic"><sw-icon name="warning" size="26"></sw-icon></div><h3>${G.notFound.partialTitle}</h3><div class="mut">${G.notFound.partialBody}</div>
      ${this.access.manage ? html`<a class="btn pri" href="#/system/infra/generator/mapping?device=${encodeURIComponent(d.id)}">${G.settings.subs.mapping}</a>` : nothing}</div></div>`;
    else if (page === 'live') body = html`<gen-live-page .device=${d} ?manage=${this.access.manage}></gen-live-page>`;
    else if (page === 'charts') body = html`<gen-charts-page .device=${d} .params=${this.route?.params ?? new URLSearchParams()}></gen-charts-page>`;
    else body = html`<gen-alerts-page .device=${d} .mode=${page} .alertId=${this.route?.segments[3] ? decodeURIComponent(this.route.segments[3]) : ''} ?manage=${this.access.manage} @alerts-changed=${() => void this.loadDevice(d.id)}></gen-alerts-page>`;
    return html`<div class="rows" data-gen-shell>${l1}<sw-tabs .items=${items} .active=${page} .variant=${tabStyleOf(null, 2)} data-infra-pages></sw-tabs>${pick}</div><div class="body" data-page=${page}>${body}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infra-generator': InfraGenerator;
  }
}

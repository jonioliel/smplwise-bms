import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import type { IconName } from '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { emergencyApi, type ItemGroup, type ItemStatus, type ReadinessItem, type ReadinessPage, type Verdict } from '../api/emergency';
import { em, emLang, EN_SUMMARY, EN_TITLES, type EmKey } from '../i18n/emergency';
import { fmtInstant } from './model';
import './emergency-config';
import { ageText, matches, type Filter } from './emergency-model';
import { maintCss } from './styles';

type View = 'list' | 'contacts' | 'settings';
const FILTERS: readonly Filter[] = ['all', 'red', 'amber', 'unknown', 'not_applicable'];
const FILTER_LABEL: Record<Filter, EmKey> = { all: 'kpiAll', red: 'kpiRed', amber: 'kpiAmber', unknown: 'kpiUnknown', not_applicable: 'kpiNa' };
const LOOK: Record<ItemStatus, string> = { green: 'ok', amber: 'warn', red: 'alarm', unknown: 'unk', not_applicable: 'unk', hidden: 'unk' };
const ICON: Record<ItemStatus, IconName> = { green: 'check', amber: 'warning', red: 'warning', unknown: 'info', not_applicable: 'info', hidden: 'lock' };
const VERDICT_LOOK: Record<Verdict, string> = { ready: 'ok', ready_with_gaps: 'warn', not_ready: 'alarm' };
const VERDICT_ICON: Record<Verdict, IconName> = { ready: 'check', ready_with_gaps: 'warning', not_ready: 'warning' };
const GROUP_ORDER: readonly ItemGroup[] = ['power', 'fire', 'elevators', 'doors', 'people', 'records', 'cameras'];

/**
 * CR-EMERG104 (owner answers 24.10): the emergency readiness tab of the maintenance section (`#/tickets/maintenance/emergency`). ONE
 * read-only page: the verdict as a solid badge (colour plus a word plus an icon), the banner strip for live events (fire service, an open
 * incident, the generator on load), the KPI row as status filters and the checklist grouped by area - each row says what was checked, the
 * measured fact, how old it is and where to go to fix it. A row the caller may not see is shown redacted and still counts in the verdict.
 * No button here operates anything. Printing uses the browser's print (the page head and the disclaimer print, the controls do not).
 * It fills the screen and the checklist scrolls INSIDE its panel (control screens never scroll as a page).
 */
@customElement('emergency-readiness-page')
export class EmergencyReadinessPage extends LitElement {
  @state() private data: ReadinessPage | null = null;
  @state() private error = '';
  @state() private filter: Filter = 'all';
  @state() private view: View = 'list';
  private timer?: number;

  static styles = [maintCss, css`
    :host { flex: 1; min-block-size: 0; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .scroller { flex: 1; min-block-size: 0; overflow: auto; }
    .vbadge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: var(--sw-r-pill); font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-lg);
      background: var(--c); color: var(--sw-on-solid, #fff); }
    [data-look='ok'] { --c: var(--sw-success); --c-text: var(--sw-success-text); }
    [data-look='warn'] { --c: var(--sw-warning); --c-text: var(--sw-warning-text); }
    [data-look='alarm'] { --c: var(--sw-danger); --c-text: var(--sw-danger-text); }
    [data-look='unk'] { --c: var(--sw-unknown); --c-text: var(--sw-text-2); }
    .banners { display: grid; gap: 8px; }
    .banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); border: 1px solid var(--sw-warning); font-weight: var(--sw-fw-semibold); }
    .grp { padding: 10px 14px 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); background: var(--sw-surface-2); position: sticky; inset-block-start: 0; z-index: 1; }
    .item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 14px; border-block-end: 1px solid var(--sw-border); }
    .disc { inline-size: 28px; block-size: 28px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--c-soft); color: var(--c-text); }
    .item .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .item .t2 { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .item .st { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--c-text); }
    .item.red { background: var(--sw-danger-soft); }
    a.fix { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); white-space: nowrap; }
    a.fix:hover { text-decoration: underline; }
    .foot { padding: 8px 14px; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .printonly { display: none; }
    @media (max-width: 767px) { .item { grid-template-columns: auto minmax(0, 1fr); } .item .side { grid-column: 2; } }
    @media print {
      .noprint, .kpis, .banners .noprint { display: none !important; }
      .printonly { display: block; }
      .scroller { overflow: visible; }
      :host { overflow: visible; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void this.load();
    }, 60_000);
  }

  disconnectedCallback() {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  private async load() {
    try {
      this.data = await emergencyApi.page();
      this.error = '';
    } catch (e) {
      if (!this.data) this.error = e instanceof ApiError && e.status === 403 ? 'forbidden' : describeError(e);
    }
  }

  private itemTitle(i: ReadinessItem): string {
    return emLang() === 'en' ? (EN_TITLES[i.id] ?? i.title) : i.title;
  }

  private summary(i: ReadinessItem): string {
    return emLang() === 'en' && i.code && EN_SUMMARY[i.code] && !i.redacted ? EN_SUMMARY[i.code] : i.summary;
  }

  private row(i: ReadinessItem) {
    const look = LOOK[i.status];
    const age = ageText(i.age_s, emLang());
    return html`<div class="item ${i.status}" data-look=${look} data-emerg-item=${i.id} data-status=${i.status}>
      <span class="disc" aria-hidden="true"><sw-icon name=${ICON[i.status]} size="16"></sw-icon></span>
      <div><div class="t1">${this.itemTitle(i)}${i.critical && !i.redacted ? html`<span class="chip" data-look="unk">${em('critical')}</span>` : nothing}</div>
        <div class="t2">${this.summary(i)}${i.na ? html` · ${em('naBy', { by: i.na.by, at: fmtInstant(i.na.at, false) })}${i.na.note ? ` · ${i.na.note}` : ''}` : nothing}${age ? html` · ${em('age', { n: age })}` : nothing}</div>
        ${i.files?.length ? html`<div class="t2 files" data-emerg-files>${em('files')}: ${i.files.map((f, n) => html`${n ? ', ' : ''}<a class="fix" href=${f.href}>${f.name || f.kind}</a>`)}</div>` : nothing}</div>
      <div class="side"><span class="st">${em(`st_${i.status}` as EmKey)}</span>${i.next?.href ? html` <a class="fix noprint" href=${i.next.href}>${em('fix')}</a>` : nothing}</div>
    </div>`;
  }

  render() {
    if (this.error === 'forbidden') return html`<sw-state-panel state="forbidden" heading=${em('forbiddenTitle')} data-state="forbidden"></sw-state-panel>`;
    const d = this.data;
    if (!d) {
      return this.error
        ? html`<sw-state-panel state="error" heading=${em('errTitle')} hint=${em('errHint')} actionLabel=${em('retry')} data-state="error" @action=${() => { this.error = ''; void this.load(); }}></sw-state-panel>`
        : html`<div class="top"><div><h1>${em('title')}</h1></div></div><div class="skl" aria-busy="true" aria-label=${em('loading')} data-state="loading"></div>`;
    }
    const counts: Record<Filter, number> = { all: d.items.length, red: d.counts.red, amber: d.counts.amber, unknown: d.counts.unknown, not_applicable: d.counts.not_applicable };
    const shown = d.items.filter((i) => matches(this.filter, i.status));
    const groups = GROUP_ORDER.filter((g) => shown.some((i) => i.group === g));
    return html`
      <div class="top"><div><h1>${em('title')}</h1><p class="sub">${em('sub')}</p></div><span class="sp"></span>
        <div class="meta"><span class="vbadge" data-look=${VERDICT_LOOK[d.verdict]} data-emerg-verdict=${d.verdict}><sw-icon name=${VERDICT_ICON[d.verdict]} size="18"></sw-icon>${em(`verdict_${d.verdict}` as EmKey)}</span>
          <span class="mut num">${em('checkedAt', { t: fmtInstant(d.checked_at) })}</span>
          <div class="seg noprint" role="group" data-emerg-views>${(['list', 'contacts', ...(d.can.manage ? ['settings'] : [])] as View[]).map((v) => html`<button type="button" aria-pressed=${String(this.view === v)} data-emerg-view=${v}
            @click=${() => { this.view = v; }}>${em(({ list: 'viewList', contacts: 'viewContacts', settings: 'viewSettings' } as Record<View, EmKey>)[v])}</button>`)}</div>
          <button type="button" class="btn noprint" data-emerg-print @click=${() => window.print()}><sw-icon name="download" size="16"></sw-icon>${em('print')}</button></div></div>
      ${d.banners.length ? html`<div class="banners" data-emerg-banners>${d.banners.map((b) => html`<div class="banner" data-banner=${b.code}><sw-icon name="warning" size="18"></sw-icon>${em(`banner_${b.code}` as EmKey) === `banner_${b.code}` ? b.text : em(`banner_${b.code}` as EmKey)}</div>`)}</div>` : nothing}
      ${this.view === 'list' ? this.listBody(d, counts, shown, groups) : this.view === 'contacts' ? html`<emergency-contacts-panel .manage=${d.can.manage}></emergency-contacts-panel>` : html`<emergency-settings-panel></emergency-settings-panel>`}
      <div class="foot">${em('printNote')}<span class="printonly"> ${em('signed')}</span></div>`;
  }

  private listBody(d: ReadinessPage, counts: Record<Filter, number>, shown: ReadinessItem[], groups: readonly ItemGroup[]) {
    return html`
      <div class="kpis noprint" role="group" aria-label=${em('filterLabel')} data-emerg-kpis>
        ${FILTERS.map((k) => html`<button type="button" class="kpi" data-k=${k} data-look=${k === 'all' ? nothing : LOOK[k as ItemStatus]} aria-pressed=${String(this.filter === k)} data-emerg-kpi=${k}
          @click=${() => { this.filter = k; }}><span class="dot" aria-hidden="true"></span><span><b>${counts[k]}</b><span class="l">${em(FILTER_LABEL[k])}</span></span></button>`)}
      </div>
      <div class="panel flush fill"><div class="scroller" data-emerg-list>
        ${groups.length ? groups.map((g) => html`<div class="grp">${em(`grp_${g}` as EmKey)}</div>${shown.filter((i) => i.group === g).map((i) => this.row(i))}`)
          : html`<div class="nomatch">${em('empty')}</div>`}
        ${d.counts.hidden ? html`<div class="foot">${em('hidden', { n: d.counts.hidden })}</div>` : nothing}
      </div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'emergency-readiness-page': EmergencyReadinessPage;
  }
}

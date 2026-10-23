import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-button';
import '../../components/sw-state-panel';
import { describeError } from '../../api/client';
import { DEFAULT_RULES, nightFlows, readableAlerts, water, type Consumption, type LeakRules, type Meter, type WaterEvent } from '../../api/water';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { nightText, store, stored, waterBarChart, type Bar } from '../../water/ui';
import { fmtM3 } from '../../water/billing-format';
import { wt, wtLang } from '../../water/i18n';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';

type Range = 'today' | '7d' | '30d' | 'prev';
const RANGE_KEY = { today: 'rToday', '7d': 'r7d', '30d': 'r30d', prev: 'rPrevMonth' } as const;
const RANGE_STORE = 'sw.water.usage.range';
const p2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hmOf = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** The instants of a range in the browser's zone (the installation's in practice): today, the last 7 / 30 days, the previous month. */
export function rangeBounds(r: Range, now = new Date()): { from: Date; to: Date; days: number } {
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (r === 'today') return { from: mid, to: now, days: 1 };
  if (r === 'prev') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to, days: Math.round((to.getTime() - from.getTime()) / 86_400_000) };
  }
  const n = r === '7d' ? 7 : 30;
  return { from: new Date(mid.getFullYear(), mid.getMonth(), mid.getDate() - (n - 1)), to: now, days: n };
}

/** The hourly installation series to bars: per hour for one day, per local day (with the night share) for longer ranges. */
export function usageBars(c: Consumption, r: Range, rules: Pick<LeakRules, 'night_from' | 'night_to'>, leakDays: Set<string>): Bar[] {
  const f = hmOf(rules.night_from);
  const t = hmOf(rules.night_to);
  const night = (d: Date) => {
    const m = d.getHours() * 60 + d.getMinutes();
    return f <= t ? m >= f && m < t : m >= f || m < t;
  };
  const series = c.series ?? [];
  if (r === 'today') return series.map((s) => { const d = new Date(s.start); return { label: p2(d.getHours()), value: (s.litres ?? 0) / 1000, win: night(d) }; });
  const by = new Map<string, { value: number; night: number; d: Date }>();
  for (const s of series) {
    const d = new Date(s.start);
    const k = dayKey(d);
    const e = by.get(k) ?? { value: 0, night: 0, d };
    e.value += (s.litres ?? 0) / 1000;
    if (night(d)) e.night += (s.litres ?? 0) / 1000;
    by.set(k, e);
  }
  return [...by.entries()].map(([k, e]) => ({ label: String(e.d.getDate()), value: e.value, night: e.night, leak: leakDays.has(k), title: `${p2(e.d.getDate())}.${p2(e.d.getMonth() + 1)}: ${fmtM3(e.value)} ${wt('m3')}, ${wt('night')} ${Math.round(e.night * 1000)} ${wt('litre')}` }));
}

/**
 * תשתיות › מים › צריכה (CR-WATER78 section 5.2): the meters page's shape - the head row (היום / 7 ימים / 30 ימים / חודש קודם, ייצוא CSV), four
 * tiles (סה״כ בטווח, לעומת התקופה הקודמת, ממוצע יומי, ספיקת לילה ממוצעת), the daily chart (the night share darker at the foot of each bar,
 * leak days red, the legend in the card head), the per-meter table and phone rows. Measured values only (no estimates).
 */
@customElement('water-usage-page')
export class WaterUsagePage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private range: Range = stored<Range>(RANGE_STORE, '30d');
  @state() private data: Consumption | null = null;
  @state() private meters: Meter[] = [];
  @state() private leakDays = new Set<string>();
  @state() private night: Record<string, number | null | 'off'> = {};
  @state() private rules: LeakRules = DEFAULT_RULES;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private access: WaterAccess = waterAccess();
  private stop?: () => void;
  private seq = 0;

  static styles = [waterCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onWaterAccess((a) => (this.access = a));
    void this.load();
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private async load() {
    const my = ++this.seq;
    this.phase = 'loading';
    const b = rangeBounds(this.range);
    try {
      const cfg = await readableAlerts();
      if (cfg) this.rules = cfg.rules;
      const [c, meters, ev] = await Promise.all([
        water.consumption(b.from.toISOString(), b.to.toISOString(), '1h'),
        water.listMeters(),
        water.events('all').catch(() => ({ items: [] as WaterEvent[] })),
      ]);
      if (my !== this.seq) return;
      this.data = c;
      this.meters = meters;
      this.leakDays = new Set(ev.items.filter((e) => e.kind === 'night_flow').map((e) => dayKey(new Date(e.opened_at))));
      this.phase = 'ready';
      this.night = await nightFlows(meters, this.rules);
    } catch (err) {
      if (my !== this.seq) return;
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private setRange(r: Range) {
    this.range = r;
    store(RANGE_STORE, r);
    void this.load();
  }

  private csv() {
    const b = rangeBounds(this.range);
    const a = document.createElement('a');
    a.href = water.consumptionCsvUrl(b.from.toISOString(), b.to.toISOString(), wtLang());
    a.download = '';
    a.click();
  }

  private renderHead() {
    return html`<div class="row head">
      <div class="seg ranges" role="group" aria-label=${wt('range')} data-ranges>${(['today', '7d', '30d', 'prev'] as Range[]).map((r) => html`<button type="button" aria-pressed=${this.range === r ? 'true' : 'false'} data-range=${r} @click=${() => this.setRange(r)}>${wt(RANGE_KEY[r])}</button>`)}</div>
      <span class="sp"></span>
      <button class="btn" type="button" data-csv ?disabled=${this.phase !== 'ready' || !this.data?.items.length} @click=${() => this.csv()}><sw-icon name="download" size="15"></sw-icon>${wt('csv')}</button>
    </div>`;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-water="usage" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'loading') {
      return html`<div class="page" data-water="usage" data-state="loading" aria-busy="true">${this.renderHead()}<div class="card">${Array.from({ length: 7 }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;
    }
    if (this.phase === 'error' || !this.data) {
      return html`<div class="page" data-water="usage" data-state="error">${this.renderHead()}<sw-state-panel state="error" heading=${wt('loadUsageError')} hint=${this.error} actionLabel=${wt('retry')} @action=${() => void this.load()}></sw-state-panel></div>`;
    }
    const c = this.data;
    if (!c.items.length) {
      return html`<div data-water="usage" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${wt('emptyUsage')}>${this.access.manage ? html`<sw-button variant="primary" icon="plus" data-add-meter @click=${() => navigate('/infra/water/meters', { add: '1' })}>${wt('addMeter')}</sw-button>` : nothing}</sw-state-panel></div>`;
    }
    const b = rangeBounds(this.range);
    const total = c.total_litres;
    const prev = c.previous_total_litres;
    const pct = total !== null && prev ? Math.round(((total - prev) / prev) * 100) : null;
    const bars = usageBars(c, this.range, this.rules, this.leakDays);
    const nightBars = (c.series ?? []).filter((s) => {
      const d = new Date(s.start);
      const m = d.getHours() * 60 + d.getMinutes();
      const f = hmOf(this.rules.night_from);
      const t = hmOf(this.rules.night_to);
      return s.litres !== null && (f <= t ? m >= f && m < t : m >= f || m < t);
    });
    const nightAvg = nightBars.length ? Math.round(nightBars.reduce((s, x) => s + (x.litres ?? 0), 0) / nightBars.length) : null;
    const w = `${this.rules.night_from}-${this.rules.night_to}`;
    const byM = new Map(this.meters.map((m) => [m.id, m]));
    const items = [...c.items].sort((x, y) => (y.litres ?? -1) - (x.litres ?? -1));
    const change = (l: number | null, p: number | null) => (l === null || !p ? null : Math.round(((l - p) / p) * 100));
    const sign = (v: number | null) => (v === null ? '-' : `${v > 0 ? '+' : ''}${v}%`);
    const cls = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'up' : 'down');
    return html`<div class="page" data-water="usage" data-state="ready">
      ${this.renderHead()}
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${wt('tTotal')}</div><div class="v"><span class="num" data-t="total">${fmtM3(total === null ? null : total / 1000)}</span><span class="u">${wt('m3')}</span></div></div>
        <div class="tile"><div class="k">${wt('tVsPrev')}</div><div class="v ${cls(pct)}"><span class="num" data-t="vs">${sign(pct)}</span></div></div>
        <div class="tile"><div class="k">${wt('tDailyAvg')}</div><div class="v"><span class="num" data-t="avg">${fmtM3(total === null ? null : total / 1000 / Math.max(1, b.days))}</span><span class="u">${wt('m3')}</span></div></div>
        <div class="tile"><div class="k">${wt('tNightAvg')}</div><div class="v"><span class="num" data-t="night">${nightAvg ?? '-'}</span><span class="u">${wt('lph')}</span></div></div>
      </div>
      <div class="card">
        <div class="hd"><h3 class="sec">${this.range === 'today' ? wt('hourlyUsage') : wt('dailyUsage')}</h3><span class="sp"></span>
          <div class="legend"><span><i style="background:var(--sw-accent)"></i>${wt('legendDay')}</span><span><i style="background:color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3))"></i>${wt('legendNight', { w })}</span><span><i style="background:var(--sw-danger)"></i>${wt('legendLeak')}</span></div></div>
        <div class="usage-chart" data-usage-chart>${waterBarChart(bars, `${wt('dailyUsage')} · ${wt(RANGE_KEY[this.range])}`, (v) => v.toFixed(v < 10 ? 2 : 1))}</div>
      </div>
      <div class="card flush scrollx desk-only"><table class="t" data-usage-table>
        <thead><tr><th>${wt('colName')}</th><th>${wt('colArea')}</th><th class="n">${wt('colUsage')}</th><th>${wt('colShare')}</th><th class="n">${wt('colVsPrev')}</th><th class="n">${wt('colNight')}</th></tr></thead>
        <tbody>${items.map((i) => {
          const ch = change(i.litres, i.previous_litres);
          const share = i.share === null ? 0 : Math.round(i.share * 100);
          return html`<tr data-meter=${i.meter_id}><td class="b">${i.display_name}</td><td>${i.area_name ?? '-'}<span class="mut dsk">${i.floor_name ? ` · ${i.floor_name}` : ''}</span></td>
            <td class="n"><span class="num">${fmtM3(i.litres === null ? null : i.litres / 1000)}</span></td>
            <td><span class="share"><i><b style="width:${share}%"></b></i><span class="num mut">${share}%</span></span></td>
            <td class="n ${cls(ch)}"><span class="num">${sign(ch)}</span></td><td class="n"><span class="num">${byM.has(i.meter_id) ? nightText(this.night[i.meter_id]) : '-'}</span></td></tr>`;
        })}</tbody></table></div>
      <div class="list phone-only" style="flex-direction:column" data-usage-rows>${items.map((i) => {
        const ch = change(i.litres, i.previous_litres);
        return html`<div class="li"><div class="grow"><div class="t1">${i.display_name}</div><div class="t2">${i.area_name ?? ''} · <span class="num">${i.share === null ? 0 : Math.round(i.share * 100)}%</span> · ${wt('vsPrevShort')} <span class="num ${cls(ch)}">${sign(ch)}</span> · ${wt('night')} ${nightText(this.night[i.meter_id])}</div></div>
          <div class="t2 num" style="text-align:end;font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${fmtM3(i.litres === null ? null : i.litres / 1000)} ${wt('m3')}</div></div>`;
      })}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-usage-page': WaterUsagePage;
  }
}

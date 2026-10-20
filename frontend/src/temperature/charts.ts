import { svg, html, nothing, type TemplateResult } from 'lit';
import type { TempUnit } from '../api/temperature';
import { arcPath, arcPoint, deg, fmt1, frameOf, gaugeRange, hoursOf, linePath, niceTicks, stepPath, xOf, yOf, type Frame } from './model';
import { tt } from '../i18n/temperature';

/**
 * CR-INFRA-TEMPERATURE 2.9.1: the drawings of the temperature screens (owner-approved mockup 2026-10-19): the card gauge (a 240 degree arc with
 * the target band, owner decision 1: kept next to the 24 h ring), the 24-hour sparkline, the big chart and the 24-hour ring. Pure templates; the
 * colours are the `--tc-*` properties of temperature/styles.ts (status tokens). A gap in the data stays a gap; nothing is ever mirrored by RTL
 * (charts are LTR geometry, time runs left to right).
 */

let seq = 0;
const uid = () => `tc${(seq = (seq + 1) % 1e6)}`;

export function gauge(u: Pick<TempUnit, 'low' | 'high' | 'value' | 'value_last'> & { hvac?: TempUnit['hvac'] }, look: string, trend: string | null, size = 120): TemplateResult {
  const cur = u.value ?? u.value_last;
  const sp = u.hvac?.setpoint ?? null;
  const g = gaugeRange(u.low, u.high, [cur, sp].filter((x): x is number => x !== null));
  const f = g.frac;
  const out = cur !== null && (cur > u.high || cur < u.low);
  const [mx, my] = cur !== null ? arcPoint(f(cur)) : arcPoint(0.5);
  const lowP = arcPoint(f(u.low), 58);
  const highP = arcPoint(f(u.high), 58);
  const label = tt('gaugeLabel', { v: deg(cur), lo: deg(u.low), hi: deg(u.high) });
  const tr = trend === 'up' ? tt('trendUp') : trend === 'down' ? tt('trendDown') : trend === 'flat' ? tt('trendFlat') : '';
  return html`<div class="gauge" data-look=${look} style=${`inline-size:${size}px;block-size:${size}px`}>
    <svg viewBox="0 0 120 120" role="img" aria-label=${label} dir="ltr">
      <path d=${arcPath(0, 1)} class="g-track" fill="none" stroke-width="9" stroke-linecap="round"></path>
      <path d=${arcPath(f(u.low), f(u.high))} class="g-band" fill="none" stroke-width="9"></path>
      ${cur !== null && out ? svg`<path d=${f(cur) > f(u.high) ? arcPath(f(u.high), f(cur)) : arcPath(f(cur), f(u.low))} class="g-val" fill="none" stroke-width="9" stroke-linecap="round"></path>` : nothing}
      <text x=${lowP[0].toFixed(1)} y=${lowP[1].toFixed(1)} class="g-tick" text-anchor="middle" dominant-baseline="middle">${deg(u.low)}</text>
      <text x=${highP[0].toFixed(1)} y=${highP[1].toFixed(1)} class="g-tick" text-anchor="middle" dominant-baseline="middle">${deg(u.high)}</text>
      ${sp !== null ? svg`<path d=${`M${arcPoint(g.frac(sp), 40)[0].toFixed(2)} ${arcPoint(g.frac(sp), 40)[1].toFixed(2)}L${arcPoint(g.frac(sp), 56)[0].toFixed(2)} ${arcPoint(g.frac(sp), 56)[1].toFixed(2)}`} class="g-sp" stroke-width="2.5" stroke-linecap="round"><title>${tt('setpointChip', { v: deg(sp) })}</title></path>` : nothing}
      ${cur !== null
        ? svg`<circle cx=${mx.toFixed(2)} cy=${my.toFixed(2)} r="7.5" class="g-dot" stroke-width="2.5"></circle>`
        : svg`<circle cx=${mx.toFixed(2)} cy=${my.toFixed(2)} r="6" class="g-none" fill="none" stroke-dasharray="2 3" stroke-width="2"></circle>`}
    </svg>
    <div class="gv"><b class="num" dir="ltr">${fmt1(cur)}<sup>°C</sup></b><small>${tt('targetWord')} <span dir="ltr" class="num">${deg(u.low)}–${deg(u.high)}</span></small>${tr ? html`<span class="trend" data-trend=${trend}>${tr}</span>` : nothing}</div>
  </div>`;
}

/** The 24-hour sparkline of a card: target band, door openings, defrost windows, the line, and the part outside the band in the alarm colour. */
export function spark(u: TempUnit, now: number, w = 300, h = 52): TemplateResult {
  const t1 = Math.floor(now / 1000);
  const t0 = t1 - 86400;
  const raw = u.spark ?? [];
  const pts = raw.map((p) => [p[0], p[1]] as [number, number]);
  const sps = u.source === 'climate' ? raw.map((p) => [p[0], (p as [number, number, number | null])[2] ?? null] as [number, number | null]) : [];
  const f = frameOf([...pts, ...(sps.filter((p) => p[1] !== null) as [number, number][])], u.low, u.high, t0, t1, w, h);
  const id = uid();
  const d = linePath(pts, f, 900);
  const sd = sps.length ? stepPath(sps, f, 900) : '';
  const band = [yOf(f, u.high), yOf(f, u.low)];
  return html`<div class="spark" dir="ltr" aria-hidden="true">
    <svg viewBox=${`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><clipPath id=${id}><rect x="0" y="0" width=${w} height=${band[0].toFixed(1)}></rect><rect x="0" y=${band[1].toFixed(1)} width=${w} height=${h}></rect></clipPath></defs>
      <rect x="0" y=${band[0].toFixed(1)} width=${w} height=${(band[1] - band[0]).toFixed(1)} class="c-band"></rect>
      ${(u.doors_24h ?? []).map(([a, b]) => svg`<rect x=${xOf(f, a).toFixed(1)} y="0" width=${Math.max(1.5, xOf(f, b) - xOf(f, a)).toFixed(1)} height=${h} class="c-door"></rect>`)}
      ${(u.defrost_24h ?? []).map(([a, b]) => svg`<rect x=${xOf(f, a).toFixed(1)} y="0" width=${Math.max(1, xOf(f, b) - xOf(f, a)).toFixed(1)} height=${h} class="c-defrost"></rect>`)}
      <line x1="0" x2=${w} y1=${band[0].toFixed(1)} y2=${band[0].toFixed(1)} class="c-edge" vector-effect="non-scaling-stroke"></line>
      <line x1="0" x2=${w} y1=${band[1].toFixed(1)} y2=${band[1].toFixed(1)} class="c-edge" vector-effect="non-scaling-stroke"></line>
      ${sd ? svg`<path d=${sd} class="c-sp" fill="none" vector-effect="non-scaling-stroke"></path>` : nothing}
      <path d=${d} class="c-line" fill="none" vector-effect="non-scaling-stroke"></path>
      <path d=${d} class="c-out" fill="none" vector-effect="non-scaling-stroke" clip-path=${`url(#${id})`}></path>
    </svg>
  </div>`;
}

export interface BigChartData {
  points: [number, number][];
  /** a climate unit's setpoint, [ts, setpoint | null] (drawn as a step line) */
  setpoints?: [number, number | null][];
  low: number;
  high: number;
  doors: [number, number][];
  defrost: [number, number][];
  t0: number;
  t1: number;
  step: number;
  /** phase 3 (idea 10): other units drawn over this one (up to 2), in the same axis - shared degrees or normalized to each band */
  overlays?: { id: string; name: string; points: [number, number][] }[];
  /** the axis unit: '°' (degrees) or '' (normalized: 0 = low, 1 = high) */
  axisUnit?: string;
}

export function bigFrame(dt: BigChartData, w: number, h: number): Frame {
  const sp = (dt.setpoints ?? []).filter((p) => p[1] !== null) as [number, number][];
  const ov = (dt.overlays ?? []).flatMap((o) => o.points);
  if (dt.axisUnit === '') {
    // normalized: a fixed frame around 0..1 (the band), widened only by the data
    const vs = [...dt.points, ...ov].map((p) => p[1]).filter((v) => Number.isFinite(v));
    const lo = Math.min(-0.5, ...vs);
    const hi = Math.max(1.5, ...vs);
    return { t0: dt.t0, t1: dt.t1, lo: Math.floor(lo * 2) / 2, hi: Math.ceil(hi * 2) / 2, w, h, ml: 36, mr: 10, mt: 10, mb: 24 };
  }
  return frameOf([...dt.points, ...sp, ...ov], dt.low, dt.high, dt.t0, dt.t1, w, h, { ml: 36, mr: 10, mt: 10, mb: 24 });
}

/** The detail chart (hover handled by the caller through `hit`). x labels: hours for <= 1.5 days, else day.month. */
export function bigChart(dt: BigChartData, w: number, h: number, lang: string, cross: { x: number; y: number | null } | null): TemplateResult {
  const f = bigFrame(dt, w, h);
  const id = uid();
  const d = linePath(dt.points, f, Math.max(900, dt.step * 3));
  const band = [yOf(f, dt.high), yOf(f, dt.low)];
  const span = dt.t1 - dt.t0;
  const xt: { t: number; l: string }[] = [];
  if (span <= 1.5 * 86400) {
    for (let t = Math.ceil(dt.t0 / 14400) * 14400; t <= dt.t1; t += 14400) xt.push({ t, l: new Date(t * 1000).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false }) });
  } else {
    const every = span <= 10 * 86400 ? 1 : 5;
    const first = new Date(dt.t0 * 1000);
    first.setHours(24, 0, 0, 0);
    for (let t = first.getTime() / 1000; t <= dt.t1; t += every * 86400) xt.push({ t, l: new Date(t * 1000).toLocaleDateString(lang, { day: 'numeric', month: 'numeric' }) });
  }
  const pw = w - f.ml - f.mr;
  const ph = h - f.mt - f.mb;
  return html`<svg viewBox=${`0 0 ${w} ${h}`} role="img" aria-label=${tt('chartTitle')} dir="ltr">
    <defs><clipPath id=${id}><rect x=${f.ml} y="0" width=${pw} height=${band[0].toFixed(1)}></rect><rect x=${f.ml} y=${band[1].toFixed(1)} width=${pw} height=${h}></rect></clipPath></defs>
    ${(dt.axisUnit === '' ? [0, 0.5, 1].filter((v) => v >= f.lo && v <= f.hi) : niceTicks(f.lo, f.hi)).map((v) => svg`<line x1=${f.ml} x2=${w - f.mr} y1=${yOf(f, v).toFixed(1)} y2=${yOf(f, v).toFixed(1)} class="c-grid"></line><text x=${f.ml - 6} y=${yOf(f, v).toFixed(1)} class="c-ax" text-anchor="end" dominant-baseline="middle">${v}${dt.axisUnit ?? '°'}</text>`)}
    <rect x=${f.ml} y=${band[0].toFixed(1)} width=${pw} height=${(band[1] - band[0]).toFixed(1)} class="c-band"></rect>
    ${dt.doors.map(([a, b]) => svg`<rect x=${xOf(f, a).toFixed(1)} y=${f.mt} width=${Math.max(2, xOf(f, b) - xOf(f, a)).toFixed(1)} height=${ph} class="c-door"></rect>`)}
    ${dt.defrost.map(([a, b]) => svg`<rect x=${xOf(f, a).toFixed(1)} y=${f.mt} width=${Math.max(1, xOf(f, b) - xOf(f, a)).toFixed(1)} height=${ph} class="c-defrost"></rect>`)}
    <line x1=${f.ml} x2=${w - f.mr} y1=${band[0].toFixed(1)} y2=${band[0].toFixed(1)} class="c-edge"></line>
    <line x1=${f.ml} x2=${w - f.mr} y1=${band[1].toFixed(1)} y2=${band[1].toFixed(1)} class="c-edge"></line>
    ${xt.map((x) => svg`<text x=${xOf(f, x.t).toFixed(1)} y=${h - 6} class="c-ax" text-anchor="middle">${x.l}</text>`)}
    ${dt.setpoints?.length ? svg`<path d=${stepPath(dt.setpoints, f, Math.max(900, dt.step * 3))} class="c-sp big" fill="none"></path>` : nothing}
    ${(dt.overlays ?? []).map((o, i) => svg`<path d=${linePath(o.points, f, Math.max(900, dt.step * 3))} class="c-ov big" data-ov=${i} fill="none"><title>${o.name}</title></path>`)}
    <path d=${d} class="c-line big" fill="none"></path>
    <path d=${d} class="c-out big" fill="none" clip-path=${`url(#${id})`}></path>
    ${cross ? svg`<line x1=${cross.x} x2=${cross.x} y1=${f.mt} y2=${h - f.mb} class="c-cross"></line>${cross.y !== null ? svg`<circle cx=${cross.x} cy=${cross.y} r="5" class="c-crossdot" stroke-width="2"></circle>` : nothing}` : nothing}
  </svg>`;
}

/** The 24-hour ring: one segment per hour, coloured by the worst state measured in it; the hand marks the current hour. */
export function ring(u: TempUnit, now: number, lang: string): TemplateResult {
  const cx = 75;
  const cy = 75;
  const r0 = 44;
  const r1 = 66;
  const hours = hoursOf((u.spark ?? []).map((p) => [p[0], p[1]] as [number, number]), u.low, u.high, now, u.defrost_24h ?? [], u.hard_max);
  const P = (a: number, rr: number) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const label = { ok: tt('ringOk'), warn: tt('ringWarn'), alarm: tt('ringAlarm'), none: tt('ringNone'), defrost: tt('lgDefrost') };
  const segs = hours.map((hh) => {
    const a0 = (hh.hour / 24) * 2 * Math.PI - Math.PI / 2 + 0.012;
    const a1 = ((hh.hour + 1) / 24) * 2 * Math.PI - Math.PI / 2 - 0.012;
    const [x0, y0] = P(a0, r1);
    const [x1, y1] = P(a1, r1);
    const [x2, y2] = P(a1, r0);
    const [x3, y3] = P(a0, r0);
    return svg`<path d=${`M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`} class="r-seg" data-k=${hh.state}><title>${`${String(hh.hour).padStart(2, '0')}:00 · ${label[hh.state]}`}</title></path>`;
  });
  const d = new Date(now);
  const na = ((d.getHours() + d.getMinutes() / 60) / 24) * 2 * Math.PI - Math.PI / 2;
  const labels = [0, 6, 12, 18].map((hh) => {
    const a = (hh / 24) * 2 * Math.PI - Math.PI / 2;
    return svg`<text x=${cx + (r0 - 12) * Math.cos(a)} y=${cy + (r0 - 12) * Math.sin(a)} class="c-ax" text-anchor="middle" dominant-baseline="middle">${String(hh).padStart(2, '0')}</text>`;
  });
  void lang;
  return html`<svg viewBox="0 0 150 150" role="img" aria-label=${tt('ringTitle')} dir="ltr" data-temp-ring>
    ${segs}${labels}
    <line x1=${cx} y1=${cy} x2=${cx + (r1 + 4) * Math.cos(na)} y2=${cy + (r1 + 4) * Math.sin(na)} class="r-hand" stroke-width="2" stroke-linecap="round"></line>
    <circle cx=${cx} cy=${cy} r="3.5" class="r-hub"></circle>
  </svg>`;
}

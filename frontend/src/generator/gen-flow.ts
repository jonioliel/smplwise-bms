/**
 * CR-031 GEN1: the power-flow diagram (the approved v2 hero component) as one pure function of a FlowPlan. Three layouts of the same component: horizontal
 * (grid + transfer switch + generator + load), compact (generator + load: neither mains nor a transfer switch is exposed) and vertical (phone). The geometry is
 * never mirrored by RTL (the svg is `direction: ltr`); the text inside is Hebrew. Cards are drawn only for the roles the controller exposes. Reduced motion
 * removes the travelling dots (CSS) - the lit wires stay.
 */
import { html, svg, nothing, type TemplateResult } from 'lit';
import { he } from '../i18n/he';
import { fmtClock, fmtNum, type FlowPlan } from './gen-logic';

const F = he.generator.flow;
const ICON = {
  grid: 'M12 2v20M5 22l7-20 7 20M7 10h10M5 16h14',
  engine: 'M3 10h3l2-3h6l2 3h5v7h-5l-2 3H8l-2-3H3zM9 13h6',
  load: 'M4 21V9l8-6 8 6v12zM10 21v-6h4v6',
};
type Tone = 'gen' | 'grid' | 'load';
type Pt = [number, number];

export interface FlowOpts {
  id: string;
  vertical: boolean;
  /** The generator's display name. */
  name: string;
  /** Last time mains was seen lost, shown under the grid card ("נפלה ב-14:02"); optional. */
  mainsLostAt?: string | null;
  /** No motion (reduced motion or a stale controller). */
  still?: boolean;
}

function pill(x: number, y: number, text: string, cls: string, anchor: 'end' | 'middle' | 'start' = 'middle') {
  const w = Math.max(44, text.length * 6.6 + 18);
  const x0 = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
  return svg`<g class="fpill ${cls}"><rect x=${x0} y=${y - 10} width=${w} height="20" rx="10"></rect><circle cx=${x0 + w - 10} cy=${y} r="3"></circle><text x=${x0 + w - 17} y=${y + 3.6} text-anchor="end">${text}</text></g>`;
}

export function flowSvg(p: FlowPlan, o: FlowOpts): TemplateResult {
  const { id, vertical } = o;
  const compact = p.layout === 'compact';
  const cw = vertical ? 160 : 190;
  const ch = vertical ? 108 : 96;
  const W = vertical ? 360 : compact ? 540 : 720;
  let H: number;
  let grid: { x: number; y: number } | null;
  let gen: { x: number; y: number };
  let ats: { x: number; y: number } | null;
  let load: { x: number; y: number };
  if (!vertical) {
    grid = p.showMains ? { x: 24, y: 24 } : null;
    gen = { x: compact ? 40 : 24, y: p.showMains ? 152 : compact ? 40 : 88 };
    ats = p.showAts ? { x: 332, y: 100 } : null;
    load = { x: compact ? 310 : 506, y: compact ? 40 : 88 };
    H = compact ? 176 : 272;
  } else {
    grid = p.showMains ? { x: 16, y: 16 } : null;
    gen = { x: p.showMains ? 184 : 100, y: 16 };
    ats = p.showAts ? { x: 150, y: 170 } : null;
    load = { x: 100, y: p.showAts ? 300 : 210 };
    H = load.y + ch + 14;
  }
  const port = (n: { x: number; y: number }, side: 'r' | 'l' | 'b' | 't'): Pt => (side === 'r' ? [n.x + cw, n.y + ch / 2] : side === 'l' ? [n.x, n.y + ch / 2] : side === 'b' ? [n.x + cw / 2, n.y + ch] : [n.x + cw / 2, n.y]);
  const atsIn = (k: 'grid' | 'gen'): Pt => (vertical ? [ats!.x + (k === 'grid' ? 16 : 44), ats!.y] : [ats!.x, ats!.y + (k === 'grid' ? 18 : 42)]);
  const atsOut = (): Pt => (vertical ? [ats!.x + 30, ats!.y + 60] : [ats!.x + 60, ats!.y + 30]);
  const curve = (a: Pt, b: Pt) => (vertical ? `M${a[0]} ${a[1]} C ${a[0]} ${a[1] + 46}, ${b[0]} ${b[1] - 46}, ${b[0]} ${b[1]}` : `M${a[0]} ${a[1]} C ${a[0] + 70} ${a[1]}, ${b[0] - 70} ${b[1]}, ${b[0]} ${b[1]}`);
  const srcOut = (n: { x: number; y: number }) => port(n, vertical ? 'b' : 'r');
  const loadIn = port(load, vertical ? 't' : 'l');
  const paths: { d: string; on: boolean; tone: 'gen' | 'grid' }[] = [];
  if (grid) paths.push({ d: curve(srcOut(grid), ats ? atsIn('grid') : loadIn), on: p.mainsOn === true && !p.onGen, tone: 'grid' });
  paths.push({ d: curve(srcOut(gen), ats ? atsIn('gen') : loadIn), on: p.onGen, tone: 'gen' });
  if (ats) paths.push({ d: curve(atsOut(), loadIn), on: p.loadOn && (p.onGen || p.mainsOn === true), tone: p.onGen ? 'gen' : 'grid' });
  const motion = !p.stale && !o.still;
  const wire = (w: { d: string; on: boolean; tone: 'gen' | 'grid' }) => {
    const base = svg`<path d=${w.d} class="w-base"></path>`;
    if (!w.on) return base;
    const dots = motion ? [0, 0.55, 1.1].map((b) => svg`<circle r="3" class="w-dot ${w.tone}"><animateMotion dur="1.7s" begin="-${b}s" repeatCount="indefinite" path=${w.d}></animateMotion></circle>`) : nothing;
    return svg`${base}<path d=${w.d} class="w-glow ${w.tone}" filter="url(#${id}-glow)"></path><path d=${w.d} class="w-on ${w.tone}" stroke="url(#${id}-g-${w.tone})"></path>${dots}`;
  };
  const card = (n: { x: number; y: number }, c: { icon: string; tone: Tone; dim: boolean; title: string; value: string; sub?: string; pill?: string; pillCls?: string; kind: string }) => {
    const ix = n.x + 16;
    const iy = n.y + 16;
    const tx = n.x + 60;
    return svg`<g class="fnode ${c.dim ? 'dim' : ''} ${c.tone}" data-flow-card=${c.kind}>
      <rect x=${n.x} y=${n.y} width=${cw} height=${ch} rx="18" class="fcard" filter="url(#${id}-shadow)"></rect>
      <rect x=${n.x + 0.5} y=${n.y + 0.5} width=${cw - 1} height=${ch - 1} rx="17.5" class="fring"></rect>
      <circle cx=${ix + 16} cy=${iy + 16} r="17" class="fico-bg"></circle>
      <g transform="translate(${ix + 5} ${iy + 5}) scale(0.92)"><path d=${c.icon} class="fico"></path></g>
      <text x=${tx} y=${n.y + 30} class="ft">${c.title}</text>
      <text x=${tx} y=${n.y + 52} class="fv">${c.value}</text>
      ${c.sub ? svg`<text x=${tx} y=${n.y + 68} class="fs">${c.sub}</text>` : nothing}
      ${c.pill ? pill(n.x + cw - 12, n.y + ch - 14, c.pill, c.pillCls ?? 'mut', 'end') : nothing}
    </g>`;
  };
  const atsG = () => {
    if (!ats) return nothing;
    const cx = ats.x + 30;
    const cy = ats.y + 30;
    const toGrid: Pt = vertical ? [ats.x + 16, ats.y + 8] : [ats.x + 8, ats.y + 18];
    const toGen: Pt = vertical ? [ats.x + 44, ats.y + 8] : [ats.x + 8, ats.y + 42];
    const tgt = p.atsTarget === 'gen' ? toGen : p.atsTarget === 'grid' ? toGrid : null;
    const lbl = p.atsTarget === 'gen' ? F.atsGen : p.atsTarget === 'grid' ? F.atsGrid : F.atsOpen;
    const cls = p.atsTarget === 'gen' ? 'gen' : p.atsTarget === 'grid' ? 'grid' : 'err';
    return svg`<g class="fats ${cls}" data-flow-card="ats">
      <rect x=${ats.x} y=${ats.y} width="60" height="60" rx="16" class="fcard" filter="url(#${id}-shadow)"></rect>
      <rect x=${ats.x + 0.5} y=${ats.y + 0.5} width="59" height="59" rx="15.5" class="fring"></rect>
      <circle cx=${toGrid[0]} cy=${toGrid[1]} r="3.2" class="fp grid"></circle><circle cx=${toGen[0]} cy=${toGen[1]} r="3.2" class="fp gen"></circle>
      ${tgt ? svg`<line x1=${cx} y1=${cy} x2=${tgt[0]} y2=${tgt[1]} class="fblade"></line>` : svg`<line x1=${cx} y1=${cy} x2=${vertical ? cx : ats.x + 10} y2=${vertical ? ats.y + 8 : cy} class="fblade off"></line>`}
      <circle cx=${cx} cy=${cy} r="4.2" class="fpivot"></circle>
      <text x=${cx} y=${ats.y - 10} text-anchor="middle" class="fs c">${F.ats}</text>
      ${pill(cx, ats.y + 76, lbl, cls)}
    </g>`;
  };
  const kwTag = () => {
    if (!ats || (!p.kwKnown && !p.onGen)) return nothing;
    const a = atsOut();
    const x = (a[0] + loadIn[0]) / 2;
    const y = (a[1] + loadIn[1]) / 2;
    const txt = p.kwKnown && p.kw !== null ? `${fmtNum(p.kw)} kW` : p.onGen ? F.fed : '';
    return txt ? pill(vertical ? x + 62 : x, y - (vertical ? 0 : 14), txt, p.onGen ? 'gen' : 'grid') : nothing;
  };
  const mainsV = p.mainsVolts !== null ? `${fmtNum(p.mainsVolts)} V${p.mainsHz !== null ? ` · ${fmtNum(p.mainsHz, 1)} Hz` : ''}` : p.mainsOn ? F.mainsOk : F.mainsNone;
  const gridCard = grid
    ? card(grid, { kind: 'grid', icon: ICON.grid, tone: 'grid', dim: p.mainsOn !== true, title: F.grid, value: p.mainsOn === true ? mainsV : p.mainsOn === false ? F.mainsNone : F.unknown,
        sub: p.mainsOn === false && o.mainsLostAt ? `${F.mainsLostAt} ${fmtClock(o.mainsLostAt)}` : '', pill: p.mainsOn === true ? F.mainsAvail : p.mainsOn === false ? F.mainsLost : F.unknown, pillCls: p.mainsOn === true ? 'grid' : p.mainsOn === false ? 'err' : 'mut' })
    : nothing;
  const genVal = p.stale ? F.noComm : p.genRun ? (p.rpm !== null ? `${fmtNum(p.rpm)} rpm` : p.hz !== null ? `${fmtNum(p.hz, 1)} Hz` : p.volts !== null ? `${fmtNum(p.volts)} V` : F.running) : F.stopped;
  const genSub = p.genRun
    ? [p.rpm !== null && p.hz !== null ? `${fmtNum(p.hz, 1)} Hz` : '', p.loadPct !== null ? `${F.loadShort} ${fmtNum(p.loadPct)}%` : p.kw !== null ? `${fmtNum(p.kw)} kW` : ''].filter(Boolean).join(' · ')
    : p.mode ? `${F.modeWord} ${he.generator.modes[p.mode as keyof typeof he.generator.modes] ?? p.mode}` : '';
  const genPill = p.stale ? F.unknown : p.genRun ? (p.onGen ? F.onLoad : p.mode === 'test' ? F.test : F.running) : p.engine === 'starting' ? he.generator.engine.starting : p.engine === 'cooling' ? he.generator.engine.cooling : p.engine === 'fault' ? he.generator.engine.fault : F.idle;
  const genCard = card(gen, { kind: 'gen', icon: ICON.engine, tone: 'gen', dim: !p.genRun, title: o.name, value: genVal, sub: genSub, pill: genPill, pillCls: p.stale || p.engine === 'fault' ? 'err' : p.genRun ? 'gen' : 'mut' });
  const loadKw = p.onGen && p.kwKnown && p.kw !== null ? `${fmtNum(p.kw)} kW` : null;
  const loadCard = card(load, {
    kind: 'load', icon: ICON.load, tone: 'load', dim: !p.loadOn, title: F.load, value: loadKw ?? (p.loadOn ? F.fed : F.unfed),
    sub: p.onGen && p.loadPct !== null ? `${fmtNum(p.loadPct)}% ${F.ofGen}` : p.mainsOn === true && !p.onGen ? F.fromMains : '',
    pill: p.onGen ? F.fromGen : p.mainsOn === true ? F.fromMainsShort : p.loadOn ? F.fed : F.unfed, pillCls: p.onGen ? 'gen' : p.mainsOn === true ? 'grid' : p.loadOn ? 'gen' : 'err',
  });
  return html`<svg class="flow v2 ${vertical ? 'vert' : ''} ${compact ? 'compact' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label=${F.aria} data-flow data-layout=${vertical ? 'vertical' : compact ? 'compact' : 'full'}>
    <defs>
      <filter id="${id}-glow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4.5"></feGaussianBlur></filter>
      <filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="var(--gen-shadow)" flood-opacity="0.35"></feDropShadow></filter>
      <linearGradient id="${id}-g-gen" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2=${W} y2="0"><stop offset="0" style="stop-color:var(--gen-gen)"></stop><stop offset="1" style="stop-color:color-mix(in srgb, var(--gen-gen) 55%, var(--gen-load))"></stop></linearGradient>
      <linearGradient id="${id}-g-grid" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2=${W} y2="0"><stop offset="0" style="stop-color:var(--gen-grid)"></stop><stop offset="1" style="stop-color:color-mix(in srgb, var(--gen-grid) 55%, var(--gen-load))"></stop></linearGradient>
    </defs>
    ${paths.map(wire)}${gridCard}${genCard}${atsG()}${kwTag()}${loadCard}
  </svg>`;
}

// HOME-V3-P3-2432: "מערכות הבית" - the power supply, the generator, the lifts and the temperatures, VIEW ONLY (owner decision 11.11:
// no generator test, no control, no settings here). Sources: GET generator/devices/live through the generator home widget's own
// derivation (genHomeView: the same supply / engine rule as the generator screen), GET infra/elevators, GET infra/temperature. Each
// part appears only when the person may read it and it exists.
import { html, nothing } from 'lit';
import type { P3 } from './home-p3';
import { ELEVATOR_WORD, GEN_WORD, SUPPLY_WORD, TEMP_OK, plural } from './home-p3-logic';
import { shownState } from '../elevators/model';
import { gapTicketButton } from './home-gaps'; // HOME-V3-GAPS-2436: "דווח על תקלה"

export function sSystems(p: P3) {
  const h = p.h;
  const s = p.sys;
  if (!p.has('systems')) return p.off('מערכות הבית');
  if (!s) return html`${h.head('מערכות הבית', '')}${p.empty('gen', 'אין מערכות להצגה', 'גנרטור, מעליות ומדי טמפרטורה יופיעו כאן כשיחוברו.')}`;
  const ic = p.icon;
  const b = p.sysBad();
  const panes: unknown[] = [];
  const g = s.gen;
  if (g) {
    const [t, sub, tone] = SUPPLY_WORD[g.supply] ?? SUPPLY_WORD.unknown;
    panes.push(html`<section class="tile pane sys" data-tone=${tone} data-p3-sys="power"><span class="sys-k">${ic('bolt')}חשמל</span><b class="mid clamp2">${t}</b>${p.pill(tone, sub)}</section>`);
    const top = g.loudest;
    if (top) {
      const [w, wt] = GEN_WORD[top.state] ?? GEN_WORD.unknown;
      const fuel = top.fuel;
      panes.push(html`<section class="tile pane sys" data-tone=${wt} data-p3-sys="generator"><span class="sys-k">${ic('gen')}${g.total > 1 ? top.name : 'גנרטור'}</span><b class="mid">${w}</b>
        ${fuel != null ? html`<div class=${'mprog' + (fuel < 20 ? ' low' : '')} aria-hidden="true"><i style=${`transform:scaleX(${Math.max(0, Math.min(100, fuel)) / 100})`}></i></div><span class="muted clamp2">דלק <span class="num">${Math.round(fuel)}%</span>${g.total > 1 ? html` · ${plural(g.total, 'גנרטור אחד', 'גנרטורים')}` : nothing}</span>` : nothing}</section>`);
    }
  }
  if (s.elev.length) {
    const pe = p.paged('p3sysE', s.elev, h.phone ? 1 : 2);
    panes.push(html`<section class="tile pane sys" data-p3-sys="lifts"><div class="bar"><span class="sys-k">${ic('lift')}מעליות</span>${h.pager('p3sysE', pe.pages)}</div>${pe.items.map((e) => {
      const [w, t] = ELEVATOR_WORD[shownState(e)] ?? ELEVATOR_WORD.unknown;
      return html`<div class="sysr"><b class="clamp1">${e.name}</b>${p.pill(t, w)}</div>`;
    })}</section>`);
  }
  if (s.temps.length) {
    const pt = p.paged('p3sysT', s.temps, h.phone ? 1 : 3);
    panes.push(html`<section class="tile pane sys" data-p3-sys="temps"><div class="bar"><span class="sys-k">${ic('thermo')}טמפרטורות</span>${h.pager('p3sysT', pt.pages)}</div>${pt.items.map((t) => {
      const v = t.value ?? t.value_last;
      const ok = TEMP_OK.has(t.status);
      return html`<div class="sysr one"><b class="clamp1">${t.name}</b><span class="st" data-tone=${t.stale || t.status === 'offline' || t.status === 'unknown' ? 'neutral' : ok ? 'ok' : 'warn'}><i class="dot"></i><b class="num">${v == null ? '—' : Math.round(v) + '°'}</b></span></div>`;
    })}</section>`);
  }
  return html`${h.head('מערכות הבית', b ? plural(b, 'דבר אחד דורש תשומת לב', 'דברים דורשים תשומת לב') : 'הכל תקין', gapTicketButton(h, 'fault'))}
    <div class=${'sys-grid n' + panes.length} data-p3-systems>${panes}</div><p class="foot-note">${ic('lock')}המסך הזה לצפייה בלבד. הפעלה והגדרות נעשות בממשק המלא.</p>`;
}

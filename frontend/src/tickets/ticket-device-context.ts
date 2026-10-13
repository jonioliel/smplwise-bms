import { html, css, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import type { ActivityItem } from '../api/device-activity';
import type { DeviceContext, EntityTickets, HistoryItem, HistorySummary } from '../api/tickets';
import { clockOf, describeEvent, fullDate } from '../components/device-activity-logic';
import { FINAL } from './model';
import { tIcon } from './icons';
import { dt, type DeviceTextKey } from './device-text';

/** CR-038 slice 3: the device a new ticket is opened from (the device window passes its own GET tickets/by-entity answer). */
export interface DeviceRef {
  id: string;
  name: string;
  data: EntityTickets | null;
}

/** One history line in words: "14:05 · כבוי ← פועל · אוטומציה: קירור בוקר" - the product's own wording of the activity feed; never a person's
 * name (the server keeps none). */
export function historyText(it: HistoryItem): { when: string; what: string; who: string } {
  const d = describeEvent({ kind: it.kind as ActivityItem['kind'], from: it.from as ActivityItem['from'], to: it.to as ActivityItem['to'], changed: it.changed }, 'generic');
  const what = d.from || d.to ? `${d.from ? `${d.from} ← ` : ''}${d.to}` : d.verb;
  const key = `actor_${it.actor.type}` as DeviceTextKey;
  const type = dt(key in ACTORS ? key : 'actor_unknown');
  const who = it.actor.type !== 'person' && it.actor.name ? `${type}: ${it.actor.name}` : type;
  return { when: clockOf(it.at), what, who };
}

const ACTORS: Record<string, true> = Object.fromEntries(['actor_person', 'actor_automation', 'actor_script', 'actor_scene', 'actor_schedule', 'actor_device', 'actor_system', 'actor_unknown'].map((k) => [k, true]));

/** The one line the create sheet shows about the history that will be attached (section 12.3). */
export function historyNote(h: HistorySummary | null | undefined): string {
  if (!h) return '';
  if (h.withheld || h.source === 'none') return dt('historyWithheld');
  if (!h.count) return dt('historyNone', { h: h.window_hours });
  return dt('historyAttach', { h: h.window_hours, n: h.count });
}

/** The create sheet's device block: the device and its place, the device's OPEN tickets first (the duplicate hint, r2), and the history
 * line. Rendered inside `<ticket-create>` (its styles: deviceBlockStyles). */
export function deviceBlock(dev: DeviceRef, hrefOf: (id: string) => string): TemplateResult {
  const d = dev.data;
  const open = (d?.items ?? []).filter((t) => !(FINAL as readonly string[]).includes(t.status));
  const note = historyNote(d?.history);
  return html`<div class="devblk" data-create-device=${dev.id}>
      <span class="di">${tIcon('flag')}</span>
      <div class="dt"><b>${bidi(d?.entity.name || dev.name)}</b>${d?.place_text ? html`<small data-create-place>${bidi(d.place_text)}</small>` : nothing}
        ${note ? html`<small class="hn" data-create-history>${tIcon('clock')}${note}</small>` : nothing}</div>
    </div>
    ${open.length ? html`<div class="similar" data-device-open><b>${dt('existing')}</b>${open.map((t) => html`<a href=${hrefOf(t.id)} data-device-open-item=${t.id}>#${t.number} · ${t.title}</a>`)}</div>` : nothing}`;
}

/** The ticket detail's history section (internal content; the server sends it only to who may read the device too). Rendered inside
 * `<ticket-detail>` with its timeline styles (.sect / .tline). */
export function historySection(c: DeviceContext | null | undefined): TemplateResult | typeof nothing {
  if (!c) return nothing;
  const head = html`<h4><span class="tag">${tIcon('clock')}</span>${dt('sHistory')}<span class="cnt">${c.count || ''}</span></h4>`;
  if (c.withheld || c.source === 'none') {
    return html`<section class="sect" data-sect="device-history">${head}<p class="hmuted" data-history-state="withheld">${dt('historyNotAttached')}</p></section>`;
  }
  const gaps = (c.coverage?.gaps?.length ?? 0) > 0 || c.coverage?.availability === 'partial';
  return html`<section class="sect" data-sect="device-history">${head}
    <p class="hmuted">${dt('historyWindow', { h: c.window_hours })}${c.truncated ? html` · <span data-history-cut>${dt('historyCut', { n: c.count })}</span>` : nothing}${gaps ? html` · <span data-history-gaps>${dt('historyGaps')}</span>` : nothing}</p>
    ${c.lines.length ? html`<ol class="tline" data-device-history>
      ${c.lines.map((it) => {
        const l = historyText(it);
        return html`<li data-kind="device" data-history-line>
          <span class="ring">${tIcon('clock')}</span>
          <div class="tx"><span class="meta"><time datetime=${it.at} title=${fullDate(it.at)}>${l.when}</time> · ${bidi(l.who)}</span><span class="line"><bdi>${l.what}</bdi></span></div>
        </li>`;
      })}
    </ol>` : html`<p class="hmuted" data-history-state="empty">${dt('historyEmpty')}</p>`}
  </section>`;
}

/** Component-level rules of the two blocks above (tokens only; no skin rule). */
export const deviceBlockStyles = css`
  .devblk {
    display: flex; align-items: flex-start; gap: var(--sw-s-3); padding: var(--sw-s-3); border-radius: var(--sw-r-lg);
    background: var(--sw-surface-2); border: 1px solid var(--sw-border);
  }
  .devblk .di { flex: none; display: grid; place-items: center; inline-size: 36px; block-size: 36px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: 18px; }
  .devblk .dt { display: grid; gap: 2px; min-inline-size: 0; }
  .devblk .dt b { font-weight: var(--sw-fw-semibold); }
  .devblk .dt small { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .devblk .hn { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-text-3); }
  .hmuted { margin: 0 0 var(--sw-s-2); color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
`;

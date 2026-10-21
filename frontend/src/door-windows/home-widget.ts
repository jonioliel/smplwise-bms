import { css, html, nothing, type TemplateResult } from 'lit';
import type { WidgetItem } from '../api/home-config';
import { DOORS_HOME_HREF, doorsHomeView, type DoorsHomeRow, type DoorsWidgetData } from './home-widget-model';
import { dwwt } from '../i18n/door-windows-widget';

/**
 * DOORWIN2-295: the doors home widget, built like the elevators / generator ones: one card in the host's shell, drawn only while the doors tab is on
 * and the viewer sees a door. At a glance: ONE line (a relock that was not confirmed, a window that did not start, a program an emergency paused,
 * the doors held open now, or the next window) and, for the holders of an emergency permission when the installation switched the entry on, the
 * "חירום" button that opens the same sheet the door-windows screen opens (hold, then confirm - the server decides everything; this card opens
 * nothing by itself). A live emergency shows as the red line, linking to the screen that releases it.
 * Sizes: small = the line (and the button); medium = adds up to 4 rows; large = up to 8. Clean operator card: no hints, no paragraphs, no platform
 * names, and no service-request action of any kind.
 */
export interface DoorsWidgetHost {
  data: DoorsWidgetData;
  editing: boolean;
  now: Date;
  openEmergency: () => void;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

const ROWS: Record<WidgetItem['size'], number> = { s: 0, m: 4, l: 8 };

export const DOORS_WIDGET_STYLES = css`
  :host {
    --sw-dw-err: #c81e1e;
    --sw-dw-warn: #c2410c;
    --sw-dw-ok: #15803d;
    --sw-dw-off: #667085;
  }
  .wg-doors [data-look='err'] { --dw-c: var(--sw-dw-err); }
  .wg-doors [data-look='warn'] { --dw-c: var(--sw-dw-warn); }
  .wg-doors [data-look='ok'] { --dw-c: var(--sw-dw-ok); }
  .wg-doors [data-look='off'] { --dw-c: var(--sw-dw-off); }
  .wg-doors { gap: 8px; }
  .wg-doors .dw-h { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: var(--sw-text-2); }
  .wg-doors .dw-h b { color: var(--sw-text); font-size: var(--sw-fs-lg); }
  .wg-doors .dw-line { display: flex; align-items: center; gap: 10px; min-inline-size: 0; color: inherit; text-decoration: none; border-radius: 12px; }
  .wg-doors .dw-line:focus-visible, .dw-row:focus-visible, .dw-em:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
  .wg-doors .dw-dot { inline-size: 12px; block-size: 12px; border-radius: 50%; background: var(--dw-c); flex: none; }
  .wg-doors .dw-line b { font-size: var(--sw-fs-lg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
  .wg-doors .lst { display: grid; gap: 6px; }
  .dw-row { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: inherit; text-decoration: none; min-inline-size: 0; border-radius: 10px; padding: 2px 4px; }
  .dw-row .dw-dot { inline-size: 10px; block-size: 10px; }
  .dw-row .nm { flex: 1; font-weight: 600; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dw-row[aria-disabled='true'], .wg-doors .dw-line[aria-disabled='true'] { pointer-events: none; }
  .dw-em {
    min-block-size: 44px; border-radius: 12px; border: 2px solid var(--sw-dw-err); background: var(--sw-surface); color: var(--sw-dw-err);
    font: inherit; font-weight: 700; cursor: pointer; padding: 0 16px; justify-self: start;
  }
  .dw-em[disabled] { opacity: 0.5; cursor: not-allowed; }
`;

const rowText = (r: DoorsHomeRow): string => dwwt(r.key, { name: r.name, t: r.time });

function row(h: DoorsWidgetHost, r: DoorsHomeRow): TemplateResult {
  return html`<a class="dw-row" href=${DOORS_HOME_HREF} data-look=${r.look} data-home-door-row=${r.kind} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    <span class="dw-dot" aria-hidden="true"></span><span class="nm">${rowText(r)}</span></a>`;
}

/** The widget. Never reached without the doors tab on and a visible door (the host resolves availability first). */
export function renderDoors(h: DoorsWidgetHost, it: WidgetItem): TemplateResult {
  const v = doorsHomeView(h.data, h.now);
  const headline = dwwt(v.headline.key, v.headline.vars);
  const emergency = v.emergencyEntry
    ? html`<button type="button" class="dw-em" data-home-door-emergency aria-label=${dwwt('emergencyAria')} ?disabled=${h.editing} @click=${() => h.openEmergency()}>${dwwt('emergency')}</button>`
    : nothing;
  const line = html`<a class="dw-line" href=${DOORS_HOME_HREF} data-look=${v.look} data-home-doors-line=${v.headline.key} data-home-doors-incident=${String(!!v.incident)}
    aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}><span class="dw-dot" aria-hidden="true"></span><b>${headline}</b></a>`;
  const shown = v.rows.filter((r) => !(v.headline.key === 'next' && r.kind === 'next')).slice(0, ROWS[it.size]);
  const rows = it.size !== 's' && shown.length ? html`<div class="lst" data-home-doors-list>${shown.map((r) => row(h, r))}</div>` : nothing;
  const head = it.size === 's' ? nothing : html`<div class="dw-h"><b>${it.title}</b></div>`;
  return h.shell(it, 'wg-doors', { tone: v.look }, html`${head}${line}${rows}${emergency}`);
}

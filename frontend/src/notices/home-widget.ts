import { css, html, nothing, type TemplateResult } from 'lit';
import '../components/sw-icon';
import type { WidgetItem } from '../api/home-config';
import { ApiError } from '../api/client';
import { listNotices, type Notice } from '../api/notices';
import { nt } from '../i18n/notices';
import { noticesModuleOn, NOTICES_HREF } from '../shell/nav';
import { SEV_LOOK } from './model';
import { MAX, NONE, noticeSubline, widgetNotices, type NoticesWidgetData } from './home-widget-model';

export { noticesWidgetAvailable, noticesWidgetOffered } from './home-widget-model';
export type { NoticesWidgetData } from './home-widget-model';

/**
 * NOTICEPAGE-295 (CR-NOTICE106 section 9): the home widget "לוח הודעות" - up to three of the notices that are active for me, the
 * urgent ones first, a dot on the ones I have not read, and the header link "הכול" to the page. Read-only; no action of any kind
 * (no "open a service request" either: the tickets module is not consulted). It is drawn only while the module is on and the server
 * lets me read (anything else = the widget is ABSENT, in the editor too: an installation without the board never hears of it). The
 * home screen reads `GET /notices` (scope mine) through `loadHomeNoticesChecked` and polls it like the other infrastructure widgets.
 * Sizes: small = the top notice, medium = up to three, large = up to three with the first line of each text.
 */

export interface NoticesWidgetHost {
  data: NoticesWidgetData;
  editing: boolean;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

const ROWS: Record<WidgetItem['size'], number> = { s: 1, m: MAX, l: MAX };

/**
 * `null` = the read FAILED (the home screen then draws the widget's failure panel with a retry); NONE = nothing to show: the module is off
 * (no request is made at all) or the server answered 403 / 404 (not a reader, or the module was switched off meanwhile).
 */
export async function loadHomeNoticesChecked(): Promise<NoticesWidgetData | null> {
  if (!noticesModuleOn()) return NONE;
  try {
    const r = await listNotices('mine');
    return { notices: r.notices, emptyMode: r.defaults?.home_empty === 'line' ? 'line' : 'hide' };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return NONE;
    return null;
  }
}

export const NOTICES_WIDGET_STYLES = css`
  .wg-notices { gap: 8px; }
  .wg-notices .nt-h { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-base); color: var(--sw-text-2); }
  .wg-notices .nt-h b { color: var(--sw-text); font-size: var(--sw-fs-lg); flex: 1; min-inline-size: 0; }
  .wg-notices .nt-h a { color: var(--sw-accent-text); text-decoration: none; font-size: var(--sw-fs-sm); }
  .wg-notices .nt-h a[aria-disabled='true'] { pointer-events: none; }
  .wg-notices .lst { display: grid; gap: 6px; }
  .nt-row { display: flex; align-items: center; gap: 10px; min-inline-size: 0; color: inherit; text-decoration: none; border-radius: 10px; padding: 2px 4px; }
  .nt-row:focus-visible, .wg-notices .nt-h a:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
  .nt-row[aria-disabled='true'] { pointer-events: none; }
  .nt-row .sev { inline-size: 10px; block-size: 10px; border-radius: 50%; flex: none; background: var(--nt-c, var(--sw-accent)); }
  .nt-row[data-look='warn'] { --nt-c: var(--sw-warning); }
  .nt-row[data-look='alarm'] { --nt-c: var(--sw-danger); }
  .nt-row[data-look='acc'] { --nt-c: var(--sw-accent); }
  .nt-row .tt { display: grid; gap: 1px; flex: 1; min-inline-size: 0; }
  .nt-row .tt b { font-size: var(--sw-fs-base); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nt-row .tt span { color: var(--sw-text-2); font-size: var(--sw-fs-state); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nt-row .new { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--sw-accent); flex: none; }
  .wg-notices .none { display: flex; align-items: center; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
`;

function row(h: NoticesWidgetHost, n: Notice, withText: boolean): TemplateResult {
  const first = withText ? n.body.split('\n')[0] : '';
  return html`<a class="nt-row" href=${NOTICES_HREF} data-look=${SEV_LOOK[n.severity]} data-home-notice=${n.id} data-unread=${String(n.read === false)} aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>
    <span class="sev" aria-hidden="true"></span><span class="tt"><b>${n.title}</b><span>${noticeSubline(n)}</span>${first ? html`<span>${first}</span>` : nothing}</span>
    ${n.read === false ? html`<span class="new" aria-label=${nt('widgetNew')}></span>` : nothing}</a>`;
}

/** The widget. Never reached unless the module is on and the read succeeded (the host resolves availability first). */
export function renderNotices(h: NoticesWidgetHost, it: WidgetItem): TemplateResult {
  const list = widgetNotices(h.data.notices).slice(0, ROWS[it.size]);
  const head = html`<div class="nt-h"><sw-icon name="bell" size="16"></sw-icon><b>${it.title}</b>
    <a href=${NOTICES_HREF} data-home-notices-all aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>${nt('widgetAll')}</a></div>`;
  const body = list.length
    ? html`<div class="lst" data-home-notices-list>${list.map((n) => row(h, n, it.size === 'l'))}</div>`
    : html`<div class="none" data-home-notices-none><sw-icon name="check" size="16"></sw-icon>${nt('widgetEmpty')}</div>`;
  return h.shell(it, 'wg-notices', {}, html`${head}${body}`);
}

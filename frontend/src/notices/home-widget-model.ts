import type { Notice, Severity } from '../api/notices';
import { nt } from '../i18n/notices';
import { SEV_KEY } from './model';

/** NOTICEPAGE-295: the pure logic of the home notices widget (no DOM, no network). */
export interface NoticesWidgetData {
  /** the notices active for me; null = nothing to show (module off, or not allowed) */
  notices: Notice[] | null;
  /** the board setting `home_empty`: with no active notice the widget is absent (`hide`, the default) or shows one line (`line`) */
  emptyMode: 'hide' | 'line';
}

export const NONE: NoticesWidgetData = { notices: null, emptyMode: 'hide' };
export const MAX = 3;
const SEV_RANK: Record<Severity, number> = { critical: 0, alert: 1, info: 2 };

/** The widget is OFFERED (listed in the home editor and the personal list) when the module is on and the read succeeded. */
export function noticesWidgetOffered(d: NoticesWidgetData, moduleOn: boolean): boolean {
  return moduleOn && d.notices !== null;
}

/** The widget is DRAWN when it is offered and there is something to say: an active notice, or the board setting asks for the empty line. */
export function noticesWidgetAvailable(d: NoticesWidgetData, moduleOn: boolean): boolean {
  return noticesWidgetOffered(d, moduleOn) && (widgetNotices(d.notices).length > 0 || d.emptyMode === 'line');
}

/** The notices the widget lists: active only, urgent first, then important, then the rest, each group in the server's order (pinned first). */
export function widgetNotices(list: readonly Notice[] | null): Notice[] {
  return (list ?? []).filter((n) => n.state === 'active').map((n, i) => ({ n, i })).sort((a, b) => SEV_RANK[a.n.severity] - SEV_RANK[b.n.severity] || a.i - b.i).map((x) => x.n).slice(0, MAX);
}

const two = (x: number) => ('0' + x).slice(-2);

/** "דחוף · עד 25.10" - the severity and, when the notice ends, until when. */
export function noticeSubline(n: Pick<Notice, 'severity' | 'ends_at'>): string {
  const sev = nt(SEV_KEY[n.severity]);
  if (!n.ends_at) return sev;
  const e = new Date(n.ends_at);
  return `${sev} · ${nt('widgetUntil', { d: `${two(e.getDate())}.${two(e.getMonth() + 1)}` })}`;
}

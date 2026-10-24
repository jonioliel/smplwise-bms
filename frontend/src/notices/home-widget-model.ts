import type { Notice, Severity } from '../api/notices';
import { nt } from '../i18n/notices';
import { SEV_KEY } from './model';

/** NOTICEPAGE-295: the pure logic of the home notices widget (no DOM, no network). */
export interface NoticesWidgetData {
  /** the notices active for me; null = nothing to show (module off, or not allowed) */
  notices: Notice[] | null;
}

export const NONE: NoticesWidgetData = { notices: null };
export const MAX = 3;
const SEV_RANK: Record<Severity, number> = { critical: 0, alert: 1, info: 2 };

/** The widget is ABSENT unless the module is on and the read succeeded (an empty list still shows the widget with its empty line). */
export function noticesWidgetAvailable(d: NoticesWidgetData, moduleOn: boolean): boolean {
  return moduleOn && d.notices !== null;
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

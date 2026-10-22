/**
 * CR-INSIGHT215 (2.15.0): who may open the insight screens in the frontend (the server checks every call again; the default readers are
 * the site administrator and the system administrator, the roles that hold the permissions):
 *   report  reports.building   installation scope (the building report is installation-wide)
 *   read    insights.read      any scope (the door / waste rows are narrowed per entity on the server)
 *   manage  insights.manage    Settings › תשתיות › תובנות ודוחות (installation)
 *   switch  system.configure   turning one of the three switches on or off
 * A tab appears only while the part's switch is on: the server's status route (no computation, no audit row) says which parts are on for
 * this viewer; a failed read hides them (never an error banner on a part the installation may not use).
 */
import { can, canAnywhere, isApi, onSession } from '../api/session';
import { getStatus, type InsightsStatus } from '../api/insights';
import { applyInfraInsights } from '../shell/nav';

export interface InsightsAccess {
  report: boolean;
  read: boolean;
  manage: boolean;
  switch: boolean;
}

export function insightsAccess(): InsightsAccess {
  if (!isApi()) return { report: false, read: false, manage: false, switch: false };
  return { report: can('reports.building'), read: canAnywhere('insights.read'), manage: can('insights.manage'), switch: can('system.configure') };
}

export function onInsightsAccess(fn: (a: InsightsAccess) => void): () => void {
  return onSession(() => fn(insightsAccess()));
}

export const NONE: InsightsStatus = { doors: false, waste: false, report: false };
let last: InsightsStatus = NONE;
export const insightsStatus = (): InsightsStatus => last;

/** Asked once when the shell loads (and after a switch changed): shows the tabs of the parts that are on. */
export async function refreshInsightsVisibility(): Promise<InsightsStatus> {
  const a = insightsAccess();
  if (!a.read && !a.report && !a.manage) {
    last = NONE;
    applyInfraInsights(last);
    return last;
  }
  try {
    const s = await getStatus();
    last = { doors: s.doors && a.read, waste: s.waste && a.read, report: s.report && a.report };
  } catch {
    last = NONE;
  }
  applyInfraInsights(last);
  return last;
}

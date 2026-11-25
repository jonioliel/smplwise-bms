/**
 * WISKEY-SCHED-READS-2520 (owner decision B2-ABI = a): WisKey's signed schedule INSPECTION jobs (`wiskey-schedule-reads.v1`), served by
 * routers/access_control_schedule_reads.py (backend: services/wiskey_schedule_reads.py).
 *
 *   GET  access-control/schedules/reads                        the support state + the newest inspections Arx started (persisted)
 *   POST access-control/schedules/reads                        {action, parameters}: start ONE inspection (`read` null = not supported
 *                                                              now: nothing was persisted or sent)
 *   POST access-control/schedules/reads/{request_id}/status    one signed status read - never a start
 *
 * READ ONLY. A start whose acknowledgement was lost is `unknown` and is settled only by a status read with the same request id; the
 * browser never re-sends a start (it has no request id to send: the server makes it). Nothing here writes to a station, deploys, approves
 * or executes a schedule. The permission is the schedules administrator's (a 403 otherwise).
 */
import { get, post } from './client';
import type { ScheduleRead, ScheduleReadAnswer, ScheduleReadsList, ScheduleReadsSupport } from './generated/wire-access-control-schedule-reads';

export type { ScheduleRead, ScheduleReadAnswer, ScheduleReadsList, ScheduleReadsSupport };

/** The closed Arx actions (the server maps them to WisKey's six inspection operations). */
type ScheduleReadAction = 'readiness' | 'dependencies' | 'assess' | 'plan_preview' | 'plan_recheck' | 'claim_preview';

const BASE = 'access-control/schedules/reads';

export const listScheduleReads = () => get<ScheduleReadsList>(BASE);
export const startScheduleRead = (action: ScheduleReadAction, parameters: Record<string, unknown>) =>
  post<ScheduleReadAnswer>(BASE, { action, parameters });
export const checkScheduleRead = (requestId: string) => post<ScheduleReadAnswer>(`${BASE}/${encodeURIComponent(requestId)}/status`);

/**
 * WISKEY-A2-EXEC-2530 (owner 25.11, A2 option b: "the owner approves in WisKey's screen, Arx shows status only"): the READ-ONLY status
 * of WisKey's reviewed schedule execution (`wiskey-schedule-execution.v1`), served by routers/access_control_schedule_execution.py
 * (backend: services/wiskey_schedule_execution.py).
 *
 *   GET  access-control/schedules/execution                    the switch, the support state and the jobs read so far
 *   POST access-control/schedules/execution/{job_id}/status    one signed status read of one WisKey job - never anything else
 *   PUT  access-control/schedules/execution/settings           {enabled}: the installation switch (default off; system administrators)
 *
 * Nothing here approves, executes, previews or cancels: the owner does that in WisKey's own screen. The permission is the schedules
 * administrator's (a 403 otherwise); the switch is the system administrator's.
 */
import { get, post, put } from './client';
import type {
  ScheduleExecutionCheck,
  ScheduleExecutionJob,
  ScheduleExecutionSupport,
  ScheduleExecutionView,
} from './generated/wire-access-control-schedule-execution';

export type { ScheduleExecutionCheck, ScheduleExecutionJob, ScheduleExecutionSupport, ScheduleExecutionView };

const BASE = 'access-control/schedules/execution';

export const getScheduleExecution = () => get<ScheduleExecutionView>(BASE);
export const checkScheduleExecution = (jobId: string) => post<ScheduleExecutionCheck>(`${BASE}/${encodeURIComponent(jobId)}/status`);
export const setScheduleExecution = (enabled: boolean) => put<ScheduleExecutionView>(`${BASE}/settings`, { enabled });

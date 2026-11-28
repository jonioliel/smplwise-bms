import { confirmDialog } from '../components/confirm-dialog';
import type { RunTarget } from '../api/run-confirm';
import { confirmLine } from './automations-logic';
import { tr } from '../i18n/msg/automation';

/**
 * FIX-FE2-2570 (deep review 2.57, FE2-01): the question before a sensitive scene / script runs - the shared confirmation dialog, naming
 * the item and what it touches (the line manual control shows), with the focus on "ביטול" as every physical confirmation
 * (PHYSICAL-CONFIRM-2540). Used by the scenes panel, the home launcher and the area quick sheet through `runConfirmed`.
 */
export function askRun(item: RunTarget): Promise<boolean> {
  return confirmDialog({
    heading: tr('להפעיל את "{name}"?', { name: item.name }),
    body: confirmLine(item) || tr('כולל פעולה שדורשת אישור מפורש, למשל פתיחת דלת.'),
    confirmLabel: tr('הפעל'),
    focusCancel: true,
  });
}

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CONTROLLED-TOGGLES-2540: a source guard next to the behaviour spec (evidence-controlled-toggles-2540.spec.ts). Every switch below saves at
// once when it is pressed; it must be a `controlled` sw-toggle (HONEST-STATES-2540), so a refused or failed save never leaves it on a state
// that was not saved. The guard counts the controlled switches per file: a later edit that drops the attribute (or a copy of the row
// that forgets it) fails here. The number is the switches of that file that save at once - the file's draft switches (edited, then saved
// with a button) stay plain on purpose.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** The opening tags of the sw-toggle elements in a file (the tag runs to the first `>` outside a `${...}` expression). */
function toggleTags(file: string): string[] {
  const s = fs.readFileSync(path.join(SRC, file), 'utf8');
  const out: string[] = [];
  let at = s.indexOf('<sw-toggle');
  while (at >= 0) {
    let i = at + '<sw-toggle'.length;
    let depth = 0;
    for (; i < s.length; i += 1) {
      if (s.startsWith('${', i)) { depth += 1; i += 1; continue; }
      const c = s[i];
      if (c === '{' && depth) depth += 1;
      else if (c === '}' && depth) depth -= 1;
      else if (c === '>' && depth === 0 && s[i - 1] !== '=') break;
    }
    out.push(s.slice(at, i + 1));
    at = s.indexOf('<sw-toggle', i);
  }
  return out;
}

const controlledIn = (file: string) => toggleTags(file).filter((t) => /^<sw-toggle\s+controlled\b/.test(t)).length;

function guard(family: string, files: Record<string, number>) {
  test(`${family}: every switch that saves at once is controlled`, () => {
    for (const [file, n] of Object.entries(files)) expect(controlledIn(file), file).toBe(n);
  });
}

guard('schedules', {
  'components/wk-schedule-exec.ts': 1, // the "status in WisKey" switch (PUT schedules/execution/settings)
  'components/device-activity.ts': 1, // a schedule's enable switch in the device sheet
});

guard('tickets settings', {
  'tickets/settings-channel.ts': 5, // the message channel: on, buttons, e-mail fallback, phone check, managers' full numbers
  'tickets/settings-costs.ts': 1,
  'tickets/settings-dept.ts': 9, // active, open to all, member notify, priority active, history, auto close, own links / hours, template active
  'tickets/settings-message-templates.ts': 1,
  'tickets/settings-rules.ts': 1, // the rules' master switch (a rule's own switch is a draft)
  'tickets/settings-visits.ts': 1,
  'tickets/reports-settings.ts': 1,
  'tickets/intake-settings.ts': 2,
  'tickets/notify-matrix.ts': 2,
  'tickets/handlers-members.ts': 3,
  'tickets/staff-mine.ts': 1,
  'screens/system-tickets.ts': 5, // the module switch, urgent is critical, arrival schedule, question badge, vendor uploads
});

guard('module settings', {
  'maintenance/settings.ts': 4, // the module, emergency readiness, reminders, missing insurance
  'temperature/temp-settings.ts': 1, // an alert kind's switch (the rule switches are a draft)
  'screens/insights-settings.ts': 2, // the insight switches, the building report delivery
  'elevators/elevator-alerts.ts': 1,
  'components/frigate-auto-profile.ts': 1, // the auto-apply consent
  'screens/investigate-rules.ts': 1, // a rule's on / off in the list
  'screens/devices-type-admin.ts': 1, // "may be turned on in bulk"
});

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

guard('system settings', {
  'screens/system-announcements.ts': 9, // quiet, notify, screens, screens default, a screen allowed, translate, a speaker, announcements, pause music
  'screens/system-building-presence.ts': 3,
  'screens/system-calendars.ts': 1, // a calendar's approval (the settings switches save optimistically and put themselves back)
  'calendars/connect-dialogs.ts': 1, // a feed's remote address (on waits for the confirmation)
  'screens/system-cast.ts': 5,
  'screens/system-diagnostics.ts': 3, // the local restore scope, the safety backup, the first-run guide
  'screens/system-fleet-report.ts': 1,
  'screens/system-local-users.ts': 1, // a passkey as the first factor
  'screens/system-multimedia.ts': 2, // a device public, the module
  'screens/system-multimedia-players.ts': 4,
  'screens/media-admin-list.ts': 1, // a device approved
  'screens/system-notices.ts': 5, // the module, remote boards, the places tree, own news, a board on
  'notices/info-sources.ts': 1,
  'screens/system-transit.ts': 3,
  'screens/presence-opt-out.ts': 1,
});

guard('security and integration cards', {
  'components/sw-offbox-backup.ts': 2, // a target on / off, the monthly drill (the restore scope saves optimistically; the form is a draft)
  'components/sw-bridge-key-card.ts': 1,
  'components/sw-partner-api-card.ts': 1,
  'screens/messaging-pacing-card.ts': 1,
  'screens/messaging-policy-card.ts': 1,
  'screens/wa-installed-card.ts': 1,
  'components/media-ma-connection.ts': 1,
});

guard('home administration', {
  // FIX-FE-2570 (deep review 2.56 FE-02, 2.57 FE2-17): visitor invitations, wall rest, wall night, and per person: may switch, home only,
  // wall panel mode, guests (the behaviour test is fix-fe-2570.spec.ts: a refused save leaves each on the server's state)
  'home/sw-home-admin.ts': 7,
});

// FIX-FE-2570 (deep review 2.57 FE2-17): the per-file counts above only see the files on the list - sw-home-admin.ts was missing and its
// seven save-at-once switches stayed uncontrolled while the guard passed. This part finds the switches itself: every sw-toggle in src whose
// `@change` expression calls a save / put / post / patch / apply function is a save-at-once switch and must be `controlled`.
// KNOWN_UNCONTROLLED is a ratchet of the ones that matched when the discovery was added (not reviewed one by one here: some save
// optimistically and put themselves back, as generator/gen-routing.ts does with live() + a reload). A count may only go down; a new file
// or a higher count fails. A switch whose handler is a named method (`this.toggle(...)`) is not seen - the per-file counts cover those.
const SAVES_AT_ONCE = /@change=\$\{[\s\S]*?(\bsave\w*\(|\bput\w*\(|\bpost\w*\(|\bpatch\w*\(|\bset\w*Setting|\bapply\w*\()/;
const KNOWN_UNCONTROLLED: Record<string, number> = {
  'components/notify-whatsapp-section.ts': 1,
  'components/sw-offbox-backup.ts': 1,
  'door-windows/event-rules.ts': 2,
  'generator/gen-routing.ts': 2,
  'screens/automation-ext-forms.ts': 1,
  'screens/devices-layout.ts': 2,
  'screens/multimedia-remote-editor.ts': 1,
  'screens/plan-studio-panel.ts': 1,
  'screens/system-call-banner.ts': 1,
  'screens/system-calendars.ts': 3,
  'screens/system-notifications.ts': 1,
  'screens/system-presence.ts': 3,
  'screens/system-schedules.ts': 1,
  'screens/wiskey-person-editor.ts': 1,
  'temperature/wizard.ts': 2,
};

function sourceFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...sourceFiles(dir, r));
    else if (e.name.endsWith('.ts')) out.push(r);
  }
  return out;
}

test('FE2-17: a switch that saves at once is controlled wherever it is (found, not listed)', () => {
  const found: Record<string, number> = {};
  for (const file of sourceFiles(SRC)) {
    if (!fs.readFileSync(path.join(SRC, file), 'utf8').includes('<sw-toggle')) continue;
    const n = toggleTags(file).filter((t) => !/^<sw-toggle\s+controlled\b/.test(t) && SAVES_AT_ONCE.test(t)).length;
    if (n) found[file] = n;
  }
  expect(found['home/sw-home-admin.ts'] ?? 0, 'home/sw-home-admin.ts (FE-02)').toBe(0);
  const over = Object.entries(found).filter(([f, n]) => n > (KNOWN_UNCONTROLLED[f] ?? 0)).map(([f, n]) => `${f}: ${n} (known ${KNOWN_UNCONTROLLED[f] ?? 0})`);
  expect(over, 'a save-at-once sw-toggle without `controlled`').toEqual([]);
});

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { validateDraft, type AutomationDraft, type Issue } from '../src/api/automations';
import { resetAutomationsMock, SHABBAT_SENSOR } from '../src/api/automations-mock';
import { GATE_TEXT, saveGateOf, warningsOnly, type SaveGateCode, type SaveGateFacts } from '../src/screens/automation-save-gate';
import { KeyedMemo, NewestApplied, OneAtATime, SingleFlight } from '../src/screens/editor-guards';

// CR-EDITORS-MEMO-2440 (review 06:PERF-3, PERF-4, PERF-6, GATE-1, RACE-6, RACE-7, MAPA-1, INFILE-1; docs/changes/CR-EDITORS-MEMO-2440.md).
// Node only: the four guards of screens/editor-guards.ts driven with answers that overlap and come back in the wrong order, the save
// gate's codes (screens/automation-save-gate.ts), and the five screens' sources (the elements themselves need a browser: the
// automation editor, schedules and privacy-mask evidence specs cover them on the runner).
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test.describe('KeyedMemo: a derived value is computed once per set of inputs', () => {
  test('the same inputs compute once; another object in any place computes again; clear() forgets', () => {
    const memo = new KeyedMemo<number>();
    let n = 0;
    const a = { v: 1 };
    const b = { v: 1 };
    expect(memo.get([a, 'x'], () => ++n)).toBe(1);
    expect(memo.get([a, 'x'], () => ++n)).toBe(1);
    expect(memo.get([b, 'x'], () => ++n)).toBe(2); // equal content, another object: the screens replace, never edit in place
    expect(memo.get([b, 'y'], () => ++n)).toBe(3);
    expect(memo.get([b], () => ++n)).toBe(4); // a shorter key list is another key
    memo.clear();
    expect(memo.get([b], () => ++n)).toBe(5);
    expect(n).toBe(5);
  });

  test('a value that is undefined or false is still remembered', () => {
    const memo = new KeyedMemo<boolean | undefined>();
    let n = 0;
    const make = () => (++n, false);
    expect(memo.get([1], make)).toBe(false);
    expect(memo.get([1], make)).toBe(false);
    expect(n).toBe(1);
  });

  test('PERF-3: one update of the automation editor validates the draft once, however many lists and blocks ask for the issues', async () => {
    const store = resetAutomationsMock({ user: 'installer' });
    const draft = store.draftFor('automation', store.idOf('automation.bed_ac_clock')) as AutomationDraft;
    let calls = 0;
    const memo = new KeyedMemo<Issue[]>();
    const serverIssues: Issue[] = [];
    // the editor's `issues` getter: the keys are what the getter reads
    const issues = (d: AutomationDraft, version: number) =>
      memo.get(['automation', d, version, serverIssues], () => {
        calls++;
        return validateDraft('automation', d, { shabbatSensor: SHABBAT_SENSOR, notifyTargets: [] });
      });
    const first = issues(draft, 1);
    for (let i = 0; i < 40; i++) expect(issues(draft, 1)).toBe(first); // the save gate, the validation box, every list, every nested block
    expect(calls).toBe(1);
    // a keystroke: the draft is replaced and the version moves
    const next = structuredClone(draft);
    for (let i = 0; i < 40; i++) issues(next, 2);
    expect(calls).toBe(2);
    // the start of a Lit update forgets (willUpdate): one validation for that update, not zero and not forty
    memo.clear();
    for (let i = 0; i < 40; i++) issues(next, 2);
    expect(calls).toBe(3);
  });
});

test.describe('SingleFlight: a refresh round never overlaps itself (RACE-6)', () => {
  function rounds() {
    const log: string[] = [];
    const gates: Array<ReturnType<typeof deferred>> = [];
    let active = 0;
    let maxActive = 0;
    const flight = new SingleFlight<boolean>(
      async (recheck) => {
        const n = gates.length + 1;
        log.push(`start ${n}${recheck ? ' recheck' : ''}`);
        active++;
        maxActive = Math.max(maxActive, active);
        const g = deferred();
        gates.push(g);
        await g.promise;
        active--;
        log.push(`end ${n}`);
      },
      (a, b) => a || b,
    );
    return { flight, log, gates, max: () => maxActive };
  }

  test('overlapping pushes -> one extra round, never two at once', async () => {
    const r = rounds();
    void r.flight.run(false);
    await flush();
    expect(r.log).toEqual(['start 1']);
    // five pushes while the first round is still reading
    const waits = [1, 2, 3, 4, 5].map(() => r.flight.run(false));
    await flush();
    expect(r.log).toEqual(['start 1']); // nothing started beside it
    expect(new Set(waits).size).toBe(1); // they share the one waiting round
    r.gates[0].resolve();
    await flush();
    expect(r.log).toEqual(['start 1', 'end 1', 'start 2']);
    r.gates[1].resolve();
    await Promise.all(waits);
    await flush();
    expect(r.log).toEqual(['start 1', 'end 1', 'start 2', 'end 2']); // one extra round, not five
    expect(r.max()).toBe(1);
    expect(r.flight.busy).toBe(false);
  });

  test('a call made while a round runs resolves only after a round that STARTED after it (a write is read back)', async () => {
    const r = rounds();
    void r.flight.run(false);
    await flush();
    let done = false;
    void r.flight.run(false).then(() => (done = true));
    r.gates[0].resolve();
    await flush();
    expect(done).toBe(false); // round 1 began before the call: its answer may predate the caller's write
    r.gates[1].resolve();
    await flush();
    expect(done).toBe(true);
  });

  test('the waiting round keeps `recheck` of any caller that shares it', async () => {
    const r = rounds();
    void r.flight.run(false);
    await flush();
    void r.flight.run(false);
    void r.flight.run(true);
    void r.flight.run(false);
    r.gates[0].resolve();
    await flush();
    expect(r.log[2]).toBe('start 2 recheck');
    r.gates[1].resolve();
    await flush();
  });

  test('a call that arrives between the end of a round and the start of the waiting one joins the waiting one', async () => {
    const r = rounds();
    void r.flight.run(false);
    await flush();
    void r.flight.run(false);
    r.gates[0].resolve();
    await Promise.resolve(); // round 1 is finishing; the waiting round has not started yet
    void r.flight.run(false);
    await flush();
    expect(r.log.filter((l) => l.startsWith('start'))).toEqual(['start 1', 'start 2']);
    r.gates[1].resolve();
    await flush();
    expect(r.max()).toBe(1);
    expect(r.log).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });

  test('a round that fails does not stop the next one; with nothing in flight a call starts at once', async () => {
    let n = 0;
    const flight = new SingleFlight<void>(async () => {
      n++;
      if (n === 1) throw new Error('offline');
    });
    await flight.run();
    expect(flight.busy).toBe(false);
    await flight.run();
    expect(n).toBe(2);
  });
});

test.describe('NewestApplied: the open schedule is read from two places (RACE-6)', () => {
  test('an older answer that arrives last does not land on the newer one', () => {
    const reads = new NewestApplied();
    let detail = '';
    const opened = reads.begin(); // the drawer opened: getSchedule
    const pushed = reads.begin(); // a push: the round reads it again
    if (pushed()) detail = 'revision 2';
    if (opened()) detail = 'revision 1';
    expect(detail).toBe('revision 2');
  });

  test('answers in the order they were asked both land; a newer read that FAILS does not discard the older answer', () => {
    const reads = new NewestApplied();
    let detail = '';
    const a = reads.begin();
    const b = reads.begin();
    if (a()) detail = 'a';
    if (b()) detail = 'b';
    expect(detail).toBe('b');
    const c = reads.begin();
    reads.begin(); // d: its request fails, so it never asks to land
    if (c()) detail = 'c';
    expect(detail).toBe('c');
  });

  test('the round of devices-schedules: overlapping pushes and a drawer that moved to another schedule leave the right detail', async () => {
    // the screen's refresh path, with the same two guards and a server whose answers are released by hand
    const reads = new NewestApplied();
    const answers: Array<{ id: string; gate: ReturnType<typeof deferred<string>> }> = [];
    const getSchedule = (id: string) => {
      const gate = deferred<string>();
      answers.push({ id, gate });
      return gate.promise;
    };
    const screen = { sub: 'A', detail: '' };
    const flight = new SingleFlight<boolean>(async () => {
      const sub = screen.sub;
      const land = reads.begin();
      try {
        const fresh = await getSchedule(sub);
        if (screen.sub === sub && land()) screen.detail = fresh;
      } catch {
        /* the detail keeps its last copy */
      }
    });
    void flight.run(false);
    void flight.run(false);
    void flight.run(false);
    await flush();
    expect(answers.map((a) => a.id)).toEqual(['A']); // one read in flight, the two other pushes wait as one
    screen.sub = 'B'; // the person opens another schedule while A is being read
    answers[0].gate.resolve('A@1');
    await flush();
    expect(screen.detail).toBe(''); // A's answer is not shown as B
    expect(answers.map((a) => a.id)).toEqual(['A', 'B']); // the one extra round reads what is open now
    answers[1].gate.resolve('B@1');
    await flush();
    expect(screen.detail).toBe('B@1');
    expect(answers.length).toBe(2);
  });
});

test.describe('OneAtATime: a step that saves is not started twice (MAPA-1)', () => {
  test('double click -> one saveState; after it finished the next press saves again only when the state changed', async () => {
    // the assistant's go() + persist(), with a server that answers when told to
    const saves: Array<{ revision: number; gate: ReturnType<typeof deferred> }> = [];
    const stepping = new OneAtATime();
    const a = { st: { n: 1 } as object, savedSt: null as object | null, revision: 7, step: 'mark' };
    const persist = async () => {
      const st = a.st;
      if (st === a.savedSt) return;
      const gate = deferred();
      saves.push({ revision: a.revision, gate });
      await gate.promise;
      a.revision += 1;
      a.savedSt = st;
    };
    const go = (step: string) =>
      stepping.run(async () => {
        await persist();
        a.step = step;
      });
    const first = go('table');
    const second = go('table'); // the second click of a double click
    expect(await second).toBe(false);
    expect(saves.length).toBe(1);
    saves[0].gate.resolve();
    expect(await first).toBe(true);
    expect(a.step).toBe('table');
    expect(a.revision).toBe(8);
    // back and forth with nothing changed: no save at all
    expect(await go('mark')).toBe(true);
    expect(await go('table')).toBe(true);
    expect(saves.length).toBe(1);
    // an edit replaces the state: the next step saves it, with the revision the first save returned
    a.st = { n: 2 };
    const third = go('summary');
    await flush();
    expect(saves.length).toBe(2);
    expect(saves[1].revision).toBe(8);
    saves[1].gate.resolve();
    await third;
    expect(a.step).toBe('summary');
  });

  test('a run that throws frees the guard', async () => {
    const g = new OneAtATime();
    await expect(g.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(g.busy).toBe(false);
    expect(await g.run(async () => undefined)).toBe(true);
  });
});

test.describe('GATE-1: the save gate answers with a code', () => {
  const ok: SaveGateFacts = {
    loaded: true, hardReadOnly: false, roText: 'אין הרשאת עריכה', busy: false, blockerText: null, view: 'builder', codeMode: 'editable', codeOk: true,
    codeDirtyOrDraft: () => true, issueCount: () => 0, grantText: () => null, previewText: () => null, isNew: false, dirty: () => true, warnMode: 'save',
  };
  const rows: Array<[string, Partial<SaveGateFacts>, SaveGateCode | null, string]> = [
    ['nothing holds the save', {}, null, ''],
    ['not loaded', { loaded: false }, 'loading', GATE_TEXT.loading],
    ['view only', { hardReadOnly: true }, 'read_only', 'אין הרשאת עריכה'],
    ['a save in flight', { busy: true }, 'busy', ''],
    ['saves blocked by the installation', { blockerText: 'השמירה חסומה' }, 'blocked', 'השמירה חסומה'],
    ['code view, view only', { view: 'code', codeMode: 'readonly' }, 'code_read_only', GATE_TEXT.viewOnly],
    ['code view, broken code', { view: 'code', codeOk: false }, 'code_invalid', GATE_TEXT.fix],
    ['code view, nothing new', { view: 'code', codeDirtyOrDraft: () => false }, 'code_unchanged', ''],
    ['code view, changed', { view: 'code', issueCount: () => 3, warnMode: 'blocked' }, null, ''], // the builder's checks do not apply to the code view
    ['validation errors', { issueCount: () => 2 }, 'issues', GATE_TEXT.fix],
    ['a missing grant', { grantText: () => 'אין לך הרשאה' }, 'grant', 'אין לך הרשאה'],
    ['the preview refuses', { previewText: () => 'נדרש מנהל' }, 'preview', 'נדרש מנהל'],
    ['unchanged', { dirty: () => false }, 'unchanged', ''],
    ['a new item is never "unchanged"', { isNew: true, dirty: () => false }, null, ''],
    ['warnings, may be saved with them', { warnMode: 'with_warnings' }, 'warnings', GATE_TEXT.warnings],
    ['warnings that must be handled', { warnMode: 'blocked' }, 'warnings_blocked', GATE_TEXT.warningsBlocked],
  ];
  for (const [name, patch, want, text] of rows) {
    test(name, () => {
      const g = saveGateOf({ ...ok, ...patch });
      expect(g?.code ?? null).toBe(want);
      if (want) expect(g?.text).toBe(text);
    });
  }

  test('the order of the checks: read-only before busy before the blocker; errors before grants before the preview before "unchanged" before warnings', () => {
    const all: SaveGateFacts = { ...ok, hardReadOnly: true, busy: true, blockerText: 'x', issueCount: () => 1, grantText: () => 'g', previewText: () => 'p', dirty: () => false, warnMode: 'with_warnings' };
    const order: SaveGateCode[] = [];
    const steps: Array<Partial<SaveGateFacts>> = [{}, { hardReadOnly: false }, { busy: false }, { blockerText: null }, { issueCount: () => 0 }, { grantText: () => null }, { previewText: () => null }, { dirty: () => true }];
    let f = all;
    for (const s of steps) {
      f = { ...f, ...s };
      order.push(saveGateOf(f)!.code);
    }
    expect(order).toEqual(['read_only', 'busy', 'blocked', 'issues', 'grant', 'preview', 'unchanged', 'warnings']);
  });

  test('the costly facts are not asked once an earlier check answered', () => {
    let asked = 0;
    const count = () => (asked++, 0);
    saveGateOf({ ...ok, busy: true, issueCount: count, dirty: () => (asked++, true) });
    saveGateOf({ ...ok, view: 'code', issueCount: count, dirty: () => (asked++, true) });
    expect(asked).toBe(0);
  });

  test('"save with warnings" goes by the code: a reworded or translated text changes nothing', () => {
    const g = saveGateOf({ ...ok, warnMode: 'with_warnings' });
    expect(warningsOnly(g, 'with_warnings')).toBe(true);
    expect(warningsOnly({ code: 'warnings', text: 'Warnings' }, 'with_warnings')).toBe(true);
    expect(warningsOnly({ code: 'issues', text: GATE_TEXT.warnings }, 'with_warnings')).toBe(false); // the same words on another gate do not open it
    expect(warningsOnly(saveGateOf({ ...ok, warnMode: 'blocked' }), 'blocked')).toBe(false);
    expect(warningsOnly(g, 'save')).toBe(false);
    expect(warningsOnly(null, 'with_warnings')).toBe(false);
  });
});

test.describe('the five screens use the guards (source)', () => {
  test('automation editor: one validateDraft site inside the memo, the gate compared by code, the external-change read re-checks the item', () => {
    const s = code('screens/automation-editor-base.ts');
    expect(s.match(/validateDraft\(/g)?.length).toBe(1);
    expect(s).toMatch(/issuesMemo\.get\(\[kind, draft, this\.version, env, remote, serverIssues\]/);
    expect(s).toMatch(/dirtyMemo\.get\(\[kind, draft, this\.version, env, id, initial\]/);
    expect(s).toMatch(/willUpdate\(changed: PropertyValues<this>\) \{\s*this\.issuesMemo\.clear\(\); this\.issuesByMemo\.clear\(\); this\.dirtyMemo\.clear\(\); this\.pathsMemo\.clear\(\);/);
    expect(s).not.toMatch(/\.text === '/); // no logic keyed on a display text
    expect(s).not.toContain("=== 'יש אזהרות'");
    expect(s.match(/warningsOnly\(/g)?.length).toBe(2); // the button and the save
    expect(s).toMatch(/if \(token !== this\.loadToken \|\| this\.itemId !== id \|\| !this\.item\) return;/);
    // INFILE-1: one copy each
    expect(s.match(/automations\(\)\.dryRun\(/g)?.length).toBe(1);
    expect(s.match(/this\.computeDry\(this\.draft\)/g)?.length).toBe(2);
    expect(s.match(/this\.rebaseOn\(cur\)/g)?.length).toBe(2);
    expect(s.match(/slot="footer" style=/g)?.length).toBe(1);
    expect(s.match(/\$\{dlgFoot\(html`/g)?.length).toBe(8);
  });

  test('schedules screen: refresh goes through the single flight, the detail is for the captured schedule, the review is not read twice', () => {
    const s = code('screens/devices-schedules.ts');
    expect(s).toMatch(/private refresh\(recheck = false\): Promise<void> \{\s*return this\.rounds\.run\(recheck\);/);
    expect(s).toContain('new SingleFlight<boolean>((recheck) => this.refreshRound(recheck), (a, b) => a || b)');
    expect(s).not.toMatch(/this\.detail = await getSchedule\(/);
    expect(s.match(/if \(this\.sub === sub && land\(\)\) this\.detail = fresh;/g)?.length).toBe(2); // onSub and the round
    expect(s).toMatch(/if \(this\.sub !== 'review'\) await this\.loadReview\(\);\s*await this\.refresh\(\);/);
    expect(s).toContain('this.filteredMemo.get([all, filters], () => filterSchedules(all, filters))');
    expect(s).toContain('this.sortedMemo.get([rows, sort], () => sortSchedules(rows, sort))');
    expect(s.match(/filterSchedules\(/g)?.length).toBe(1);
    expect(s.match(/this\.measureFit\(\);/g)?.length).toBe(1);
  });

  test('schedule editor: dirty is memoised on the draft and the baseline, a push answer is for the schedule still open, slot views once per list', () => {
    const s = code('screens/schedule-editor.ts');
    expect(s).toContain('this.dirtyMemo.get([draft, baseline, creating], () => !sameDraft(this.currentDraft(), baseline))');
    expect(s).toMatch(/const fresh = await getSchedule\(id\);\s*if \(!stillOpen\(\)\) return;/);
    expect(s).toMatch(/if \(stillOpen\(\) && e instanceof ApiError && e\.status === 404\) this\.gone = true;/);
    expect(s.match(/this\.viewCache = null;/g)?.length).toBe(2); // willUpdate and mark()
    expect(s.match(/this\.kavConflictUids\(\)/g)?.length).toBe(1);
  });

  test('privacy masks: no measurement while dragging or for a region-only update; the history belongs to the selected camera', () => {
    const s = code('screens/system-security-privacy-masks.ts');
    expect(s).toMatch(/protected updated\(changed: PropertyValues\) \{\s*if \(this\.drag\) return;\s*if \(changed\.size && \[\.\.\.changed\.keys\(\)\]\.every\(\(k\) => REGION_ONLY_STATE\.has\(k as string\)\)\) return;\s*this\.measure\(\);/);
    expect(s).toContain("new Set(['drafts', 'ghost', 'regionKey'])");
    expect(s).toMatch(/await this\.loadMask\(id\);\s*if \(this\.selected !== id\) return;\s*void this\.loadHistory\(id\);/);
    expect(s).toMatch(/private async loadHistory\(id: string\) \{\s*if \(this\.selected !== id\) return;\s*const current = this\.historyReads\.begin\(\);\s*this\.history = null;/);
  });

  test('mapping assistant: steps are one at a time, an unchanged state is not saved again, the model is keyed on the data too', () => {
    const s = code('screens/mapping-assistant.ts');
    expect(s).toMatch(/private go\(step: Step\): Promise<boolean> \{\s*return this\.stepping\.run\(async \(\) => \{/);
    expect(s).toMatch(/const st = this\.st;\s*if \(st === this\.savedSt\) return;/);
    expect(s).toContain('this.memo.st === this.st && this.memo.data === this.data');
    expect(s).not.toContain('? this.st.spec.seps : this.st.spec.seps');
    expect(s.match(/saveState\(/g)?.length).toBe(2); // the step save and the one after an apply that created buildings
  });
});

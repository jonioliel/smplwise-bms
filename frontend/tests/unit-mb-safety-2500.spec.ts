import { test, expect } from '@playwright/test';
import { checkGate, moveGate, moveTargets, needsCheck, orderedFindings, peopleOf, recordsMoving, REVIEW_MODES, type MovePreview, type MultiCheck } from '../src/api/mb-safety';
import { demoCheck, demoPreview } from '../src/api/mb-safety-demo';

// MULTI-BUILDING-SAFETY-2500 (owner decisions 22.11, Q62 / Q63): the pure rules behind the two safety dialogs - the floor move's confirm
// button (no blocker; "אני מבין" when anybody loses access), the people lists that never scroll, and the check before turning
// multi-building on (no blocking finding + "עברתי על הממצאים"; the setting `skip` goes straight on).
//   npx playwright test -c playwright.unit.config.ts tests/unit-mb-safety-2500.spec.ts

const ctx = { floorName: 'קומה 3', floorLevel: 3, fromId: 'bA', fromName: 'בניין א', toName: 'בניין ב' };

function preview(over: Partial<MovePreview> = {}): MovePreview {
  return { ...demoPreview('f3', 'bB', ctx), ...over };
}

test('the move button: disabled with no preview, a blocker, or people losing access until "אני מבין" is checked', () => {
  expect(moveGate(null, true)).toEqual({ canMove: false, needsAck: false });
  const p = preview();
  expect(p.people.loses).toBe(3);
  expect(moveGate(p, false)).toEqual({ canMove: false, needsAck: true });
  expect(moveGate(p, true)).toEqual({ canMove: true, needsAck: true });
  // nobody loses access: no acknowledgement asked
  const clean = preview({ people: { loses: 0, gains: 1, changes: 0, total: 1, items: [p.people.items[3]] } });
  expect(moveGate(clean, false)).toEqual({ canMove: true, needsAck: false });
  // a shared room across the new boundary blocks the move whatever is checked (the server refuses it too)
  const blocked = preview({ can_move: false, blockers: [{ code: 'shared_room', items: [{ id: 'z', name: 'לובי' }] }] });
  expect(moveGate(blocked, true).canMove).toBe(false);
  expect(moveGate({ ...blocked, can_move: true }, true).canMove).toBe(false);
});

test('the people lists show a few names and "ועוד N" from the complete counts (the list never scrolls)', () => {
  const p = preview();
  expect(peopleOf(p, 'loses', 2)).toEqual({ shown: p.people.items.slice(0, 2), more: 1 });
  expect(peopleOf(p, 'gains').shown.map((x) => x.name)).toEqual(['מירב אברהם', 'אבי מזרחי']);
  expect(peopleOf(p, 'changes')).toEqual({ shown: [], more: 0 });
  // the server lists at most 200 people; the counts stay complete
  const many = preview({ people: { ...p.people, loses: 250 } });
  expect(peopleOf(many, 'loses', 6).more).toBe(247);
});

test('records that follow the floor are summed; the demo preview is shaped like the server answer', () => {
  const p = preview();
  expect(recordsMoving(p)).toBe(4);
  expect(p.from_building).toEqual({ id: 'bA', name: 'בניין א' });
  expect(p.to_building).toEqual({ id: 'bB', name: 'בניין ב' });
  expect(p.floor).toEqual({ id: 'f3', name: 'קומה 3', level: 3 });
  expect(Object.keys(p)).toEqual(['floor', 'from_building', 'to_building', 'people', 'moves_with', 'blockers', 'warnings', 'can_move', 'digest']);
});

test('turning multi-building on: the check is required unless the setting says skip (an older server: required)', () => {
  expect(REVIEW_MODES).toEqual(['required', 'skip']);
  expect(needsCheck('required')).toBe(true);
  expect(needsCheck(undefined)).toBe(true);
  expect(needsCheck(null)).toBe(true);
  expect(needsCheck('skip')).toBe(false);
});

test('the check dialog: "הפעל" only with no blocking finding and "עברתי על הממצאים" checked', () => {
  const c = demoCheck();
  expect(checkGate(null, true)).toEqual({ canEnable: false, blocked: false });
  expect(checkGate(c, false)).toEqual({ canEnable: false, blocked: false });
  expect(checkGate(c, true)).toEqual({ canEnable: true, blocked: false });
  const blocked: MultiCheck = { ...c, blocking: 1, findings: [{ code: 'entity_cross_building', severity: 'blocking', count: 1, items: [] }, ...c.findings] };
  expect(checkGate(blocked, true)).toEqual({ canEnable: false, blocked: true });
});

test('findings are listed blocking first, then to review, then for information (the server order inside each)', () => {
  const c: MultiCheck = {
    ...demoCheck(),
    findings: [
      { code: 'versions_since', severity: 'info', count: 1, items: [] },
      { code: 'reach_gain', severity: 'warning', count: 3, items: [] },
      { code: 'entity_cross_building', severity: 'blocking', count: 1, items: [] },
      { code: 'unmapped_areas', severity: 'warning', count: 2, items: [] },
    ],
  };
  expect(orderedFindings(c).map((f) => f.code)).toEqual(['entity_cross_building', 'reach_gain', 'unmapped_areas', 'versions_since']);
  expect(c.findings[0].code).toBe('versions_since'); // not sorted in place
});

test('the floor edit dialog offers a move only on a site with another building (one building: exactly as before)', () => {
  expect(moveTargets([{ id: 'a' }], 'a')).toEqual([]);
  expect(moveTargets(undefined, 'a')).toEqual([]);
  expect(moveTargets([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'b')).toEqual([{ id: 'a' }, { id: 'c' }]);
});

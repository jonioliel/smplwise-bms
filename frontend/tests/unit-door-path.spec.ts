import { test, expect } from '@playwright/test';
import {
  EDITOR_BLOCK_REFUSAL, LOCK_ALL_SKIPPED_WORD, NEVER_WORKS, editorBlockHint, editorBlockLabel, editorBlockQuestion, lockAllQuestion, lockJobLine, skippedText, splitLockAll,
} from '../src/screens/door-path-logic';

// CR-033 D6 + D8: the pure helpers behind "lock all" (WisKey doors are skipped and said so) and the door Settings card's
// editor-block row. Node only; synthetic names (no lab data).

const rows = [
  { entity_id: 'lock.office', locked: false },
  { entity_id: 'lock.side', locked: true },
  { entity_id: 'lock.entrance', locked: false, wiskey_door: true },
  { entity_id: 'lock.dock', locked: true, wiskey_door: true },
];

test('lock all sends only to unlocked non-WisKey locks and lists every WisKey door as skipped', () => {
  const { sendable, skipped } = splitLockAll(rows);
  expect(sendable.map((r) => r.entity_id)).toEqual(['lock.office']);
  expect(skipped.map((r) => r.entity_id)).toEqual(['lock.entrance', 'lock.dock']);
  expect(splitLockAll([]).sendable).toHaveLength(0);
});

test('a WisKey door is never counted as lockable, whatever its reported state', () => {
  const { sendable } = splitLockAll([{ entity_id: 'lock.x', locked: false, wiskey_door: true }, { entity_id: 'lock.y', wiskey_door: true }]);
  expect(sendable).toHaveLength(0);
});

test('the dialog says explicitly what was skipped and never claims success for it', () => {
  expect(skippedText(0)).toBe('');
  expect(skippedText(1)).toContain(LOCK_ALL_SKIPPED_WORD);
  expect(skippedText(2)).toContain('2 דלתות אינטרקום');
  expect(skippedText(2)).toContain('לא נשלחה אליהן פקודה');
  expect(skippedText(2)).not.toContain('ננעל');
  expect(lockAllQuestion(1, 0)).toBe('לנעול מנעול אחד?');
  expect(lockAllQuestion(3, 2)).toBe('לנעול 3 מנעולים?');
  expect(lockAllQuestion(0, 2)).toBe('אין מנעולים לנעילה');
  expect(lockAllQuestion(0, 0)).toBe('כל המנעולים נעולים');
});

test('editor block copy: refusal text, labels, hint and the disabled "allowed" promise', () => {
  expect(EDITOR_BLOCK_REFUSAL).toBe('לא ניתן להוסיף כאן פתיחת דלת אינטרקום. פתיחה נעשית מכפתור הדלת או מתוכנית החזקה פתוחה.');
  expect(editorBlockLabel('blocked')).toContain('חסום');
  expect(editorBlockLabel('allowed')).toContain('מותר');
  expect(editorBlockHint({ editor_block: 'blocked', editor_allowed_available: false })).toContain('לאחר השלמת הסבת הפריטים');
  expect(editorBlockHint({ editor_block: 'blocked', editor_allowed_available: true })).not.toContain('לאחר השלמת הסבת הפריטים');
  expect(editorBlockQuestion('blocked')).toContain('לחסום');
  expect(editorBlockQuestion('allowed')).toContain('להתיר');
});

test('scheduled lock jobs are listed by alias and lock name as never working', () => {
  const line = lockJobLine({ name: 'נעילת לילה', locks: ['כניסה', 'צד'] });
  expect(line).toBe(`נעילת לילה · כניסה, צד · ${NEVER_WORKS}`);
  expect(lockJobLine({ name: '', locks: ['כניסה'] })).toContain('תזמון ללא שם');
});

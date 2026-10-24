import { test, expect } from '@playwright/test';
import { draftOf, newDraft, pushState, suggestedPush, type Draft } from '../src/notices/model';
import type { Notice } from '../src/api/notices';

// NOTICEPUSH-295: the compose dialog's push checkbox - the value it shows before the author touches it, and when it cannot be changed.
test('suggested value: never for an ordinary notice, suggested for an important one, on for an urgent one; always / never override', () => {
  expect(['info', 'alert', 'critical'].map((s) => suggestedPush('by_severity', s as 'info'))).toEqual([false, true, true]);
  expect(['info', 'alert', 'critical'].map((s) => suggestedPush('always', s as 'info'))).toEqual([true, true, true]);
  expect(['info', 'alert', 'critical'].map((s) => suggestedPush('never', s as 'info'))).toEqual([false, false, false]);
});

test('the author\'s tick wins; TV-only and no-permission disable the box; a TV-only notice never shows it ticked', () => {
  const d: Draft = { ...newDraft(new Date(), 7, 'info'), severity: 'critical' };
  expect(pushState(d, 'by_severity', true)).toEqual({ checked: true, disabled: false });
  expect(pushState({ ...d, push: false }, 'by_severity', true)).toEqual({ checked: false, disabled: false });
  expect(pushState({ ...d, push: true, severity: 'info' }, 'never', true)).toEqual({ checked: true, disabled: false });
  expect(pushState(d, 'by_severity', false)).toEqual({ checked: true, disabled: true });
  expect(pushState({ ...d, aud: 'tv', push: true }, 'always', true)).toEqual({ checked: false, disabled: true });
});

test('a new draft is untouched; a stored draft remembers a tick', () => {
  expect(newDraft(new Date(), 7, 'info').push).toBeNull();
  const n = { id: 'n', title: 't', body: '', severity: 'info', pinned: false, starts_at: '2026-10-24T08:00:00Z', ends_at: '2026-10-25T08:00:00Z', boards: [], status: 'draft', push_requested: true } as unknown as Notice;
  expect(draftOf(n).push).toBe(true);
  expect(draftOf({ ...n, push_requested: false }).push).toBeNull();
});

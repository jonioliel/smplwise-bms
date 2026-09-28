import { test, expect } from '@playwright/test';
import { commandId } from '../src/api/request-id';

// Owner report 2026-09-28: turning a light on from the map over plain http on the LAN failed with "no connection to
// the server" - crypto.randomUUID is undefined outside secure contexts and the call threw a TypeError. Node only.

test('commandId works without crypto.randomUUID (plain-http origin)', () => {
  const c = globalThis.crypto as { randomUUID?: unknown };
  const original = c.randomUUID;
  try {
    Object.defineProperty(c, 'randomUUID', { value: undefined, configurable: true, writable: true });
    const a = commandId();
    const b = commandId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  } finally {
    Object.defineProperty(c, 'randomUUID', { value: original, configurable: true, writable: true });
  }
});

test('commandId prefers crypto.randomUUID when it exists', () => {
  const id = commandId();
  expect(id.length).toBeGreaterThanOrEqual(32);
  expect(id).toMatch(/^[0-9a-f-]+$/);
});

import { test, expect } from '@playwright/test';
import { groupByVendor } from '../src/tickets/portal-requests-model';
import type { PortalTechRequest } from '../src/api/tickets-portal-requests';

const req = (id: string, vid: string, vname: string): PortalTechRequest => ({
  id, vendor: { id: vid, name: vname }, action: 'add', display_name: id, phone: null, replaces: null, phone_known: false,
  state: 'pending', created_at: '2026-10-20T00:00:00Z', decided_at: null, result_contact_id: null, revision: 1,
});

test('requests are grouped per vendor company, groups by name, order kept inside', () => {
  const g = groupByVendor([req('r1', 'v2', 'Zed'), req('r2', 'v1', 'Alpha'), req('r3', 'v2', 'Zed')]);
  expect(g.map((x) => x.vendor.id)).toEqual(['v1', 'v2']);
  expect(g[1].requests.map((r) => r.id)).toEqual(['r1', 'r3']);
});

test('no requests, no groups', () => {
  expect(groupByVendor([])).toEqual([]);
});

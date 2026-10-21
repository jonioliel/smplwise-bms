import type { Page, Route } from '@playwright/test';
import { ADMIN, install, newMock, type Mock } from './nvr-cameras-write-mock';

// MASKUI-295: a STATEFUL mocked backend (page.route on api/v1) for the privacy-mask editor, layered over the cameras mock (it supplies the session,
// the settings and the camera list). It answers like routers/nvr_privacy.py: the mask read with etag + limits + can_write + write_enabled, the
// preview (before -> after, nothing written), the apply (confirm:true + the preview etag per camera, partial apply, first failed write stops the
// rest), the change log and the generic rollback. NOTHING here reaches a device: every "NVR" is this object. Fake scene pictures only (no real frames).

export const PRIVACY_WRITER = [...ADMIN, 'nvr.config.privacy'];

export interface Region {
  id: string;
  points: number[][];
}

export interface CamMask {
  enabled: boolean;
  regions: Region[];
  etag: string;
}

export type ApplyMode = 'ok' | 'stale' | 'fail' | 'abort';

export interface MaskMock {
  base: Mock;
  /** nvr.privacy_mask_write */
  switchOn: boolean;
  /** nvr.config.privacy at installation scope */
  canWrite: boolean;
  masks: Record<string, CamMask>;
  /** what the next apply does to the camera named (default ok) */
  mode: Record<string, ApplyMode>;
  /** the mask read of this camera answers 503 */
  readDown: string[];
  /** every request, "METHOD path" */
  hits: string[];
  /** POST bodies of the preview / apply / rollback routes */
  previews: unknown[];
  applies: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  rollbacks: string[];
  changes: { id: string; kind: string; status: string; camera_id: string; created_at: string; rollback_of: string | null; before: CamMask; after: CamMask }[];
  seq: number;
  /** a snapshot request answers 404 for this camera */
  noPicture: string[];
}

const FRAME = { width: 704, height: 576 };
const rect = (x: number, y: number, w: number, h: number): number[][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const canon = (points: number[][]) => JSON.stringify(points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
const etagOf = (m: { enabled: boolean; regions: { points: number[][] }[] }) => `e-${m.enabled ? 1 : 0}-${m.regions.map((r) => canon(r.points)).sort().join('|').length}-${m.regions.map((r) => canon(r.points)).sort().join('|').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000003, 7)}`;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function newMaskMock(over: Partial<Pick<MaskMock, 'switchOn' | 'canWrite'>> = {}): MaskMock {
  const mk = (enabled: boolean, regions: Region[]): CamMask => ({ enabled, regions, etag: etagOf({ enabled, regions }) });
  const base = newMock(over.canWrite === false ? ADMIN : PRIVACY_WRITER);
  return {
    base,
    switchOn: over.switchOn ?? true,
    canWrite: over.canWrite ?? true,
    masks: {
      'cam-1': mk(true, [{ id: '1', points: rect(36, 30, 150, 110) }]),
      'cam-2': mk(false, []),
      'cam-3': mk(true, [{ id: '1', points: rect(420, 300, 200, 150) }, { id: '2', points: [[60, 400], [200, 380], [230, 520], [40, 540]] }]),
    },
    mode: {}, readDown: [], hits: [], previews: [], applies: [], rollbacks: [], changes: [], seq: 0, noPicture: [],
  };
}

const err = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

/** A fake scene, never a real frame: a room with a window, a door and a desk, drawn per camera so the three pictures differ. */
export function scene(id: string): string {
  const hue = id === 'cam-1' ? 205 : id === 'cam-2' ? 140 : 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 704 576" preserveAspectRatio="none"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,62%)"/><stop offset="1" stop-color="hsl(${hue},30%,40%)"/></linearGradient></defs>
<rect width="704" height="576" fill="url(#w)"/><rect y="400" width="704" height="176" fill="hsl(${hue},12%,28%)"/><rect x="40" y="60" width="190" height="170" fill="hsl(${hue},60%,82%)" stroke="#fff" stroke-width="6"/><line x1="135" y1="60" x2="135" y2="230" stroke="#fff" stroke-width="4"/><rect x="470" y="120" width="130" height="280" fill="hsl(${hue},25%,30%)"/><rect x="250" y="330" width="200" height="90" fill="hsl(${hue},20%,22%)"/><circle cx="360" cy="290" r="34" fill="hsl(${hue},20%,70%)"/><text x="16" y="560" font-size="22" fill="#fff" font-family="sans-serif">${id}</text></svg>`;
}

export async function installMask(page: Page, st: MaskMock) {
  await install(page, st.base);
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const camName = (id: string) => st.base.cameras.find((c) => c.camera_id === id)?.name ?? id;
    st.hits.push(`${method} ${p}`);

    let m = /^cameras\/([^/]+)\/snapshot\.jpg$/.exec(p);
    if (m) return st.noPicture.includes(m[1]) ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ status: 200, contentType: 'image/svg+xml', body: scene(m[1]) });

    m = /^cameras\/([^/]+)\/privacy-mask$/.exec(p);
    if (m && method === 'GET') {
      const cm = st.masks[m[1]];
      if (!cm) return json(err('not_found', 'x'), 404);
      if (st.readDown.includes(m[1])) return json(err('source_unavailable', 'x'), 503);
      return json({
        camera_id: m[1], channel: Number(m[1].split('-')[1]), name: camName(m[1]), enabled: cm.enabled, normalized: FRAME, active_regions: cm.enabled ? cm.regions.length : 0,
        regions: cm.regions.map((r) => ({ id: r.id, active: cm.enabled, points: r.points })), etag: cm.etag, max_regions: 4, points_per_region: 4, can_write: st.canWrite, write_enabled: st.switchOn,
      });
    }

    if (p === 'nvr/privacy-masks/preview' && method === 'POST') {
      const body = req.postDataJSON();
      st.previews.push(body);
      if (!st.canWrite) return json(err('forbidden', 'x'), 403);
      if (!st.switchOn) return json(err('feature_disabled', 'x', { setting: 'nvr.privacy_mask_write' }), 409);
      const items = (body.items as any[]).map((it) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const cm = st.masks[it.camera_id];
        const row: Record<string, unknown> = { camera_id: it.camera_id, channel: Number(String(it.camera_id).split('-')[1]), name: camName(it.camera_id) };
        const regions = (it.regions as { points: number[][] }[]).map((r, i) => ({ id: String(i + 1), points: r.points }));
        const same = cm.enabled === it.enabled && JSON.stringify(cm.regions.map((r) => canon(r.points)).sort()) === JSON.stringify(regions.map((r) => canon(r.points)).sort());
        return { ...row, status: same ? 'unchanged' : 'ready', etag: cm.etag, max_regions: 4, before: { enabled: cm.enabled, normalized: FRAME, regions: clone(cm.regions) }, after: { enabled: it.enabled, regions } };
      });
      const n = (s: string) => items.filter((i) => i.status === s).length;
      return json({ items, ready: n('ready'), unchanged: n('unchanged'), invalid: 0, skipped: 0 });
    }

    if (p === 'nvr/privacy-masks/apply' && method === 'POST') {
      const body = req.postDataJSON();
      st.applies.push(body);
      if (!st.canWrite) return json(err('forbidden', 'x'), 403);
      if (!st.switchOn) return json(err('feature_disabled', 'x'), 409);
      if (body.confirm !== true) return json(err('confirm_required', 'x'), 422);
      if ((body.items as any[]).some((i) => !i.etag)) return json(err('preview_required', 'x'), 422); // eslint-disable-line @typescript-eslint/no-explicit-any
      let stopped = false;
      const results: Record<string, unknown>[] = [];
      for (const it of body.items as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
        const base = { camera_id: it.camera_id, channel: Number(String(it.camera_id).split('-')[1]) };
        if (stopped) { results.push({ ...base, status: 'not_attempted' }); continue; }
        const cm = st.masks[it.camera_id];
        const mode = st.mode[it.camera_id] ?? 'ok';
        if (mode === 'abort') return route.abort('failed');
        if (mode === 'stale' || it.etag !== cm.etag) { results.push({ ...base, status: 'skipped', reason: 'stale', message: 'x' }); continue; }
        if (mode === 'fail') { results.push({ ...base, status: 'failed', reason: 'nvr_verify_mismatch', message: 'x', change_id: `c-${++st.seq}`, restored: true }); stopped = true; continue; }
        const before = clone(cm);
        const regions = (it.regions as { points: number[][] }[]).map((r, i) => ({ id: String(i + 1), points: r.points }));
        cm.enabled = it.enabled;
        cm.regions = regions;
        cm.etag = etagOf(cm);
        const id = `c-${++st.seq}`;
        st.changes.push({ id, kind: 'privacy_mask', status: 'applied', camera_id: it.camera_id, created_at: new Date(Date.UTC(2026, 9, 21, 9, st.seq)).toISOString(), rollback_of: null, before, after: clone(cm) });
        results.push({ ...base, status: 'applied', change_id: id });
      }
      const n = (s: string) => results.filter((r) => r.status === s).length;
      return json({ results, applied: n('applied'), unchanged: n('unchanged'), skipped: n('skipped'), failed: n('failed'), not_attempted: n('not_attempted') });
    }

    if (p === 'nvr/changes' && method === 'GET') {
      const cam = url.searchParams.get('camera_id');
      const rows = st.changes.filter((c) => !cam || c.camera_id === cam).slice().reverse().map(({ before: _b, after: _a, ...row }) => row);
      return json({ changes: rows });
    }

    m = /^nvr\/changes\/([^/]+)\/rollback$/.exec(p);
    if (m && method === 'POST') {
      st.rollbacks.push(m[1]);
      const ch = st.changes.find((c) => c.id === m![1]);
      if (!ch) return json(err('not_found', 'x'), 404);
      const cm = st.masks[ch.camera_id];
      if (cm.etag !== ch.after.etag) return json(err('changed_since', 'x'), 409);
      cm.enabled = ch.before.enabled;
      cm.regions = clone(ch.before.regions);
      cm.etag = etagOf(cm);
      ch.status = 'rolled_back';
      const id = `c-${++st.seq}`;
      st.changes.push({ id, kind: 'privacy_mask', status: 'applied', camera_id: ch.camera_id, created_at: new Date(Date.UTC(2026, 9, 21, 9, st.seq)).toISOString(), rollback_of: ch.id, before: clone(ch.after), after: clone(cm) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id, kind: 'privacy_mask', status: 'applied', camera_id: ch.camera_id, created_at: '', rollback_of: ch.id }) });
    }
    return route.fallback();
  });
}

export const writes = (st: MaskMock) => st.hits.filter((h) => h.startsWith('POST nvr/privacy-masks/apply') || h.startsWith('POST nvr/changes/'));

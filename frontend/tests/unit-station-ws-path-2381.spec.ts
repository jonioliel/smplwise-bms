import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// STATION-WS-PATH-2381: the station live / listen / talk sockets are named by the server from the page dir
// (`api/v1/access-control/...`) while the camera card names its live path under the API base (`media/live-ha/<id>/ws`).
// `relayWsUrl` sent both through `apiUrl`, so every station socket went to `api/v1/api/v1/...` (403 in the add-on) and the
// drawer never showed live video. The module needs a DOM (document.baseURI), so the rule is checked on its source and the
// resolution is replayed here with the add-on's Ingress base.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const media = readFileSync(path.join(ROOT, 'frontend/src/api/media.ts'), 'utf8');
const BACKEND = path.join(ROOT, 'smplwise_vms/backend/smplwise');
const read = (p: string) => readFileSync(path.join(BACKEND, p), 'utf8');

const BASE = 'https://ha.example/api/hassio_ingress/TOKEN/';
const apiUrl = (p: string) => new URL(p.replace(/^\/+/, ''), new URL('api/v1/', BASE)).toString();
const resourceUrl = (p: string) => new URL(p.replace(/^\/+/, ''), BASE).toString();
function relay(p: string): string {
  const rel = p.replace(/^\/+/, '');
  const u = new URL(rel.startsWith('api/v1/') ? resourceUrl(rel) : apiUrl(rel));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

test.describe('relayWsUrl: one api/v1 prefix for every server-named socket', () => {
  test('the source resolves page-dir paths with resourceUrl and the rest with apiUrl', () => {
    expect(media).toMatch(/import \{[^}]*\bresourceUrl\b[^}]*\} from '\.\/client'/);
    expect(media).toMatch(/rel\.startsWith\('api\/v1\/'\) \? resourceUrl\(rel\) : apiUrl\(rel\)/);
  });

  test('the station routes name their sockets from the page dir', () => {
    expect(read('routers/intercom_media.py')).toMatch(/return f"api\/v1\/access-control\/stations\/\{quote\(station_id, safe=''\)\}\/live\/ws\?profile=\{profile\}"/);
    expect(read('routers/intercom_media.py')).toMatch(/"ws_path": f"api\/v1\/access-control\/talk\/\{t\.id\}\/ws"/);
    expect(read('routers/intercom_listen.py')).toMatch(/"ws_path": f"api\/v1\/access-control\/listen\/\{s\.id\}\/ws"/);
    expect(read('services/ha_camera_streams.py')).toMatch(/return f"media\/live-ha\/\{entity_id\}\/ws"/);
  });

  test('live, listen and talk get a single prefix; the camera card path is unchanged', () => {
    for (const p of ['api/v1/access-control/stations/S1/live/ws?profile=main', 'api/v1/access-control/listen/L1/ws', 'api/v1/access-control/talk/T1/ws']) {
      const u = relay(p);
      expect(u.startsWith('wss://ha.example/api/hassio_ingress/TOKEN/api/v1/access-control/')).toBe(true);
      expect(u).not.toContain('api/v1/api/v1');
    }
    expect(relay('media/live-ha/camera.door/ws')).toBe('wss://ha.example/api/hassio_ingress/TOKEN/api/v1/media/live-ha/camera.door/ws');
  });
});

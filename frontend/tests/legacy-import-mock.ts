import type { Page, Route } from '@playwright/test';

// LEGACY-IMPORT-UI-2550: a MOCKED wire contract of routers/legacy_migration.py (GET /migration/legacy, POST .../dry-run, POST .../apply) and
// routers/backup.py's list, for the import card on Settings › גיבוי ושחזור. Invented camera names and digests only - no host, serial or
// secret. The items follow services/legacy_import.py (ids `<area>.<ident>`, the actions, the note codes); the notes are the server's own
// texts in Hebrew or English (the server picks the reader's language - the mock picks by `lang`).

export const ADMIN_PERMS = ['video.live', 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'backup.manage'];
export const DIGEST = 'd'.repeat(64);
export const SHA = '5f3a9c1d7b6e5a40' + '0'.repeat(48);
export const NOW_ISO = '2026-11-25T10:00:00Z';
export const PRE_IMPORT = { name: 'auto-pre-legacy-import-20261125-100000.zip', bytes: 1_572_864, created_at: NOW_ISO };

type Note = [string, string];
type Row = { id: string; area: string; action: string; code: string; note: Note; target?: Record<string, unknown>; value?: string };

const ITEMS: Row[] = [
  { id: 'cameras.ch1', area: 'cameras', action: 'update', code: 'alias_set', target: { camera_id: 'cam-01', channel: 1 }, value: 'כניסה ראשית',
    note: ['הכינוי מהמערכת הישנה יועתק למצלמה (היום אין לה כינוי ב־Arx).', 'The legacy name will be copied to this camera (it has no alias in Arx today).'] },
  { id: 'cameras.ch2', area: 'cameras', action: 'update', code: 'alias_set', target: { camera_id: 'cam-02', channel: 2 }, value: 'חניון',
    note: ['הכינוי מהמערכת הישנה יועתק למצלמה (היום אין לה כינוי ב־Arx).', 'The legacy name will be copied to this camera (it has no alias in Arx today).'] },
  { id: 'cameras.ch3', area: 'cameras', action: 'same', code: 'alias_same', target: { camera_id: 'cam-03', channel: 3 }, value: 'לובי',
    note: ['הכינוי כבר זהה ב־Arx.', 'The alias is already the same in Arx.'] },
  { id: 'cameras.ch4', area: 'cameras', action: 'keep', code: 'alias_keep', target: { camera_id: 'cam-04', channel: 4, arx_alias: 'מעלית צפון' }, value: 'מעלית',
    note: ['ל־Arx כבר יש כינוי אחר למצלמה הזו; הוא נשמר. אפשר לשנות ידנית במסך המצלמות.', 'Arx already has another alias for this camera; it is kept. Change it by hand on the cameras screen if needed.'] },
  { id: 'cameras.ch7', area: 'cameras', action: 'skip', code: 'no_arx_camera', target: { channel: 7 }, value: 'מחסן',
    note: ["אין ב־Arx מצלמה בערוץ 7. להריץ קודם 'סנכרון מה־NVR' ואז לחזור על הבדיקה.", "Arx has no camera on channel 7. Run 'Sync from the NVR' first, then run this check again."] },
  { id: 'cameras.ch5', area: 'cameras', action: 'info', code: 'arx_only_camera', target: { camera_id: 'cam-05', channel: 5 },
    note: ['מצלמה ש־Arx מכיר ואין לה שם במערכת הישנה.', 'A camera Arx knows that has no legacy name.'] },
  { id: 'connection.host', area: 'connection', action: 'same', code: 'conn_host_same', note: ['Arx מחובר לאותו NVR כמו המערכת הישנה.', 'Arx uses the same NVR as the legacy add-on.'] },
  { id: 'connection.user', area: 'connection', action: 'manual', code: 'conn_user_other',
    note: ['משתמש NVR אחר. מומלץ משתמש ייעודי לקריאה בלבד; לבדוק בהגדרות › חיבורים › NVR.', 'Another NVR user. A dedicated read-only user is recommended; check Settings > Connections > NVR.'] },
  { id: 'connection.password', area: 'connection', action: 'skip', code: 'conn_password',
    note: ['הסיסמה אף פעם לא מיובאת. אם ל־Arx אין סיסמה - להזין בהגדרות › חיבורים › NVR (נשמרת מוצפנת).', 'The password is never imported. If Arx has none, enter it in Settings > Connections > NVR (stored encrypted).'] },
  { id: 'options.go2rtc_url', area: 'options', action: 'same', code: 'go2rtc_same', note: ['אותו go2rtc. Arx משתמש רק בזרמים בשם smplwise_.', 'The same go2rtc. Arx uses only streams named smplwise_.'] },
  { id: 'options.log_level', area: 'options', action: 'skip', code: 'log_level', note: ['ל־Arx אפשרות log_level משלו; לא מועתק.', 'Arx has its own log_level option; not copied.'] },
  { id: 'people.app_pin', area: 'people', action: 'manual', code: 'people_pin',
    note: ['אין PIN משותף ב־Arx. לכל אדם משתמש בית משלו ותפקיד ב־Arx (הגדרות › משתמשים והרשאות): צופה למי שרק צפה.',
      'Arx has no shared PIN. Every person gets an own home-system user and an Arx role (Settings > Users and permissions): viewer for those who only watched.'] },
  { id: 'time.display_offset', area: 'time', action: 'skip', code: 'offset_zero',
    note: ['הסטת התצוגה בישן היא 0 דקות; Arx מציג את שעון ה־NVR.', 'The legacy display offset is 0 minutes; Arx shows the NVR clock.'] },
  { id: 'events.store', area: 'events', action: 'skip', code: 'events_archive', target: { rows: 1240 },
    note: ['יומן האירועים של הישן הוא ארכיון; לא מועבר.', 'The legacy event store is an archive; not carried over.'] },
  { id: 'layouts.live_grid', area: 'layouts', action: 'info', code: 'layouts', note: ['לישן לא היו פריסות שמורות.', 'The legacy kept no saved layouts.'] },
  { id: 'schedules.recording', area: 'schedules', action: 'info', code: 'schedules', note: ['לוחות ההקלטה נשארים ב־NVR.', 'Recording schedules stay on the NVR.'] },
  { id: 'notifications.all', area: 'notifications', action: 'info', code: 'notifications', note: ['לישן לא היו התראות משלו.', 'The legacy had no notifications of its own.'] },
];

export const ITEM_COUNT = ITEMS.length;

export interface LegacyMock {
  calls: { method: string; path: string; search: string; contentType: string | null; bytes: number }[];
  backupGets: number;
  /** what the next apply answers */
  apply: 'ok' | 'changed' | 'backup_failed' | 'already';
  /** what GET /migration/legacy answers */
  status: 'ok' | 'forbidden' | 'missing';
  /** a report with nothing to write (every alias already there) */
  nothingToWrite: boolean;
  applied: boolean;
}

export function report(lang: 'he' | 'en', nothingToWrite = false) {
  const items = ITEMS.map((r) => {
    const action = nothingToWrite && r.action === 'update' ? 'same' : r.action;
    const out: Record<string, unknown> = { id: r.id, area: r.area, action, code: r.code, note: r.note[lang === 'en' ? 1 : 0] };
    if (r.target) out.target = r.target;
    if (r.value) out.value = r.value;
    return out;
  });
  const summary = Object.fromEntries(['create', 'update', 'same', 'keep', 'skip', 'manual', 'info'].map((a) => [a, items.filter((i) => i.action === a).length]));
  return {
    schema: 'smplwise-legacy-import/1',
    source: { container: 'ha_backup', sha256: SHA, bytes: 3_145_728, legacy_version: '1.5.27', found: ['options', 'override', 'events', 'addon_meta'], ignored_members: 2, read_at: NOW_ISO },
    summary,
    items,
    warnings: [{ code: 'several_recorders', note: lang === 'en' ? 'Arx has more than one recorder; the names go to the first one only.' : 'ב־Arx יותר ממקליט אחד; השמות מועתקים רק למקליט הראשון.' }],
    time: { mode: 'auto_plus_manual', direction: 'add', minutes: 0, auto_minutes: 0, manual_minutes: 0, effective_minutes: 0, zone: 'Asia/Jerusalem' },
    writes: { arx: 'camera aliases that are empty today, after a backup', nvr: 'none', home_system: 'none', go2rtc: 'none' },
    plan_digest: DIGEST,
    applied_before: [],
  };
}

const RUN_OLD = { at: '2026-11-20T08:30:00Z', by: 'admin', sha256: 'a'.repeat(64), container: 'zip', applied: 3, unchanged: 1, backup: 'auto-pre-legacy-import-20261120-083000.zip', plan_digest: 'b'.repeat(64) };
const RUN_NEW = { at: NOW_ISO, by: 'admin', sha256: SHA, container: 'ha_backup', applied: 2, unchanged: 0, backup: PRE_IMPORT.name, plan_digest: DIGEST };

const LOCAL_BACKUP = { name: 'manual-20261124-030000.zip', bytes: 2_097_152, created_at: '2026-11-24T03:00:00Z', kind: 'manual', note: '', app_version: '2.51.0', valid: true,
  tables: { sites: 1, floors: 2 }, files: 3, sensitive: { state: 'omitted', counts: { password_hashes: 0, settings: 0 } } };
const PRE_BACKUP = { ...PRE_IMPORT, kind: 'auto-pre-legacy-import', note: 'legacy import', app_version: '2.55.0', valid: true, tables: { sites: 1, floors: 2, cameras: 6 }, files: 3,
  sensitive: { state: 'omitted', counts: { password_hashes: 0, settings: 0 } } };

export async function installLegacyMock(page: Page, opts: { lang?: 'he' | 'en'; runs?: boolean } = {}): Promise<LegacyMock> {
  const lang = opts.lang ?? 'he';
  const st: LegacyMock = { calls: [], backupGets: 0, apply: 'ok', status: 'ok', nothingToWrite: false, applied: false };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const err = (route: Route, status: number, code: string, he: string, en: string) =>
    json(route, { code, user_message: lang === 'en' ? en : he, retryable: false, correlation_id: 'mock', details: {} }, status);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  if (lang === 'en') await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* no storage on about:blank */ } });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (method !== 'GET') st.calls.push({ method, path: p, search: url.search, contentType: req.headers()['content-type'] ?? null, bytes: req.postDataBuffer()?.length ?? 0 });
    if (p === 'me') {
      return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true,
        bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN_PERMS, permissions_any: ADMIN_PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full' });
    }
    if (p === 'me/prefs') return json(route, { prefs: lang === 'en' ? { 'ui.lang': 'en' } : {}, stored: lang === 'en' ? ['ui.lang'] : [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'backup.password_min': 12 }, can_edit: true });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: NOW_ISO, version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'backups') {
      st.backupGets += 1;
      return json(route, { backups: st.applied ? [PRE_BACKUP, LOCAL_BACKUP] : [LOCAL_BACKUP], policy: { 'auto-daily': 7, 'auto-pre-upgrade': 5, 'auto-pre-legacy-import': 5 }, bytes: 0, schema_version: 140 });
    }
    if (p === 'backups/offbox') return json(route, { targets: [], running: false, transports: { s3: true, sftp: true, local: true }, key: { active: null, keys: [] } });
    if (p === 'backups/drill') return json(route, { running: false, history: [], schedule: { monthly: false, next_due_at: null, due_now: false }, last: null, last_offbox: null });
    if (p === 'migration/legacy' && method === 'GET') {
      if (st.status === 'forbidden') return err(route, 403, 'not_system_admin', 'רק מנהל מערכת יכול לייבא מהמערכת הישנה.', 'Only a system administrator can import from the legacy system.');
      if (st.status === 'missing') return err(route, 404, 'not_found', 'לא נמצא', 'Not found');
      const runs = [...(st.applied ? [RUN_NEW] : []), ...(opts.runs ? [RUN_OLD] : [])];
      return json(route, { runs, max_bytes: 20 * 1024 * 1024, backup_kind: 'auto-pre-legacy-import', confirm: { he: 'ייבוא מהמערכת הישנה', en: 'import legacy' }, legacy_version: '1.5.27' });
    }
    if (p === 'migration/legacy/dry-run' && method === 'POST') return json(route, report(lang, st.nothingToWrite));
    if (p === 'migration/legacy/apply' && method === 'POST') {
      if (st.apply === 'changed') {
        return err(route, 409, 'legacy_plan_changed', 'התוכנית השתנתה מאז הבדיקה (הקובץ או Arx). יש להריץ את הבדיקה שוב.', 'The plan changed since the check (the file or Arx). Run the check again.');
      }
      if (st.apply === 'backup_failed') {
        return err(route, 409, 'legacy_backup_failed', 'לא ניתן היה לכתוב גיבוי לפני הייבוא, ולכן שום דבר לא שונה.', 'The backup before the import could not be written, so nothing was changed.');
      }
      const already = st.apply === 'already';
      st.applied = true;
      return json(route, { applied: already ? 0 : 2, unchanged: already ? 2 : 0, cameras: already ? [] : [{ camera_id: 'cam-01', channel: 1 }, { camera_id: 'cam-02', channel: 2 }],
        backup: already ? null : PRE_IMPORT, already_applied: already, run: RUN_NEW });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return st;
}

/** A small invented file for the file chooser (the mock never reads it; the size reaches the request). */
export const LEGACY_FILE = { name: 'legacy-addon-backup.tar', mimeType: 'application/x-tar', buffer: Buffer.from('legacy test file - invented content '.repeat(32)) };

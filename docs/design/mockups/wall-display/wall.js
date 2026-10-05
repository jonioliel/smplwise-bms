/* SmplWise Arx - CR-030 wall display mockups. Fixture data (invented names), icons, the mockup chrome and the
   renderers: the display (wall.html), the normal login (login.html), the normal application a wall user sees on a phone or desktop
   (app.html) and Settings > wall displays (settings.html). Revision 2: no pairing, no TV template.
   Design only - no network, no product code. Everything is driven by URL parameters so Playwright can shoot each state. */
(function () {
  'use strict';

  /* ---------- URL + chrome ---------- */
  const P = new URLSearchParams(location.search);
  const q = (k, d) => (P.has(k) ? P.get(k) : d);
  const html = document.documentElement;
  html.dataset.skin = q('skin', 'classic');
  html.dataset.theme = q('scheme', 'dark');
  html.dataset.chrome = q('chrome', '1');
  const FIXED_CLOCK = q('clock', 'fixed') === 'fixed';
  const NOW = new Date(2026, 9, 5, 14, 32, 8); // Sunday 5 Oct 2026, the fixture instant (Asia/Jerusalem)
  const pad = (n) => String(n).padStart(2, '0');
  const sz = (t) => `<span class="ltr">${t}</span>`; // screen sizes are LTR, never mirrored by the RTL shell
  const clockText = () => { const d = FIXED_CLOCK ? NOW : new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const DATE_HE = 'יום ראשון, 5 באוקטובר';

  function setParam(k, v) { const u = new URL(location.href); u.searchParams.set(k, v); location.href = u.toString(); }
  function chrome(extra) {
    if (html.dataset.chrome === '0') return;
    const el = document.createElement('div'); el.className = 'mk';
    const sel = (k, opts, cur, label) => `<span class="lbl">${label}</span><select data-k="${k}">${opts.map((o) => `<option value="${o[0]}"${o[0] === cur ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    el.innerHTML = sel('skin', [['classic', 'classic'], ['bubble', 'bubble']], html.dataset.skin, 'skin') + sel('scheme', [['light', 'light'], ['dark', 'dark']], html.dataset.theme, 'scheme') + (extra || '') + `<span class="lbl">${innerWidth}×${innerHeight}</span>`;
    el.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => setParam(s.dataset.k, s.value)));
    document.body.appendChild(el);
  }

  /* ---------- icons ---------- */
  const I = {
    camera: '<path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="m17 10 5-3v10l-5-3"/>',
    alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    drop: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h8v18"/><path d="M14 3h4a1 1 0 0 1 1 1v17"/><circle cx="11" cy="12" r="1"/>',
    fire: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6-1 3-3 3-3 3 1-4-1-7-3-9 0 4-5 6-5 12 0 4 3 7 7 7z"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4l2-2z"/><path d="M10 21h4"/>',
    wifioff: '<path d="m2 8 1-1a16 16 0 0 1 18 0l1 1"/><path d="M5 12a11 11 0 0 1 6-3"/><path d="M8.5 15.5a6 6 0 0 1 7 0"/><path d="M12 19h.01"/><path d="m3 3 18 18"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/>',
    landscape: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M12 19v2"/>',
    portrait: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 18h.01"/>',
    tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="m13 7 4 4"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/>',
    heart: '<path d="M4 12h4l2-5 4 10 2-5h4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    home: '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z"/>',
    bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    drag: '<path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.6-1.5L8 13"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    remote: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9M17 5l2 2M14 8l2 2"/>',
    activity: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  };
  const ic = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

  /* ---------- fixtures ---------- */
  const CAMS = [
    { id: 'c1', name: 'לובי', scene: 'linear-gradient(160deg,#3a4a66,#1b2434 60%,#0f1521)', shapes: '<div class="lamp" style="left:62%;top:6%"></div><div class="box" style="left:8%;top:30%;width:26%;height:38%;border-radius:4px"></div><div class="person" style="left:48%"></div>' },
    { id: 'c2', name: 'כניסה ראשית', scene: 'linear-gradient(170deg,#6b7f9c,#2a3850 55%,#121a28)', shapes: '<div class="box" style="left:36%;top:18%;width:28%;height:62%;background:rgba(255,255,255,.06);border:2px solid rgba(0,0,0,.3)"></div><div class="person" style="left:44%"></div><div class="person" style="left:52%;bottom:18%;width:4%"></div>' },
    { id: 'c3', name: 'מסדרון קומה 2', scene: 'linear-gradient(180deg,#4a4f5a,#262a33 50%,#121419)', shapes: '<div class="box" style="left:0;top:20%;width:30%;height:60%;clip-path:polygon(0 0,100% 30%,100% 70%,0 100%)"></div><div class="box" style="right:0;top:20%;width:30%;height:60%;clip-path:polygon(100% 0,0 30%,0 70%,100% 100%)"></div><div class="lamp" style="left:41%;top:12%"></div>' },
    { id: 'c4', name: 'חניון', scene: 'linear-gradient(180deg,#2d3a4a,#1a222e 50%,#0d1117)', shapes: '<div class="car" style="left:12%"></div><div class="car" style="left:42%"></div><div class="car" style="left:70%;opacity:.6"></div><div class="lamp" style="left:80%;top:4%"></div>' },
    { id: 'c5', name: 'חצר אחורית', scene: 'linear-gradient(180deg,#5c6f6a,#2d3b36 50%,#141b18)', shapes: '<div class="box" style="left:60%;top:35%;width:34%;height:40%;border-radius:50% 50% 0 0;background:rgba(0,0,0,.35)"></div><div class="person" style="left:22%"></div>' },
    { id: 'c6', name: 'מחסן', scene: 'linear-gradient(180deg,#4b4538,#2a271f 50%,#13110c)', shapes: '<div class="box" style="left:6%;top:24%;width:20%;height:30%"></div><div class="box" style="left:28%;top:40%;width:18%;height:26%"></div><div class="box" style="right:6%;top:18%;width:24%;height:52%"></div>' },
    { id: 'c7', name: 'מטבח', scene: 'linear-gradient(180deg,#7a7262,#3c382f 55%,#1a1813)', shapes: '<div class="box" style="left:0;top:48%;width:100%;height:14%"></div><div class="lamp" style="left:30%;top:4%"></div><div class="lamp" style="left:60%;top:4%"></div>' },
    { id: 'c8', name: 'דלפק קבלה', scene: 'linear-gradient(170deg,#55627a,#2a3346 55%,#121722)', shapes: '<div class="box" style="left:20%;top:50%;width:60%;height:22%;border-radius:40px 40px 0 0"></div><div class="person" style="left:48%;bottom:30%"></div>' },
    { id: 'c9', name: 'מעלית', scene: 'linear-gradient(180deg,#3f4451,#22252d 50%,#0f1115)', shapes: '<div class="box" style="left:35%;top:14%;width:30%;height:70%;border:3px solid rgba(0,0,0,.35);background:rgba(255,255,255,.04)"></div>' },
    { id: 'c10', name: 'חדר מדרגות', scene: 'linear-gradient(180deg,#4a4d58,#272a31 50%,#111317)', shapes: '<div class="box" style="left:10%;top:30%;width:80%;height:50%;clip-path:polygon(0 100%,20% 80%,20% 60%,40% 60%,40% 40%,60% 40%,60% 20%,80% 20%,80% 0,100% 0,100% 100%)"></div>' },
    { id: 'c11', name: 'רציף פריקה', scene: 'linear-gradient(180deg,#5a5244,#2c2820 50%,#131109)', shapes: '<div class="car" style="left:50%;width:28%;bottom:14%"></div><div class="box" style="left:0;top:40%;width:30%;height:40%"></div>' },
    { id: 'c12', name: 'חדר שרתים', scene: 'linear-gradient(180deg,#2a3a55,#172238 50%,#0a0f1a)', shapes: '<div class="box" style="left:10%;top:10%;width:14%;height:80%"></div><div class="box" style="left:30%;top:10%;width:14%;height:80%"></div><div class="box" style="left:50%;top:10%;width:14%;height:80%"></div><div class="lamp" style="left:70%;top:60%;width:8%;background:radial-gradient(rgba(120,255,160,.5),transparent 70%)"></div>' },
  ];
  const cam = (id) => CAMS.find((c) => c.id === id);
  const AREAS = [
    { floor: 'קומת קרקע', areas: [['לובי וקבלה', ['c1', 'c2', 'c8']], ['חניון', ['c4']], ['חצר', ['c5']], ['מטבח', ['c7']]] },
    { floor: 'קומה 2', areas: [['מסדרון', ['c3', 'c9', 'c10']], ['מחסן', ['c6', 'c11']], ['חדר שרתים', ['c12']]] },
  ];
  // wall users: one row = one user (revision 2: no devices, no pairing). `id` is the user name.
  const DEVICES = [
    { id: 'reception-wall', name: 'קבלה', area: 'לובי וקבלה', preset: 'tablet-landscape', screen: '1280×800', status: 'online', seen: 'לפני 12 שניות', cams: ['c1', 'c2', 'c8', 'c4'], alerts: true, ack: false, frame: true, remote: false, channel: 'local', tablets: 1 },
    { id: 'floor2-wall', name: 'מסדרון קומה 2', area: 'מסדרון', preset: 'tablet-portrait', screen: '800×1280', status: 'online', seen: 'לפני 8 שניות', cams: ['c3', 'c9', 'c10'], alerts: true, ack: false, frame: false, remote: false, channel: 'local', tablets: 1 },
    { id: 'control-wall', name: 'חדר בקרה', area: 'כל ההתקנה', preset: 'tablet-landscape', screen: '1920×1200', status: 'online', seen: 'לפני 3 שניות', cams: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], alerts: true, ack: true, frame: false, remote: true, channel: 'remote', tablets: 2 },
    { id: 'kitchen-wall', name: 'מטבח', area: 'מטבח', preset: 'tablet-landscape', screen: '1024×768', status: 'sleep', seen: 'לפני דקה', cams: ['c7', 'c5'], alerts: true, ack: false, frame: true, remote: false, channel: 'local', tablets: 1 },
    { id: 'warehouse-wall', name: 'מחסן', area: 'מחסן', preset: 'tablet-portrait', screen: '768×1024', status: 'offline', seen: 'לפני 3 שעות', cams: ['c6', 'c11'], alerts: false, ack: false, frame: false, remote: false, channel: 'local', tablets: 1 },
    { id: 'floor3-wall', name: 'קומה 3', area: '—', preset: 'tablet-landscape', screen: '1280×800', status: 'paused', seen: 'לפני 4 ימים', cams: [], alerts: false, ack: false, frame: false, remote: false, channel: 'local', tablets: 1 },
    { id: 'demo-wall', name: 'הדגמה', area: 'לובי וקבלה', preset: 'tablet-landscape', screen: '—', status: 'never', seen: 'טרם התחבר', cams: ['c1'], alerts: false, ack: false, frame: false, remote: false, channel: 'local', tablets: 0 },
  ];
  const HA_USERS = [['dana-cohen', 'דנה כהן'], ['yossi-levi', 'יוסי לוי'], ['lobby-tab', 'טאבלט לובי'], ['guard-tab', 'טאבלט שמירה']]; // users that are not wall users yet
  const STATUS = { online: 'מחובר', sleep: 'ישן', offline: 'לא מחובר', paused: 'מושבת', never: 'טרם התחבר' };
  const PRESET_ICON = { 'tablet-landscape': 'landscape', 'tablet-portrait': 'portrait', single: 'camera' };
  const PRESET_HE = { auto: 'אוטומטי', 'tablet-landscape': 'טאבלט לרוחב', 'tablet-portrait': 'טאבלט לאורך', single: 'מצלמה אחת' };
  const ALERTS = {
    leak: { sev: 'critical', icon: 'drop', title: 'דליפת מים', place: 'מטבח', time: '14:31', cam: 'c7' },
    door: { sev: 'alert', icon: 'door', title: 'דלת מחסן פתוחה', place: '4 דקות', time: '14:28', cam: 'c6' },
    camoff: { sev: 'alert', icon: 'wifioff', title: 'מצלמה לא זמינה', place: 'חניון', time: '14:20', cam: null },
    smoke: { sev: 'critical', icon: 'fire', title: 'גלאי עשן', place: 'חדר שרתים', time: '14:32', cam: 'c12' },
    ring: { sev: 'alert', icon: 'bell', title: 'צלצול בדלת', place: 'כניסה ראשית', time: '14:32', cam: 'c2' },
    opened: { sev: 'info', icon: 'door', title: 'דלת כניסה נפתחה', place: '', time: '14:32', cam: null },
  };
  const PHOTOS = [
    'linear-gradient(160deg,#f6b26b,#e06c5a 45%,#5a3d6e 100%)', 'linear-gradient(200deg,#8fd3f4,#2b6cb0 60%,#1a365d)', 'linear-gradient(180deg,#d9f99d,#4d7c0f 70%,#1a2e05)',
    'linear-gradient(140deg,#fde68a,#f59e0b 50%,#7c2d12)', 'linear-gradient(170deg,#e9d5ff,#7c3aed 60%,#2e1065)', 'linear-gradient(190deg,#bae6fd,#0369a1 55%,#082f49)',
    'linear-gradient(150deg,#fecaca,#dc2626 60%,#450a0a)', 'linear-gradient(180deg,#cbd5e1,#475569 60%,#0f172a)',
  ];

  /* ---------- shared bits ---------- */
  function tile(c, opts = {}) {
    const st = opts.cam || 'live';
    const badge = st === 'live' ? '<span class="badge"><i></i>חי</span>' : st === 'stale' ? '<span class="badge"><i></i>אין וידאו · 14:31:52</span>' : '<span class="badge"><i></i>אין חיבור</span>';
    const inner = st === 'lost' ? `<div class="lost"><b>${c.name}</b>אין וידאו מאז 14:31 · מנסה שוב</div>` : `<div class="scene" style="--scene:${c.scene}">${c.shapes}<div class="floor"></div></div><div class="osd">${NOW.getFullYear()}-10-05 ${clockText()}:${pad(NOW.getSeconds())} CAM ${c.id.slice(1).padStart(2, '0')}</div>`;
    return `<div class="tile" data-cam="${st}" data-id="${c.id}">${inner}<div class="label">${c.name}${badge}</div></div>`;
  }
  function stripChip(tone, icon, text) { return `<span class="chip" data-tone="${tone}">${icon ? ic(icon) : '<i></i>'}${text}</span>`; }

  /* =================================================================================================================
     THE DISPLAY
     ================================================================================================================= */
  function presetFor() {
    const p = q('preset', 'auto');
    if (p !== 'auto') return p;
    const w = innerWidth, h = innerHeight;
    if (h > w) return 'tablet-portrait';
    return 'tablet-landscape';
  }
  function gridFor(preset, n) {
    if (preset === 'single') return [1, 1];
    if (preset === 'tablet-portrait') return [1, Math.min(innerHeight >= 1500 ? 3 : 2, Math.max(1, n))];
    return n <= 1 ? [1, 1] : n <= 2 ? [2, 1] : n <= 4 ? [2, 2] : [3, 2];
  }
  const WALL_STATES = ['base', 'rotating', 'info', 'alert', 'alert-stack', 'takeover', 'takeover-stack', 'resolved', 'frame', 'frame-info', 'dim', 'sleep', 'cam-stale', 'cam-lost', 'server-offline', 'server-clock', 'config-updated', 'installer', 'sound-locked', 'no-cameras', 'access-removed', 'remote-refused', 'no-connection'];

  function renderWall() {
    const state = q('state', 'base');
    const preset = presetFor();
    const base = preset === 'tablet-portrait' ? DEVICES[1] : DEVICES[0];
    const device = q('ack', '') === 'on' ? { ...base, ack: true } : base;
    const n = Number(q('cams', preset === 'tablet-portrait' ? 3 : 4));
    const pages = preset === 'tablet-portrait' && n > 2 ? Math.ceil(n / 2) : 1;
    const [cols, rows] = q('grid', 'auto') === 'auto' ? gridFor(preset, n) : q('grid').split('x').map(Number);
    const own = device.cams.map(cam); const cams = own.concat(CAMS.filter((c) => !own.includes(c))).slice(0, Math.max(n, 1)); // the device's allow list first, then fillers when ?cams asks for more
    const root = document.getElementById('root');
    const alertsOn = q('alerts', 'on');
    const fullscreen = (cls, inner) => `<div class="full ${cls}">${inner}</div>`;

    // full-screen states first
    const bigClock = `<div class="big-clock ltr">${clockText()}</div><div class="date">${DATE_HE}</div>`;
    const FULL = {
      sleep: () => fullscreen('sleep', `<div class="inner">${bigClock}</div>`),
      'server-clock': () => fullscreen('', `<div class="inner"><span class="chip" data-tone="danger">${ic('wifioff')}אין חיבור למערכת · מנסה שוב כל 15 שניות</span>${bigClock}<p>${device.name} · מנותק מאז 14:30</p></div>`),
      'access-removed': () => fullscreen('', `<div class="inner"><div class="ico" data-tone="danger">${ic('x')}</div><h1>הגישה למסך הזה הוסרה</h1><p>מנהל המערכת הסיר את הגישה של המשתמש <span class="ltr">${device.id}</span>. כדי להציג שוב, מנהל צריך להוסיף אותו בהגדרות › מסכי קיר.</p><button class="btn primary" onclick="location.href='login.html?step=form&skin=${html.dataset.skin}&scheme=${html.dataset.theme}'">${ic('user')}למסך הכניסה</button></div>`),
      'remote-refused': () => fullscreen('', `<div class="inner"><div class="ico" data-tone="danger">${ic('remote')}</div><h1>כניסה מרחוק לא מאושרת למשתמש הזה</h1><p>המשתמש <span class="ltr">${device.id}</span> מוגדר לרשת המקומית בלבד. התחבר דרך הכתובת המקומית, או אפשר גישה מרחוק בהגדרות › מסכי קיר.</p><button class="btn" onclick="location.href='login.html?step=form&skin=${html.dataset.skin}&scheme=${html.dataset.theme}'">${ic('user')}למסך הכניסה</button></div>`),
      'no-connection': () => fullscreen('', `<div class="inner"><div class="ico" data-tone="stale">${ic('wifioff')}</div><h1>אין חיבור לשרת</h1><p>בדוק את חיבור הרשת של הטאבלט. המסך ינסה שוב לבד.</p><span class="chip ghost"><span class="spin" style="width:14px;height:14px;border:2px solid currentColor;border-inline-end-color:transparent;border-radius:50%;display:inline-block"></span>מנסה שוב</span><div class="foot" style="position:static;font-family:var(--sw-font-mono);direction:ltr;color:var(--wall-text-2);font-size:13px">http://arx.local:8099/</div></div>`),
    };
    if (FULL[state]) { root.innerHTML = FULL[state](); return finishWall(state); }

    if (state === 'frame' || state === 'frame-info') {
      root.innerHTML = `<div class="frame-mode" data-fit="${q('fit', 'contain')}" title="נגיעה מחזירה למצלמות"><div class="photo" style="--photo:${PHOTOS[Number(q('photo', 0)) % PHOTOS.length]}"></div>
        ${state === 'frame-info' ? `<span class="chip strip-chip" data-tone="info">${ic('door')}דלת כניסה נפתחה · 14:32</span>` : ''}
        <div class="corner"><b class="ltr">${clockText()}</b><span>${DATE_HE} · ${device.name}</span></div></div>`;
      root.querySelector('.frame-mode').addEventListener('click', () => setParam('state', 'base'));
      return finishWall(state);
    }

    // the base layout + overlays
    const camState = (c, i) => (state === 'cam-stale' && i === 1 ? 'stale' : state === 'cam-lost' && i === 1 ? 'lost' : state === 'server-offline' ? 'stale' : 'live');
    const alertKey = q('alert', 'door');
    const A = ALERTS[alertKey];
    const chips = [];
    if (state === 'info') chips.push(stripChip('info', 'door', 'דלת כניסה נפתחה · 14:32'));
    if (state === 'resolved') chips.push(stripChip('live', 'check', 'נסגר · דלת מחסן'));
    if (state === 'config-updated') chips.push(stripChip('info', 'check', 'ההגדרות עודכנו'));
    if (device.alerts && state !== 'server-offline') chips.push(stripChip(state === 'cam-lost' || state === 'cam-stale' ? 'stale' : 'live', null, state === 'cam-lost' || state === 'cam-stale' ? 'מערכת: אזהרה · מצלמה' : 'מערכת: תקין'));
    chips.push(`<span class="chip">${ic('shield')}אזעקה: דרוכה חלקית</span>`);
    if (preset !== 'tablet-portrait') chips.push(`<span class="chip">${ic('sun')}24°</span>`);

    let tiles = cams.slice(0, cols * rows).map((c, i) => tile(c, { cam: camState(c, i) }));
    const alertTile = (a, count) => `<div class="tile alert" data-sev="${a.sev}"><div class="head"><span class="ico">${ic(a.icon)}</span><div><b>${a.title}</b><small>${a.place ? a.place + ' · ' : ''}${a.time}</small></div>${count ? `<span class="count">+${count}</span>` : ''}</div>
      <div class="video">${a.cam ? `<div class="scene" style="--scene:${cam(a.cam).scene}">${cam(a.cam).shapes}<div class="floor"></div></div><div class="osd">LIVE · ${cam(a.cam).name}</div>` : `<div class="lost" style="display:grid;place-items:center;height:100%;color:var(--wall-text-2)">${ic('camera')}</div>`}</div>
      <div class="acts"><button class="btn" data-act="seen">${ic('eye')}ראיתי</button>${device.ack ? `<button class="btn hold danger" data-act="ack">${ic('check')}אישור <small style="font-weight:400;opacity:.8">(לחיצה ארוכה)</small></button>` : ''}</div></div>`;

    const showAlertCell = state === 'alert' || state === 'alert-stack';
    if (showAlertCell) tiles[0] = alertTile(A, state === 'alert-stack' ? 2 : 0);


    const strip = `<header class="strip" dir="rtl"><div class="place">${ic('camera')}${device.name}<span class="sub">· ${device.area}</span></div>
      <div class="clock ltr" id="clock" title="לחיצה ארוכה: פרטי מסך למתקין"><span>${clockText()}</span><span class="date" dir="rtl">${DATE_HE}</span></div><div class="chips">${chips.join('')}</div></header>`;
    const bannerHtml = state === 'server-offline' ? `<div class="banner">${ic('wifioff')}אין חיבור למערכת · מנסה שוב<span class="spin"></span></div>` : '';
    const portraitBand = preset === 'tablet-portrait' ? `<section class="band"><div class="card"><h4>${device.area} · מפה</h4><div class="map"><div class="room" style="left:6%;top:10%;width:60%;height:80%"></div><div class="room" style="left:66%;top:10%;width:28%;height:38%"></div><div class="room" style="left:66%;top:52%;width:28%;height:38%"></div><div class="cam" style="left:14%;top:24%;--a:120deg"></div><div class="cam" style="left:50%;top:70%;--a:-40deg"></div><div class="cam" style="left:78%;top:30%;--a:200deg"></div>${state === 'alert' || state === 'alert-stack' ? '<div class="fire" style="left:80%;top:70%"></div>' : ''}</div></div>
      <div class="card"><h4>מצב</h4><div class="states"><span class="chip">${ic('door')}דלת מחסן: סגורה</span><span class="chip">${ic('sun')}22.5°</span><span class="chip">${ic('bolt')}1.2 kW</span><span class="chip">${ic('lock')}נעול</span></div></div></section>` : '';
    const statusLine = `<div class="status-line" data-tone="${state === 'server-offline' ? 'offline' : state.startsWith('cam-') ? 'stale' : 'ok'}"><i></i>${state === 'server-offline' ? 'מנותק מאז 14:30' : 'מחובר · 4 זרמים'}<span style="margin-inline-start:auto">${sz(device.id)} · ${sz(preset === 'tablet-portrait' ? '800×1280' : device.screen)}</span></div>`;

    root.innerHTML = `<main class="wall${state === 'dim' ? ' dim' : ''}" data-preset="${preset}" data-shift="${q('shift', '0')}" style="--cols:${cols};--rows:${rows}">
      ${state === 'server-offline' ? bannerHtml : strip}
      ${preset === 'tablet-portrait' ? '' : ''}
      ${state === 'no-cameras' ? `<div class="full" style="position:relative;background:transparent"><div class="inner"><div class="ico">${ic('camera')}</div><h1>לא הוגדרו מצלמות למסך הזה</h1><p>בחר מצלמות בהגדרות › מסכי קיר › ${device.name}</p></div></div>` : `<section class="grid">${tiles.join('')}</section>`}
      ${portraitBand}
      ${preset === 'tablet-portrait' ? statusLine : ''}
      ${state === 'rotating' || pages > 1 ? `<div class="dots">${Array.from({ length: Math.max(pages, state === 'rotating' ? 3 : 1) }, (_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      ${state === 'sound-locked' ? `<button class="btn sound-note">${ic('speaker')}הקש פעם אחת להפעלת צליל</button>` : ''}
      ${state === 'installer' ? `<div class="installer"><b>פרטי מסך (למתקין)</b>user ${device.id}<br>title ${device.name}<br>detected tablet · ${sz(device.screen)} · touch primary<br>preset ${preset} · ${cols}×${rows} · sub<br>channel ${device.channel} · ws open · rtt 18 ms<br>server 2.3.0 · zone Asia/Jerusalem<br>session expires in 89 days<br>closes in 10 s<br><button class="btn" style="margin-top:8px;min-height:36px">${ic('logout')}יציאה (דורש סיסמה)</button></div>` : ''}
      ${state === 'takeover' || state === 'takeover-stack' ? takeover(state === 'takeover-stack' ? ['leak', 'smoke', 'door'] : [alertKey === 'door' ? 'leak' : alertKey], device, preset) : ''}
    </main>`;
    finishWall(state, preset, cols, rows);
  }
  function takeover(keys, device, preset) {
    const a = ALERTS[keys[0]];
    const c = a.cam ? cam(a.cam) : null;
    return `<div class="takeover"><header class="strip" dir="rtl"><div class="place">${ic('alert')}התראה קריטית<span class="sub">· ${device.name}</span></div><div class="clock ltr"><span>${clockText()}</span></div><div class="chips">${keys.length > 1 ? `<span class="chip" data-tone="danger">${keys.length} התראות פתוחות</span>` : ''}</div></header>
      <div class="video">${c ? `<div class="scene" style="--scene:${c.scene}">${c.shapes}<div class="floor"></div></div><div class="osd">LIVE · ${c.name}</div>` : ''}<div class="title"><span class="ico">${ic(a.icon)}</span><div><b>${a.title}</b><span>${a.place} · ${a.time}${c ? ' · ' + c.name : ''}</span></div></div>
        ${keys.length > 1 ? `<div class="stack">${keys.slice(1).map((k) => { const x = ALERTS[k]; return `<div class="acard" data-sev="${x.sev}"><span class="ico">${ic(x.icon)}</span><b>${x.title}</b><small>${x.place} · ${x.time}</small></div>`; }).join('')}</div>` : ''}</div>
      <div class="acts"><button class="btn" data-act="seen">${ic('eye')}ראיתי</button>${device.ack ? `<button class="btn hold danger" data-act="ack">${ic('check')}אישור (לחיצה ארוכה)</button>` : `<span class="chip ghost">${ic('lock')}אישור מהמסך הזה לא מופעל</span>`}</div></div>`;
  }
  function finishWall(state, preset, cols, rows) {
    // interactions: seen collapses, hold-to-ack, long-press on the clock, frame return
    document.querySelectorAll('[data-act="seen"]').forEach((b) => b.addEventListener('click', () => setParam('state', 'info')));
    document.querySelectorAll('[data-act="ack"]').forEach((b) => {
      let t; const start = () => { b.classList.add('holding'); t = setTimeout(() => setParam('state', 'resolved'), 1500); };
      const stop = () => { b.classList.remove('holding'); clearTimeout(t); };
      b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop);
    });
    const clock = document.getElementById('clock');
    if (clock) { let t; clock.addEventListener('pointerdown', () => { t = setTimeout(() => setParam('state', 'installer'), 1200); }); clock.addEventListener('pointerup', () => clearTimeout(t)); }
    if (!FIXED_CLOCK) setInterval(() => document.querySelectorAll('.clock > span:first-child, .big-clock, .corner b').forEach((e) => (e.textContent = clockText())), 1000);
    const opts = WALL_STATES.map((s) => `<option value="${s}"${s === state ? ' selected' : ''}>${s}</option>`).join('');
    const presets = ['auto', 'tablet-landscape', 'tablet-portrait', 'single'].map((p) => `<option value="${p}"${p === q('preset', 'auto') ? ' selected' : ''}>${p}</option>`).join('');
    chrome(`<span class="lbl">state</span><select data-k="state">${opts}</select><span class="lbl">preset</span><select data-k="preset">${presets}</select><span class="lbl">cams</span><select data-k="cams">${[1, 2, 3, 4, 6, 8, 10, 12].map((n) => `<option${String(n) === q('cams', '') ? ' selected' : ''}>${n}</option>`).join('')}</select>${preset ? `<span class="lbl">${preset} ${cols}×${rows}</span>` : ''}`);
    document.title = `מסך קיר · ${state}`;
  }

  /* =================================================================================================================
     THE NORMAL LOGIN ON A TABLET (CR-008 login, nothing new) AND WHAT A WALL USER SEES ON A PHONE / DESKTOP
     ================================================================================================================= */
  const LOGIN_STEPS = ['form', 'error', 'detect', 'removed'];
  function renderLogin() {
    const step = q('step', 'form');
    const logo = `<div class="logo"><i></i>SmplWise Arx</div>`;
    const form = (note) => `${logo}<h1>כניסה למערכת</h1>${note || ''}<div class="fld"><label>שם משתמש</label><input class="ltr" value="reception-wall" aria-label="שם משתמש"></div><div class="fld"><label>סיסמה</label><input type="password" value="••••••••••" aria-label="סיסמה"></div><label class="keep"><span class="chk on">${ic('check')}</span>השאר אותי מחובר</label><button class="btn primary" style="width:100%" onclick="location.search=location.search.replace(/step=[^&]*/,'step=detect')">כניסה</button>`;
    const V = {
      form: () => form(''),
      error: () => form(`<div class="msg" data-tone="danger">${ic('x')}שם המשתמש או הסיסמה שגויים</div>`),
      removed: () => form(`<div class="msg" data-tone="stale">${ic('lock')}הגישה למסך הזה הוסרה · פנה למנהל המערכת</div>`),
      detect: () => `${logo}<div class="ok">${ic('check')}</div><h1>זוהה טאבלט</h1><p>המשתמש "קבלה" הוא משתמש מסך קיר · עובר למצב מסך קיר</p><div class="wait"><span class="spin"></span>טוען את המצלמות…</div>`,
    };
    document.getElementById('root').innerHTML = `<div class="pair gate"><div class="card">${(V[step] || V.form)()}</div><div class="foot">arx.local:8099 · v2.3.0</div></div>`;
    const opts = LOGIN_STEPS.map((s) => `<option value="${s}"${s === step ? ' selected' : ''}>${s}</option>`).join('');
    chrome(`<span class="lbl">step</span><select data-k="step">${opts}</select>${step === 'detect' ? `<button onclick="location.href='wall.html?state=base&skin=${html.dataset.skin}&scheme=${html.dataset.theme}'">→ wall</button>` : ''}`);
    document.title = `כניסה · ${step}`;
  }

  function renderApp() {
    const cls = q('cls', 'phone');
    const own = DEVICES[0].cams.map(cam);
    const user = `<span class="user">${ic('user')}קבלה · <span class="ltr">reception-wall</span></span>`;
    const row = (c) => `<div class="lrow"><div class="th" style="--scene:${c.scene}"></div><div><b>${c.name}</b><small>לובי וקבלה · חי</small></div><span class="badge-live"><i></i>חי</span></div>`;
    const root = document.getElementById('root');
    if (cls === 'phone') {
      root.innerHTML = `<div class="lite phone"><header class="ltop"><b><i></i>SmplWise Arx</b>${user}</header><main><h2>מצלמות</h2><div class="llist">${own.map(row).join('')}</div></main>
        <nav class="lbottom"><a class="on">${ic('camera')}מצלמות</a><a>${ic('map')}מפה</a></nav></div>`;
    } else {
      root.innerHTML = `<div class="lite desk"><nav class="lrail"><div class="brand"><i></i>SmplWise Arx</div><a class="on">${ic('camera')}מצלמות</a><a>${ic('map')}מפה</a><span class="sp"></span>${user}</nav>
        <main><h2>מצלמות · לובי וקבלה</h2><div class="lgrid">${own.map((c) => tile(c)).join('')}</div></main></div>`;
    }
    chrome(`<span class="lbl">cls</span><select data-k="cls">${['phone', 'desktop'].map((c) => `<option${c === cls ? ' selected' : ''}>${c}</option>`).join('')}</select><span class="lbl">משתמש מסך קיר בלי מצב קיר: מפה ווידאו חי בלבד</span>`);
    document.title = `המערכת הרגילה · ${cls}`;
  }

  /* =================================================================================================================
     SETTINGS > WALL DISPLAYS
     ================================================================================================================= */
  const SET_VIEWS = ['list', 'empty', 'error', 'add', 'add-form', 'drawer', 'drawer-alerts', 'drawer-frame', 'drawer-schedule', 'remove', 'saved'];
  function renderSettings() {
    const view = q('view', 'list');
    const sel = q('device', 'reception-wall');
    const d = DEVICES.find((x) => x.id === sel) || DEVICES[0];
    const rail = `<nav class="rail"><div class="brand"><i></i>SmplWise Arx</div><div class="sec">הגדרות</div>
      <a href="#">${ic('settings')}כללי</a><a href="#">${ic('remote')}חיבורים</a><a href="#">${ic('key')}גישה והרשאות</a><a href="#">${ic('bell')}התראות</a><a href="#">${ic('clock')}תזמונים</a><a href="#" class="on">${ic('tv')}מסכי קיר</a><a href="#">${ic('activity')}בריאות ועבודות</a><a href="#">${ic('search')}יומן ביקורת</a></nav>`;
    const stChip = (dev) => `<span class="st" data-s="${dev.status}"><i></i>${STATUS[dev.status]}</span>`;
    const rowHtml = (dev) => `<tr${dev.id === sel && view.startsWith('drawer') ? ' class="sel"' : ''}>
      <td><div class="name"><span class="preset-ico" title="${PRESET_HE[dev.preset]}">${ic(PRESET_ICON[dev.preset])}</span><div><b>${dev.name}</b><span><span class="ltr">${dev.id}</span> · ${dev.area}</span></div></div></td>
      <td>${stChip(dev)}${dev.tablets > 1 ? `<div class="sub">${dev.tablets} טאבלטים</div>` : ''}${dev.status === 'offline' ? `<div class="sub">נראה לאחרונה ${dev.seen}</div>` : ''}</td>
      <td>${dev.status === 'never' ? '<span class="sub">—</span>' : `<span title="2026-10-05 14:32:00">${dev.seen}</span>`}${dev.channel === 'remote' ? ` <span class="mini">${ic('remote')}מרחוק</span>` : ''}</td>
      <td>${dev.cams.length ? `${dev.cams.length} · <span class="sub">${dev.cams.slice(0, 2).map((c) => cam(c).name).join(', ')}${dev.cams.length > 2 ? '…' : ''}</span>` : '<span class="sub" style="color:var(--sw-stale-text)">לא הוגדרו</span>'}</td>
      <td>${dev.alerts ? `<span class="mini">${ic('alert')}פעיל</span>` : '<span class="sub">כבוי</span>'}${dev.ack ? ` <span class="mini" style="background:var(--sw-accent-soft);color:var(--sw-accent-text)">אישור מותר</span>` : ''}${dev.frame ? ` <span class="mini">${ic('image')}תמונות</span>` : ''}</td>
      <td><div class="acts"><button class="b ghost" title="עריכה" data-go="drawer&device=${dev.id}">${ic('edit')}</button><button class="b ghost" title="${dev.status === 'paused' ? 'הפעלה' : 'השבתה'}">${ic(dev.status === 'paused' ? 'play' : 'pause')}</button><button class="b ghost" title="הסרה" data-go="remove&device=${dev.id}" style="color:var(--sw-danger-text)">${ic('trash')}</button></div></td></tr>`;
    const list = DEVICES.filter((x) => view !== 'empty');
    const online = list.filter((x) => x.status === 'online').length;
    const phone = innerWidth < 900;
    const table = phone ? `<div class="phone-cards">${list.map((dev) => `<div class="card pc"><div class="l1"><span class="preset-ico">${ic(PRESET_ICON[dev.preset])}</span><b>${dev.name}</b>${stChip(dev)}</div><div class="l2 sub"><span class="ltr">${dev.id}</span> · ${dev.area} · ${dev.cams.length} מצלמות</div><div class="l2">${dev.alerts ? `<span class="mini">${ic('alert')}התראות</span>` : ''}${dev.ack ? '<span class="mini">אישור מותר</span>' : ''}${dev.frame ? `<span class="mini">${ic('image')}תמונות</span>` : ''}<span style="flex:1"></span><button class="b ghost icon">${ic('edit')}</button><button class="b ghost icon" style="color:var(--sw-danger-text)">${ic('trash')}</button></div></div>`).join('')}</div>`
      : `<div class="card"><table class="list"><thead><tr><th>משתמש מסך</th><th>מצב</th><th>נראה לאחרונה</th><th>מצלמות</th><th>התראות</th><th></th></tr></thead><tbody>${list.map(rowHtml).join('')}</tbody></table></div>`;
    const empty = `<div class="card empty"><div class="ico">${ic('tv')}</div><h2>אין משתמשי מסך קיר</h2><p>משתמש שמתחבר מטאבלט והמסך עובר לבד להציג את המצלמות של המקום שלו.</p><button class="b primary" data-go="add">${ic('plus')}הוספת משתמש מסך</button></div>`;
    const error = `<div class="card err-card">${ic('alert')}<div><b>הרשימה לא נטענה</b><span>השרת לא ענה (504). נסה שוב.</span></div><span style="flex:1"></span><button class="b" data-go="list">${ic('refresh')}נסה שוב</button></div>`;
    const main = `<div class="content"><div class="topline"><h1>מסכי קיר</h1><span class="count">${view === 'empty' ? '' : `${list.length} משתמשים · ${online} מחוברים`}</span><span class="sp"></span><button class="b" title="תיקיות תמונות">${ic('image')}תמונות למסכים</button><button class="b primary" data-go="add">${ic('plus')}הוספת משתמש מסך</button></div>
      ${view === 'empty' ? empty : view === 'error' ? error : table}
      ${view === 'saved' ? `<div class="msg" data-tone="ok" style="position:fixed;bottom:20px;inset-inline-start:50%;transform:translateX(50%);box-shadow:var(--sw-shadow-3)">${ic('check')}נשמר · "${d.name}" קיבל את ההגדרות</div>` : ''}</div>`;

    const userRows = (picked) => `<div class="upick">${HA_USERS.map(([u, n], i) => `<div class="urow${picked === i ? ' on' : ''}"><span class="rd"></span><div><b>${n}</b><span class="ltr">${u}</span></div></div>`).join('')}</div>`;
    const DLG = {
      add: () => dialog('הוספת משתמש מסך', `<div class="fld"><input class="in" placeholder="חיפוש משתמש" aria-label="חיפוש"></div>${userRows(-1)}<div class="note">משתמש חדש נוצר בתשתית המערכת ואז מופיע כאן</div>`, `<button class="b primary" disabled>המשך</button><button class="b ghost" data-go="list">ביטול</button>`),
      'add-form': () => dialog('הוספת משתמש מסך', `${userRows(2)}<div class="row"><label>שם המסך</label><input class="in" value="לובי"></div><div class="row"><label>מקום</label><div class="v"><select class="in" style="max-width:260px"><option>לובי וקבלה</option>${AREAS.flatMap((f) => f.areas.map((a) => `<option>${a[0]}</option>`)).join('')}</select></div></div><div class="msg" data-tone="ok">${ic('shield')}תפקיד: קיוסק - מפה ווידאו חי בלבד, ללא שליטה</div>`, `<button class="b primary" data-go="drawer&device=demo-wall">הוספה</button><button class="b ghost" data-go="list">ביטול</button>`),
      remove: () => dialog('הסרת משתמש מסך', `<p style="margin:0">להסיר את "${d.name}" (<span class="ltr">${d.id}</span>)?</p><div class="note">ההרשאות וההגדרות נמחקות, החיבורים נסגרים והמסך יציג "הגישה הוסרה". את המשתמש עצמו לא מוחקים.</div>`, `<button class="b danger" data-go="list">${ic('trash')}הסרה</button><button class="b ghost" data-go="list">ביטול</button>`),
    };
    const drawerSect = view === 'drawer-alerts' ? 'alerts' : view === 'drawer-frame' ? 'frame' : view === 'drawer-schedule' ? 'schedule' : 'main';
    const drawerHtml = view.startsWith('drawer') ? `<aside class="drawer" role="dialog" aria-label="עריכת משתמש מסך"><header><h2>${d.name}<small>${PRESET_HE[d.preset]} · <span class="ltr">${d.id}</span></small></h2>${stChip(d)}<button class="b ghost icon" data-go="list">${ic('x')}</button></header>
      <div class="seg" style="margin:0 22px 6px;align-self:start">${[['main', 'משתמש ומצלמות'], ['alerts', 'התראות'], ['frame', 'תמונות'], ['schedule', 'שעות ושמירה']].map(([k, t]) => `<button class="${drawerSect === k ? 'on' : ''}" data-go="${k === 'main' ? 'drawer' : 'drawer-' + k}&device=${d.id}">${t}</button>`).join('')}</div>
      <div class="body">${formBody(d, drawerSect)}</div>
      <footer><button class="b primary" data-go="saved&device=${d.id}">שמירה</button><button class="b ghost" data-go="list">ביטול</button><span class="sp"></span><button class="b danger" data-go="remove&device=${d.id}">${ic('trash')}הסרה</button></footer></aside>` : '';
    document.getElementById('root').innerHTML = `<div class="app">${rail}${main}</div>${DLG[view] ? DLG[view]() : ''}${drawerHtml}`;
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { const [v, extra] = b.dataset.go.split('&'); const u = new URL(location.href); u.searchParams.set('view', v); if (extra) { const [k, val] = extra.split('='); u.searchParams.set(k, val); } location.href = u.toString(); }));
    document.querySelectorAll('.tog').forEach((t) => t.addEventListener('click', () => t.classList.toggle('on')));
    document.querySelectorAll('.chk').forEach((t) => t.addEventListener('click', () => t.classList.toggle('on')));
    chrome(`<span class="lbl">view</span><select data-k="view">${SET_VIEWS.map((v) => `<option value="${v}"${v === view ? ' selected' : ''}>${v}</option>`).join('')}</select>`);
    document.title = `הגדרות › מסכי קיר · ${view}`;
  }
  function dialog(title, body, foot, wide) { return `<div class="scrim"><div class="dialog${wide ? ' wide' : ''}" role="dialog" aria-label="${title}"><header><h2>${title}</h2><button class="b ghost icon" data-go="list">${ic('x')}</button></header><div class="body">${body}</div><footer>${foot}</footer></div></div>`; }
  function formBody(d, sect) {
    const tog = (on, label, small) => `<div class="tog-row"><div><span>${label}</span>${small ? `<small>${small}</small>` : ''}</div><button class="tog${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}"></button></div>`;
    const seg = (opts, cur) => `<div class="seg">${opts.map(([k, t]) => `<button class="${k === cur ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const [c, r] = gridFor(d.preset, d.cams.length || 4);
    if (sect === 'alerts') return `<div class="sect"><h3>התראות על המסך</h3>${tog(d.alerts, 'הצגת התראות', 'התראות מהאזור ומהמצלמות של המסך')}<div class="row"><label>קטגוריות</label><div class="chips">${[['safety', 'בטיחות', true], ['alerts', 'מצלמות וחוקים', true], ['doors', 'דלתות', true], ['device_faults', 'תקלות', true], ['security', 'אזעקה', true], ['intercom', 'אינטרקום', false]].map(([k, t, on]) => `<button class="chk${on ? ' on' : ''}">${on ? ic('check') : ''}${t}</button>`).join('')}</div></div>
      <div class="row"><label>סף הצגה</label><div class="v">${seg([['info', 'מידע'], ['alert', 'התראה'], ['critical', 'קריטי בלבד']], 'alert')}</div></div>
      <div class="row"><label>התראה מתקפלת אחרי</label><div class="v">${seg([['60', 'דקה'], ['120', '2 דק׳'], ['300', '5 דק׳']], '120')}<span class="note">קריטי נשאר עד אישור</span></div></div>
      <div class="row"><label>צליל</label><div class="v">${seg([['off', 'כבוי'], ['alert', 'התראה ומעלה'], ['critical', 'קריטי בלבד']], 'off')}</div></div></div>
      <div class="sect"><h3>אישור מהמסך</h3>${tog(d.ack, 'אישור התראות מהמסך הזה', 'לחיצה ארוכה · נרשם ביומן בשם המסך')}<div class="msg" data-tone="stale">${ic('shield')}מומלץ רק בעמדה מאוישת (קבלה, חדר בקרה)</div></div>
      <div class="sect"><h3>לא זמין ממסך קיר</h3><div class="chips"><span class="chk">${ic('lock')}פתיחת דלת</span><span class="chk">${ic('lock')}דריכה / נטרול אזעקה</span><span class="chk">${ic('lock')}הפעלת התקנים</span><span class="chk">${ic('lock')}הקלטות וייצוא</span></div></div>`;
    if (sect === 'frame') return `<div class="sect"><h3>מסגרת תמונות</h3>${tog(d.frame, 'הצגת תמונות בזמן שקט', 'חוזר למצלמות בכל התראה ובנגיעה')}<div class="row"><label>תיקייה</label><div class="v"><select class="in" style="max-width:300px"><option>תמונות למסכים › קבלה (24)</option><option>תמונות למסכים › חגים (12)</option><option>ספריית המדיה › Photos/Office</option></select></div></div><div class="row"><label></label><div class="thumbs">${PHOTOS.slice(0, 6).map((p) => `<i style="--photo:${p}"></i>`).join('')}</div></div>
      <div class="row"><label>מתחיל אחרי</label><div class="v">${seg([['5', '5 דק׳'], ['10', '10 דק׳'], ['30', '30 דק׳']], '10')}שקט</div></div><div class="row"><label>תמונה כל</label><div class="v">${seg([['15', '15 שנ׳'], ['30', '30 שנ׳'], ['60', 'דקה']], '30')}</div></div><div class="row"><label>התאמה</label><div class="v">${seg([['contain', 'שלמה'], ['cover', 'ממלאת']], 'contain')}</div></div><div class="row"><label>תנועה</label><div class="v">${seg([['none', 'ללא'], ['slow', 'איטית']], 'none')}</div></div>${tog(true, 'שעון ותאריך בפינה')}
      <div class="msg" data-tone="ok">${ic('shield')}רק תיקיות תמונות. צילומי מצלמות, קליפים ותיקי חקירה אינם ניתנים לבחירה.</div></div>`;
    if (sect === 'schedule') return `<div class="sect"><h3>שעות פעילות</h3>${tog(true, 'לו"ז ערות ושינה', 'מחוץ לחלון: מסך שחור עם שעון, הזרמים סגורים')}<div class="week"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="hdr">${h % 6 === 0 ? h : ''}</span>`).join('')}${['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((dn, i) => `<span class="d">${dn}</span>${Array.from({ length: 24 }, (_, h) => `<span class="h${i < 5 ? (h >= 7 && h < 20 ? ' on' : '') : i === 5 ? (h >= 7 && h < 14 ? ' on' : '') : ''}"></span>`).join('')}`).join('')}</div><div class="note">א׳–ה׳ 07:00–20:00 · ו׳ 07:00–14:00 · שבת כבוי · אזור הזמן של ההתקנה</div>
      <div class="row"><label>התעוררות בהתראה</label><div class="v">${seg([['never', 'אף פעם'], ['critical', 'קריטי'], ['alert', 'התראה ומעלה']], 'critical')}</div></div>${tog(true, 'התעוררות בנגיעה', 'ל-10 דקות')}</div>
      <div class="sect"><h3>שמירה על המסך</h3>${tog(true, 'הזזת פיקסלים', 'כל 60 שניות, 2 פיקסלים')}${tog(true, 'ערבוב אריחים', 'כל שעה')}<div class="row"><label>עמעום אחרי</label><div class="v">${seg([['15', '15 דק׳'], ['30', '30 דק׳'], ['off', 'ללא']], '30')}ל-60%</div></div></div>
      <div class="sect"><h3>בניתוק</h3><div class="row"><label>פריים אחרון</label><div class="v">${seg([['30', '30 שנ׳'], ['60', 'דקה'], ['0', 'לא להציג']], '60')}<span class="note">מעומעם, עם שעת הפריים</span></div></div><div class="row"><label>אחרי 2 דקות</label><div class="v">${seg([['clock', 'מסך שעון'], ['names', 'שמות מצלמות']], 'clock')}</div></div></div>`;
    // main
    return `<div class="sect"><h3>משתמש</h3><div class="row"><label>משתמש</label><div class="v"><b class="ltr">${d.id}</b><span class="mini">קיוסק · מפה ווידאו חי</span></div></div><div class="row"><label>שם המסך</label><input class="in" value="${d.name}"></div><div class="row"><label>מקום</label><div class="v"><select class="in" style="max-width:260px"><option>${d.area}</option>${AREAS.flatMap((f) => f.areas.map((a) => `<option>${a[0]}</option>`)).join('')}</select></div></div><div class="row"><label>ערכה</label><div class="v">${seg([['dark', 'כהה'], ['light', 'בהירה'], ['follow', 'כמו המערכת']], 'dark')}</div></div>${tog(d.status !== 'paused', 'מצב מסך קיר', 'כבוי = המשתמש רואה את המערכת הרגילה')}${tog(d.remote, 'כניסה מרחוק', 'כבוי = רק מהרשת המקומית')}<div class="msg" data-tone="ok">${ic('tv')}נפתח לבד כשהמשתמש מתחבר מטאבלט · בטלפון ובמחשב רואים את המערכת הרגילה · <a href="detect.html" style="color:inherit">איך זה מזוהה</a></div></div>
      <div class="sect"><h3>מצלמות</h3><div class="picker"><div class="tree">${AREAS.map((f) => `<div class="fl">${ic('chevron')}${f.floor}</div>${f.areas.map((a) => `<div class="ar${a[0] === d.area ? ' on' : ''}"><span>${a[0]}</span><span class="mini">${a[1].length}</span></div>`).join('')}`).join('')}</div><div class="cams">${CAMS.map((c) => { const i = d.cams.indexOf(c.id); return `<div class="cam${i >= 0 ? ' on' : ''}"><span class="thumb" style="--scene:${c.scene}"></span><span class="nm">${c.name}</span>${i >= 0 ? `<span class="ord">${i + 1}</span>${ic('drag', 'drag')}` : ''}</div>`; }).join('')}</div></div><div class="note">${d.cams.length} מצלמות נבחרו · הסדר הוא סדר האריחים · זרם משני${d.cams.length > 6 ? ' · <span style="color:var(--sw-stale-text)">מעל 6 זרמים - בדוק שהמקליט עומד בעומס</span>' : ''}</div></div>
      <div class="sect"><h3>פריסה</h3><div class="row"><label>תבנית</label><div class="v">${seg([['auto', 'אוטומטי'], ['tablet-landscape', 'לרוחב'], ['tablet-portrait', 'לאורך'], ['single', 'אחת']], 'auto')}</div></div><div class="row"><label>רשת</label><div class="v">${seg([['auto', 'אוטומטי'], ['2x2', '2×2'], ['3x2', '3×2'], ['3x3', '3×3']], 'auto')}<span class="note">עכשיו: ${c}×${r}</span></div></div><div class="row"><label>דפדוף</label><div class="v">${seg([['0', 'ללא'], ['15', '15 שנ׳'], ['30', '30 שנ׳'], ['60', 'דקה']], d.cams.length > c * r ? '30' : '0')}</div></div><div class="row"><label>שורת מצב</label><div class="chips">${[['clock', 'שעון', true], ['date', 'תאריך', true], ['weather', 'מזג אוויר', true], ['health', 'בריאות', true], ['alarm', 'אזעקה', true], ['energy', 'צריכה', false]].map(([k, t, on]) => `<button class="chk${on ? ' on' : ''}">${on ? ic('check') : ''}${t}</button>`).join('')}</div></div>${d.preset === 'tablet-portrait' ? tog(true, 'רצועת מפה', 'במצב לאורך בלבד') : ''}<div class="row"><label>תצוגה מקדימה</label><div class="preview"><div class="frame" data-p="${d.preset}" style="--c:${c};--r:${r}"><div class="s"></div><div class="g">${Array.from({ length: c * r }, (_, i) => `<i class="${i === 0 && d.alerts ? 'a' : ''}"></i>`).join('')}</div></div><span class="note">${PRESET_HE[d.preset]} · התא הראשון מתחלף באריח התראה</span></div></div></div>`;
  }

  /* ---------- boot ---------- */
  window.WallMock = { renderWall, renderLogin, renderApp, renderSettings, WALL_STATES, LOGIN_STEPS, SET_VIEWS, CAMS, DEVICES };
  const page = document.body.dataset.page;
  if (page === 'wall') renderWall(); else if (page === 'login') renderLogin(); else if (page === 'app') renderApp(); else if (page === 'settings') renderSettings();
})();

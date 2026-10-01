/**
 * Video connection test (הגדרות › גישה מרחוק › בדיקת חיבור וידאו): what the WebRTC stack of THIS browser does when it
 * talks to the live relay - without rendering a player. Owner problem 2026-10-01: a desktop browser outside the site
 * plays every camera, an Android phone (VPN + 4G) does not, and nobody can see why.
 *
 * Two layers:
 *  - pure functions (no browser globals, no imports): address classification, candidate parsing, statistics readers,
 *    the verdict and the plain-text report. Unit-tested in Node (tests/unit-video-conn-test.spec.ts);
 *  - `runConnProbe`: one run against the relay's WebSocket (the wire format of components/sw-live-player.ts:
 *    `webrtc/offer` → `webrtc/answer`, trickle `webrtc/candidate` both ways) with a plain RTCPeerConnection.
 *
 * Privacy: the report carries address CLASSES only (private / cgnat / public / ipv6 / mdns), never an address, a
 * token, a cookie or a URL. Free text from the network (relay error codes, ICE error texts) goes through `scrub`.
 */

export type Profile = 'main' | 'sub';
export type AddrClass = 'private' | 'cgnat' | 'public' | 'ipv6' | 'mdns' | 'unknown';
export type CandType = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown';
export type CandProtocol = 'udp' | 'tcp' | 'unknown';

/** The same ICE servers the live player uses (components/sw-live-player.ts imports this constant). */
export const LIVE_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** Longest a single run listens. */
export const PROBE_MAX_MS = 20000;
/** After the first decoded frame the run keeps sampling this long (to show a rate), then ends. */
export const PROBE_AFTER_FRAME_MS = 3000;
const POLL_MS = 500;
const SAMPLE_EVERY_MS = 1000;

// ---------------------------------------------------------------- classification

function ipv4Octets(addr: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}

/** The class of an address: private (RFC 1918, loopback, link-local), cgnat (100.64.0.0/10: carrier NAT, Tailscale),
 * public, ipv6, mdns (a `.local` host name a browser uses instead of its LAN address) or unknown. */
export function classifyAddress(address: string | null | undefined): AddrClass {
  let a = (address ?? '').trim().toLowerCase();
  if (!a) return 'unknown';
  if (a.endsWith('.local')) return 'mdns';
  a = a.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (a.includes(':')) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a); // IPv4-mapped: the IPv4 address decides
    return mapped ? classifyAddress(mapped[1]) : 'ipv6';
  }
  const o = ipv4Octets(a);
  if (!o) return 'unknown';
  const [a0, a1] = o;
  if (a0 === 10 || a0 === 127) return 'private';
  if (a0 === 172 && a1 >= 16 && a1 <= 31) return 'private';
  if (a0 === 192 && a1 === 168) return 'private';
  if (a0 === 169 && a1 === 254) return 'private';
  if (a0 === 100 && a1 >= 64 && a1 <= 127) return 'cgnat';
  if (a0 === 0 || a0 >= 224) return 'unknown';
  return 'public';
}

export interface ParsedCandidate {
  type: CandType;
  protocol: CandProtocol;
  cls: AddrClass;
  component: number;
}

/** One ICE candidate line (`candidate:… typ host …`, with or without the `a=` prefix) as type / protocol / address CLASS. */
export function parseCandidate(line: string): ParsedCandidate | null {
  const t = line.trim().replace(/^a=/, '').replace(/^candidate:/, '').split(/\s+/);
  // foundation component protocol priority address port typ <type> …
  if (t.length < 8 || t[6] !== 'typ') return null;
  const proto = t[2].toLowerCase();
  const type = t[7].toLowerCase();
  return {
    type: type === 'host' || type === 'srflx' || type === 'prflx' || type === 'relay' ? type : 'unknown',
    protocol: proto === 'udp' || proto === 'tcp' ? proto : 'unknown',
    cls: classifyAddress(t[4]),
    component: Number(t[1]) || 1,
  };
}

/** The candidate lines inside an SDP (go2rtc puts its candidates in the answer as well as trickling them). */
export function candidatesFromSdp(sdp: string): string[] {
  return sdp
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('a=candidate:'));
}

// ---------------------------------------------------------------- user agent

export interface UaInfo {
  /** `Chrome 129`, `Safari 17`, … - the major version only */
  browser: string;
  os: string;
  mobile: boolean;
}

/** Browser family + major version, operating system and phone/desktop from a user-agent string (never the full string). */
export function uaFamily(ua: string): UaInfo {
  const major = (re: RegExp) => re.exec(ua)?.[1]?.split('.')[0] ?? '';
  let browser = 'Unknown';
  let v = '';
  if (/Edg(A|iOS)?\//.test(ua)) (browser = 'Edge'), (v = major(/Edg(?:A|iOS)?\/([\d.]+)/));
  else if (/SamsungBrowser\//.test(ua)) (browser = 'Samsung Internet'), (v = major(/SamsungBrowser\/([\d.]+)/));
  else if (/OPR\//.test(ua)) (browser = 'Opera'), (v = major(/OPR\/([\d.]+)/));
  else if (/Firefox\/|FxiOS\//.test(ua)) (browser = 'Firefox'), (v = major(/(?:Firefox|FxiOS)\/([\d.]+)/));
  else if (/CriOS\//.test(ua)) (browser = 'Chrome (iOS)'), (v = major(/CriOS\/([\d.]+)/));
  else if (/Chrome\//.test(ua)) (browser = 'Chrome'), (v = major(/Chrome\/([\d.]+)/));
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) (browser = 'Safari'), (v = major(/Version\/([\d.]+)/));
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  const mobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  return { browser: v ? `${browser} ${v}` : browser, os, mobile };
}

// ---------------------------------------------------------------- scrubbing

const IPV4_RE = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6_RE = /(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}/gi;
const HOST_RE = /\b[\w-]+(?:\.[\w-]+)*\.(?:local|lan|internal|test)\b/gi;
const TOKEN_RE = /\b[A-Za-z0-9_-]{24,}\b/g;

/** Free text that came from the network or the browser, with anything address- or token-shaped removed. */
export function scrub(text: string): string {
  return String(text ?? '')
    .replace(IPV4_RE, '<addr>')
    .replace(IPV6_RE, (m) => (/\d|[a-f]{2}/i.test(m) ? '<addr>' : m))
    .replace(HOST_RE, '<host>')
    .replace(TOKEN_RE, '<token>')
    .slice(0, 160);
}

// ---------------------------------------------------------------- statistics readers

export type StatsRec = Record<string, unknown> & { type?: string; id?: string };

/** An RTCStatsReport (or any Map-like with forEach) as a plain list. */
export function statsList(report: { forEach: (cb: (v: unknown) => void) => void } | null | undefined): StatsRec[] {
  const out: StatsRec[] = [];
  report?.forEach((v) => {
    if (v && typeof v === 'object') out.push(v as StatsRec);
  });
  return out;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export interface VideoSample {
  /** ms since the run started */
  at: number;
  bytes: number;
  packets: number | null;
  packetsLost: number | null;
  /** null: the browser does not report framesDecoded */
  frames: number | null;
  width: number | null;
  height: number | null;
  pli: number | null;
  nack: number | null;
  codec: string;
  audioBytes: number | null;
}

/** The inbound video (and audio byte count) statistics at one instant. */
export function readVideoSample(list: StatsRec[], at: number): VideoSample {
  const inbound = list.filter((r) => r.type === 'inbound-rtp');
  const video = inbound.find((r) => (str(r.kind) || str(r.mediaType)) === 'video');
  const audio = inbound.find((r) => (str(r.kind) || str(r.mediaType)) === 'audio');
  const codecRec = video ? list.find((r) => r.type === 'codec' && r.id === video.codecId) : undefined;
  return {
    at,
    bytes: num(video?.bytesReceived) ?? 0,
    packets: num(video?.packetsReceived),
    packetsLost: num(video?.packetsLost),
    frames: num(video?.framesDecoded),
    width: num(video?.frameWidth),
    height: num(video?.frameHeight),
    pli: num(video?.pliCount),
    nack: num(video?.nackCount),
    codec: str(codecRec?.mimeType),
    audioBytes: audio ? (num(audio.bytesReceived) ?? 0) : null,
  };
}

export interface PairSide {
  type: CandType;
  protocol: CandProtocol;
  cls: AddrClass;
  /** local side only: `cellular`, `wifi`, `vpn`, `ethernet` … when the browser says */
  networkType: string;
}

export interface PairInfo {
  local: PairSide;
  remote: PairSide;
  /** how the relay was reached when the local side is a relay candidate */
  relayProtocol: string;
  rttMs: number | null;
}

const candType = (v: unknown): CandType => (v === 'host' || v === 'srflx' || v === 'prflx' || v === 'relay' ? v : 'unknown');
const candProto = (v: unknown): CandProtocol => (v === 'udp' || v === 'tcp' ? v : 'unknown');

function side(rec: StatsRec | undefined): PairSide {
  return {
    type: candType(rec?.candidateType),
    protocol: candProto(str(rec?.protocol).toLowerCase()),
    cls: classifyAddress(str(rec?.address) || str(rec?.ip)),
    networkType: str(rec?.networkType),
  };
}

/** The nominated / selected candidate pair, or null while none is. */
export function selectedPairOf(list: StatsRec[]): PairInfo | null {
  const transport = list.find((r) => r.type === 'transport' && str(r.selectedCandidatePairId));
  const pairs = list.filter((r) => r.type === 'candidate-pair');
  const pair =
    (transport ? pairs.find((p) => p.id === transport.selectedCandidatePairId) : undefined) ??
    pairs.find((p) => p.selected === true) ??
    pairs.find((p) => p.nominated === true && p.state === 'succeeded');
  if (!pair) return null;
  const local = list.find((r) => r.type === 'local-candidate' && r.id === pair.localCandidateId);
  const remote = list.find((r) => r.type === 'remote-candidate' && r.id === pair.remoteCandidateId);
  const rtt = num(pair.currentRoundTripTime);
  return { local: side(local), remote: side(remote), relayProtocol: str(local?.relayProtocol), rttMs: rtt == null ? null : Math.round(rtt * 1000) };
}

export interface PairChecks {
  states: Record<string, number>;
  requestsSent: number;
  responsesReceived: number;
}

/** How the connectivity checks went: pairs per state, STUN requests sent and answered (0 answered = the path is dead). */
export function pairChecksOf(list: StatsRec[]): PairChecks {
  const out: PairChecks = { states: {}, requestsSent: 0, responsesReceived: 0 };
  for (const p of list) {
    if (p.type !== 'candidate-pair') continue;
    const s = str(p.state) || 'unknown';
    out.states[s] = (out.states[s] ?? 0) + 1;
    out.requestsSent += num(p.requestsSent) ?? 0;
    out.responsesReceived += num(p.responsesReceived) ?? 0;
  }
  return out;
}

/** The network types the browser's own candidates were gathered on (`cellular`, `wifi`, `vpn`, …), distinct. */
export function localNetworkTypes(list: StatsRec[]): string[] {
  const set = new Set<string>();
  for (const r of list) if (r.type === 'local-candidate' && str(r.networkType)) set.add(str(r.networkType));
  return [...set].sort();
}

// ---------------------------------------------------------------- the report

export type EndReason = 'frame' | 'timeout' | 'ice_failed' | 'refused' | 'ws_closed' | 'ws_failed' | 'aborted' | 'error';

export interface TimelineEntry {
  at: number;
  kind: 'ws' | 'signaling' | 'gathering' | 'ice' | 'conn' | 'track' | 'note';
  value: string;
}

export interface CandidateGroup {
  type: CandType;
  protocol: CandProtocol;
  cls: AddrClass;
  count: number;
}

export interface ProbeEnv {
  browser: string;
  os: string;
  mobile: boolean;
  /** the page is on the remote channel (SmplWise Arx) */
  remote: boolean;
  /** navigator.connection.type / effectiveType when the browser exposes them */
  connectionType: string;
  effectiveType: string;
}

export interface ProbeReport {
  profile: Profile;
  /** the camera's channel number on the NVR (not its name) */
  cameraLabel: string;
  env: ProbeEnv;
  endReason: EndReason;
  durationMs: number;
  ws: { openedAt: number | null; answerAt: number | null; closeCode: number | null; closeAt: number | null; relayError: string };
  /** a refusal by the relay: the live cap (4429 / remote_live_cap), a denial, … */
  refusal: { kind: 'cap' | 'denied' | 'auth'; max: number } | null;
  setupError: string;
  gathering: { state: string; completeAt: number | null };
  localCandidates: CandidateGroup[];
  remoteCandidates: CandidateGroup[];
  iceErrors: Record<string, number>;
  timeline: TimelineEntry[];
  samples: VideoSample[];
  /** the latest sample, recorded or not */
  last: VideoSample | null;
  firstFrameAt: number | null;
  selectedPair: PairInfo | null;
  checks: PairChecks | null;
  networkTypes: string[];
  connectedAt: number | null;
  /** an `ice`/`conn` transition to disconnected or failed after the connection had been up */
  droppedAfterConnect: boolean;
  verdict: string;
}

export function newReport(profile: Profile, cameraLabel: string, env: ProbeEnv): ProbeReport {
  return {
    profile,
    cameraLabel,
    env,
    endReason: 'timeout',
    durationMs: 0,
    ws: { openedAt: null, answerAt: null, closeCode: null, closeAt: null, relayError: '' },
    refusal: null,
    setupError: '',
    gathering: { state: 'new', completeAt: null },
    localCandidates: [],
    remoteCandidates: [],
    iceErrors: {},
    timeline: [],
    samples: [],
    last: null,
    firstFrameAt: null,
    selectedPair: null,
    checks: null,
    networkTypes: [],
    connectedAt: null,
    droppedAfterConnect: false,
    verdict: '',
  };
}

/** Counts one candidate into its (type, protocol, class) group. */
export function addCandidate(groups: CandidateGroup[], c: Pick<ParsedCandidate, 'type' | 'protocol' | 'cls'>): void {
  const g = groups.find((x) => x.type === c.type && x.protocol === c.protocol && x.cls === c.cls);
  if (g) g.count += 1;
  else groups.push({ type: c.type, protocol: c.protocol, cls: c.cls, count: 1 });
}

export const countOfType = (groups: CandidateGroup[], type: CandType): number => groups.filter((g) => g.type === type).reduce((n, g) => n + g.count, 0);
export const hasIpv6 = (groups: CandidateGroup[]): boolean => groups.some((g) => g.cls === 'ipv6');

/** Whether the peer connection reached `connected` at any point. */
export const everConnected = (r: ProbeReport): boolean => r.connectedAt != null || r.timeline.some((e) => (e.kind === 'conn' && e.value === 'connected') || (e.kind === 'ice' && (e.value === 'connected' || e.value === 'completed')));

export const liveCapText = (max: number): string => `הגעת למכסת הזרמים החיים בחיבור הזה${max > 0 ? ` (${max})` : ''} - הבדיקה לא רצה`;

/** The one-line verdict (Hebrew) of a finished (or running) run. */
export function verdictOf(r: ProbeReport): string {
  if (r.refusal?.kind === 'cap') return liveCapText(r.refusal.max);
  if (r.refusal?.kind === 'denied') return 'אין הרשאת צפייה במצלמה הזו - הבדיקה לא רצה';
  if (r.refusal?.kind === 'auth') return 'נדרשת הזדהות מחדש - הבדיקה לא רצה';
  if (r.setupError) return `WebRTC לא זמין בדפדפן הזה (${r.setupError})`;
  const last = r.last;
  const frames = last?.frames ?? null;
  const bytes = last?.bytes ?? 0;
  if (r.firstFrameAt != null || (frames != null && frames > 0)) return 'מחובר ומנגן';
  if (r.endReason === 'aborted') return 'הבדיקה הופסקה';
  if (r.ws.openedAt == null) return 'לא ניתן לפתוח את חיבור השידור לשרת (WebSocket) - רשת, הרשאה או שרת הווידאו';
  if (r.ws.relayError === 'upstream_unavailable') return 'שרת הווידאו (go2rtc) אינו זמין';
  if (r.ws.relayError === 'access_lost') return 'ההרשאה לצפייה במצלמה הזו הוסרה';
  if (r.ws.answerAt == null) return r.ws.relayError ? `שרת הווידאו סירב להצעה (${r.ws.relayError})` : 'שרת הווידאו לא החזיר תשובה להצעת ה־WebRTC (הזרם לא זמין)';
  if (everConnected(r)) {
    if (bytes > 0 && frames == null) return 'מחובר והווידאו מגיע (הדפדפן לא מדווח על פענוח)';
    if (bytes > 0) return 'מחובר אך אין פענוח - קודק או פרופיל שהדפדפן לא מפענח';
    if (r.droppedAfterConnect) return 'החיבור נותק אחרי שהתחבר, לפני שהגיע וידאו';
    return 'מחובר אך לא מגיע וידאו (RTP) - הזרם ריק או חסום בנתיב';
  }
  if (r.remoteCandidates.length === 0) return 'go2rtc לא שלח מועמדי ICE - בעיה בצד השרת';
  if (countOfType(r.localCandidates, 'srflx') + countOfType(r.localCandidates, 'relay') === 0) return 'לא נאסף מועמד ציבורי בדפדפן - STUN חסום ברשת הזו, ייתכן שה־UDP כולו חסום';
  return 'ICE לא התחבר - כנראה UDP חסום ברשת הזו';
}

// ---------------------------------------------------------------- the text report

const groupText = (g: CandidateGroup) => `${g.type} ${g.protocol} ${g.cls}${g.count > 1 ? ` x${g.count}` : ''}`;
const ms = (n: number | null) => (n == null ? '-' : `${n} ms`);

function sideText(s: PairSide): string {
  return `${s.type} ${s.protocol} ${s.cls}${s.networkType ? ` (${s.networkType})` : ''}`;
}

/** The header lines of a report (once per copy): browser, channel, network. */
export function formatHeader(env: ProbeEnv): string[] {
  return [
    'SmplWise video connection test',
    `browser: ${env.browser} / ${env.os}${env.mobile ? ' (mobile)' : ''}`,
    `channel: ${env.remote ? 'remote (Arx)' : 'local (Ingress)'}`,
    `navigator.connection: type=${env.connectionType || '-'} effective=${env.effectiveType || '-'}`,
  ];
}

/** One profile's section. Plain text; every value is a number, a type name, an address class or a scrubbed code. */
export function formatSection(r: ProbeReport): string[] {
  const out: string[] = [];
  out.push(`=== ${r.cameraLabel} / ${r.profile} ===`);
  out.push(`verdict: ${r.verdict || verdictOf(r)}`);
  out.push(`ended: ${r.endReason} after ${r.durationMs} ms`);
  out.push(`signalling: ws open ${ms(r.ws.openedAt)}, answer ${ms(r.ws.answerAt)}${r.ws.closeCode != null ? `, ws closed code ${r.ws.closeCode} at ${ms(r.ws.closeAt)}` : ''}${r.ws.relayError ? `, relay error ${scrub(r.ws.relayError)}` : ''}`);
  if (r.refusal) out.push(`refused: ${r.refusal.kind}${r.refusal.max > 0 ? ` (max ${r.refusal.max})` : ''}`);
  if (r.setupError) out.push(`setup error: ${scrub(r.setupError)}`);
  const lc = r.localCandidates;
  out.push(`local ICE: gathering ${r.gathering.state}${r.gathering.completeAt != null ? ` (complete at ${r.gathering.completeAt} ms)` : ''}`);
  out.push(`local candidates: host ${countOfType(lc, 'host')}, srflx ${countOfType(lc, 'srflx')}, prflx ${countOfType(lc, 'prflx')}, relay ${countOfType(lc, 'relay')}; ipv6: ${hasIpv6(lc) ? 'yes' : 'no'}`);
  if (lc.length) out.push(`  ${lc.map(groupText).join('; ')}`);
  if (r.networkTypes.length) out.push(`local networks: ${r.networkTypes.join(', ')}`);
  const errs = Object.entries(r.iceErrors);
  if (errs.length) out.push(`ICE gathering errors: ${errs.map(([k, n]) => `${scrub(k)} x${n}`).join('; ')}`);
  out.push(`remote candidates (from go2rtc): ${r.remoteCandidates.reduce((n, g) => n + g.count, 0)}`);
  for (const g of r.remoteCandidates) out.push(`  ${groupText(g)}`);
  if (r.selectedPair) {
    const p = r.selectedPair;
    out.push(`selected pair: ${sideText(p.local)} <-> ${sideText(p.remote)}${p.relayProtocol ? `; relay via ${p.relayProtocol}` : ''}${p.rttMs != null ? `; rtt ${p.rttMs} ms` : ''}`);
  } else out.push('selected pair: none');
  if (r.checks) out.push(`connectivity checks: pairs ${Object.entries(r.checks.states).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; STUN requests sent ${r.checks.requestsSent}, answered ${r.checks.responsesReceived}`);
  out.push('timeline:');
  for (const e of r.timeline) out.push(`  ${String(e.at).padStart(6)} ms  ${e.kind}: ${scrub(e.value)}`);
  out.push('inbound video (about once a second):');
  if (!r.samples.length) out.push('  no statistics');
  for (const s of r.samples) {
    const size = s.width && s.height ? `${s.width}x${s.height}` : '-';
    out.push(`  ${String(s.at).padStart(6)} ms  bytes ${s.bytes}  packets ${s.packets ?? '-'}  lost ${s.packetsLost ?? '-'}  frames ${s.frames ?? 'n/a'}  size ${size}  pli ${s.pli ?? '-'}  nack ${s.nack ?? '-'}  codec ${scrub(s.codec) || '-'}${s.audioBytes != null ? `  audio bytes ${s.audioBytes}` : ''}`);
  }
  out.push(`first frame: ${r.firstFrameAt != null ? `${r.firstFrameAt} ms` : 'none'}`);
  return out;
}

/** The text of a whole run (one or both profiles): what "העתק דוח" puts on the clipboard. */
export function formatReports(reports: ProbeReport[]): string {
  if (!reports.length) return '';
  const lines = formatHeader(reports[0].env);
  for (const r of reports) lines.push('', ...formatSection(r));
  return lines.join('\n');
}

// ---------------------------------------------------------------- the run

export interface ProbeOptions {
  /** ws(s):// URL of `media/live/<camera>/ws?profile=…` (api/media.ts `liveWsUrl`: the remote channel prefix is in it) */
  wsUrl: string;
  profile: Profile;
  cameraLabel: string;
  env: ProbeEnv;
  iceServers?: RTCIceServer[];
  maxMs?: number;
  /** called after every change of the report (the card re-renders from it) */
  onUpdate?: (r: ProbeReport) => void;
  /** aborting closes the socket and the peer connection and ends the run (`aborted`) */
  signal?: AbortSignal;
}

/**
 * One run: opens the live relay socket and a recvonly RTCPeerConnection (video + audio), exchanges offer / answer /
 * trickle candidates like the player, and records what happens for up to `maxMs`. Always closes both before it
 * resolves. Never rejects: failures are part of the report.
 */
export function runConnProbe(o: ProbeOptions): Promise<ProbeReport> {
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  const r = newReport(o.profile, o.cameraLabel, o.env);
  const emit = () => o.onUpdate?.(r);
  const note = (kind: TimelineEntry['kind'], value: string) => {
    r.timeline.push({ at: at(), kind, value });
    emit();
  };
  const seenRemote = new Set<string>();
  const addRemote = (line: string) => {
    const key = line.replace(/^a=/, '');
    if (seenRemote.has(key)) return;
    seenRemote.add(key);
    const c = parseCandidate(line);
    if (c) addCandidate(r.remoteCandidates, c);
  };

  return new Promise<ProbeReport>((resolve) => {
    let ws: WebSocket | null = null;
    let pc: RTCPeerConnection | null = null;
    let done = false;
    let pollTimer = 0;
    let limitTimer = 0;
    let lastRecordedAt = -SAMPLE_EVERY_MS;
    let polling = false;
    let endTimer = 0;

    const collect = async () => {
      if (!pc || polling) return;
      polling = true;
      try {
        const list = statsList(await pc.getStats());
        const now = at();
        const s = readVideoSample(list, now);
        r.last = s;
        if (r.firstFrameAt == null && s.frames != null && s.frames > 0) {
          r.firstFrameAt = now;
          note('track', `first frame decoded (${s.width ?? '?'}x${s.height ?? '?'})`);
          if (!endTimer && !done) endTimer = window.setTimeout(() => void finish('frame'), PROBE_AFTER_FRAME_MS);
        }
        if (now - lastRecordedAt >= SAMPLE_EVERY_MS || (r.firstFrameAt === now && r.samples[r.samples.length - 1]?.at !== now)) {
          r.samples.push(s);
          lastRecordedAt = now;
        }
        r.selectedPair = selectedPairOf(list) ?? r.selectedPair;
        r.checks = pairChecksOf(list);
        r.networkTypes = localNetworkTypes(list);
      } catch {
        /* no statistics in this browser: the report says "no statistics" */
      } finally {
        polling = false;
      }
      emit();
    };

    const finish = async (reason: EndReason) => {
      if (done) return;
      done = true;
      r.endReason = reason;
      window.clearInterval(pollTimer);
      window.clearTimeout(limitTimer);
      window.clearTimeout(endTimer);
      o.signal?.removeEventListener('abort', onAbort);
      polling = false;
      // one last read of the statistics (selected pair, checks, networks) before the connection goes
      await Promise.race([collect(), new Promise((res) => window.setTimeout(res, 800))]);
      r.durationMs = at();
      try {
        if (pc) pc.onicegatheringstatechange = pc.oniceconnectionstatechange = pc.onconnectionstatechange = pc.onsignalingstatechange = pc.ontrack = pc.onicecandidate = pc.onicecandidateerror = null;
        pc?.close();
      } catch {
        /* already closed */
      }
      pc = null;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        try {
          ws.close();
        } catch {
          /* already closed */
        }
        ws = null;
      }
      r.verdict = verdictOf(r);
      emit();
      resolve(r);
    };

    const onAbort = () => void finish('aborted');
    if (o.signal?.aborted) {
      r.endReason = 'aborted';
      r.verdict = verdictOf(r);
      resolve(r);
      return;
    }
    o.signal?.addEventListener('abort', onAbort);
    limitTimer = window.setTimeout(() => void finish('timeout'), o.maxMs ?? PROBE_MAX_MS);

    const refuse = (kind: 'cap' | 'denied' | 'auth', max = 0) => {
      r.refusal = { kind, max: max > 0 ? max : 0 };
      note('note', `refused: ${kind}`);
      void finish('refused');
    };

    const startPeer = async () => {
      if (typeof RTCPeerConnection === 'undefined') {
        r.setupError = 'RTCPeerConnection';
        void finish('error');
        return;
      }
      try {
        const peer = new RTCPeerConnection({ iceServers: o.iceServers ?? LIVE_ICE_SERVERS });
        pc = peer;
        r.gathering.state = peer.iceGatheringState;
        peer.onicegatheringstatechange = () => {
          r.gathering.state = peer.iceGatheringState;
          if (peer.iceGatheringState === 'complete') r.gathering.completeAt = at();
          note('gathering', peer.iceGatheringState);
        };
        peer.oniceconnectionstatechange = () => {
          const s = peer.iceConnectionState;
          if (r.connectedAt != null && (s === 'disconnected' || s === 'failed')) r.droppedAfterConnect = true;
          note('ice', s);
        };
        peer.onconnectionstatechange = () => {
          const s = peer.connectionState;
          if (s === 'connected' && r.connectedAt == null) r.connectedAt = at();
          if (r.connectedAt != null && (s === 'disconnected' || s === 'failed')) r.droppedAfterConnect = true;
          note('conn', s);
          if (s === 'failed') void finish('ice_failed');
        };
        peer.onsignalingstatechange = () => note('signaling', peer.signalingState);
        peer.ontrack = (ev) => note('track', `${ev.track?.kind ?? '?'} track`);
        peer.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          const c = parseCandidate(ev.candidate.candidate);
          if (c) addCandidate(r.localCandidates, c);
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'webrtc/candidate', value: ev.candidate.candidate }));
          emit();
        };
        peer.onicecandidateerror = (ev) => {
          const e = ev as RTCPeerConnectionIceErrorEvent;
          const key = `${e.errorCode ?? '?'} ${scrub(e.errorText ?? '')}`.trim();
          r.iceErrors[key] = (r.iceErrors[key] ?? 0) + 1;
          emit();
        };
        peer.addTransceiver('video', { direction: 'recvonly' });
        peer.addTransceiver('audio', { direction: 'recvonly' });
        const offer = await peer.createOffer();
        if (done) return;
        await peer.setLocalDescription(offer);
        if (done) return;
        ws?.send(JSON.stringify({ type: 'webrtc/offer', value: offer.sdp }));
        note('note', 'offer sent');
        pollTimer = window.setInterval(() => void collect(), POLL_MS);
      } catch (err) {
        if (done) return;
        r.setupError = scrub((err as Error)?.name || 'error');
        void finish('error');
      }
    };

    const onSignal = (text: string) => {
      let msg: { type?: string; value?: string; max?: number };
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.type === 'error') {
        if (msg.value === 'remote_live_cap') return refuse('cap', Number(msg.max) || 0);
        r.ws.relayError = scrub(msg.value ?? 'error');
        note('ws', `relay error ${r.ws.relayError}`);
        if (msg.value === 'access_lost') refuse('denied');
        return;
      }
      if (msg.type === 'webrtc/answer') {
        r.ws.answerAt = at();
        const sdp = msg.value ?? '';
        candidatesFromSdp(sdp).forEach(addRemote);
        note('ws', 'answer received');
        void pc?.setRemoteDescription({ type: 'answer', sdp }).catch((err) => {
          r.setupError = `setRemoteDescription ${scrub((err as Error)?.name || '')}`.trim();
          void finish('error');
        });
        return;
      }
      if (msg.type === 'webrtc/candidate') {
        const line = msg.value ?? '';
        addRemote(line);
        emit();
        void pc?.addIceCandidate({ candidate: line, sdpMid: '0' }).catch(() => undefined);
      }
    };

    try {
      ws = new WebSocket(o.wsUrl);
    } catch {
      r.setupError = 'WebSocket';
      void finish('ws_failed');
      return;
    }
    ws.onopen = () => {
      r.ws.openedAt = at();
      note('ws', 'open');
      void startPeer();
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') onSignal(ev.data);
    };
    ws.onerror = () => {
      /* `close` follows and carries the code */
    };
    ws.onclose = (ev) => {
      r.ws.closeCode = ev.code;
      r.ws.closeAt = at();
      note('ws', `closed code ${ev.code}`);
      if (done) return;
      if (ev.code === 4429) return refuse('cap', r.refusal?.max ?? 0);
      if (ev.code === 4403) return refuse('denied');
      if (ev.code === 4401) return refuse('auth');
      void finish(r.ws.openedAt == null ? 'ws_failed' : 'ws_closed');
    };
  });
}

/** What the browser says about its connection (Chrome on Android: cellular / wifi), without anything identifying. */
export function connectionEnv(nav: { connection?: { type?: string; effectiveType?: string } } = navigator as never): { connectionType: string; effectiveType: string } {
  return { connectionType: scrub(nav.connection?.type ?? ''), effectiveType: scrub(nav.connection?.effectiveType ?? '') };
}

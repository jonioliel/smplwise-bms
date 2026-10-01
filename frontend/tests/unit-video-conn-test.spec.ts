import { test, expect } from '@playwright/test';
import {
  addCandidate,
  candidatesFromSdp,
  classifyAddress,
  formatReports,
  newReport,
  pairChecksOf,
  parseCandidate,
  readVideoSample,
  scrub,
  selectedPairOf,
  uaFamily,
  verdictOf,
  type ProbeEnv,
  type ProbeReport,
  type StatsRec,
} from '../src/api/video-conn-test';

// Owner 2026-10-01 (a phone on VPN + 4G does not play live video that a desktop plays): the pure parts of the video
// connection test - address classes, candidate parsing, the verdict table and the text report, which must never carry
// an address. Node only.

const ENV: ProbeEnv = { browser: 'Chrome 129', os: 'Android', mobile: true, remote: true, connectionType: 'cellular', effectiveType: '4g' };
const report = (patch: (r: ProbeReport) => void): ProbeReport => {
  const r = newReport('sub', 'camera channel 2', ENV);
  patch(r);
  return r;
};
const cand = (r: ProbeReport, which: 'localCandidates' | 'remoteCandidates', line: string) => {
  const c = parseCandidate(line);
  if (!c) throw new Error(`unparsable: ${line}`);
  addCandidate(r[which], c);
};
const conn = (r: ProbeReport, ...states: string[]) => {
  let at = 100;
  for (const value of states) r.timeline.push({ at: (at += 40), kind: 'conn', value });
  if (states.includes('connected')) r.connectedAt = 140;
};
const sample = (frames: number | null, bytes: number) => ({ at: 4000, bytes, packets: 10, packetsLost: 0, frames, width: null, height: null, pli: 0, nack: 0, codec: '', audioBytes: 0 });

test('address classes: private, cgnat (carrier NAT / Tailscale), public, ipv6, mdns', () => {
  const table: [string, string][] = [
    ['192.168.1.20', 'private'],
    ['10.8.0.2', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.1', 'private'],
    ['172.32.0.1', 'public'],
    ['172.15.0.1', 'public'],
    ['169.254.10.1', 'private'],
    ['127.0.0.1', 'private'],
    ['100.64.0.1', 'cgnat'],
    ['100.101.102.103', 'cgnat'],
    ['100.127.255.255', 'cgnat'],
    ['100.128.0.1', 'public'],
    ['100.63.0.1', 'public'],
    ['8.8.8.8', 'public'],
    ['203.0.113.5', 'public'],
    ['2001:db8::1', 'ipv6'],
    ['fe80::1%wlan0', 'ipv6'],
    ['[2a00:1450::5]', 'ipv6'],
    ['::ffff:192.168.0.9', 'private'],
    ['::ffff:8.8.4.4', 'public'],
    ['3f2c0a1e-aaaa-4bbb-8ccc-0123456789ab.local', 'mdns'],
    ['', 'unknown'],
    ['not-an-address', 'unknown'],
    ['999.1.1.1', 'unknown'],
    ['0.0.0.0', 'unknown'],
    ['239.1.1.1', 'unknown'],
  ];
  for (const [addr, cls] of table) expect(classifyAddress(addr), addr).toBe(cls);
  expect(classifyAddress(null)).toBe('unknown');
});

test('candidate lines parse to type, protocol and address class', () => {
  expect(parseCandidate('candidate:1 1 udp 2130706431 192.168.1.20 50000 typ host')).toEqual({ type: 'host', protocol: 'udp', cls: 'private', component: 1 });
  expect(parseCandidate('a=candidate:2 1 UDP 1694498815 203.0.113.5 50000 typ srflx raddr 192.168.1.20 rport 50000')).toEqual({ type: 'srflx', protocol: 'udp', cls: 'public', component: 1 });
  expect(parseCandidate('candidate:3 1 tcp 1518280447 100.90.1.2 9 typ host tcptype passive')).toEqual({ type: 'host', protocol: 'tcp', cls: 'cgnat', component: 1 });
  expect(parseCandidate('candidate:4 1 udp 2113937151 2001:db8::7 50000 typ host')?.cls).toBe('ipv6');
  expect(parseCandidate('candidate:5 1 udp 2113937151 aaaa-bbbb.local 50000 typ host')?.cls).toBe('mdns');
  expect(parseCandidate('candidate:6 1 udp 41885439 203.0.113.9 3478 typ relay raddr 0.0.0.0 rport 0')?.type).toBe('relay');
  expect(parseCandidate('')).toBeNull();
  expect(parseCandidate('candidate:1 1 udp 1 1.2.3.4 5')).toBeNull();
});

test('candidates are read out of an answer SDP', () => {
  const sdp = ['v=0', 'm=video 9 UDP/TLS/RTP/SAVPF 96', 'a=candidate:1 1 udp 2130706431 192.168.1.5 8555 typ host', 'a=rtpmap:96 H264/90000', 'a=candidate:2 1 udp 1694498815 203.0.113.1 8555 typ srflx raddr 0.0.0.0 rport 8555', ''].join('\r\n');
  const lines = candidatesFromSdp(sdp);
  expect(lines).toHaveLength(2);
  expect(lines.map((l) => parseCandidate(l)?.type)).toEqual(['host', 'srflx']);
});

test('user agent family: browser + major version, OS, phone', () => {
  const phone = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36';
  expect(uaFamily(phone)).toEqual({ browser: 'Chrome 129', os: 'Android', mobile: true });
  const desk = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  expect(uaFamily(desk)).toEqual({ browser: 'Chrome 130', os: 'Windows', mobile: false });
  expect(uaFamily('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.1').browser).toBe('Edge 130');
  expect(uaFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toEqual({ browser: 'Safari 17', os: 'iOS', mobile: true });
  expect(uaFamily('Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0').browser).toBe('Firefox 131');
  expect(uaFamily('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36').browser).toBe('Samsung Internet 25');
  expect(uaFamily('curl/8').browser).toBe('Unknown');
  // never the full version string
  expect(uaFamily(phone).browser).not.toContain('6668');
});

test('scrub removes addresses, host names and token-shaped strings from free text', () => {
  expect(scrub('STUN host lookup failed 192.168.1.20:5000')).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  expect(scrub('bad 2001:db8:85a3::8a2e:370:7334 here')).not.toContain('2001');
  expect(scrub('cannot reach nvr.lan or cam.local')).not.toMatch(/\.(lan|local)/);
  expect(scrub('Bearer abcdefghijklmnopqrstuvwxyz0123456789')).toContain('<token>');
  expect(scrub('remote_live_cap')).toBe('remote_live_cap');
  expect(scrub('ws: closed code 1006')).toBe('ws: closed code 1006');
});

test('statistics readers: inbound video, selected pair, check counters', () => {
  const list: StatsRec[] = [
    { type: 'inbound-rtp', id: 'v', kind: 'video', bytesReceived: 5000, packetsReceived: 12, packetsLost: 1, framesDecoded: 30, frameWidth: 1280, frameHeight: 720, pliCount: 2, nackCount: 3, codecId: 'c1' },
    { type: 'inbound-rtp', id: 'a', kind: 'audio', bytesReceived: 800 },
    { type: 'codec', id: 'c1', mimeType: 'video/H264' },
    { type: 'transport', id: 't', selectedCandidatePairId: 'p1' },
    { type: 'candidate-pair', id: 'p1', state: 'succeeded', nominated: true, localCandidateId: 'l1', remoteCandidateId: 'r1', currentRoundTripTime: 0.042, requestsSent: 5, responsesReceived: 4 },
    { type: 'candidate-pair', id: 'p2', state: 'failed', localCandidateId: 'l2', remoteCandidateId: 'r1', requestsSent: 3, responsesReceived: 0 },
    { type: 'local-candidate', id: 'l1', candidateType: 'srflx', protocol: 'udp', address: '203.0.113.5', networkType: 'cellular' },
    { type: 'local-candidate', id: 'l2', candidateType: 'host', protocol: 'udp', address: 'abcd.local', networkType: 'vpn' },
    { type: 'remote-candidate', id: 'r1', candidateType: 'srflx', protocol: 'udp', ip: '198.51.100.9' },
  ];
  expect(readVideoSample(list, 2000)).toMatchObject({ at: 2000, bytes: 5000, frames: 30, width: 1280, height: 720, pli: 2, codec: 'video/H264', audioBytes: 800 });
  expect(selectedPairOf(list)).toEqual({
    local: { type: 'srflx', protocol: 'udp', cls: 'public', networkType: 'cellular' },
    remote: { type: 'srflx', protocol: 'udp', cls: 'public', networkType: '' },
    relayProtocol: '',
    rttMs: 42,
  });
  expect(pairChecksOf(list)).toEqual({ states: { succeeded: 1, failed: 1 }, requestsSent: 8, responsesReceived: 4 });
  expect(selectedPairOf([])).toBeNull();
  expect(readVideoSample([], 0).frames).toBeNull(); // a browser without the counter is not "0 frames"
});

test.describe('verdict table', () => {
  test('connected and playing', () => {
    const r = report((x) => {
      conn(x, 'connecting', 'connected');
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      x.last = sample(25, 90000);
      x.firstFrameAt = 1200;
    });
    expect(verdictOf(r)).toBe('מחובר ומנגן');
  });

  test('ICE never connected, UDP likely blocked (candidates both ways, nothing public missing)', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      cand(x, 'localCandidates', 'candidate:1 1 udp 1 192.168.1.2 5 typ host');
      cand(x, 'localCandidates', 'candidate:2 1 udp 1 203.0.113.5 5 typ srflx');
      cand(x, 'remoteCandidates', 'candidate:1 1 udp 1 198.51.100.7 8555 typ srflx');
      conn(x, 'connecting', 'failed');
      x.last = sample(null, 0);
    });
    expect(verdictOf(r)).toBe('ICE לא התחבר - כנראה UDP חסום ברשת הזו');
  });

  test('no public local candidate: STUN blocked', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      cand(x, 'localCandidates', 'candidate:1 1 udp 1 192.168.1.2 5 typ host');
      cand(x, 'remoteCandidates', 'candidate:1 1 udp 1 198.51.100.7 8555 typ srflx');
      conn(x, 'connecting', 'failed');
    });
    expect(verdictOf(r)).toContain('STUN חסום');
  });

  test('go2rtc sent no candidates', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      cand(x, 'localCandidates', 'candidate:2 1 udp 1 203.0.113.5 5 typ srflx');
      conn(x, 'connecting', 'failed');
    });
    expect(verdictOf(r)).toContain('go2rtc לא שלח מועמדי ICE');
  });

  test('connected, bytes arrive, nothing decodes: codec', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      conn(x, 'connecting', 'connected');
      x.last = sample(0, 120000);
      x.endReason = 'timeout';
    });
    expect(verdictOf(r)).toBe('מחובר אך אין פענוח - קודק או פרופיל שהדפדפן לא מפענח');
  });

  test('connected, no bytes at all', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      conn(x, 'connecting', 'connected');
      x.last = sample(0, 0);
    });
    expect(verdictOf(r)).toContain('לא מגיע וידאו');
  });

  test('connected then dropped before any media', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      conn(x, 'connected', 'disconnected');
      x.droppedAfterConnect = true;
      x.last = sample(0, 0);
    });
    expect(verdictOf(r)).toContain('נותק אחרי שהתחבר');
  });

  test('connected, bytes, browser without a decode counter', () => {
    const r = report((x) => {
      x.ws.openedAt = 10;
      x.ws.answerAt = 50;
      conn(x, 'connected');
      x.last = sample(null, 5000);
    });
    expect(verdictOf(r)).toContain('הדפדפן לא מדווח על פענוח');
  });

  test('refusals: the live cap (with and without the number), denial, sign-in', () => {
    expect(verdictOf(report((x) => (x.refusal = { kind: 'cap', max: 4 })))).toBe('הגעת למכסת הזרמים החיים בחיבור הזה (4) - הבדיקה לא רצה');
    expect(verdictOf(report((x) => (x.refusal = { kind: 'cap', max: 0 })))).toBe('הגעת למכסת הזרמים החיים בחיבור הזה - הבדיקה לא רצה');
    expect(verdictOf(report((x) => (x.refusal = { kind: 'denied', max: 0 })))).toContain('אין הרשאת צפייה');
    expect(verdictOf(report((x) => (x.refusal = { kind: 'auth', max: 0 })))).toContain('הזדהות');
  });

  test('signalling failures: socket never opened, no answer, relay error, no WebRTC', () => {
    expect(verdictOf(report(() => undefined))).toContain('WebSocket');
    expect(verdictOf(report((x) => (x.ws.openedAt = 10)))).toContain('לא החזיר תשובה');
    expect(verdictOf(report((x) => ((x.ws.openedAt = 10), (x.ws.relayError = 'upstream_unavailable'))))).toContain('go2rtc) אינו זמין');
    expect(verdictOf(report((x) => (x.setupError = 'RTCPeerConnection')))).toContain('WebRTC לא זמין בדפדפן');
    expect(verdictOf(report((x) => (x.endReason = 'aborted')))).toBe('הבדיקה הופסקה');
  });
});

test('the text report carries address classes only: no IPv4, no IPv6, no host name, no token', () => {
  const r = report((x) => {
    x.endReason = 'ice_failed';
    x.durationMs = 12010;
    x.ws.openedAt = 120;
    x.ws.answerAt = 340;
    x.ws.relayError = 'upstream 10.1.2.3 down';
    x.gathering = { state: 'complete', completeAt: 900 };
    for (const line of [
      'candidate:1 1 udp 1 192.168.7.20 5000 typ host',
      'candidate:2 1 udp 1 aaaa-1111-bbbb.local 5000 typ host',
      'candidate:3 1 udp 1 2001:db8:1::5 5000 typ host',
      'candidate:4 1 udp 1 203.0.113.77 5000 typ srflx raddr 192.168.7.20 rport 5000',
      'candidate:5 1 udp 1 100.88.1.1 5000 typ host',
    ])
      cand(x, 'localCandidates', line);
    for (const line of ['candidate:1 1 udp 1 10.0.0.5 8555 typ host', 'candidate:2 1 udp 1 198.51.100.9 8555 typ srflx', 'candidate:3 1 tcp 1 198.51.100.9 8555 typ host tcptype passive']) cand(x, 'remoteCandidates', line);
    x.iceErrors = { '701 STUN host lookup received error from 74.125.250.129:19302': 2 };
    x.timeline.push({ at: 5, kind: 'ws', value: 'open' }, { at: 400, kind: 'ice', value: 'checking' }, { at: 12000, kind: 'ice', value: 'failed' });
    x.selectedPair = { local: { type: 'srflx', protocol: 'udp', cls: 'public', networkType: 'cellular' }, remote: { type: 'srflx', protocol: 'udp', cls: 'public', networkType: '' }, relayProtocol: '', rttMs: 40 };
    x.checks = { states: { failed: 4 }, requestsSent: 9, responsesReceived: 0 };
    x.networkTypes = ['cellular', 'vpn'];
    x.samples = [{ ...sample(0, 0), at: 1000, codec: 'video/H264' }];
    x.verdict = verdictOf(x);
  });
  const text = formatReports([r]);
  expect(text).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  expect(text).not.toMatch(/[0-9a-f]{1,4}:[0-9a-f]{1,4}:[0-9a-f:]*/i);
  expect(text).not.toMatch(/\.local\b/);
  expect(text).not.toMatch(/\b[A-Za-z0-9_-]{24,}\b/);
  // what the owner needs to see is there
  expect(text).toContain('browser: Chrome 129 / Android (mobile)');
  expect(text).toContain('channel: remote (Arx)');
  expect(text).toContain('navigator.connection: type=cellular effective=4g');
  expect(text).toContain('local candidates: host 4, srflx 1, prflx 0, relay 0; ipv6: yes');
  expect(text).toContain('host udp mdns');
  expect(text).toContain('host udp ipv6');
  expect(text).toContain('host udp cgnat');
  expect(text).toContain('srflx udp public');
  expect(text).toContain('remote candidates (from go2rtc): 3');
  expect(text).toContain('host tcp public');
  expect(text).toContain('local networks: cellular, vpn');
  expect(text).toContain('verdict: ICE לא התחבר - כנראה UDP חסום ברשת הזו');
  expect(text).toContain('STUN requests sent 9, answered 0');
  expect(text).toContain('selected pair: srflx udp public (cellular) <-> srflx udp public');
  expect(text).toContain('first frame: none');
});

test('a two-profile run prints the header once and one section per profile', () => {
  const a = report((x) => (x.verdict = 'מחובר ומנגן'));
  const b = newReport('main', 'camera channel 2', ENV);
  b.verdict = 'מחובר אך אין פענוח - קודק או פרופיל שהדפדפן לא מפענח';
  const text = formatReports([a, b]);
  expect(text.match(/SmplWise video connection test/g)).toHaveLength(1);
  expect(text).toContain('=== camera channel 2 / sub ===');
  expect(text).toContain('=== camera channel 2 / main ===');
  expect(formatReports([])).toBe('');
});

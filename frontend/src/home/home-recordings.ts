// HOME-V3-P1-2430: recordings in the home interface (mockup v3 `S.playback`): one camera, one day, a simple timeline and "מה קרה כאן".
// Owner decisions: the timeline runs LEFT TO RIGHT like every video player (dir="ltr"), the picture is never mirrored, and a resident may
// watch everything that is stored (no extra time cap: the day stepper goes back as far as the recorder keeps; the permission
// `video.playback` per camera and the recorder's retention are the only limits). Existing routes only: GET /cameras/{id}/recordings,
// GET /cameras/{id}/events, POST /playback/sessions (+ seek, close), the relay socket played by sw-live-player in MSE.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { ApiError, get } from '../api/client';
import { closePlayback, createPlayback, dateInZone, instantInZone, minuteInZone, playbackWsUrl, recordingsForDay, seekPlayback, type PlaybackSession } from '../api/recordings';
import { clockOf, dayWord, daySpans, diaryWord, inSpans, playbackError } from './home-v3-words';
import '../components/sw-live-player';
import { tr } from '../i18n/msg/home';
import { isoZ } from '../api/day-format';
import { SeekCoalescer } from '../api/seek-coalescer';
import { playerMinute } from './home-playback-clock';
import { decodeSegment } from '../router';

interface PbEvent { at: number; text: string; icon: string }

interface PbState {
  cam: string;
  back: number;
  t: number;
  play: boolean;
  session: PlaybackSession | null;
  spans: [number, number][];
  events: PbEvent[];
  tz: string;
  loading: boolean;
  note: string;
  seq: number;
}

const st: PbState = { cam: '', back: 0, t: 12 * 60, play: false, session: null, spans: [], events: [], tz: 'Asia/Jerusalem', loading: false, note: '', seq: 0 };
let tick = 0;
/** FE-LEAK-TEXTKEY-2435: bumped by stop(); a play that was in flight when the screen left closes the session it got and does not start the clock. */
let gen = 0;
/** STALE-ANSWERS-2540 (SCR-28): play / seek requests go out one at a time, the newest one last - the investigate screen's
 * SeekCoalescer with no debounce. A double tap on play with no session used to open two sessions (the first one never closed, holding
 * one of the recorder's playback slots until its lease ran out); three quick "+10 s" sent three overlapping seeks and the last answer
 * to land won. Now a request asked while one is on its way waits for it and replaces any other waiting one: the second tap seeks the
 * session the first one opened, and the position the person asked for last is the one the recorder plays. */
const seeker = new SeekCoalescer<{ h: HomeHost; minute: number }>((v) => runPlay(v.h, v.minute), { delayMs: 0 });

function dateOf(back: number): string {
  return dateInZone(new Date(Date.now() - back * 86_400_000), st.tz);
}

/** `#/home/playback/<camera>` or `<camera>@<epoch seconds>` (the diary's "watch" jumps to that moment and plays). */
export function playbackHref(camera: string, at?: Date): string {
  return 'playback/' + encodeURIComponent(camera + (at ? '@' + Math.floor(at.getTime() / 1000) : ''));
}

async function stop(h: HomeHost) {
  gen++;
  seeker.cancel(); // a request still waiting belongs to the playback that is going away
  window.clearInterval(tick);
  tick = 0;
  const s = st.session;
  st.session = null;
  st.play = false;
  if (s) await closePlayback(s.id).catch(() => undefined);
  h.requestUpdate();
}

async function loadDay(h: HomeHost) {
  const seq = ++st.seq;
  st.loading = true;
  st.note = '';
  h.requestUpdate();
  try {
    const date = dateOf(st.back);
    const [rec, evs] = await Promise.all([
      recordingsForDay(st.cam, date),
      get<{ events: { type: string; occurred_at: string }[]; timezone?: string }>(`cameras/${encodeURIComponent(st.cam)}/events?date=${date}`).catch(() => ({ events: [] })),
    ]);
    if (seq !== st.seq) return;
    if (rec.timezone) st.tz = rec.timezone;
    const name = h.d.cameras.find((c) => c.id === st.cam)?.name ?? null;
    st.spans = daySpans(rec.segments.map((s) => ({
      startMin: dateInZone(new Date(s.start_at), st.tz) === date ? minuteInZone(new Date(s.start_at), st.tz) : 0,
      endMin: dateInZone(new Date(s.end_at), st.tz) === date ? minuteInZone(new Date(s.end_at), st.tz) : 1440,
    })));
    st.events = evs.events.map((e) => {
      const w = diaryWord(e.type, name);
      return w ? { at: minuteInZone(new Date(e.occurred_at), st.tz), text: w.text, icon: w.icon } : null;
    }).filter((x): x is PbEvent => !!x);
  } catch (err) {
    if (seq !== st.seq) return;
    st.spans = [];
    st.events = [];
    st.note = err instanceof ApiError && err.status === 403 ? playbackError('forbidden') : playbackError(err instanceof ApiError ? err.code : undefined);
  }
  st.loading = false;
  h.requestUpdate();
}

/** Play from `minute` (the timeline shows it at once); the request itself goes out through the coalescer (SCR-28). */
function playAt(h: HomeHost, minute: number) {
  st.t = Math.max(0, Math.min(1439.99, minute));
  st.note = '';
  seeker.request({ h, minute: st.t });
  seeker.flush();
  h.requestUpdate();
}

async function runPlay(h: HomeHost, minute: number) {
  const at = isoZ(instantInZone(dateOf(st.back), minute, st.tz));
  const g = gen;
  const was = st.session?.id;
  try {
    const got = st.session ? await seekPlayback(st.session.id, at) : await createPlayback(st.cam, at);
    if (g !== gen) {
      if (got.id !== was) await closePlayback(got.id).catch(() => undefined);
      return;
    }
    st.session = got;
    const real = st.session.actual_start_at;
    if (real && dateInZone(new Date(real), st.tz) === dateOf(st.back)) st.t = minuteInZone(new Date(real), st.tz);
    st.play = true;
    window.clearInterval(tick);
    const answeredAt = Date.now();
    // STALE-ANSWERS-2540 (SCR-28): the position is the player's own media clock (as the investigate screen reads it), not a wall-clock
    // counter - it stops with the picture in a stall and never runs past the recording
    tick = window.setInterval(() => {
      if (!st.play || !st.session) return;
      const p = h.shadowRoot?.querySelector<HTMLElement & { mediaTime?: number }>('[data-home-playback] sw-live-player');
      const m = playerMinute(st.session, p?.mediaTime, st.tz, dateOf(st.back), (Date.now() - answeredAt) / 1000);
      if (m === null || Math.abs(m - st.t) < 1 / 600) return;
      st.t = m;
      h.requestUpdate();
    }, 1000);
  } catch (err) {
    if (g !== gen) return;
    st.play = false;
    st.note = playbackError(err instanceof ApiError ? (err.status === 403 ? 'forbidden' : err.code) : undefined);
    if (st.session && err instanceof ApiError && err.code === 'session_over') st.session = null;
  }
  h.requestUpdate();
}

function setCam(h: HomeHost, id: string) {
  void stop(h);
  st.cam = id;
  st.events = [];
  st.spans = [];
  h.page = { ...h.page, pbE: 0 };
  void loadDay(h);
}

registerMoreTile({
  id: 'rec',
  order: 10,
  href: 'playback',
  label: tr('הקלטות'),
  icon: 'film',
  visible: (h) => !!h.extFor('playback') && h.recOk(),
  line: () => ({ text: tr('מה צולם היום ובימים הקודמים') }),
});

registerScreen((h: HomeHost) => ({
  id: 'recordings',
  names: ['playback'],
  back: () => 'cameras',
  navCur: () => 'more',
  enter(_name, arg) {
    const raw = decodeSegment(arg || ''); // FIX-FE-2570 (FE-05): a broken `%` link must not throw
    const k = raw.lastIndexOf('@');
    const id = k > 0 ? raw.slice(0, k) : raw;
    const at = k > 0 ? new Date(+raw.slice(k + 1) * 1000) : null;
    const cams = h.d.cameras;
    const cam = cams.some((c) => c.id === id) ? id : cams.some((c) => c.id === st.cam) ? st.cam : cams[0]?.id ?? '';
    if (at && Number.isFinite(at.getTime())) {
      st.back = Math.max(0, Math.round((Date.parse(dateInZone(new Date(), st.tz)) - Date.parse(dateInZone(at, st.tz))) / 86_400_000));
      st.t = minuteInZone(at, st.tz);
    } else if (cam !== st.cam) {
      st.back = 0;
      st.t = Math.max(0, minuteInZone(new Date(), st.tz) - 10);
    }
    if (!cam) return;
    if (cam !== st.cam || at) setCam(h, cam);
    else void loadDay(h);
    if (at) { const g = gen; window.setTimeout(() => { if (g === gen) playAt(h, st.t); }, 0); }
  },
  leave() {
    void stop(h);
  },
  acts: {
    pbDay(el) {
      const d = Math.max(0, st.back + +(el.dataset.d ?? 0));
      if (d === st.back) return;
      void stop(h);
      st.back = d;
      h.page = { ...h.page, pbE: 0 };
      void loadDay(h);
    },
    pbCam(el) {
      const cs = h.d.cameras;
      if (!cs.length) return;
      const i = Math.max(0, cs.findIndex((c) => c.id === st.cam));
      const next = cs[(i + +(el.dataset.d ?? 1) + cs.length) % cs.length].id;
      history.replaceState(null, '', '#/home/' + playbackHref(next));
      setCam(h, next);
    },
    pbPlay() {
      if (st.play) void stop(h);
      else playAt(h, st.t);
    },
    pbSkip(el) {
      const m = st.t + +(el.dataset.d ?? 0) / 60;
      if (st.session) playAt(h, m);
      else { st.t = Math.max(0, Math.min(1439.99, m)); h.requestUpdate(); }
    },
    pbJump(el) {
      playAt(h, +(el.dataset.t ?? 0));
    },
    pbLive() {
      void stop(h);
      return true;
    },
  },
  render() {
    const cams = h.d.cameras;
    const c = cams.find((x) => x.id === st.cam) ?? cams[0];
    if (!h.recOk() || !c) return html`${h.head(tr('הקלטות'), '')}${h.empty('film', tr('אין מצלמות עם הקלטות'), tr('כשתחובר מצלמה, ההקלטות שלה יופיעו כאן.'))}`;
    const ok = inSpans(st.spans, st.t);
    const pg = paged(st.events, h.phone ? 2 : 4, h.pg('pbE'));
    const stamp = html`${dayWord(st.back)} <span class="num">${clockOf(st.t)}</span>`;
    const pct = (m: number) => `${(m / 1440) * 100}%`;
    const pic = st.session && st.play
      ? html`<sw-live-player class="scene-pic" .wsUrl=${playbackWsUrl(st.session)} mode="mse" .retry=${false} fit="contain"></sw-live-player><div class="cap"><span class="clamp1">${c.name}</span><span class="rec-st">${stamp}</span></div>`
      : st.loading ? html`<div class="cam-off">${hi('film')}<span>${tr('טוענים את ההקלטות…')}</span></div>`
        : st.note ? html`<div class="cam-off">${hi('film')}<span>${st.note}</span></div>`
          : !st.spans.length ? html`<div class="cam-off">${hi('film')}<span>${tr('אין הקלטות למצלמה הזו')} ${st.back === 0 ? tr('היום') : tr('ביום הזה')}</span></div>`
            : ok ? html`<div class="cam-off">${hi('play')}<span>${tr('ההקלטה מוכנה. לחצו על נגן.')}</span><small>${stamp}</small></div>`
              : html`<div class="cam-off">${hi('film')}<span>${tr('אין הקלטה בשעה הזו')}</span><small>${tr('גררו את הסמן לאזור מסומן בציר')}</small></div>`;
    const acts = html`<span class="cf-nav pb-days" role="group" aria-label="${tr('יום')}"><button class="rb" data-act="pbDay" data-d="1" aria-label="${tr('יום קודם')}">${hi('back', 'flip')}</button><b class="pbd clamp1">${dayWord(st.back)}</b><button class="rb" data-act="pbDay" data-d="-1" ?disabled=${st.back === 0} aria-label="${tr('יום אחרי')}">${hi('fwd', 'flip')}</button></span>${cams.length > 1 ? html`<span class="cf-nav pb-cams" role="group" aria-label="${tr('מצלמה')}"><button class="rb" data-act="pbCam" data-d="-1" aria-label="${tr('המצלמה הקודמת')}">${hi('back', 'flip')}</button><b class="pbd pbc clamp1" dir="auto" title=${c.name}>${c.name}</b><button class="rb" data-act="pbCam" data-d="1" aria-label="${tr('המצלמה הבאה')}">${hi('fwd', 'flip')}</button></span>` : nothing}`;
    // HOME-V3-AUDITFIX-2437 (audit item 9): with the camera stepper naming the camera, the wide title does not repeat it
    const onInput = (e: Event) => { st.t = +(e.target as HTMLInputElement).value; h.requestUpdate(); };
    const onChange = (e: Event) => { const m = +(e.target as HTMLInputElement).value; if (st.session) playAt(h, m); else { st.t = m; h.requestUpdate(); } };
    return html`${h.head(h.phone ? c.name : cams.length > 1 ? tr('הקלטות') : tr('הקלטות: {name}', { name: c.name }), h.phone ? tr('בחרו יום וזמן.') : tr('בחרו יום, ואז זמן על הציר או אירוע מהרשימה'), acts)}
      <div class="pb-body" data-home-playback=${c.id}><section class=${'tile pb-pic' + (st.play ? '' : ' off')} aria-label="${tr('תמונה')}">${pic}</section>
        <section class="tile pane pb-side" aria-label="${tr('מה קרה')}"><div class="bar"><h2>${tr('מה קרה כאן')}</h2>${h.pager('pbE', pg.pages)}</div>${pg.items.length ? pg.items.map((e) => html`<button class="mrow pb-ev" data-act="pbJump" data-t=${String(e.at)} aria-pressed=${String(Math.abs(e.at - st.t) < 1)}>${hi(e.icon)}<span class="clamp2">${e.text}</span><b class="num">${clockOf(e.at).slice(0, 5)}</b></button>`) : html`<p class="muted pb-none">${tr('לא נרשמו אירועים ליד המצלמה הזו')} ${st.back === 0 ? tr('היום') : tr('ביום הזה')}.</p>`}</section>
        <section class="tile pb-ctl" aria-label="${tr('ניגון')}"><span class="pb-btns"><button class="rb" data-act="pbSkip" data-d="-10" aria-label="${tr('10 שניות אחורה')}" ?disabled=${!st.spans.length}>${hi('rew')}</button><button class="rb play" data-act="pbPlay" aria-pressed=${String(st.play)} aria-label=${st.play ? tr('השהה') : tr('נגן')} ?disabled=${!st.spans.length}>${hi(st.play ? 'pause' : 'play')}</button><button class="rb" data-act="pbSkip" data-d="10" aria-label="${tr('10 שניות קדימה')}" ?disabled=${!st.spans.length}>${hi('ffw')}</button></span>
          <div class="tl" dir="ltr"><div class="tl-track">${st.spans.map(([a, b]) => html`<i class="tl-seg" style=${`left:${pct(a)};width:${pct(b - a)}`}></i>`)}${st.events.map((e) => html`<i class="tl-ev" style=${`left:${pct(e.at)}`}></i>`)}<i class="tl-head" style=${`left:${pct(st.t)}`}></i></div><input type="range" min="0" max="1439" step="1" .value=${String(Math.round(st.t))} aria-label="${tr('זמן בהקלטה')}" ?disabled=${!st.spans.length} @input=${onInput} @change=${onChange}><div class="tl-ax">${[0, 6, 12, 18, 24].map((x) => html`<span class="num">${String(x % 24).padStart(2, '0')}:00</span>`)}</div></div>
          <a class="hbtn" href=${h.href('cameras')} data-act="pbLive">${hi('cam')}<span class="bt">${tr('חזרה לחי')}</span></a></section></div>`;
  },
}));

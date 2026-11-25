// HOME-WALL-NIGHT-2500 (owner 22.11, Q70 / Q71 / Q73 / Q74): the wall panel's rest screen, night dimming and screen takeover, drawn by the
// home interface on a panel whose policy is a wall panel (`kiosk`). The rules are in wall-rest-logic.ts (unit-tested with a fake clock);
// this file only wires them to <sw-home>: the touches that keep the panel awake, the alarm and notice reads a takeover needs, and the three
// layers it draws (the rest screen, the takeover, the dark night layer). sw-home.ts calls it from five places only.
//
// Layers (inside sw-home's own root, so its theme applies): the rest screen (z 50) covers the room screen and any open sheet; a takeover
// (z 55) covers the rest screen; the night layer (z 70) darkens everything and never takes a touch while the panel is awake. A door call
// (sw-home-call, z 40-41) always comes first: while one rings the panel is held awake and no takeover is drawn over it. No scrolling: every
// layer is one fixed screen.
import { html, nothing } from 'lit';
import { uiLocale } from '../i18n/locale';
import { tr } from '../i18n/msg/home';
import { hi } from './home-icons';
import { doorsText } from './home-logic';
import { listNotices, type Notice } from './home-p2-api';
import { has, warmFamily } from './home-p2-ui';
import { alarmWord } from './home-v3-words';
import { canAnywhere } from '../api/session';
import { HandModal } from '../components/hand-modal';
import { moreTiles } from './more-registry';
import type { SwHome } from './sw-home';
import { WallRest, takeoverFor, urgentFreshMs, wallSettings, type TakeoverItem, type WallSettings } from './wall-rest-logic';

const ZONE = 'Asia/Jerusalem';
const F_TIME = new Intl.DateTimeFormat(uiLocale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONE });
const F_DATE = new Intl.DateTimeFormat(uiLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONE });
/** The notices a takeover may show this panel already showed (kept on the device: the panel is the device). */
const SEEN_KEY = 'arx-wall-seen';
const SEEN_MAX = 60;
const POLL_MS = 60_000;

function readSeen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].filter((k) => k.startsWith('notice:')).slice(-SEEN_MAX)));
  } catch { /* storage off: the notice may show once more after a reload */ }
}

function weatherIcon(text: string, night: boolean): string {
  if (/גשם|סערה|שלג|rain|storm|snow/i.test(text)) return 'rain';
  if (/ענן|עונן|ערפל|cloud|fog/i.test(text)) return 'cloud';
  return night ? 'night' : 'sun';
}

export class WallPanel {
  private machine: WallRest | null = null;
  private key = '';
  private seen = readSeen();
  private notices: Notice[] = [];
  /** the board was read at least once (0 = not yet), and a read is on its way */
  private noticesAt = 0;
  private noticesLoading = false;
  private pollT = 0;
  private callOn = false;
  private shown: TakeoverItem | null = null;
  /** CR-MODAL-STACK-B-2442: a takeover is a layer of the shared modal stack - Tab stays inside it, the room screen behind it is inert,
   *  and Escape never dismisses it (only "הבנתי" does), like the door call. */
  private modal = new HandModal({
    box: () => this.h.renderRoot.querySelector('.wt'),
    close: () => undefined,
    escape: () => false,
    inert: () => [this.h.renderRoot.querySelector('.app-root > .hs')],
  });

  constructor(private readonly h: SwHome) {}

  /** A wall panel (the person's policy says so) - the only place any of this runs. */
  private on(): boolean {
    return !!this.h.data && !!this.h.pol()?.kiosk;
  }

  private settings(): WallSettings {
    return wallSettings(this.h.pol()?.wall);
  }

  connect() {
    this.h.addEventListener('pointerdown', this.onInput, { capture: true });
    this.h.addEventListener('keydown', this.onInput, { capture: true });
    this.h.addEventListener('wheel', this.onInput, { capture: true, passive: true });
    document.addEventListener('visibilitychange', this.onVisible);
  }

  disconnect() {
    this.h.removeEventListener('pointerdown', this.onInput, { capture: true });
    this.h.removeEventListener('keydown', this.onInput, { capture: true });
    this.h.removeEventListener('wheel', this.onInput, { capture: true });
    document.removeEventListener('visibilitychange', this.onVisible);
    this.modal.release();
    window.clearInterval(this.pollT);
    this.pollT = 0;
    this.machine?.dispose();
    this.machine = null;
    this.key = '';
  }

  /** Called before every render: start, reconfigure or stop the machine as the policy says. */
  sync() {
    if (!this.on()) {
      if (this.machine) this.disconnectMachine();
      return;
    }
    const s = this.settings();
    const key = JSON.stringify(s);
    if (!this.machine) {
      this.machine = new WallRest(s, () => this.h.requestUpdate());
      this.key = key;
      this.startPoll();
    } else if (key !== this.key) {
      this.key = key;
      this.machine.configure(s);
      this.startPoll();
    }
  }

  private disconnectMachine() {
    this.modal.sync(false);
    window.clearInterval(this.pollT);
    this.pollT = 0;
    this.machine?.dispose();
    this.machine = null;
    this.key = '';
  }

  /** The notice board and the alarm are read again every minute while a takeover may need them (the alarm also on its own change). */
  private startPoll() {
    window.clearInterval(this.pollT);
    this.pollT = 0;
    if (this.settings().takeover === 'call_only') return;
    const tick = () => {
      if (this.settings().takeover === 'alarm_urgent') this.loadNotices();
      if (this.alarmOk()) void this.h.loadPanels();
    };
    this.loadNotices();
    this.pollT = window.setInterval(tick, POLL_MS);
  }

  private alarmOk(): boolean {
    return this.h.d.modules.has('security') && canAnywhere('alarm.view');
  }

  private loadNotices() {
    warmFamily(this.h);
    if (!has('notices') || this.noticesLoading) return;
    this.noticesLoading = true;
    void listNotices()
      .then((r) => { this.notices = r.notices; this.noticesAt = Date.now(); this.h.requestUpdate(); })
      .catch(() => undefined)
      .finally(() => { this.noticesLoading = false; });
  }

  // SCREENS-FIX-A-2520 (SCR-06): a pushed alarm-panel change re-reads the panels in sw-home itself (`alarmPushed`) on every home
  // device, a wall panel included - so a sounding alarm still takes the screen at once.

  /** The door call element's state: a visible ringing call holds the panel awake (and keeps any takeover behind it). */
  calls(ringing: number, waiting: number) {
    this.callOn = ringing > waiting;
    this.machine?.hold('call', this.callOn);
  }

  private onInput = (e: Event) => {
    if (!this.machine) return;
    // the first touch on the rest screen only wakes it: the layer's own click does that, after the touch ended (see rest())
    if (e.composedPath().some((n) => n instanceof HTMLElement && n.hasAttribute('data-wall-catch'))) return;
    this.machine.input();
  };

  private onVisible = () => {
    this.machine?.visible(document.visibilityState === 'visible');
  };

  private wake = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    this.machine?.input();
  };

  private ack(item: TakeoverItem, open: boolean) {
    this.seen.add(item.key);
    writeSeen(this.seen);
    this.machine?.input();
    if (open) this.h.go('notices');
    this.h.requestUpdate();
  }

  /** The layers to draw now (nothing on a panel that is not a wall panel). */
  render(): unknown {
    const m = this.machine;
    if (!m || !this.on()) return nothing;
    const now = Date.now();
    // the person's features arrive after the panel starts: the first board read waits for them (then the minute poll keeps it fresh)
    if (m.settings.takeover === 'alarm_urgent' && !this.noticesAt && !this.noticesLoading && has('notices')) this.loadNotices();
    const item = takeoverFor(m.settings.takeover, this.h.panels, this.notices, this.seen, now, urgentFreshMs(m.settings));
    if ((item?.key ?? null) !== (this.shown?.key ?? null)) {
      this.shown = item;
      // a takeover wakes the panel (rest and night dim step aside) and holds it awake while it is on screen
      queueMicrotask(() => m.hold('takeover', !!item));
    }
    const st = m.state(now);
    const take = item && !this.callOn ? this.takeover(item) : nothing;
    void this.h.updateComplete.then(() => this.modal.sync(!!this.h.renderRoot.querySelector('.wt')));
    return html`${st.rest ? this.rest(st.night) : st.dim > 0 && st.phase === 'idle' ? html`<div class="wcatch" data-wall-catch role="button" tabindex="0" aria-label=${tr('המסך מוחשך ללילה. נגיעה מאירה אותו.')} @click=${this.wake} @keydown=${this.wake}></div>` : nothing}${take}<div class="wdim" data-wall-dim style=${`opacity:${st.dim}`} aria-hidden="true"></div>`;
  }

  private rest(night: boolean) {
    const h = this.h;
    const d = h.d;
    const now = h.now;
    const w = d.weather;
    const pills: unknown[] = [];
    const cal = moreTiles(h).find((t) => t.id === 'calendar');
    if (cal) pills.push(html`<span class="st-pill wr-pill" data-wr="today">${hi('cal')}<span class="clamp1">${cal.line(h).text}</span></span>`);
    if (d.modules.has('doors')) {
      const doors = h.allDoors();
      const open = doors.filter((x) => !x.locked).length;
      pills.push(html`<span class="st-pill wr-pill" data-wr="doors" data-tone=${!doors.length ? 'neutral' : open ? 'warn' : 'ok'}><i class="dot"></i><span class="clamp1">${doorsText(doors)}</span></span>`);
    }
    const p = h.panels[0];
    if (p) {
      const a = alarmWord(p.state, p.available);
      pills.push(html`<span class="st-pill wr-pill" data-wr="alarm" data-tone=${a.tone}>${hi('shield')}<span class="clamp1">${tr('אזעקה:')} ${a.text}</span></span>`);
    }
    return html`<div class="wr" data-wall-rest data-wall-catch data-night=${night ? 'on' : 'off'} role="button" tabindex="0" aria-label=${tr('המסך במנוחה. נגיעה מעירה אותו.')} @click=${this.wake} @keydown=${this.wake}>
      <div class="wr-in">
        <p class="wr-date">${F_DATE.format(now)}</p>
        <p class="wr-time num">${F_TIME.format(now)}</p>
        ${w ? html`<p class="wr-wx">${hi(weatherIcon(w.text, night))}${w.t != null ? html`<span class="num">${w.t}°</span>` : nothing}<span>${w.text}</span></p>` : nothing}
        ${pills.length ? html`<div class="wr-row">${pills}</div>` : nothing}
      </div>
      <p class="wr-hint">${tr('נגיעה מעירה את המסך')}</p>
    </div>`;
  }

  private takeover(item: TakeoverItem) {
    if (item.kind === 'alarm') {
      const p = item.panel;
      const sounding = p.state === 'triggered';
      const open = (p.open_sensors ?? []).slice(0, 3);
      return html`<div class="wt" data-wall-takeover="alarm" data-tone=${sounding ? 'danger' : 'warn'} role="alertdialog" aria-modal="true" aria-labelledby="wt-h" aria-describedby="wt-b">
        <section class="wt-in"><span class="wt-ic">${hi('shield')}</span><p class="wt-k">${p.name}</p>
          <h1 id="wt-h">${sounding ? tr('האזעקה פועלת') : tr('האזעקה ממתינה לקוד')}</h1>
          <p class="wt-b" id="wt-b">${sounding ? tr('האזעקה הופעלה בבית.') : tr('מישהו נכנס והאזעקה דרוכה. יש להקיש קוד בלוח האזעקה כדי לנטרל.')}${open.length ? html` ${tr('פתוח:')} ${open.join(', ')}` : nothing}</p>
          <div class="wt-acts"><button class="hbtn strong xl" data-wall-ack @click=${() => this.ack(item, false)}>${tr('הבנתי')}</button></div>
        </section></div>`;
    }
    const n = item.notice;
    return html`<div class="wt" data-wall-takeover="notice" data-tone="warn" role="alertdialog" aria-modal="true" aria-labelledby="wt-h" aria-describedby="wt-b">
      <section class="wt-in"><span class="wt-ic">${hi('bell')}</span><p class="wt-k">${tr('הודעה דחופה')}</p>
        <h1 id="wt-h" class="clamp2">${n.title}</h1>
        <p class="wt-b long" id="wt-b">${n.body}</p>
        <div class="wt-acts"><button class="hbtn strong xl" data-wall-ack @click=${() => this.ack(item, false)}>${tr('הבנתי')}</button>${has('notices') ? html`<button class="hbtn xl" data-wall-open @click=${() => this.ack(item, true)}>${tr('ללוח ההודעות')}</button>` : nothing}</div>
      </section></div>`;
  }
}

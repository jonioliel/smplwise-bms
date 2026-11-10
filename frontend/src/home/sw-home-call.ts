// HOME-SIMPLE-2420 slice 7: the home interface's full-screen incoming call (the round-25 mockup's call sheet). It IS the existing
// incoming-call element (components/sw-incoming-call: the same active-calls signalling, ring, answer + two-way talk, reject, door
// release with its confirmation, hide) with the mockup's look: the calling station's live picture (the station's own relay path
// through the camera tile, the refreshed still without video.live), "ענה ודבר" only where the station offers talk from Arx, "פתח
// דלת" with the confirmation step, "התעלם" (hide; the strip then shows "מחכים בדלת"). It never sends the person to another screen.
import { html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SwIncomingCall } from '../components/sw-incoming-call';
import { answerPlan, clockText, elapsedNow } from '../components/incoming-call-logic';
import { intercomSnapshotUrl } from '../api/intercom';
import type { IncomingCall } from '../api/intercom-calls';
import type { StationMedia } from '../api/station-media';
import { homeMockupStyles } from './home-styles';
import { homeExtraStyles } from './home-styles-extra';
import { hi } from './home-icons';
import '../components/sw-camera-tile';

export interface HomeCallsState { ringing: number; waiting: number }

@customElement('sw-home-call')
export class SwHomeCall extends SwIncomingCall {
  static styles: CSSResultGroup = [homeMockupStyles, homeExtraStyles];

  /** Show again every ringing call this person ignored (the strip's "מחכים בדלת"). */
  unhideRinging(): void {
    for (const c of this.active?.calls ?? []) if (c.state === 'ringing') this.hiddenCalls.delete(c.call_id);
    this.requestUpdate();
    this.sync();
  }

  protected updated(): void {
    super.updated();
    const calls = this.active?.calls ?? [];
    const ringing = calls.filter((c) => c.state === 'ringing').length;
    const waiting = calls.filter((c) => c.state === 'ringing' && this.hiddenCalls.has(c.call_id)).length;
    const key = `${ringing}/${waiting}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.dispatchEvent(new CustomEvent<HomeCallsState>('home-calls', { detail: { ringing, waiting }, bubbles: true, composed: true }));
    }
  }

  private lastKey = '';

  private mediaNow(c: IncomingCall): StationMedia | null {
    const m = this.media.get(c.station_id);
    return m instanceof Promise || m === undefined ? null : m;
  }

  private video(c: IncomingCall): TemplateResult {
    const m = this.mediaNow(c);
    const path = m?.video?.allowed ? m.video.paths.sub ?? m.video.paths.main ?? Object.values(m.video.paths)[0] ?? '' : '';
    if (!c.online) return html`<div class="cam-off big">${hi('camoff')}<span>הכניסה לא מחוברת כרגע</span></div>`;
    if (path) return html`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${path} profile="sub" poster=${c.still ? intercomSnapshotUrl(c.station_id, this.picture) : ''}></sw-camera-tile>`;
    if (c.has_camera && c.still) return html`<img class="scene-pic call-still" src=${intercomSnapshotUrl(c.station_id, this.picture)} alt=${'מי שבכניסה: ' + c.station_name} decoding="async" />`;
    return html`<div class="cam-off big">${hi('camoff')}<span>אין תמונה מהכניסה הזו</span></div>`;
  }

  render() {
    void this.tick;
    const shown = this.shown();
    if (!shown.length) return nothing;
    const c = shown[Math.min(this.front, shown.length - 1)];
    const mine = c.answered_by_me || this.talking.has(c.call_id);
    const busy = this.busy[c.call_id];
    const talkable = answerPlan(this.mediaNow(c)).kind === 'talk';
    const n = this.notes[c.call_id];
    const s = this.sessions.get(c.call_id);
    const ask = this.doorAsk?.startsWith(`${c.call_id}/`) ? Number(this.doorAsk.split('/')[1]) : null;
    const door = (i: number) => c.locks.find((l) => l.physical_index === i)?.name || c.station_name;
    const canDoor = c.can_open_door && c.online && c.locks.length > 0;
    const sec = elapsedNow(c, this.fetchedAt, Date.now());
    let side: TemplateResult;
    if (ask !== null) {
      side = html`<h1>לפתוח את ${door(ask)}?</h1><p class="sub">הדלת תינעל שוב מעצמה אחרי כמה שניות.</p>
        <div class="call-acts"><button class="hbtn strong xl" data-call-door-yes ?disabled=${busy === 'door'} @click=${() => void this.openDoor(c, ask)}>${hi('unlock')}כן, פתח</button><button class="hbtn xl" data-call-door-no @click=${() => (this.doorAsk = null)}>ביטול</button></div>`;
    } else {
      const doors = canDoor ? c.locks.map((l) => html`<button class="hbtn xl${mine ? ' strong' : ''}" data-call-door=${l.physical_index} ?disabled=${!!busy} @click=${() => (this.doorAsk = `${c.call_id}/${l.physical_index}`)}>${hi('unlock')}${c.locks.length > 1 && l.name ? `פתח: ${l.name}` : 'פתח דלת'}</button>`) : [];
      side = html`<p class="ring-line">${hi('bell')}${mine ? 'בשיחה' : 'מצלצלים עכשיו'} <span class="num">${clockText(sec)}</span></p><h1>${mine ? 'מדברים עם ' + c.station_name : 'מישהו ב' + c.station_name.replace(/^ה/, '')}</h1>
        <p class="sub">${mine ? (s?.muted ? 'המיקרופון מושתק.' : 'שומעים אותך בכניסה. אפשר לדבר.') : talkable ? 'אפשר לענות, לפתוח או להתעלם.' : 'אפשר לפתוח או להתעלם. דיבור עם הכניסה הזו לא זמין מכאן.'}</p>
        ${n ? html`<p class="sub" role="status" data-call-note=${n.tone}>${n.text}</p>` : nothing}
        <div class="call-acts">
          ${mine
            ? html`<button class="hbtn xl" data-call-hangup aria-pressed="true" ?disabled=${busy === 'hangUp'} @click=${() => void this.signal(c, 'hangUp')}>${hi('mic')}סיים שיחה</button>${s && s.phase !== 'starting' && s.phase !== 'idle' ? html`<button class="hbtn xl" data-call-mute @click=${() => s.toggleMute()}>${hi('mic')}${s.muted ? 'בטל השתקה' : 'השתק'}</button>` : nothing}`
            : talkable ? html`<button class="hbtn strong xl" data-call-answer ?disabled=${!!busy || !c.online} @click=${() => void this.answer(c)}>${hi('phone')}${busy === 'answer' ? 'עונה…' : 'ענה ודבר'}</button>` : nothing}
          ${doors}
          ${mine ? nothing : html`<button class="hbtn quiet xl" data-call-ignore @click=${() => this.hide(c)}>התעלם</button>`}
        </div>`;
    }
    return html`<div class="ovl"><div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label="אינטרקום" data-incoming-call=${c.call_id} data-state=${mine ? 'in_call' : 'ringing'}>
      <div class="call-video">${this.video(c)}${c.online ? html`<span class="live onpic"><i class="dot"></i>חי</span>` : nothing}</div><div class="call-side">${side}</div></section></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-home-call': SwHomeCall;
  }
}

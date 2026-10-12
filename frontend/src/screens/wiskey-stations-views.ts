/**
 * The templates of the native stations screen (CR-036 slice S6): the card, the list row, the table, the call row, the door
 * buttons, the still, and the drawer's sections. Plain functions of a `ViewCtx` (the screen's state and callbacks), rendered into the
 * screen's own shadow root so its stylesheet (wiskey-stations-css.ts) applies - except the table's cells, which sw-table renders in
 * its own shadow root and which therefore use only components with styles of their own (wk-action-button, sw-badge) and tokens.
 * Absence, not greying: a control the caller may not use is not rendered; a field the server did not send is not drawn.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-badge';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/wk-action-button';
import type { TableColumn } from '../components/sw-table';
import type { AccessStation, StationCodes, StationPrograms } from '../api/access-stations';
import { intercomSnapshotUrl, type DisplayZone, type IntercomCallCommand } from '../api/intercom';
import { fill, type StationsText } from '../i18n/wiskey-stations';
import type { StationActions } from './wiskey-stations-actions';
import {
  CallClock,
  callWord,
  classicPanelHref,
  clockText,
  codesSummary,
  doorName,
  isActiveCall,
  placeLabelOf,
  programViews,
  seenText,
  shortStamp,
  showCallHint,
  statusOf,
  stationDoors,
  stillTime,
  syncKind,
  syncWord,
  ttsStateText,
  type PlaceMap,
  type Rights,
  type StationsPolicy,
} from './wiskey-stations-logic';
import { wkIcon } from './wiskey-stations-icons';

export interface Fetch<T> {
  state: 'idle' | 'loading' | 'ready' | 'unsupported' | 'busy' | 'error';
  data: T | null;
}
export interface StationDetail {
  programs: Fetch<StationPrograms>;
  codes: Fetch<StationCodes>;
}

/** The screen's state and callbacks, as the templates need them. */
export interface ViewCtx {
  text: StationsText;
  now: number;
  defaultZone: DisplayZone | null;
  /** The feed is live and fresh: nothing physical is offered on a last-known copy. */
  live: boolean;
  rights: Rights;
  policy: StationsPolicy;
  places: PlaceMap | null;
  actions: StationActions;
  clock: CallClock;
  /** A tablet or narrower: the table drops its least needed columns. */
  compact: boolean;
  /** The installation has the media server stills need (a station without it shows "no picture"). */
  media: boolean;
  /** Cache-buster of the stills (bumped every minute). */
  poster: number;
  failed: Readonly<Record<string, number>>;
  selected: string | null;
  detail: Readonly<Record<string, StationDetail>>;
  detailOpen: boolean;
  /** Per feature: whether the installed WisKey offers it (null = not known yet, treated as available). */
  features: Readonly<Record<string, boolean | null>>;
  open(id: string): void;
  door(s: AccessStation, lock: number): void;
  call(s: AccessStation, command: IntercomCallCommand, ev: MouseEvent): void;
  announce(id: string): void;
  stillError(id: string, bust: number): void;
  toggleDetail(): void;
  retryDetail(): void;
}

const zoneOf = (v: ViewCtx, s: AccessStation): DisplayZone | null => s.zone ?? v.defaultZone;
const seenOf = (v: ViewCtx, s: AccessStation): string => seenText(s.last_seen, v.now, zoneOf(v, s), v.text);
const stop = (fn: () => void) => (e: Event) => {
  e.stopPropagation();
  fn();
};

// ---------------------------------------------------------------- the still

type StillState = 'nocam' | 'none' | 'image' | 'failed';

function stillStateOf(v: ViewCtx, s: AccessStation): StillState {
  if (!s.camera_entity) return s.has_camera ? 'none' : 'nocam';
  if (!v.media) return 'none';
  return v.failed[s.id] === v.poster ? 'failed' : 'image';
}

const stillSrc = (v: ViewCtx, s: AccessStation): string => intercomSnapshotUrl(s.id, v.poster);

function noPicture(v: ViewCtx, s: AccessStation, st: StillState): TemplateResult {
  const t = v.text.still;
  const word = st === 'nocam' ? t.none : st === 'failed' ? t.failed : t.offline;
  return html`<div class="none" role="status"><sw-icon name=${st === 'nocam' ? 'camera' : 'offline'} size=${20}></sw-icon><span>${s.online || st === 'nocam' ? word : t.offline}</span></div>`;
}

function callBadge(v: ViewCtx, s: AccessStation): TemplateResult | typeof nothing {
  if (!isActiveCall(s) && !(s.online && s.call_state === 'ending')) return nothing;
  if (!showCallHint(v.policy, v.rights)) return nothing;
  const ringing = s.call_state === 'ringing';
  return html`<span class="callbadge ${s.call_state}" data-wk-call-badge=${s.call_state}>${ringing ? html`<sw-icon name="bell" size=${14}></sw-icon>` : html`<span class="ic">${wkIcon('phone', 14)}</span>`}${callWord(s.call_state, v.text)}</span>`;
}

function media(v: ViewCtx, s: AccessStation): TemplateResult {
  const t = v.text;
  const st = stillStateOf(v, s);
  const label = placeLabelOf(s.id, v.places);
  const stamp = s.online ? `${t.still.tag} · ${stillTime(v.poster)}` : seenOf(v, s);
  return html`<div class="media ${s.online ? '' : 'off'}" data-wk-still=${s.id} data-still-state=${st}>
    ${st === 'image'
      ? html`<img src=${stillSrc(v, s)} alt=${fill(t.still.alt, { name: s.name })} decoding="async" @error=${() => v.stillError(s.id, v.poster)} /><span class="stamp"><bdi>${stamp}</bdi></span>`
      : noPicture(v, s, st)}
    ${callBadge(v, s)}
    <button type="button" class="open" data-wk-open=${s.id} aria-label=${s.name} @click=${() => v.open(s.id)}></button>
    <div class="scrim"><span class="name">${s.name}</span>${label ? html`<span class="place">${label}</span>` : nothing}</div>
  </div>`;
}

function thumb(v: ViewCtx, s: AccessStation): TemplateResult {
  const st = stillStateOf(v, s);
  return html`<span class="thumb ${s.online ? '' : 'off'}" data-wk-thumb=${s.id}>${st === 'image' ? html`<img src=${stillSrc(v, s)} alt="" decoding="async" @error=${() => v.stillError(s.id, v.poster)} />` : html`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`;
}

// ---------------------------------------------------------------- the call row, the door buttons, the outcome line

/** One call control: first tap arms (the label says so), the second sends. Disabled on a last-known copy and while a command is out. */
function callButton(v: ViewCtx, s: AccessStation, command: IntercomCallCommand, tone: 'ok' | 'danger', icon: string, label: string): TemplateResult {
  const a = v.actions.armed;
  const armed = !!a && a.id === s.id && a.command === command && a.callState === s.call_state;
  return html`<wk-action-button
    tone=${tone}
    icon=${icon}
    data-wk-call=${command}
    ?armed=${armed}
    ?disabled=${!v.live || v.actions.callBusy.has(s.id)}
    label=${armed ? fill(v.text.call.armedAria, { label }) : label}
    @click=${(e: MouseEvent) => {
      e.stopPropagation();
      v.call(s, command, e);
    }}
    >${armed ? v.text.call.armed : label}</wk-action-button
  >`;
}

export function talkLink(v: ViewCtx, large = false): TemplateResult {
  const t = v.text.talk;
  return html`<wk-action-button tone="dashed" icon="window" href=${classicPanelHref()} data-wk-talk="classic" label=${t.hint} ?block=${large} size=${large ? 'lg' : 'md'} @click=${(e: Event) => e.stopPropagation()}
    >${large ? t.classic : t.classicShort}</wk-action-button
  >`;
}

/** The call row: the call hint (no caller name) for everyone who sees the station, the controls for who may act on calls. */
export function callRow(v: ViewCtx, s: AccessStation, big = false): TemplateResult | typeof nothing {
  const t = v.text;
  const phase = s.online ? s.call_state : 'unavailable';
  if (phase !== 'ringing' && phase !== 'in_call' && phase !== 'ending') return nothing;
  if (!showCallHint(v.policy, v.rights)) return nothing;
  const sec = v.clock.seconds(s.id, v.now);
  const icon = phase === 'ringing' ? html`<sw-icon name="bell" size=${15}></sw-icon>` : wkIcon('phone', 15);
  const controls = v.rights.call && phase !== 'ending';
  return html`<div class="callrow ${phase} ${big ? 'big' : ''}" data-wk-call-row=${s.id} data-call=${phase} role="group" aria-label=${t.call.group}>
    <span class="cs">${icon}<span>${callWord(phase, t)}</span>${sec !== null ? html`<span class="dur" data-wk-call-clock>${clockText(sec)}</span>` : nothing}</span>
    ${controls
      ? html`<span class="ctl">${phase === 'ringing'
          ? html`${callButton(v, s, 'answer', 'ok', 'phone', t.call.answer)}${callButton(v, s, 'reject', 'danger', 'close', t.call.reject)}`
          : html`${v.rights.talk && !big ? talkLink(v) : nothing}${callButton(v, s, 'hangUp', 'danger', 'hangup', t.call.hangUp)}`}</span>`
      : nothing}
  </div>`;
}

export function doorButtons(v: ViewCtx, s: AccessStation): TemplateResult | typeof nothing {
  if (!v.rights.door) return nothing;
  const t = v.text.door;
  return html`${stationDoors(s).map((lock) => {
    const key = `${s.id}/${lock.physical_index}`;
    const held = v.actions.isHeld(key);
    const sending = v.actions.releasing.has(key);
    const state = held ? 'held' : sending ? 'sending' : 'idle';
    const label = held ? t.held : sending ? t.sending : s.locks.length > 1 ? fill(t.openNamed, { name: doorName(lock, v.text) }) : t.open;
    return html`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${key}
      data-state=${state}
      ?busy=${sending}
      ?disabled=${!v.live || !s.online || sending || held}
      @click=${stop(() => v.door(s, lock.physical_index))}
      >${label}</wk-action-button
    >`;
  })}`;
}

function announceIcon(v: ViewCtx, s: AccessStation): TemplateResult | typeof nothing {
  if (!v.rights.announce || !s.online) return nothing;
  return html`<wk-action-button icon="volume" icon-only data-wk-announce-at=${s.id} label=${v.text.announce} ?disabled=${!v.live} @click=${stop(() => v.announce(s.id))}></wk-action-button>`;
}

/** The outcome of the last physical action at a station. In the drawer it sticks to the top of the scrolling body, so the answer to a
 * press far down the sheet is never off-screen. */
export function resultLine(v: ViewCtx, s: AccessStation, sticky = false): TemplateResult | typeof nothing {
  const r = v.actions.results[s.id];
  return r ? html`<div class="result ${r.tone} ${sticky ? 'sticky' : ''}" role="status" data-wk-result=${s.id} data-tone=${r.tone}>${r.text}</div>` : nothing;
}

// ---------------------------------------------------------------- cards

function cardClick(v: ViewCtx, e: Event, id: string): void {
  const hit = e.composedPath().some((n) => n instanceof HTMLElement && n.matches('button, a, wk-action-button, select, input, textarea, summary'));
  if (!hit) v.open(id);
}

function techRow(v: ViewCtx, s: AccessStation): TemplateResult | typeof nothing {
  const tc = s.technical;
  if (!tc) return nothing;
  return html`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${syncKind(s.sync_state)} label=${syncWord(s.sync_state, v.text)} data-wk-sync=${s.sync_state}></sw-badge>
    <span class="sp"></span>
    ${tc.model ? html`<code>${tc.model}</code>` : nothing}
  </div>`;
}

export function card(v: ViewCtx, s: AccessStation): TemplateResult {
  const t = v.text;
  const status = statusOf(s);
  const hasActions = (v.rights.door && stationDoors(s).length > 0) || (v.rights.announce && s.online);
  return html`<sw-card flush interactive class="card ${status === 'ringing' ? 'ringing' : ''}" data-wk-station=${s.id} data-status=${status} @click=${(e: Event) => cardClick(v, e, s.id)}>
    ${media(v, s)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${s.online ? 'live' : 'offline'} label=${s.online ? t.status.online : t.status.offline}></sw-badge>
        <span>${t.seen.prefix} <b><bdi>${seenOf(v, s)}</bdi></b></span>
      </div>
      ${callRow(v, s)}
      ${hasActions ? html`<div class="acts">${doorButtons(v, s)}${announceIcon(v, s)}</div>` : nothing}
      ${resultLine(v, s)} ${techRow(v, s)}
    </div>
  </sw-card>`;
}

// ---------------------------------------------------------------- list rows

/** The call state as a pill: in a list row (styled here) or, with `badge`, a sw-badge for a table cell (rendered in sw-table's own shadow root). */
function callPill(v: ViewCtx, s: AccessStation, badge = false): TemplateResult | typeof nothing {
  const phase = s.online ? s.call_state : '';
  if (phase !== 'ringing' && phase !== 'in_call' && phase !== 'ending') return nothing;
  if (!showCallHint(v.policy, v.rights)) return nothing;
  const sec = v.clock.seconds(s.id, v.now);
  const label = `${callWord(phase, v.text)}${sec !== null ? ` · ${clockText(sec)}` : ''}`;
  if (badge) return html`<sw-badge kind=${phase === 'ringing' ? 'stale' : 'recorded'} label=${label} data-wk-call-pill=${phase}></sw-badge>`;
  return html`<span class="pillcall ${phase}" data-wk-call-pill=${phase}>${callWord(phase, v.text)}${sec !== null ? html` · <span class="dur">${clockText(sec)}</span>` : nothing}</span>`;
}

export function row(v: ViewCtx, s: AccessStation): TemplateResult {
  const t = v.text;
  const place = placeLabelOf(s.id, v.places);
  const sub = [place, s.technical ? syncWord(s.sync_state, t) : ''].filter(Boolean).join(' · ');
  const answer = v.rights.call && s.online && s.call_state === 'ringing' && showCallHint(v.policy, v.rights);
  return html`<div class="row" data-wk-station=${s.id} data-status=${statusOf(s)}>
    <button type="button" class="rowmain" data-wk-open=${s.id} @click=${() => v.open(s.id)}>
      ${thumb(v, s)}
      <span class="rowtext"><span class="t"><span class="sdot ${s.online ? '' : 'off'}" aria-hidden="true"></span><b>${s.name}</b></span>${sub ? html`<span class="s">${sub}</span>` : nothing}</span>
    </button>
    <div class="rowside">
      ${callPill(v, s)}
      <span class="seen">${t.seen.prefix} <bdi>${seenOf(v, s)}</bdi></span>
      <div class="rowacts">
        ${answer ? callButton(v, s, 'answer', 'ok', 'phone', t.call.answer) : nothing}${doorButtons(v, s)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`;
}

export function rows(v: ViewCtx, list: readonly AccessStation[]): TemplateResult {
  return html`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${repeat(list, (s) => s.id, (s) => row(v, s))}</div></sw-card>`;
}

export function grid(v: ViewCtx, list: readonly AccessStation[]): TemplateResult {
  return html`<div class="grid" data-wk-grid>${repeat(list, (s) => s.id, (s) => card(v, s))}</div>`;
}

// ---------------------------------------------------------------- the table

export function tableColumns(v: ViewCtx, list: readonly AccessStation[]): TableColumn[] {
  const t = v.text;
  const as = (r: Record<string, unknown>) => r as unknown as AccessStation;
  const tech = list.some((s) => s.technical);
  const cols: TableColumn[] = [
    { key: 'name', label: t.table.station, render: (r) => html`<wk-action-button tone="quiet" data-wk-open=${as(r).id} @click=${() => v.open(as(r).id)}>${as(r).name}</wk-action-button>` },
    { key: 'place', label: t.table.place, render: (r) => html`<span>${placeLabelOf(as(r).id, v.places) || '—'}</span>` },
    { key: 'status', label: t.table.status, render: (r) => html`<sw-badge kind=${as(r).online ? 'live' : 'offline'} label=${as(r).online ? t.status.online : t.status.offline}></sw-badge>` },
    { key: 'seen', label: t.table.seen, render: (r) => html`<bdi>${seenOf(v, as(r))}</bdi>` },
    { key: 'call', label: t.table.call, render: (r) => callPill(v, as(r), true) || html`<span style="color:var(--sw-text-3)">—</span>` },
  ];
  // a tablet's table keeps what an operator reads and does; the door names (the buttons carry them) and the model wait in the drawer
  if (!v.compact) cols.push({ key: 'doors', label: t.table.doors, render: (r) => html`<span>${stationDoors(as(r)).map((l) => doorName(l, t)).join(', ') || '—'}</span>` });
  if (tech) {
    cols.push({ key: 'sync', label: t.table.sync, render: (r) => (as(r).technical ? html`<sw-badge kind=${syncKind(as(r).sync_state)} label=${syncWord(as(r).sync_state, t)}></sw-badge>` : html`<span style="color:var(--sw-text-3)">—</span>`) });
    if (!v.compact) cols.push({ key: 'model', label: t.table.model, ltr: true, render: (r) => html`<span>${[as(r).technical?.model, as(r).technical?.firmware].filter(Boolean).join(' · ') || '—'}</span>` });
  }
  cols.push({
    key: 'actions',
    label: '',
    render: (r) => {
      const s = as(r);
      const answer = v.rights.call && s.online && s.call_state === 'ringing' && showCallHint(v.policy, v.rights);
      return html`<span style="display:inline-flex;align-items:center;gap:var(--sw-s-2)">${answer ? callButton(v, s, 'answer', 'ok', 'phone', t.call.answer) : nothing}${doorButtons(v, s)}</span>`;
    },
  });
  return cols;
}

// ---------------------------------------------------------------- the drawer

function technical(v: ViewCtx, s: AccessStation): TemplateResult | typeof nothing {
  const tc = s.technical;
  if (!tc) return nothing;
  const t = v.text;
  const rec = tc.reconciled_at && /(Z|[+-]\d\d:\d\d)$/.test(tc.reconciled_at) ? shortStamp(Date.parse(tc.reconciled_at), v.now, zoneOf(v, s) ?? undefined, t) : '';
  const skew = tc.clock?.skew_seconds;
  const clock = skew === null || skew === undefined ? '' : Math.abs(skew) <= 2 ? t.tech.clockOk : fill(t.tech.clockDrift, { n: Math.round(skew) });
  const stream = tc.event_status?.stream;
  const streamText = !stream ? '' : stream === 'connected' ? t.tech.streamOk : ['disconnected', 'unavailable', 'stopped', 'authentication_failed'].includes(stream) ? t.tech.streamDown : t.tech.streamUnknown;
  return html`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${t.drawer.technical}</h4>
    <dl class="kv">
      <dt>${t.tech.sync}</dt>
      <dd><sw-badge kind=${syncKind(s.sync_state)} label=${syncWord(s.sync_state, t)}></sw-badge>${rec ? html` · <bdi>${rec}</bdi>` : nothing}</dd>
      ${tc.model ? html`<dt>${t.tech.model}</dt><dd><code>${tc.model}</code></dd>` : nothing}
      ${tc.firmware ? html`<dt>${t.tech.firmware}</dt><dd><code>${tc.firmware}</code></dd>` : nothing}
      <dt>${t.tech.relays}</dt>
      <dd>${fill(t.tech.relaysValue, { n: s.locks.length, mode: s.lock_enabled ? t.tech.relayOn : t.tech.relayOff })}</dd>
      ${clock ? html`<dt>${t.tech.clock}</dt><dd>${clock}</dd>` : nothing} ${streamText ? html`<dt>${t.tech.stream}</dt><dd>${streamText}</dd>` : nothing}
      ${s.errors ? html`<dt>${t.tech.lastError}</dt><dd>${s.errors.last_error ? html`<code data-wk-last-error>${s.errors.last_error}</code>` : html`<span class="muted">${t.tech.none}</span>`}</dd>` : nothing}
      ${s.errors?.scan_error ? html`<dt>${t.tech.scanError}</dt><dd><code>${s.errors.scan_error}</code></dd>` : nothing}
    </dl>
  </section>`;
}

function fetchNote(v: ViewCtx, f: Fetch<unknown>): TemplateResult | typeof nothing {
  const p = v.text.prog;
  if (f.state === 'ready') return nothing;
  const text = f.state === 'unsupported' ? p.unsupported : f.state === 'busy' ? p.busy : f.state === 'error' ? p.unavailable : p.loading;
  return html`<div class="muted" role="status" data-wk-fetch=${f.state}>${text}${f.state === 'error' || f.state === 'busy' ? html` · <wk-action-button tone="quiet" @click=${() => v.retryDetail()}>${v.text.retry}</wk-action-button>` : nothing}</div>`;
}

function programRows(v: ViewCtx, s: AccessStation, d: StationDetail | undefined): TemplateResult | typeof nothing {
  const t = v.text;
  if (!d || d.programs.state !== 'ready') return d ? fetchNote(v, d.programs) : html`<div class="muted" role="status" data-wk-fetch="loading">${t.prog.loading}</div>`;
  const views = programViews(d.programs.data, s, t);
  if (!views.length) return nothing;
  return html`${views.map(
    (p) => html`<div class="prog" data-wk-program=${p.door}>
      <div class="ph">
        <span>${p.name}</span>
        ${p.none
          ? html`<sw-badge kind="neutral" label=${t.prog.none}></sw-badge>`
          : html`<sw-badge kind=${p.removing ? 'stale' : p.enabled ? 'live' : 'offline'} label=${p.removing ? t.prog.removing : p.enabled ? t.prog.on : t.prog.off}></sw-badge>${p.status && p.enabled && !p.removing ? html`<sw-badge kind="recorded" label=${p.status}></sw-badge>` : nothing}`}
      </div>
      ${p.hours.map((h) => html`<div class="line">${t.prog.hours}: <bdi>${h}</bdi></div>`)}
      ${p.holidays ? html`<div class="line muted">${fill(t.prog.holidays, { n: p.holidays })}</div>` : nothing}
      ${p.error ? html`<div class="line"><sw-badge kind="error" label=${t.prog.error}></sw-badge></div>` : nothing}
      ${!p.none && p.unreadable ? html`<div class="line muted">${t.prog.unknownShape}</div>` : nothing}
    </div>`,
  )}`;
}

function codesRows(v: ViewCtx, d: StationDetail | undefined): TemplateResult | typeof nothing {
  const t = v.text;
  if (!d) return nothing;
  if (d.codes.state !== 'ready') return html`<div class="prog">${fetchNote(v, d.codes)}</div>`;
  const c = codesSummary(d.codes.data, t);
  return html`<div class="prog" data-wk-codes=${c.state}>
    <div class="ph"><span>${t.prog.codes}</span><sw-badge kind=${c.state === 'set' ? 'live' : c.state === 'unset' ? 'offline' : 'unknown'} label=${c.label}></sw-badge></div>
    ${c.slots.length > 1 ? c.slots.map((sl) => html`<div class="line">${sl.label}: ${sl.state === 'set' ? t.prog.codeConfigured : sl.state === 'unset' ? t.prog.codeNotConfigured : t.prog.codeUnknown}</div>`) : nothing}
  </div>`;
}

function doorSettings(v: ViewCtx, s: AccessStation): TemplateResult | typeof nothing {
  if (!s.technical) return nothing;
  const programs = v.features.door_programs !== false;
  const codes = v.features.public_codes !== false;
  if (!programs && !codes) return nothing;
  const t = v.text;
  const d = v.detail[s.id];
  return html`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(v.detailOpen)} data-wk-settings-toggle @click=${() => v.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${t.drawer.doorSettings}</span>
    </button>
    ${v.detailOpen ? html`${programs && stationDoors(s).length ? programRows(v, s, d) : nothing}${codes ? codesRows(v, d) : nothing}` : nothing}
  </section>`;
}

/** The drawer's content for a station the caller sees: the still (live video stays in the classic panel), the place, the sections. */
export function drawerBody(v: ViewCtx, s: AccessStation): TemplateResult {
  const t = v.text;
  const st = stillStateOf(v, s);
  const place = placeLabelOf(s.id, v.places);
  const doors = stationDoors(s);
  const showCall = v.rights.call || (showCallHint(v.policy, v.rights) && (s.online ? ['ringing', 'in_call', 'ending'].includes(s.call_state) : false));
  const active = s.online && ['ringing', 'in_call', 'ending'].includes(s.call_state);
  const tts = v.actions.tts[s.id];
  const ttsState = tts ? ttsStateText(tts, t) : '';
  return html`
    <div class="live ${s.online ? '' : 'off'}" data-wk-live data-still-state=${st}>
      ${st === 'image' ? html`<img src=${stillSrc(v, s)} alt=${fill(t.still.alt, { name: s.name })} decoding="async" @error=${() => v.stillError(s.id, v.poster)} />` : noPicture(v, s, st)}
      ${st === 'image' ? html`<span class="stamp"><bdi>${t.drawer.lastStill} · ${s.online ? stillTime(v.poster) : seenOf(v, s)}</bdi></span>` : nothing}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${t.drawer.liveClassic}</span><wk-action-button icon="window" href=${classicPanelHref()} data-wk-classic-link>${t.drawer.openClassic}</wk-action-button></div>
    </div>
    <div class="meta">${place ? html`<span>${place}</span>` : nothing}<span>${t.seen.prefix} <bdi>${seenOf(v, s)}</bdi></span></div>
    ${resultLine(v, s, true)}
    ${showCall
      ? html`<section class="dsec" data-wk-dsec="call">
          <h4>${wkIcon('phone', 14)}${t.drawer.call}</h4>
          ${active
            ? html`${callRow(v, s, true)}${v.rights.talk && s.call_state === 'in_call' ? talkLink(v, true) : nothing}`
            : html`<div class="callrow"><span class="cs muted">${t.call.none}</span>${v.rights.call && s.online ? html`<wk-action-button tone="dashed" icon="phone" href=${classicPanelHref()} data-wk-dial>${t.call.dial}</wk-action-button>` : nothing}</div>`}
        </section>`
      : nothing}
    ${doors.length || v.rights.door
      ? html`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${t.drawer.doors}</h4>
          ${doors.length
            ? doors.map((lock) => {
                const held = v.detail[s.id]?.programs.data?.programs.find((p) => p.door === lock.physical_index);
                const holding = held?.execution?.status === 'held_acknowledged';
                return html`<div class="doorrow" data-wk-doorrow=${lock.physical_index}>
                  <span class="dn">${doorName(lock, t)}</span>
                  <span class="ds">${holding ? html`<sw-icon name="clock" size=${12}></sw-icon>${t.prog.state.held_acknowledged}` : nothing}</span>
                  ${v.rights.door
                    ? html`<wk-action-button
                        icon="unlock"
                        data-wk-door=${`${s.id}/${lock.physical_index}`}
                        data-state=${v.actions.isHeld(`${s.id}/${lock.physical_index}`) ? 'held' : v.actions.releasing.has(`${s.id}/${lock.physical_index}`) ? 'sending' : 'idle'}
                        ?busy=${v.actions.releasing.has(`${s.id}/${lock.physical_index}`)}
                        ?disabled=${!v.live || !s.online || v.actions.releasing.has(`${s.id}/${lock.physical_index}`) || v.actions.isHeld(`${s.id}/${lock.physical_index}`)}
                        @click=${stop(() => v.door(s, lock.physical_index))}
                        >${v.actions.isHeld(`${s.id}/${lock.physical_index}`) ? t.door.held : v.actions.releasing.has(`${s.id}/${lock.physical_index}`) ? t.door.sending : t.door.open}</wk-action-button
                      >`
                    : nothing}
                </div>`;
              })
            : html`<span class="muted">${t.door.none}</span>`}
        </section>`
      : nothing}
    ${v.rights.announce
      ? html`<section class="dsec" data-wk-dsec="announce">
          <h4><sw-icon name="volume" size=${14}></sw-icon>${t.drawer.announce}</h4>
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${ttsState || t.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${s.id} ?disabled=${!v.live || !s.online} @click=${stop(() => v.announce(s.id))}>${t.announce}</wk-action-button></div>
        </section>`
      : nothing}
    ${technical(v, s)} ${doorSettings(v, s)}
  `;
}

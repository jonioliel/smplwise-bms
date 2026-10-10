import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/media-group-dialog';
import '../components/media-preset-editor';
import '../components/sw-dialog';
import '../components/sw-button';
import type { MediaGroupDialog } from '../components/media-group-dialog';
import type { MediaPresetEditor } from '../components/media-preset-editor';
import { draftOf } from '../components/media-preset-editor';
import { ApiError, describeError } from '../api/client';
import { subscribeHa } from '../api/ha';
import { isApi } from '../api/session';
import {
  PLAYER_KINDS, confirmPreview, effectiveCeiling, errorCode, isPlaying, memberOutcomeLine, playerErrorText, players, previewNames, resolveLeader, sendApplyPreset, sendGroupVolume,
  sendLeave, unmuteCeiling, type GroupPreset, type GroupPreview, type GroupRecord, type MediaGroup, type PlayerDevice, type PlayerLive, type PlayerStatus,
} from '../api/media-players';
import { artworkUrl } from '../api/media-screens';
import { onRouteChange, parseRoute, replaceRoute } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import { applyMultimediaKinds } from '../shell/nav';
import { phoneRestricted } from '../shell/phone';
import { bidi } from '../i18n/bidi';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { glyphIcon, mIcon, nameText } from '../components/media-icons';
import { playerView } from '../components/media-player-now';
import { runPlayerCommand } from '../components/media-player-run';
import { capPercent, presetFloors, presetIsLive, presetRooms, splitGroups, summarizeRecord } from './multimedia-players-layout';

type Phase = 'loading' | 'ready' | 'error' | 'forbidden' | 'disabled';

const PATH = '/multimedia/groups';
const asLive = (l: unknown) => l as PlayerLive;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** What a saved group's card shows while and after "הפעל": a spinner, then the outcome by room. */
interface PresetRun {
  pending: boolean;
  /** Rooms (by key) that did not make it. */
  failed: { key: string; room: string; text: string }[];
  ok: boolean;
  at: number;
}

/**
 * CR-016 "מולטימדיה › קבוצות" (mockup `players-index.html`, always the glass style): the live groups ("פועלות עכשיו": now playing,
 * play / pause, ONE group slider that scales every room by the same factor, "לפי חדר" - a slider and a leave button per room with
 * the outcome by name), the static groups and helper shortcuts, and the saved groups ("סלון + מטבח": the rooms, "הפעל" with the
 * running state and then "פועל" or the rooms that did not join by name). A group of 4 rooms or more, or spanning more than one
 * floor, asks once (media-group-dialog); a group for the whole building needs media.bulk (the server says so). Holders of
 * media.layout create, edit and delete saved groups here (the user menu's "עריכת הקבוצות השמורות", `?edit=1`) and in הגדרות › מולטימדיה.
 * Nothing is shown that `can` does not allow; every result is the server's, per room, never an optimistic "done".
 */
@customElement('multimedia-groups')
export class MultimediaGroups extends LitElement {
  /** `?player=<key>` of the address (the panel is the players page's; this page only keeps the parameter). */
  @property() playerKey = '';
  @state() private phase: Phase = 'loading';
  @state() private devices: PlayerDevice[] = [];
  @state() private groups: MediaGroup[] = [];
  @state() private presets: GroupPreset[] = [];
  @state() private status: PlayerStatus | null = null;
  @state() private compactHeader = false;
  @state() private staleError = '';
  @state() private toast = '';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private editing = false;
  @state() private byRoom = '';
  @state() private runs = new Map<string, PresetRun>();
  /** The last outcome of a group volume / leave, by room, per leader key (a short line under the room's name). */
  @state() private notes = new Map<string, Map<string, { text: string; bad: boolean }>>();
  @state() private deleting: GroupPreset | null = null;
  @state() private busy = false;
  @state() private actionError = '';
  /** Values of sliders while the finger is down (the server's answer replaces them). */
  @state() private local = new Map<string, number>();
  @query('media-group-dialog') private dialog?: MediaGroupDialog;
  @query('media-preset-editor') private editor?: MediaPresetEditor;

  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offRoute: (() => void) | null = null;
  private offEdit: (() => void) | null = null;
  private offPush: (() => void) | null = null;
  private refreshTimer = 0;
  private pollTimer = 0;
  private toastTimer = 0;
  private sliderTimers = new Map<string, number>();
  private wantsEdit = false;
  private editHandled = false;
  private loading = false;
  private stopped = false;

  static styles = [mediaGlassStyles, mediaPageStyles, css`
    .ggrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg);
      align-items: start;
    }
    .gcard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px 18px;
      min-inline-size: 0;
      transition: box-shadow var(--mm-motion) var(--mm-ease), transform var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    .gcard.lit {
      border-color: rgb(var(--art) / 0.34);
      box-shadow: 0 22px 56px rgb(var(--art) / var(--mm-art-halo-alpha)), var(--dv-shadow-1);
    }
    .gcard > :not(.gbox):not(.ecard) {
      position: relative;
      z-index: 1;
    }
    .gbox {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }
    .gbox .art {
      inset: -35%;
      filter: blur(var(--mm-art-glow-blur)) saturate(1.5);
      opacity: var(--mm-art-glow-alpha);
      -webkit-mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
      mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
    }
    .gbox::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mm-art-veil);
    }
    .gcard.editing {
      outline: 2px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
      outline-offset: 4px;
    }
    .gh {
      display: flex;
      align-items: center;
      gap: 12px;
      min-inline-size: 0;
    }
    .gi {
      flex: none;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-lg);
      display: grid;
      place-items: center;
      color: #fff;
      background: linear-gradient(135deg, #0b3a5c, #3b8bd9);
      box-shadow: 0 8px 18px rgba(11, 58, 92, 0.28);
    }
    .gi.src {
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      box-shadow: none;
    }
    .gi .ic {
      font-size: var(--sw-fs-2xl);
    }
    .gh .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .gh .tx b {
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gh .tx small {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gnp {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px;
      border-radius: var(--sw-r-lg);
      background: var(--dv-surface-2);
      border: 1px solid var(--dv-border);
    }
    .gnp .thumb {
      position: relative;
      inline-size: 52px;
      block-size: 52px;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      color: #fff;
      box-shadow: 0 8px 18px rgb(var(--art, 20 24 34) / 0.32);
    }
    .gnp .t {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.3;
    }
    .gnp .t b {
      font-size: var(--sw-fs-md);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gnp .t small {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pk {
      position: relative;
      flex: none;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      border: 0;
      display: grid;
      place-items: center;
      background: var(--dv-text);
      color: var(--mm-text-inverse);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
      transition: transform 120ms var(--mm-ease);
    }
    .pk .ic {
      font-size: var(--sw-fs-2xl);
      stroke-width: 2;
    }
    .pk:active {
      transform: scale(0.92);
    }
    .pk[disabled] {
      opacity: 0.38;
      pointer-events: none;
    }
    .vrow {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 2px;
      min-inline-size: 0;
    }
    .vrow .vv {
      min-inline-size: 30px;
      text-align: end;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .vrow .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      font-weight: 600;
      flex: none;
      min-inline-size: 52px;
    }
    .rng {
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      min-inline-size: 0;
      block-size: 44px;
      background: transparent;
      margin: 0;
    }
    .rng::-webkit-slider-runnable-track {
      block-size: 8px;
      border-radius: 999px;
      background: linear-gradient(to left, var(--dv-accent) var(--v, 50%), var(--dv-surface-3) var(--v, 50%));
    }
    .rng::-moz-range-track {
      block-size: 8px;
      border-radius: 999px;
      background: var(--dv-surface-3);
    }
    .rng::-moz-range-progress {
      block-size: 8px;
      border-radius: 999px;
      background: var(--dv-accent);
    }
    .rng::-webkit-slider-thumb {
      -webkit-appearance: none;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      background: #fff;
      margin-block-start: -9px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
    }
    .rng::-moz-range-thumb {
      inline-size: 26px;
      block-size: 26px;
      border: 0;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
    }
    .rng[disabled] {
      opacity: 0.4;
    }
    .rng.sm::-webkit-slider-runnable-track {
      block-size: 6px;
    }
    .rng.sm::-webkit-slider-thumb {
      inline-size: 20px;
      block-size: 20px;
      margin-block-start: -7px;
    }
    .rng.sm::-moz-range-thumb {
      inline-size: 20px;
      block-size: 20px;
    }
    .rngwrap {
      position: relative;
      flex: 1;
      min-inline-size: 0;
      display: flex;
      align-items: center;
    }
    .rngwrap .cap {
      position: absolute;
      inset-block: 18px;
      inset-inline-end: calc(var(--cap) - 1px);
      inline-size: 2px;
      border-radius: 1px;
      background: var(--dv-warning);
      pointer-events: none;
      opacity: 0.9;
    }
    .psh {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .psh h4 {
      margin: 0;
      font-size: var(--sw-fs-base);
      font-weight: 700;
      color: var(--dv-text-2);
    }
    .lnk {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 44px;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      color: var(--dv-accent-text);
    }
    .lnk:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .members {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mrow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(90px, 150px) 34px auto;
      align-items: center;
      gap: 10px;
      min-block-size: var(--mm-member-row-h);
      padding: 6px 12px;
      border-radius: var(--sw-r-lg);
      background: var(--dv-surface-2);
      border: 1px solid var(--dv-border);
    }
    .mrow .nm {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.25;
    }
    .mrow .nm b {
      font-size: var(--sw-fs-base);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mrow .nm small {
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mrow .nm small.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .mrow .nm small.ok {
      color: var(--dv-success);
      font-weight: 600;
    }
    .mrow .vv {
      font-size: var(--sw-fs-base);
      font-weight: 700;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .mrow .rb {
      inline-size: 44px;
      block-size: 44px;
    }
    .mrow .rb .ic {
      font-size: var(--sw-fs-lg);
    }
    .mrow.lead {
      border-color: color-mix(in srgb, var(--dv-accent) 35%, transparent);
    }
    .mrow.dim {
      opacity: 0.55;
    }
    .roomchips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .roomchips .chipx {
      block-size: 28px;
      padding-inline: 10px;
      font-size: var(--sw-fs-sm);
    }
    .roomchips .chipx .ic {
      color: var(--dv-text-3);
    }
    .roomchips .chipx.bad {
      border-color: color-mix(in srgb, var(--dv-danger) 40%, transparent);
      color: var(--dv-danger);
    }
    .roomchips .chipx.bad .ic {
      color: var(--dv-danger);
    }
    .roomchips .chipx.ok .ic {
      color: var(--dv-success);
    }
    .gfoot {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .gfoot .st {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
    }
    .gfoot .st.ok {
      color: var(--sw-success-text);
      font-weight: 600;
    }
    .gfoot .st.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .gfoot .btn.pend .ic {
      animation: mm-spin 0.8s linear infinite;
    }
    .gcard > .ecard {
      z-index: 6;
      inset-block-start: 14px;
      inset-inline-end: auto;
      inset-inline-start: 14px;
    }
    .qbtn {
      color: var(--dv-text-2);
    }
    @media (max-width: 767px) {
      .ggrid {
        grid-template-columns: minmax(0, 1fr);
      }
      .mrow {
        grid-template-columns: minmax(0, 1fr) minmax(70px, 110px) 30px auto;
        padding-inline: 10px;
        gap: 8px;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
    this.stopped = false;
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    this.offEdit = registerScreenEdit({
      id: 'multimedia-groups-edit',
      label: 'עריכת הקבוצות השמורות',
      icon: 'edit',
      can: () => this.canEdit && !this.editing,
      run: () => this.enterEdit(),
    });
    this.offRoute = onRouteChange((r) => {
      if (r.mode !== 'multimedia' || r.segments[1] !== 'groups') return;
      this.wantsEdit = r.params.get('edit') === '1';
      if (!this.wantsEdit) {
        this.editHandled = false;
        this.editing = false;
      }
      this.requestUpdate();
    });
    this.wantsEdit = parseRoute().params.get('edit') === '1';
    void this.load();
    if (isApi()) {
      this.offPush = subscribeHa(
        (m) => {
          if (m.type === 'media_state') this.devices = this.devices.map((d) => (d.key === m.device_key ? { ...d, live: asLive(m.live) } : d));
          else if (m.type === 'media_devices_changed' || m.type === 'media_groups_changed') this.scheduleRefresh(200);
        },
        (connected) => {
          if (connected) this.scheduleRefresh(200);
        },
      );
    }
    this.pollTimer = window.setInterval(() => void this.load(), 30_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopped = true;
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.removeEventListener('scroll', this.onScroll);
    this.offEdit?.();
    this.offRoute?.();
    this.offPush?.();
    this.offEdit = this.offRoute = this.offPush = null;
    for (const t of [this.refreshTimer, this.toastTimer, ...this.sliderTimers.values()]) window.clearTimeout(t);
    window.clearInterval(this.pollTimer);
  }

  protected updated() {
    measureHeaderBar(this.renderRoot, this.phone);
    if (this.wantsEdit && !this.editHandled && this.phase === 'ready') {
      this.editHandled = true;
      if (this.canEdit) this.enterEdit(true);
      else this.dropParam('edit');
    }
  }

  // ------------------------------------------------------------------------------------------------ data

  private get canEdit(): boolean {
    return this.phase === 'ready' && !!this.status?.can.layout && !phoneRestricted('layout_editor');
  }
  private get canGroup(): boolean {
    return !!this.status?.can.group;
  }
  private get canControl(): boolean {
    return !!this.status?.can.control;
  }

  private async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const st = await players().status();
      this.status = st;
      applyMultimediaKinds(st.counts);
      if (!st.enabled) {
        this.phase = 'disabled';
        return;
      }
      if (!st.can.read) {
        this.phase = 'forbidden';
        return;
      }
      const [list, groups, presets] = await Promise.all([players().list({ kind: PLAYER_KINDS }), players().groups(), players().presets()]);
      this.devices = list.devices;
      this.groups = groups;
      this.presets = presets;
      this.local = new Map();
      this.phase = 'ready';
      this.staleError = '';
      for (const p of presets) if (p.running && !this.runs.has(p.id)) void this.followPreset(p.id, p.running.bulk_id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.phase = 'forbidden';
      else if (err instanceof ApiError && err.code === 'feature_disabled') this.phase = 'disabled';
      else if (this.phase === 'ready') this.staleError = describeError(err);
      else {
        this.phase = 'error';
        this.staleError = describeError(err);
      }
    } finally {
      this.loading = false;
    }
  }

  private scheduleRefresh(ms: number) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => void this.load(), ms);
  }

  private say(text: string) {
    this.toast = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 3200);
  }

  private dropParam(name: string) {
    const p = new URLSearchParams(parseRoute().params);
    p.delete(name);
    replaceRoute(PATH, p);
  }

  private onScroll = () => {
    const y = this.scrollTop;
    if (!this.compactHeader && y > 60) this.compactHeader = true;
    else if (this.compactHeader && y < 12) this.compactHeader = false;
  };

  private enterEdit(fromRoute = false) {
    if (!this.canEdit || this.editing) return;
    this.editing = true;
    this.editHandled = true;
    if (!fromRoute) {
      const p = new URLSearchParams(parseRoute().params);
      p.set('edit', '1');
      replaceRoute(PATH, p);
    }
    this.scrollTo({ top: 0 });
  }

  private leaveEdit() {
    this.editing = false;
    this.editHandled = false;
    this.dropParam('edit');
  }

  private dev(key: string): PlayerDevice | undefined {
    return this.devices.find((d) => d.key === key);
  }

  // ------------------------------------------------------------------------------------------------ actions

  /** A record read to its end (6 s at most); null when it cannot be read (the static demo has none for every action). */
  private async record(bulkId: string): Promise<GroupRecord | null> {
    const deadline = Date.now() + 6000;
    let last: GroupRecord | null = null;
    while (Date.now() < deadline && !this.stopped) {
      try {
        last = await players().groupRecord(bulkId);
        if (last.status === 'done') return last;
      } catch {
        return last;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return last;
  }

  private setRun(id: string, run: PresetRun | null) {
    const next = new Map(this.runs);
    if (run) next.set(id, run);
    else next.delete(id);
    this.runs = next;
  }

  private async followPreset(id: string, bulkId: string) {
    this.setRun(id, { pending: true, failed: [], ok: false, at: Date.now() });
    const rec = await this.record(bulkId);
    this.finishRun(id, rec);
  }

  private finishRun(id: string, rec: GroupRecord | null) {
    const s = summarizeRecord(rec);
    const by = new Map((rec?.members ?? []).map((m) => [m.device_key, m]));
    this.setRun(id, {
      pending: false, ok: s.failed.length === 0, at: Date.now(),
      failed: s.failed.map((f) => ({ key: f.key, room: f.room, text: memberOutcomeLine(f.room, by.get(f.key)?.outcome ?? f.outcome) })),
    });
    this.scheduleRefresh(150);
  }

  private async apply(p: GroupPreset, confirmed = false) {
    if (this.runs.get(p.id)?.pending) return;
    this.actionError = '';
    this.setRun(p.id, { pending: true, failed: [], ok: false, at: Date.now() });
    try {
      const r = await sendApplyPreset(p.id, confirmed);
      const rec = await this.record(r.bulk_id);
      this.finishRun(p.id, rec);
    } catch (err) {
      this.setRun(p.id, null);
      const preview = confirmPreview(err);
      if (preview) {
        const floors = preview.floors;
        this.dialog?.confirm({
          heading: `לצרף ${preview.devices} חדרים לקבוצה אחת?`,
          sub: floors > 1 ? `הקבוצה תשמיע ב־${floors} קומות.` : undefined,
          names: previewNames(preview),
          ok: 'צרף',
          run: async () => {
            await this.apply(p, true);
          },
        });
      } else this.say(playerErrorText(err));
    }
  }

  private async ungroup(g: MediaGroup) {
    try {
      const r = await sendLeave([g.leader_key]);
      await this.record(r.bulk_id);
      this.scheduleRefresh(100);
    } catch (err) {
      this.say(playerErrorText(err));
    }
  }

  private async leaveRoom(key: string) {
    try {
      const r = await sendLeave([key]);
      await this.record(r.bulk_id);
      this.scheduleRefresh(100);
    } catch (err) {
      this.say(playerErrorText(err));
    }
  }

  /** A command to a static group or a party answers 409 confirm_required with the preview: ask once, then resend with `confirmed: true`. */
  private askParty = (pv: GroupPreview): Promise<boolean> =>
    new Promise((resolve) => {
      const dlg = this.dialog;
      if (!dlg) return resolve(false);
      dlg.confirm({
        heading: `לשלוט ב־${pv.devices} חדרים יחד?`, sub: pv.floors > 1 ? `הקבוצה משמיעה ב־${pv.floors} קומות.` : undefined, names: previewNames(pv), ok: 'בצע',
        run: async () => resolve(true), cancel: () => resolve(false),
      });
    });

  private async togglePlay(leaderKey: string) {
    const o = await runPlayerCommand(leaderKey, { command: 'transport', action: 'play_pause' }, undefined, this.askParty);
    if ((o.outcome === 'refused' || o.outcome === 'not_confirmed') && o.message) this.say(o.message);
    this.scheduleRefresh(isApi() ? 600 : 30);
  }

  /** The rooms' leaders of a helper shortcut: each live group once (a member plays with its leader). A helper group has no device of its own to command (the
   * server lists none of it), so its play / pause is a fan-out: ONE ordinary command per leader, each checked and audited like a press on that player. */
  private helperLeaders(g: MediaGroup): PlayerDevice[] {
    const out = new Map<string, PlayerDevice>();
    for (const m of g.members) {
      const d = this.dev(m.key);
      if (d && d.can.control && d.live.caps_known && d.live.power === 'on') {
        const lead = resolveLeader(d, this.devices);
        out.set(lead.key, lead);
      }
    }
    return [...out.values()];
  }

  private async toggleHelper(g: MediaGroup) {
    const leaders = this.helperLeaders(g);
    const playing = leaders.filter(isPlaying);
    const targets = playing.length ? playing : leaders.filter((l) => l.live.play === 'paused');
    const action = playing.length ? 'pause' : 'play';
    let problem = '';
    for (const l of targets) {
      const o = await runPlayerCommand(l.key, { command: 'transport', action });
      if (!problem && (o.outcome === 'refused' || o.outcome === 'not_confirmed')) problem = o.message;
    }
    if (problem) this.say(problem);
    this.scheduleRefresh(isApi() ? 600 : 30);
  }

  private async mute(key: string, muted: boolean) {
    // an unmute reveals the old level: above a ceiling set later the server refuses, so the level goes down to the ceiling first
    const d = this.dev(key);
    const ceiling = muted && d ? unmuteCeiling(d) : null;
    if (ceiling !== null) await runPlayerCommand(key, { command: 'volume_set', level: ceiling });
    const o = await runPlayerCommand(key, { command: 'mute', muted: !muted });
    if (o.outcome === 'refused' || o.outcome === 'not_confirmed') this.say(o.message);
    this.scheduleRefresh(isApi() ? 600 : 30);
  }

  /** One slider, one request: the last value wins after a short quiet (the server's rate is 2/s per group). */
  private slide(id: string, value: number, send: () => Promise<void>) {
    const next = new Map(this.local);
    next.set(id, value);
    this.local = next;
    window.clearTimeout(this.sliderTimers.get(id));
    this.sliderTimers.set(id, window.setTimeout(() => void send(), 350));
  }

  private groupSlide(g: MediaGroup, value: number) {
    this.slide(`g:${g.leader_key}`, value, async () => {
      try {
        const r = await sendGroupVolume(g.leader_key, value, 'relative');
        const rec = await this.record(r.bulk_id);
        const names = new Map<string, { text: string; bad: boolean }>();
        for (const m of rec?.members ?? []) {
          if (m.outcome === 'clamped') names.set(m.device_key, { text: 'הוגבל לתקרה', bad: false });
          else if (m.outcome === 'skipped_muted') names.set(m.device_key, { text: 'מושתק', bad: false });
          else if (m.outcome === 'skipped_unavailable' || m.outcome === 'skipped_off') names.set(m.device_key, { text: m.outcome === 'skipped_off' ? 'כבוי' : 'לא זמין', bad: false });
          else if (m.outcome === 'not_allowed' || m.outcome === 'unknown') names.set(m.device_key, { text: m.outcome === 'not_allowed' ? 'אין הרשאה' : 'לא ידוע', bad: true });
        }
        const all = new Map(this.notes);
        all.set(g.leader_key, names);
        this.notes = all;
      } catch (err) {
        if (errorCode(err) !== 'rate_limited') this.say(playerErrorText(err));
      }
      this.scheduleRefresh(100);
    });
  }

  private roomSlide(key: string, value: number) {
    this.slide(`m:${key}`, value, async () => {
      const o = await runPlayerCommand(key, { command: 'volume_set', level: value });
      if (o.outcome === 'refused' || o.outcome === 'not_confirmed') this.say(o.message);
      this.scheduleRefresh(100);
    });
  }

  private async deletePreset() {
    const p = this.deleting;
    if (!p || this.busy) return;
    this.busy = true;
    this.actionError = '';
    try {
      await players().deletePreset(p.id, p.revision);
      this.deleting = null;
      this.say('נמחק');
      await this.load();
    } catch (err) {
      this.actionError = playerErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------------ render

  private rangeStyle(v: number) {
    return `--v:${v}%`;
  }

  private thumb(leader: PlayerDevice | undefined) {
    if (!leader) return nothing;
    const v = playerView(leader);
    if (!(v.playing || v.paused)) return nothing;
    return html`<div class="thumb" style=${`--art:${v.rgb}`}><div class="art" style=${`--a1:${v.a1};--a2:${v.a2}`}>${glyphIcon(v.glyph, undefined, 'gl')}${v.artwork ? html`<img src=${artworkUrl(v.artwork)} alt="" loading="lazy" />` : nothing}</div></div>`;
  }

  private memberRow(g: MediaGroup, m: MediaGroup['members'][number], opts: { leave: boolean }): TemplateResult {
    const d = this.dev(m.key);
    const isLead = m.key === g.leader_key && !g.static;
    const note = this.notes.get(g.leader_key)?.get(m.key);
    const level = this.local.get(`m:${m.key}`) ?? m.volume ?? 0;
    const can = this.canControl && !!d?.can.control && !!d?.caps.volume_set && m.available;
    const cap = d ? capPercent(effectiveCeiling(d)) : null;
    const sub = note ? html`<small class=${note.bad ? 'bad' : 'ok'}>${note.text}</small>` : html`<small>${isLead ? html`${bidi(m.area_name ?? '')}${m.area_name ? ' · ' : ''}מוביל` : bidi(m.area_name ?? '')}</small>`;
    const action = opts.leave && !isLead && this.canGroup
      ? html`<button type="button" class="rb" data-leave=${m.key} aria-label=${`נתק · ${m.name}`} title="נתק" @click=${() => void this.leaveRoom(m.key)}>${mIcon('unlink')}</button>`
      : html`<button type="button" class=${classMap({ rb: true, muted: !!m.muted })} aria-pressed=${String(!!m.muted)} aria-label=${`${m.muted ? 'בטל השתקה' : 'השתק'} · ${m.name}`} ?disabled=${!can} @click=${() => void this.mute(m.key, !!m.muted)}>${mIcon(m.muted ? 'volOff' : 'vol')}</button>`;
    return html`<div class=${classMap({ mrow: true, lead: isLead, dim: !m.available })} data-member=${m.key}>
      <div class="nm"><b>${nameText(bidi(m.name))}</b>${sub}</div>
      <span class="rngwrap">${cap !== null ? html`<span class="cap" style=${`--cap:${cap}%`}></span>` : nothing}<input class="rng sm" type="range" min="0" max="100" .value=${String(level)} style=${this.rangeStyle(level)} aria-label=${`עוצמה · ${m.name}`} ?disabled=${!can} @input=${(e: Event) => this.roomSlide(m.key, Number((e.target as HTMLInputElement).value))} /></span>
      <span class="vv"><span class="n">${can || m.volume !== null ? level : '—'}</span></span>${action}
    </div>`;
  }

  private groupVolume(g: MediaGroup): TemplateResult | typeof nothing {
    if (!this.canControl || !g.can.volume) return nothing;
    const v = this.local.get(`g:${g.leader_key}`) ?? g.volume ?? 0;
    return html`<div class="vrow"><span class="lbl">קבוצה</span><input class="rng" type="range" min="0" max="100" .value=${String(v)} style=${this.rangeStyle(v)} data-group-volume=${g.leader_key} aria-label="עוצמת הקבוצה" @input=${(e: Event) => this.groupSlide(g, Number((e.target as HTMLInputElement).value))} /><span class="vv"><span class="n">${v}</span></span></div>`;
  }

  /** A live group, a static group or a helper shortcut. */
  private groupCard(g: MediaGroup, type: 'live' | 'static' | 'helper'): TemplateResult {
    const leader = this.dev(g.leader_key);
    const v = leader ? playerView(leader) : null;
    const lit = !!v?.rgb && (v.playing || v.paused);
    const rooms = g.members.map((m) => m.area_name || m.name);
    const state = !leader || type === 'helper' ? '' : v?.playing ? ' · מנגן' : v?.paused ? ' · מושהה' : ' · לא מנגן';
    const sub = type === 'helper' ? `קבוצה וירטואלית · ${plural(g.members.length, 'חדר אחד', 'חדרים')}` : `${plural(g.members.length, 'חדר אחד', 'חדרים')}${g.floor_ids.length > 1 ? ` · ${g.floor_ids.length} קומות` : ''}${state}`;
    const title = type === 'live' ? rooms.join(' + ') : g.name;
    const hl = type === 'helper' && this.canControl ? this.helperLeaders(g) : [];
    const hPlaying = hl.some(isPlaying);
    const helperToggle = hl.length && (hPlaying || hl.some((l) => l.live.play === 'paused'))
      ? html`<button type="button" class="rb" data-helper-toggle=${g.leader_key} aria-label=${`${hPlaying ? 'השהה' : 'המשך'} · ${g.name}`} @click=${() => void this.toggleHelper(g)}>${mIcon(hPlaying ? 'pause' : 'play')}</button>`
      : nothing;
    const np = leader && (v?.playing || v?.paused) && v
      ? html`<div class="gnp">${this.thumb(leader)}<div class="t"><b>${nameText(v.title || leader.live.now.title || '')}</b><small>${nameText(v.sub)}</small></div>${this.canControl && leader.can.control ? html`<button type="button" class="pk" aria-label=${`${v.playing ? 'השהה' : 'המשך'} · ${title}`} @click=${() => void this.togglePlay(g.leader_key)}>${mIcon(v.playing ? 'pause' : 'play')}</button>` : nothing}</div>`
      : nothing;
    const showRows = !this.phone || this.byRoom === g.leader_key;
    const toggle = this.phone ? html`<button type="button" class="lnk" data-by-room=${g.leader_key} aria-expanded=${String(this.byRoom === g.leader_key)} @click=${() => (this.byRoom = this.byRoom === g.leader_key ? '' : g.leader_key)}>לפי חדר${mIcon('chevronDown')}</button>` : nothing;
    return html`<article class=${classMap({ gcard: true, glass: true, lit })} style=${lit ? `--art:${v!.rgb}` : ''} aria-label=${`קבוצה · ${title}`} data-group-card=${g.leader_key} data-group-type=${type}>
      <span class="gbox" aria-hidden="true">${lit && v ? html`<div class="art" style=${`--a1:${v.a1};--a2:${v.a2}`}>${v.artwork ? html`<img src=${artworkUrl(v.artwork)} alt="" />` : nothing}</div>` : nothing}</span>
      <header class="gh"><span class="gi">${mIcon('group')}</span><div class="tx"><b>${nameText(bidi(title))}</b><small>${sub}</small></div>
        ${helperToggle}${type === 'live' && this.canGroup ? html`<button type="button" class="btn sm quiet" data-ungroup=${g.leader_key} @click=${() => void this.ungroup(g)}>${mIcon('unlink')}פרק</button>` : nothing}</header>
      ${np}${this.groupVolume(g)}
      <div class="psh"><h4>לפי חדר</h4>${toggle}</div>
      ${showRows ? html`<div class="members">${g.members.map((m) => this.memberRow(g, m, { leave: type === 'live' }))}</div>` : nothing}
    </article>`;
  }

  private presetCard(p: GroupPreset): TemplateResult {
    const rooms = presetRooms(p, this.devices);
    const floors = presetFloors(p, this.devices);
    const run = this.runs.get(p.id);
    const live = presetIsLive(p, this.devices);
    const failedKeys = new Set((run && !run.pending ? run.failed : []).map((f) => f.key));
    const leader = rooms[0];
    const chips = rooms.map((r) => {
      const bad = failedKeys.has(r.key) || r.missing;
      const ok = !!run && !run.pending && run.ok && !r.missing;
      const vol = p.volumes?.[r.key];
      return html`<span class=${classMap({ chipx: true, bad, ok })}>${mIcon(bad ? 'warning' : ok ? 'check' : 'speaker')}${nameText(bidi(r.room))}${vol !== undefined ? html` <span class="n">${vol}</span>` : nothing}</span>`;
    });
    let foot: TemplateResult;
    if (run?.pending) foot = html`<span class="st" data-preset-state="running">${mIcon('group')}מצרף…</span>`;
    else if (run && run.failed.length) foot = html`<span class="st bad" data-preset-state="partial">${mIcon('warning')}${run.failed.map((f) => f.text).join(', ')}</span>`;
    else if (live) foot = html`<span class="st ok" data-preset-state="live">${mIcon('check')}פועל</span>`;
    else if (p.missing.length) foot = html`<span class="st bad" data-preset-state="missing">${mIcon('warning')}${plural(p.missing.length, 'חדר אחד לא מוגדר', 'חדרים לא מוגדרים')}</span>`;
    else foot = html`<span class="st" data-preset-state="idle">${plural(rooms.length, 'חדר אחד', 'חדרים')}${floors > 1 ? ` · ${floors} קומות` : ''}${p.volumes ? ' · עם עוצמות' : ''}</span>`;
    const act = this.canGroup
      ? html`<button type="button" class=${classMap({ btn: true, primary: !live, quiet: live, pend: !!run?.pending })} data-apply=${p.id} ?disabled=${live || !!run?.pending || p.missing.length > 0} @click=${() => void this.apply(p)}>${mIcon('play')}הפעל</button>`
      : nothing;
    const ed = this.editing
      ? html`<span class="ecard"><button type="button" data-preset-edit=${p.id} aria-label=${`ערוך · ${p.name}`} @click=${() => this.editor?.show(draftOf(p))}>${mIcon('edit')}</button><button type="button" data-preset-delete=${p.id} aria-label=${`מחק · ${p.name}`} @click=${() => { this.actionError = ''; this.deleting = p; }}>${mIcon('trash')}</button></span>`
      : nothing;
    return html`<article class=${classMap({ gcard: true, glass: true, editing: this.editing })} aria-label=${`קבוצה שמורה · ${p.name}`} data-preset=${p.id}>${ed}
      <header class="gh"><span class="gi src">${mIcon('star')}</span><div class="tx"><b>${nameText(bidi(p.name))}</b><small>${leader ? html`מוביל: ${nameText(bidi(leader.room))}` : nothing}</small></div></header>
      <div class="roomchips">${chips}</div>
      <div class="gfoot">${foot}<span class="grow"></span>${act}</div>
    </article>`;
  }

  private header(): TemplateResult {
    const { live } = splitGroups(this.groups, this.devices);
    const n = this.presets.length;
    const sub = [live.length ? html`${live.length === 1 ? html`<em>קבוצה אחת</em> פועלת` : html`<em><span class="n">${live.length}</span></em> קבוצות פועלות`}` : null, n ? html`<span class="n">${n}</span> שמורות` : null].filter(Boolean);
    return html`<header class=${classMap({ dh: true, compact: this.compactHeader })} data-mm-header>
      <div class="dh-row"><h1>קבוצות</h1><span class="grow"></span></div>
      ${this.phase === 'ready' && !this.editing && sub.length ? html`<div class="dh-det"><span class="amb">${sub.map((s, i) => html`${i ? ' · ' : ''}${s}`)}</span></div>` : nothing}
    </header>`;
  }

  private skeleton(): TemplateResult {
    const card = html`<div class="glass gcard" style="padding:16px 18px"><div style="display:flex;gap:12px;align-items:center"><span class="skl" style="inline-size:44px;block-size:44px;border-radius:14px"></span><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div></div><span class="skl" style="block-size:44px;border-radius:999px"></span><span class="skl" style="block-size:36px;border-radius:12px"></span></div>`;
    return html`<div data-mm-state="loading" aria-busy="true"><div class="ggrid">${Array.from({ length: this.phone ? 2 : 3 }, () => card)}</div></div>`;
  }

  private stateBox(icon: 'group' | 'warning' | 'power', title: string, action?: TemplateResult, small = false): TemplateResult {
    return html`<div class="statebox glass" role="status" style=${small ? 'padding:36px 24px' : ''}><span class="ring">${mIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private editBar(): TemplateResult {
    return html`<div class="editbar" data-mm-editbar><span class="t">${mIcon('edit')}עריכת הקבוצות השמורות</span><span class="grow"></span>
      <button type="button" class="btn sm quiet" data-preset-new @click=${() => this.editor?.show(draftOf(null))}>${mIcon('plus')}קבוצה חדשה</button>
      <button type="button" class="btn sm primary" data-mm-done @click=${() => this.leaveEdit()}>${mIcon('check')}סיום</button></div>`;
  }

  private body(): TemplateResult | typeof nothing {
    if (this.phase === 'loading') return this.skeleton();
    if (this.phase === 'error') return html`<div data-mm-state="error">${this.stateBox('warning', 'לא ניתן לטעון את הקבוצות', html`<button type="button" class="btn sm" data-mm-retry @click=${() => { this.phase = 'loading'; void this.load(); }}>${mIcon('refresh')}נסה שוב</button>`)}</div>`;
    if (this.phase === 'forbidden') return html`<div data-mm-state="forbidden">${this.stateBox('group', 'אין הרשאת צפייה בקבוצות')}</div>`;
    if (this.phase === 'disabled') return html`<div data-mm-state="disabled">${this.stateBox('power', 'המולטימדיה כבויה')}</div>`;
    const { live, static: stat, helpers } = splitGroups(this.groups, this.devices);
    const stale = this.staleError ? html`<div class="errbar" role="alert" data-mm-stale>${mIcon('warning')}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${() => void this.load()}>נסה שוב</button></div>` : nothing;
    const newBtn = this.canEdit && !this.editing ? html`<button type="button" class="btn sm quiet" data-preset-new @click=${() => this.editor?.show(draftOf(null))}>${mIcon('plus')}קבוצה חדשה</button>` : nothing;
    const liveSec = html`<section class="fsec" data-section="live"><header class="sh"><div><h2>פועלות עכשיו</h2>${live.length ? html`<small>${plural(live.length, 'קבוצה אחת', 'קבוצות')}</small>` : nothing}</div></header>
      ${live.length ? html`<div class="ggrid">${live.map((g) => this.groupCard(g, 'live'))}</div>` : this.stateBox('group', 'אין קבוצה פעילה', undefined, true)}</section>`;
    const statics = [...stat.map((g) => ({ g, t: 'static' as const })), ...helpers.map((g) => ({ g, t: 'helper' as const }))];
    const staticSec = statics.length ? html`<section class="fsec" data-section="static"><header class="sh"><div><h2>קבוצות קבועות</h2><small>${plural(statics.length, 'קבוצה אחת', 'קבוצות')}</small></div></header><div class="ggrid">${statics.map((x) => this.groupCard(x.g, x.t))}</div></section>` : nothing;
    const savedSec = html`<section class="fsec" data-section="saved"><header class="sh"><div><h2>קבוצות שמורות</h2><small><span class="n">${this.presets.length}</span> שמורות</small></div><span class="grow"></span>${newBtn}</header>
      ${this.presets.length ? html`<div class="ggrid">${this.presets.map((p) => this.presetCard(p))}</div>` : this.stateBox('group', 'אין קבוצות שמורות', undefined, true)}</section>`;
    return html`${stale}${this.editing ? this.editBar() : nothing}<div class="groups" data-mm-state="ready">${liveSec}${staticSec}${savedSec}</div>`;
  }

  private deleteDialog(): TemplateResult {
    const p = this.deleting;
    if (!p) return html`<sw-dialog data-preset-delete-dialog="closed"></sw-dialog>`;
    return html`<sw-dialog open ?locked=${this.busy} heading=${`למחוק את "${p.name}"?`} data-preset-delete-dialog="open" @close=${() => (this.deleting = null)}>
      ${this.actionError ? html`<div style="color:var(--sw-danger);font-size:var(--sw-fs-sm)" role="alert">${this.actionError}</div>` : nothing}
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-pd-no autofocus ?disabled=${this.busy} @click=${() => (this.deleting = null)}>ביטול</sw-button>
        <sw-button variant="danger" data-pd-yes ?disabled=${this.busy} @click=${() => void this.deletePreset()}>מחק</sw-button>
      </div></sw-dialog>`;
  }

  render() {
    return html`<div class="page" data-screen="multimedia-groups">${this.header()}${this.body()}</div>
    <media-group-dialog @group-done=${() => void this.load()}></media-group-dialog>
    <media-preset-editor .devices=${this.devices} @preset-saved=${() => { this.say('נשמר'); void this.load(); }} @preset-stale=${() => void this.load()}></media-preset-editor>
    ${this.deleteDialog()}
    ${this.toast ? html`<div class="toast" role="status">${mIcon('check')}${this.toast}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'multimedia-groups': MultimediaGroups;
  }
}

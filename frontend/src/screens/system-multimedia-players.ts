import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/media-preset-editor';
import '../components/media-ma-connection';
import type { MediaPresetEditor } from '../components/media-preset-editor';
import { draftOf } from '../components/media-preset-editor';
import { ApiError, describeError } from '../api/client';
import { subscribeHa } from '../api/ha';
import { can, isApi, session } from '../api/session';
import {
  CONFIDENCE_LABEL, ANY_KIND_LABEL, ROLE_LABEL, adminAreas, mediaAdmin,
  type AdminDevice, type AdminDevicePatch,
} from '../api/media-admin';
import {
  LIBRARY_TAB_LABEL, SUGGESTION_REASON_LABEL, playerErrorText, players,
  type FavouritesCuration, type GroupPreset, type LibraryItem, type LibraryKind, type MergeSuggestion, type MusicProvider, type PlayerDevice, type PlayerStatus,
} from '../api/media-players';
import { DEFAULT_NIGHT, parseCeiling, parseNight, presetFloors, presetRooms } from './multimedia-players-layout';
import { SkinController } from '../design/skin';
import { adminTable, mediaAdminListCss } from './media-admin-list';
import { DEFAULT_VIEW, loadView, saveView, type ListView } from './media-admin-list-logic';
import { integrationName, integrationTitle } from './media-integration-names';
import { bubbleChrome } from '../styles/bubble-chrome';

const flash = (ms = 3000) => new Promise((r) => setTimeout(r, ms));
/** The kinds a speaker / player / receiver card may be set to (settings choose; the detected kind is the default). */
const KIND_CHOICES = ['speaker', 'player', 'receiver'] as const;
const PROVIDER_LABEL: Record<MusicProvider, string> = { ma: 'music_assistant', sonos: 'sonos', heos: 'heos', vendor: 'יצרן', none: 'ללא' };
const PHYSICAL = ['speaker', 'player', 'receiver', 'group'];
const ROLE_EXTRA: Record<string, string> = { music: 'שכבת המוזיקה', mirror: 'מראה (מוסתר)' };

interface FavRow {
  ref: string;
  name: string;
  artist: string | null;
  hidden: boolean;
}
type FavLists = Record<LibraryKind, FavRow[]>;
const EMPTY_FAVS: FavLists = { favourites: [], stations: [], playlists: [] };
const KINDS: LibraryKind[] = ['favourites', 'stations', 'playlists'];

/**
 * CR-016 הגדרות › מולטימדיה, the sections of the players (embedded in `<system-multimedia>`; system.configure, installation scope,
 * the server checks it again on every write; settings keep the exact technical names, docs/design/UI_COPY_RULES.md):
 *  - נגנים ורמקולים: every detected speaker, player and receiver with its kind, confidence, room ("חדר", editable for a device that has none:
 *    an administrator action, audited), approval ("אשר את כל הנגנים שזוהו" as one action), display name, linked amplifier, volume
 *    ceiling (EMPTY = none: there is no default, decision 7ב) and an optional night window (from, to, ceiling), and its connections
 *    (which layer answers what; hidden duplicates);
 *  - איחוד כפילויות: the merge wizard fed by the suggestion rungs (one row per pair with the reason, "אחד" / "התעלם") and the folded
 *    "רכיבים לא פיזיים" (sessions, helper groups, services: never devices, never suggested);
 *  - קבוצות שמורות: list, new, edit (name, rooms, optional volumes), delete;
 *  - מועדפים ותחנות: which lists appear in the player (favourites / stations / playlists) and, per item, order and hide - one list for
 *    everyone (decision 5א);
 *  - חיבור: whether a music library answers (with or without Music Assistant) and which layer answers per device;
 *  - הרשאות: who may group (`media.group`).
 * Every change is saved at once (audited server-side); there is no draft bar. A section whose route does not answer stays out.
 */
@customElement('system-multimedia-players')
export class SystemMultimediaPlayers extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private phase: 'loading' | 'ready' | 'forbidden' = 'loading';
  @state() private devices: AdminDevice[] = [];
  @state() private live = new Map<string, PlayerDevice>();
  @state() private status: PlayerStatus | null = null;
  @state() private sugg: MergeSuggestion[] | null = null;
  @state() private answered = new Set<string>();
  @state() private nonPhys: (PlayerDevice & { approved?: boolean })[] | null = null;
  @state() private presets: GroupPreset[] | null = null;
  @state() private fav: FavouritesCuration | null = null;
  @state() private favLists: FavLists = EMPTY_FAVS;
  @state() private areas: { id: string; name: string; floor_name: string | null }[] = [];
  @state() private open = new Set<string>();
  @state() private editing = new Set<string>();
  @state() private view: ListView = { ...DEFAULT_VIEW };
  @state() private npOpen = false;
  @state() private saved = '';
  @state() private error = '';
  @state() private note = '';
  @state() private deleting: GroupPreset | null = null;
  @state() private busy = false;
  @query('media-preset-editor') private editor?: MediaPresetEditor;
  private noteTimer = 0;
  private offPush: (() => void) | null = null;

  static styles = [mediaAdminListCss, css`
    :host {
      display: contents;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    code,
    .mono {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .dev {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 8px 0 0;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 10px 16px;
      flex-wrap: wrap;
    }
    .line .grow {
      flex: 1;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      /* 0.1.162: the form opens inside the list's padded detail row; a field never grows past it on a phone */
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .f.inline {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    input[type='text'],
    input[type='number'],
    input[type='time'],
    select {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select {
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    input[type='text'] {
      min-inline-size: 200px;
    }
    input[type='number'] {
      inline-size: 88px;
    }
    .night {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ep {
      display: grid;
      grid-template-columns: minmax(140px, 1.4fr) minmax(90px, 0.8fr) minmax(0, 2fr) auto;
      gap: 6px 12px;
      align-items: center;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
      border-block-end: 1px dashed var(--sw-border);
    }
    .ep:last-child {
      border-block-end: 0;
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      background: none;
      border: 0;
      padding: 0;
      font-family: inherit;
      min-block-size: 32px;
    }
    a.link {
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .fgrp h3 {
      margin: 10px 0 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .frow {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .frow.off {
      opacity: 0.6;
    }
    .frow .nm {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .hd {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-block-end: 4px;
    }
    @media (max-width: 767px) {
      .ep {
        grid-template-columns: 1fr;
      }
      input[type='text'] {
        min-inline-size: 0;
        inline-size: 100%;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.view = loadView('players', session.me?.user.id ?? '');
    void this.load();
    if (isApi()) this.offPush = subscribeHa((m) => { if (m.type === 'media_groups_changed') void this.loadGroups(); });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.noteTimer);
    this.offPush?.();
    this.offPush = null;
  }

  private async load() {
    if (isApi() && !can('system.configure')) {
      this.phase = 'forbidden';
      return;
    }
    const [admin, status, list, sugg, nonp, areas] = await Promise.allSettled([
      mediaAdmin().list(), players().status(), players().list(), players().suggestions(), players().nonPhysical(), adminAreas(),
    ]);
    if (admin.status === 'fulfilled') this.devices = admin.value.devices.filter((d) => PHYSICAL.includes(d.kind));
    this.status = status.status === 'fulfilled' ? status.value : null;
    this.live = list.status === 'fulfilled' ? new Map(list.value.devices.map((d) => [d.key, d])) : new Map();
    this.sugg = sugg.status === 'fulfilled' ? sugg.value : null;
    this.nonPhys = nonp.status === 'fulfilled' ? nonp.value.devices : null;
    this.areas = areas.status === 'fulfilled' ? areas.value : [];
    await Promise.all([this.loadGroups(), this.loadFavs()]);
    this.phase = 'ready';
  }

  private async loadGroups() {
    try {
      this.presets = await players().presets();
    } catch {
      this.presets = null;
    }
  }

  /** The curation, and the items to curate: the editor's read of a device with a music library (`library(.., all)`: hidden items included, marked) - the server
   * names every curated item (`favourites` carries `name` / `artist` / `kind` for a holder of media.layout), so a hidden item can be shown again. */
  private async loadFavs() {
    try {
      const cur = await players().favourites();
      const dev = [...this.live.values()].find((d) => d.caps.favourites || d.caps.stations);
      const lists: FavLists = { favourites: [], stations: [], playlists: [] };
      const by = new Map(cur.items.map((i) => [i.item_ref, i]));
      for (const k of KINDS) {
        if (!dev || !dev.caps[k]) continue;
        const page = await players().library(dev.key, k, 0, true);
        const rows = page.items.map((i: LibraryItem): FavRow => ({ ref: i.item_ref, name: by.get(i.item_ref)?.name ?? i.name, artist: i.artist, hidden: !!i.hidden }));
        lists[k] = rows.sort((a, b) => (by.get(a.ref)?.order ?? 1e6) - (by.get(b.ref)?.order ?? 1e6));
      }
      this.favLists = lists;
      this.fav = cur;
    } catch {
      this.fav = null;
    }
  }

  private say(text: string) {
    this.note = text;
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => (this.note = ''), 3500);
  }

  // ------------------------------------------------------------------------------------------------ writes

  private async patchDevice(d: AdminDevice, p: AdminDevicePatch) {
    this.error = '';
    try {
      const to = await mediaAdmin().update(d.key, p);
      this.devices = this.devices.map((x) => (x.key === d.key ? to : x));
      this.saved = d.key;
      void flash().then(() => (this.saved = this.saved === d.key ? '' : this.saved));
    } catch (err) {
      this.error = describeError(err);
      await this.load();
    }
  }

  /** "אשר את כל הנגנים שזוהו": one call by kind (the server approves every detected speaker, player, receiver and group), then the lists read again. */
  private async approveAll() {
    const pending = this.devices.filter((d) => !d.approved).length;
    if (!pending) return;
    try {
      const r = await mediaAdmin().approve(null, true, ['speaker', 'player', 'receiver', 'group']);
      this.devices = this.devices.map((d) => ({ ...d, approved: true }));
      this.say(`אושרו ${r.changed || pending} נגנים`);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** A helper group is a shortcut in the groups tab only once an administrator approves it here (never a device card, never joinable). */
  private async approveHelper(key: string, on: boolean) {
    this.error = '';
    try {
      await mediaAdmin().update(key, { approved: on });
      this.nonPhys = (await players().nonPhysical()).devices;
      this.say('נשמר');
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async link(op: Parameters<ReturnType<typeof mediaAdmin>['link']>[0]) {
    try {
      const list = await mediaAdmin().link(op);
      this.devices = list.devices.filter((d) => PHYSICAL.includes(d.kind));
      this.say('נשמר');
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async answer(s: MergeSuggestion, op: 'link' | 'ignore') {
    // the row leaves at once (never a list shifting under the pointer); it comes back when the write failed
    this.error = '';
    this.answered = new Set([...this.answered, s.id]);
    // "התעלם" dismisses THIS suggestion (the endpoint + the device it was offered for): a plain `ignore` would hide the endpoint from every device
    await this.link({ op, endpoint_id: s.endpoint_id, device_key: s.device_key });
    if (this.error) this.answered = new Set([...this.answered].filter((x) => x !== s.id));
  }

  private async deletePreset() {
    const p = this.deleting;
    if (!p || this.busy) return;
    this.busy = true;
    try {
      await players().deletePreset(p.id, p.revision);
      this.deleting = null;
      this.say('נמחק');
      await this.loadGroups();
    } catch (err) {
      this.error = playerErrorText(err);
      if (err instanceof ApiError && err.code === 'revision_conflict') this.deleting = null;
      await this.loadGroups();
    } finally {
      this.busy = false;
    }
  }

  private async saveFav(kindsOn: LibraryKind[], lists: FavLists) {
    const cur = this.fav;
    if (!cur) return;
    const items = KINDS.flatMap((k) => lists[k]).map((r, i) => ({ item_ref: r.ref, hidden: r.hidden, order: i }));
    this.error = '';
    try {
      this.fav = await players().saveFavourites({ kinds_on: kindsOn, items }, cur.revision);
      this.favLists = lists;
      this.say('נשמר');
    } catch (err) {
      this.error = playerErrorText(err);
      await this.loadFavs();
    }
  }

  private toggleKind(k: LibraryKind, on: boolean) {
    const cur = this.fav;
    if (!cur) return;
    void this.saveFav(on ? [...new Set([...cur.kinds_on, k])] : cur.kinds_on.filter((x) => x !== k), this.favLists);
  }

  private setHidden(k: LibraryKind, ref: string, hidden: boolean) {
    void this.saveFav(this.fav!.kinds_on, { ...this.favLists, [k]: this.favLists[k].map((r) => (r.ref === ref ? { ...r, hidden } : r)) });
  }

  private moveFav(k: LibraryKind, ref: string, dir: -1 | 1) {
    const l = [...this.favLists[k]];
    const i = l.findIndex((r) => r.ref === ref);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    void this.saveFav(this.fav!.kinds_on, { ...this.favLists, [k]: l });
  }

  // ------------------------------------------------------------------------------------------------ render

  // ------------------------------------------------------------------------------------------------ the list

  private setView = (v: ListView) => {
    this.view = v;
    saveView('players', session.me?.user.id ?? '', v);
  };

  private toggle(set: 'open' | 'editing', key: string) {
    const s = new Set(this[set]);
    if (!s.delete(key)) s.add(key);
    this[set] = s;
  }

  private async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.say('הועתק');
    } catch {
      this.say('ההעתקה נחסמה בדפדפן');
    }
  }

  /** Availability: the live read when there is one (`unavailable` is the only "not available"), else what the settings list says. */
  private liveAvail = (key: string): boolean | null => {
    const l = this.live.get(key);
    return l ? l.live.power !== 'unavailable' : null;
  };

  private table(ds: AdminDevice[]): TemplateResult {
    return adminTable({
      scope: 'players', devices: ds, view: this.view, live: this.liveAvail, editing: this.editing, endpoints: this.open, saved: this.saved,
      status: (d, f) => {
        const p = this.live.get(d.key)?.live.power;
        return p === 'unavailable' ? { kind: 'stale', label: 'לא זמין' } : p === 'off' ? { kind: 'neutral', label: 'כבוי' } : f.available === null ? null : f.available ? { kind: 'ok', label: 'זמין' } : { kind: 'stale', label: 'לא זמין' };
      },
      form: (d) => this.form(d), connections: (d) => this.connections(d), typeLabel: (d) => ANY_KIND_LABEL[d.kind as keyof typeof ANY_KIND_LABEL] ?? d.kind,
      onView: this.setView, onEdit: (k) => this.toggle('editing', k), onEndpoints: (k) => this.toggle('open', k),
      onApprove: (d, on) => void this.patchDevice(d, { approved: on }), onCopy: (t) => void this.copy(t), none: 'לא זוהו נגנים.',
    });
  }

  /** The full form of one device: it opens under the row (the list shows the compact row; every field and action below is unchanged). */
  private form(d: AdminDevice): TemplateResult {
    const amps = this.devices.filter((x) => x.key !== d.key && x.kind === 'receiver');
    const night = d.volume_night ?? null;
    const place = [d.floor_name, d.area_name].filter(Boolean).join(' › ');
    const unplaced = (d.area_id ?? null) === null && !d.area_name;
    const nightPatch = (patch: Partial<NonNullable<AdminDevice['volume_night']>>) => {
      const cur = night ?? DEFAULT_NIGHT;
      const next = parseNight(patch.from ?? cur.from, patch.to ?? cur.to, String(patch.max ?? cur.max));
      if (next) void this.patchDevice(d, { volume_night: next });
    };
    return html`<div class="dev" data-mm-form=${d.key}>
      <div class="line">
        <label class="f">שם
          <input type="text" .value=${d.name} maxlength="60" data-mm-name=${d.key} @change=${(e: Event) => void this.patchDevice(d, { display_name: (e.target as HTMLInputElement).value })} />
        </label>
        <label class="f">סוג
          ${d.kind === 'group' ? html`<span>${ANY_KIND_LABEL.group}</span>` : html`<select data-mm-kind=${d.key} @change=${(e: Event) => void this.patchDevice(d, { kind: (e.target as HTMLSelectElement).value as AdminDevice['kind'] })}>
            ${KIND_CHOICES.map((k) => html`<option value=${k} ?selected=${d.kind === k}>${ANY_KIND_LABEL[k]}</option>`)}
          </select>`}
        </label>
        <span class="f">זיהוי<sw-badge kind=${d.confidence === 'weak' ? 'stale' : 'neutral'} label=${CONFIDENCE_LABEL[d.confidence]}></sw-badge></span>
        <label class="f">חדר
          ${unplaced && this.areas.length
            ? html`<select data-mm-area=${d.key} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) void this.patchDevice(d, { area_id: v }); }}>
                <option value="" selected>ללא חדר</option>${this.areas.map((a) => html`<option value=${a.id}>${a.name}${a.floor_name ? ` · ${a.floor_name}` : ''}</option>`)}</select>`
            : html`<span data-mm-place=${d.key}>${place || 'ללא חדר'}</span>`}
        </label>
        ${d.zones?.length ? html`<span class="f">אזורים<span>${d.zones.map((z) => z.name).join(' · ')}</span></span>` : nothing}
        <span class="grow"></span>
      </div>
      <div class="line">
        ${d.kind !== 'receiver' && d.kind !== 'group' ? html`<label class="f">מגבר מקושר
          <select data-mm-link=${d.key} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.patchDevice(d, { audio_link_key: v || null }); }}>
            <option value="" ?selected=${!d.audio_link_key}>ללא</option>
            ${amps.map((r) => html`<option value=${r.key} ?selected=${d.audio_link_key === r.key}>${r.name}</option>`)}
          </select></label>` : nothing}
        <label class="f">תקרת עוצמה
          <input type="number" min="0" max="100" .value=${d.volume_max === null ? '' : String(d.volume_max)} placeholder="ללא" data-mm-volmax=${d.key}
            @change=${(e: Event) => { const n = parseCeiling((e.target as HTMLInputElement).value); if (n !== 'invalid') void this.patchDevice(d, { volume_max: n }); }} />
        </label>
        <span class="f">חלון לילה
          <span class="night">
            <sw-toggle label=${`חלון לילה: ${d.name}`} labelHidden .checked=${!!night} data-mm-night=${d.key} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patchDevice(d, { volume_night: e.detail.checked ? { ...DEFAULT_NIGHT } : null })}></sw-toggle>
            ${night ? html`<span>מ־</span><input type="time" .value=${night.from} data-mm-night-from=${d.key} aria-label="מ־" @change=${(e: Event) => nightPatch({ from: (e.target as HTMLInputElement).value })} />
              <span>עד</span><input type="time" .value=${night.to} data-mm-night-to=${d.key} aria-label="עד" @change=${(e: Event) => nightPatch({ to: (e.target as HTMLInputElement).value })} />
              <span>תקרה</span><input type="number" min="0" max="100" .value=${String(night.max)} data-mm-night-max=${d.key} aria-label="תקרה בלילה" @change=${(e: Event) => nightPatch({ max: Number((e.target as HTMLInputElement).value) })} />` : html`<span class="muted">כבוי</span>`}
          </span>
        </span>
      </div>
    </div>`;
  }


  private connections(d: AdminDevice): TemplateResult {
    return html`<div data-mm-endpoints=${d.key}>${d.music_provider && d.music_provider !== 'none' ? html`<div class="muted">שכבת המוזיקה: ${PROVIDER_LABEL[d.music_provider]}</div>` : nothing}${d.endpoints.map((e) => html`<div class="ep" data-mm-endpoint=${e.endpoint_id}>
        <span class="mono" data-mm-ep-platform=${e.platform} title=${integrationTitle(e.platform)}>${integrationName(e.platform)}</span>
        <span>${ROLE_EXTRA[e.role] ?? ROLE_LABEL[e.role] ?? e.role}${e.hidden ? html` <sw-badge kind="neutral" label="מוסתר"></sw-badge>` : nothing}</span>
        <span class="muted">${e.primary_for.length ? `עונה על: ${e.primary_for.join(', ')}` : 'כפילות'} · שלב ${e.rule}${e.link_source === 'manual' ? ' · ידני' : ''}</span>
        <span class="acts">
          ${e.hidden ? html`<sw-button size="sm" data-mm-restore=${e.endpoint_id} @click=${() => void this.link({ op: 'restore', endpoint_id: e.endpoint_id })}>שחזר</sw-button>`
            : html`<sw-button size="sm" data-mm-ignore=${e.endpoint_id} @click=${() => void this.link({ op: 'ignore', endpoint_id: e.endpoint_id })}>התעלם</sw-button>
              ${d.endpoints.length > 1 ? html`<sw-button size="sm" data-mm-unlink=${e.endpoint_id} @click=${() => void this.link({ op: 'unlink', endpoint_id: e.endpoint_id })}>פצל</sw-button>` : nothing}`}
        </span>
      </div>`)}</div>`;
  }

  private playersCard(): TemplateResult | typeof nothing {
    const ds = this.devices;
    if (!ds.length) return nothing;
    const approved = ds.filter((d) => d.approved).length;
    const pending = ds.length - approved;
    const unplaced = ds.filter((d) => !d.area_name && !d.area_id).length;
    const unav = ds.filter((d) => this.live.get(d.key)?.live.power === 'unavailable').length;
    const counts = [`${approved} מאושרים`, pending ? `${pending} ממתינים` : '', unplaced ? `${unplaced} ללא חדר` : '', unav ? `${unav} לא זמינים` : ''].filter(Boolean).join(' · ');
    return html`<sw-card heading="נגנים ורמקולים" data-mm-players>
      <div class="hd"><span class="muted" data-mm-players-count>${counts}</span><span class="grow" style="flex:1"></span>
        <sw-button size="sm" variant="primary" icon="check" data-mm-approve-players ?disabled=${!pending} @click=${() => void this.approveAll()}>אשר את כל הנגנים שזוהו${pending ? ` (${pending})` : ''}</sw-button></div>
      <div class="muted">רק נגנים מאושרים מופיעים ב"מולטימדיה". תקרת עוצמה וחלון לילה חלים רק כשהוגדרו.</div>
      ${this.table(ds)}
    </sw-card>`;
  }

  private wizardCard(): TemplateResult | typeof nothing {
    const s = this.sugg?.filter((x) => !this.answered.has(x.id));
    const np = this.nonPhys;
    if (!s && !np?.length) return nothing;
    const NP: Record<string, string> = { session: 'סשן', virtual_group: 'קבוצה וירטואלית', service: 'שירות' };
    return html`<sw-card heading="איחוד כפילויות" data-mm-wizard>
      ${s ? html`<div class="hd"><span class="muted" data-mm-wizard-count>${s.length ? `${s.length} הצעות` : 'אין הצעות פתוחות'}</span></div>
        ${repeat(s, (x) => x.id, (x) => html`<div class="row" data-mm-wizard-row=${x.id}><span class="lbl"><span><span class="mono">${x.endpoint_label}</span> ← ${x.device_name}</span><span class="muted">${SUGGESTION_REASON_LABEL[x.reason]} · שלב ${x.rule}</span></span>
          <span class="acts"><sw-button size="sm" variant="primary" icon="link" data-mm-wizard-accept=${x.id} @click=${() => void this.answer(x, 'link')}>אחד</sw-button>
            <sw-button size="sm" data-mm-wizard-ignore=${x.id} @click=${() => void this.answer(x, 'ignore')}>התעלם</sw-button></span></div>`)}` : nothing}
      ${np?.length ? html`<div class="row" data-mm-nonphysical><span class="lbl">רכיבים לא פיזיים<span class="muted">${np.length} רשומות: סשנים, קבוצות עזר ושירותים · לא מוצגים כנגנים ולא מוצעים לאיחוד</span></span>
          <sw-button size="sm" data-mm-np-toggle aria-expanded=${String(this.npOpen)} @click=${() => (this.npOpen = !this.npOpen)}>${this.npOpen ? 'הסתר' : 'הצג'}</sw-button></div>
        ${this.npOpen ? np.map((n) => html`<div class="row" data-mm-np-row=${n.key}><span class="lbl">${n.name}</span>
          ${n.kind === 'virtual_group' ? html`<label class="f inline">מוצג בקבוצות<sw-toggle label=${`מוצג בקבוצות: ${n.name}`} labelHidden .checked=${!!n.approved} data-mm-np-approved=${n.key} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.approveHelper(n.key, e.detail.checked)}></sw-toggle></label>` : nothing}
          <sw-badge kind="neutral" label=${NP[n.kind] ?? n.kind}></sw-badge></div>`) : nothing}` : nothing}
    </sw-card>`;
  }

  private presetsCard(): TemplateResult | typeof nothing {
    const ps = this.presets;
    if (!ps) return nothing;
    const devs = [...this.live.values()];
    return html`<sw-card heading="קבוצות שמורות" data-mm-presets>
      <div class="hd"><span class="muted">${ps.length} שמורות</span><span class="grow" style="flex:1"></span>
        <sw-button size="sm" icon="plus" data-mm-preset-new @click=${() => this.editor?.show(draftOf(null))}>קבוצה חדשה</sw-button></div>
      ${ps.map((p) => { const rooms = presetRooms(p, devs); const fl = presetFloors(p, devs); return html`<div class="row" data-mm-preset=${p.id}><span class="lbl">${p.name}<span class="muted">${rooms.map((r) => r.room).join(', ')}${fl > 1 ? ` · ${fl} קומות · דורש אישור בהפעלה` : ''}${p.volumes ? ' · עם עוצמות' : ''}</span></span>
        <span class="acts"><sw-button size="sm" icon="edit" data-mm-preset-edit=${p.id} @click=${() => this.editor?.show(draftOf(p))}>ערוך</sw-button>
          <sw-button size="sm" variant="danger" data-mm-preset-delete=${p.id} @click=${() => (this.deleting = p)}>מחק</sw-button></span></div>`; })}
      ${ps.length ? nothing : html`<div class="muted">אין קבוצות שמורות.</div>`}
    </sw-card>`;
  }

  private favCard(): TemplateResult | typeof nothing {
    const f = this.fav;
    if (!f) return nothing;
    const lib = this.status?.library;
    const has = KINDS.some((k) => this.favLists[k].length);
    const sonos = lib?.provider === 'sonos';
    const kinds = KINDS.filter((k) => !(k === 'playlists' && sonos));
    return html`<sw-card heading="מועדפים ותחנות" data-mm-favs>
      <div class="row"><span class="lbl">לשוניות בנגן<span class="muted">רשימה אחת לכולם</span></span>
        <span class="acts">${kinds.map((k) => html`<label class="f inline">${LIBRARY_TAB_LABEL[k]}<sw-toggle label=${LIBRARY_TAB_LABEL[k]} labelHidden .checked=${f.kinds_on.includes(k)} data-mm-fav-kind=${k} @change=${(e: CustomEvent<{ checked: boolean }>) => this.toggleKind(k, e.detail.checked)}></sw-toggle></label>`)}</span></div>
      <div class="row"><span class="lbl">מקור<span class="muted">${lib?.provider === 'ma' ? 'Music Assistant · המועדפים של ההתקנה' : sonos ? 'Sonos · המועדפים של הרמקולים (source_list) · אין פלייליסטים בלי Music Assistant' : 'אין ספריית מוזיקה'}</span></span></div>
      ${has ? kinds.map((k) => this.favList(k)) : nothing}
    </sw-card>`;
  }

  private favList(k: LibraryKind): TemplateResult | typeof nothing {
    const l = this.favLists[k];
    if (!l.length) return nothing;
    return html`<div class="fgrp" data-mm-fav-group=${k}><h3>${LIBRARY_TAB_LABEL[k]} · סדר והצגה</h3>${l.map((r, i) => html`<div class=${r.hidden ? 'frow off' : 'frow'} data-mm-fav=${r.ref}>
      <sw-toggle label=${`הצג: ${r.name}`} labelHidden .checked=${!r.hidden} data-mm-fav-show=${r.ref} @change=${(e: CustomEvent<{ checked: boolean }>) => this.setHidden(k, r.ref, !e.detail.checked)}></sw-toggle>
      <span class="nm"><b>${r.name}</b>${r.artist ? html`<span class="muted">${r.artist}</span>` : nothing}</span>
      <button type="button" class="ib" data-mm-fav-up=${r.ref} aria-label=${`הקדם: ${r.name}`} ?disabled=${i === 0} @click=${() => this.moveFav(k, r.ref, -1)}><sw-icon name="arrowUp" size="14"></sw-icon></button>
      <button type="button" class="ib" data-mm-fav-down=${r.ref} aria-label=${`אחר: ${r.name}`} ?disabled=${i === l.length - 1} @click=${() => this.moveFav(k, r.ref, 1)}><sw-icon name="arrowDown" size="14"></sw-icon></button>
    </div>`)}</div>`;
  }

  private connectionCard(): TemplateResult | typeof nothing {
    const st = this.status;
    if (!st?.library) return nothing;
    const lib = st.library;
    const total = [...this.live.values()].filter((d) => d.kind !== 'group').length;
    const unav = [...this.live.values()].filter((d) => d.kind !== 'group' && d.live.power === 'unavailable').length;
    const layers = new Map<MusicProvider, number>();
    for (const d of this.devices) if (d.music_provider && d.music_provider !== 'none') layers.set(d.music_provider, (layers.get(d.music_provider) ?? 0) + 1);
    return html`<sw-card heading="חיבור" data-mm-connection>
      ${lib.provider === 'ma' || lib.state === 'unavailable'
        ? html`<div class="row"><span class="lbl">Music Assistant דרך Home Assistant<span class="muted" data-mm-conn-text>${total} נגנים${unav ? ` · ${unav} לא זמינים` : ''} · ${lib.state === 'ready' ? 'ספרייה זמינה' : 'ספרייה לא זמינה'}</span></span>
            <sw-badge kind=${lib.state === 'ready' ? 'ok' : 'stale'} label=${lib.state === 'ready' ? 'מחובר' : 'ספרייה לא זמינה'}></sw-badge></div>`
        : html`<div class="row"><span class="lbl">Music Assistant<span class="muted" data-mm-conn-text>לא מותקן במערכת זו${lib.provider !== 'none' ? ` · ספקי מוזיקה: ${PROVIDER_LABEL[lib.provider]}` : ''}</span></span><sw-badge kind="neutral" label="לא מותקן"></sw-badge></div>`}
      ${layers.size ? html`<div class="row"><span class="lbl">שכבת המוזיקה לפי התקן<span class="muted">${[...layers].map(([p, n]) => `${PROVIDER_LABEL[p]} על ${n}`).join(' · ')}</span></span></div>` : nothing}
      <div class="row"><span class="lbl">רכיב החיבור (גשר Arx)<span class="muted">${st.bridge.players_ready ? `גרסה ${st.bridge.version ?? '?'} · מוכן לנגנים` : `גרסה ${st.bridge.version ?? '?'} · נדרש עדכון (0.5.0 ומעלה) לנגנים`}</span></span></div>
      ${lib.provider === 'ma' ? html`<media-ma-connection data-mm-ma-direct></media-ma-connection>` : nothing}
    </sw-card>`;
  }

  private permissionsCard(): TemplateResult {
    return html`<sw-card heading="הרשאות" data-mm-permissions>
      <div class="row"><span class="lbl">קיבוץ רמקולים וקבוצות שמורות<span class="muted"><span class="mono">media.group</span> · מפעיל, מנהל אתר, מנהל מערכת · קבוצה של 4 חדרים ומעלה או יותר מקומה אחת מבקשת אישור; כל הבניין רק למנהל</span></span>
        <a class="link" href="#/system/access">תפקידים והרשאות ›</a></div>
      <div class="row"><span class="lbl">שליטה בניגון ובעוצמה<span class="muted"><span class="mono">media.control</span> · כולל דילוג, ערבוב, חזרה, מועדפים והעברת מוזיקה</span></span></div>
      <div class="row"><span class="lbl">עיון וחיפוש בספריית המוזיקה<span class="muted"><span class="mono">media.browse</span> · מפעיל, מנהל אתר, מנהל מערכת · הפעלת פריט דורשת גם שליטה בניגון</span></span></div>
      <div class="row"><span class="lbl">עריכת תור הניגון<span class="muted"><span class="mono">media.queue</span> · מנהל מערכת בלבד כברירת מחדל · גרירה, מחיקה, נגן הבא, ניקוי התור</span></span></div>
    </sw-card>`;
  }

  private deleteDialog(): TemplateResult {
    const p = this.deleting;
    if (!p) return html`<sw-dialog data-mm-preset-delete-dialog="closed"></sw-dialog>`;
    return html`<sw-dialog open ?locked=${this.busy} heading=${`למחוק את "${p.name}"?`} data-mm-preset-delete-dialog="open" @close=${() => (this.deleting = null)}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-pd-no autofocus ?disabled=${this.busy} @click=${() => (this.deleting = null)}>ביטול</sw-button>
        <sw-button variant="danger" data-mm-pd-yes ?disabled=${this.busy} @click=${() => void this.deletePreset()}>מחק</sw-button>
      </div></sw-dialog>`;
  }

  render() {
    if (this.phase !== 'ready') return nothing;
    return html`${this.error ? html`<div class="err" role="alert" data-mm-players-error>${this.error}</div>` : nothing}
      ${this.playersCard()}${this.wizardCard()}${this.presetsCard()}${this.favCard()}${this.connectionCard()}${this.permissionsCard()}
      ${this.note ? html`<div class="ok" role="status" data-mm-players-note>${this.note}</div>` : nothing}
      <media-preset-editor .devices=${[...this.live.values()]} @preset-saved=${() => { this.say('נשמר'); void this.loadGroups(); }} @preset-stale=${() => void this.loadGroups()}></media-preset-editor>
      ${this.deleteDialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-multimedia-players': SystemMultimediaPlayers;
  }
}

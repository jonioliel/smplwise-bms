import { LitElement, html, css, nothing } from 'lit';
import { cameraLabel, sameRecorder } from '../api/recorders';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-dropdown';
import type { DropdownChange, DropdownItem } from '../components/sw-dropdown';
import { extraFromParam, limitNotice, toggleCapped } from '../components/multi-select';
import { TabsModeController } from '../shell/tabs-mode';
import '../components/sw-field';
import '../components/sw-timeline';
import { minuteLabel } from '../components/sw-timeline';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';
import '../components/sw-card';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { listCameras } from '../api/maps';
import { productSettings } from '../api/prefs';
import { snapshotUrl } from '../api/media';
import { navigate } from '../router';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

interface RecentSet {
  cameras: string[];
  at: string;
  opened: string;
}

const RECENT_KEY = 'sw.sync.recent';

function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** SC13 — command center / synchronized playback (board 2 screen 14, Beta): 2×2 pictures, one transport row, one timeline, per-source truth. */
@customElement('investigate-sync')
export class InvestigateSync extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** 2.0.1: the camera picker is a multi-select dropdown in the security group's style (re-rendered when the installation / the user changes it). */
  private tabsMode = new TabsModeController(this, 'security');
  @state() private cursor = 615;
  @state() private playing = false;
  @state() private cams: Camera[] | null = null;
  /** CR-024: the experimental cross-recorder synchronized playback setting (off: one recorder per synchronized set). */
  @state() private crossSync = false;
  @state() private picked: string[] = [];
  @state() private when = localInput(new Date(Date.now() - 10 * 60_000));
  @state() private recent: RecentSet[] = [];
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    try {
      this.recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    } catch {
      this.recent = [];
    }
    void this.load();
  }

  private async load() {
    try {
      const [list, settings] = await Promise.all([listCameras(), productSettings().catch(() => null)]);
      this.cams = list.cameras.filter((c) => c.enabled && c.can_view_live !== false);
      this.crossSync = String(settings?.['playback.cross_recorder_sync'] ?? 'false') === 'true';
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.cams = [];
    }
  }

  /**
   * The picked set changed (2.0.1: the dropdown's `change`, one toggle or "נקה"). The dropdown keeps the limit (4) and refuses the 5th
   * pick; the ids are trusted only after the same filter the recordings screen gives its route parameter (known cameras, no repeats,
   * at most four, pick order kept: the first is the lead), plus CR-024 (one recorder per synchronized set unless the experimental
   * setting allows more) - exactly what a chip press checked.
   */
  private applyPicked(ids: string[]) {
    const cams = this.cams ?? [];
    const next: string[] = [];
    for (const id of extraFromParam(ids.join(','), '', cams.map((c) => c.id), 4)) {
      if (!this.picked.includes(id) && !sameRecorder(next, cams, id, this.crossSync)) continue;
      next.push(id);
    }
    this.picked = next;
  }

  /** The picker's options: every camera; one of another recorder is listed but cannot join the set (CR-024) and says why (2.0.2: "מקליט אחר");
   * an offline camera carries the alert dot. */
  private syncItems(): DropdownItem[] {
    const cams = this.cams ?? [];
    return cams.map((c) => {
      const other = !this.picked.includes(c.id) && !sameRecorder(this.picked, cams, c.id, this.crossSync);
      return { id: c.id, label: cameraLabel(c), icon: 'camera' as const, alert: c.status !== 'online', disabled: other, note: other ? 'מקליט אחר' : undefined };
    });
  }

  /** 2.0.2 (`ui.dd_picker` = chips): the 2.0.0 look, a button per camera with the status dot; the limit disables the rest, a disabled chip says why in its tooltip. */
  private renderChips() {
    const full = this.picked.length >= 4;
    const cams = this.cams ?? [];
    return html`<span class="lbl">מצלמות (עד 4):</span>${this.syncItems().map((it) => {
      const on = this.picked.includes(it.id);
      const why = it.note ?? (!on && full ? limitNotice(4) : '');
      const cam = cams.find((c) => c.id === it.id);
      return html`<sw-chip data-sync-camera=${it.id} ?selected=${on} ?disabled=${!on && (it.disabled || full)} dot=${cam?.status === 'online' ? 'var(--sw-success)' : 'var(--sw-danger)'} title=${why || nothing} @click=${() => this.applyPicked(toggleCapped(this.picked, it.id, 4).ids)}>${it.label}</sw-chip>`;
    })}`;
  }

  /** The four places of a set: a picked camera (its snapshot, the name, "מובילה" on the first), or an empty, numbered place. */
  private renderSlots() {
    const cams = this.cams ?? [];
    return html`<div class="slots" data-sync-slots>${[0, 1, 2, 3].map((i) => {
      const id = this.picked[i];
      if (!id) {
        return html`<div class="slot empty" data-sync-slot=${i + 1} aria-hidden="true"><span class="num">${i + 1}</span>${i === 0 ? html`<span class="role">מובילה</span>` : nothing}</div>`;
      }
      const cam = cams.find((c) => c.id === id);
      return html`<div class="slot" data-sync-pick=${id}>
        <div class="media">
          <img src=${snapshotUrl(id)} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
          ${i === 0 ? html`<sw-badge class="lead" kind="live" label="מובילה"></sw-badge>` : html`<span class="num">${i + 1}</span>`}
          <button type="button" class="rm" aria-label=${`הסר ${this.name(id)}`} title="הסר" @click=${() => this.applyPicked(this.picked.filter((p) => p !== id))}><span class="x" aria-hidden="true">×</span></button>
        </div>
        <div class="cap"><span class="name">${this.name(id)}</span>${cam && cam.status !== 'online' ? html`<sw-badge kind="offline" label="לא מקוון"></sw-badge>` : nothing}</div>
      </div>`;
    })}</div>`;
  }

  private launch(cameras = this.picked, atIso?: string) {
    if (cameras.length < 2) return;
    const at = atIso ?? new Date(this.when).toISOString();
    const set: RecentSet = { cameras, at, opened: new Date().toISOString() };
    const rest = this.recent.filter((r) => r.cameras.join(',') !== cameras.join(','));
    this.recent = [set, ...rest].slice(0, 6);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent));
    } catch {
      /* private mode */
    }
    navigate('/investigate/playback', { camera: cameras[0], extra: cameras.slice(1).join(','), t: at });
  }

  private name(id: string): string {
    return this.cams?.find((c) => c.id === id)?.name ?? id;
  }

  private renderApi() {
    const cams = this.cams;
    return html`
      <sw-page heading="ניגון מסונכרן" subheading="2–4 מצלמות, זמן אחד" wide>
        ${this.error ? html`<sw-state-panel state="error" heading="המצלמות לא נטענו" hint=${this.error}></sw-state-panel>` : nothing}
        ${cams === null
          ? html`<sw-state-panel state="loading" heading="טוען מצלמות…"></sw-state-panel>`
          : html`
            <sw-card heading="מצלמות להשוואה">
              <div class="filters" data-sync-cameras data-picker=${this.tabsMode.ddPicker}>
                ${this.tabsMode.ddPicker === 'chips'
                  ? this.renderChips()
                  : html`<sw-dropdown multiple camera-picker data-sync-pick-cameras label="מצלמות" icon="camera" placeholder="בחר מצלמות (עד 4)" max="4" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
                      .items=${this.syncItems()} .values=${this.picked} @change=${(e: CustomEvent<DropdownChange>) => this.applyPicked(e.detail.ids ?? [])}></sw-dropdown>`}
              </div>
              ${this.renderSlots()}
            </sw-card>
            <sw-card heading="זמן התחלה">
              <div class="transport">
                <sw-field><input type="datetime-local" step="1" data-ltr data-sync-when .value=${this.when} aria-label="זמן" title="זמן מקומי של הדפדפן; ההקלטה נפתחת מהפריים הקרוב ביותר" @change=${(e: Event) => (this.when = (e.target as HTMLInputElement).value)} /></sw-field>
                <sw-button size="sm" @click=${() => (this.when = localInput(new Date(Date.now() - 10 * 60_000)))}>לפני 10 דק׳</sw-button>
                <sw-button size="sm" @click=${() => (this.when = localInput(new Date(Date.now() - 60 * 60_000)))}>לפני שעה</sw-button>
                <span class="grow"></span>
                <sw-button variant="primary" icon="play" data-sync-launch ?disabled=${this.picked.length < 2} title=${this.picked.length < 2 ? 'נדרשות לפחות 2 מצלמות' : 'מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה"'} @click=${() => this.launch()}>פתח השוואה (${this.picked.length})</sw-button>
              </div>
            </sw-card>
            ${this.recent.length
              ? html`<sw-card heading="השוואות אחרונות" subheading="נשמר בדפדפן הזה בלבד">
                  ${this.recent.map((r) => html`<div class="recent" data-sync-recent>
                    <span>${r.cameras.map((id) => this.name(id)).join(' · ')}</span>
                    <span class="ltr note">${new Date(r.at).toLocaleString('he-IL')}</span>
                    <sw-button size="sm" icon="play" @click=${() => this.launch(r.cameras, r.at)}>פתח</sw-button>
                  </div>`)}
                </sw-card>`
              : nothing}
          `}
      </sw-page>
    `;
  }

  static styles = [css`
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .tile {
      position: relative;
    }
    .drift {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      direction: ltr;
    }
    .transport {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .transport .grow {
      flex: 1;
    }
    .transport sw-field {
      inline-size: 170px;
    }
    .filters {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    /* 2.0.1: the picker is one dropdown (the chips of 2.0.0 took a row per camera on the phone); it never grows past the card */
    .filters sw-dropdown {
      max-inline-size: 100%;
    }
    .filters .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* 2.0.2: the four places of a set are always drawn - a picked camera fills its place, an empty one is a numbered, dashed frame
       (the limit is visible without a sentence); two per row on the phone, four on a wide screen */
    .slots {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-block-start: 12px;
    }
    .slot .media,
    .slot.empty {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md, 10px);
      overflow: hidden;
      background: var(--sw-surface-3);
    }
    .slot.empty {
      background: var(--sw-surface-2);
      border: 1.5px dashed var(--sw-border-strong);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: var(--sw-text-3);
    }
    .slot.empty .num {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-sm);
    }
    .slot.empty .role {
      font-size: var(--sw-fs-xs);
    }
    .slot .media img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .slot .media .num,
    .slot .media .lead {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
    }
    /* the lead tag sits on the picture like the number pill: a dark translucent pill with white text in every skin, light and dark
       (the badge's own on-image look keys on the text token, which is light in dark skins) */
    .slot .media .lead {
      background: rgba(17, 24, 39, 0.65);
      color: #fff;
      box-shadow: none;
      border: 0;
    }
    .slot .media .num {
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 6px;
      border-radius: var(--sw-r-pill);
      display: grid;
      place-items: center;
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      font-family: var(--sw-font-mono);
      font-size: 11px;
    }
    /* the remove button: a 28 px circle drawn inside a hit area of the touch dial (44 px on touch layouts, the desktop dial above) */
    .slot .media .rm {
      position: absolute;
      inset-inline-end: 0;
      inset-block-start: 0;
      inline-size: var(--sw-touch-desktop, 44px);
      block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: 32px;
      min-block-size: 32px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #fff;
      font: inherit;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .slot .media .rm .x {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      background: rgba(17, 24, 39, 0.6);
      display: grid;
      place-items: center;
    }
    .slot .media .rm:hover .x {
      background: rgba(17, 24, 39, 0.8);
    }
    .slot .cap {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      min-block-size: 24px;
      padding: 6px 2px 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .slot .cap .name {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .recent {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .recent:last-child {
      border-block-end: 0;
    }
    .recent > span:first-child {
      flex: 1;
      min-inline-size: 0;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .slots {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
    }
    @media (max-width: 1100px) {
      /* a touch layout: the remove button is a 44 px target whatever the desktop dial says */
      .slot .media .rm {
        inline-size: 44px;
        block-size: 44px;
      }
    }
  `, bubbleChrome];

  render() {
    if (isApi()) return this.renderApi();
    const sources = [
      { cam: demoWall[0], drift: '+0.2s', state: 'recorded' },
      { cam: demoWall[9], drift: '-0.4s', state: 'recorded' },
      { cam: demoWall[3], drift: 'gap', state: 'unknown' },
      { cam: demoWall[1], drift: 'buffering', state: 'stale' },
    ] as const;
    return html`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${sources.map(
            (s) => html`<div class="tile">
              <span class="drift">${s.drift}</span>
              <sw-camera-tile name=${s.cam.name} state=${s.state} scene=${demoScene[s.cam.id] ?? 'lobby'}></sw-camera-tile>
            </div>`,
          )}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" value=${`2026-09-14T${minuteLabel(this.cursor)}`} data-ltr aria-label="זמן" @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.split('T')[1] ?? '10:15'; const [h, m] = v.split(':').map(Number); this.cursor = h * 60 + m; }} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה הכל' : 'נגן הכל'} @click=${() => (this.playing = !this.playing)}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${demoSegments} .events=${demoEvents.slice(0, 4).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }))} .cursor=${this.cursor} precision="estimated" @seek=${(e: CustomEvent<{ minute: number }>) => (this.cursor = e.detail.minute)}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="var(--sw-tl-motion)">תנועה</sw-chip><sw-chip dot="var(--sw-tl-person)">אדם</sw-chip><sw-chip dot="var(--sw-tl-vehicle)">רכב</sw-chip><sw-chip dot="var(--sw-tl-door)">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `;
  }
}

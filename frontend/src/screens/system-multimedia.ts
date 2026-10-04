import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import './system-multimedia-players';
import { ApiError, describeError, patch } from '../api/client';
import { can, isApi, session } from '../api/session';
import { invalidateSettings, productSettings } from '../api/prefs';
import { applyMultimediaHidden } from '../shell/nav';
import { SECTION_LABEL, media, type KeyId, type MediaKind, type MediaStatus, type ProfileId, type RemoteConfig, type RemoteSection } from '../api/media-screens';
import {
  CONFIDENCE_LABEL, CONTROL_LABEL, KIND_LABEL, PROFILE_LABEL, ROLE_LABEL, mediaAdmin,
  type AdminDevice, type AdminDevicePatch, type AdminList,
} from '../api/media-admin';
import { SkinController } from '../design/skin';
import { adminTable, mediaAdminListCss } from './media-admin-list';
import { DEFAULT_VIEW, loadView, saveView, type ListView } from './media-admin-list-logic';
import { bubbleChrome } from '../styles/bubble-chrome';

const PROFILES = Object.keys(PROFILE_LABEL) as ProfileId[];
const flash = (ms = 3000) => new Promise((r) => setTimeout(r, ms));

/** The keys a model may add on top of its profile (CR-015 section 4: "model-specific extras are enabled per screen in settings, never
 * guessed"); the server offers (`model_key_options`) and accepts only those the profile allows. */
const EXTRA_KEYS: { id: KeyId; label: string }[] = [
  { id: 'blue', label: 'כחול' }, { id: 'rew', label: 'אחורה מהירה' }, { id: 'ff', label: 'קדימה מהירה' }, { id: 'stop', label: 'עצור' },
  { id: 'exit', label: 'יציאה' }, { id: 'info', label: 'מידע' }, { id: 'guide', label: 'מדריך' }, { id: 'source', label: 'מקור' },
  { id: 'tools', label: 'כלים' }, { id: 'settings', label: 'הגדרות' }, { id: 'chlist', label: 'רשימת ערוצים' }, { id: 'prech', label: 'ערוץ קודם' },
];

/**
 * CR-015 הגדרות › מולטימדיה (`#/system/multimedia`, system.configure, installation scope; the server checks it again on every
 * write): the feature switch, every discovered SCREEN with kind, confidence, approval ("אשר את כל המסכים שזוהו" as one
 * action), display name, public flag, profile (detected / pinned), linked receiver, default audio target and volume ceiling,
 * the connections of each device (which integration answers what, hidden duplicates, link / unlink / ignore, merge
 * suggestions), the remote's default sections, and the fixed display line. A settings screen keeps the exact technical names
 * (docs/design/UI_COPY_RULES.md). CR-016: the speakers, players and receivers, the merge wizard, the saved groups, the favourites, the
 * connection and the permissions line are the sections of `<system-multimedia-players>`. Every change is saved at once (audited server-side: media.device.update / media.link /
 * media.approve); no draft bar. Without a backend the in-memory demo of api/media-admin.ts answers.
 */
@customElement('system-multimedia')
export class SystemMultimedia extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private phase: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private list: AdminList = { devices: [], suggestions: [] };
  @state() private status: MediaStatus | null = null;
  @state() private enabled = true;
  @state() private remote: RemoteConfig | null = null;
  @state() private remoteDirty = false;
  @state() private error = '';
  @state() private note = '';
  @state() private saved = '';
  @state() private open = new Set<string>();
  @state() private editing = new Set<string>();
  @state() private view: ListView = { ...DEFAULT_VIEW };
  private noteTimer = 0;

  static styles = [mediaAdminListCss, css`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
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
      /* 0.1.162: the form opens inside the list's padded detail row; a field never grows past it (the profile select's
         longest option, "זיהוי אוטומטי · ...", is wider than a 320 px phone's row) */
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
      max-inline-size: 100%;
    }
    select {
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    input[type='text'] {
      min-inline-size: min(200px, 100%);
    }
    input[type='number'] {
      inline-size: 88px;
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      overflow: hidden;
    }
    .seg button {
      border: 0;
      background: var(--sw-surface);
      padding: 0 12px;
      min-block-size: 36px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .seg button:disabled {
      opacity: 0.45;
      cursor: default;
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
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
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
    .sec {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .sec .nm {
      flex: 1;
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
    this.view = loadView('screens', session.me?.user.id ?? '');
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.noteTimer);
  }

  private async load() {
    this.error = '';
    if (isApi() && !can('system.configure')) {
      this.phase = 'forbidden';
      return;
    }
    try {
      const [list, status, remote] = await Promise.all([mediaAdmin().list(), media().status(), media().remoteDefault()]);
      this.list = list;
      this.status = status;
      this.remote = remote;
      this.remoteDirty = false;
      this.enabled = isApi() ? String((await productSettings(true))['multimedia.enabled' as never] ?? 'true') !== 'false' : status.enabled;
      this.phase = 'ready';
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.phase = 'forbidden';
      else {
        this.error = describeError(err);
        this.phase = 'error';
      }
    }
  }

  private say(text: string) {
    this.note = text;
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => (this.note = ''), 3500);
  }

  // ------------------------------------------------------------------------------------------------ writes

  private async setEnabled(on: boolean) {
    this.error = '';
    try {
      if (isApi()) {
        await patch('settings', { 'multimedia.enabled': String(on) });
        invalidateSettings();
      }
      this.enabled = on;
      applyMultimediaHidden({ 'multimedia.enabled': String(on) }); // the rail entry follows at once
      this.say('נשמר');
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async updateDevice(d: AdminDevice, p: AdminDevicePatch) {
    this.error = '';
    try {
      const to = await mediaAdmin().update(d.key, p);
      this.list = { ...this.list, devices: this.list.devices.map((x) => (x.key === d.key ? to : x)) };
      this.saved = d.key;
      void flash().then(() => (this.saved = this.saved === d.key ? '' : this.saved));
    } catch (err) {
      this.error = describeError(err);
      await this.load();
    }
  }

  private async approveAll() {
    const keys = this.list.devices.filter((d) => d.kind === 'screen' && !d.approved).map((d) => d.key);
    if (!keys.length) return;
    try {
      await mediaAdmin().approve(keys, true);
      this.list = { ...this.list, devices: this.list.devices.map((d) => (keys.includes(d.key) ? { ...d, approved: true } : d)) };
      this.say(`אושרו ${keys.length} מסכים`);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async link(op: Parameters<ReturnType<typeof mediaAdmin>['link']>[0]) {
    try {
      this.list = await mediaAdmin().link(op);
      this.say('נשמר');
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private setSection(id: RemoteSection, patchIt: { on?: boolean; more?: boolean }) {
    const r = this.remote;
    if (!r) return;
    const sections = r.sections.map((s) => (s.id === id && patchIt.on !== undefined ? { ...s, on: patchIt.on } : s));
    const more = patchIt.more === undefined ? r.more : patchIt.more ? [...new Set([...r.more, id])] : r.more.filter((x) => x !== id);
    this.remote = { ...r, sections, more };
    this.remoteDirty = true;
  }

  private moveSection(id: RemoteSection, dir: -1 | 1) {
    const r = this.remote;
    if (!r) return;
    const i = r.sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= r.sections.length) return;
    const sections = [...r.sections];
    [sections[i], sections[j]] = [sections[j], sections[i]];
    this.remote = { ...r, sections };
    this.remoteDirty = true;
  }

  private async saveRemote() {
    if (!this.remote) return;
    try {
      this.remote = await media().saveRemoteDefault(this.remote);
      this.remoteDirty = false;
      this.say('נשמר');
    } catch (err) {
      this.error = describeError(err);
    }
  }

  // ------------------------------------------------------------------------------------------------ render

  // ------------------------------------------------------------------------------------------------ the list

  private setView = (v: ListView) => {
    this.view = v;
    saveView('screens', session.me?.user.id ?? '', v);
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

  private table(screens: AdminDevice[]): TemplateResult {
    return adminTable({
      scope: 'screens', devices: screens, view: this.view, editing: this.editing, endpoints: this.open, saved: this.saved,
      form: (d) => this.form(d), connections: (d) => this.connections(d), typeLabel: (d) => KIND_LABEL[d.kind as MediaKind] ?? d.kind,
      onView: this.setView, onEdit: (k) => this.toggle('editing', k), onEndpoints: (k) => this.toggle('open', k),
      onApprove: (d, on) => void this.updateDevice(d, { approved: on }), onCopy: (t) => void this.copy(t), none: 'לא זוהו מסכים.',
    });
  }

  /** The full form of one screen: it opens under the row (the list shows the compact row; every field and action below is unchanged). */
  private form(d: AdminDevice): TemplateResult {
    const receivers = this.list.devices.filter((x) => x.key !== d.key && (x.kind === 'receiver' || x.kind === 'speaker'));
    const extra = d.model_key_options ? EXTRA_KEYS.filter((k) => d.model_key_options!.includes(k.id)) : EXTRA_KEYS;
    return html`<div class="dev" data-mm-form=${d.key}>
      <div class="line">
        <label class="f">שם
          <input type="text" .value=${d.name} maxlength="60" data-mm-name=${d.key} @change=${(e: Event) => void this.updateDevice(d, { display_name: (e.target as HTMLInputElement).value })} />
        </label>
        <label class="f">סוג
          <select data-mm-kind=${d.key} @change=${(e: Event) => void this.updateDevice(d, { kind: (e.target as HTMLSelectElement).value as AdminDevice['kind'] })}>
            ${(Object.keys(KIND_LABEL) as MediaKind[]).map((k) => html`<option value=${k} ?selected=${d.kind === k}>${KIND_LABEL[k]}</option>`)}
          </select>
        </label>
        <span class="f">זיהוי<sw-badge kind=${d.confidence === 'weak' ? 'stale' : 'neutral'} label=${CONFIDENCE_LABEL[d.confidence]}></sw-badge></span>
        <span class="f">מיקום<span>${[d.floor_name, d.area_name].filter(Boolean).join(' › ') || '—'}</span></span>
        <span class="grow"></span>
      </div>
      <div class="line">
        <label class="f inline">מסך ציבורי<sw-toggle label=${`מסך ציבורי: ${d.name}`} labelHidden .checked=${d.public} ?disabled=${d.kind !== 'screen'} data-mm-public=${d.key} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.updateDevice(d, { public: e.detail.checked })}></sw-toggle></label>
        <label class="f">פרופיל
          <select data-mm-profile=${d.key} ?disabled=${d.kind !== 'screen'} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.updateDevice(d, { profile: v === '' ? null : (v as ProfileId) }); }}>
            <option value="" ?selected=${d.profile_source === 'auto'}>זיהוי אוטומטי · ${PROFILE_LABEL[d.profile]}</option>
            ${PROFILES.map((p) => html`<option value=${p} ?selected=${d.profile_source === 'manual' && d.profile === p}>${PROFILE_LABEL[p]}</option>`)}
          </select>
        </label>
        <label class="f">מגבר מקושר
          <select data-mm-link=${d.key} ?disabled=${d.kind !== 'screen'} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.updateDevice(d, { audio_link_key: v || null, ...(v ? {} : { audio_default: 'screen' as const }) }); }}>
            <option value="" ?selected=${!d.audio_link_key}>ללא</option>
            ${receivers.map((r) => html`<option value=${r.key} ?selected=${d.audio_link_key === r.key}>${r.name}</option>`)}
          </select>
        </label>
        <span class="f">שמע ברירת מחדל
          <span class="seg" role="group" aria-label="שמע ברירת מחדל">
            <button type="button" aria-pressed=${String(d.audio_default === 'screen')} ?disabled=${!d.audio_link_key} @click=${() => void this.updateDevice(d, { audio_default: 'screen' })}>רמקולי המסך</button>
            <button type="button" aria-pressed=${String(d.audio_default === 'linked')} ?disabled=${!d.audio_link_key} @click=${() => void this.updateDevice(d, { audio_default: 'linked' })}>מגבר</button>
          </span>
        </span>
        <label class="f">תקרת עוצמה
          <input type="number" min="0" max="100" .value=${d.volume_max === null ? '' : String(d.volume_max)} placeholder="ללא" data-mm-volmax=${d.key}
            @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); const n = Math.max(0, Math.min(100, Math.round(Number(v)))); void this.updateDevice(d, { volume_max: v === '' || Number.isNaN(n) ? null : n }); }} />
        </label>
      </div>
      ${d.also_turns_on.length ? html`<div class="muted" data-mm-also>גם מדליק: ${d.also_turns_on.join(', ')}</div>` : nothing}
      ${d.kind === 'screen' && d.profile !== 'generic' && extra.length ? html`<div class="line" data-mm-extra-keys=${d.key}><span class="f">מקשים נוספים למסך זה</span>${extra.map((k) => html`<label class="f inline"><input type="checkbox" .checked=${d.model_keys.includes(k.id)} @change=${(e: Event) => void this.updateDevice(d, { model_keys: extra.filter((x) => (x.id === k.id ? (e.target as HTMLInputElement).checked : d.model_keys.includes(x.id))).map((x) => x.id) })} />${k.label}</label>`)}</div>` : nothing}
    </div>`;
  }


  private connections(d: AdminDevice): TemplateResult {
    return html`<div data-mm-endpoints=${d.key}>${d.endpoints.map((e) => html`<div class="ep" data-mm-endpoint=${e.endpoint_id}>
        <span class="mono">${e.platform}</span>
        <span>${ROLE_LABEL[e.role] ?? e.role}${e.hidden ? html` <sw-badge kind="neutral" label="מוסתר"></sw-badge>` : nothing}</span>
        <span class="muted">${e.primary_for.length ? `עונה על: ${e.primary_for.map((c) => CONTROL_LABEL[c]).join(', ')}` : 'כפילות'} · שלב ${e.rule}${e.link_source === 'manual' ? ' · ידני' : ''}</span>
        <span style="display:flex;gap:6px">
          ${e.hidden ? html`<sw-button size="sm" data-mm-restore=${e.endpoint_id} @click=${() => void this.link({ op: 'restore', endpoint_id: e.endpoint_id })}>שחזר</sw-button>`
            : html`<sw-button size="sm" data-mm-ignore=${e.endpoint_id} @click=${() => void this.link({ op: 'ignore', endpoint_id: e.endpoint_id })}>התעלם</sw-button>
              ${d.endpoints.length > 1 ? html`<sw-button size="sm" data-mm-unlink=${e.endpoint_id} @click=${() => void this.link({ op: 'unlink', endpoint_id: e.endpoint_id })}>פצל</sw-button>` : nothing}`}
        </span>
      </div>`)}</div>`;
  }

  private suggestions(): TemplateResult | typeof nothing {
    const s = this.list.suggestions ?? [];
    if (!s.length) return nothing;
    const name = (k: string) => this.list.devices.find((d) => d.key === k)?.name ?? k;
    return html`<sw-card heading="הצעות איחוד" data-mm-suggestions>
      ${s.map((x) => html`<div class="row"><span class="lbl"><span class="mono">${x.endpoint_id.replace(/^ha:/, '')}</span><span class="muted">${x.reason} · אל ${name(x.device_key)}</span></span>
        <sw-button size="sm" data-mm-merge=${x.endpoint_id} @click=${() => void this.link({ op: 'link', endpoint_id: x.endpoint_id, device_key: x.device_key })}>אחד</sw-button></div>`)}
    </sw-card>`;
  }

  private remoteCard(): TemplateResult | typeof nothing {
    const r = this.remote;
    if (!r) return nothing;
    return html`<sw-card heading="שלט" data-mm-remote>
      ${r.sections.map((s, i) => html`<div class="sec" data-mm-section=${s.id}>
        <sw-toggle label=${`הצג: ${SECTION_LABEL[s.id]}`} labelHidden .checked=${s.on} @change=${(e: CustomEvent<{ checked: boolean }>) => this.setSection(s.id, { on: e.detail.checked })}></sw-toggle>
        <span class="nm">${SECTION_LABEL[s.id]}</span>
        <label class="f inline"><input type="checkbox" .checked=${r.more.includes(s.id)} ?disabled=${!s.on} aria-label=${`מאחורי "עוד מקשים": ${SECTION_LABEL[s.id]}`} @change=${(e: Event) => this.setSection(s.id, { more: (e.target as HTMLInputElement).checked })} />מאחורי "עוד מקשים"</label>
        <button type="button" class="ib" aria-label=${`הקדם: ${SECTION_LABEL[s.id]}`} ?disabled=${i === 0} @click=${() => this.moveSection(s.id, -1)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
        <button type="button" class="ib" aria-label=${`אחר: ${SECTION_LABEL[s.id]}`} ?disabled=${i === r.sections.length - 1} @click=${() => this.moveSection(s.id, 1)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>
      </div>`)}
      <div class="row"><span class="muted">ברירת המחדל של כל המסכים; אפשר לשנות מסך בודד דרך "עריכת השלט" בתפריט המשתמש.</span>
        <sw-button variant="primary" size="sm" ?disabled=${!this.remoteDirty} data-mm-save-remote @click=${() => void this.saveRemote()}>שמור</sw-button></div>
    </sw-card>`;
  }

  render() {
    if (this.phase === 'forbidden') return html`<sw-page heading="מולטימדיה"><sw-state-panel data-mm-admin-state="forbidden" state="forbidden" heading="אין לך הרשאה להגדרות המדיה" hint="נדרשת ההרשאה להגדרת המערכת."></sw-state-panel></sw-page>`;
    if (this.phase === 'loading') return html`<sw-page heading="מולטימדיה"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.phase === 'error') return html`<sw-page heading="מולטימדיה"><sw-state-panel data-mm-admin-state="error" state="error" heading="לא ניתן לטעון את הגדרות המדיה" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    const st = this.status;
    const screens = this.list.devices.filter((d) => d.kind === 'screen');
    const pending = screens.filter((d) => !d.approved).length;
    const bridge = st?.bridge;
    return html`<sw-page heading="מולטימדיה" subheading=${`${screens.filter((d) => d.approved).length} מסכים מאושרים${pending ? ` · ${pending} ממתינים לאישור` : ''}`}>
      <div class="stack">
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
        <sw-card heading="כללי" data-mm-general>
          <div class="row"><span class="lbl">מולטימדיה<span class="muted">כבוי = הכניסה "מולטימדיה" אינה מוצגת לאף משתמש</span></span>
            <sw-toggle label="מולטימדיה" labelHidden .checked=${this.enabled} data-mm-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.setEnabled(e.detail.checked)}></sw-toggle></div>
          <div class="row"><span class="lbl">רכיב החיבור (גשר Arx)<span class="muted" data-mm-bridge>${bridge ? (bridge.media_ready ? `גרסה ${bridge.version ?? '?'} · מוכן לפקודות מדיה` : bridge.paired ? `גרסה ${bridge.version ?? '?'} · נדרש עדכון (0.4.0 ומעלה)` : 'לא מצומד') : '—'}</span></span></div>
          <div class="row"><span class="lbl">תצוגה<span class="muted" data-mm-display>זכוכית תמיד; בהיר/כהה לפי חשמל והתקנים</span></span></div>
        </sw-card>
        <sw-card heading="מסכים" data-mm-devices>
          <div class="row"><span class="muted">רק מסכים מאושרים מופיעים ב"מולטימדיה".</span>
            <sw-button size="sm" variant="primary" icon="check" data-mm-approve-all ?disabled=${!pending} @click=${() => void this.approveAll()}>אשר את כל המסכים שזוהו${pending ? ` (${pending})` : ''}</sw-button></div>
          ${this.table(screens)}
        </sw-card>
        ${this.suggestions()}
        ${this.remoteCard()}
        <system-multimedia-players></system-multimedia-players>
        ${this.note ? html`<div class="ok" role="status" data-mm-note>${this.note}</div>` : nothing}
      </div>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-multimedia': SystemMultimedia;
  }
}

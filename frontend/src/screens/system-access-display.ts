import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { getSettings, patchSettings, type ProductSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { can, isApi } from '../api/session';
import { MAX_PHRASES, MAX_PHRASE_LENGTH, POLICY_DEFAULTS, POLICY_KEYS, parsePolicy } from './wiskey-stations-logic';
import { PHRASES_STORED_MAX, mediaOptions, phrasePreview } from '../access-control/parity-logic';
import { STATION_MEDIA_KEY, TALK_MAX_DEFAULT_S, TALK_MAX_KEY, TALK_MAX_MAX_S, TALK_MAX_MIN_S, parseMediaMode, parseTalkMax, talkMaxInput } from '../api/station-media';
import { STATION_LISTEN_KEY, parseListenMode } from '../api/station-listen';
import { slt } from '../i18n/wiskey-station-listen';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { pt } from '../i18n/access-parity';

type DisplayKey = (typeof POLICY_KEYS)[keyof typeof POLICY_KEYS] | typeof STATION_MEDIA_KEY | typeof TALK_MAX_KEY | typeof STATION_LISTEN_KEY;
const DEFAULTS: Record<DisplayKey, string> = {
  [POLICY_KEYS.callHint]: POLICY_DEFAULTS.callHint,
  [POLICY_KEYS.talk]: POLICY_DEFAULTS.talk,
  [POLICY_KEYS.announceScope]: POLICY_DEFAULTS.announceScope,
  [POLICY_KEYS.phrases]: '',
  [STATION_MEDIA_KEY]: 'off',
  [TALK_MAX_KEY]: String(TALK_MAX_DEFAULT_S),
  [STATION_LISTEN_KEY]: 'off',
};

/**
 * CR-036 S12: "תצוגת מסך התחנות" - the stations screen's four display settings as real controls, in Settings › כללי › מתגי מסכי כניסה,
 * next to the per-screen switch (owner answer 1 of 2026-10-12: the switch and the display choices live in Settings only, never in a
 * screen header). Until this slice they were changed through `PATCH /settings` only (integration decision 3 of 2026-10-12). The values
 * are the S6 settings (routers/settings.py): who sees the incoming-call hint, whether the talk button opens the classic panel or is
 * hidden, whether an announcement may target a place / all stations (always inside the caller's own scope) or one station, and the quick
 * phrases. `GET` / `PATCH /settings`, `system.configure`, audited by the server like every product setting; saved together with the
 * card's own button. A value the server cannot read is shown as the default the stations screen acts on (`parsePolicy`).
 *
 * WXMEDSET (owner 2026-10-13): the fifth row, "וידאו ודיבור במסך התחנות" (`access.station_media`: off / video / video + talk, default
 * off), is the S18 setting that used to be changed through `PATCH /settings` only. A bare control row - the label and the choice, no
 * hint line: the picture always goes through the product's own media server, so there is nothing to explain or to choose beside it.
 *
 * WKDIRECT-295: "משך דיבור מרבי" (`access.station_media_max_talk_s`, seconds, a whole number 1..86400, default 300 - the station's own
 * range) appears under it only while the choice is video + talk; a talk ends at the smaller of this and the station's own value. A value
 * outside the range is not saved (the field says the range).
 */
@customElement('system-access-display')
export class SystemAccessDisplay extends LitElement {
  @state() private saved: Record<DisplayKey, string> | null = null;
  @state() private draft: Partial<Record<DisplayKey, string>> = {};
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private failed = '';
  private gen = 0;

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
        /* every control of the card is a 44 px target (the shared settings rows are not, in every skin) */
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
      /* the phrase row stacks its label over the box: the label keeps its own height (a row's 220 px basis is a width) */
      .row.stack .lbl {
        flex: none;
      }
      textarea {
        min-block-size: 132px;
        resize: vertical;
        line-height: 1.5;
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    this.gen += 1;
    super.disconnectedCallback();
  }

  private read(settings: Partial<ProductSettings> | Record<string, unknown>): Record<DisplayKey, string> {
    const policy = parsePolicy(settings as Record<string, unknown>);
    return {
      [POLICY_KEYS.callHint]: policy.callHint,
      [POLICY_KEYS.talk]: policy.talk,
      [POLICY_KEYS.announceScope]: policy.announceScope,
      [POLICY_KEYS.phrases]: String((settings as Record<string, unknown>)[POLICY_KEYS.phrases] ?? ''),
      [STATION_MEDIA_KEY]: parseMediaMode(settings as Record<string, unknown>),
      [TALK_MAX_KEY]: String(parseTalkMax(settings as Record<string, unknown>)),
      [STATION_LISTEN_KEY]: parseListenMode(settings as Record<string, unknown>),
    } as Record<DisplayKey, string>;
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    this.failed = '';
    if (!isApi()) {
      this.saved = { ...DEFAULTS };
      return;
    }
    try {
      const r = await getSettings();
      if (gen !== this.gen) return;
      this.saved = this.read(r.settings);
      this.canEdit = !!r.can_edit && can('system.configure');
    } catch (err) {
      if (gen !== this.gen) return;
      this.failed = describeError(err);
    }
  }

  private value(key: DisplayKey): string {
    return this.draft[key] ?? this.saved?.[key] ?? DEFAULTS[key];
  }

  private set(key: DisplayKey, value: string): void {
    const next = { ...this.draft };
    if (this.saved && this.saved[key] === value) delete next[key];
    else next[key] = value;
    this.draft = next;
    this.message = '';
  }

  /** The draft as the server takes it: the talk limit as a number; null while it is not a whole number in the range. */
  private payload(): Partial<ProductSettings> | null {
    const out: Record<string, unknown> = { ...this.draft };
    if (TALK_MAX_KEY in out) {
      const n = talkMaxInput(String(out[TALK_MAX_KEY]));
      if (n === null) return null;
      out[TALK_MAX_KEY] = n;
    }
    return out as Partial<ProductSettings>;
  }

  private async save(): Promise<void> {
    if (!Object.keys(this.draft).length || this.busy) return;
    const body = this.payload();
    if (!body) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings(body);
      this.saved = this.read(r.settings);
      this.draft = {};
      invalidateSettings();
      this.message = pt('dispSaved');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private select(key: DisplayKey, options: Array<[string, string]>) {
    const ro = !isApi() || !this.canEdit;
    return html`<sw-field class="ctl"><select data-set-access-display=${key} ?disabled=${ro || this.busy} @change=${(e: Event) => this.set(key, (e.target as HTMLSelectElement).value)}>
      ${options.map(([v, label]) => html`<option value=${v} ?selected=${this.value(key) === v}>${label}</option>`)}
    </select></sw-field>`;
  }

  private talkMax() {
    const ro = !isApi() || !this.canEdit;
    const value = this.value(TALK_MAX_KEY);
    const bad = talkMaxInput(value) === null;
    return html`<div class="row" data-access-display-talk-max><span class="lbl">${pt('dispTalkMax')}</span>
      <sw-field class="ctl" hint=${bad ? pt('dispTalkMaxInvalid', { min: TALK_MAX_MIN_S, max: TALK_MAX_MAX_S }) : pt('dispTalkMaxUnit')}>
        <input type="number" inputmode="numeric" dir="ltr" min=${TALK_MAX_MIN_S} max=${TALK_MAX_MAX_S} step="1" data-set-access-display=${TALK_MAX_KEY}
          aria-label=${pt('dispTalkMax')} aria-invalid=${bad ? 'true' : 'false'} ?disabled=${ro || this.busy} .value=${value}
          @input=${(e: Event) => this.set(TALK_MAX_KEY, (e.target as HTMLInputElement).value)} />
      </sw-field></div>`;
  }

  render() {
    if (this.failed) {
      return html`<sw-card heading=${pt('dispTitle')} data-access-display="error"><div class="row"><span class="lbl">${this.failed}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => void this.load()}>${pt('dispRetry')}</sw-button></div></sw-card>`;
    }
    if (!this.saved) return html`<sw-card heading=${pt('dispTitle')} data-access-display="loading"><div class="row"><span class="lbl muted">${pt('dispLoading')}</span></div></sw-card>`;
    const ro = !isApi() || !this.canEdit;
    const phrases = this.value(POLICY_KEYS.phrases);
    const preview = phrasePreview(phrases);
    const dirty = Object.keys(this.draft).length > 0;
    const valid = talkMaxInput(this.value(TALK_MAX_KEY)) !== null;
    return html`<sw-card heading=${pt('dispTitle')} subheading=${pt('dispSub')} data-access-display="ready">
      <div class="row"><span class="lbl">${pt('dispCallHint')}<span class="muted">${pt('dispCallHintText')}</span></span>
        ${this.select(POLICY_KEYS.callHint, [['everyone', pt('dispCallHintEveryone')], ['call', pt('dispCallHintCall')]])}</div>
      <div class="row"><span class="lbl">${pt('dispTalk')}<span class="muted">${pt('dispTalkText')}</span></span>
        ${this.select(POLICY_KEYS.talk, [['classic', pt('dispTalkClassic')], ['hidden', pt('dispTalkHidden')]])}</div>
      <div class="row" data-access-display-media><span class="lbl">${pt('dispMedia')}</span>
        ${this.select(STATION_MEDIA_KEY, mediaOptions())}</div>
      ${this.value(STATION_MEDIA_KEY) === 'video_talk' ? this.talkMax() : nothing}
      ${this.value(STATION_MEDIA_KEY) !== 'off'
        ? html`<div class="row" data-access-display-listen><span class="lbl">${slt().setting.label}<span class="muted">${slt().setting.text}</span></span>
            ${this.select(STATION_LISTEN_KEY, [['off', slt().setting.off], ['on', slt().setting.on], ['probe', slt().setting.probe]])}</div>`
        : nothing}
      <div class="row"><span class="lbl">${pt('dispAnnounce')}<span class="muted">${pt('dispAnnounceText')}</span></span>
        ${this.select(POLICY_KEYS.announceScope, [['scope', pt('dispAnnounceScope')], ['station', pt('dispAnnounceStation')]])}</div>
      <div class="row stack"><span class="lbl">${pt('dispPhrases')}<span class="muted">${pt('dispPhrasesText', { n: MAX_PHRASES, len: MAX_PHRASE_LENGTH })}</span></span>
        <sw-field hint=${[preview.builtIn ? pt('dispPhrasesBuiltIn') : pt('dispPhrasesCount', { n: preview.shown }), preview.dropped ? pt('dispPhrasesDropped', { n: preview.dropped }) : ''].filter(Boolean).join(' · ')}>
          <textarea data-set-access-display=${POLICY_KEYS.phrases} aria-label=${pt('dispPhrases')} maxlength=${PHRASES_STORED_MAX} rows="5" ?disabled=${ro || this.busy} .value=${phrases} @input=${(e: Event) => this.set(POLICY_KEYS.phrases, (e.target as HTMLTextAreaElement).value)}></textarea>
        </sw-field></div>
      ${ro
        ? html`<div class="muted" data-access-display-readonly>${isApi() ? pt('dispReadOnly') : ''}</div>`
        : html`<div class="foot">
            <sw-button variant="primary" icon="check" data-save-access-display ?disabled=${!dirty || !valid || this.busy} @click=${() => void this.save()}>${pt('dispSave')}</sw-button>
            ${this.message ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
          </div>`}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-display': SystemAccessDisplay;
  }
}

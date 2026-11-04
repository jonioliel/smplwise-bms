import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-field';
import './sw-icon';
import './wk-action-button';
import { announceToStations, type AnnounceOutcome, type AccessStation } from '../api/access-stations';
import { describeError } from '../api/client';
import { getIntercomTtsEngines, type IntercomTtsEngines, type IntercomTtsStatus } from '../api/intercom';
import { productSettings } from '../api/prefs';
import { TTS_FIXED_NONE, languageFor, languageName, parseTtsFixed, resolveTtsPick, type TtsFixed } from '../api/tts-default';
import { fill, ws } from '../i18n/wiskey-stations';
import { fill as tfill, ttt } from '../i18n/tts-default';
import { TTS_MAX, announceChoices, collapseText, speechSeconds, ttsLength, ttsStateText, type AnnounceScope, type PlaceMap, type TargetChoice } from '../screens/wiskey-stations-logic';

/** How long WisKey's engine list is reused between two openings before it is read again (a fixed engine may come back, or go). */
const ENGINES_TTL_MS = 60_000;

type Tone = 'ok' | 'warn' | 'err';

/**
 * The announcement composer of the stations screen (CR-036 slice S6; the design's `wk-announce-dialog`): where to (one station, a
 * place, all stations - inside the caller's scope, online ones), the text with WisKey's own 500 character limit, quick phrases,
 * a preview line (language, voice, an estimate of the spoken time) and the outcome.
 *
 * It writes only through `announceToStations` (api/access-stations.ts - the ONE function slice S11 binds to the new gate): one
 * station after the other, each exactly once, never retried. The wording never claims the speaker played it: "sent", and playback
 * at the station is "not verified". An unknown outcome locks the composer (no one-click resend into an ambiguous state).
 * Local playback ("האזנה") is not offered: the platform's speech proxy is not reachable from here (a W? of the design).
 *
 * TTS-DEFAULT-ENGINE-2400: every opening preselects the installation's fixed engine and language (api/tts-default.ts `resolveTtsPick`,
 * the setting read through GET /settings); "עוד" lets the sender pick another for this announcement only. A fixed engine WisKey does not
 * list right now is never replaced: no engine is selected, "עוד" opens by itself with the plain note, and sending waits for a pick.
 */
@customElement('wk-announce-dialog')
export class WkAnnounceDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** The stations the caller sees (the screen's list); only online ones can speak. */
  @property({ attribute: false }) stations: AccessStation[] = [];
  @property({ attribute: false }) places: PlaceMap | null = null;
  @property() scope: AnnounceScope = 'scope';
  @property({ attribute: false }) phrases: readonly string[] = [];
  /** The station the dialog was opened from (its chip comes first). */
  @property() preselect = '';
  /** Progress notices per station (`intercom_tts`), for the one-station line. */
  @property({ attribute: false }) tts: Readonly<Record<string, IntercomTtsStatus>> = {};

  @state() private engines: IntercomTtsEngines | null = null;
  @state() private enginesNote = '';
  @state() private engine = '';
  @state() private language = '';
  @state() private message = '';
  @state() private choice = '';
  @state() private sending = false;
  @state() private result: { tone: Tone; text: string } | null = null;
  @state() private locked = false;
  @state() private retryAt = 0;
  @state() private more = false;
  @state() private sent: string[] = [];
  /** TTS-DEFAULT-ENGINE-2400: the installation's fixed choice, the engine it preselected, and what of it is missing right now. */
  @state() private fixed: TtsFixed = TTS_FIXED_NONE;
  @state() private preselected = '';
  @state() private missingEngine: string | null = null;
  @state() private missingLanguage: string | null = null;
  private loadedEngines = false;
  private enginesAt = 0;
  private timer = 0;

  static styles = css`
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      position: relative;
    }
    .fld > label {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .chip {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      max-inline-size: 100%;
      padding-inline: var(--sw-s-3h);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      text-align: start;
    }
    .chip:hover {
      background: var(--sw-surface-2);
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-medium);
    }
    .chip span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chip:focus-visible,
    textarea:focus-visible,
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 88px;
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-5);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      line-height: 1.5;
      resize: vertical;
    }
    textarea:disabled {
      opacity: var(--sw-disabled-opacity);
    }
    .cnt {
      position: absolute;
      inset-block-end: var(--sw-s-2);
      inset-inline-end: var(--sw-s-3);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      pointer-events: none;
    }
    .cnt.over {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-semibold);
    }
    .prev {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .prev .sp {
      flex: 1;
    }
    .engine {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--sw-s-3);
    }
    .engine select {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .engine .result {
      grid-column: 1 / -1;
    }
    .result {
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      line-height: 1.4;
    }
    .result.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .result.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    @media (max-width: 1100px) {
      .chip,
      .engine select {
        min-block-size: 44px;
      }
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('open') && this.open) this.reset();
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has('open') && this.open) {
      if (!this.loadedEngines || Date.now() - this.enginesAt > ENGINES_TTL_MS) void this.loadEngines();
      else void this.applyFixed();
    }
  }

  private reset() {
    this.message = '';
    this.result = null;
    this.locked = false;
    this.retryAt = 0;
    this.sending = false;
    this.more = false;
    this.sent = [];
    this.choice = this.choices()[0]?.key ?? '';
  }

  private online(): AccessStation[] {
    return this.stations.filter((s) => s.online);
  }

  private choices(): TargetChoice[] {
    return announceChoices(this.online(), this.places, this.scope, this.preselect || undefined);
  }

  private current(): TargetChoice | undefined {
    const all = this.choices();
    return all.find((c) => c.key === this.choice) ?? all[0];
  }

  private async loadEngines() {
    this.loadedEngines = true;
    this.enginesAt = Date.now();
    this.enginesNote = '';
    try {
      const r = await getIntercomTtsEngines();
      if (r.tts && r.tts.engines.length) {
        this.engines = r.tts;
        await this.applyFixed();
      } else if (r.tts) {
        this.enginesNote = ws().announceDlg.noEngine;
      } else {
        this.enginesNote = r.state === 'unsupported' ? ws().announceDlg.enginesUnsupported : ws().announceDlg.noEngine;
      }
    } catch (err) {
      this.enginesNote = describeError(err);
      this.loadedEngines = false; // the next open tries again
    }
  }

  /** TTS-DEFAULT-ENGINE-2400: the preselection of this opening - the fixed engine and language (the system default and the automatic
   * language when none is fixed). A settings read that fails keeps the behaviour before the setting. */
  private async applyFixed() {
    if (!this.engines?.engines.length) return;
    try {
      this.fixed = parseTtsFixed((await productSettings()) as unknown as Record<string, unknown>);
    } catch {
      this.fixed = TTS_FIXED_NONE;
    }
    const pick = resolveTtsPick(this.engines, this.fixed);
    this.engine = pick.engine;
    this.language = pick.language;
    this.preselected = pick.engine;
    this.missingEngine = pick.missingEngine;
    this.missingLanguage = pick.missingLanguage;
    if (pick.missingEngine) this.more = true; // the engine choice is where the user acts on it
  }

  /** The sender's own pick for this announcement: the fixed language when that engine supports it, else WisKey's own choice (Hebrew when
   * the engine has it, else its default). */
  private pickEngine(engineId: string) {
    this.engine = engineId;
    this.language = languageFor(this.engines, engineId, this.fixed);
    this.missingLanguage = null;
  }

  private busySeconds(): number {
    return Math.max(0, Math.ceil((this.retryAt - Date.now()) / 1000));
  }

  private startRetryClock() {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (this.busySeconds() <= 0) {
        window.clearInterval(this.timer);
        this.retryAt = 0;
      } else this.requestUpdate();
    }, 1000);
  }

  private ready(): boolean {
    const len = ttsLength(this.message);
    return !!this.engine && len > 0 && len <= TTS_MAX && !this.sending && !this.locked && this.busySeconds() === 0 && !!this.current()?.stationIds.length;
  }

  private async send() {
    const choice = this.current();
    const message = collapseText(this.message);
    if (!this.ready() || !choice) return;
    const t = ws().announceDlg;
    const ids = choice.stationIds.filter((id) => this.online().some((s) => s.id === id));
    if (!ids.length) {
      this.result = { tone: 'warn', text: t.noTargets };
      return;
    }
    this.sending = true;
    this.result = null;
    let outcomes: AnnounceOutcome[] = [];
    try {
      outcomes = await announceToStations({ stationIds: ids, engine_id: this.engine, language: this.language || null, message });
    } finally {
      this.sending = false;
    }
    for (const o of outcomes) if (o.status) this.dispatchEvent(new CustomEvent('tts-status', { detail: o.status, bubbles: true, composed: true }));
    this.sent = outcomes.filter((o) => o.outcome === 'sent').map((o) => o.station_id);
    this.result = this.summarize(outcomes);
    if (outcomes.some((o) => o.outcome === 'unknown')) this.locked = true;
    const wait = outcomes.filter((o) => o.code === 'audio_busy').map((o) => o.retry_after_s ?? 10);
    if (wait.length && !this.locked) {
      this.retryAt = Date.now() + Math.min(...wait) * 1000;
      this.startRetryClock();
    }
  }

  private summarize(outcomes: AnnounceOutcome[]): { tone: Tone; text: string } {
    const t = ws().announceDlg;
    const sent = outcomes.filter((o) => o.outcome === 'sent');
    const bad = outcomes.filter((o) => o.outcome !== 'sent');
    const name = (id: string) => this.stations.find((s) => s.id === id)?.name ?? id;
    if (!bad.length) return { tone: 'ok', text: sent.length === 1 ? t.sentOne : fill(t.sentMany, { n: sent.length }) };
    if (outcomes.some((o) => o.outcome === 'unknown')) {
      return { tone: 'warn', text: sent.length ? fill(t.partial, { ok: sent.length, bad: bad.length, names: bad.map((o) => name(o.station_id)).join(', ') }) + ' · ' + t.unknown : t.unknown };
    }
    if (sent.length) return { tone: 'warn', text: fill(t.partial, { ok: sent.length, bad: bad.length, names: bad.map((o) => name(o.station_id)).join(', ') }) };
    if (bad.every((o) => o.code === 'audio_busy')) return { tone: 'warn', text: t.busy };
    return { tone: 'err', text: bad[0].error ?? t.failed };
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private progress(): string {
    if (this.sent.length !== 1) return '';
    const s = this.tts[this.sent[0]];
    return s ? ttsStateText(s) : '';
  }

  private renderResult() {
    if (!this.result) return nothing;
    const t = ws().announceDlg;
    const wait = this.busySeconds();
    const text = this.progress() && this.result.tone === 'ok' ? this.progress() : this.result.text;
    return html`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${text}${wait > 0 ? html` · ${fill(t.busyIn, { n: wait })}` : nothing}</div>`;
  }

  render() {
    const t = ws().announceDlg;
    const tt = ttt().dialog;
    const choices = this.choices();
    const cur = this.current();
    const len = ttsLength(this.message);
    const engine = this.engines?.engines.find((e) => e.engine_id === this.engine);
    const langs = engine?.supported_languages ?? [];
    const phrases = this.phrases.length ? this.phrases : t.phraseList;
    const done = this.result?.tone === 'ok' && this.sent.length > 0;
    return html`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${t.title} data-wk-announce-dialog @close=${() => this.close()}>
      <div class="body">
        <div class="fld">
          <label>${t.to}</label>
          <div class="chips" role="group" aria-label=${t.to}>
            ${choices.length
              ? choices.map(
                  (c) => html`<button type="button" class="chip" data-wk-target=${c.key} aria-pressed=${String(c.key === cur?.key)} ?disabled=${this.sending} @click=${() => (this.choice = c.key)}>
                    ${c.kind === 'station' ? html`<sw-icon name="door" size=${14}></sw-icon>` : c.kind === 'place' ? html`<sw-icon name="pin" size=${14}></sw-icon>` : nothing}<span>${c.label}</span>
                  </button>`,
                )
              : html`<span class="note" data-wk-announce-notargets>${t.noTargets}</span>`}
          </div>
        </div>
        <div class="fld">
          <label for="msg">${t.message}</label>
          <textarea id="msg" data-wk-announce-message rows="3" maxlength=${TTS_MAX * 2} ?disabled=${this.sending || this.locked} .value=${this.message} @input=${(e: Event) => (this.message = (e.target as HTMLTextAreaElement).value)}></textarea>
          <span class="cnt ${len > TTS_MAX ? 'over' : ''}" aria-live="polite">${fill(t.counter, { n: len, max: TTS_MAX })}</span>
        </div>
        <div class="fld">
          <label>${t.phrases}</label>
          <div class="chips" role="group" aria-label=${t.phrases}>
            ${phrases.map((p) => html`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(collapseText(this.message) === p)} ?disabled=${this.sending || this.locked} @click=${() => (this.message = p)}><span>${p}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${fill(t.preview, { lang: this.engine || !this.missingEngine ? languageName(this.language || 'he') : '—', voice: t.voiceDefault, n: speechSeconds(this.message) })}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${() => (this.more = !this.more)}>${t.more}</wk-action-button>
        </div>
        ${this.missingEngine ? html`<div class="result warn" role="status" data-wk-announce-engine-missing>${tfill(tt.missingEngine, { engine: this.missingEngine })}</div>` : nothing}
        ${this.more
          ? html`<div class="engine" data-wk-announce-engine>
                ${this.missingLanguage && this.language
                  ? html`<div class="result warn" role="status" data-wk-announce-language-missing>${tfill(tt.missingLanguage, { language: languageName(this.missingLanguage), auto: languageName(this.language) })}</div>`
                  : nothing}
                ${this.engines?.engines.length
                  ? html`<sw-field label=${t.engine}>
                        <select data-wk-engine .value=${this.engine} @change=${(e: Event) => this.pickEngine((e.target as HTMLSelectElement).value)}>
                          ${!this.engine ? html`<option value="" selected disabled>${tt.pickEngine}</option>` : nothing}
                          ${this.engines.engines.map((x) => html`<option value=${x.engine_id} ?selected=${x.engine_id === this.engine}>${x.engine_id === this.fixed.engine ? `${x.name} · ${tt.fixedTag}` : x.name}</option>`)}
                        </select>
                      </sw-field>
                      ${langs.length
                        ? html`<sw-field label=${t.language}>
                            <select data-wk-language .value=${this.language} @change=${(e: Event) => (this.language = (e.target as HTMLSelectElement).value)}>
                              ${langs.map((l) => html`<option value=${l} ?selected=${l === this.language}>${languageName(l)}</option>`)}
                            </select>
                          </sw-field>`
                        : nothing}`
                  : html`<span class="note">${this.enginesNote || t.enginesLoading}</span>`}
                ${this.engine && this.preselected && this.engine !== this.preselected ? html`<span class="note" style="grid-column:1/-1" data-wk-announce-override>${tt.overridden}</span>` : nothing}
                <span class="note" style="grid-column:1/-1">${t.external}</span>
              </div>`
          : !this.engines && this.enginesNote
            ? html`<div class="result warn" role="status" data-wk-announce-engines-state>${this.enginesNote}</div>`
            : nothing}
        ${this.renderResult()}
      </div>
      <div slot="footer">
        <wk-action-button tone="primary" icon="volume" data-wk-announce-send ?disabled=${!this.ready()} ?busy=${this.sending} @click=${() => void this.send()}>${this.sending ? t.sending : done ? t.sendAgain : t.send}</wk-action-button>
        <wk-action-button data-wk-announce-close ?disabled=${this.sending} @click=${() => this.close()}>${done ? t.close : t.cancel}</wk-action-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-announce-dialog': WkAnnounceDialog;
  }
}

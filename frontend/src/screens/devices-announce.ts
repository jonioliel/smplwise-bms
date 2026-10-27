import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-state-panel';
import { ANNOUNCE_LANGS, announceAreas, announceEmergency, announceSpeak, announceTranslate, type AnnounceForm, type AnnounceLang } from '../api/announcements';
import { describeError } from '../api/client';
import { can, isApi } from '../api/session';
import {
  ALL_ROOMS, applyTemplate, applyTranslation, canSend, canTranslate, channelFlags, editedMachine, emergencyTemplates, hasChannel, partsWithMachine, reviewOk, routineTemplates, sentMachine,
  spokenLangOf, templateName, toggleLang, type Texts,
} from '../announce/model';
import { announceText, announceUiLang } from '../i18n/announce';

const flash = (ms = 3500) => new Promise((r) => setTimeout(r, ms));

/**
 * ANNOUNCE-295 (stage A, speakers only): ראשי › הכרזות (#/devices/announce) for people holding `media.announce` (the built-in `announcer` role). One compact
 * screen that fits the viewport: where (the whole building or a room), which languages (Hebrew / English / Russian), a ready-made template or free text, and
 * a send button; beside it one button per emergency template that sends at ONE click - no confirmation step. The server decides everything (switch, speakers,
 * quiet hours, limits); the screen offers only what the answers allow and shows the server's refusal as a plain line. Management lives in Settings only.
 */
@customElement('devices-announce')
export class DevicesAnnounce extends LitElement {
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' | 'off' = 'loading';
  @state() private err = '';
  @state() private form: AnnounceForm | null = null;
  @state() private room = ALL_ROOMS;
  @state() private langs: AnnounceLang[] = ['he'];
  @state() private texts: Texts = {};
  @state() private tpl = '';
  /** ANNOUNCEB-295: where it goes - the speakers and / or the allowed screens (screens are offered only while the server says they are on) */
  @state() private viaSpeakers = true;
  @state() private viaScreens = true;
  @state() private busy = '';
  @state() private note = '';
  /** ANNOUNCE-297: the languages whose text came from the automatic translation, and whether the sender ticked "I reviewed the translation" */
  @state() private machine: Set<AnnounceLang> = new Set();
  @state() private reviewed = false;

  static styles = css`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); gap: 14px; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg, 12px); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 64px; }
    select, textarea { box-sizing: border-box; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); max-inline-size: 100%; }
    select { min-block-size: 36px; padding-inline: 10px; }
    textarea { inline-size: 100%; padding: 8px 10px; resize: none; block-size: 56px; }
    .chip { min-block-size: 34px; padding-inline: 12px; border-radius: 999px; border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
    .chip[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .part { display: flex; flex-direction: column; gap: 4px; }
    .em { display: flex; flex-direction: column; gap: 8px; }
    .em sw-button { inline-size: 100%; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    /* ANNOUNCE-297 design pass: press feedback on the chips (the translate chip too), no double-tap delay */
    .chip { touch-action: manipulation; user-select: none; -webkit-user-select: none; transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); }
    .chip:active:not([disabled]) { transform: scale(0.97); }
    .chip[disabled] { opacity: var(--sw-disabled-opacity, 0.45); cursor: default; }
    /* a long translation grows its field instead of hiding lines (a 200-character Russian text at phone width); one line keeps the old height */
    textarea { field-sizing: content; min-block-size: 56px; max-block-size: 160px; block-size: auto; }
    .part-h { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .mt { padding: 1px 8px; border-radius: 999px; font-size: var(--sw-fs-xs); white-space: nowrap; background: color-mix(in srgb, var(--sw-warning, #b7791f) 16%, var(--sw-surface)); color: var(--sw-text); }
    .rev { display: inline-flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); cursor: pointer; user-select: none; -webkit-user-select: none; }
    .rev input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); }
    @media (pointer: coarse) {
      textarea, select { font-size: 16px; } /* no zoom-in on focus on a phone */
      .rev { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
    .err { padding: 8px 12px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface)); color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) {
      this.phase = 'ready';
      return;
    }
    if (!can('media.announce')) {
      this.phase = 'forbidden';
      return;
    }
    this.phase = 'loading';
    this.err = '';
    try {
      const f = await announceAreas();
      this.form = f;
      if (!f.enabled) {
        this.phase = 'off';
        return;
      }
      const first = spokenLangOf(announceUiLang());
      this.langs = f.languages.includes(first) ? [first] : ['he'];
      this.viaScreens = f.screens_default_on !== false;
      this.phase = 'ready';
    } catch (err) {
      this.err = describeError(err);
      this.phase = 'error';
    }
  }

  private say(msg: string) {
    this.note = msg;
    void flash().then(() => {
      if (this.note === msg) this.note = '';
    });
  }

  private pickTemplate(id: string) {
    this.tpl = id;
    const t = this.form?.templates.find((x) => x.id === id);
    if (t) this.texts = applyTemplate(this.texts, t, this.langs);
  }

  private setLang(l: AnnounceLang) {
    const on = !this.langs.includes(l);
    this.langs = toggleLang(this.langs, l, on);
    const t = this.form?.templates.find((x) => x.id === this.tpl);
    if (t) this.texts = applyTemplate(this.texts, t, this.langs);
  }

  /** ANNOUNCE-297: draft translations of the Hebrew text fill their languages, marked machine-translated; nothing is sent until the sender reviews. */
  private async runTranslate() {
    this.busy = 'translate';
    this.err = '';
    try {
      const r = await announceTranslate((this.texts.he ?? '').trim(), this.form?.translate_targets);
      const next = applyTranslation(this.texts, this.langs, this.machine, r.items);
      this.texts = next.texts;
      this.langs = next.selected;
      this.machine = next.machine;
      this.reviewed = false;
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  private typed(l: AnnounceLang, value: string) {
    this.texts = { ...this.texts, [l]: value };
    this.machine = editedMachine(this.machine, l, value);
    if (l === 'he' && this.machine.size) this.reviewed = false; // the source changed: the translations must be looked at again
  }

  private clearDraft() {
    this.texts = {};
    this.machine = new Set();
    this.reviewed = false;
  }

  private async send() {
    const t = announceText();
    this.busy = 'send';
    this.err = '';
    try {
      const area = this.room === ALL_ROOMS;
      const r = await announceSpeak({ scope: area ? 'all' : 'area', ref: this.room, texts: partsWithMachine(this.texts, this.langs, this.machine), ...(this.tpl ? { template_id: this.tpl } : {}),
        ...channelFlags(this.viaSpeakers, this.viaScreens, !!this.form?.screens_enabled) });
      this.say(r.status === 'queued' ? t.sentQueued : t.sent);
      this.clearDraft();
      this.tpl = '';
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  // ONE click, no confirmation step (owner decision): the permission and the audit row are the whole safeguard
  private async emergency(id: string, free = false) {
    this.busy = `e:${id}`;
    this.err = '';
    try {
      if (free) {
        await announceEmergency({ texts: partsWithMachine(this.texts, this.langs, this.machine) });
        this.clearDraft();
      } else await announceEmergency({ template_id: id });
      this.say(announceText().emergencySent);
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = '';
    }
  }

  render() {
    const t = announceText();
    const ui = announceUiLang();
    if (this.phase === 'forbidden') return html`<sw-page heading=${t.title}><sw-state-panel state="forbidden" heading=${t.forbidden}></sw-state-panel></sw-page>`;
    if (this.phase === 'loading') return html`<sw-page heading=${t.title}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.phase === 'error') return html`<sw-page heading=${t.title}><sw-state-panel state="error" heading=${this.err} actionLabel="↻" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    if (this.phase === 'off') return html`<sw-page heading=${t.title}><sw-state-panel icon="bell" state="empty" heading=${t.off}></sw-state-panel></sw-page>`;
    const f = this.form;
    if (!f) return html`<sw-page heading=${t.title}><sw-state-panel icon="bell" state="empty" heading=${t.noTargets}></sw-state-panel></sw-page>`;
    const routine = routineTemplates(f.templates);
    const emergency = emergencyTemplates(f.templates);
    const offered = !!f.screens_enabled;
    const reviewedOk = reviewOk(this.texts, this.langs, this.machine, this.reviewed);
    const pendingReview = sentMachine(this.texts, this.langs, this.machine).length > 0;
    const ok = canSend(this.room, this.texts, this.langs) && hasChannel(this.viaSpeakers, this.viaScreens, offered) && reviewedOk && this.busy === '';
    return html`<sw-page heading=${t.title} data-announce-screen>
      <div class="grid">
        <div class="panel" data-announce-form>
          <div class="row"><span class="lbl">${t.where}</span>
            <select data-announce-where aria-label=${t.where} @change=${(e: Event) => (this.room = (e.target as HTMLSelectElement).value)}>
              <option value=${ALL_ROOMS} ?selected=${this.room === ALL_ROOMS}>${t.wholeBuilding}</option>
              ${f.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.room}>${[a.floor_name, a.name].filter(Boolean).join(' · ')}</option>`)}
            </select></div>
          ${offered ? html`<div class="row"><span class="lbl">${t.channels}</span>
            <button class="chip" type="button" data-announce-via="speakers" aria-pressed=${String(this.viaSpeakers)} @click=${() => (this.viaSpeakers = !this.viaSpeakers)}>${t.channelSpeakers}</button>
            <button class="chip" type="button" data-announce-via="screens" aria-pressed=${String(this.viaScreens)} @click=${() => (this.viaScreens = !this.viaScreens)}>${t.channelScreens}</button></div>` : nothing}
          <div class="row"><span class="lbl">${t.languages}</span>
            ${ANNOUNCE_LANGS.map((l) => html`<button class="chip" type="button" data-announce-lang=${l} aria-pressed=${String(this.langs.includes(l))} @click=${() => this.setLang(l)}>${t.langName[l]}</button>`)}
            ${f.translate_enabled ? html`<button class="chip" type="button" data-announce-translate aria-busy=${this.busy === 'translate' ? 'true' : 'false'} ?disabled=${!canTranslate(true, this.texts) || this.busy !== ''} @click=${() => void this.runTranslate()}>${this.busy === 'translate' ? t.translating : t.translate}</button>` : nothing}</div>
          <div class="row"><span class="lbl">${t.template}</span>
            <select data-announce-template aria-label=${t.template} @change=${(e: Event) => this.pickTemplate((e.target as HTMLSelectElement).value)}>
              <option value="" ?selected=${this.tpl === ''}>${t.noTemplate}</option>
              ${routine.map((x) => html`<option value=${x.id} ?selected=${x.id === this.tpl}>${templateName(x, ui)}</option>`)}
            </select></div>
          ${ANNOUNCE_LANGS.filter((l) => this.langs.includes(l)).map((l) => html`<div class="part"><span class="part-h"><span class="lbl">${t.langName[l]}</span>
            ${this.machine.has(l) && (this.texts[l] ?? '').trim() ? html`<span class="mt" data-announce-machine=${l}>${t.machineBadge}</span>` : nothing}</span>
            <textarea data-announce-text=${l} dir=${l === 'he' || l === 'ar' ? 'rtl' : 'ltr'} lang=${l} maxlength=${f.max_text} aria-label=${this.machine.has(l) ? `${t.langName[l]} · ${t.machineBadge}` : t.langName[l]} .value=${this.texts[l] ?? ''}
              @input=${(e: Event) => this.typed(l, (e.target as HTMLTextAreaElement).value)}></textarea></div>`)}
          <div class="row"><sw-button variant="primary" icon="check" data-announce-send ?disabled=${!ok} @click=${() => void this.send()}>${t.send}</sw-button>
            ${pendingReview ? html`<label class="rev"><input type="checkbox" data-announce-reviewed .checked=${this.reviewed} @change=${(e: Event) => (this.reviewed = (e.target as HTMLInputElement).checked)} />${t.reviewed}</label>` : nothing}
            ${this.note ? html`<span class="ok" role="status">${this.note}</span>` : nothing}</div>
          ${this.err ? html`<div class="err" role="alert">${this.err}</div>` : nothing}
        </div>
        ${emergency.length || canSend(this.room, this.texts, this.langs) ? html`<div class="panel em" data-announce-emergency>
          ${canSend(ALL_ROOMS, this.texts, this.langs) ? html`<sw-button variant="danger" data-announce-emergency-free ?disabled=${this.busy !== '' || !reviewedOk} @click=${() => void this.emergency('free', true)}>${t.emergencyFree}</sw-button>` : nothing}
          ${emergency.map((x) => html`<sw-button variant="danger" data-announce-emergency-button=${x.id} ?disabled=${this.busy !== ''} @click=${() => void this.emergency(x.id)}>${templateName(x, ui)}</sw-button>`)}
        </div>` : nothing}
      </div>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-announce': DevicesAnnounce;
  }
}

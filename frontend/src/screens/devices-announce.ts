import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-state-panel';
import { ANNOUNCE_LANGS, announceAreas, announceEmergency, announceSpeak, type AnnounceForm, type AnnounceLang } from '../api/announcements';
import { describeError } from '../api/client';
import { can, isApi } from '../api/session';
import { ALL_ROOMS, applyTemplate, canSend, emergencyTemplates, partsOf, routineTemplates, spokenLangOf, templateName, toggleLang, type Texts } from '../announce/model';
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
  @state() private busy = '';
  @state() private note = '';

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

  private async send() {
    const t = announceText();
    this.busy = 'send';
    this.err = '';
    try {
      const area = this.room === ALL_ROOMS;
      const r = await announceSpeak({ scope: area ? 'all' : 'area', ref: this.room, texts: partsOf(this.texts, this.langs), ...(this.tpl ? { template_id: this.tpl } : {}) });
      this.say(r.status === 'queued' ? t.sentQueued : t.sent);
      this.texts = {};
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
        await announceEmergency({ texts: partsOf(this.texts, this.langs) });
        this.texts = {};
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
    const ok = canSend(this.room, this.texts, this.langs) && this.busy === '';
    return html`<sw-page heading=${t.title} data-announce-screen>
      <div class="grid">
        <div class="panel" data-announce-form>
          <div class="row"><span class="lbl">${t.where}</span>
            <select data-announce-where aria-label=${t.where} @change=${(e: Event) => (this.room = (e.target as HTMLSelectElement).value)}>
              <option value=${ALL_ROOMS} ?selected=${this.room === ALL_ROOMS}>${t.wholeBuilding}</option>
              ${f.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.room}>${[a.floor_name, a.name].filter(Boolean).join(' · ')}</option>`)}
            </select></div>
          <div class="row"><span class="lbl">${t.languages}</span>
            ${ANNOUNCE_LANGS.map((l) => html`<button class="chip" type="button" data-announce-lang=${l} aria-pressed=${String(this.langs.includes(l))} @click=${() => this.setLang(l)}>${t.langName[l]}</button>`)}</div>
          <div class="row"><span class="lbl">${t.template}</span>
            <select data-announce-template aria-label=${t.template} @change=${(e: Event) => this.pickTemplate((e.target as HTMLSelectElement).value)}>
              <option value="" ?selected=${this.tpl === ''}>${t.noTemplate}</option>
              ${routine.map((x) => html`<option value=${x.id} ?selected=${x.id === this.tpl}>${templateName(x, ui)}</option>`)}
            </select></div>
          ${ANNOUNCE_LANGS.filter((l) => this.langs.includes(l)).map((l) => html`<div class="part"><span class="lbl">${t.langName[l]}</span>
            <textarea data-announce-text=${l} dir=${l === 'he' ? 'rtl' : 'ltr'} maxlength=${f.max_text} aria-label=${t.langName[l]} .value=${this.texts[l] ?? ''}
              @input=${(e: Event) => (this.texts = { ...this.texts, [l]: (e.target as HTMLTextAreaElement).value })}></textarea></div>`)}
          <div class="row"><sw-button variant="primary" icon="check" data-announce-send ?disabled=${!ok} @click=${() => void this.send()}>${t.send}</sw-button>
            ${this.note ? html`<span class="ok" role="status">${this.note}</span>` : nothing}</div>
          ${this.err ? html`<div class="err" role="alert">${this.err}</div>` : nothing}
        </div>
        ${emergency.length || canSend(this.room, this.texts, this.langs) ? html`<div class="panel em" data-announce-emergency>
          ${canSend(ALL_ROOMS, this.texts, this.langs) ? html`<sw-button variant="danger" data-announce-emergency-free ?disabled=${this.busy !== ''} @click=${() => void this.emergency('free', true)}>${t.emergencyFree}</sw-button>` : nothing}
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

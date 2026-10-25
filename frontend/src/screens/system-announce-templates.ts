import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import { ANNOUNCE_LANGS, announcePutTemplates, type AnnounceTemplate, type AnnounceTemplateKind } from '../api/announcements';
import { describeError } from '../api/client';
import { blankTemplate, cleanTemplates, NAME_MAX, removeTemplate, setField, setKind, templateName, templatesProblem, TEMPLATES_MAX, TEXT_MAX } from '../announce/model';
import { announceText, announceUiLang } from '../i18n/announce';

/**
 * ANNOUNCE-295: הגדרות › מולטימדיה › הכרזות קוליות › "תבניות הודעה". The ready-made announcements (routine and emergency; Hebrew, English, Russian) as one list
 * edited here and saved as a whole (`system.configure`; the server validates and audits the change). An emergency template becomes a one-click button on the
 * announcements screen. Arabic is not a spoken language, so a template has no Arabic text.
 */
@customElement('system-announce-templates')
export class SystemAnnounceTemplates extends LitElement {
  @property({ attribute: false }) templates: AnnounceTemplate[] = [];
  @state() private draft: AnnounceTemplate[] = [];
  @state() private dirty = false;
  @state() private err = '';
  @state() private busy = false;

  static styles = css`
    :host { display: block; }
    details { border-block-end: 1px solid var(--sw-border); padding-block: 8px; }
    details:last-of-type { border-block-end: 0; }
    summary { cursor: pointer; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); display: flex; gap: 10px; align-items: center; }
    .muted { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-regular); }
    .grid { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px 10px; align-items: center; padding-block: 10px 4px; }
    input, textarea, select { box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); inline-size: 100%; }
    textarea { padding: 8px 10px; resize: vertical; min-block-size: 56px; }
    .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding-block-start: 10px; }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `;

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('templates') && !this.dirty) this.draft = this.templates.map((t) => ({ ...t, name: { ...t.name }, text: { ...t.text } }));
  }

  private edit(next: AnnounceTemplate[]) {
    this.draft = next;
    this.dirty = true;
    this.err = '';
  }

  private async save() {
    const t = announceText();
    const problem = templatesProblem(this.draft);
    if (problem) {
      this.err = t.tplProblem[problem];
      return;
    }
    this.busy = true;
    try {
      const answer = await announcePutTemplates(cleanTemplates(this.draft));
      this.dirty = false;
      this.draft = answer.templates;
      this.dispatchEvent(new CustomEvent('saved', { detail: { templates: answer.templates }, bubbles: true, composed: true }));
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const t = announceText();
    const ui = announceUiLang();
    return html`<sw-card heading=${t.templates} subheading=${t.templatesHint} data-announce-templates>
      ${this.draft.map((x) => html`<details data-announce-template=${x.id}>
        <summary>${templateName(x, ui) || x.id} <span class="muted">${x.kind === 'emergency' ? t.kindEmergency : t.kindRoutine}</span></summary>
        <div class="grid">
          <span>${t.kind}</span>
          <select data-announce-template-kind aria-label=${t.kind} @change=${(e: Event) => this.edit(setKind(this.draft, x.id, (e.target as HTMLSelectElement).value as AnnounceTemplateKind))}>
            <option value="routine" ?selected=${x.kind === 'routine'}>${t.kindRoutine}</option>
            <option value="emergency" ?selected=${x.kind === 'emergency'}>${t.kindEmergency}</option></select>
          ${ANNOUNCE_LANGS.map((l) => html`
            <span>${t.tplName} · ${t.langName[l]}</span>
            <input type="text" maxlength=${NAME_MAX} data-announce-template-name=${l} dir=${l === 'he' ? 'rtl' : 'ltr'} aria-label=${`${t.tplName} ${t.langName[l]}`} .value=${x.name[l] ?? ''}
              @input=${(e: Event) => this.edit(setField(this.draft, x.id, 'name', l, (e.target as HTMLInputElement).value))} />
            <span>${t.tplText} · ${t.langName[l]}</span>
            <textarea maxlength=${TEXT_MAX} data-announce-template-text=${l} dir=${l === 'he' ? 'rtl' : 'ltr'} aria-label=${`${t.tplText} ${t.langName[l]}`} .value=${x.text[l] ?? ''}
              @input=${(e: Event) => this.edit(setField(this.draft, x.id, 'text', l, (e.target as HTMLTextAreaElement).value))}></textarea>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-announce-template-remove @click=${() => this.edit(removeTemplate(this.draft, x.id))}>${t.removeTemplate}</sw-button>
      </details>`)}
      <div class="bar">
        <sw-button size="sm" data-announce-template-add ?disabled=${this.draft.length >= TEMPLATES_MAX} @click=${() => this.edit([...this.draft, blankTemplate(this.draft)])}>${t.addTemplate}</sw-button>
        <sw-button size="sm" variant="primary" data-announce-template-save ?disabled=${!this.dirty || this.busy} @click=${() => void this.save()}>${t.saveTemplates}</sw-button>
        ${this.err ? html`<span class="err" role="alert" data-announce-template-error>${this.err}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-announce-templates': SystemAnnounceTemplates;
  }
}
